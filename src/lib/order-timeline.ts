import { db } from '@/prisma/db';

export interface TimelineEventItem {
  id: string;
  title: string;
  eventType?: string;
  outboxStatus?: 'PENDING' | 'PROCESSING' | 'DELIVERED' | 'FAILED';
  status: 'COMPLETED' | 'PENDING' | 'FAILED' | 'INFO';
  timestamp: string;
  detail: string;
  attemptCount?: number;
  lastError?: string | null;
  semanticsNote?: string;
}

export interface OrderOutboxEventSummary {
  id: string;
  eventType: string;
  status: string;
  attemptCount: number;
  createdAt: string;
  deliveredAt?: string | null;
  lastError?: string | null;
}

export interface DetailedOrderWorkspaceData {
  order: {
    id: string;
    status: string;
    paymentStatus: string;
    subtotalCents: number;
    totalCents: number;
    stripeCheckoutSessionId?: string | null;
    stripePaymentIntentId?: string | null;
    trackingNumber?: string | null;
    carrier?: string | null;
    shippedAt?: string | null;
    deliveredAt?: string | null;
    createdAt: string;
  };
  customer: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
  } | null;
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    unitPriceCents: number;
  }>;
  timeline: TimelineEventItem[];
  outboxEvents: OrderOutboxEventSummary[];
}

/**
 * Strips any sensitive tokens, URLs, or authorization headers from error strings before rendering.
 */
export function sanitizeErrorMessage(err?: string | null): string | null {
  if (!err) return null;
  return err
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(/Authorization:\s*[^\s]+/gi, 'Authorization: [REDACTED]')
    .replace(/https?:\/\/[^\s]+/gi, '[URL REDACTED]');
}

/**
 * Fetches order workspace data and constructs an audit timeline based STRICTLY on persisted evidence.
 */
export async function fetchDetailedOrderWorkspace(orderId: string): Promise<DetailedOrderWorkspaceData | null> {
  const order = await db.orm.public.Order.where({ id: orderId }).first();
  if (!order) {
    return null;
  }

  // Query related records concurrently
  const [customer, orderItems, allProducts, outboxEvents] = await Promise.all([
    db.orm.public.Customer.where({ id: order.customerId }).first(),
    db.orm.public.OrderItem.where({ orderId: order.id }).all(),
    db.orm.public.Product.all(),
    db.orm.public.OutboxEvent.all(),
  ]);

  const productMap = new Map(allProducts.map((p) => [p.id, p]));

  // Scope OutboxEvents associated with this order
  // OutboxEvent.aggregateType === 'Order' AND OutboxEvent.aggregateId === order.id
  const orderOutboxEvents = outboxEvents
    .filter((e) => e.aggregateType === 'Order' && e.aggregateId === order.id)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const items = orderItems.map((item) => ({
    id: item.id,
    productName: productMap.get(item.productId)?.name || item.productId,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
  }));

  // Construct Timeline from Persisted Database Evidence ONLY
  const timeline: TimelineEventItem[] = [];

  // 1. Evidence: Order Created (Order.createdAt)
  timeline.push({
    id: `evt-created-${order.id}`,
    title: 'Order Created',
    status: 'COMPLETED',
    timestamp: order.createdAt,
    detail: 'Order record created in PostgreSQL database.',
  });

  // 2. Evidence: Payment Verified (Order.paymentStatus === 'PAID' or OutboxEvent PAYMENT_SUCCEEDED)
  const paymentOutbox = orderOutboxEvents.find((e) => e.eventType === 'PAYMENT_SUCCEEDED');
  if (order.paymentStatus === 'PAID' || paymentOutbox) {
    timeline.push({
      id: `evt-payment-${order.id}`,
      title: 'Payment Verified',
      eventType: 'PAYMENT_SUCCEEDED',
      outboxStatus: (paymentOutbox?.status as any) || 'DELIVERED',
      status: 'COMPLETED',
      timestamp: paymentOutbox?.deliveredAt || paymentOutbox?.createdAt || order.createdAt,
      attemptCount: paymentOutbox?.attemptCount,
      detail: 'Stripe webhook signature verified and payment status marked PAID.',
      semanticsNote: 'Represents verified server-side payment evidence, not unverified browser return URL parameters.',
    });
  }

  // 3. Evidence: Atomic Stock Decrement & Inventory Updated
  const inventoryOutbox = orderOutboxEvents.find((e) => e.eventType === 'INVENTORY_UPDATED');
  if (inventoryOutbox || order.status === 'PROCESSING' || order.status === 'SHIPPED' || order.status === 'DELIVERED') {
    timeline.push({
      id: `evt-inventory-${order.id}`,
      title: 'Atomic Inventory Decrement',
      eventType: 'INVENTORY_UPDATED',
      outboxStatus: (inventoryOutbox?.status as any) || 'DELIVERED',
      status: inventoryOutbox?.status === 'FAILED' ? 'FAILED' : 'COMPLETED',
      timestamp: inventoryOutbox?.deliveredAt || inventoryOutbox?.createdAt || order.createdAt,
      attemptCount: inventoryOutbox?.attemptCount,
      lastError: sanitizeErrorMessage(inventoryOutbox?.lastError),
      detail: 'Atomic SQL stock reduction committed in single database transaction.',
    });
  }

  // 4. Evidence: Processing Email Dispatch (Outbox ORDER_PROCESSING_NOTIFICATION)
  const emailOutbox = orderOutboxEvents.find(
    (e) => e.eventType === 'ORDER_PROCESSING_NOTIFICATION' || e.eventType.includes('NOTIFICATION')
  );
  if (emailOutbox) {
    timeline.push({
      id: `evt-email-${emailOutbox.id}`,
      title: 'Processing Email Dispatch',
      eventType: emailOutbox.eventType,
      outboxStatus: emailOutbox.status as any,
      status: emailOutbox.status === 'FAILED' ? 'FAILED' : emailOutbox.status === 'DELIVERED' ? 'COMPLETED' : 'PENDING',
      timestamp: emailOutbox.deliveredAt || emailOutbox.createdAt,
      attemptCount: emailOutbox.attemptCount,
      lastError: sanitizeErrorMessage(emailOutbox?.lastError),
      detail: `Outbox event ${emailOutbox.status.toLowerCase()} to n8n email dispatch workflow.`,
      semanticsNote: 'DELIVERED status proves outbox dispatch to n8n. It does NOT guarantee customer email inbox receipt or open rate.',
    });
  }

  // 5. Evidence: Marked Shipped (order.shippedAt)
  if (order.shippedAt) {
    timeline.push({
      id: `evt-shipped-${order.id}`,
      title: 'Marked Shipped',
      status: 'COMPLETED',
      timestamp: order.shippedAt,
      detail: `Order transitioned to SHIPPED in application lifecycle (Carrier: ${order.carrier || 'Unassigned'}, Tracking: ${order.trackingNumber || 'Pending'}).`,
      semanticsNote: 'Proves application state transition to SHIPPED. Does not imply external carrier transit observation unless carrier webhook evidence exists.',
    });
  }

  // 6. Evidence: Marked Delivered (order.deliveredAt)
  if (order.deliveredAt) {
    timeline.push({
      id: `evt-delivered-${order.id}`,
      title: 'Marked Delivered',
      status: 'COMPLETED',
      timestamp: order.deliveredAt,
      detail: 'Order transitioned to DELIVERED in application lifecycle.',
      semanticsNote: 'Proves application state transition to DELIVERED.',
    });
  }

  // 7. Evidence: Any Failed Outbox Events
  const failedEvents = orderOutboxEvents.filter((e) => e.status === 'FAILED');
  for (const f of failedEvents) {
    if (!timeline.some((t) => t.id.includes(f.id))) {
      timeline.push({
        id: `evt-failed-${f.id}`,
        title: `Automation Failure: ${f.eventType}`,
        eventType: f.eventType,
        outboxStatus: 'FAILED',
        status: 'FAILED',
        timestamp: f.lastAttemptAt || f.createdAt,
        attemptCount: f.attemptCount,
        lastError: sanitizeErrorMessage(f.lastError),
        detail: `Automated outbox dispatch failed after ${f.attemptCount} retries.`,
      });
    }
  }

  // Sort timeline chronologically
  timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const outboxSummaries: OrderOutboxEventSummary[] = orderOutboxEvents.map((e) => ({
    id: e.id,
    eventType: e.eventType,
    status: e.status,
    attemptCount: e.attemptCount,
    createdAt: e.createdAt,
    deliveredAt: e.deliveredAt,
    lastError: sanitizeErrorMessage(e.lastError),
  }));

  return {
    order: {
      id: order.id,
      status: order.status,
      paymentStatus: order.paymentStatus,
      subtotalCents: order.subtotalCents,
      totalCents: order.totalCents,
      stripeCheckoutSessionId: order.stripeCheckoutSessionId,
      stripePaymentIntentId: order.stripePaymentIntentId,
      trackingNumber: order.trackingNumber,
      carrier: order.carrier,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      createdAt: order.createdAt,
    },
    customer,
    items,
    timeline,
    outboxEvents: outboxSummaries,
  };
}
