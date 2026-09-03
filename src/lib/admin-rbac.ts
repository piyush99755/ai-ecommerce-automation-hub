import pg from 'pg';
import { getAuthenticatedAdminServer, AdminSessionPayload } from './admin-auth';

const pool = new pg.Pool({
  connectionString: process.env['DATABASE_URL'],
});

export type AdminRole = 'SUPER_ADMIN' | 'OPERATIONS' | 'SUPPORT';

export type AdminCapability =
  | 'VIEW_DASHBOARD'
  | 'VIEW_ORDERS'
  | 'VIEW_CUSTOMERS'
  | 'VIEW_INVENTORY'
  | 'ADJUST_INVENTORY'
  | 'VIEW_AUTOMATIONS'
  | 'REQUEUE_AUTOMATION'
  | 'VIEW_ANALYTICS'
  | 'VIEW_AUDIT_LOG'
  | 'USE_AI_COPILOT';

const ROLE_CAPABILITIES: Record<AdminRole, Set<AdminCapability>> = {
  SUPER_ADMIN: new Set<AdminCapability>([
    'VIEW_DASHBOARD',
    'VIEW_ORDERS',
    'VIEW_CUSTOMERS',
    'VIEW_INVENTORY',
    'ADJUST_INVENTORY',
    'VIEW_AUTOMATIONS',
    'REQUEUE_AUTOMATION',
    'VIEW_ANALYTICS',
    'VIEW_AUDIT_LOG',
    'USE_AI_COPILOT',
  ]),
  OPERATIONS: new Set<AdminCapability>([
    'VIEW_DASHBOARD',
    'VIEW_ORDERS',
    'VIEW_CUSTOMERS',
    'VIEW_INVENTORY',
    'ADJUST_INVENTORY',
    'VIEW_AUTOMATIONS',
    'REQUEUE_AUTOMATION',
    'VIEW_ANALYTICS',
    'VIEW_AUDIT_LOG',
    'USE_AI_COPILOT',
  ]),
  SUPPORT: new Set<AdminCapability>([
    'VIEW_DASHBOARD',
    'VIEW_ORDERS',
    'VIEW_CUSTOMERS',
    'VIEW_INVENTORY',
    'VIEW_AUTOMATIONS',
    'VIEW_ANALYTICS',
    'USE_AI_COPILOT',
  ]),
};

export interface AuthenticatedAdminRecord {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
}

/**
 * Checks whether a given AdminRole possesses a specific AdminCapability.
 */
export function hasAdminCapability(role: AdminRole, capability: AdminCapability): boolean {
  const caps = ROLE_CAPABILITIES[role];
  return caps ? caps.has(capability) : false;
}

/**
 * Loads the current Admin record from PostgreSQL using the adminId from the session.
 * Ensures 100% role freshness so role updates in PostgreSQL take immediate effect.
 */
export async function getFreshAdmin(
  adminId: string,
  customClient?: pg.PoolClient | pg.Client
): Promise<AuthenticatedAdminRecord | null> {
  const client = customClient || (await pool.connect());
  try {
    const res = await client.query(
      'SELECT id, email, name, role FROM "admin" WHERE id = $1 LIMIT 1',
      [adminId]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role as AdminRole,
    };
  } finally {
    if (!customClient) {
      (client as pg.PoolClient).release();
    }
  }
}

export type AuthorizationResult =
  | { authorized: true; admin: AuthenticatedAdminRecord; session: AdminSessionPayload }
  | { authorized: false; status: 401 | 403; error: string };

/**
 * Central Server Authorization Guard.
 * 1. Verifies HMAC session cookie signature & expiration.
 * 2. Fetches fresh Admin record from PostgreSQL to prevent stale role vulnerability.
 * 3. Evaluates capability against fresh role.
 */
export async function authorizeAdminCapability(
  capability: AdminCapability,
  customClient?: pg.PoolClient | pg.Client
): Promise<AuthorizationResult> {
  const session = await getAuthenticatedAdminServer();
  if (!session) {
    return { authorized: false, status: 401, error: 'Unauthenticated session' };
  }

  const admin = await getFreshAdmin(session.id, customClient);
  if (!admin) {
    return { authorized: false, status: 401, error: 'Admin account not found in database' };
  }

  if (!hasAdminCapability(admin.role, capability)) {
    return {
      authorized: false,
      status: 403,
      error: `Forbidden: Admin role '${admin.role}' lacks capability '${capability}'`,
    };
  }

  return { authorized: true, admin, session };
}
