import { db } from '@/prisma/db';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripeClient } from '@/lib/stripe';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    if (!id || typeof id !== 'string' || id.trim() === '') {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const cleanId = id.trim();

    // 1. Load Order from PostgreSQL
    const order = await db.orm.public.Order.where({ id: cleanId }).first();
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // 2. Validate Payment Eligibility
    if (order.paymentStatus === 'PAID') {
      return NextResponse.json(
        {
          error: 'ORDER_ALREADY_PAID',
          message: 'This order has already been paid for.',
        },
        { status: 409 }
      );
    }

    if (order.status === 'CANCELLED') {
      return NextResponse.json(
        {
          error: 'ORDER_CANCELLED',
          message: 'Cancelled orders cannot be paid.',
        },
        { status: 409 }
      );
    }

    const stripe = getStripeClient();

    // 3. Reuse Existing Active Checkout Session if available
    if (order.stripeCheckoutSessionId) {
      try {
        const existingSession = await stripe.checkout.sessions.retrieve(order.stripeCheckoutSessionId);
        if (existingSession && existingSession.status === 'open' && existingSession.url) {
          return NextResponse.json(
            {
              success: true,
              url: existingSession.url,
              sessionId: existingSession.id,
              reused: true,
            },
            { status: 200 }
          );
        }
      } catch (retrieveErr) {
        console.warn(`[checkout-session] Could not retrieve session ${order.stripeCheckoutSessionId}, creating new session:`, retrieveErr);
      }
    }

    // 4. Load OrderItems and Customer from PostgreSQL
    const orderItems = await db.orm.public.OrderItem.where({ orderId: order.id }).all();
    if (orderItems.length === 0) {
      return NextResponse.json({ error: 'Order contains no items' }, { status: 400 });
    }

    const customer = await db.orm.public.Customer.where({ id: order.customerId }).first();
    const allProducts = await db.orm.public.Product.all();
    const productMap = new Map(allProducts.map((p) => [p.id, p]));

    // 5. Build Stripe Line Items using Authoritative OrderItem DB snapshots
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = orderItems.map((item) => {
      const product = productMap.get(item.productId);
      return {
        price_data: {
          currency: 'usd',
          product_data: {
            name: product ? product.name : 'Product Item',
            description: product?.description ? product.description : undefined,
          },
          unit_amount: item.unitPriceCents,
        },
        quantity: item.quantity,
      };
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // 6. Create New Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: lineItems,
      customer_email: customer?.email || undefined,
      metadata: {
        orderId: order.id,
        customerId: order.customerId,
      },
      success_url: `${baseUrl}/orders/${order.id}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/orders/${order.id}`,
    });

    // 7. Store stripeCheckoutSessionId on Order in PostgreSQL
    await db.orm.public.Order.where({ id: order.id }).update({
      stripeCheckoutSessionId: session.id,
    });

    return NextResponse.json(
      {
        success: true,
        url: session.url,
        sessionId: session.id,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error('[checkout-session] Unexpected error creating Stripe Checkout Session:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while creating the checkout session.' },
      { status: 500 }
    );
  }
}
