import { NextResponse } from 'next/server';
import { authenticateAutomationSecret } from '@/lib/auth';
import { processOutboxEvents } from '@/lib/outbox';

export async function POST(request: Request) {
  try {
    // 1. Authenticate Automation Secret
    const authError = authenticateAutomationSecret(request);
    if (authError) {
      return authError;
    }

    // 2. Parse optional batchSize parameter from body
    let batchSize = 10;
    try {
      const body = await request.json();
      if (typeof body.batchSize === 'number' && body.batchSize > 0) {
        batchSize = Math.min(body.batchSize, 50); // Cap batch size to 50
      }
    } catch {
      // Body optional
    }

    // 3. Process Outbox Events
    const result = await processOutboxEvents(batchSize);

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    console.error('[internal-api] Unexpected error processing outbox events:', error);
    return NextResponse.json(
      { error: 'An unexpected internal error occurred.' },
      { status: 500 }
    );
  }
}
