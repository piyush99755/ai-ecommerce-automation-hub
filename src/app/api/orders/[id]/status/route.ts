import { db } from '@/prisma/db';
import { NextResponse } from 'next/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    if (!id || typeof id !== 'string' || id.trim() === '') {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id')?.trim();

    const order = await db.orm.public.Order.where({ id: id.trim() }).first();
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Security Hardening: Strict Order-Scoped Access Control
    // Authorization succeeds ONLY when request session_id exists, stored order.stripeCheckoutSessionId exists, and both match.
    if (!sessionId || !order.stripeCheckoutSessionId || sessionId !== order.stripeCheckoutSessionId) {
      return NextResponse.json(
        { error: 'Unauthorized order status access.' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        orderId: order.id,
        status: order.status,
        paymentStatus: order.paymentStatus,
        carrier: order.carrier || null,
        trackingNumber: order.trackingNumber || null,
        updatedAt: order.updatedAt,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[api] Unexpected error fetching order status:', error);
    return NextResponse.json(
      { error: 'An unexpected internal error occurred.' },
      { status: 500 }
    );
  }
}
