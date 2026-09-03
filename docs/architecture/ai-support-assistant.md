# Phase 9 Architecture — Customer AI Support Assistant

## Overview
The Customer AI Support Assistant provides grounded support for product availability, store policy questions, and authorized order status lookups.

The assistant is strictly **read-only** and operates under **least-privilege AI principles**. It does NOT have direct database credentials or raw SQL query execution capabilities.

---

## 1. System Request & Data Flow

```text
Customer Chat UI (/support)
         ↓  (validated POST /api/support/chat)
Server Chat API
         ↓
Deterministic Application Routing & Bounded Parallel Retrieval
         ↓
┌─────────────────────────────────────────────────────────┐
│ Server-Side Grounded Context Tools:                     │
│ 1. searchProducts(query)        → PostgreSQL Product    │
│ 2. retrieveSupportKnowledge(q)  → Markdown Policies     │
│ 3. getAuthorizedOrderSummary(id, sessionProof) → Order │
└─────────────────────────────────────────────────────────┘
         ↓
Constructed Grounded Context & System Instructions
         ↓
AI Provider Abstraction (src/lib/ai/provider.ts)
(Google Gemini 2.0 Flash / Groq / Grounded Engine Fallback)
         ↓
Grounded Assistant Response + Source Badges
```

*Note on Architecture*: This implementation uses **deterministic application routing & bounded retrieval** (the server application executes predefined retrieval functions prior to model generation; the LLM itself does not dynamically invoke external APIs).

---

## 2. Security & Least-Privilege AI Boundaries

### Why the LLM Does NOT Have Direct Database Credentials
1. **Probabilistic vs. Deterministic Security**: LLMs are probabilistic text generators. Giving an LLM raw database credentials or SQL query generation authority creates severe SQL-injection and data-exfiltration vulnerabilities.
2. **Deterministic Data Access**: All database access occurs through predefined, server-side TypeScript functions (`searchProducts`, `getAuthorizedOrderSummary`). The LLM cannot execute anything outside these application boundaries.
3. **No Write Operations**: The assistant possesses ZERO write tools. It cannot cancel orders, issue refunds, adjust inventory, edit customer accounts, or modify shipments. If asked to perform a mutation, it explains that it is read-only and directs the user to human support.

---

## 3. Order-Scoped Security Proof & Proof Secrecy

An order status query requires BOTH an `orderId` AND a matching `sessionId` (Stripe Checkout Session ID).

```text
Request contains (orderId, sessionId)
                ↓
Deterministic Server Authorization (getAuthorizedOrderSummary)
                ↓
Do orderId and sessionId match order.stripeCheckoutSessionId?
├── YES → Expose safe order summary (status, paymentStatus, customer-friendly explanation, item names).
└── NO  → Deny access with 403. Return generic message ("Valid Order ID and matching Checkout Session ID proof required").
                ↓
[SENSITIVE SESSION PROOF DISCARDED]
(sessionId is NEVER sent to Gemini/Groq, NEVER put in LLM context, NEVER logged, and NEVER returned to browser)
```

**Privacy Guarantee**: Non-existent order IDs and invalid session proofs produce identical access denied responses, preventing arbitrary order ID enumeration attacks.

---

## 4. Grounded Knowledge & RAG Foundation

- **Store Policies**: Located in `src/content/support/*.md` (`shipping-policy.md`, `returns-refunds-policy.md`, `faq-payment.md`, `order-status-policy.md`, `support-contact.md`).
- **Retrieval**: `retrieveSupportKnowledge()` matches and ranks policy excerpts against customer queries. Designed so vector embeddings can replace token scoring seamlessly.
- **Product Inventory**: `searchProducts()` queries PostgreSQL `Product` table directly for live stock and prices.

---

## 5. Hallucination, Security Boundaries & Rate Limiting

1. **Grounding & Accuracy**: Retrieval grounds model responses in current authoritative data, significantly reducing hallucination risk. However, because LLMs are probabilistic, the model may still produce imperfect natural-language interpretations.
2. **Security Enclosures**: Deterministic authorization and fixed server-side tool functions enforce hard security boundaries. System prompts guide conversational style, while application code enforces access controls.
3. **Sanitized Inputs & Bounded Limits**:
   - Max user message length: 500 characters
   - Max conversation history: 10 messages
   - Max retrieved products: 5 products
   - Max retrieved policy documents: 3 documents
4. **Rate Limiting Notice**: Per-IP/user rate limiting is a future production-hardening item. Current portfolio implementation bounds message/history/retrieval sizes but does not claim full abuse-rate protection.
