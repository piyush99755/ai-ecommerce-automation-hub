import { db } from '@/prisma/db';
import { NextResponse } from 'next/server';

interface OrderItemInput {
  productId: string;
  quantity: number;
}

interface OrderRequestInput {
  customer: {
    name: string;
    email: string;
    phone?: string;
  };
  items: OrderItemInput[];
}

function isValidEmail(email: string): boolean {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export async function POST(request: Request) {
  try {
    let body: OrderRequestInput;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload in request body' },
        { status: 400 }
      );
    }

    const { customer, items } = body || {};

    // Validate Customer Details
    if (!customer || typeof customer !== 'object') {
      return NextResponse.json(
        { error: 'Customer details are required' },
        { status: 400 }
      );
    }

    if (!customer.name || typeof customer.name !== 'string' || customer.name.trim() === '') {
      return NextResponse.json(
        { error: 'Customer name is required' },
        { status: 400 }
      );
    }

    if (!customer.email || !isValidEmail(customer.email)) {
      return NextResponse.json(
        { error: 'A valid customer email is required' },
        { status: 400 }
      );
    }

    const cleanEmail = customer.email.trim().toLowerCase();
    const cleanName = customer.name.trim();
    const cleanPhone = customer.phone && typeof customer.phone === 'string' ? customer.phone.trim() : null;

    // Validate Items List
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Order must contain at least one product item' },
        { status: 400 }
      );
    }

    for (const item of items) {
      if (!item.productId || typeof item.productId !== 'string') {
        return NextResponse.json(
          { error: 'Every item must specify a valid productId string' },
          { status: 400 }
        );
      }

      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        return NextResponse.json(
          { error: `Invalid quantity for product ${item.productId}. Quantity must be a positive integer.` },
          { status: 400 }
        );
      }
    }

    // Fetch authoritative Products from PostgreSQL
    const allProducts = await db.orm.public.Product.all();
    const productMap = new Map(allProducts.map((p) => [p.id, p]));

    let calculatedSubtotalCents = 0;
    const validatedItems: { product: typeof allProducts[0]; quantity: number }[] = [];

    for (const item of items) {
      const dbProduct = productMap.get(item.productId);
      if (!dbProduct) {
        return NextResponse.json(
          { error: `Product with ID "${item.productId}" was not found.` },
          { status: 400 }
        );
      }

      if (item.quantity > dbProduct.stock) {
        return NextResponse.json(
          {
            error: `Insufficient stock for "${dbProduct.name}". Requested: ${item.quantity}, Available: ${dbProduct.stock}.`,
          },
          { status: 400 }
        );
      }

      // Calculate server-side authoritative price
      calculatedSubtotalCents += dbProduct.priceCents * item.quantity;
      validatedItems.push({ product: dbProduct, quantity: item.quantity });
    }

    const calculatedTotalCents = calculatedSubtotalCents;

    // Atomic Database Transaction
    const result = await db.transaction(async (tx) => {
      // 1. Customer Resolution (Upsert by unique email)
      let customerRecord = await tx.orm.public.Customer.where({ email: cleanEmail }).first();
      if (customerRecord) {
        await tx.orm.public.Customer.where({ id: customerRecord.id }).update({
          name: cleanName,
          phone: cleanPhone,
        });
      } else {
        customerRecord = await tx.orm.public.Customer.create({
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
        });
      }

      // 2. Create Order
      const newOrder = await tx.orm.public.Order.create({
        customerId: customerRecord.id,
        status: 'PENDING',
        paymentStatus: 'PENDING',
        subtotalCents: calculatedSubtotalCents,
        totalCents: calculatedTotalCents,
      });

      // 3. Create OrderItems with DB price snapshots
      for (const item of validatedItems) {
        await tx.orm.public.OrderItem.create({
          orderId: newOrder.id,
          productId: item.product.id,
          quantity: item.quantity,
          unitPriceCents: item.product.priceCents,
        });
      }

      return newOrder;
    });

    return NextResponse.json(
      {
        success: true,
        orderId: result.id,
        status: result.status,
        paymentStatus: result.paymentStatus,
        subtotalCents: result.subtotalCents,
        totalCents: result.totalCents,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Order creation error:', error);
    return NextResponse.json(
      { error: 'An unexpected internal error occurred while processing your order.' },
      { status: 500 }
    );
  }
}
