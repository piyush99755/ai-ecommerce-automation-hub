import 'dotenv/config';
import { NextResponse } from 'next/server';
import { authenticateAutomationSecret } from '@/lib/auth';
import { sendOrderProcessingEmail } from '@/lib/email';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env['DATABASE_URL'],
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteContext) {
  // 1. Authenticate Automation Secret
  const authError = authenticateAutomationSecret(request);
  if (authError) {
    return authError;
  }

  // 2. Extract Order ID from route params
  const { id } = await params;

  if (!id || typeof id !== 'string' || id.trim() === '') {
    return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
  }

  const cleanId = id.trim();
  const client = await pool.connect();

  try {
    // 3. Execute Atomic Database Transaction with Row Locking & Conditional Updates
    await client.query('BEGIN');

    // a. Fetch & Row-Lock Order to prevent concurrent processing of the exact same order
    const orderRes = await client.query(
      'SELECT id, "customerId", status, "statusReason", "paymentStatus" FROM "order" WHERE id = $1 FOR UPDATE',
      [cleanId]
    );

    if (orderRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const order = orderRes.rows[0];

    // b. Idempotency Check: If already PROCESSING, return success without mutating stock or re-sending email
    if (order.status === 'PROCESSING') {
      await client.query('ROLLBACK');
      return NextResponse.json({
        success: true,
        orderId: order.id,
        status: 'PROCESSING',
        alreadyProcessing: true,
        inventoryUpdated: false,
      }, { status: 200 });
    }

    // c. Payment Gate: Reject fulfillment if paymentStatus is not PAID
    if (order.paymentStatus !== 'PAID') {
      await client.query('ROLLBACK');
      return NextResponse.json({
        success: false,
        error: 'PAYMENT_REQUIRED',
        message: `Order payment has not been confirmed. Current paymentStatus is "${order.paymentStatus}".`,
      }, { status: 409 });
    }

    // d. Reject invalid lifecycle transitions (SHIPPED, DELIVERED, CANCELLED, ON_HOLD)
    if (order.status !== 'PENDING') {
      await client.query('ROLLBACK');
      return NextResponse.json({
        success: false,
        error: 'INVALID_TRANSITION',
        message: `Order is currently in "${order.status}" status and cannot transition to PROCESSING.`,
      }, { status: 409 });
    }

    // e. Fetch OrderItems sorted deterministically by productId (prevents deadlocks)
    const itemsRes = await client.query(
      'SELECT "productId", quantity FROM "orderItem" WHERE "orderId" = $1 ORDER BY "productId" ASC',
      [order.id]
    );
    const orderItems = itemsRes.rows;

    const customerRes = await client.query(
      'SELECT email FROM "customer" WHERE id = $1',
      [order.customerId]
    );
    const customerEmail = customerRes.rows.length > 0 ? customerRes.rows[0].email : null;

    // f. Atomically Decrement Stock & Enforce stock >= requestedQuantity in PostgreSQL
    const updatedProductIds: string[] = [];
    const lowStockTransitions: string[] = [];
    const insufficientItems: {
      productId: string;
      requestedQuantity: number;
      currentStock: number;
    }[] = [];

    for (const item of orderItems) {
      const productId = item.productId;
      const qty = item.quantity;

      // Atomic conditional decrement in PostgreSQL: SET stock = stock - qty WHERE stock >= qty
      const updateRes = await client.query(
        `UPDATE "product"
         SET stock = stock - $1
         WHERE id = $2 AND stock >= $1
         RETURNING id, stock, "lowStockThreshold"`,
        [qty, productId]
      );

      if (updateRes.rows.length === 0) {
        // Stock was insufficient at mutation time!
        // Fetch current committed stock for diagnostic error reporting payload
        const currentProdRes = await client.query(
          'SELECT stock FROM "product" WHERE id = $1',
          [productId]
        );
        const currentStock = currentProdRes.rows.length > 0 ? currentProdRes.rows[0].stock : 0;

        insufficientItems.push({
          productId,
          requestedQuantity: qty,
          currentStock,
        });

        // Abort transaction immediately
        await client.query('ROLLBACK');
        return NextResponse.json({
          success: false,
          error: 'INSUFFICIENT_STOCK',
          items: insufficientItems,
        }, { status: 409 });
      }

      const newStock = updateRes.rows[0].stock;
      const threshold = updateRes.rows[0].lowStockThreshold ?? 5;
      const prevStock = newStock + qty;

      // Low-stock threshold transition detection: Alert eligible ONLY when crossing into LOW_STOCK
      const wasAboveThreshold = prevStock > threshold;
      const isNowAtOrBelowThreshold = newStock <= threshold;

      if (wasAboveThreshold && isNowAtOrBelowThreshold) {
        lowStockTransitions.push(productId);
      }

      updatedProductIds.push(productId);
    }

    // g. Update Order status to PROCESSING and clear statusReason
    await client.query(
      'UPDATE "order" SET status = \'PROCESSING\', "statusReason" = NULL WHERE id = $1',
      [order.id]
    );

    // h. Create INVENTORY_UPDATED OutboxEvent atomically inside the SAME transaction
    await client.query(
      `INSERT INTO "outboxEvent" (id, "eventType", "aggregateType", "aggregateId", payload, status)
       VALUES (gen_random_uuid(), 'INVENTORY_UPDATED', 'Order', $1, $2, 'PENDING')`,
      [
        order.id,
        JSON.stringify({
          event: 'INVENTORY_UPDATED',
          orderId: order.id,
          productIds: updatedProductIds,
          lowStockTransitions,
        }),
      ]
    );

    // i. Create ORDER_PROCESSING_NOTIFICATION OutboxEvent atomically inside the SAME transaction
    await client.query(
      `INSERT INTO "outboxEvent" (id, "eventType", "aggregateType", "aggregateId", payload, status)
       VALUES (gen_random_uuid(), 'ORDER_PROCESSING_NOTIFICATION', 'Order', $1, $2, 'PENDING')`,
      [
        order.id,
        JSON.stringify({
          event: 'ORDER_PROCESSING_NOTIFICATION',
          orderId: order.id,
          status: 'PROCESSING',
        }),
      ]
    );

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      orderId: order.id,
      status: 'PROCESSING',
      inventoryUpdated: true,
    }, { status: 200 });

  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[internal-api] Unexpected error processing atomic order transition:', error);
    return NextResponse.json(
      { error: 'An unexpected internal error occurred.' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
