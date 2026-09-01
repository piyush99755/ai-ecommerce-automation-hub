# Portfolio Screenshot Gallery & Captions

This directory contains sanitized, portfolio-grade screenshots showcasing the **AI E-commerce Automation Hub** customer journey and automated backend infrastructure.

---

## Portfolio Screenshot Catalog

### 01-storefront-catalog.png
> **Caption**: Premium customer storefront featuring real-time client-side search, category filter chips, dynamic stock status badges, and a 3-column responsive product grid backed by Neon PostgreSQL.

### 02-product-detail.png
> **Caption**: High-contrast product detail page presenting vector product artwork, real-time inventory availability, transparent pricing, and instant add-to-cart functionality.

### 03-cart-review.png
> **Caption**: Streamlined shopping cart review displaying itemized order summaries, interactive quantity controls, free shipping threshold verification, and direct checkout navigation.

### 04-checkout.png
> **Caption**: Order placement screen capturing customer delivery information and order totals prior to secure Stripe Hosted Checkout redirection.

### 05-stripe-checkout.png *(Manual Capture)*
> **Caption**: Secure Stripe Hosted Checkout test environment enforcing PCI-compliant payment tokenization and automated webhook triggering.

### 06-order-processing.png
> **Caption**: Authoritative customer order confirmation page enforcing strict UUID + session security authorization and presenting real-time `PAID` / `PROCESSING` status polling.

### 07-payment-orchestration.png *(Manual Capture)*
> **Caption**: n8n Payment Orchestration workflow executing idempotent transactional outbox event ingestion, stock decrements, and downstream distribution.

### 08-crm-sync.png *(Manual Capture)*
> **Caption**: n8n HubSpot CRM workflow syncing customer order history and lifetime value metrics into CRM contact records.

### 09-email-notification.png *(Manual Capture)*
> **Caption**: Resend-powered transactional HTML email notification confirming customer order placement and tracking details.

### 10-reliability-monitor.png *(Manual Capture)*
> **Caption**: n8n Outbox Reliability Monitor cron detecting stale events and executing automatic retry recovery to maintain at-least-once delivery guarantees.
