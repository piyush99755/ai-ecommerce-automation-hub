import { db } from '@/prisma/db';
import { formatCurrencyCents } from './admin-dashboard';

export interface CustomerTimelineItem {
  id: string;
  title: string;
  timestamp: string;
  detail: string;
  type: 'ACCOUNT' | 'ORDER' | 'PAYMENT' | 'FULFILLMENT';
}

export interface CustomerOrderSummary {
  id: string;
  shortId: string;
  totalCents: number;
  paymentStatus: string;
  status: string;
  createdAt: string;
}

export interface CrmSyncEvidenceSummary {
  statusLabel: string;
  outboxEventCount: number;
  deliveredCount: number;
  failedCount: number;
  evidenceNote: string;
}

export interface DetailedCustomerWorkspaceData {
  customer: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    createdAt: string;
  };
  kpis: {
    totalOrders: number;
    paidOrders: number;
    lifetimeValueCents: number;
    activeOrders: number;
    lastOrderDate?: string | null;
  };
  orders: CustomerOrderSummary[];
  timeline: CustomerTimelineItem[];
  crmSync: CrmSyncEvidenceSummary;
}

export async function fetchDetailedCustomerWorkspace(
  customerId: string
): Promise<DetailedCustomerWorkspaceData | null> {
  const customer = await db.orm.public.Customer.where({ id: customerId }).first();
  if (!customer) {
    return null;
  }

  // Fetch customer orders and outbox events concurrently
  const [allOrders, allOutboxEvents] = await Promise.all([
    db.orm.public.Order.all(),
    db.orm.public.OutboxEvent.all(),
  ]);

  const custOrders = allOrders
    .filter((o) => o.customerId === customer.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const custOrderIds = new Set(custOrders.map((o) => o.id));

  // Scoped Outbox events for customer's orders
  const crmOutboxEvents = allOutboxEvents.filter(
    (e) => e.aggregateType === 'Order' && custOrderIds.has(e.aggregateId)
  );

  // Compute KPIs
  const totalOrders = custOrders.length;
  const paidOrdersList = custOrders.filter((o) => o.paymentStatus === 'PAID');
  const paidOrders = paidOrdersList.length;
  const lifetimeValueCents = paidOrdersList.reduce((sum, o) => sum + o.totalCents, 0);
  const activeOrders = custOrders.filter((o) =>
    ['PENDING', 'PROCESSING', 'ON_HOLD', 'SHIPPED'].includes(o.status)
  ).length;
  const lastOrderDate = custOrders[0]?.createdAt || null;

  // Order summaries for table
  const orders: CustomerOrderSummary[] = custOrders.map((o) => ({
    id: o.id,
    shortId: o.id.length > 12 ? `${o.id.substring(0, 8)}...` : o.id,
    totalCents: o.totalCents,
    paymentStatus: o.paymentStatus,
    status: o.status,
    createdAt: o.createdAt,
  }));

  // Construct Business-Readable Customer Timeline from Persisted Evidence ONLY
  const timeline: CustomerTimelineItem[] = [];

  // 1. Customer Account Created
  timeline.push({
    id: `cust-created-${customer.id}`,
    title: 'Customer Account Registered',
    timestamp: customer.createdAt,
    detail: `Account created in PostgreSQL database (${customer.email}).`,
    type: 'ACCOUNT',
  });

  // 2. Order Activity Timeline Events
  for (const o of custOrders) {
    const shortId = o.id.length > 12 ? `${o.id.substring(0, 8)}...` : o.id;

    // Order Placed
    timeline.push({
      id: `cust-ord-placed-${o.id}`,
      title: `Order Placed (${shortId})`,
      timestamp: o.createdAt,
      detail: `Placed order ${shortId} for total ${formatCurrencyCents(o.totalCents)}.`,
      type: 'ORDER',
    });

    // Payment Verified: Only added to chronological timeline when a reliable persisted payment outbox timestamp exists
    if (o.paymentStatus === 'PAID') {
      const paymentEvent = crmOutboxEvents.find(
        (e) => e.aggregateId === o.id && e.eventType === 'PAYMENT_SUCCEEDED'
      );

      const paymentTimestamp = paymentEvent?.deliveredAt || paymentEvent?.createdAt || null;

      if (paymentTimestamp) {
        timeline.push({
          id: `cust-ord-paid-${o.id}`,
          title: `Payment Verified (${shortId})`,
          timestamp: paymentTimestamp,
          detail: `Stripe webhook signature verified and PAYMENT_SUCCEEDED outbox event logged.`,
          type: 'PAYMENT',
        });
      }
    }

    // Shipped
    if (o.shippedAt) {
      timeline.push({
        id: `cust-ord-shipped-${o.id}`,
        title: `Order Marked Shipped (${shortId})`,
        timestamp: o.shippedAt,
        detail: `Order ${shortId} transitioned to SHIPPED in application lifecycle (Carrier: ${o.carrier || 'Unassigned'}).`,
        type: 'FULFILLMENT',
      });
    }

    // Delivered
    if (o.deliveredAt) {
      timeline.push({
        id: `cust-ord-delivered-${o.id}`,
        title: `Order Marked Delivered (${shortId})`,
        timestamp: o.deliveredAt,
        detail: `Order ${shortId} transitioned to DELIVERED in application lifecycle.`,
        type: 'FULFILLMENT',
      });
    }
  }

  // Sort timeline chronologically (newest first for customer activity feed)
  timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // CRM Sync Evidence Summary (Tightened Conservative Evidence Semantics)
  const deliveredOutbox = crmOutboxEvents.filter((e) => e.status === 'DELIVERED').length;
  const failedOutbox = crmOutboxEvents.filter((e) => e.status === 'FAILED').length;

  const crmSync: CrmSyncEvidenceSummary = {
    statusLabel: crmOutboxEvents.length > 0 ? 'CRM Outbox Engine Active' : 'CRM Automation Configured',
    outboxEventCount: crmOutboxEvents.length,
    deliveredCount: deliveredOutbox,
    failedCount: failedOutbox,
    evidenceNote:
      'Local PostgreSQL persists outbox lifecycle dispatches (PAYMENT_SUCCEEDED, INVENTORY_UPDATED). Outbox DELIVERED status proves dispatch to n8n. Direct HubSpot Contact/Deal record creation is executed downstream by n8n workflows.',
  };

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      createdAt: customer.createdAt,
    },
    kpis: {
      totalOrders,
      paidOrders,
      lifetimeValueCents,
      activeOrders,
      lastOrderDate,
    },
    orders,
    timeline,
    crmSync,
  };
}
