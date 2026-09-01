import { db } from '@/prisma/db';

export interface RecentOrderSummary {
  id: string;
  shortId: string;
  customerName: string;
  customerEmail: string;
  totalCents: number;
  paymentStatus: string;
  status: string;
  createdAt: string;
}

export interface InventoryAttentionItem {
  id: string;
  name: string;
  category: string;
  stock: number;
  lowStockThreshold: number;
  state: 'OUT_OF_STOCK' | 'LOW_STOCK';
}

export interface AutomationHealthSummary {
  pending: number;
  processing: number;
  delivered: number;
  failed: number;
}

export interface DashboardMetricsData {
  totalRevenueCents: number;
  totalOrdersCount: number;
  paidOrdersCount: number;
  processingOrdersCount: number;
  lowStockProductsCount: number;
  failedAutomationsCount: number;
  recentOrders: RecentOrderSummary[];
  inventoryAttention: InventoryAttentionItem[];
  automationHealth: AutomationHealthSummary;
  orderStatusDistribution: Record<string, number>;
}

/**
 * Aggregates dashboard metrics from authoritative persisted PostgreSQL state.
 *
 * NOTE ON SCALE:
 * Current implementation uses concurrent *.all() queries + in-memory aggregation,
 * which is optimal for portfolio/demo scale datasets (< 10,000 records).
 * For large production scale (> 100,000 records), this layer should be migrated to direct
 * database COUNT/SUM/filter/pagination SQL queries to minimize network payload size and memory footprint.
 */
export async function fetchDashboardMetrics(): Promise<DashboardMetricsData> {
  // Execute independent database queries concurrently in parallel
  const [orders, customers, products, outboxEvents] = await Promise.all([
    db.orm.public.Order.all(),
    db.orm.public.Customer.all(),
    db.orm.public.Product.all(),
    db.orm.public.OutboxEvent.all(),
  ]);

  const customerMap = new Map(customers.map((c) => [c.id, c]));

  // 1. Total Revenue: sum totalCents of legitimately PAID orders only
  const paidOrders = orders.filter((o) => o.paymentStatus === 'PAID');
  const totalRevenueCents = paidOrders.reduce((sum, o) => sum + o.totalCents, 0);

  // 2. Core Operational KPI Counts
  const totalOrdersCount = orders.length;
  const paidOrdersCount = paidOrders.length;
  const processingOrdersCount = orders.filter((o) => o.status === 'PROCESSING').length;
  const lowStockProductsCount = products.filter(
    (p) => p.stock > 0 && p.stock <= p.lowStockThreshold
  ).length;
  const failedAutomationsCount = outboxEvents.filter((e) => e.status === 'FAILED').length;

  // 3. Recent Orders (Sorted newest first, top 8)
  const sortedOrders = [...orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const recentOrders: RecentOrderSummary[] = sortedOrders.slice(0, 8).map((o) => {
    const cust = customerMap.get(o.customerId);
    return {
      id: o.id,
      shortId: o.id.length > 12 ? `${o.id.substring(0, 8)}...` : o.id,
      customerName: cust?.name || 'Unknown Customer',
      customerEmail: cust?.email || 'N/A',
      totalCents: o.totalCents,
      paymentStatus: o.paymentStatus,
      status: o.status,
      createdAt: o.createdAt,
    };
  });

  // 4. Inventory Attention (Products with stock <= threshold, sorted lowest stock first)
  const attentionProducts = products
    .filter((p) => p.stock <= p.lowStockThreshold)
    .sort((a, b) => a.stock - b.stock);

  const inventoryAttention: InventoryAttentionItem[] = attentionProducts.slice(0, 6).map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    stock: p.stock,
    lowStockThreshold: p.lowStockThreshold,
    state: p.stock === 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK',
  }));

  // 5. Automation Outbox Health Counts
  const automationHealth: AutomationHealthSummary = {
    pending: outboxEvents.filter((e) => e.status === 'PENDING').length,
    processing: outboxEvents.filter((e) => e.status === 'PROCESSING').length,
    delivered: outboxEvents.filter((e) => e.status === 'DELIVERED').length,
    failed: failedAutomationsCount,
  };

  // 6. Order Status Distribution Breakdown
  const orderStatusDistribution: Record<string, number> = {
    PENDING: 0,
    PROCESSING: 0,
    ON_HOLD: 0,
    SHIPPED: 0,
    DELIVERED: 0,
    CANCELLED: 0,
  };

  for (const o of orders) {
    if (orderStatusDistribution[o.status] !== undefined) {
      orderStatusDistribution[o.status]++;
    } else {
      orderStatusDistribution[o.status] = 1;
    }
  }

  return {
    totalRevenueCents,
    totalOrdersCount,
    paidOrdersCount,
    processingOrdersCount,
    lowStockProductsCount,
    failedAutomationsCount,
    recentOrders,
    inventoryAttention,
    automationHealth,
    orderStatusDistribution,
  };
}

export function formatCurrencyCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}
