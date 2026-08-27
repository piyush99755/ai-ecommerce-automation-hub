import { db } from '@/prisma/db';
import { NextResponse } from 'next/server';
import { authenticateAutomationSecret } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    // 1. Authenticate Automation Secret
    const authError = authenticateAutomationSecret(request);
    if (authError) {
      return authError;
    }

    // 2. Parse optional status query filter (defaults to FAILED if not specified)
    const { searchParams } = new URL(request.url);
    const statusFilterParam = searchParams.get('status')?.trim().toUpperCase();
    const statusFilter = statusFilterParam || 'FAILED';

    // 3. Fetch Outbox Events from PostgreSQL
    const allEvents = await db.orm.public.OutboxEvent.all();

    // 4. Map to Operational Metadata Payload (zero PII, zero secrets)
    const mappedEvents = allEvents
      .filter((e) => statusFilter === 'ALL' || e.status === statusFilter)
      .map((e) => ({
        eventId: e.id,
        eventType: e.eventType,
        aggregateType: e.aggregateType,
        aggregateId: e.aggregateId,
        status: e.status,
        attemptCount: e.attemptCount,
        lastAttemptAt: e.lastAttemptAt,
        nextAttemptAt: e.nextAttemptAt,
        deliveredAt: e.deliveredAt,
        lastError: e.lastError,
        createdAt: e.createdAt,
      }));

    return NextResponse.json(mappedEvents, { status: 200 });
  } catch (error: unknown) {
    console.error('[internal-api] Unexpected error fetching outbox events:', error);
    return NextResponse.json(
      { error: 'An unexpected internal error occurred.' },
      { status: 500 }
    );
  }
}
