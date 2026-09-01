# Portfolio Demo Script (3–5 Minutes)

> **Target Audience**: Clients, Hiring Managers, and Technical Evaluators  
> **Goal**: Demonstrate a seamless customer purchase journey backed by transactional outbox reliability, n8n workflow orchestration, HubSpot CRM integration, and outbox failure recovery.

---

## 🎬 Demo Overview & Setup

* **App Storefront**: `http://localhost:3000`
* **n8n Webhook Console**: `http://localhost:5678`
* **HubSpot CRM Portal**: Contacts & Deals dashboard
* **Discord Notification Channel**: `#ops-alerts`
* **Demo Duration**: ~4 Minutes

---

## 📍 Step-by-Step Demo Script

### Scene 1: Customer Storefront & Add to Cart (30 Seconds)
* **Action**:
  1. Open the Storefront homepage (`/products`).
  2. Click on a product (e.g., *Wireless Noise-Canceling Headphones*, Stock: 15).
  3. Click **"Add to Cart"**.
* **Talking Point**:
  > *"Notice how clicking 'Add to Cart' immediately navigates the customer to `/cart` while preserving item quantity in local state. No order is created prematurely—the customer has complete freedom to review items before initiating checkout."*

---

### Scene 2: Checkout & Stripe Hosted Payment (45 Seconds)
* **Action**:
  1. Click **"Proceed to Checkout"** on `/cart`.
  2. Review the `/checkout` summary. Show that pricing is authoritatively checked against PostgreSQL.
  3. Click **"Pay with Stripe"**.
  4. Complete payment on Stripe Hosted Checkout using test card (`4242 4242 4242 4242`).
  5. Click **"Return to Merchant"**.
* **Talking Point**:
  > *"Stripe redirects the customer back to `/orders/[id]?session_id=cs_test_...`. Notice the URL contains a cryptographic proof-of-purchase token (`session_id`). Initial state shows `PAID` + `PENDING`."*

---

### Scene 3: Async Fulfillment & Auto-Status Update (45 Seconds)
* **Action**:
  1. Keep the `/orders/[id]` page open.
  2. Watch the status badge automatically update from **`PENDING` $\rightarrow$ `PROCESSING`** within 3 seconds without refreshing the browser!
* **Talking Point**:
  > *"Behind the scenes, Stripe fired a verified webhook (`POST /api/webhooks/stripe`). The backend wrote an outbox event inside a database transaction. n8n received the outbox trigger, called `/api/internal/orders/[id]/process`, atomically decremented stock, and updated the order state. The client component (`OrderStatusPoller`) detected the status change via lightweight polling and updated the UI automatically!"*

---

### Scene 4: Customer Email & HubSpot CRM Verification (60 Seconds)
* **Action**:
  1. Open the email inbox (or Resend dashboard). Show the **Order Processing Confirmation Email**.
  2. Open the **HubSpot CRM Dashboard**.
  3. Show the newly created **Contact** (customer email) and **Deal** (labeled with `external_order_id`).
  4. Show the Deal stage set to **`Processing`**.
* **Talking Point**:
  > *"Fulfillment emails and CRM updates are handled through two-phase consumer deduplication (`ConsumerEvent`). Even if a worker crashes post-email send, Resend's provider-side idempotency key prevents duplicate customer emails."*

---

### Scene 5: Shipping, Delivery & Discord Alerts (45 Seconds)
* **Action**:
  1. Trigger status update from `PROCESSING` $\rightarrow$ `SHIPPED` (with tracking number `1Z9999999999999999`).
  2. Show the Discord operational alert in `#ops-alerts` showing shipping & tracking metadata.
  3. Show the HubSpot Deal stage updating to **`Shipped`**.
  4. Trigger status update `SHIPPED` $\rightarrow$ `DELIVERED`. Show the final delivery email and HubSpot stage set to **`Closed Won / Delivered`**.
* **Talking Point**:
  > *"Every lifecycle state transition generates explicit outbox notification events that fan out to n8n, updating operational Discord channels and customer emails in tandem."*

---

### Scene 6: Reliability Monitor & Security Proof (45 Seconds)
* **Action**:
  1. Show the n8n **`Automation Reliability - Outbox Monitor`** workflow.
  2. Show how persistent `FAILED` outbox events are queried from PostgreSQL and alerted to Discord without notification spam using anti-starvation rate limiting (`maxItems: 5`).
  3. Try removing `?session_id=...` from `/orders/[id]` URL in an incognito window. Show that it returns **`404 Not Found`** (denying unauthorized PII access).
* **Talking Point**:
  > *"Finally, order status endpoints are locked with strict proof-of-purchase authorization. Only callers with the valid Stripe session ID can view order details, keeping customer data secure."*

---

## 🎯 Key Takeaways for Clients

* **Zero Lost Orders**: Transactional outbox pattern prevents dropped webhook events during network outages.
* **No Double Charges / No Duplicate Emails**: Idempotent consumers and provider keys guarantee single-execution side effects.
* **Fully Automated Ops**: Integrated Stripe, PostgreSQL, n8n, HubSpot, and Resend workflows eliminate manual data entry.
