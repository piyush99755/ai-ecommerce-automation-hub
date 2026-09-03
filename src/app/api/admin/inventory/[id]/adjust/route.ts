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

/**
 * Enforces strict CSRF same-origin protection for state-changing admin endpoints.
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
      console.error('[CSRF Security] Production request blocked: Trusted application origin is not configured.');
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
  const auth = await authorizeAdminCapability('ADJUST_INVENTORY');
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { admin } = auth;

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

    // 5. Execute Atomic Database Transaction (Mutation + Specialized Audit + Central AdminAuditLog)
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

      // 1. Insert InventoryAdjustment specialized audit record in SAME transaction
      const auditRes = await client.query(
        `INSERT INTO "inventoryAdjustment" (id, "productId", "adminId", "previousStock", "newStock", delta, reason, "createdAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW())
         RETURNING id, "createdAt"`,
        [productId, admin.id, previousStock, newStock, delta, cleanReason]
      );

      // 2. Insert Centralized AdminAuditLog in SAME transaction
      await recordAdminAuditLog(
        {
          adminId: admin.id,
          action: 'INVENTORY_ADJUSTED',
          entityType: 'Product',
          entityId: productId,
          metadata: {
            productId,
            delta,
            previousStock,
            newStock,
            reason: cleanReason,
          },
        },
        client
      );

      await client.query('COMMIT');

      const auditRecord = auditRes.rows[0];

      return NextResponse.json(
        {
          ok: true,
          adjustment: {
            id: auditRecord.id,
            productId,
            adminId: admin.id,
            adminEmail: admin.email,
            adminName: admin.name,
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
