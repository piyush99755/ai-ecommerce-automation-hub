export interface PaymentSucceededEventPayload {
  event: 'PAYMENT_SUCCEEDED';
  orderId: string;
  customerId: string;
  paymentStatus: 'PAID';
}

export interface InventoryUpdatedEventPayload {
  event: 'INVENTORY_UPDATED';
  orderId: string;
  productIds: string[];
}

export interface OrderStatusUpdatedEventPayload {
  event: 'ORDER_STATUS_UPDATED';
  orderId: string;
  status: 'SHIPPED' | 'DELIVERED';
  carrier?: string | null;
  trackingNumber?: string | null;
}

export async function sendPaymentSucceededEvent(
  payload: PaymentSucceededEventPayload
): Promise<{ success: boolean; error?: string }> {
  const webhookUrl = process.env.N8N_PAYMENT_SUCCEEDED_WEBHOOK_URL || process.env.N8N_ORDER_CREATED_WEBHOOK_URL;

  if (!webhookUrl || webhookUrl.trim() === '') {
    console.warn('[n8n] N8N Webhook URL is not configured. Skipping PAYMENT_SUCCEEDED event dispatch.');
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
    console.warn('[n8n] Failed to deliver PAYMENT_SUCCEEDED event to n8n:', message);
    return { success: false, error: message };
  }
}

export async function sendInventoryUpdatedEvent(
  payload: InventoryUpdatedEventPayload
): Promise<{ success: boolean; error?: string }> {
  const webhookUrl = process.env.N8N_INVENTORY_UPDATED_WEBHOOK_URL || process.env.N8N_ORDER_CREATED_WEBHOOK_URL;

  if (!webhookUrl || webhookUrl.trim() === '') {
    console.warn('[n8n] N8N Webhook URL is not configured. Skipping INVENTORY_UPDATED event dispatch.');
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
    console.warn('[n8n] Failed to deliver INVENTORY_UPDATED event to n8n:', message);
    return { success: false, error: message };
  }
}

export async function sendOrderStatusUpdatedEvent(
  payload: OrderStatusUpdatedEventPayload
): Promise<{ success: boolean; error?: string }> {
  const webhookUrl = process.env.N8N_ORDER_STATUS_WEBHOOK_URL || process.env.N8N_ORDER_CREATED_WEBHOOK_URL;

  if (!webhookUrl || webhookUrl.trim() === '') {
    console.warn('[n8n] N8N Webhook URL is not configured. Skipping ORDER_STATUS_UPDATED event dispatch.');
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
    console.warn('[n8n] Failed to deliver ORDER_STATUS_UPDATED event to n8n:', message);
    return { success: false, error: message };
  }
}
