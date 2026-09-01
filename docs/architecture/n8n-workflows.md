# n8n Workflow Architecture & Integration Contracts

The **AI E-commerce Automation Hub** uses 7 n8n workflows for event routing, business automation, notification dispatching, and reliability monitoring.

---

## Dedicated Event Webhook Routing Map

```text
Event Type                         Environment Variable                     Published n8n Endpoint
───────────────────────────────    ────────────────────────────────────     ────────────────────────────────────────────────
PAYMENT_SUCCEEDED                  N8N_PAYMENT_SUCCEEDED_WEBHOOK_URL        http://localhost:5678/webhook/payment-succeeded
INVENTORY_UPDATED                  N8N_INVENTORY_UPDATED_WEBHOOK_URL        http://localhost:5678/webhook/inventory-updated
ORDER_STATUS_UPDATED               N8N_ORDER_STATUS_WEBHOOK_URL             http://localhost:5678/webhook/order-status-updated
ORDER_PROCESSING_NOTIFICATION      N8N_EMAIL_NOTIFICATION_WEBHOOK_URL       http://localhost:5678/webhook/email-notification
ORDER_SHIPPED_NOTIFICATION         N8N_EMAIL_NOTIFICATION_WEBHOOK_URL       http://localhost:5678/webhook/email-notification
ORDER_DELIVERED_NOTIFICATION       N8N_EMAIL_NOTIFICATION_WEBHOOK_URL       http://localhost:5678/webhook/email-notification
```

> [!NOTE]
> All domain events map strictly to their dedicated environment variables. Zero legacy fallback URLs exist.

---

## Workflow Specifications

### 1. Payment Orchestration - Fulfillment & CRM Fan-Out
* **Trigger**: Webhook (`POST /webhook/payment-succeeded`)
* **Handled Event**: `PAYMENT_SUCCEEDED`
* **Node Sequence**:
  1. `PAYMENT_SUCCEEDED Webhook`
  2. `Claim Payment Event` (`POST /api/internal/events/claim` [consumerId: `payment-fulfillment`])
  3. `Check Can Process` (If `$json.canProcess === true`)
  4. `Process Order` (`POST /api/internal/orders/{orderId}/process`)
  5. `Fan-Out to CRM` (`POST http://localhost:5678/webhook/payment-succeeded-crm`)
  6. `Complete Payment Event` (`POST /api/internal/events/complete`)
* **Deduplication / Idempotency**: `ConsumerEvent` two-phase claim (`consumerId: 'payment-fulfillment'`). `/process` endpoint enforces idempotent execution.
* **Failure Behavior**: If `/process` fails, claim remains `PROCESSING` and outbox engine retries delivery via exponential backoff.
* **Side Effects**: Transitions order to `PROCESSING`, decrements stock, creates `ORDER_PROCESSING_NOTIFICATION` outbox event, triggers CRM sync.

---

### 2. Customer Lifecycle - CRM Sync
* **Trigger**: Webhook (`POST /webhook/payment-succeeded-crm`)
* **Handled Event**: `PAYMENT_SUCCEEDED` / `ORDER_STATUS_UPDATED`
* **Node Sequence**:
  1. `CRM Sync Webhook`
  2. `Claim CRM Event` (`POST /api/internal/events/claim` [consumerId: `hubspot-crm-sync`])
  3. `Fetch CRM Context` (`GET /api/internal/orders/{orderId}/crm-context`)
  4. `Upsert HubSpot Contact` (by customer email)
  5. `Upsert HubSpot Deal` (by `external_order_id`)
  6. `Associate Deal with Contact`
  7. `Complete CRM Event` (`POST /api/internal/events/complete`)
* **Deduplication / Idempotency**: `ConsumerEvent` two-phase claim (`consumerId: 'hubspot-crm-sync'`). HubSpot deal upsert uses `external_order_id` as unique key.
* **Failure Behavior**: On HTTP error from HubSpot API, throws exception, leaving event `PROCESSING` for retry.
* **Side Effects**: Updates HubSpot Contact & Deal records and transitions deal stage.

---

### 3. Inventory Monitoring - Low Stock
* **Trigger**: Webhook (`POST /webhook/inventory-updated`)
* **Handled Event**: `INVENTORY_UPDATED`
* **Node Sequence**:
  1. `INVENTORY_UPDATED Webhook`
  2. `Claim Inventory Alert` (`POST /api/internal/events/claim` [consumerId: `inventory-discord-notifier`])
  3. `Check Can Process` (If `$json.canProcess === true`)
  4. `Post Low Stock Discord Alert` (`POST https://discord.com/api/webhooks/...`)
  5. `Complete Inventory Alert` (`POST /api/internal/events/complete`)
* **Deduplication / Idempotency**: `ConsumerEvent` two-phase claim (`consumerId: 'inventory-discord-notifier'`).
* **Failure Behavior**: Discord rate-limits trigger outbox retry backoff.
* **Side Effects**: Sends operational alert to Discord channel.

---

### 4. Order Status Orchestration & Fan-Out
* **Trigger**: Webhook (`POST /webhook/order-status-updated`)
* **Handled Event**: `ORDER_STATUS_UPDATED`
* **Node Sequence**:
  1. `ORDER_STATUS_UPDATED Webhook`
  2. `Fan-Out to CRM` (`POST http://localhost:5678/webhook/payment-succeeded-crm`)
  3. `Fan-Out to Shipping` (`POST http://localhost:5678/webhook/order-status-shipping`)
* **Deduplication / Idempotency**: Stateless fan-out router; downstream workflows handle deduplication independently.
* **Failure Behavior**: If fan-out POST fails, outbox retries parent event.
* **Side Effects**: Triggers operational shipping workflows and HubSpot deal stage updates.

---

### 5. Order Status - Shipping & Delivery
* **Trigger**: Webhook (`POST /webhook/order-status-shipping`)
* **Handled Event**: `ORDER_STATUS_UPDATED` (`SHIPPED` / `DELIVERED`)
* **Node Sequence**:
  1. `Shipping Webhook`
  2. `Claim Shipping Alert` (`POST /api/internal/events/claim` [consumerId: `shipping-discord-notifier`])
  3. `Check Can Process` (If `$json.canProcess === true`)
  4. `Post Shipping/Delivery Discord Alert` (`POST https://discord.com/api/webhooks/...`)
  5. `Complete Shipping Alert` (`POST /api/internal/events/complete`)
* **Deduplication / Idempotency**: `ConsumerEvent` two-phase claim (`consumerId: 'shipping-discord-notifier'`).
* **Failure Behavior**: Non-2xx Discord responses retry via outbox backoff.
* **Side Effects**: Posts operational tracking & delivery notifications to Discord.

---

### 6. Customer Notification - Email Dispatcher
* **Trigger**: Webhook (`POST /webhook/email-notification`)
* **Handled Events**: `ORDER_PROCESSING_NOTIFICATION`, `ORDER_SHIPPED_NOTIFICATION`, `ORDER_DELIVERED_NOTIFICATION`
* **Node Sequence**:
  1. `ORDER_NOTIFICATION Webhook`
  2. `Claim Notification Event` (`POST /api/internal/events/claim` [consumerId: `email-notifier`])
  3. `Check Can Process` (If `$json.canProcess === true`)
  4. `Fetch Email Context` (`GET /api/internal/orders/{orderId}/email-context`)
  5. `Dispatch Email` (`POST /api/internal/notifications/email`)
  6. `Complete Notification Event` (`POST /api/internal/events/complete`)
* **Deduplication / Idempotency**:
  * **Layer 1**: `ConsumerEvent` claim (`consumerId: 'email-notifier'`).
  * **Layer 2**: Resend `Idempotency-Key: eventId` suppresses duplicate emails on worker crashes.
* **Failure Behavior**: HTTP errors leave event `PROCESSING` for outbox retry.
* **Side Effects**: Renders HTML template and sends customer email via Resend SDK.

---

### 7. Automation Reliability - Outbox Monitor
* **Trigger**: Schedule Trigger (Every 1 minute)
* **Handled Events**: Persistent `FAILED` Outbox Events
* **Node Sequence**:
  1. `Schedule Trigger` (Every 1 min)
  2. `Process Outbox Batch` (`POST /api/internal/outbox/process`)
  3. `Fetch Persistent FAILED Events` (`GET /api/internal/outbox?status=FAILED`)
  4. `Claim Failure Alert` (`POST /api/internal/events/claim` [consumerId: `outbox-monitor-alert`, `allowedStatusCodes: '200,409'`])
  5. `Check Can Alert` (If `$json.canProcess === true`)
  6. `Limit New Alerts to 5` (`maxItems: 5`)
  7. `Send Discord Failure Alert` (`POST https://discord.com/api/webhooks/...`)
  8. `Complete Failure Alert` (`POST /api/internal/events/complete`)
* **Deduplication / Idempotency**:
  * `ConsumerEvent` claim (`consumerId: 'outbox-monitor-alert'`).
  * `allowedStatusCodes: '200,409'` allows `409 IN_PROGRESS` to skip silently without failing workflow.
  * Post-claim Limit node (`maxItems: 5`) prevents historical `COMPLETED` alerts from starving newly failed events.
* **Failure Behavior**: 500 server errors cause visible workflow failure.
* **Side Effects**: Sends critical failure alerts to Discord for unacknowledged dead-lettered events.
