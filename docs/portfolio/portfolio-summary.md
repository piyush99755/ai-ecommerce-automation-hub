# Portfolio Case Study: Event-Driven E-Commerce Automation Hub

> **Role**: Lead Systems Architect & Automation Engineer  
> **Tech Stack**: Next.js 16, Neon PostgreSQL, Prisma 8, n8n, Stripe, HubSpot, Resend, Discord  
> **Category**: Full-Stack E-Commerce & Workflow Automation Engineering

---

## 📌 The Problem

E-commerce stores often suffer from **fragile third-party API integrations**. When checkout HTTP requests synchronously trigger CRM updates, email providers, and inventory alerts:
* **Temporary API outages** (e.g. HubSpot or Resend down for 5 minutes) cause checkout errors or dropped customer orders.
* **Double-processing glitches** result in duplicate emails sent to customers or inventory overselling.
* **Lack of operational visibility** leaves store owners unaware when background tasks fail.

---

## 💡 The Solution

I architected and built an **Outbox-Backed E-Commerce Fulfillment Engine** that decouples checkout execution from background side effects:

1. **Transactional Outbox Pattern**: Order state changes and outbound event notifications commit atomically inside a single PostgreSQL database transaction.
2. **n8n Workflow Orchestration**: 7 dedicated n8n workflows manage async fulfillment, CRM sync, customer emails, and operational alerting out-of-band.
3. **Idempotent Execution Engine**: Two-phase `ConsumerEvent` claims (`consumerId`, `eventId`) and provider idempotency keys ensure zero double-processing.
4. **Real-Time UX & Proof-of-Purchase Security**: Storefront features auto-refreshing order status polling secured by Stripe session proof tokens.

---

## 🛠 Major Automations & Integrations Built

* **Stripe Hosted Checkout Integration**: Cryptographic signature validation (`STRIPE_WEBHOOK_SECRET`) and automatic payment status updates.
* **HubSpot CRM Pipeline Automation**: Automatic Contact creation by email, Deal creation by `external_order_id`, and stage tracking (`Processing` $\rightarrow$ `Shipped` $\rightarrow$ `Delivered`).
* **Durable Customer Lifecycle Emails**: Transactional HTML emails dispatched via Resend using outbox event IDs as provider-side idempotency keys.
* **Inventory & Concurrency Protection**: Tested atomic PostgreSQL conditional stock decrements (`WHERE stock >= quantity`) and automated low-stock Discord alerts.
* **Automated Failure Monitor**: Background outbox health monitor inspecting persistent dead-lettered events and alerting engineering via Discord without notification spam.

---

## 🛡 Reliability Engineering Highlights

* **At-Least-Once Delivery**: Outbox dispatcher retries failed webhooks using exponential backoff (`1m`, `5m`, `15m`, `60m`, max 5 attempts) and recovers stale worker leases after 5 minutes.
* **Atomic Concurrency**: PostgreSQL stock checks occur at mutation time, eliminating race conditions during high-volume flash sales.
* **Proof-of-Purchase Security**: Public status polling (`GET /api/orders/[id]/status`) strictly validates `session_id` tokens matching `order.stripeCheckoutSessionId`, returning `403 Forbidden` / `404 Not Found` for unauthorized callers.

---

## 📈 Demoable & Measurable Outcomes

* **100% Order Durability**: Zero dropped orders during simulated email provider outages (outbox retries until successful).
* **0 Duplicate Emails**: Idempotent consumer claims and Resend idempotency keys guarantee single customer email delivery on worker retries.
* **Instant Visual Status Updates**: Customers see order status transition from `PENDING` $\rightarrow$ `PROCESSING` within 3 seconds without manual page refreshes.

---

## ⚖️ Technical Qualifications & Honest Limitations

* **Delivery Semantics**: Operates under **at-least-once delivery** semantics (not exactly-once delivery).
* **Storage Dependencies**: Disasters causing PostgreSQL storage corruption prior to WAL flush will lose uncommitted state.
* **Environment Scope**: Verified end-to-end using Stripe test mode, local n8n Docker containers, and Neon PostgreSQL. Production cloud scaling requires HTTPS webhooks and external secret manager integration.
