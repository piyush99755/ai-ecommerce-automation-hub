import { NextResponse } from 'next/server';
import {
  sendOrderProcessingEmail,
  sendOrderShippedEmail,
  sendOrderDeliveredEmail,
} from '@/lib/email';

export async function POST(request: Request) {
  const secretHeader = request.headers.get('x-automation-secret');
  const expectedSecret = process.env.N8N_AUTOMATION_SECRET;

  if (!secretHeader || secretHeader !== expectedSecret) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or missing automation secret' },
      { status: 401 }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { type, orderId, customerEmail, status, carrier, trackingNumber, eventId } = body;

  if (!type || !orderId || !customerEmail) {
    return NextResponse.json(
      { error: 'Missing required fields (type, orderId, customerEmail)' },
      { status: 400 }
    );
  }

  let result: { success: boolean; messageId?: string; error?: string };

  if (type === 'ORDER_PROCESSING_NOTIFICATION') {
    result = await sendOrderProcessingEmail({
      orderId,
      customerEmail,
      status: status || 'PROCESSING',
      eventId,
    });
  } else if (type === 'ORDER_SHIPPED_NOTIFICATION') {
    result = await sendOrderShippedEmail({
      orderId,
      customerEmail,
      carrier,
      trackingNumber,
      eventId,
    });
  } else if (type === 'ORDER_DELIVERED_NOTIFICATION') {
    result = await sendOrderDeliveredEmail({
      orderId,
      customerEmail,
      eventId,
    });
  } else {
    return NextResponse.json(
      { error: `Unsupported notification type: ${type}` },
      { status: 400 }
    );
  }

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || 'Failed to dispatch email' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    messageId: result.messageId,
  });
}
