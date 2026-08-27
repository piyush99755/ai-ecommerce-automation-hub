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

    // 3. Validate Request Body Reason
    let body: { reason?: string };
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const reason = body?.reason;
    if (reason !== 'INSUFFICIENT_STOCK') {
      return NextResponse.json(
        {
          error: 'INVALID_REASON',
          message: 'Only "INSUFFICIENT_STOCK" is supported as a hold reason.',
        },
        { status: 400 }
      );
    }

    // 4. Load Order from PostgreSQL
    const order = await db.orm.public.Order.where({ id: id.trim() }).first();

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // 5. Idempotency Check: If already ON_HOLD with INSUFFICIENT_STOCK, return success idempotently
    if (order.status === 'ON_HOLD' && order.statusReason === 'INSUFFICIENT_STOCK') {
      return NextResponse.json(
        {
          success: true,
          orderId: order.id,
          status: 'ON_HOLD',
          statusReason: 'INSUFFICIENT_STOCK',
          alreadyOnHold: true,
        },
        { status: 200 }
      );
    }

    // 6. Reject invalid lifecycle transitions (PROCESSING, SHIPPED, DELIVERED, CANCELLED)
    if (order.status !== 'PENDING') {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_TRANSITION',
          message: `Order is currently in "${order.status}" status and cannot transition to ON_HOLD.`,
        },
        { status: 409 }
      );
    }

    // 7. Server-Side Stock Verification
    // Confirm that at least one item in the order actually has currentStock < requestedQuantity
    const orderItems = await db.orm.public.OrderItem.where({ orderId: order.id }).all();
    const allProducts = await db.orm.public.Product.all();
    const productMap = new Map(allProducts.map((p) => [p.id, p]));

    let hasInsufficientItem = false;

    for (const item of orderItems) {
      const product = productMap.get(item.productId);
      const currentStock = product ? product.stock : 0;
      if (currentStock < item.quantity) {
        hasInsufficientItem = true;
        break;
      }
    }

    if (!hasInsufficientItem) {
      return NextResponse.json(
        {
          success: false,
          error: 'STOCK_NOW_AVAILABLE',
          message: 'All items in this order currently have sufficient stock. Hold request rejected.',
        },
        { status: 409 }
      );
    }

    // 8. Mutate status: PENDING -> ON_HOLD with statusReason = INSUFFICIENT_STOCK
    await db.orm.public.Order.where({ id: order.id }).update({
      status: 'ON_HOLD',
      statusReason: 'INSUFFICIENT_STOCK',
    });

    return NextResponse.json(
      {
        success: true,
        orderId: order.id,
        status: 'ON_HOLD',
        statusReason: 'INSUFFICIENT_STOCK',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[internal-api] Unexpected error placing order on hold:', error);
    return NextResponse.json(
      { error: 'An unexpected internal error occurred.' },
      { status: 500 }
    );
  }
}
