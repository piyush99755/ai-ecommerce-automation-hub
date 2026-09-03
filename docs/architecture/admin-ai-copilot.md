# Phase 10A Architecture — Read-Only Admin AI Operations Copilot

## Overview
The Admin AI Operations Copilot provides evidence-based operational insights to authenticated operations and support staff (`SUPER_ADMIN`, `OPERATIONS`, `SUPPORT`).

The Copilot is strictly **read-only** (Phase 10A). It does NOT possess write tools, SQL execution authority, or direct database credentials.

---

## 1. Request & Authorization Flow

```text
Admin Question (/admin/copilot)
       ↓
Server Authentication (HMAC Signed Session Cookie)
       ↓
Fresh Role Resolution (SELECT role FROM "admin" WHERE id = adminId)
       ↓
Deterministic Intent Router (determineCopilotIntent)
       ↓
Per-Tool RBAC Capability Guard (executeCopilotTool)
├── Check hasAdminCapability(adminRole, TOOL_CAPABILITY_MAP[toolName]) BEFORE query
├── Lacks capability → Return 403 Access Denied (Database query NEVER runs)
└── Has capability   → Execute parameterized read-only query module
       ↓
Safe Operational Context Payload
       ↓
AI Provider Abstraction (src/lib/ai/provider.ts)
(Google Gemini 2.0 Flash / Groq / Copilot Engine Fallback)
       ↓
Evidence-Based Grounded Answer (Finding, Evidence, Interpretation, Next Check)
```

---

## 2. Key Architectural & Security Principles

### Grounding & Hallucination Risk Reduction
Grounding supplies authoritative database evidence to the model, significantly reducing hallucination risk. Model natural-language interpretation remains probabilistic, but raw operational facts are anchored in real system data.

### Why Security Boundaries Are Application-Enforced
Security-critical authorization and data-access boundaries are enforced deterministically by application code rather than delegated to the LLM. Giving an LLM raw database credentials or allowing it to generate raw SQL creates severe SQL-injection and data-exfiltration risks. All data access occurs through hardcoded, parameterized TypeScript functions.

### Why Authorization Happens BEFORE Retrieval
`executeCopilotTool` evaluates `hasAdminCapability(adminRole, toolCapability)` BEFORE executing any database query. For example, if a restricted user queries automation health, the `VIEW_AUTOMATIONS` capability check fails *before* the outbox table is queried. The LLM receives an explicit permission-denied payload and never sees unauthorized data.

### Why AI Cannot Override RBAC
The LLM has zero capability to grant permissions, alter roles, or bypass authorization checks. All capability checks run in server-side TypeScript code prior to model invocation.

### Why Read-Only Phase 10A Precedes Action-Taking Phase 10B
Building a reliable, read-only operational evidence layer establishes strict auditability, grounding, and permission boundaries before introducing high-risk mutation tools (requeueing failed outbox events, adjusting stock, or modifying customer data) in future phases.
