import { db } from '@/prisma/db';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripeClient } from '@/lib/stripe';

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature || !rawBody) {
      return NextResponse.json(
        { error: 'Missing raw body or stripe-signature header' },
        { status: 400 }
      );
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_placeholder';
    const stripe = getStripeClient();

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unknown signature error';
      console.warn('[stripe-webhook] Signature verification failed:', errMsg);
      return NextResponse.json(
        { error: 'Invalid Stripe signature', message: errMsg },
        { status: 400 }
      );
    }

    // Process event inside a single atomic database transaction with StripeEvent deduplication & Outbox creation
    const result = await db.transaction(async (tx) => {
      // 1. Concurrency-Safe Deduplication: Check if event.id was already processed
      const existingEvent = await tx.orm.public.StripeEvent.where({ id: event.id }).first();
      if (existingEvent) {
        return {
          statusCode: 200,
          payload: { received: true, alreadyProcessed: true },
        };
      }

      // 2. Persist StripeEvent ID to guarantee single-execution lock in PostgreSQL
      try {
        await tx.orm.public.StripeEvent.create({
          id: event.id,
          type: event.type,
        });
      } catch (insertErr: unknown) {
        console.log(`[stripe-webhook] Concurrent duplicate event ${event.id} caught at database constraint boundary:`, insertErr);
        return {
          statusCode: 200,
          payload: { received: true, alreadyProcessed: true },
        };
      }

      // 3. Handle Payment Succeeded Events
      if (
        event.type === 'checkout.session.completed' ||
        event.type === 'checkout.session.async_payment_succeeded'
      ) {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.payment_status === 'paid') {
          const orderId = session.metadata?.orderId;
          if (!orderId) {
            console.warn('[stripe-webhook] Missing orderId in session metadata');
            return {
              statusCode: 200,
              payload: { received: true, warning: 'Missing orderId in metadata' },
            };
          }

          const order = await tx.orm.public.Order.where({ id: orderId }).first();
          if (!order) {
            console.warn(`[stripe-webhook] Order with ID ${orderId} not found in database`);
            return {
              statusCode: 200,
              payload: { received: true, warning: 'Order not found' },
            };
          }

          // Idempotency Check: Skip duplicate payment mutations if order is already PAID
          if (order.paymentStatus === 'PAID') {
            console.log(`[stripe-webhook] Order ${order.id} is already PAID. Skipping duplicate processing.`);
            return {
              statusCode: 200,
              payload: { received: true, alreadyPaid: true },
            };
          }

          const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null;

          // Transition Order.paymentStatus -> PAID
          await tx.orm.public.Order.where({ id: order.id }).update({
            paymentStatus: 'PAID',
            stripePaymentIntentId: paymentIntentId || order.stripePaymentIntentId,
            stripeCheckoutSessionId: session.id || order.stripeCheckoutSessionId,
          });

          // Create OutboxEvent atomically inside the SAME database transaction
          await tx.orm.public.OutboxEvent.create({
            eventType: 'PAYMENT_SUCCEEDED',
            aggregateType: 'Order',
            aggregateId: order.id,
            payload: JSON.stringify({
              event: 'PAYMENT_SUCCEEDED',
              orderId: order.id,
              customerId: order.customerId,
              paymentStatus: 'PAID',
            }),
            status: 'PENDING',
          });

          console.log(`[stripe-webhook] Order ${order.id} updated to paymentStatus = PAID and PAYMENT_SUCCEEDED OutboxEvent created.`);

          return {
            statusCode: 200,
            payload: { received: true },
          };
        }
      } else if (event.type === 'checkout.session.async_payment_failed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.orderId;
        if (orderId) {
          const order = await tx.orm.public.Order.where({ id: orderId }).first();
          // Only transition to FAILED if order is currently PENDING (never overwrite PAID status)
          if (order && order.paymentStatus === 'PENDING') {
            await tx.orm.public.Order.where({ id: order.id }).update({
              paymentStatus: 'FAILED',
            });
            console.log(`[stripe-webhook] Order ${order.id} updated to paymentStatus = FAILED`);
          }
        }

        return {
          statusCode: 200,
          payload: { received: true, paymentFailedRecorded: true },
        };
      }

      return {
        statusCode: 200,
        payload: { received: true },
      };
    });

    return NextResponse.json(result.payload, { status: result.statusCode });
  } catch (error: unknown) {
    console.error('[stripe-webhook] Unexpected error processing webhook:', error);
    return NextResponse.json(
      { error: 'An unexpected internal error occurred processing Stripe webhook.' },
      { status: 500 }
    );
  }
}
