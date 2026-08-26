import { db } from '@/prisma/db';
import { NextResponse } from 'next/server';
import { authenticateAutomationSecret } from '@/lib/auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteContext) {
  try {
    // 1. Authenticate Automation Secret
    const authError = authenticateAutomationSecret(request);
    if (authError) {
      return authError;
    }

    // 2. Read Order ID from route params
    const { id } = await params;

    if (!id || typeof id !== 'string' || id.trim() === '') {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    // 3. Query PostgreSQL via Prisma 8
    const order = await db.orm.public.Order.where({ id: id.trim() }).first();

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const orderItems = await db.orm.public.OrderItem.where({ orderId: order.id }).all();
    const allProducts = await db.orm.public.Product.all();
    const productMap = new Map(allProducts.map((p) => [p.id, p]));

    // 4. Construct Operational Item Payloads
    const items = orderItems.map((item) => {
      const product = productMap.get(item.productId);
      return {
        productId: item.productId,
        name: product ? product.name : 'Unknown Product',
        slug: product ? product.slug : '',
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        currentPriceCents: product ? product.priceCents : item.unitPriceCents,
        currentStock: product ? product.stock : 0,
      };
    });

    // 5. Return Operational Response (Excluding PII)
    return NextResponse.json(
      {
        orderId: order.id,
        customerId: order.customerId,
        status: order.status,
        paymentStatus: order.paymentStatus,
        subtotalCents: order.subtotalCents,
        totalCents: order.totalCents,
        items,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[internal-api] Unexpected error fetching internal order details:', error);
    return NextResponse.json(
      { error: 'An unexpected internal error occurred.' },
      { status: 500 }
    );
  }
}
