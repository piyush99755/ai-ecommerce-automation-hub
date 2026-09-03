# Phase 10 Architecture — Admin AI Operations Copilot & Human-in-the-Loop Controlled Actions

## Overview
The Admin AI Operations Copilot provides evidence-based operational insights and controlled action proposals to authenticated operations and support staff (`SUPER_ADMIN`, `OPERATIONS`, `SUPPORT`).

Phase 10A introduced strict read-only retrieval tools. Phase 10B introduces **Human-in-the-Loop Controlled AI Actions**, allowing the Copilot to propose administrative mutations (inventory adjustments and failed event requeues) that require explicit human admin confirmation before executing through authoritative backend business services.

---

## 1. Action Proposal & Execution Architecture

```text
Admin Natural-Language Request ("Add 10 units to Wireless Mechanical Keyboard")
       ↓
Server Chat API (POST /api/admin/copilot/chat)
       ↓
Deterministic Action Recognition (proposeCopilotAction)
       ↓
Proposal-Time RBAC Authorization Check (hasAdminCapability)
       ↓
Persisted Pending Action Record (copilotAction table, status = 'PROPOSED', expiresAt = NOW() + 10m)
       ↓
Render Human Confirmation UI Card (Explicit button: [Confirm Adjustment (+10)])
       ↓
Explicit Human Admin Click (POST /api/admin/copilot/confirm { actionId })
       ↓
Fresh Role Re-Authorization Check (getFreshAdmin -> hasAdminCapability AT EXECUTION TIME)
       ↓
Atomic State Transition (UPDATE status = 'EXECUTING' WHERE status = 'PROPOSED' AND expiresAt > NOW())
(Prevents double-submit, concurrent tab races, and replay attacks)
       ↓
TOCTOU Re-Validation & Shared Business Service Execution
├── Inventory: executeInventoryAdjustmentService (SELECT FOR UPDATE, stock + delta >= 0)
└── Requeue: executeOutboxRequeueService (State-aware replay eligibility check)
       ↓
PostgreSQL Transaction + Specialized Audit + Centralized AdminAuditLog (source: 'AI_COPILOT')
       ↓
Mark Status COMPLETED & Return Executed Result Summary
```

---

## 2. Key Architectural & Security Principles

### Human-in-the-Loop Safeguard
The initial Copilot message NEVER performs a mutation. Proposal and execution are strictly separate steps. The LLM creates a server-persisted action proposal; execution occurs ONLY when a human admin clicks the verified UI confirmation button.

### Proposal vs. Execution Separation
To eliminate client tampering, the client browser does not send mutation payloads (e.g. `{ delta: 100000 }`). It sends only the server-generated `actionId`. The server looks up the tamper-resistant pending record in PostgreSQL and re-verifies all arguments.

### One-Time Execution & Anti-Replay Protection
Inventory adjustments are not inherently idempotent (+10 executed twice becomes +20). Replay protection is enforced via atomic PostgreSQL state transition:
```sql
UPDATE "copilotAction"
SET status = 'EXECUTING', "confirmedAt" = NOW()
WHERE id = $1 AND "adminId" = $2 AND status = 'PROPOSED' AND "expiresAt" > NOW()
RETURNING *;
```
If 0 rows are updated, execution is blocked with HTTP 409 Conflict (Already Executed) or HTTP 400 Expired.

### TOCTOU (Time-of-Check to Time-of-Use) Re-Validation
Stock levels, outbox replay eligibility, and admin roles can change between proposal creation and human confirmation. All conditions are re-validated at execution time inside PostgreSQL row-locking transactions.

### Reusing Shared Business Services
Copilot actions do NOT duplicate mutation logic. Stock adjustments invoke `executeInventoryAdjustmentService()` (the same service used by the Inventory Console). Requeues invoke `executeOutboxRequeueService()` (the same service used by the Automation Reliability Console). Both write specialized audit records and centralized `AdminAuditLog` entries with `source: 'AI_COPILOT'`.
