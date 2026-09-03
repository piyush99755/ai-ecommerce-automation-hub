import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env['DATABASE_URL'],
});

export interface AuditLogEntryInput {
  adminId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

// Safe metadata key allowlist to prevent accidental logging of secrets or tokens
const SAFE_METADATA_ALLOWLIST = new Set([
  'productId',
  'productName',
  'delta',
  'previousStock',
  'newStock',
  'reason',
  'outboxEventId',
  'eventType',
  'previousStatus',
  'newStatus',
  'previousAttemptCount',
  'nextAttemptAt',
  'lastAttemptAtPreserved',
  'lastErrorPreserved',
  'recoveryReason',
  'customerEmail',
  'orderId',
]);

/**
 * Lightweight value sanitizer for free-text audit metadata fields (e.g. reason, recoveryReason).
 * Redacts obvious secrets such as API keys, bearer tokens, passwords, and sensitive token URLs,
 * while preserving valid business explanation context.
 */
export function sanitizeFreeTextValue(text: string): string {
  if (!text || typeof text !== 'string') return text;

  let cleaned = text;

  // 1. Redact Stripe & API secret keys (e.g. sk_live_..., sk_test_..., rk_live_..., rk_test_...)
  cleaned = cleaned.replace(/\b(?:sk|rk)_(?:live|test)_[0-9a-zA-Z]{6,}\b/g, '[REDACTED_SECRET_KEY]');

  // 2. Redact Bearer tokens (e.g. Bearer eyJhbGci...)
  cleaned = cleaned.replace(/Bearer\s+[A-Za-z0-9\-\._~\+\/]+=*/gi, 'Bearer [REDACTED_TOKEN]');

  // 3. Redact explicit Password/Secret assignments (e.g. password=xyz, secret: abc)
  cleaned = cleaned.replace(/\b(password|pass|secret|token|api_key|apikey)\s*[:=]\s*\S+/gi, '$1=[REDACTED]');

  // 4. Redact sensitive path tokens or query parameters in URLs (e.g. /webhook/private-token or ?token=xyz)
  cleaned = cleaned.replace(/(\/webhook\/)[a-zA-Z0-9\-_]{6,}/gi, '$1[REDACTED_TOKEN]');
  cleaned = cleaned.replace(/([?&](?:token|key|secret|auth)=)[^&\s]+/gi, '$1[REDACTED]');

  return cleaned;
}

/**
 * Sanitizes metadata JSON object:
 * 1. Filters keys against SAFE_METADATA_ALLOWLIST to prevent structural leaking of bodies/headers/tokens.
 * 2. Runs lightweight value sanitization on free-text string values to redact accidental pasted secrets.
 */
export function sanitizeAuditMetadata(rawMetadata?: Record<string, unknown>): Record<string, unknown> | null {
  if (!rawMetadata || typeof rawMetadata !== 'object') return null;

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rawMetadata)) {
    if (SAFE_METADATA_ALLOWLIST.has(key)) {
      if (typeof value === 'string') {
        sanitized[key] = sanitizeFreeTextValue(value);
      } else {
        sanitized[key] = value;
      }
    }
  }
  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

/**
 * Inserts a centralized AdminAuditLog entry into PostgreSQL.
 * Must execute inside the same database client/transaction as the business mutation.
 */
export async function recordAdminAuditLog(
  input: AuditLogEntryInput,
  customClient?: pg.PoolClient | pg.Client
): Promise<string> {
  const client = customClient || (await pool.connect());
  const sanitizedMeta = sanitizeAuditMetadata(input.metadata);

  try {
    const res = await client.query(
      `INSERT INTO "adminAuditLog" (id, "adminId", action, "entityType", "entityId", metadata, "createdAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())
       RETURNING id`,
      [
        input.adminId,
        input.action,
        input.entityType,
        input.entityId,
        sanitizedMeta ? JSON.stringify(sanitizedMeta) : null,
      ]
    );
    return res.rows[0].id;
  } finally {
    if (!customClient) {
      (client as pg.PoolClient).release();
    }
  }
}

export interface AdminAuditLogRecord {
  id: string;
  adminId: string;
  adminName: string;
  adminEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface FetchAuditLogsFilter {
  action?: string;
  entityType?: string;
  adminId?: string;
  page?: number;
  pageSize?: number;
}

export interface FetchAuditLogsResponse {
  logs: AdminAuditLogRecord[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Fetches filtered and paginated AdminAuditLog records for the audit workspace.
 */
export async function fetchAdminAuditLogs(
  filter: FetchAuditLogsFilter = {},
  customClient?: pg.PoolClient | pg.Client
): Promise<FetchAuditLogsResponse> {
  const client = customClient || (await pool.connect());
  const page = Math.max(1, filter.page || 1);
  const pageSize = Math.min(100, Math.max(1, filter.pageSize || 20));
  const offset = (page - 1) * pageSize;

  const whereConditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (filter.action && filter.action.trim() !== '') {
    whereConditions.push(`l.action = $${paramIdx++}`);
    params.push(filter.action.trim());
  }

  if (filter.entityType && filter.entityType.trim() !== '') {
    whereConditions.push(`l."entityType" = $${paramIdx++}`);
    params.push(filter.entityType.trim());
  }

  if (filter.adminId && filter.adminId.trim() !== '') {
    whereConditions.push(`l."adminId" = $${paramIdx++}`);
    params.push(filter.adminId.trim());
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  try {
    // Count total rows matching filter
    const countSql = `SELECT COUNT(*)::int AS count FROM "adminAuditLog" l ${whereClause}`;
    const countRes = await client.query(countSql, params);
    const totalCount = Number(countRes.rows[0]?.count || 0);

    // Fetch paginated rows with admin details joined
    const querySql = `
      SELECT 
        l.id,
        l."adminId",
        a.name AS "adminName",
        a.email AS "adminEmail",
        l.action,
        l."entityType",
        l."entityId",
        l.metadata,
        l."createdAt"
      FROM "adminAuditLog" l
      LEFT JOIN "admin" a ON l."adminId" = a.id
      ${whereClause}
      ORDER BY l."createdAt" DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `;

    const queryParams = [...params, pageSize, offset];
    const queryRes = await client.query(querySql, queryParams);

    const logs: AdminAuditLogRecord[] = queryRes.rows.map((row) => ({
      id: row.id,
      adminId: row.adminId,
      adminName: row.adminName || 'Unknown Admin',
      adminEmail: row.adminEmail || '',
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      createdAt: row.createdAt,
    }));

    const totalPages = Math.ceil(totalCount / pageSize) || 1;

    return {
      logs,
      totalCount,
      page,
      pageSize,
      totalPages,
    };
  } finally {
    if (!customClient) {
      (client as pg.PoolClient).release();
    }
  }
}
