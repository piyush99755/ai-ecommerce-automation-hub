import { db } from '@/prisma/db';
import { NextResponse } from 'next/server';
import { authenticateAutomationSecret } from '@/lib/auth';
import { sendOrderProcessingEmail } from '@/lib/email';
import { sendInventoryUpdatedEvent } from '@/lib/n8n';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
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

    // 3. Execute Atomic Database Transaction
    const transactionResult = await db.transaction(async (tx) => {
      // a. Load Order
      const order = await tx.orm.public.Order.where({ id: cleanId }).first();

      if (!order) {
        return {
          statusCode: 404,
          payload: { error: 'Order not found' },
          customerEmail: null,
          productIds: [],
        };
      }

      // b. Idempotency Check: If already PROCESSING, return success without mutating stock or re-sending email
      if (order.status === 'PROCESSING') {
        return {
          statusCode: 200,
          payload: {
            success: true,
            orderId: order.id,
            status: 'PROCESSING',
            alreadyProcessing: true,
            inventoryUpdated: false,
          },
          customerEmail: null,
          productIds: [],
        };
      }

      // c. Payment Gate: Reject fulfillment if paymentStatus is not PAID
      if (order.paymentStatus !== 'PAID') {
        return {
          statusCode: 409,
          payload: {
            success: false,
            error: 'PAYMENT_REQUIRED',
            message: `Order payment has not been confirmed. Current paymentStatus is "${order.paymentStatus}".`,
          },
          customerEmail: null,
          productIds: [],
        };
      }

      // d. Reject invalid lifecycle transitions (SHIPPED, DELIVERED, CANCELLED, ON_HOLD)
      if (order.status !== 'PENDING') {
        return {
          statusCode: 409,
          payload: {
            success: false,
            error: 'INVALID_TRANSITION',
            message: `Order is currently in "${order.status}" status and cannot transition to PROCESSING.`,
          },
          customerEmail: null,
          productIds: [],
        };
      }

      // e. Fetch OrderItems, Customer, and authoritative Product rows
      const orderItems = await tx.orm.public.OrderItem.where({ orderId: order.id }).all();
      const customer = await tx.orm.public.Customer.where({ id: order.customerId }).first();
      const allProducts = await tx.orm.public.Product.all();
      const productMap = new Map(allProducts.map((p) => [p.id, p]));

      // f. Verify stock availability for all items before any mutation
      const insufficientItems: {
        productId: string;
        requestedQuantity: number;
        currentStock: number;
      }[] = [];

      for (const item of orderItems) {
        const product = productMap.get(item.productId);
        const currentStock = product ? product.stock : 0;
        if (currentStock < item.quantity) {
          insufficientItems.push({
            productId: item.productId,
            requestedQuantity: item.quantity,
            currentStock,
          });
        }
      }

      if (insufficientItems.length > 0) {
        return {
          statusCode: 409,
          payload: {
            success: false,
            error: 'INSUFFICIENT_STOCK',
            items: insufficientItems,
          },
          customerEmail: null,
          productIds: [],
        };
      }

      // g. Atomically Decrement Stock for every Product
      const updatedProductIds: string[] = [];
      for (const item of orderItems) {
        const product = productMap.get(item.productId)!;
        const newStock = product.stock - item.quantity;
        await tx.orm.public.Product.where({ id: product.id }).update({
          stock: newStock,
        });
        updatedProductIds.push(product.id);
      }

      // h. Atomically Update Order Status to PROCESSING and clear statusReason
      await tx.orm.public.Order.where({ id: order.id }).update({
        status: 'PROCESSING',
        statusReason: null,
      });

      return {
        statusCode: 200,
        payload: {
          success: true,
          orderId: order.id,
          status: 'PROCESSING',
          inventoryUpdated: true,
        },
        customerEmail: customer ? customer.email : null,
        productIds: updatedProductIds,
      };
    });

    // 4. Post-Transaction Customer Email Notification (Best-effort delivery)
    if (
      transactionResult.statusCode === 200 &&
      transactionResult.payload.inventoryUpdated === true &&
      transactionResult.customerEmail
    ) {
      try {
        await sendOrderProcessingEmail({
          orderId: transactionResult.payload.orderId,
          customerEmail: transactionResult.customerEmail,
          status: 'PROCESSING',
        });
      } catch (emailErr) {
        console.warn('[internal-api] Non-fatal failure sending customer order-processing email:', emailErr);
      }
    }

    // 5. Post-Transaction Inventory Event Dispatch to n8n (Best-effort delivery)
    if (
      transactionResult.statusCode === 200 &&
      transactionResult.payload.inventoryUpdated === true &&
      transactionResult.productIds &&
      transactionResult.productIds.length > 0
    ) {
      try {
        await sendInventoryUpdatedEvent({
          event: 'INVENTORY_UPDATED',
          orderId: transactionResult.payload.orderId,
          productIds: transactionResult.productIds,
        });
      } catch (n8nErr) {
        console.warn('[internal-api] Non-fatal failure sending INVENTORY_UPDATED event to n8n:', n8nErr);
      }
    }

    return NextResponse.json(transactionResult.payload, { status: transactionResult.statusCode });
  } catch (error) {
    console.error('[internal-api] Unexpected error processing atomic order transition:', error);
    return NextResponse.json(
      { error: 'An unexpected internal error occurred.' },
      { status: 500 }
    );
  }
}
