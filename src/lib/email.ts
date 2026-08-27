export interface OrderProcessingEmailPayload {
  orderId: string;
  customerEmail: string;
  status: string;
}

export type EmailProvider = (
  payload: OrderProcessingEmailPayload
) => Promise<{ success: boolean; messageId?: string }>;

function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***@***';
  const [local, domain] = email.split('@');
  const maskedLocal = local.length > 2 ? `${local[0]}***${local[local.length - 1]}` : '***';
  return `${maskedLocal}@${domain}`;
}

export async function sendOrderProcessingEmail(
  payload: OrderProcessingEmailPayload,
  customProvider?: EmailProvider
): Promise<{ success: boolean; messageId?: string }> {
  if (customProvider) {
    return customProvider(payload);
  }

  // Development-safe provider: logs non-sensitive delivery metadata
  const masked = maskEmail(payload.customerEmail);
  console.log(
    `[email-provider] Safe Order Processing Email Dispatched: Order ID=${payload.orderId}, Status=${payload.status}, Recipient=${masked}`
  );

  return {
    success: true,
    messageId: `dev-msg-${Date.now()}`,
  };
}
