export interface OrderCreatedEventPayload {
  event: 'ORDER_CREATED';
  orderId: string;
  customerId: string;
  totalCents: number;
  status: string;
  paymentStatus: string;
}

export async function sendOrderCreatedEvent(
  payload: OrderCreatedEventPayload
): Promise<{ success: boolean; error?: string }> {
  const webhookUrl = process.env.N8N_ORDER_CREATED_WEBHOOK_URL;

  if (!webhookUrl || webhookUrl.trim() === '') {
    console.warn('[n8n] N8N_ORDER_CREATED_WEBHOOK_URL is not configured. Skipping webhook dispatch.');
    return { success: false, error: 'Webhook URL not configured' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const statusText = response.statusText || `${response.status}`;
      console.warn(`[n8n] Webhook endpoint responded with HTTP ${response.status}: ${statusText}`);
      return { success: false, error: `HTTP ${response.status}` };
    }

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown network error';
    console.warn('[n8n] Failed to deliver ORDER_CREATED event to n8n:', message);
    return { success: false, error: message };
  }
}
