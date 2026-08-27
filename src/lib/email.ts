import { Resend } from 'resend';

export interface OrderProcessingEmailPayload {
  orderId: string;
  customerEmail: string;
  status: string;
}

export type EmailProvider = (
  payload: OrderProcessingEmailPayload
) => Promise<{ success: boolean; messageId?: string; error?: string }>;

function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***@***';
  const [local, domain] = email.split('@');
  const maskedLocal = local.length > 2 ? `${local[0]}***${local[local.length - 1]}` : '***';
  return `${maskedLocal}@${domain}`;
}

export async function sendResendOrderProcessingEmail(
  payload: OrderProcessingEmailPayload
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.EMAIL_FROM;

  if (!apiKey || apiKey.trim() === '' || !fromAddress || fromAddress.trim() === '') {
    throw new Error('Resend environment variables (RESEND_API_KEY, EMAIL_FROM) are not configured.');
  }

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
      <p style="font-size: 14px; color: #6b7280;">If you have any questions, feel free to reply to this email.</p>
    </div>
  `;
  const textContent = `Thank you for your purchase!\n\nYour order is now being processed.\nOrder ID: ${payload.orderId}\nStatus: ${payload.status}\n`;

  const response = await resend.emails.send({
    from: fromAddress.trim(),
    to: [payload.customerEmail],
    subject,
    html: htmlContent,
    text: textContent,
  });

  if (response.error) {
    const masked = maskEmail(payload.customerEmail);
    console.warn(`[email-provider] Resend API error for recipient=${masked}:`, response.error.message);
    return { success: false, error: response.error.message };
  }

  const masked = maskEmail(payload.customerEmail);
  console.log(
    `[email-provider] Resend Email sent successfully: Order ID=${payload.orderId}, Recipient=${masked}, Message ID=${response.data?.id}`
  );

  return {
    success: true,
    messageId: response.data?.id,
  };
}

export async function sendOrderProcessingEmail(
  payload: OrderProcessingEmailPayload,
  customProvider?: EmailProvider
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (customProvider) {
    return customProvider(payload);
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.EMAIL_FROM;

  // Use Resend if configured, otherwise fall back to safe development logger
  if (apiKey && apiKey.trim() !== '' && fromAddress && fromAddress.trim() !== '') {
    try {
      return await sendResendOrderProcessingEmail(payload);
    } catch (err: unknown) {
      const masked = maskEmail(payload.customerEmail);
      const errMsg = err instanceof Error ? err.message : 'Unknown Resend error';
      console.warn(`[email-provider] Resend dispatch failed for recipient=${masked}: ${errMsg}`);
      return { success: false, error: errMsg };
    }
  }

  // Development-safe fallback provider
  const masked = maskEmail(payload.customerEmail);
  console.log(
    `[email-provider] Safe Development Fallback Email Logged: Order ID=${payload.orderId}, Status=${payload.status}, Recipient=${masked}`
  );

  return {
    success: true,
    messageId: `dev-msg-${Date.now()}`,
  };
}
