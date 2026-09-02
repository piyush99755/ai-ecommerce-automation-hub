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

export { formatCurrencyCents };
