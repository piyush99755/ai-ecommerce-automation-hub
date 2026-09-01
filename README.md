# AI E-commerce Automation Hub

> **Event-driven, outbox-backed e-commerce fulfillment platform integrating Next.js, PostgreSQL, Stripe, n8n, HubSpot, and Resend.**

[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-blue?style=flat-square&logo=postgresql)](https://neon.tech/)
[![Prisma](https://img.shields.io/badge/Prisma-8.0-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![n8n](https://img.shields.io/badge/n8n-Orchestration-FF6D5A?style=flat-square&logo=n8n)](https://n8n.io/)
[![Stripe](https://img.shields.io/badge/Stripe-Checkout-635BFF?style=flat-square&logo=stripe)](https://stripe.com/)
[![Build Status](https://img.shields.io/badge/Build-Passing-emerald?style=flat-square)](#testing--verification)

---

## 🚀 What the System Does

The **AI E-commerce Automation Hub** automates the entire lifecycle of an e-commerce order—from checkout and payment processing to inventory allocation, CRM sync, customer notifications, and operational failure monitoring.

Instead of performing fragile, synchronous HTTP calls to third-party services during user checkout requests, the platform uses a **Transactional Outbox Pattern** to guarantee that all downstream side effects (fulfillment, CRM updates, Discord alerts, customer emails) are delivered **at-least-once** with idempotent execution.

---

## 💡 Key Business Workflows

1. **Seamless Checkout & Payment Verification**: Customers select products, review their cart, and pay via Stripe Hosted Checkout. Stripe webhooks verify cryptographic signatures (`STRIPE_WEBHOOK_SECRET`) and trigger automated fulfillment.
2. **Atomic Inventory Allocation**: PostgreSQL enforces stock checks at mutation time (`WHERE stock >= quantity`), preventing overselling during concurrent checkouts.
3. **Automated HubSpot CRM Synchronization**: Contact records (by email) and Deal records (by `external_order_id`) are automatically created and updated across deal lifecycle stages (`PROCESSING` $\rightarrow$ `SHIPPED` $\rightarrow$ `DELIVERED`).
4. **Durable Customer Lifecycle Emails**: Order confirmations and shipping notifications are committed inside the database transaction and dispatched via Resend using provider-side idempotency keys.
5. **Proactive Failure Monitoring**: A dedicated n8n monitoring workflow inspects persistent outbox failures every 1 minute and alerts engineering via Discord without alert spam.

---

## 🏗 High-Level Architecture

```mermaid
flowchart LR
    Client["Client Storefront (Next.js 16)"]
    API["API Layer (/api/*)"]
    DB[(Neon PostgreSQL)]
    Outbox["Outbox Engine"]
    n8n["n8n Orchestration"]
    HubSpot["HubSpot CRM"]
    Resend["Resend Email API"]
    Discord["Discord Alerts"]

    Client --> API
    API -- "Atomic Transaction" --> DB
    Outbox -- "Poll PENDING Events" --> DB
    Outbox -- "HTTP POST Webhook" --> n8n
    n8n -- "Process Order / CRM / Email" --> API
    API --> HubSpot
    API --> Resend
    n8n --> Discord
```

Detailed technical specifications and sequence diagrams are available in [docs/architecture/system-architecture.md](docs/architecture/system-architecture.md) and [docs/architecture/n8n-workflows.md](docs/architecture/n8n-workflows.md).

---

## 🛠 Tech Stack

* **Frontend**: Next.js 16 (App Router, Server & Client Components, Tailwind CSS)
* **Database**: Neon PostgreSQL (Prisma 8 contract-driven schema & migrations)
* **Workflow Automation**: n8n (Docker containerized instance running 7 production workflows)
* **Payment Gateway**: Stripe (Hosted Checkout Sessions, Webhook Signatures)
* **CRM**: HubSpot REST API (Contacts, Deals, Associations)
* **Email Provider**: Resend API (HTML Transactional Email Templates)
* **Monitoring & Alerts**: Discord Webhooks & `ConsumerEvent` deduplication

---

## 🛡 Core Reliability & Security Patterns

* **Transactional Outbox**: Domain state changes and event envelope creations commit atomically inside PostgreSQL transactions.
* **At-Least-Once Delivery**: The outbox dispatcher retries failed webhooks using exponential backoff (`1m`, `5m`, `15m`, `60m`, max 5 attempts).
* **Two-Phase Consumer Deduplication**: Consumers claim events via `POST /api/internal/events/claim` (`ConsumerEvent` table) before executing side effects, suppressing duplicate execution.
* **Resend Provider Idempotency**: Transmits outbox `eventId` as `Idempotency-Key` HTTP header to prevent duplicate customer emails on worker retries.
* **Stripe Session Authorization**: Status polling (`GET /api/orders/[id]/status`) and order confirmation views require proof-of-purchase (`session_id` matching `order.stripeCheckoutSessionId`), returning `403 Forbidden` / `404 Not Found` for unauthorized requests.

---

## 🔄 Main n8n Workflows

| Workflow Name | Trigger | Key Function |
| :--- | :--- | :--- |
| **Payment Orchestration - Fulfillment** | `POST /webhook/payment-succeeded` | Claims payment event, triggers `/process` endpoint, and fans out to CRM. |
| **Customer Lifecycle - CRM Sync** | `POST /webhook/payment-succeeded-crm` | Upserts HubSpot Contact & Deal records and updates lifecycle stages. |
| **Inventory Monitoring - Low Stock** | `POST /webhook/inventory-updated` | Sends operational low-stock alert to Discord with deduplication. |
| **Order Status Orchestration** | `POST /webhook/order-status-updated` | Fans out status changes to CRM and shipping workflows. |
| **Order Status - Shipping & Delivery** | `POST /webhook/order-status-shipping` | Posts shipping & delivery operational alerts to Discord. |
| **Customer Notification - Email Dispatcher** | `POST /webhook/email-notification` | Fetches email context and delivers durable HTML emails via Resend. |
| **Automation Reliability - Outbox Monitor** | Schedule (1 min) | Runs outbox dispatcher batch and alerts Discord on persistent failures. |

---

## 💻 Local Setup & Development

### 1. Prerequisites
* Node.js v20+ / pnpm or npm
* Docker & Docker Compose (for local n8n container)
* Neon PostgreSQL Database instance

### 2. Environment Configuration
Create a `.env` file in the project root:
```env
DATABASE_URL="postgresql://user:pass@ep-host.aws.neon.tech/neondb?sslmode=verify-full"
DIRECT_URL="postgresql://user:pass@ep-host.aws.neon.tech/neondb?sslmode=verify-full"

# Internal Security
N8N_AUTOMATION_SECRET="local_dev_n8n_secret_12345"

# Stripe Configuration
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Resend Configuration
RESEND_API_KEY="re_..."
EMAIL_FROM="AI E-commerce Hub <onboarding@resend.dev>"

# Webhook Endpoints
N8N_PAYMENT_SUCCEEDED_WEBHOOK_URL="http://localhost:5678/webhook/payment-succeeded"
N8N_ORDER_STATUS_WEBHOOK_URL="http://localhost:5678/webhook/order-status-updated"
N8N_INVENTORY_UPDATED_WEBHOOK_URL="http://localhost:5678/webhook/inventory-updated"
N8N_EMAIL_NOTIFICATION_WEBHOOK_URL="http://localhost:5678/webhook/email-notification"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 3. Database Migration & Setup
```bash
# Verify database marker and contract synchronization
npx prisma db verify

# Check migration status
npx prisma migration status
```

### 4. Running Next.js App
```bash
npm run dev
# App runs at http://localhost:3000
```

---

## 🧪 Testing & Verification

Run production build and type checking:
```bash
# Type check & Next.js production build
npm run build
```

---

## 📌 Project Status & Portfolio Notes

* **Delivery Semantics**: Designed for **at-least-once delivery** with idempotent consumer processing.
* **Test Coverage**: E2E verified using Stripe test mode, local n8n Docker container, and Neon PostgreSQL.
* **Production Qualification**: Production-ready for local and integration environments. Cloud deployment requires HTTPS webhooks, multi-region database failover, and external secret management.
