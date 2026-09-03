import pg from 'pg';
import { AdminRole, getFreshAdmin, hasAdminCapability } from '../admin-rbac';
import { executeInventoryAdjustmentService } from '../admin-inventory';
import { checkOutboxEventEligibility, executeOutboxRequeueService } from '../admin-automations';

const pool = new pg.Pool({
  connectionString: process.env['DATABASE_URL'],
});

export type CopilotActionType = 'ADJUST_INVENTORY' | 'REQUEUE_OUTBOX_EVENT';
export type CopilotActionStatus = 'PROPOSED' | 'EXECUTING' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED' | 'FAILED';

export interface CopilotActionProposalPayload {
  actionType: CopilotActionType;
  entityType: string;
  entityId: string;
  displayTitle: string;
  details: Record<string, unknown>;
  requiredCapability: 'ADJUST_INVENTORY' | 'REQUEUE_AUTOMATION';
}

export interface CopilotActionRecord {
  id: string;
  adminId: string;
  actionType: CopilotActionType;
  entityType: string;
  entityId: string;
  payload: CopilotActionProposalPayload;
  status: CopilotActionStatus;
  expiresAt: string;
  confirmedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
}

export interface ProposeActionResult {
  isMutationIntent: boolean;
  proposed?: boolean;
  authorized?: boolean;
  action?: CopilotActionRecord;
  proposalCard?: {
    actionId: string;
    actionType: CopilotActionType;
    title: string;
    details: Record<string, unknown>;
    requiredCapability: string;
    expiresAt: string;
  };
  error?: string;
  explanation?: string;
}

export interface ConfirmActionResult {
  success: boolean;
  actionId: string;
  actionType?: CopilotActionType;
  status?: CopilotActionStatus;
  executedResult?: Record<string, unknown>;
  error?: string;
  code?: string;
}

/**
 * CopilotAction table lifecycle is canonically managed by Prisma migration 20260903T0153_migration.
 */
export async function initCopilotActionTable(_client?: pg.PoolClient | pg.Client): Promise<void> {
  // Canonical Prisma schema migration managed
}

/**
 * Detects mutation intent and builds a non-executing tamper-resistant CopilotAction proposal in PostgreSQL.
 * Proposal-time RBAC check is enforced before proposal creation.
 */
export async function proposeCopilotAction(options: {
  userMessage: string;
  adminId: string;
  adminRole: AdminRole;
  customClient?: pg.PoolClient | pg.Client;
}): Promise<ProposeActionResult> {
  const { userMessage, adminId, adminRole, customClient } = options;
  const msg = (userMessage || '').toLowerCase();

  const isRequeue = msg.includes('requeue') || msg.includes('retry event');
  const isInventoryAdjust =
    msg.includes('adjust stock') ||
    msg.includes('add stock') ||
    msg.includes('reduce stock') ||
    msg.includes('increase stock') ||
    msg.includes('set stock') ||
    msg.includes('inventory') ||
    /(?:add|increase|plus|reduce|subtract|remove|minus|decrease)\s+(?:stock\s+)?(?:by\s+)?\d+/i.test(msg);

  if (!isRequeue && !isInventoryAdjust) {
    return { isMutationIntent: false };
  }

  const client = customClient || (await pool.connect());

  try {
    await initCopilotActionTable(client);

    // 1. REQUEUE OUTBOX EVENT PROPOSAL
    if (isRequeue) {
      const requiredCap = 'REQUEUE_AUTOMATION';
      if (!hasAdminCapability(adminRole, requiredCap)) {
        return {
          isMutationIntent: true,
          proposed: false,
          authorized: false,
          error: `Forbidden: Admin role '${adminRole}' lacks capability '${requiredCap}' required to propose OutboxEvent recovery.`,
        };
      }

      const uuidMatch = msg.match(/([a-f0-9\-]{36})/i) || msg.match(/([a-f0-9]{8,})/i);
      if (!uuidMatch) {
        return {
          isMutationIntent: true,
          proposed: false,
          error: 'Please specify the exact OutboxEvent ID (UUID) you would like to requeue.',
        };
      }

      const eventIdQuery = uuidMatch[1];
      const eventRes = await client.query(
        `SELECT id, status, "eventType", "aggregateType", "aggregateId", "attemptCount", "lastError"
         FROM "outboxEvent" WHERE id LIKE $1 LIMIT 1`,
        [`${eventIdQuery}%`]
      );

      if (eventRes.rows.length === 0) {
        return {
          isMutationIntent: true,
          proposed: false,
          error: `OutboxEvent matching ID '${eventIdQuery}' was not found.`,
        };
      }

      const ev = eventRes.rows[0];

      // Re-evaluate State-Aware Replay Eligibility at proposal time
      const eligibility = await checkOutboxEventEligibility(ev, client);
      if (!eligibility.eligible) {
        return {
          isMutationIntent: true,
          proposed: false,
          error: `Cannot propose requeue: ${eligibility.reason}`,
        };
      }

      const defaultReason = `Manual requeue proposed via Copilot by admin ${adminId.slice(0, 8)}`;
      const payload: CopilotActionProposalPayload = {
        actionType: 'REQUEUE_OUTBOX_EVENT',
        entityType: 'OutboxEvent',
        entityId: ev.id,
        displayTitle: `Requeue Failed Event (${ev.eventType})`,
        details: {
          eventId: ev.id,
          eventType: ev.eventType,
          currentStatus: ev.status,
          attemptCount: ev.attemptCount,
          lastError: ev.lastError ? ev.lastError.slice(0, 150) : 'None',
          eligibility: 'Safe to requeue',
          reason: defaultReason,
        },
        requiredCapability: 'REQUEUE_AUTOMATION',
      };

      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const insRes = await client.query(
        `INSERT INTO "copilotAction" (id, "adminId", "actionType", "entityType", "entityId", payload, status, "expiresAt", "createdAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'PROPOSED', $6, NOW())
         RETURNING id, "createdAt"`,
        [adminId, payload.actionType, payload.entityType, payload.entityId, JSON.stringify(payload), expiresAt]
      );

      const actionId = insRes.rows[0].id;

      return {
        isMutationIntent: true,
        proposed: true,
        authorized: true,
        action: {
          id: actionId,
          adminId,
          actionType: payload.actionType,
          entityType: payload.entityType,
          entityId: payload.entityId,
          payload,
          status: 'PROPOSED',
          expiresAt,
          createdAt: insRes.rows[0].createdAt,
        },
        proposalCard: {
          actionId,
          actionType: 'REQUEUE_OUTBOX_EVENT',
          title: payload.displayTitle,
          details: payload.details,
          requiredCapability: 'REQUEUE_AUTOMATION',
          expiresAt,
        },
      };
    }

    // 2. ADJUST INVENTORY PROPOSAL
    if (isInventoryAdjust) {
      const requiredCap = 'ADJUST_INVENTORY';
      if (!hasAdminCapability(adminRole, requiredCap)) {
        return {
          isMutationIntent: true,
          proposed: false,
          authorized: false,
          error: `Forbidden: Admin role '${adminRole}' lacks capability '${requiredCap}' required to propose inventory adjustments.`,
        };
      }

      // Parse delta integer
      const addMatch = msg.match(/(?:add|increase|plus)\s*(?:stock\s*)?(?:by\s*)?(\d+)/i);
      const reduceMatch = msg.match(/(?:reduce|subtract|remove|minus|decrease)\s*(?:stock\s*)?(?:by\s*)?(\d+)/i);

      let delta = 0;
      if (addMatch) delta = parseInt(addMatch[1], 10);
      else if (reduceMatch) delta = -parseInt(reduceMatch[1], 10);

      if (delta === 0) {
        return {
          isMutationIntent: true,
          proposed: false,
          error: 'Please specify a non-zero adjustment amount (e.g. "Add 10 units to Mechanical Keyboard").',
        };
      }

      // Resolve product name/slug unambiguously
      const prodsRes = await client.query(`SELECT id, name, slug, stock FROM "product"`);
      let matches = prodsRes.rows.filter((p) => {
        const pName = p.name.toLowerCase();
        const pSlug = p.slug.toLowerCase();
        return msg.includes(pName) || msg.includes(pSlug);
      });

      if (matches.length === 0) {
        matches = prodsRes.rows.filter((p) => {
          const words = p.name.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3 && w !== 'test' && w !== 'stock');
          const matchingWords = words.filter((w: string) => msg.includes(w));
          return matchingWords.length >= 2;
        });
      }

      if (matches.length === 0) {
        return {
          isMutationIntent: true,
          proposed: false,
          error: 'Could not resolve target product. Please specify the exact product name (e.g. "Wireless Mechanical Keyboard").',
        };
      }

      if (matches.length > 1) {
        const names = matches.map((m) => `"${m.name}"`).join(', ');
        return {
          isMutationIntent: true,
          proposed: false,
          error: `Multiple matching products found (${names}). Please specify the exact product name.`,
        };
      }

      const targetProduct = matches[0];
      const currentStock = targetProduct.stock;
      const expectedStock = currentStock + delta;

      if (expectedStock < 0) {
        return {
          isMutationIntent: true,
          proposed: false,
          error: `Stock adjustment of ${delta} would result in negative stock (${expectedStock} units). Current stock is ${currentStock}.`,
        };
      }

      const defaultReason = `Inventory adjustment proposed via Copilot (${delta > 0 ? '+' : ''}${delta})`;
      const payload: CopilotActionProposalPayload = {
        actionType: 'ADJUST_INVENTORY',
        entityType: 'Product',
        entityId: targetProduct.id,
        displayTitle: `Adjust Stock for ${targetProduct.name}`,
        details: {
          productId: targetProduct.id,
          productName: targetProduct.name,
          currentStock,
          proposedChange: delta > 0 ? `+${delta}` : `${delta}`,
          expectedStock,
          reason: defaultReason,
        },
        requiredCapability: 'ADJUST_INVENTORY',
      };

      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const insRes = await client.query(
        `INSERT INTO "copilotAction" (id, "adminId", "actionType", "entityType", "entityId", payload, status, "expiresAt", "createdAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'PROPOSED', $6, NOW())
         RETURNING id, "createdAt"`,
        [adminId, payload.actionType, payload.entityType, payload.entityId, JSON.stringify(payload), expiresAt]
      );

      const actionId = insRes.rows[0].id;

      return {
        isMutationIntent: true,
        proposed: true,
        authorized: true,
        action: {
          id: actionId,
          adminId,
          actionType: payload.actionType,
          entityType: payload.entityType,
          entityId: payload.entityId,
          payload,
          status: 'PROPOSED',
          expiresAt,
          createdAt: insRes.rows[0].createdAt,
        },
        proposalCard: {
          actionId,
          actionType: 'ADJUST_INVENTORY',
          title: payload.displayTitle,
          details: payload.details,
          requiredCapability: 'ADJUST_INVENTORY',
          expiresAt,
        },
      };
    }

    return { isMutationIntent: false };
  } finally {
    if (!customClient) {
      (client as pg.PoolClient).release();
    }
  }
}

/**
 * Confirms and executes a proposed CopilotAction inside ONE ATOMIC POSTGRESQL TRANSACTION.
 * Enforces:
 * 1. Fresh RBAC capability check AT EXECUTION TIME.
 * 2. Atomic single-winner proposal consumption (UPDATE status = 'EXECUTING' WHERE status = 'PROPOSED' AND expiresAt > NOW())
 *    to prevent duplicate submissions, concurrent tab races, and replay attacks (one-time proposal consumption / duplicate-submit protection).
 * 3. Authoritative shared business service execution inside the SAME transaction client.
 * 4. Automatic transaction ROLLBACK on mutation error, leaving zero partial state behind.
 */
export async function confirmAndExecuteCopilotAction(options: {
  actionId: string;
  adminId: string;
  customClient?: pg.PoolClient | pg.Client;
}): Promise<ConfirmActionResult> {
  const { actionId, adminId, customClient } = options;
  const client = customClient || (await pool.connect());
  const shouldManageTx = !customClient;

  try {
    await initCopilotActionTable(client);

    // 1. Fresh Admin RBAC Check AT EXECUTION TIME
    const freshAdmin = await getFreshAdmin(adminId, client);
    if (!freshAdmin) {
      return { success: false, actionId, error: 'Admin account not found.', code: 'UNAUTHENTICATED' };
    }

    // 2. Inspect Proposal & Required Capability
    const checkRes = await client.query(
      `SELECT id, "adminId", "actionType", "entityType", "entityId", payload, status, "expiresAt"
       FROM "copilotAction" WHERE id = $1 LIMIT 1`,
      [actionId]
    );

    if (checkRes.rows.length === 0) {
      return { success: false, actionId, error: 'Action proposal not found.', code: 'NOT_FOUND' };
    }

    const actionRow = checkRes.rows[0];
    const payload = (typeof actionRow.payload === 'string' ? JSON.parse(actionRow.payload) : actionRow.payload) as CopilotActionProposalPayload;

    if (!hasAdminCapability(freshAdmin.role, payload.requiredCapability)) {
      return {
        success: false,
        actionId,
        error: `Forbidden: Admin role '${freshAdmin.role}' lacks capability '${payload.requiredCapability}' required for execution.`,
        code: 'FORBIDDEN',
      };
    }

    // Expiration check
    if (new Date() > new Date(actionRow.expiresAt)) {
      await client.query(`UPDATE "copilotAction" SET status = 'EXPIRED' WHERE id = $1`, [actionId]);
      return { success: false, actionId, error: 'Action proposal has expired. Please create a new proposal.', code: 'EXPIRED' };
    }

    if (actionRow.status !== 'PROPOSED') {
      return {
        success: false,
        actionId,
        error: `Action proposal cannot be executed (current status: '${actionRow.status}'). Replay or duplicate-submission blocked.`,
        code: 'ALREADY_EXECUTED',
      };
    }

    // 3. START SINGLE ENCOMPASSING ATOMIC TRANSACTION
    if (shouldManageTx) await client.query('BEGIN');

    try {
      // Claim CopilotAction: PROPOSED -> EXECUTING (Atomic Single Winner Row Lock)
      const updateRes = await client.query(
        `UPDATE "copilotAction"
         SET status = 'EXECUTING', "confirmedAt" = NOW()
         WHERE id = $1 AND "adminId" = $2 AND status = 'PROPOSED' AND "expiresAt" > NOW()
         RETURNING id, status`,
        [actionId, adminId]
      );

      if (updateRes.rows.length === 0) {
        if (shouldManageTx) await client.query('ROLLBACK');
        return {
          success: false,
          actionId,
          error: 'Action proposal cannot be claimed (already claimed, executed, or expired).',
          code: 'ALREADY_EXECUTED',
        };
      }

      // Execute Shared Business Service Mutation inside SAME transaction client
      let executedResult: Record<string, unknown> = {};

      if (payload.actionType === 'ADJUST_INVENTORY') {
        const deltaStr = String(payload.details['proposedChange'] || '0').replace('+', '');
        const delta = parseInt(deltaStr, 10);
        const reason = String(payload.details['reason'] || 'Copilot action');

        const adjRes = await executeInventoryAdjustmentService({
          productId: payload.entityId,
          adminId,
          delta,
          reason,
          source: 'AI_COPILOT',
          customClient: client,
        });

        executedResult = { ...adjRes };
      } else if (payload.actionType === 'REQUEUE_OUTBOX_EVENT') {
        const reason = String(payload.details['reason'] || 'Copilot requeue action');

        const reqRes = await executeOutboxRequeueService({
          eventId: payload.entityId,
          adminId,
          reason,
          source: 'AI_COPILOT',
          customClient: client,
        });

        executedResult = { ...reqRes };
      }

      // Mark CopilotAction COMPLETED in SAME transaction
      await client.query(
        `UPDATE "copilotAction" SET status = 'COMPLETED', "completedAt" = NOW() WHERE id = $1`,
        [actionId]
      );

      if (shouldManageTx) await client.query('COMMIT');

      return {
        success: true,
        actionId,
        actionType: payload.actionType,
        status: 'COMPLETED',
        executedResult,
      };
    } catch (mutationErr: unknown) {
      if (shouldManageTx) await client.query('ROLLBACK').catch(() => {});

      const errMessage = mutationErr instanceof Error ? mutationErr.message : 'Mutation service failed';
      const errCode = (mutationErr as Record<string, unknown>)['code'] as string || 'MUTATION_FAILED';

      return {
        success: false,
        actionId,
        error: errMessage,
        code: errCode,
      };
    }
  } finally {
    if (!customClient) {
      (client as pg.PoolClient).release();
    }
  }
}
