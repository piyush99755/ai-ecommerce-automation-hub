# Portfolio Screenshot Capture Checklist

> **Purpose**: Visual asset guidelines for portfolio items, GitHub documentation, and client proposals.  
> **Privacy Rule**: Never expose raw production API keys (`sk_live_...`), database passwords, private customer phone numbers, or live session secrets.

---

## 📸 Capture Checklist

### 1. Storefront Product Page
* **Must Be Visible**: Clean product layout, price, stock counter ("15 in stock"), **Add to Cart** button.
* **Redact/Hide**: Internal local dev toolbar or debug overlays.
* **Recommended Caption**: *Clean storefront interface with real-time stock availability and direct add-to-cart navigation.*
* **Client Value**: Shows polish and modern user experience.

---

### 2. Cart & Review Page (`/cart`)
* **Must Be Visible**: Selected product items, quantities, subtotal calculation, **Proceed to Checkout** button.
* **Redact/Hide**: N/A.
* **Recommended Caption**: *Dedicated cart review step allowing customers to modify item quantities before checkout initialization.*
* **Client Value**: Proves standard e-commerce best practices with zero premature order creation.

---

### 3. Stripe Hosted Checkout (Test Mode)
* **Must Be Visible**: Stripe checkout interface, test mode badge (`TEST MODE`), total order amount, line items.
* **Redact/Hide**: Live credit card numbers or real customer payment data.
* **Recommended Caption**: *Secure Stripe Hosted Checkout integration with test-mode signature verification.*
* **Client Value**: Demonstrates PCI-compliant payment integration without storing sensitive card data.

---

### 4. Auto-Refreshing Order Confirmation Page (`/orders/[id]`)
* **Must Be Visible**: Order ID, `PAID` payment badge, `PROCESSING` status badge, **"Auto-refreshing order status..."** pulse indicator, customer details.
* **Redact/Hide**: Sensitive test tokens in URL bar (crop query string if displaying full desktop view).
* **Recommended Caption**: *Order confirmation view featuring real-time client status polling that auto-updates when background fulfillment completes.*
* **Client Value**: Eliminates customer confusion by removing manual page refresh requirements.

---

### 5. n8n Payment Orchestration Workflow
* **Must Be Visible**: n8n canvas displaying `PAYMENT_SUCCEEDED Webhook` $\rightarrow$ `Claim Event` $\rightarrow$ `/process` $\rightarrow$ `CRM Fan-Out`.
* **Redact/Hide**: `X-Automation-Secret` values in HTTP header parameter fields.
* **Recommended Caption**: *n8n visual workflow orchestrating payment verification, fulfillment processing, and CRM fan-out.*
* **Client Value**: Highlights no-code/low-code workflow transparency combined with robust backend engineering.

---

### 6. n8n Customer Notification - Email Dispatcher
* **Must Be Visible**: n8n nodes claiming notification events, fetching PII context via protected endpoints, and triggering Resend API.
* **Redact/Hide**: Resend API Key strings.
* **Recommended Caption**: *Durable email notification workflow using two-phase consumer deduplication and provider idempotency keys.*
* **Client Value**: Proves emails are delivered reliably without duplicate customer sends.

---

### 7. HubSpot CRM Contact & Deal View
* **Must Be Visible**: HubSpot Contact record with customer email and associated Deal record displaying `external_order_id`, order amount, and stage set to `Processing`.
* **Redact/Hide**: Real client CRM account IDs.
* **Recommended Caption**: *Automated HubSpot CRM synchronization updating contacts, deals, and sales pipeline stages in real time.*
* **Client Value**: Demonstrates automatic sales alignment for business operations teams.

---

### 8. Transactional HTML Customer Email (Resend)
* **Must Be Visible**: Formatted HTML order processing email with order summary, total amount, and customer greeting.
* **Redact/Hide**: Internal Resend account ID.
* **Recommended Caption**: *Transactional customer processing email dispatched automatically via Resend API.*
* **Client Value**: Validates professional brand communication.

---

### 9. Discord Operational Alert Channels
* **Must Be Visible**: `#ops-alerts` Discord channel showing rich embeds for low-stock warnings, shipping updates (with carrier/tracking number), and outbox failure alerts.
* **Redact/Hide**: Discord webhook URL strings.
* **Recommended Caption**: *Real-time operational alerts in Discord keeping fulfillment and inventory teams instantly informed.*
* **Client Value**: Highlights proactive operational awareness and team communication.

---

### 10. PostgreSQL Outbox & ConsumerEvent Table View (Prisma Studio / TablePlus)
* **Must Be Visible**: `OutboxEvent` table displaying `eventType`, `status` (`DELIVERED`), and `ConsumerEvent` table displaying `(consumerId, eventId)` claim records (`COMPLETED`).
* **Redact/Hide**: Full database connection string.
* **Recommended Caption**: *PostgreSQL transactional outbox and two-phase consumer deduplication store.*
* **Client Value**: Proves underlying technical rigor to engineering leads and CTOs.
