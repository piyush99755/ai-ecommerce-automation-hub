import { db } from '@/prisma/db';

export interface ProcessOutboxResult {
  success: boolean;
  processed: number;
  delivered: number;
  retryScheduled: number;
  failed: number;
}

const RETRY_BACKOFF_MS = [
  60 * 1000,        // Attempt 1 -> 1 minute
  5 * 60 * 1000,    // Attempt 2 -> 5 minutes
  15 * 60 * 1000,   // Attempt 3 -> 15 minutes
  60 * 60 * 1000,   // Attempt 4 -> 60 minutes
];

const MAX_ATTEMPTS = 5;
export const STALE_PROCESSING_LEASE_MS = 5 * 60 * 1000; // 5 minutes lease timeout

export function resolveWebhookUrlForEventType(eventType: string): string | null {
  if (eventType === 'PAYMENT_SUCCEEDED') {
    return process.env.N8N_PAYMENT_SUCCEEDED_WEBHOOK_URL || process.env.N8N_ORDER_CREATED_WEBHOOK_URL || null;
  }
  if (eventType === 'INVENTORY_UPDATED') {
    return process.env.N8N_INVENTORY_UPDATED_WEBHOOK_URL || process.env.N8N_ORDER_CREATED_WEBHOOK_URL || null;
  }
  if (eventType === 'ORDER_STATUS_UPDATED') {
    return process.env.N8N_ORDER_STATUS_WEBHOOK_URL || process.env.N8N_ORDER_CREATED_WEBHOOK_URL || null;
  }
  return process.env.N8N_ORDER_CREATED_WEBHOOK_URL || null;
}

export async function processOutboxEvents(batchSize: number = 10): Promise<ProcessOutboxResult> {
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  // 1. Claim eligible events inside a database transaction to prevent concurrent dual-processing
  const claimedEvents = await db.transaction(async (tx) => {
    const allEvents = await tx.orm.public.OutboxEvent.all();

    // Filter eligible candidate events:
    // - PENDING: nextAttemptAt is null or <= nowMs
    // - PROCESSING: lastAttemptAt is older than STALE_PROCESSING_LEASE_MS (stale claim recovery)
    const eligibleEvents = allEvents
      .filter((e) => {
        if (e.status === 'DELIVERED' || e.status === 'FAILED') return false;

        if (e.status === 'PENDING') {
          if (!e.nextAttemptAt) return true;
          const nextMs = new Date(e.nextAttemptAt).getTime();
          return nextMs <= nowMs;
        }

        if (e.status === 'PROCESSING') {
          // Stale processing recovery check: Only claim if lastAttemptAt is older than 5 minutes
          if (!e.lastAttemptAt) return true;
          const lastAttemptMs = new Date(e.lastAttemptAt).getTime();
          return lastAttemptMs + STALE_PROCESSING_LEASE_MS <= nowMs;
        }

        return false;
      })
      .slice(0, batchSize);

    if (eligibleEvents.length === 0) {
      return [];
    }

    const claimedList = [];
    const leaseExpiryIso = new Date(nowMs + STALE_PROCESSING_LEASE_MS).toISOString();

    for (const event of eligibleEvents) {
      // Re-inspect row state inside transaction lock to verify no concurrent worker claimed it
      const freshRow = await tx.orm.public.OutboxEvent.where({ id: event.id }).first();
      if (!freshRow) continue;

      if (freshRow.status === 'DELIVERED' || freshRow.status === 'FAILED') continue;

      if (freshRow.status === 'PROCESSING' && freshRow.lastAttemptAt) {
        const freshLastAttemptMs = new Date(freshRow.lastAttemptAt).getTime();
        if (freshLastAttemptMs + STALE_PROCESSING_LEASE_MS > nowMs) {
          // Row was recently claimed by another active worker within 5-minute lease boundary
          continue;
        }
      }

      // Atomically claim event by setting status to PROCESSING and advancing lease
      await tx.orm.public.OutboxEvent.where({ id: event.id }).update({
        status: 'PROCESSING',
        lastAttemptAt: nowIso,
        nextAttemptAt: leaseExpiryIso,
      });

      claimedList.push(event);
    }

    return claimedList;
  });

  if (claimedEvents.length === 0) {
    return { success: true, processed: 0, delivered: 0, retryScheduled: 0, failed: 0 };
  }

  let deliveredCount = 0;
  let retryScheduledCount = 0;
  let failedCount = 0;

  // 2. Deliver claimed events out-of-transaction (never hold DB locks during external HTTP calls)
  for (const event of claimedEvents) {
    const webhookUrl = resolveWebhookUrlForEventType(event.eventType);
    const newAttemptCount = event.attemptCount + 1;
    const attemptTimeIso = new Date().toISOString();

    // Prepare payload envelope with stable eventId
    let payloadEnvelope: Record<string, unknown> = {};
    if (typeof event.payload === 'string') {
      try {
        payloadEnvelope = JSON.parse(event.payload);
      } catch {
        payloadEnvelope = { raw: event.payload };
      }
    } else if (typeof event.payload === 'object' && event.payload !== null) {
      payloadEnvelope = { ...(event.payload as Record<string, unknown>) };
    }
    payloadEnvelope.eventId = event.id;

    if (!webhookUrl || webhookUrl.trim() === '') {
      const lastError = `Webhook URL not configured for eventType "${event.eventType}"`;
      console.warn(`[outbox] Event ${event.id} failed attempt ${newAttemptCount}: ${lastError}`);

      if (newAttemptCount >= MAX_ATTEMPTS) {
        await db.orm.public.OutboxEvent.where({ id: event.id }).update({
          status: 'FAILED',
          attemptCount: newAttemptCount,
          lastAttemptAt: attemptTimeIso,
          nextAttemptAt: null,
          lastError,
        });
        failedCount++;
      } else {
        const backoffMs = RETRY_BACKOFF_MS[newAttemptCount - 1] || 60 * 60 * 1000;
        const nextAttemptIso = new Date(Date.now() + backoffMs).toISOString();

        await db.orm.public.OutboxEvent.where({ id: event.id }).update({
          status: 'PENDING',
          attemptCount: newAttemptCount,
          lastAttemptAt: attemptTimeIso,
          nextAttemptAt: nextAttemptIso,
          lastError,
        });
        retryScheduledCount++;
      }
      continue;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(webhookUrl.trim(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payloadEnvelope),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        await db.orm.public.OutboxEvent.where({ id: event.id }).update({
          status: 'DELIVERED',
          deliveredAt: new Date().toISOString(),
          attemptCount: newAttemptCount,
          lastAttemptAt: attemptTimeIso,
          nextAttemptAt: null,
          lastError: null,
        });
        deliveredCount++;
        console.log(`[outbox] Event ${event.id} (${event.eventType}) DELIVERED successfully to n8n.`);
      } else {
        const lastError = `HTTP ${response.status}: ${response.statusText || 'Delivery Failed'}`;
        console.warn(`[outbox] Event ${event.id} failed attempt ${newAttemptCount}: ${lastError}`);

        if (newAttemptCount >= MAX_ATTEMPTS) {
          await db.orm.public.OutboxEvent.where({ id: event.id }).update({
            status: 'FAILED',
            attemptCount: newAttemptCount,
            lastAttemptAt: attemptTimeIso,
            nextAttemptAt: null,
            lastError,
          });
          failedCount++;
        } else {
          const backoffMs = RETRY_BACKOFF_MS[newAttemptCount - 1] || 60 * 60 * 1000;
          const nextAttemptIso = new Date(Date.now() + backoffMs).toISOString();

          await db.orm.public.OutboxEvent.where({ id: event.id }).update({
            status: 'PENDING',
            attemptCount: newAttemptCount,
            lastAttemptAt: attemptTimeIso,
            nextAttemptAt: nextAttemptIso,
            lastError,
          });
          retryScheduledCount++;
        }
      }
    } catch (err: unknown) {
      const rawErrorMsg = err instanceof Error ? err.message : 'Network error during delivery';
      const lastError = rawErrorMsg.substring(0, 250);
      console.warn(`[outbox] Event ${event.id} exception attempt ${newAttemptCount}: ${lastError}`);

      if (newAttemptCount >= MAX_ATTEMPTS) {
        await db.orm.public.OutboxEvent.where({ id: event.id }).update({
          status: 'FAILED',
          attemptCount: newAttemptCount,
          lastAttemptAt: attemptTimeIso,
          nextAttemptAt: null,
          lastError,
        });
        failedCount++;
      } else {
        const backoffMs = RETRY_BACKOFF_MS[newAttemptCount - 1] || 60 * 60 * 1000;
        const nextAttemptIso = new Date(Date.now() + backoffMs).toISOString();

        await db.orm.public.OutboxEvent.where({ id: event.id }).update({
          status: 'PENDING',
          attemptCount: newAttemptCount,
          lastAttemptAt: attemptTimeIso,
          nextAttemptAt: nextAttemptIso,
          lastError,
        });
        retryScheduledCount++;
      }
    }
  }

  return {
    success: true,
    processed: claimedEvents.length,
    delivered: deliveredCount,
    retryScheduled: retryScheduledCount,
    failed: failedCount,
  };
}
