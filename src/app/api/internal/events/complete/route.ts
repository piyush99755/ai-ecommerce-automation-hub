import { db } from '@/prisma/db';
import { NextResponse } from 'next/server';
import { authenticateAutomationSecret } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    // 1. Authenticate Automation Secret
    const authError = authenticateAutomationSecret(request);
    if (authError) {
      return authError;
    }

    // 3. Parse request body
    const body = await request.json();
    const { eventId, consumerId, lastError } = body;

    if (!eventId || typeof eventId !== 'string' || !eventId.trim()) {
      return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
    }

    if (!consumerId || typeof consumerId !== 'string' || !consumerId.trim()) {
      return NextResponse.json({ error: 'consumerId is required' }, { status: 400 });
    }

    const cleanEventId = eventId.trim();
    const cleanConsumerId = consumerId.trim();
    const nowIso = new Date().toISOString();

    // 4. Mark ConsumerEvent as COMPLETED in PostgreSQL
    const completeResult = await db.transaction(async (tx) => {
      const existingRecord = await tx.orm.public.ConsumerEvent.where({
        consumerId: cleanConsumerId,
        eventId: cleanEventId,
      }).first();

      if (!existingRecord) {
        // Create as COMPLETED directly if no prior claim row existed
        const newRecord = await tx.orm.public.ConsumerEvent.create({
          consumerId: cleanConsumerId,
          eventId: cleanEventId,
          status: 'COMPLETED',
          attemptCount: 1,
          claimedAt: nowIso,
          completedAt: nowIso,
          lastError: lastError ? String(lastError) : null,
        });

        return {
          success: true,
          status: 'COMPLETED',
          consumerId: cleanConsumerId,
          eventId: cleanEventId,
          completedAt: newRecord.completedAt,
        };
      }

      // Update existing claim row to COMPLETED status
      await tx.orm.public.ConsumerEvent.where({ id: existingRecord.id }).update({
        status: 'COMPLETED',
        completedAt: nowIso,
        lastError: lastError ? String(lastError) : existingRecord.lastError,
      });

      return {
        success: true,
        status: 'COMPLETED',
        consumerId: cleanConsumerId,
        eventId: cleanEventId,
        completedAt: nowIso,
      };
    });

    return NextResponse.json(completeResult, { status: 200 });
  } catch (error: unknown) {
    console.error('[internal-api] Unexpected error marking consumer event complete:', error);
    return NextResponse.json(
      { error: 'An unexpected internal error occurred.' },
      { status: 500 }
    );
  }
}
