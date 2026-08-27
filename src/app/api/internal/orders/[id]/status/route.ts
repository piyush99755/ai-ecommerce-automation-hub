import { db } from '@/prisma/db';
import { NextResponse } from 'next/server';
import { authenticateAutomationSecret } from '@/lib/auth';
import { sendOrderShippedEmail, sendOrderDeliveredEmail } from '@/lib/email';

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

    // 3. Parse Request Body
    let body: { status?: string; carrier?: string; trackingNumber?: string } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
    }

    const targetStatus = body.status?.trim().toUpperCase();
    const carrier = body.carrier?.trim() || null;
    const trackingNumber = body.trackingNumber?.trim() || null;

    if (!targetStatus || (targetStatus !== 'SHIPPED' && targetStatus !== 'DELIVERED')) {
      return NextResponse.json(
        {
          error: 'INVALID_STATUS',
          message: 'Status must be either "SHIPPED" or "DELIVERED".',
        },
        { status: 400 }
      );
    }

    // 4. Execute Atomic Database Transaction
    const transactionResult = await db.transaction(async (tx) => {
      // a. Load Order
      const order = await tx.orm.public.Order.where({ id: cleanId }).first();
      if (!order) {
        return {
          statusCode: 404,
          payload: { error: 'Order not found' },
          shouldSendEmail: false,
          customerEmail: null,
        };
      }

      // b. Payment Gate: Require paymentStatus === PAID
      if (order.paymentStatus !== 'PAID') {
        return {
          statusCode: 409,
          payload: {
            success: false,
            error: 'PAYMENT_REQUIRED',
            message: `Unpaid orders cannot be transitioned to ${targetStatus}. Current paymentStatus is "${order.paymentStatus}".`,
          },
          shouldSendEmail: false,
          customerEmail: null,
        };
      }

      // c. Idempotency Checks
      if (order.status === 'SHIPPED' && targetStatus === 'SHIPPED') {
        return {
          statusCode: 200,
          payload: {
            success: true,
            orderId: order.id,
            status: 'SHIPPED',
            alreadyShipped: true,
          },
          shouldSendEmail: false,
          customerEmail: null,
        };
      }

      if (order.status === 'DELIVERED' && targetStatus === 'DELIVERED') {
        return {
          statusCode: 200,
          payload: {
            success: true,
            orderId: order.id,
            status: 'DELIVERED',
            alreadyDelivered: true,
          },
          shouldSendEmail: false,
          customerEmail: null,
        };
      }

      // d. Lifecycle Transition Validation
      if (targetStatus === 'SHIPPED') {
        if (order.status !== 'PROCESSING') {
          return {
            statusCode: 409,
            payload: {
              success: false,
              error: 'INVALID_TRANSITION',
              message: `Order is in "${order.status}" status and cannot transition to SHIPPED. Must be in PROCESSING status.`,
            },
            shouldSendEmail: false,
            customerEmail: null,
          };
        }
      } else if (targetStatus === 'DELIVERED') {
        if (order.status !== 'SHIPPED') {
          return {
            statusCode: 409,
            payload: {
              success: false,
              error: 'INVALID_TRANSITION',
              message: `Order is in "${order.status}" status and cannot transition to DELIVERED. Must be in SHIPPED status.`,
            },
            shouldSendEmail: false,
            customerEmail: null,
          };
        }
      }

      // e. Perform State Mutation & Create Outbox Event
      const customer = await tx.orm.public.Customer.where({ id: order.customerId }).first();
      const now = new Date().toISOString();

      if (targetStatus === 'SHIPPED') {
        await tx.orm.public.Order.where({ id: order.id }).update({
          status: 'SHIPPED',
          shippedAt: now,
          carrier: carrier || order.carrier,
          trackingNumber: trackingNumber || order.trackingNumber,
        });
      } else if (targetStatus === 'DELIVERED') {
        await tx.orm.public.Order.where({ id: order.id }).update({
          status: 'DELIVERED',
          deliveredAt: now,
        });
      }

      // Create ORDER_STATUS_UPDATED OutboxEvent atomically inside the SAME transaction
      await tx.orm.public.OutboxEvent.create({
        eventType: 'ORDER_STATUS_UPDATED',
        aggregateType: 'Order',
        aggregateId: order.id,
        payload: JSON.stringify({
          event: 'ORDER_STATUS_UPDATED',
          orderId: order.id,
          status: targetStatus,
          carrier: carrier || order.carrier,
          trackingNumber: trackingNumber || order.trackingNumber,
        }),
        status: 'PENDING',
      });

      return {
        statusCode: 200,
        payload: {
          success: true,
          orderId: order.id,
          status: targetStatus,
          carrier: carrier || order.carrier,
          trackingNumber: trackingNumber || order.trackingNumber,
        },
        shouldSendEmail: true,
        targetStatus,
        customerEmail: customer ? customer.email : null,
        carrier: carrier || order.carrier,
        trackingNumber: trackingNumber || order.trackingNumber,
      };
    });

    // 5. Post-Commit Customer Email Dispatch (Best-effort delivery)
    if (transactionResult.shouldSendEmail && transactionResult.customerEmail && transactionResult.targetStatus) {
      try {
        if (transactionResult.targetStatus === 'SHIPPED') {
          await sendOrderShippedEmail({
            orderId: transactionResult.payload.orderId,
            customerEmail: transactionResult.customerEmail,
            carrier: transactionResult.carrier,
            trackingNumber: transactionResult.trackingNumber,
          });
        } else if (transactionResult.targetStatus === 'DELIVERED') {
          await sendOrderDeliveredEmail({
            orderId: transactionResult.payload.orderId,
            customerEmail: transactionResult.customerEmail,
          });
        }
      } catch (emailErr) {
        console.warn('[internal-api] Non-fatal failure sending order status email:', emailErr);
      }
    }

    return NextResponse.json(transactionResult.payload, { status: transactionResult.statusCode });
  } catch (error: unknown) {
    console.error('[internal-api] Unexpected error updating order status:', error);
    return NextResponse.json(
      { error: 'An unexpected internal error occurred.' },
      { status: 500 }
    );
  }
}
