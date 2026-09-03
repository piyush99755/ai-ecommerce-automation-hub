import 'dotenv/config';
import { NextResponse } from 'next/server';
import { authorizeAdminCapability } from '@/lib/admin-rbac';
import { recordAdminAuditLog } from '@/lib/admin-audit';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env['DATABASE_URL'],
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

const APPROVED_REPLAY_EVENT_TYPES = new Set([
  'PAYMENT_SUCCEEDED',
  'ORDER_PROCESSING_NOTIFICATION',
  'ORDER_SHIPPED_NOTIFICATION',
  'ORDER_DELIVERED_NOTIFICATION',
]);

/**
 * Validates CSRF same-origin policy.
 */
function validateSameOrigin(request: Request): boolean {
  const originHeader = request.headers.get('origin');
  const refererHeader = request.headers.get('referer');
  const hostHeader = request.headers.get('host');

  const targetHeader = originHeader || refererHeader;
  if (!targetHeader) {
    return false;
  }

  let requestOrigin: string;
  try {
    const parsedTarget = new URL(targetHeader);
    requestOrigin = parsedTarget.origin;
  } catch {
    return false;
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;

  if (isProduction) {
    if (!configuredAppUrl) {
      console.error('[CSRF Security] Production requeue blocked: Trusted application origin is unconfigured.');
      return false;
    }

    try {
      const canonicalOrigin = new URL(configuredAppUrl).origin;
      return requestOrigin === canonicalOrigin;
    } catch {
      return false;
    }
  }

  if (configuredAppUrl) {
    try {
      const canonicalOrigin = new URL(configuredAppUrl).origin;
      if (requestOrigin === canonicalOrigin) {
        return true;
      }
    } catch {
      // Ignore
    }
  }

  const isLocalhost =
    requestOrigin.startsWith('http://localhost:') ||
    requestOrigin.startsWith('http://127.0.0.1:');
  if (isLocalhost) {
    return true;
  }

  if (hostHeader) {
    try {
      const cleanHost = hostHeader.split(':')[0].toLowerCase();
      const parsedOriginHost = new URL(requestOrigin).hostname.toLowerCase();
      return cleanHost === parsedOriginHost;
    } catch {
      return false;
    }
  }

  return false;
}

export async function POST(request: Request, { params }: RouteContext) {
  // 1. Central RBAC Authorization Guard (Server Authoritative)
  const auth = await authorizeAdminCapability('REQUEUE_AUTOMATION');
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { admin } = auth;

  // 2. Enforce Strict CSRF / Same-Origin Policy
  if (!validateSameOrigin(request)) {
    return NextResponse.json(
      { error: 'Forbidden: Cross-origin state-changing request blocked.' },
      { status: 403 }
    );
  }

  // 3. Extract & Validate Event ID from Route Context
  const { id } = await params;
  if (!id || typeof id !== 'string' || id.trim() === '') {
    return NextResponse.json({ error: 'Outbox Event ID is required.' }, { status: 400 });
  }

  const eventId = id.trim();

  // 4. Extract & Validate Body (Reason Required)
  try {
    const body = await request.json();
    const { reason } = body || {};

    if (typeof reason !== 'string' || reason.trim().length === 0) {
      return NextResponse.json(
        { error: 'Validation Error: A clear manual recovery reason is required.' },
        { status: 422 }
      );
    }

    const cleanReason = reason.trim();
    if (cleanReason.length > 500) {
      return NextResponse.json(
        { error: 'Validation Error: Reason must not exceed 500 characters.' },
        { status: 422 }
      );
    }

    // 5. Execute Atomic PostgreSQL Transaction (Mutation + Specialized Audit + Central AdminAuditLog)
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Row-lock OutboxEvent record for update
      const eventRes = await client.query(
        'SELECT id, status, "eventType", "aggregateId", "attemptCount" FROM "outboxEvent" WHERE id = $1 FOR UPDATE',
        [eventId]
      );

      if (eventRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Outbox Event not found.' }, { status: 404 });
      }

      const eventRow = eventRes.rows[0];

      if (eventRow.status !== 'FAILED') {
        await client.query('ROLLBACK');
        return NextResponse.json(
          {
            error: 'INELIGIBLE_STATE',
            message: `Outbox event is currently in "${eventRow.status}" status. Only FAILED events can be manually requeued.`,
            currentStatus: eventRow.status,
          },
          { status: 409 }
        );
      }

      if (!APPROVED_REPLAY_EVENT_TYPES.has(eventRow.eventType)) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          {
            error: 'UNAPPROVED_EVENT_TYPE',
            message: `Manual replay is disabled for event type "${eventRow.eventType}" because downstream side effects are not currently proven idempotent in live configuration.`,
            eventType: eventRow.eventType,
          },
          { status: 409 }
        );
      }

      if (eventRow.eventType === 'PAYMENT_SUCCEEDED') {
        const orderRes = await client.query(
          'SELECT status FROM "order" WHERE id = $1',
          [eventRow.aggregateId]
        );

        if (orderRes.rows.length > 0) {
          const orderStatus = orderRes.rows[0].status;
          if (orderStatus !== 'PENDING' && orderStatus !== 'PROCESSING') {
            await client.query('ROLLBACK');
            return NextResponse.json(
              {
                error: 'ORDER_STATE_TERMINAL',
                message: `Manual replay disabled because this order has progressed beyond the fulfillment stage (current status: "${orderStatus}").`,
                orderStatus,
              },
              { status: 409 }
            );
          }
        }
      }

      if (
        eventRow.eventType === 'ORDER_PROCESSING_NOTIFICATION' ||
        eventRow.eventType === 'ORDER_SHIPPED_NOTIFICATION' ||
        eventRow.eventType === 'ORDER_DELIVERED_NOTIFICATION'
      ) {
        const ceRes = await client.query(
          'SELECT id, status, "claimedAt" FROM "consumerEvent" WHERE "consumerId" = \'email-notifier\' AND "eventId" = $1',
          [eventRow.id]
        );

        if (ceRes.rows.length > 0) {
          const ce = ceRes.rows[0];
          if (ce.status === 'PROCESSING') {
            const claimedAtTime = new Date(ce.claimedAt).getTime();
            const isStale = Date.now() - claimedAtTime >= 5 * 60 * 1000;
            await client.query('ROLLBACK');
            return NextResponse.json(
              {
                error: 'CONSUMER_PROCESSING_LOCK',
                message: isStale
                  ? 'Manual replay disabled because the email consumer has an unresolved stale processing claim and duplicate delivery cannot be ruled out.'
                  : 'Manual replay disabled while the email consumer is actively processing this event.',
              },
              { status: 409 }
            );
          }
        }
      }

      const previousStatus = eventRow.status;
      const previousAttemptCount = eventRow.attemptCount;

      await client.query(
        `UPDATE "outboxEvent"
         SET status = 'PENDING',
             "attemptCount" = 0,
             "nextAttemptAt" = NOW()
         WHERE id = $1`,
        [eventId]
      );

      // 1. Insert OutboxRecoveryAction specialized audit record
      const auditRes = await client.query(
        `INSERT INTO "outboxRecoveryAction" (id, "outboxEventId", "adminId", action, "previousStatus", "previousAttemptCount", reason, "createdAt")
         VALUES (gen_random_uuid(), $1, $2, 'REQUEUE', $3, $4, $5, NOW())
         RETURNING id, "createdAt"`,
        [eventId, admin.id, previousStatus, previousAttemptCount, cleanReason]
      );

      // 2. Insert Centralized AdminAuditLog in SAME transaction
      await recordAdminAuditLog(
        {
          adminId: admin.id,
          action: 'OUTBOX_EVENT_REQUEUED',
          entityType: 'OutboxEvent',
          entityId: eventId,
          metadata: {
            outboxEventId: eventId,
            eventType: eventRow.eventType,
            previousStatus,
            previousAttemptCount,
            recoveryReason: cleanReason,
          },
        },
        client
      );

      await client.query('COMMIT');

      const auditRecord = auditRes.rows[0];

      return NextResponse.json(
        {
          ok: true,
          message: 'Event successfully requeued for background worker processing.',
          recoveryAction: {
            id: auditRecord.id,
            outboxEventId: eventId,
            adminId: admin.id,
            adminEmail: admin.email,
            adminName: admin.name,
            action: 'REQUEUE',
            previousStatus,
            previousAttemptCount,
            reason: cleanReason,
            createdAt: auditRecord.createdAt,
          },
        },
        { status: 200 }
      );
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[Admin Requeue Error]', err);
      return NextResponse.json(
        { error: 'An internal error occurred processing event requeue.' },
        { status: 500 }
      );
    } finally {
      client.release();
    }
  } catch {
    return NextResponse.json({ error: 'Malformed JSON payload.' }, { status: 400 });
  }
}
