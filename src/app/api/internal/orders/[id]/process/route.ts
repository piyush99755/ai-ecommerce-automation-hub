import { db } from '@/prisma/db';
import { NextResponse } from 'next/server';
import { authenticateAutomationSecret } from '@/lib/auth';

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

    // 3. Load Order from PostgreSQL
    const order = await db.orm.public.Order.where({ id: id.trim() }).first();

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // 4. Check Idempotency: If already PROCESSING, return success idempotently
    if (order.status === 'PROCESSING') {
      return NextResponse.json(
        {
          success: true,
          orderId: order.id,
          status: 'PROCESSING',
          alreadyProcessing: true,
        },
        { status: 200 }
      );
    }

    // 5. Reject invalid lifecycle transitions (SHIPPED, DELIVERED, CANCELLED)
    if (order.status !== 'PENDING') {
      return NextResponse.json(
        {
          error: 'INVALID_TRANSITION',
          message: `Order is currently in "${order.status}" status and cannot transition to PROCESSING.`,
        },
        { status: 409 }
      );
    }

    // 6. Re-check Inventory server-side
    const orderItems = await db.orm.public.OrderItem.where({ orderId: order.id }).all();
    const allProducts = await db.orm.public.Product.all();
    const productMap = new Map(allProducts.map((p) => [p.id, p]));

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
      return NextResponse.json(
        {
          success: false,
          error: 'INSUFFICIENT_STOCK',
          items: insufficientItems,
        },
        { status: 409 }
      );
    }

    // 7. Update status: PENDING -> PROCESSING
    await db.orm.public.Order.where({ id: order.id }).update({
      status: 'PROCESSING',
    });

    return NextResponse.json(
      {
        success: true,
        orderId: order.id,
        status: 'PROCESSING',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[internal-api] Unexpected error processing order transition:', error);
    return NextResponse.json(
      { error: 'An unexpected internal error occurred.' },
      { status: 500 }
    );
  }
}
