import 'dotenv/config';
import { NextResponse } from 'next/server';
import { getAuthenticatedAdminServer } from '@/lib/admin-auth';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env['DATABASE_URL'],
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Enforces strict CSRF same-origin protection for state-changing admin endpoints.
 * In production: Requires configured APP_URL / NEXT_PUBLIC_APP_URL and fails closed if missing or mismatched.
 * In development: Allows localhost / Host header fallbacks for developer convenience.
 */
function validateSameOrigin(request: Request): boolean {
  const originHeader = request.headers.get('origin');
  const refererHeader = request.headers.get('referer');
  const hostHeader = request.headers.get('host');

  const targetHeader = originHeader || refererHeader;
  if (!targetHeader) {
    // Fail closed if state-changing request has no Origin or Referer header in browser context
    return false;
  }

  let requestOrigin: string;
  try {
    const parsedTarget = new URL(targetHeader);
    requestOrigin = parsedTarget.origin; // Normalized protocol + host + port
  } catch {
    // Fail closed if Origin or Referer is malformed
    return false;
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;

  // In production, require configured trusted origin and fail closed if missing or mismatched
  if (isProduction) {
    if (!configuredAppUrl) {
      console.error('[CSRF Security] Production request blocked: Trusted application origin (APP_URL / NEXT_PUBLIC_APP_URL) is not configured.');
      return false;
    }

    try {
      const canonicalOrigin = new URL(configuredAppUrl).origin;
      return requestOrigin === canonicalOrigin;
    } catch {
      return false;
    }
  }

  // Non-production (development/testing):
  // 1. If trusted origin is explicitly configured, check it first
  if (configuredAppUrl) {
    try {
      const canonicalOrigin = new URL(configuredAppUrl).origin;
      if (requestOrigin === canonicalOrigin) {
        return true;
      }
    } catch {
      // Ignore invalid dev APP_URL gracefully
    }
  }

  // 2. Allow localhost / 127.0.0.1 development fallbacks
  const isLocalhost =
    requestOrigin.startsWith('http://localhost:') ||
    requestOrigin.startsWith('http://127.0.0.1:');
  if (isLocalhost) {
    return true;
  }

  // 3. Fallback to matching request Host header in dev if present
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
  // 1. Authenticate Admin Session Server-Side
  const session = await getAuthenticatedAdminServer();
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized: Valid admin session required.' },
      { status: 401 }
    );
  }

  // 2. CSRF / Same-Origin Protection Strategy
  if (!validateSameOrigin(request)) {
    return NextResponse.json(
      { error: 'Forbidden: Cross-origin state-changing request blocked.' },
      { status: 403 }
    );
  }

  // 3. Extract & Validate Product ID from Route Params
  const { id } = await params;
  if (!id || typeof id !== 'string' || id.trim() === '') {
    return NextResponse.json({ error: 'Product ID is required.' }, { status: 400 });
  }

  const productId = id.trim();

  // 4. Extract & Validate Body Parameters (delta, reason)
  try {
    const body = await request.json();
    const { delta, reason } = body || {};

    if (
      typeof delta !== 'number' ||
      !Number.isInteger(delta) ||
      delta === 0 ||
      !Number.isFinite(delta)
    ) {
      return NextResponse.json(
        { error: 'Validation Error: Adjustment delta must be a non-zero finite integer.' },
        { status: 422 }
      );
    }

    if (typeof reason !== 'string' || reason.trim().length === 0) {
      return NextResponse.json(
        { error: 'Validation Error: Adjustment reason is required.' },
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

    // 5. Execute Atomic Database Transaction with Row Locking
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Row-lock product record to get authoritative previousStock and prevent concurrent update races
      const prodRes = await client.query(
        'SELECT id, stock FROM "product" WHERE id = $1 FOR UPDATE',
        [productId]
      );

      if (prodRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
      }

      const previousStock = prodRes.rows[0].stock;
      const newStock = previousStock + delta;

      // Reject adjustment if resulting stock would be negative
      if (newStock < 0) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          {
            error: 'INSUFFICIENT_STOCK',
            message: `Stock adjustment of ${delta} would result in negative stock (${newStock} units).`,
            currentStock: previousStock,
          },
          { status: 409 }
        );
      }

      // Update product stock snapshot
      await client.query(
        'UPDATE "product" SET stock = $1, "updatedAt" = NOW() WHERE id = $2',
        [newStock, productId]
      );

      // Insert InventoryAdjustment audit record in the SAME transaction
      const auditRes = await client.query(
        `INSERT INTO "inventoryAdjustment" (id, "productId", "adminId", "previousStock", "newStock", delta, reason, "createdAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW())
         RETURNING id, "createdAt"`,
        [productId, session.id, previousStock, newStock, delta, cleanReason]
      );

      await client.query('COMMIT');

      const auditRecord = auditRes.rows[0];

      return NextResponse.json(
        {
          ok: true,
          adjustment: {
            id: auditRecord.id,
            productId,
            adminId: session.id,
            adminEmail: session.email,
            adminName: session.name,
            previousStock,
            newStock,
            delta,
            reason: cleanReason,
            createdAt: auditRecord.createdAt,
          },
        },
        { status: 200 }
      );
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[Admin Stock Adjust Error]', err);
      return NextResponse.json(
        { error: 'An internal error occurred while processing stock adjustment.' },
        { status: 500 }
      );
    } finally {
      client.release();
    }
  } catch {
    return NextResponse.json({ error: 'Malformed JSON payload.' }, { status: 400 });
  }
}
