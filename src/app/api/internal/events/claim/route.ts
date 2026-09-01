import { db } from '@/prisma/db';
import { NextResponse } from 'next/server';
import { authenticateAutomationSecret } from '@/lib/auth';

const STALE_LEASE_MS = 5 * 60 * 1000; // Conservative 5-minute processing lease (covers worker lifetime & latency)

export async function POST(request: Request) {
  try {
    // 1. Authenticate Automation Secret
    const authError = authenticateAutomationSecret(request);
    if (authError) {
      return authError;
    }

    // 3. Parse request body
    const body = await request.json();
    const { eventId, consumerId } = body;

    if (!eventId || typeof eventId !== 'string' || !eventId.trim()) {
      return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
    }

    if (!consumerId || typeof consumerId !== 'string' || !consumerId.trim()) {
      return NextResponse.json({ error: 'consumerId is required' }, { status: 400 });
    }

    const cleanEventId = eventId.trim();
    const cleanConsumerId = consumerId.trim();
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    // 4. Execute Atomic Database Transaction to Claim Event
    const claimResult = await db.transaction(async (tx) => {
      const existingRecord = await tx.orm.public.ConsumerEvent.where({
        consumerId: cleanConsumerId,
        eventId: cleanEventId,
      }).first();

      if (existingRecord) {
        // Case A: Event already COMPLETED -> Safe duplicate, return 200 OK (canProcess: false)
        if (existingRecord.status === 'COMPLETED') {
          return {
            statusCode: 200,
            payload: {
              canProcess: false,
              status: 'COMPLETED',
              consumerId: cleanConsumerId,
              eventId: cleanEventId,
              completedAt: existingRecord.completedAt,
            },
          };
        }

        // Case B: Event currently PROCESSING -> Check 5-minute lease timestamp
        const claimedAtMs = existingRecord.claimedAt
          ? new Date(existingRecord.claimedAt).getTime()
          : 0;

        if (nowMs - claimedAtMs < STALE_LEASE_MS) {
          // Active lease in progress -> Return 409 Conflict to signal non-completion to caller
          return {
            statusCode: 409,
            payload: {
              canProcess: false,
              status: 'IN_PROGRESS',
              error: 'Active processing lease lock',
              consumerId: cleanConsumerId,
              eventId: cleanEventId,
              claimedAt: existingRecord.claimedAt,
            },
          };
        }

        // Case C: Stale lease timeout (>= 5 mins) -> Re-claim event for retry
        const newAttemptCount = existingRecord.attemptCount + 1;
        await tx.orm.public.ConsumerEvent.where({ id: existingRecord.id }).update({
          status: 'PROCESSING',
          claimedAt: nowIso,
          attemptCount: newAttemptCount,
        });

        return {
          statusCode: 200,
          payload: {
            canProcess: true,
            status: 'RECLAIMED',
            consumerId: cleanConsumerId,
            eventId: cleanEventId,
            attemptCount: newAttemptCount,
          },
        };
      }

      // Case D: First claim attempt -> Create new ConsumerEvent record in PROCESSING status
      try {
        await tx.orm.public.ConsumerEvent.create({
          consumerId: cleanConsumerId,
          eventId: cleanEventId,
          status: 'PROCESSING',
          attemptCount: 1,
          claimedAt: nowIso,
        });

        return {
          statusCode: 200,
          payload: {
            canProcess: true,
            status: 'CLAIMED',
            consumerId: cleanConsumerId,
            eventId: cleanEventId,
            attemptCount: 1,
          },
        };
      } catch (insertErr: unknown) {
        // Handle concurrent insert race condition (unique constraint violation)
        console.warn(`[events/claim] Unique constraint race condition for ${cleanConsumerId}/${cleanEventId}:`, insertErr);
        return {
          statusCode: 409,
          payload: {
            canProcess: false,
            status: 'IN_PROGRESS',
            error: 'Concurrent claim race condition',
            consumerId: cleanConsumerId,
            eventId: cleanEventId,
          },
        };
      }
    });

    return NextResponse.json(claimResult.payload, { status: claimResult.statusCode });
  } catch (error: unknown) {
    console.error('[internal-api] Unexpected error claiming consumer event:', error);
    return NextResponse.json(
      { error: 'An unexpected internal error occurred.' },
      { status: 500 }
    );
  }
}
