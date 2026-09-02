import { db } from '@/prisma/db';
import { getInventoryState, InventoryState, formatCurrencyCents } from './admin-inventory';

export interface InventoryOrderUsageItem {
  orderId: string;
  shortId: string;
  customerName: string;
  customerEmail: string;
  quantityPurchased: number;
  unitPriceCents: number;
  lineTotalCents: number;
  orderStatus: string;
  paymentStatus: string;
  inventoryDecremented: boolean;
  createdAt: string;
}

export interface InventoryTimelineItem {
  id: string;
  title: string;
  timestamp: string;
  detail: string;
  type: 'ALLOCATION' | 'THRESHOLD_TRANSITION' | 'INCLUDED_IN_ORDER';
}

export interface DetailedInventoryWorkspaceData {
  product: {
    id: string;
    name: string;
    slug: string;
    category: string;
    description: string;
    priceCents: number;
    stock: number;
    lowStockThreshold: number;
    imageUrl?: string | null;
    state: InventoryState;
    createdAt: string;
    updatedAt: string;
  };
  orderUsage: InventoryOrderUsageItem[];
  timeline: InventoryTimelineItem[];
  schemaNote: string;
}

export async function fetchDetailedInventoryWorkspace(
  productId: string
): Promise<DetailedInventoryWorkspaceData | null> {
  const product = await db.orm.public.Product.where({ id: productId }).first();
  if (!product) {
    return null;
  }

  // Fetch order items, orders, customers, and outbox events in parallel
  const [orderItems, orders, customers, outboxEvents] = await Promise.all([
    db.orm.public.OrderItem.where({ productId }).all(),
    db.orm.public.Order.all(),
    db.orm.public.Customer.all(),
    db.orm.public.OutboxEvent.all(),
  ]);

  const orderMap = new Map(orders.map((o) => [o.id, o]));
  const customerMap = new Map(customers.map((c) => [c.id, c]));

  // Index INVENTORY_UPDATED outbox events by order ID
  const inventoryOutboxByOrder = new Map<string, typeof outboxEvents[0]>();
  for (const e of outboxEvents) {
    if (e.aggregateType === 'Order' && e.eventType === 'INVENTORY_UPDATED') {
      inventoryOutboxByOrder.set(e.aggregateId, e);
    }
  }

  // Map order usages containing this product, clearly distinguishing ordered quantity from inventory decrements
  const orderUsage: InventoryOrderUsageItem[] = orderItems.map((item) => {
    const o = orderMap.get(item.orderId);
    const cust = o ? customerMap.get(o.customerId) : null;
    const invEvent = inventoryOutboxByOrder.get(item.orderId);

    let inventoryDecremented = false;
    if (invEvent) {
      try {
        const payload = typeof invEvent.payload === 'string' ? JSON.parse(invEvent.payload) : invEvent.payload;
        if (Array.isArray(payload?.productIds) && payload.productIds.includes(product.id)) {
          inventoryDecremented = true;
        }
      } catch {
        inventoryDecremented = invEvent.status === 'DELIVERED';
      }
    }

    return {
      orderId: item.orderId,
      shortId: item.orderId.length > 12 ? `${item.orderId.substring(0, 8)}...` : item.orderId,
      customerName: cust?.name || 'Unknown Customer',
      customerEmail: cust?.email || 'N/A',
      quantityPurchased: item.quantity,
      unitPriceCents: item.unitPriceCents,
      lineTotalCents: item.unitPriceCents * item.quantity,
      orderStatus: o?.status || 'PENDING',
      paymentStatus: o?.paymentStatus || 'PENDING',
      inventoryDecremented,
      createdAt: o?.createdAt || new Date().toISOString(),
    };
  });

  // Sort order usage newest first
  orderUsage.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Construct Inventory Activity Timeline strictly from persisted evidence
  const timeline: InventoryTimelineItem[] = [];

  for (const usage of orderUsage) {
    const invEvent = inventoryOutboxByOrder.get(usage.orderId);

    if (usage.inventoryDecremented && invEvent) {
      const eventTimestamp = invEvent.deliveredAt || invEvent.createdAt || usage.createdAt;

      timeline.push({
        id: `inv-alloc-${usage.orderId}`,
        title: `Stock Decremented (${usage.shortId})`,
        timestamp: eventTimestamp,
        detail: `Atomic SQL stock reduction of ${usage.quantityPurchased} unit(s) committed in PostgreSQL transaction for Order ${usage.shortId}.`,
        type: 'ALLOCATION',
      });

      // Check if this exact inventory decrement event caused stock to cross into the low-stock range
      try {
        const payload = typeof invEvent.payload === 'string' ? JSON.parse(invEvent.payload) : invEvent.payload;
        if (Array.isArray(payload?.lowStockTransitions) && payload.lowStockTransitions.includes(product.id)) {
          timeline.push({
            id: `inv-trans-${usage.orderId}`,
            title: `Crossed into Low-Stock Range (${usage.shortId})`,
            timestamp: eventTimestamp,
            detail: `Fulfillment of Order ${usage.shortId} caused previous stock (above threshold) to cross into the low-stock range (stock <= ${product.lowStockThreshold} units).`,
            type: 'THRESHOLD_TRANSITION',
          });
        }
      } catch {
        // Ignore JSON parse errors safely
      }
    } else {
      // OrderItem exists but stock decrement transaction has not occurred (e.g. unpaid PENDING order)
      timeline.push({
        id: `inv-incl-${usage.orderId}`,
        title: `Included in Order (${usage.shortId})`,
        timestamp: usage.createdAt,
        detail: `Product included in Order ${usage.shortId} (Status: ${usage.orderStatus}). Stock decrement pending payment confirmation and fulfillment processing.`,
        type: 'INCLUDED_IN_ORDER',
      });
    }
  }

  // Sort timeline chronologically (newest first for activity feed)
  timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const state = getInventoryState(product.stock, product.lowStockThreshold);

  const schemaNote =
    'Current PostgreSQL schema stores live stock snapshots on the Product model. The atomic fulfillment decrement path prevents stock from going below zero during normal automated order processing by requiring stock >= requested quantity in the UPDATE predicate. Inventory decrements and threshold transitions are derived strictly from committed INVENTORY_UPDATED outbox event payloads (aggregateType = Order).';

  return {
    product: {
      id: product.id,
      name: product.name,
      slug: product.slug,
      category: product.category,
      description: product.description,
      priceCents: product.priceCents,
      stock: product.stock,
      lowStockThreshold: product.lowStockThreshold,
      imageUrl: product.imageUrl,
      state,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    },
    orderUsage,
    timeline,
    schemaNote,
  };
}

export { formatCurrencyCents };
