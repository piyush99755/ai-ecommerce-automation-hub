import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env['DATABASE_URL'],
});

export type AnalyticsRange = '7d' | '30d' | '90d' | 'all';

export interface AnalyticsKpis {
  revenueCents: number;
  totalOrders: number;
  paidOrders: number;
  aovCents: number;
  paidOrderRate: number;
  repeatCustomersCount: number;
  totalCustomersCount: number;
  newCustomersInRange: number;
  automationTotalEvents: number;
  automationFailedEvents: number;
  automationDeliveredEvents: number;
  automationFailureRate: number;
}

export interface DailyTrendPoint {
  date: string; // YYYY-MM-DD (UTC)
  revenueCents: number;
  totalOrders: number;
  paidOrders: number;
}

export interface TopProductMetric {
  productId: string;
  productName: string;
  productSlug: string;
  unitsSold: number;
  revenueCents: number;
  paidOrdersCount: number;
}

export interface TopCustomerLtvMetric {
  customerId: string;
  customerName: string;
  customerEmail: string;
  paidOrdersCount: number;
  lifetimeValueCents: number;
}

export interface FulfillmentDistributionMetric {
  status: string;
  count: number;
  percentage: number;
}

export interface TopFailingEventTypeMetric {
  eventType: string;
  failedCount: number;
}

export interface InventoryAnalyticsMetrics {
  lowStockCount: number;
  outOfStockCount: number;
  totalUnitsOnHand: number;
}

export interface AnalyticsWorkspaceData {
  range: AnalyticsRange;
  rangeLabel: string;
  kpis: AnalyticsKpis;
  dailyTrends: DailyTrendPoint[];
  topProducts: TopProductMetric[];
  topCustomersLtv: TopCustomerLtvMetric[];
  fulfillmentDistribution: FulfillmentDistributionMetric[];
  inventoryHealth: InventoryAnalyticsMetrics;
  topFailingEventTypes: TopFailingEventTypeMetric[];
}

/**
 * Validates and normalizes user range input against strict allowlist.
 */
export function normalizeAnalyticsRange(rawRange?: string | null): AnalyticsRange {
  if (!rawRange) return '30d';
  const clean = rawRange.trim().toLowerCase();
  if (clean === '7d' || clean === '30d' || clean === '90d' || clean === 'all') {
    return clean as AnalyticsRange;
  }
  return '30d';
}

/**
 * Returns integer days or null for all-time.
 */
function getRangeDays(range: AnalyticsRange): number | null {
  switch (range) {
    case '7d':
      return 7;
    case '30d':
      return 30;
    case '90d':
      return 90;
    case 'all':
      return null;
  }
}

/**
 * Formats currency cents into clean string $XX.YY
 */
export function formatCurrencyCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Fetches authoritative PostgreSQL analytics using parameterized SQL aggregations.
 * Timezone: UTC.
 * Supports passing an optional custom dbClient for transactional test verification.
 */
export async function fetchAnalyticsWorkspace(
  rawRange?: string | null,
  customClient?: pg.PoolClient | pg.Client
): Promise<AnalyticsWorkspaceData> {
  const range = normalizeAnalyticsRange(rawRange);
  const days = getRangeDays(range);
  const client = customClient || (await pool.connect());

  try {
    // Build SQL date cutoff condition
    const daysParam = days !== null ? `${days} days` : null;

    // 1. Fetch Headline KPIs & Revenue Metrics
    const kpiSql = days !== null
      ? `SELECT
          COALESCE(SUM("totalCents") FILTER (WHERE "paymentStatus" = 'PAID'), 0)::bigint AS "revenueCents",
          COUNT(*)::int AS "totalOrders",
          COUNT(*) FILTER (WHERE "paymentStatus" = 'PAID')::int AS "paidOrders"
         FROM "order"
         WHERE "createdAt" >= NOW() - $1::INTERVAL`
      : `SELECT
          COALESCE(SUM("totalCents") FILTER (WHERE "paymentStatus" = 'PAID'), 0)::bigint AS "revenueCents",
          COUNT(*)::int AS "totalOrders",
          COUNT(*) FILTER (WHERE "paymentStatus" = 'PAID')::int AS "paidOrders"
         FROM "order"`;

    const kpiRes = days !== null
      ? await client.query(kpiSql, [daysParam])
      : await client.query(kpiSql);

    const revenueCents = Number(kpiRes.rows[0]?.revenueCents || 0);
    const totalOrders = Number(kpiRes.rows[0]?.totalOrders || 0);
    const paidOrders = Number(kpiRes.rows[0]?.paidOrders || 0);

    const aovCents = paidOrders > 0 ? Math.round(revenueCents / paidOrders) : 0;
    const paidOrderRate = totalOrders > 0 ? Math.round((paidOrders / totalOrders) * 10000) / 100 : 0;

    // 2. Fetch Customer Metrics (Total, Repeat, New in Range)
    const customerTotalRes = await client.query('SELECT COUNT(*)::int AS count FROM "customer"');
    const totalCustomersCount = Number(customerTotalRes.rows[0]?.count || 0);

    const customerNewRes = days !== null
      ? await client.query('SELECT COUNT(*)::int AS count FROM "customer" WHERE "createdAt" >= NOW() - $1::INTERVAL', [daysParam])
      : { rows: [{ count: totalCustomersCount }] };
    const newCustomersInRange = Number(customerNewRes.rows[0]?.count || 0);

    const repeatCustomersRes = await client.query(
      `SELECT COUNT(*)::int AS count FROM (
        SELECT "customerId"
        FROM "order"
        WHERE "paymentStatus" = 'PAID'
        GROUP BY "customerId"
        HAVING COUNT(*) >= 2
       ) AS repeaters`
    );
    const repeatCustomersCount = Number(repeatCustomersRes.rows[0]?.count || 0);

    // 3. Fetch Automation Reliability KPIs (OutboxEvents)
    const outboxSql = days !== null
      ? `SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'FAILED')::int AS failed,
          COUNT(*) FILTER (WHERE status = 'DELIVERED')::int AS delivered
         FROM "outboxEvent"
         WHERE "createdAt" >= NOW() - $1::INTERVAL`
      : `SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'FAILED')::int AS failed,
          COUNT(*) FILTER (WHERE status = 'DELIVERED')::int AS delivered
         FROM "outboxEvent"`;

    const outboxRes = days !== null
      ? await client.query(outboxSql, [daysParam])
      : await client.query(outboxSql);

    const automationTotalEvents = Number(outboxRes.rows[0]?.total || 0);
    const automationFailedEvents = Number(outboxRes.rows[0]?.failed || 0);
    const automationDeliveredEvents = Number(outboxRes.rows[0]?.delivered || 0);
    const automationFailureRate = automationTotalEvents > 0
      ? Math.round((automationFailedEvents / automationTotalEvents) * 10000) / 100
      : 0;

    // 4. Fetch Daily Trends (Zero-filled UTC days)
    let dailyTrends: DailyTrendPoint[] = [];
    if (days !== null) {
      const trendSql = `
        SELECT 
          DATE_TRUNC('day', "createdAt" AT TIME ZONE 'UTC')::date::text AS day,
          COUNT(*)::int AS "totalOrders",
          COUNT(*) FILTER (WHERE "paymentStatus" = 'PAID')::int AS "paidOrders",
          COALESCE(SUM("totalCents") FILTER (WHERE "paymentStatus" = 'PAID'), 0)::bigint AS "revenueCents"
        FROM "order"
        WHERE "createdAt" >= NOW() - $1::INTERVAL
        GROUP BY 1
        ORDER BY 1 ASC
      `;
      const trendRes = await client.query(trendSql, [daysParam]);
      const trendMap = new Map<string, { revenueCents: number; totalOrders: number; paidOrders: number }>();
      for (const row of trendRes.rows) {
        trendMap.set(row.day, {
          revenueCents: Number(row.revenueCents),
          totalOrders: Number(row.totalOrders),
          paidOrders: Number(row.paidOrders),
        });
      }

      // Generate zero-filled daily series for full range (days count)
      const now = new Date();
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
        const dayStr = d.toISOString().split('T')[0];
        const existing = trendMap.get(dayStr);
        dailyTrends.push({
          date: dayStr,
          revenueCents: existing ? existing.revenueCents : 0,
          totalOrders: existing ? existing.totalOrders : 0,
          paidOrders: existing ? existing.paidOrders : 0,
        });
      }
    } else {
      // All time daily trend
      const trendSql = `
        SELECT 
          DATE_TRUNC('day', "createdAt" AT TIME ZONE 'UTC')::date::text AS day,
          COUNT(*)::int AS "totalOrders",
          COUNT(*) FILTER (WHERE "paymentStatus" = 'PAID')::int AS "paidOrders",
          COALESCE(SUM("totalCents") FILTER (WHERE "paymentStatus" = 'PAID'), 0)::bigint AS "revenueCents"
        FROM "order"
        GROUP BY 1
        ORDER BY 1 ASC
      `;
      const trendRes = await client.query(trendSql);
      dailyTrends = trendRes.rows.map((row) => ({
        date: row.day,
        revenueCents: Number(row.revenueCents),
        totalOrders: Number(row.totalOrders),
        paidOrders: Number(row.paidOrders),
      }));
    }

    // 5. Fetch Top Products using Persisted OrderItem.unitPriceCents Historical Snapshot
    const topProductsSql = days !== null
      ? `SELECT 
          oi."productId",
          p.name AS "productName",
          p.slug AS "productSlug",
          SUM(oi.quantity)::int AS "unitsSold",
          SUM(oi.quantity * oi."unitPriceCents")::bigint AS "revenueCents",
          COUNT(DISTINCT oi."orderId")::int AS "paidOrdersCount"
         FROM "orderItem" oi
         JOIN "order" o ON oi."orderId" = o.id
         JOIN "product" p ON oi."productId" = p.id
         WHERE o."paymentStatus" = 'PAID'
           AND o."createdAt" >= NOW() - $1::INTERVAL
         GROUP BY oi."productId", p.name, p.slug
         ORDER BY "revenueCents" DESC
         LIMIT 10`
      : `SELECT 
          oi."productId",
          p.name AS "productName",
          p.slug AS "productSlug",
          SUM(oi.quantity)::int AS "unitsSold",
          SUM(oi.quantity * oi."unitPriceCents")::bigint AS "revenueCents",
          COUNT(DISTINCT oi."orderId")::int AS "paidOrdersCount"
         FROM "orderItem" oi
         JOIN "order" o ON oi."orderId" = o.id
         JOIN "product" p ON oi."productId" = p.id
         WHERE o."paymentStatus" = 'PAID'
         GROUP BY oi."productId", p.name, p.slug
         ORDER BY "revenueCents" DESC
         LIMIT 10`;

    const topProductsRes = days !== null
      ? await client.query(topProductsSql, [daysParam])
      : await client.query(topProductsSql);

    const topProducts: TopProductMetric[] = topProductsRes.rows.map((row) => ({
      productId: row.productId,
      productName: row.productName,
      productSlug: row.productSlug,
      unitsSold: Number(row.unitsSold),
      revenueCents: Number(row.revenueCents),
      paidOrdersCount: Number(row.paidOrdersCount),
    }));

    // 6. Fetch Top 5 Highest-LTV Customers (All-Time Historical Paid Orders)
    const topLtvSql = `
      SELECT 
        c.id AS "customerId",
        c.name AS "customerName",
        c.email AS "customerEmail",
        COUNT(o.id)::int AS "paidOrdersCount",
        COALESCE(SUM(o."totalCents"), 0)::bigint AS "lifetimeValueCents"
      FROM "customer" c
      JOIN "order" o ON o."customerId" = c.id
      WHERE o."paymentStatus" = 'PAID'
      GROUP BY c.id, c.name, c.email
      ORDER BY "lifetimeValueCents" DESC
      LIMIT 5
    `;
    const topLtvRes = await client.query(topLtvSql);
    const topCustomersLtv: TopCustomerLtvMetric[] = topLtvRes.rows.map((row) => ({
      customerId: row.customerId,
      customerName: row.customerName,
      customerEmail: row.customerEmail,
      paidOrdersCount: Number(row.paidOrdersCount),
      lifetimeValueCents: Number(row.lifetimeValueCents),
    }));

    // 7. Fetch Order Fulfillment Current Status Distribution
    const statusRes = await client.query(
      `SELECT status, COUNT(*)::int AS count FROM "order" GROUP BY status ORDER BY count DESC`
    );
    const fulfillmentDistribution: FulfillmentDistributionMetric[] = statusRes.rows.map((row) => ({
      status: row.status,
      count: Number(row.count),
      percentage: totalOrders > 0 ? Math.round((Number(row.count) / totalOrders) * 1000) / 10 : 0,
    }));

    // 8. Fetch Inventory Health Metrics
    const invRes = await client.query(
      `SELECT
        COUNT(*) FILTER (WHERE stock <= "lowStockThreshold" AND stock > 0)::int AS "lowStockCount",
        COUNT(*) FILTER (WHERE stock = 0)::int AS "outOfStockCount",
        COALESCE(SUM(stock), 0)::bigint AS "totalUnitsOnHand"
       FROM "product"`
    );
    const inventoryHealth: InventoryAnalyticsMetrics = {
      lowStockCount: Number(invRes.rows[0]?.lowStockCount || 0),
      outOfStockCount: Number(invRes.rows[0]?.outOfStockCount || 0),
      totalUnitsOnHand: Number(invRes.rows[0]?.totalUnitsOnHand || 0),
    };

    // 9. Fetch Top Failing Event Types
    const failingSql = days !== null
      ? `SELECT 
          "eventType",
          COUNT(*)::int AS "failedCount"
         FROM "outboxEvent"
         WHERE status = 'FAILED'
           AND "createdAt" >= NOW() - $1::INTERVAL
         GROUP BY "eventType"
         ORDER BY "failedCount" DESC
         LIMIT 5`
      : `SELECT 
          "eventType",
          COUNT(*)::int AS "failedCount"
         FROM "outboxEvent"
         WHERE status = 'FAILED'
         GROUP BY "eventType"
         ORDER BY "failedCount" DESC
         LIMIT 5`;

    const failingRes = days !== null
      ? await client.query(failingSql, [daysParam])
      : await client.query(failingSql);

    const topFailingEventTypes: TopFailingEventTypeMetric[] = failingRes.rows.map((row) => ({
      eventType: row.eventType,
      failedCount: Number(row.failedCount),
    }));

    const rangeLabelMap: Record<AnalyticsRange, string> = {
      '7d': 'Last 7 Days',
      '30d': 'Last 30 Days',
      '90d': 'Last 90 Days',
      'all': 'All Time',
    };

    return {
      range,
      rangeLabel: rangeLabelMap[range],
      kpis: {
        revenueCents,
        totalOrders,
        paidOrders,
        aovCents,
        paidOrderRate,
        repeatCustomersCount,
        totalCustomersCount,
        newCustomersInRange,
        automationTotalEvents,
        automationFailedEvents,
        automationDeliveredEvents,
        automationFailureRate,
      },
      dailyTrends,
      topProducts,
      topCustomersLtv,
      fulfillmentDistribution,
      inventoryHealth,
      topFailingEventTypes,
    };
  } finally {
    if (!customClient) {
      (client as pg.PoolClient).release();
    }
  }
}
