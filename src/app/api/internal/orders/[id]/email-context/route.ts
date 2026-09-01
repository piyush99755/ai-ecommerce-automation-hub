import { NextResponse } from 'next/server';
import { db } from '@/prisma/db';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const secretHeader = request.headers.get('x-automation-secret');
  const expectedSecret = process.env.N8N_AUTOMATION_SECRET;

  if (!secretHeader || secretHeader !== expectedSecret) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or missing automation secret' },
      { status: 401 }
    );
  }

  const orderId = params.id;
  if (!orderId) {
    return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
  }

  const order = await db.orm.public.Order.where({ id: orderId }).first();
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const customer = await db.orm.public.Customer.where({ id: order.customerId }).first();
  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    orderId: order.id,
    status: order.status,
    carrier: order.carrier,
    trackingNumber: order.trackingNumber,
    customerEmail: customer.email,
    customerName: customer.name,
  });
}
