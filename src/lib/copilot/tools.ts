import pg from 'pg';
import { AdminRole, AdminCapability, hasAdminCapability } from '../admin-rbac';
import { fetchAnalyticsWorkspace, AnalyticsRange } from '../admin-analytics';
import { fetchOutboxEventsPage } from '../admin-automations';
import { getInventoryState } from '../admin-inventory';

const pool = new pg.Pool({
  connectionString: process.env['DATABASE_URL'],
});

export type CopilotToolName =
  | 'get_orders_summary'
  | 'get_order_details'
  | 'get_inventory_health'
  | 'get_business_analytics'
  | 'get_customer_summary'
  | 'get_automation_health'
  | 'get_failed_event_details';

export const TOOL_CAPABILITY_MAP: Record<CopilotToolName, AdminCapability> = {
  get_orders_summary: 'VIEW_ORDERS',
  get_order_details: 'VIEW_ORDERS',
  get_inventory_health: 'VIEW_INVENTORY',
  get_business_analytics: 'VIEW_ANALYTICS',
  get_customer_summary: 'VIEW_CUSTOMERS',
  get_automation_health: 'VIEW_AUTOMATIONS',
  get_failed_event_details: 'VIEW_AUTOMATIONS',
};

export type CopilotToolExecutionResult =
  | { authorized: true; toolName: CopilotToolName; data: unknown }
  | { authorized: false; toolName: CopilotToolName; message: string };

/**
 * Deterministic Intent Router
 * Maps natural language user questions to approved CopilotToolName.
 */
export function determineCopilotIntent(userMessage: string): {
  toolName: CopilotToolName;
  params: Record<string, string>;
} {
  const msg = (userMessage || '').toLowerCase();

  // FAILED EVENT DETAILS
  const eventMatch = msg.match(/event\s+([a-f0-9\-]{8,})/i) || msg.match(/([a-f0-9\-]{36})/i);
  if (eventMatch && (msg.includes('failed') || msg.includes('explain') || msg.includes('event'))) {
    return { toolName: 'get_failed_event_details', params: { eventId: eventMatch[1] } };
  }

  // ORDER DETAILS
  const orderMatch = msg.match(/order\s+([a-f0-9\-]{8,})/i);
  if (orderMatch) {
    return { toolName: 'get_order_details', params: { orderId: orderMatch[1] } };
  }

  // AUTOMATION HEALTH / FAILED EVENTS
  if (
    msg.includes('fail') ||
    msg.includes('automation') ||
    msg.includes('outbox') ||
    msg.includes('webhook') ||
    msg.includes('error') ||
    msg.includes('reliability')
  ) {
    return { toolName: 'get_automation_health', params: {} };
  }

  // BUSINESS ANALYTICS
  if (
    msg.includes('revenue') ||
    msg.includes('aov') ||
    msg.includes('average order') ||
    msg.includes('metric') ||
    msg.includes('analytics') ||
    msg.includes('kpi') ||
    msg.includes('paid order rate') ||
    msg.includes('ltv')
  ) {
    let range: AnalyticsRange = '30d';
    if (msg.includes('7d') || msg.includes('7 days') || msg.includes('week')) range = '7d';
    if (msg.includes('90d') || msg.includes('90 days') || msg.includes('quarter')) range = '90d';
    if (msg.includes('all') || msg.includes('ever')) range = 'all';
    return { toolName: 'get_business_analytics', params: { range } };
  }

  // INVENTORY HEALTH
  if (
    msg.includes('stock') ||
    msg.includes('inventory') ||
    msg.includes('product') ||
    msg.includes('item') ||
    msg.includes('catalog')
  ) {
    let statusFilter: 'LOW_STOCK' | 'OUT_OF_STOCK' | 'ALL' = 'ALL';
    if (msg.includes('low')) statusFilter = 'LOW_STOCK';
    if (msg.includes('out') || msg.includes('empty')) statusFilter = 'OUT_OF_STOCK';
    return { toolName: 'get_inventory_health', params: { statusFilter } };
  }

  // CUSTOMER SUMMARY
  if (
    msg.includes('customer') ||
    msg.includes('crm') ||
    msg.includes('user') ||
    msg.includes('buyer')
  ) {
    const emailMatch = msg.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
    return {
      toolName: 'get_customer_summary',
      params: emailMatch ? { email: emailMatch[1] } : {},
    };
  }

  // ORDERS SUMMARY (Default for order queries)
  let status = '';
  if (msg.includes('processing')) status = 'PROCESSING';
  if (msg.includes('pending')) status = 'PENDING';
  if (msg.includes('shipped')) status = 'SHIPPED';
  if (msg.includes('delivered')) status = 'DELIVERED';
  if (msg.includes('hold') || msg.includes('on hold')) status = 'ON_HOLD';

  return { toolName: 'get_orders_summary', params: status ? { status } : {} };
}

/**
 * Server-only tool execution wrapper with strict PER-TOOL RBAC enforcement.
 * Authorization is evaluated BEFORE executing the underlying PostgreSQL query.
 */
export async function executeCopilotTool(
  toolName: CopilotToolName,
  params: Record<string, string>,
  adminRole: AdminRole,
  customClient?: pg.PoolClient | pg.Client
): Promise<CopilotToolExecutionResult> {
  const requiredCapability = TOOL_CAPABILITY_MAP[toolName];

  // RBAC GUARD: Check capability before database execution
  if (!hasAdminCapability(adminRole, requiredCapability)) {
    return {
      authorized: false,
      toolName,
      message: `Access Denied: Admin role '${adminRole}' lacks capability '${requiredCapability}' required to run tool '${toolName}'.`,
    };
  }

  const client = customClient || (await pool.connect());

  try {
    switch (toolName) {
      case 'get_orders_summary': {
        const limit = Math.min(20, Math.max(1, parseInt(params['limit'] || '10', 10)));
        const statusFilter = params['status']?.toUpperCase();

        let sql = `SELECT id, status, "paymentStatus", "totalCents", "createdAt" FROM "order"`;
        const queryParams: unknown[] = [];
        if (statusFilter) {
          sql += ` WHERE status = $1`;
          queryParams.push(statusFilter);
        }
        sql += ` ORDER BY "createdAt" DESC LIMIT $${queryParams.length + 1}`;
        queryParams.push(limit);

        const res = await client.query(sql, queryParams);
        const orders = res.rows.map((r) => ({
          orderId: r.id,
          shortId: r.id.length > 12 ? `${r.id.substring(0, 8)}...` : r.id,
          status: r.status,
          paymentStatus: r.paymentStatus,
          totalCents: r.totalCents,
          createdAt: r.createdAt,
        }));

        return {
          authorized: true,
          toolName,
          data: {
            totalReturned: orders.length,
            appliedFilter: statusFilter || 'ALL',
            orders,
          },
        };
      }

      case 'get_order_details': {
        const orderId = params['orderId'];
        if (!orderId) {
          return { authorized: true, toolName, data: { error: 'Order ID is required' } };
        }
        const res = await client.query(
          `SELECT id, status, "paymentStatus", "totalCents", carrier, "trackingNumber", "createdAt", "updatedAt"
           FROM "order" WHERE id = $1 LIMIT 1`,
          [orderId]
        );
        if (res.rows.length === 0) {
          return { authorized: true, toolName, data: { found: false, message: 'Order not found' } };
        }
        const r = res.rows[0];
        return {
          authorized: true,
          toolName,
          data: {
            found: true,
            order: {
              id: r.id,
              status: r.status,
              paymentStatus: r.paymentStatus,
              totalCents: r.totalCents,
              carrier: r.carrier || null,
              trackingNumber: r.trackingNumber || null,
              createdAt: r.createdAt,
              updatedAt: r.updatedAt,
            },
          },
        };
      }

      case 'get_inventory_health': {
        const filter = params['statusFilter'] || 'ALL';
        const res = await client.query(
          `SELECT id, name, category, stock, "lowStockThreshold" FROM "product" ORDER BY stock ASC LIMIT 15`
        );

        let lowStockCount = 0;
        let outOfStockCount = 0;
        let inStockCount = 0;

        const products = res.rows.map((p) => {
          const state = getInventoryState(p.stock, p.lowStockThreshold);
          if (state === 'OUT_OF_STOCK') outOfStockCount++;
          else if (state === 'LOW_STOCK') lowStockCount++;
          else inStockCount++;

          return {
            name: p.name,
            category: p.category,
            stock: p.stock,
            threshold: p.lowStockThreshold,
            state,
          };
        });

        const filteredProducts =
          filter === 'LOW_STOCK'
            ? products.filter((p) => p.state === 'LOW_STOCK')
            : filter === 'OUT_OF_STOCK'
            ? products.filter((p) => p.state === 'OUT_OF_STOCK')
            : products;

        return {
          authorized: true,
          toolName,
          data: {
            summary: {
              totalInspected: products.length,
              inStockCount,
              lowStockCount,
              outOfStockCount,
              attentionRequiredCount: lowStockCount + outOfStockCount,
            },
            products: filteredProducts.slice(0, 10),
          },
        };
      }

      case 'get_business_analytics': {
        const range = (params['range'] || '30d') as AnalyticsRange;
        // Reuses authoritative Phase 7 metrics engine!
        const analytics = await fetchAnalyticsWorkspace(range);
        return {
          authorized: true,
          toolName,
          data: {
            range: analytics.range,
            rangeLabel: analytics.rangeLabel,
            kpis: analytics.kpis,
            fulfillmentDistribution: analytics.fulfillmentDistribution,
          },
        };
      }

      case 'get_customer_summary': {
        const email = params['email'];
        let sql = `SELECT c.id, c.email, c.name, c."createdAt",
                          COUNT(o.id)::int AS "totalOrders",
                          COALESCE(SUM(CASE WHEN o."paymentStatus" = 'PAID' THEN o."totalCents" ELSE 0 END), 0)::int AS "ltvCents"
                   FROM "customer" c
                   LEFT JOIN "order" o ON c.id = o."customerId"`;
        const queryParams: unknown[] = [];
        if (email) {
          sql += ` WHERE c.email ILIKE $1`;
          queryParams.push(`%${email}%`);
        }
        sql += ` GROUP BY c.id ORDER BY "ltvCents" DESC LIMIT 10`;

        const res = await client.query(sql, queryParams);
        const customers = res.rows.map((r) => ({
          name: r.name,
          email: r.email,
          totalOrders: Number(r.totalOrders),
          ltvCents: Number(r.ltvCents),
          createdAt: r.createdAt,
        }));

        return {
          authorized: true,
          toolName,
          data: {
            totalCustomersReturned: customers.length,
            customers,
          },
        };
      }

      case 'get_automation_health': {
        const pageData = await fetchOutboxEventsPage({ page: 1, pageSize: 5 });
        const failedPage = await fetchOutboxEventsPage({ status: 'FAILED', page: 1, pageSize: 5 });
        return {
          authorized: true,
          toolName,
          data: {
            summary: pageData.metrics,
            recentFailedEvents: failedPage.events.map((e) => ({
              id: e.id,
              eventType: e.eventType,
              attemptCount: e.attemptCount,
              status: e.status,
              createdAt: e.createdAt,
              sanitizedError: e.lastError ? e.lastError.slice(0, 200) : 'No error payload',
            })),
          },
        };
      }

      case 'get_failed_event_details': {
        const eventId = params['eventId'];
        if (!eventId) {
          return { authorized: true, toolName, data: { error: 'Event ID is required' } };
        }

        const res = await client.query(
          `SELECT id, "eventType", "aggregateType", "aggregateId", status, "attemptCount", "lastAttemptAt", "lastError", "createdAt"
           FROM "outboxEvent" WHERE id = $1 LIMIT 1`,
          [eventId]
        );

        if (res.rows.length === 0) {
          return { authorized: true, toolName, data: { found: false, message: 'Outbox event not found' } };
        }

        const e = res.rows[0];
        return {
          authorized: true,
          toolName,
          data: {
            found: true,
            event: {
              id: e.id,
              eventType: e.eventType,
              aggregateType: e.aggregateType,
              aggregateId: e.aggregateId,
              status: e.status,
              attemptCount: e.attemptCount,
              lastAttemptAt: e.lastAttemptAt,
              sanitizedError: e.lastError ? e.lastError.slice(0, 300) : 'None',
              createdAt: e.createdAt,
              recoveryEligibility: e.status === 'FAILED' ? 'Eligible for manual requeue via Admin Console' : 'Not failed',
            },
          },
        };
      }

      default:
        return {
          authorized: false,
          toolName,
          message: `Unknown copilot tool name: ${toolName}`,
        };
    }
  } finally {
    if (!customClient) {
      (client as pg.PoolClient).release();
    }
  }
}
