import { db } from '@/prisma/db';
import { NextResponse } from 'next/server';
import { authenticateAutomationSecret } from '@/lib/auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteContext) {
  try {
    // 1. Authenticate Automation Secret Header (X-Automation-Secret)
    const authError = authenticateAutomationSecret(request);
    if (authError) {
      return authError;
    }

    // 2. Extract Order ID from route parameters
    const { id } = await params;
    if (!id || typeof id !== 'string' || id.trim() === '') {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const cleanId = id.trim();

    // 3. Fetch Order from PostgreSQL database
    const order = await db.orm.public.Order.where({ id: cleanId }).first();

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // 4. Fetch Customer from PostgreSQL database
    const customer = await db.orm.public.Customer.where({ id: order.customerId }).first();

    if (!customer) {
      return NextResponse.json({ error: 'Associated customer not found' }, { status: 404 });
    }

    // 5. Construct Safe Operational CRM Context Payload (PII Boundary Enforced)
    const crmContextPayload = {
      orderId: order.id,
      customerId: customer.id,
      customer: {
        name: customer.name,
        email: customer.email,
      },
      totalCents: order.totalCents,
      paymentStatus: order.paymentStatus,
      status: order.status,
      carrier: order.carrier || null,
      trackingNumber: order.trackingNumber || null,
      createdAt: order.createdAt,
    };

    return NextResponse.json(crmContextPayload, { status: 200 });
  } catch (error: unknown) {
    console.error('[internal-api] Unexpected error fetching CRM order context:', error);
    return NextResponse.json(
      { error: 'An unexpected internal error occurred.' },
      { status: 500 }
    );
  }
}
