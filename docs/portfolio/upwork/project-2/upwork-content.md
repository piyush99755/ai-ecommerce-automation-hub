# Upwork Portfolio Copy — Project 2: AI E-commerce Operations Hub

---

## 1. Portfolio Title
**AI E-commerce Operations Platform | Automation, CRM & AI Copilot**

---

## 2. Role
**Full-Stack & AI Automation Developer**

---

## 3. Short Portfolio Description (< 600 characters)
> Built a production-oriented e-commerce operations platform using Next.js App Router, TypeScript, PostgreSQL, and Stripe (test-mode E2E verified). Features a transactional outbox pattern for reliable n8n/HubSpot integration, concurrency-safe inventory row locking, fresh PostgreSQL RBAC authorization per request, date-scoped BI analytics, grounded customer AI support, and a human-in-the-loop AI Admin Copilot requiring explicit confirmation for database mutations.

---

## 4. Full Portfolio Description (2–4 Paragraphs)

### Enterprise Architecture & Event-Driven Reliability
This platform is a full-stack e-commerce management console built with Next.js App Router, TypeScript, and PostgreSQL, designed to eliminate race conditions and event loss in high-throughput operations. The backend incorporates a **Transactional Outbox Pattern** that atomically pairs PostgreSQL business transactions (like Stripe payment processing) with outgoing outbox events. An automated background worker dispatches events to external automation webhooks (n8n, HubSpot CRM, Resend Email) with exponential backoff retries and sanitized error traces. An operational console allows administrators to manually inspect failed events and execute state-aware requeue workflows safely.

### Concurrency-Safe Stock Management & RBAC Security
To prevent overselling under concurrent checkout traffic, order fulfillment enforces strict **PostgreSQL row-level locking (`SELECT ... FOR UPDATE`)**, ensuring stock adjustments occur atomically inside single transactions. System access is protected by an HMAC-signed session layer paired with dynamic, server-side Role-Based Access Control (RBAC). Admin capabilities (`SUPER_ADMIN`, `OPERATIONS`, `SUPPORT`) are verified on every protected server request directly against live PostgreSQL roles rather than trusting signed token claims, preventing unauthorized operational actions even if roles are modified mid-session.

### Operational Intelligence & Human-in-the-Loop AI Systems
The console integrates date-scoped Business Intelligence analytics with explicit UTC time-cohort labeling for revenue, AOV, conversion rates, and outbox failure percentages. The platform features two specialized AI layers: a **Grounded Customer AI Support Assistant** that queries authoritative PostgreSQL product data and policy markdown documents under strict least-privilege bounds, and an **Admin AI Operations Copilot**. The Copilot operates strictly through deterministic read-only tools and a tamper-resistant proposal architecture—allowing administrators to query system state and review AI-proposed actions (like inventory restocks) via UI confirmation cards before single-winner atomic transaction execution occurs.

---

## 5. Recommended Skills Tagging
- **Full-Stack Development**
- **AI Automation**
- **Next.js**
- **TypeScript**
- **PostgreSQL**
- **Stripe Integration**
- **n8n Workflow Automation**
- **HubSpot CRM Integration**
- **Generative AI / RAG**
- **LLM Application Development**
- **API Integration**
- **System Architecture**

---

## 6. High-Impact Image Captions (For Upwork Uploads)

### `01-hero-cover.png`
> **AI E-commerce Operations Hub**: Production-oriented operations platform combining Next.js, PostgreSQL, Stripe, n8n, HubSpot CRM, date-scoped analytics, and human-in-the-loop AI actions.

### `02-admin-dashboard.png`
> **Unified Operations Overview**: Real-time management console displaying live fulfillment status, active order pipelines, stock alert warnings, and outbox automation health.

### `03-inventory-operations.png`
> **Concurrency-Safe Inventory Operations**: Row-level database locking (`FOR UPDATE`) preventing stock race conditions, paired with audited manual adjustment workflows.

### `04-automation-reliability.png`
> **Reliable Event-Driven Automation**: Transactional outbox engine featuring exponential backoff retries, sanitized error logs, and state-aware manual event recovery.

### `05-analytics-bi.png`
> **Business Intelligence & Operational Analytics**: Date-range metric cohorts (UTC), revenue trends, top products from OrderItem pricing snapshots, and outbox failure rates.

### `06-customer-ai-support.png`
> **Grounded AI Customer Support**: Bounded PostgreSQL product search, policy RAG retrieval, and secure order-scoped access proof (`orderId` + checkout session proof).

### `07-admin-ai-copilot.png`
> **Human-in-the-Loop AI Operations Copilot**: Deterministic read-only tool router with non-executing proposal cards requiring explicit human confirmation before mutation.

### `08-admin-audit-trail.png`
> **Centralized Admin Audit Trail**: Immutable system logging capturing human identity, action, entity, sanitized safe metadata, and `AI_COPILOT` source attribution.

### `09-customer-crm.png`
> **Customer Operations CRM**: 360-degree customer profile view, order history timeline, all-time LTV calculation, and HubSpot CRM outbox delivery status.
