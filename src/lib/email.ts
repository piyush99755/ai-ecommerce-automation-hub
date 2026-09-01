import { Resend } from 'resend';

export interface OrderProcessingEmailPayload {
  orderId: string;
  customerEmail: string;
  status: string;
  eventId?: string;
}

export interface OrderShippedEmailPayload {
  orderId: string;
  customerEmail: string;
  carrier?: string | null;
  trackingNumber?: string | null;
  eventId?: string;
}

export interface OrderDeliveredEmailPayload {
  orderId: string;
  customerEmail: string;
  eventId?: string;
}

function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***@***';
  const [local, domain] = email.split('@');
  const maskedLocal = local.length > 2 ? `${local[0]}***${local[local.length - 1]}` : '***';
  return `${maskedLocal}@${domain}`;
}

export async function sendOrderProcessingEmail(
  payload: OrderProcessingEmailPayload
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.EMAIL_FROM;

  if (apiKey && apiKey.trim() !== '' && fromAddress && fromAddress.trim() !== '') {
    try {
      const resend = new Resend(apiKey.trim());
      const subject = 'Your order is being processed';
      const htmlContent = `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #4f46e5;">Thank you for your purchase!</h2>
          <p>We are pleased to inform you that your order is now being processed.</p>
          <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #6b7280;">Order ID:</p>
            <p style="margin: 4px 0 12px 0; font-family: monospace; font-weight: bold; font-size: 16px;">${payload.orderId}</p>
            <p style="margin: 0; font-size: 14px; color: #6b7280;">Status:</p>
            <p style="margin: 4px 0 0 0; font-weight: bold; font-size: 14px; color: #d97706;">${payload.status}</p>
          </div>
        </div>
      `;
      const options: { idempotencyKey?: string } = {};
      if (payload.eventId) {
        options.idempotencyKey = payload.eventId;
      }
      const response = await resend.emails.send({
        from: fromAddress.trim(),
        to: [payload.customerEmail],
        subject,
        html: htmlContent,
      }, options);

      if (response.error) {
        console.warn(`[email-provider] Resend error for recipient=${maskEmail(payload.customerEmail)}:`, response.error.message);
        return { success: false, error: response.error.message };
      }
      return { success: true, messageId: response.data?.id };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unknown Resend error';
      console.warn(`[email-provider] Resend dispatch failed: ${errMsg}`);
      return { success: false, error: errMsg };
    }
  }

  console.log(`[email-provider] Safe Dev Log: Order Processing Email for Order ${payload.orderId} to ${maskEmail(payload.customerEmail)}`);
  return { success: true, messageId: `dev-msg-${Date.now()}` };
}

export async function sendOrderShippedEmail(
  payload: OrderShippedEmailPayload
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.EMAIL_FROM;

  if (apiKey && apiKey.trim() !== '' && fromAddress && fromAddress.trim() !== '') {
    try {
      const resend = new Resend(apiKey.trim());
      const subject = 'Your order has shipped!';
      const carrierInfo = payload.carrier ? `<p><strong>Carrier:</strong> ${payload.carrier}</p>` : '';
      const trackingInfo = payload.trackingNumber ? `<p><strong>Tracking Number:</strong> ${payload.trackingNumber}</p>` : '';
      const htmlContent = `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #10b981;">Your order is on the way!</h2>
          <p>Great news! Your order has been shipped.</p>
          <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #6b7280;">Order ID:</p>
            <p style="margin: 4px 0 12px 0; font-family: monospace; font-weight: bold; font-size: 16px;">${payload.orderId}</p>
            ${carrierInfo}
            ${trackingInfo}
          </div>
        </div>
      `;
      const options: { idempotencyKey?: string } = {};
      if (payload.eventId) {
        options.idempotencyKey = payload.eventId;
      }
      const response = await resend.emails.send({
        from: fromAddress.trim(),
        to: [payload.customerEmail],
        subject,
        html: htmlContent,
      }, options);

      if (response.error) {
        console.warn(`[email-provider] Resend error for recipient=${maskEmail(payload.customerEmail)}:`, response.error.message);
        return { success: false, error: response.error.message };
      }
      return { success: true, messageId: response.data?.id };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unknown Resend error';
      console.warn(`[email-provider] Resend dispatch failed: ${errMsg}`);
      return { success: false, error: errMsg };
    }
  }

  console.log(`[email-provider] Safe Dev Log: Order Shipped Email for Order ${payload.orderId} to ${maskEmail(payload.customerEmail)} (Carrier: ${payload.carrier || 'N/A'}, Tracking: ${payload.trackingNumber || 'N/A'})`);
  return { success: true, messageId: `dev-shipped-${Date.now()}` };
}

export async function sendOrderDeliveredEmail(
  payload: OrderDeliveredEmailPayload
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.EMAIL_FROM;

  if (apiKey && apiKey.trim() !== '' && fromAddress && fromAddress.trim() !== '') {
    try {
      const resend = new Resend(apiKey.trim());
      const subject = 'Your order has been delivered!';
      const htmlContent = `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #059669;">Your package has arrived!</h2>
          <p>Your order has been delivered. Thank you for shopping with us!</p>
          <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #6b7280;">Order ID:</p>
            <p style="margin: 4px 0 12px 0; font-family: monospace; font-weight: bold; font-size: 16px;">${payload.orderId}</p>
          </div>
        </div>
      `;
      const options: { idempotencyKey?: string } = {};
      if (payload.eventId) {
        options.idempotencyKey = payload.eventId;
      }
      const response = await resend.emails.send({
        from: fromAddress.trim(),
        to: [payload.customerEmail],
        subject,
        html: htmlContent,
      }, options);

      if (response.error) {
        console.warn(`[email-provider] Resend error for recipient=${maskEmail(payload.customerEmail)}:`, response.error.message);
        return { success: false, error: response.error.message };
      }
      return { success: true, messageId: response.data?.id };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unknown Resend error';
      console.warn(`[email-provider] Resend dispatch failed: ${errMsg}`);
      return { success: false, error: errMsg };
    }
  }

  console.log(`[email-provider] Safe Dev Log: Order Delivered Email for Order ${payload.orderId} to ${maskEmail(payload.customerEmail)}`);
  return { success: true, messageId: `dev-delivered-${Date.now()}` };
}
