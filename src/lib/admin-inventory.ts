import pg from 'pg';
import { db } from '@/prisma/db';
import { formatCurrencyCents } from './admin-dashboard';

export type InventoryState = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface ProductInventoryListItem {
  id: string;
  name: string;
  slug: string;
  category: string;
  priceCents: number;
  stock: number;
  lowStockThreshold: number;
  state: InventoryState;
  updatedAt: string;
}

export interface InventoryMetricsSummary {
  totalProducts: number;
  inStockProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  totalUnitsOnHand: number;
}

export interface PaginatedInventoryResult {
  items: ProductInventoryListItem[];
  metrics: InventoryMetricsSummary;
  categories: string[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Calculates inventory state classification strictly based on PostgreSQL stock and threshold.
 */
export function getInventoryState(stock: number, lowStockThreshold: number): InventoryState {
  if (stock <= 0) return 'OUT_OF_STOCK';
  if (stock <= lowStockThreshold) return 'LOW_STOCK';
  return 'IN_STOCK';
}

/**
 * Fetches paginated inventory products and computes operational inventory metrics.
 *
 * SCALE NOTE:
 * Current in-memory aggregation is appropriate for the present demo dataset; larger deployments should use database-side aggregation and pagination.
 */
export async function fetchAdminInventory(params: {
  q?: string;
  state?: string;
  category?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedInventoryResult> {
  const q = (params.q || '').trim().toLowerCase();
  const stateFilter = (params.state || 'ALL').toUpperCase();
  const categoryFilter = (params.category || 'ALL').toUpperCase();
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.max(1, Math.min(50, Number(params.pageSize) || 10));

  const products = await db.orm.public.Product.all();

  // Top-level Operational Metrics
  const totalProducts = products.length;
  let inStockProducts = 0;
  let lowStockProducts = 0;
  let outOfStockProducts = 0;
  let totalUnitsOnHand = 0;

  const categorySet = new Set<string>();

  const itemsAll: ProductInventoryListItem[] = products.map((p) => {
    categorySet.add(p.category);
    totalUnitsOnHand += Math.max(0, p.stock);

    const state = getInventoryState(p.stock, p.lowStockThreshold);

    if (state === 'IN_STOCK') inStockProducts++;
    if (state === 'LOW_STOCK') lowStockProducts++;
    if (state === 'OUT_OF_STOCK') outOfStockProducts++;

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      category: p.category,
      priceCents: p.priceCents,
      stock: p.stock,
      lowStockThreshold: p.lowStockThreshold,
      state,
      updatedAt: p.updatedAt,
    };
  });

  const metrics: InventoryMetricsSummary = {
    totalProducts,
    inStockProducts,
    lowStockProducts,
    outOfStockProducts,
    totalUnitsOnHand,
  };

  // Filter products
  const filtered = itemsAll.filter((item) => {
    // State Filter
    if (stateFilter !== 'ALL' && item.state !== stateFilter) {
      return false;
    }

    // Category Filter
    if (categoryFilter !== 'ALL' && item.category.toUpperCase() !== categoryFilter) {
      return false;
    }

    // Search Query Filter (Name or Slug)
    if (q.length > 0) {
      const matchName = item.name.toLowerCase().includes(q);
      const matchSlug = item.slug.toLowerCase().includes(q);
      if (!matchName && !matchSlug) return false;
    }

    return true;
  });

  // Sort: Lowest stock / highest urgency first, then name
  filtered.sort((a, b) => {
    if (a.stock !== b.stock) {
      return a.stock - b.stock;
    }
    return a.name.localeCompare(b.name);
  });

  const totalCount = filtered.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const items = filtered.slice(startIndex, startIndex + pageSize);

  return {
    items,
    metrics,
    categories: Array.from(categorySet).sort(),
    totalCount,
    page: currentPage,
    pageSize,
    totalPages,
  };
}

export interface AdjustInventoryServiceOptions {
  productId: string;
  adminId: string;
  delta: number;
  reason: string;
  source?: string;
  customClient?: pg.PoolClient | pg.Client;
}

const pool = new pg.Pool({
  connectionString: process.env['DATABASE_URL'],
});

/**
 * Atomic inventory adjustment service.
 * Enforces row locking (FOR UPDATE), negative stock prevention, InventoryAdjustment specialized audit,
 * and centralized AdminAuditLog entry in a single PostgreSQL transaction.
 */
export async function executeInventoryAdjustmentService(options: AdjustInventoryServiceOptions) {
  const { productId, adminId, delta, reason, source = 'ADMIN_CONSOLE', customClient } = options;

  if (typeof delta !== 'number' || !Number.isInteger(delta) || delta === 0 || !Number.isFinite(delta)) {
    throw new Error('Validation Error: Adjustment delta must be a non-zero finite integer.');
  }

  const cleanReason = (reason || '').trim();
  if (!cleanReason) {
    throw new Error('Validation Error: Adjustment reason is required.');
  }

  const client = customClient || (await pool.connect());
  const shouldManageTx = !customClient;

  try {
    if (shouldManageTx) await client.query('BEGIN');

    // Row-lock product record to get authoritative previousStock and prevent concurrent update races
    const prodRes = await client.query(
      'SELECT id, name, stock FROM "product" WHERE id = $1 FOR UPDATE',
      [productId]
    );

    if (prodRes.rows.length === 0) {
      if (shouldManageTx) await client.query('ROLLBACK');
      throw new Error('Product not found');
    }

    const productName = prodRes.rows[0].name;
    const previousStock = prodRes.rows[0].stock;
    const newStock = previousStock + delta;

    if (newStock < 0) {
      if (shouldManageTx) await client.query('ROLLBACK');
      const err = new Error(`Stock adjustment of ${delta} would result in negative stock (${newStock} units).`);
      (err as unknown as Record<string, unknown>)['code'] = 'INSUFFICIENT_STOCK';
      throw err;
    }

    // Update product stock snapshot
    await client.query(
      'UPDATE "product" SET stock = $1, "updatedAt" = NOW() WHERE id = $2',
      [newStock, productId]
    );

    // Insert InventoryAdjustment specialized audit record
    const auditRes = await client.query(
      `INSERT INTO "inventoryAdjustment" (id, "productId", "adminId", "previousStock", "newStock", delta, reason, "createdAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW())
       RETURNING id, "createdAt"`,
      [productId, adminId, previousStock, newStock, delta, cleanReason]
    );

    // Insert Centralized AdminAuditLog in SAME transaction
    await client.query(
      `INSERT INTO "adminAuditLog" (id, "adminId", action, "entityType", "entityId", metadata, "createdAt")
       VALUES (gen_random_uuid(), $1, 'INVENTORY_ADJUSTED', 'Product', $2, $3, NOW())`,
      [
        adminId,
        productId,
        JSON.stringify({
          productId,
          productName,
          delta,
          previousStock,
          newStock,
          reason: cleanReason,
          source,
        }),
      ]
    );

    if (shouldManageTx) await client.query('COMMIT');

    return {
      success: true,
      adjustmentId: auditRes.rows[0].id,
      productId,
      productName,
      previousStock,
      newStock,
      delta,
      reason: cleanReason,
      createdAt: auditRes.rows[0].createdAt,
    };
  } catch (err) {
    if (shouldManageTx) await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    if (shouldManageTx) (client as pg.PoolClient).release();
  }
}

export { formatCurrencyCents };
