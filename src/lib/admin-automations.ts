import 'dotenv/config';
import { db } from '@/prisma/db';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env['DATABASE_URL'],
});

export interface AutomationMetricsData {
  pending: number;
  processing: number;
  delivered: number;
  failed: number;
  totalEvents: number;
}

export interface OutboxEventListItem {
  id: string;
  shortId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  shortAggregateId: string;
  status: string;
  attemptCount: number;
  createdAt: string;
  lastAttemptAt: string | null;
  deliveredAt: string | null;
  lastError: string | null;
}

export interface OutboxEventsPageData {
  metrics: AutomationMetricsData;
  events: OutboxEventListItem[];
  totalMatched: number;
  page: number;
  totalPages: number;
  eventTypes: string[];
  statuses: string[];
}

export interface RelatedOrderSummary {
  id: string;
  shortId: string;
  customerName: string;
  totalCents: number;
  status: string;
  paymentStatus: string;
}

export interface RelatedCustomerSummary {
  id: string;
  name: string;
  email: string;
}

export interface ConsumerEventRecord {
  id: string;
  consumerId: string;
  status: string;
  attemptCount: number;
  claimedAt: string;
  completedAt: string | null;
  lastError: string | null;
}

export interface AutomationTimelineItem {
  id: string;
  title: string;
  timestamp: string;
  detail: string;
  type: 'CREATED' | 'ATTEMPT' | 'RETRY_SCHEDULED' | 'DELIVERED' | 'FAILED';
}

export interface DetailedAutomationWorkspaceData {
  event: {
    id: string;
    shortId: string;
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    status: string;
    attemptCount: number;
    createdAt: string;
    lastAttemptAt: string | null;
    nextAttemptAt: string | null;
    deliveredAt: string | null;
  };
  sanitizedPayloadJson: string;
  sanitizedLastError: string | null;
  relatedOrder: RelatedOrderSummary | null;
  relatedCustomer: RelatedCustomerSummary | null;
  consumerEvents: ConsumerEventRecord[];
  timeline: AutomationTimelineItem[];
  evidenceNote: string;
}

export function formatCurrencyCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

/**
 * Redacts sensitive credentials, authorization tokens, API keys, and complete secret-bearing URLs from error strings.
 * Preserves HTTP status codes, error categories, and safe operational context.
 */
export function sanitizeLastError(rawError: string | null | undefined): string | null {
  if (!rawError || typeof rawError !== 'string' || rawError.trim() === '') {
    return null;
  }

  let text = rawError;

  // Mask Bearer & Basic authorization header tokens
  text = text.replace(/Bearer\s+[A-Za-z0-9\-\._~\+\/]+=*/gi, 'Bearer [REDACTED_TOKEN]');
  text = text.replace(/Basic\s+[A-Za-z0-9\-\._~\+\/]+=*/gi, 'Basic [REDACTED_AUTH]');

  // Mask Stripe / API keys (e.g. sk_live_..., sk_test_..., key_...)
  text = text.replace(/sk_(live|test)_[0-9a-zA-Z]+/g, 'sk_$1_[REDACTED_KEY]');
  text = text.replace(/key_[0-9a-zA-Z]{16,}/gi, 'key_[REDACTED]');

  // Mask explicit sensitive query parameters & key-value pairs
  text = text.replace(/(authorization|token|accessToken|secret|apiKey|password|webhookSecret|auth)=[^&\s]+/gi, '$1=[REDACTED]');

  // Mask full URLs that embed private path tokens or secret Webhook parameters (e.g. https://domain.com/webhook/secret-token-123)
  text = text.replace(/https?:\/\/[^\s"']+/gi, (urlStr) => {
    try {
      const parsed = new URL(urlStr);
      // Keep hostname for operational context, redact path & query if secret-bearing
      if (parsed.search || parsed.pathname.length > 1) {
        return `${parsed.protocol}//${parsed.host}/[REDACTED_URL_PATH]`;
      }
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      return '[REDACTED_URL]';
    }
  });

  // Truncate overly long error dumps for clean UI display
  if (text.length > 2000) {
    text = `${text.substring(0, 2000)}... [Truncated for operational safety]`;
  }

  return text.trim();
}

/**
 * Deeply redacts sensitive keys (authorization, secret, token, accessToken, apiKey, password, webhookUrl)
 * across objects, arrays, and nested structures without hiding operational identifiers like orderId, productId, or status.
 */
export function sanitizePayload(payload: unknown): unknown {
  if (payload === null || payload === undefined) {
    return null;
  }

  if (typeof payload === 'string') {
    try {
      const parsed = JSON.parse(payload);
      return sanitizePayload(parsed);
    } catch {
      if (payload.startsWith('http://') || payload.startsWith('https://')) {
        try {
          const parsed = new URL(payload);
          return `${parsed.protocol}//${parsed.host}/[REDACTED_URL_PATH]`;
        } catch {
          return '[REDACTED_URL]';
        }
      }
      return payload;
    }
  }

  if (Array.isArray(payload)) {
    return payload.map(sanitizePayload);
  }

  if (typeof payload === 'object') {
    const sanitizedObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('authorization') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('token') ||
        lowerKey.includes('accesstoken') ||
        lowerKey.includes('apikey') ||
        lowerKey.includes('password') ||
        lowerKey.includes('webhookurl') ||
        (lowerKey === 'key' && typeof value === 'string' && value.length > 12)
      ) {
        sanitizedObj[key] = '[REDACTED_SECRET]';
      } else {
        sanitizedObj[key] = sanitizePayload(value);
      }
    }
    return sanitizedObj;
  }

  return payload;
}

/**
 * Queries outbox events with 100% database-backed filtering, count, sorting, and LIMIT/OFFSET pagination via parameterized SQL.
 * Zero unbounded `.all()` array loads in memory.
 */
export async function fetchOutboxEventsPage(options: {
  q?: string;
  status?: string;
  eventType?: string;
  page?: number;
  pageSize?: number;
}): Promise<OutboxEventsPageData> {
  const { q = '', status = 'ALL', eventType = 'ALL', page = 1, pageSize = 15 } = options;

  const client = await pool.connect();

  try {
    // 1. KPI Counts Aggregation Query (100% Database-Side)
    const metricsRes = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending,
        COUNT(*) FILTER (WHERE status = 'PROCESSING')::int AS processing,
        COUNT(*) FILTER (WHERE status = 'DELIVERED')::int AS delivered,
        COUNT(*) FILTER (WHERE status = 'FAILED')::int AS failed,
        COUNT(*)::int AS "totalEvents"
      FROM "outboxEvent";
    `);

    const metricsRow = metricsRes.rows[0] || {};
    const metrics: AutomationMetricsData = {
      pending: metricsRow.pending || 0,
      processing: metricsRow.processing || 0,
      delivered: metricsRow.delivered || 0,
      failed: metricsRow.failed || 0,
      totalEvents: metricsRow.totalEvents || 0,
    };

    // 2. Distinct Event Types Query for Filter Dropdown (100% Database-Side)
    const eventTypesRes = await client.query(`
      SELECT DISTINCT "eventType"
      FROM "outboxEvent"
      WHERE "eventType" IS NOT NULL
      ORDER BY "eventType" ASC;
    `);
    const eventTypes = eventTypesRes.rows.map((r) => r.eventType);

    // 3. Build Dynamic Parameterized WHERE Clause for Main Table Query
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let paramIdx = 1;

    if (status && status !== 'ALL') {
      conditions.push(`status = $${paramIdx++}`);
      params.push(status);
    }

    if (eventType && eventType !== 'ALL') {
      conditions.push(`"eventType" = $${paramIdx++}`);
      params.push(eventType);
    }

    if (q && q.trim()) {
      const searchPattern = `%${q.trim().toLowerCase()}%`;
      conditions.push(
        `(LOWER(id) LIKE $${paramIdx} OR LOWER("aggregateId") LIKE $${paramIdx} OR LOWER("eventType") LIKE $${paramIdx} OR LOWER("aggregateType") LIKE $${paramIdx})`
      );
      params.push(searchPattern);
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 4. Matched Rows Count Query (100% Database-Side)
    const countSql = `SELECT COUNT(*)::int AS total FROM "outboxEvent" ${whereClause};`;
    const countRes = await client.query(countSql, params);
    const totalMatched = countRes.rows[0]?.total || 0;

    const totalPages = Math.max(1, Math.ceil(totalMatched / pageSize));
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const offset = (currentPage - 1) * pageSize;

    // 5. Main Table Paginated Event Query (100% Database-Side ORDER BY createdAt DESC, id DESC LIMIT x OFFSET y)
    const limitParamIdx = paramIdx;
    const offsetParamIdx = paramIdx + 1;
    const paginatedParams = [...params, pageSize, offset];

    const eventsSql = `
      SELECT id, "eventType", "aggregateType", "aggregateId", status, "attemptCount", "createdAt", "lastAttemptAt", "deliveredAt", "lastError"
      FROM "outboxEvent"
      ${whereClause}
      ORDER BY "createdAt" DESC, id DESC
      LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx};
    `;

    const eventsRes = await client.query(eventsSql, paginatedParams);

    const events: OutboxEventListItem[] = eventsRes.rows.map((e) => ({
      id: e.id,
      shortId: e.id.length > 12 ? `${e.id.substring(0, 8)}...` : e.id,
      eventType: e.eventType,
      aggregateType: e.aggregateType,
      aggregateId: e.aggregateId,
      shortAggregateId: e.aggregateId.length > 12 ? `${e.aggregateId.substring(0, 8)}...` : e.aggregateId,
      status: e.status,
      attemptCount: e.attemptCount,
      createdAt: typeof e.createdAt === 'object' && e.createdAt !== null ? e.createdAt.toISOString() : String(e.createdAt),
      lastAttemptAt: e.lastAttemptAt ? (typeof e.lastAttemptAt === 'object' ? e.lastAttemptAt.toISOString() : String(e.lastAttemptAt)) : null,
      deliveredAt: e.deliveredAt ? (typeof e.deliveredAt === 'object' ? e.deliveredAt.toISOString() : String(e.deliveredAt)) : null,
      lastError: sanitizeLastError(e.lastError),
    }));

    const statusSet = ['PENDING', 'PROCESSING', 'DELIVERED', 'FAILED'];

    return {
      metrics,
      events,
      totalMatched,
      page: currentPage,
      totalPages,
      eventTypes,
      statuses: statusSet,
    };
  } finally {
    client.release();
  }
}

/**
 * Fetches detailed automation event workspace data including payload, failure context, timeline, and related entities.
 */
export async function fetchDetailedAutomationWorkspace(
  eventId: string
): Promise<DetailedAutomationWorkspaceData | null> {
  const event = await db.orm.public.OutboxEvent.where({ id: eventId }).first();
  if (!event) {
    return null;
  }

  // Concurrently query related orders, customers, and consumer events
  const [orders, customers, consumerEvents] = await Promise.all([
    db.orm.public.Order.all(),
    db.orm.public.Customer.all(),
    db.orm.public.ConsumerEvent.where({ eventId: event.id }).all(),
  ]);

  const customerMap = new Map(customers.map((c) => [c.id, c]));

  // Related order resolution
  let relatedOrder: RelatedOrderSummary | null = null;
  if (event.aggregateType === 'Order') {
    const order = orders.find((o) => o.id === event.aggregateId);
    if (order) {
      const cust = customerMap.get(order.customerId);
      relatedOrder = {
        id: order.id,
        shortId: order.id.length > 12 ? `${order.id.substring(0, 8)}...` : order.id,
        customerName: cust?.name || 'Unknown Customer',
        totalCents: order.totalCents,
        status: order.status,
        paymentStatus: order.paymentStatus,
      };
    }
  }

  // Related customer resolution
  let relatedCustomer: RelatedCustomerSummary | null = null;
  if (event.aggregateType === 'Customer') {
    const cust = customerMap.get(event.aggregateId);
    if (cust) {
      relatedCustomer = {
        id: cust.id,
        name: cust.name,
        email: cust.email,
      };
    }
  }

  // Map matching consumer event records
  const mappedConsumerEvents: ConsumerEventRecord[] = consumerEvents.map((ce) => ({
    id: ce.id,
    consumerId: ce.consumerId,
    status: ce.status,
    attemptCount: ce.attemptCount,
    claimedAt: ce.claimedAt,
    completedAt: ce.completedAt,
    lastError: sanitizeLastError(ce.lastError),
  }));

  mappedConsumerEvents.sort(
    (a, b) => new Date(b.claimedAt).getTime() - new Date(a.claimedAt).getTime()
  );

  // Sanitize payload JSON
  const rawPayload = typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload;
  const sanitizedPayload = sanitizePayload(rawPayload);
  const sanitizedPayloadJson = JSON.stringify(sanitizedPayload, null, 2);

  const sanitizedLastError = sanitizeLastError(event.lastError);

  // Build reliability timeline strictly from persisted snapshot evidence
  const timeline: AutomationTimelineItem[] = [];

  // 1. Event Created
  timeline.push({
    id: `tl-created-${event.id}`,
    title: 'Outbox Event Enqueued',
    timestamp: event.createdAt,
    detail: `Event enqueued in PostgreSQL transaction for aggregate ${event.aggregateType} (${event.aggregateId.substring(0, 8)}...).`,
    type: 'CREATED',
  });

  // 2. Last Attempt
  if (event.lastAttemptAt) {
    timeline.push({
      id: `tl-attempt-${event.id}`,
      title: `Latest Execution Attempt (#${event.attemptCount})`,
      timestamp: event.lastAttemptAt,
      detail: `Outbox worker executed delivery attempt #${event.attemptCount}.`,
      type: 'ATTEMPT',
    });
  }

  // 3. Next Retry Scheduled
  if (event.nextAttemptAt && event.status !== 'DELIVERED' && event.status !== 'FAILED') {
    timeline.push({
      id: `tl-retry-${event.id}`,
      title: 'Next Retry Scheduled',
      timestamp: event.nextAttemptAt,
      detail: `Exponential backoff timer scheduled next retry attempt.`,
      type: 'RETRY_SCHEDULED',
    });
  }

  // 4. Delivered Confirmation
  if (event.deliveredAt || event.status === 'DELIVERED') {
    timeline.push({
      id: `tl-delivered-${event.id}`,
      title: 'Dispatch Acknowledged (Delivered)',
      timestamp: event.deliveredAt || event.lastAttemptAt || event.createdAt,
      detail: `Outbox dispatch acknowledged by automation consumer / receiver endpoint.`,
      type: 'DELIVERED',
    });
  }

  // 5. Retries Exhausted (FAILED - Dead-Letter Style Terminal State)
  if (event.status === 'FAILED') {
    timeline.push({
      id: `tl-failed-${event.id}`,
      title: 'Automated Retries Exhausted (Dead-Letter FAILED State)',
      timestamp: event.lastAttemptAt || event.createdAt,
      detail: `Automated retries exhausted after ${event.attemptCount} attempts. Event transitioned to dead-letter FAILED state.`,
      type: 'FAILED',
    });
  }

  // Sort timeline chronologically (newest first for activity feed)
  timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const evidenceNote =
    'Timeline and operational metrics are derived strictly from authoritative PostgreSQL OutboxEvent and ConsumerEvent tables. Field timestamps represent persisted execution snapshots.';

  return {
    event: {
      id: event.id,
      shortId: event.id.length > 12 ? `${event.id.substring(0, 8)}...` : event.id,
      eventType: event.eventType,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      status: event.status,
      attemptCount: event.attemptCount,
      createdAt: event.createdAt,
      lastAttemptAt: event.lastAttemptAt,
      nextAttemptAt: event.nextAttemptAt,
      deliveredAt: event.deliveredAt,
    },
    sanitizedPayloadJson,
    sanitizedLastError,
    relatedOrder,
    relatedCustomer,
    consumerEvents: mappedConsumerEvents,
    timeline,
    evidenceNote,
  };
}
