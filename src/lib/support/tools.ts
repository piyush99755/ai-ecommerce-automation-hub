import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { getInventoryState, InventoryState } from '../admin-inventory';

const pool = new pg.Pool({
  connectionString: process.env['DATABASE_URL'],
});

// --- TOOL 1: Grounded Product Lookup Tool ---

export interface SafeProductResult {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  priceCents: number;
  stock: number;
  inventoryState: InventoryState;
}

/**
 * Server-only product search querying authoritative PostgreSQL Product data.
 * Bound to maximum 5 results. Only safe public fields are returned.
 */
export async function searchProducts(
  query: string,
  customClient?: pg.PoolClient | pg.Client
): Promise<SafeProductResult[]> {
  const client = customClient || (await pool.connect());
  const cleanQuery = (query || '').trim();

  try {
    let sql: string;
    let params: unknown[];

    if (cleanQuery.length === 0) {
      sql = `SELECT id, name, slug, category, description, "priceCents", stock, "lowStockThreshold" 
             FROM "product" 
             ORDER BY stock DESC 
             LIMIT 5`;
      params = [];
    } else {
      sql = `SELECT id, name, slug, category, description, "priceCents", stock, "lowStockThreshold" 
             FROM "product" 
             WHERE name ILIKE $1 OR description ILIKE $1 OR category ILIKE $1 OR slug ILIKE $1 
             ORDER BY stock DESC 
             LIMIT 5`;
      params = [`%${cleanQuery}%`];
    }

    const res = await client.query(sql, params);

    return res.rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      category: row.category,
      description: row.description,
      priceCents: row.priceCents,
      stock: row.stock,
      inventoryState: getInventoryState(row.stock, row.lowStockThreshold),
    }));
  } finally {
    if (!customClient) {
      (client as pg.PoolClient).release();
    }
  }
}

// --- TOOL 2: Support Knowledge Retrieval (RAG Foundation) ---

export interface SupportKnowledgeResult {
  sourceId: string;
  title: string;
  relevantExcerpt: string;
  score: number;
}

const SUPPORT_DOCS_DIR = path.join(process.cwd(), 'src', 'content', 'support');

/**
 * Keyword-scored RAG retrieval over structured markdown policy documents in src/content/support/.
 * Designed as a modular interface so vector embeddings can replace token scoring later.
 */
export async function retrieveSupportKnowledge(
  query: string
): Promise<SupportKnowledgeResult[]> {
  const cleanQuery = (query || '').toLowerCase().trim();
  const tokens = cleanQuery.split(/\s+/).filter((t) => t.length > 2);

  if (!fs.existsSync(SUPPORT_DOCS_DIR)) {
    return [];
  }

  const files = fs.readdirSync(SUPPORT_DOCS_DIR).filter((f) => f.endsWith('.md'));
  const results: SupportKnowledgeResult[] = [];

  for (const file of files) {
    const filePath = path.join(SUPPORT_DOCS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const sourceId = file.replace('.md', '');

    const lines = content.split('\n');
    const titleLine = lines.find((l) => l.startsWith('#')) || `# ${sourceId}`;
    const title = titleLine.replace(/^#+\s*/, '').trim();

    const lowerContent = content.toLowerCase();

    let score = 0;
    for (const token of tokens) {
      const occurrences = (lowerContent.match(new RegExp(token, 'g')) || []).length;
      score += occurrences;
      if (title.toLowerCase().includes(token)) {
        score += 3; // Title match bonus
      }
    }

    if (score > 0 || cleanQuery.length === 0) {
      // Extract relevant lines or summary
      const excerpt = lines
        .filter((l) => !l.startsWith('#') && l.trim().length > 0)
        .slice(0, 4)
        .join(' ');

      results.push({
        sourceId,
        title,
        relevantExcerpt: excerpt.length > 300 ? excerpt.slice(0, 300) + '...' : excerpt,
        score: score || 1,
      });
    }
  }

  // Sort highest score first, return top 3
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 3);
}

// --- TOOL 3: Secure Order Lookup Tool ---

export interface SafeOrderSummary {
  orderId: string;
  shortId: string;
  status: string;
  customerStatusExplanation: string;
  paymentStatus: string;
  createdAt: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  itemsSummary: Array<{
    productName: string;
    quantity: number;
    unitPriceCents: number;
  }>;
}

export type OrderLookupResult =
  | { authorized: true; summary: SafeOrderSummary }
  | { authorized: false; error: string };

/**
 * Customer-friendly explanations of internal order states.
 */
export function getCustomerStatusExplanation(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'Order created and received; awaiting payment confirmation or initial fulfillment processing.';
    case 'PROCESSING':
      return 'Payment confirmed; order is currently being prepared for shipping.';
    case 'SHIPPED':
      return 'Your order has been marked as shipped.';
    case 'DELIVERED':
      return 'Your order has been marked as delivered.';
    case 'ON_HOLD':
      return 'Order requires additional verification. Please contact support.';
    case 'CANCELLED':
      return 'Order has been marked as cancelled.';
    default:
      return `Order status: ${status}.`;
  }
}

/**
 * Secure Order Lookup requiring BOTH orderId AND matching sessionId proof.
 * Reuses the storefront security model. Prevents leaking arbitrary order existence.
 */
export async function getAuthorizedOrderSummary(
  orderId: string,
  sessionId?: string | null,
  customClient?: pg.PoolClient | pg.Client
): Promise<OrderLookupResult> {
  const cleanOrderId = (orderId || '').trim();
  const cleanSessionId = (sessionId || '').trim();

  if (!cleanOrderId || !cleanSessionId) {
    return {
      authorized: false,
      error: 'Access Denied: Both Order ID and matching Checkout Session ID proof are required to access order details.',
    };
  }

  const client = customClient || (await pool.connect());

  try {
    const orderRes = await client.query(
      `SELECT id, status, "paymentStatus", "stripeCheckoutSessionId", "createdAt", "updatedAt"
       FROM "order"
       WHERE id = $1 LIMIT 1`,
      [cleanOrderId]
    );

    if (orderRes.rows.length === 0) {
      return {
        authorized: false,
        error: 'Access Denied: Valid Order ID and matching Checkout Session ID proof are required.',
      };
    }

    const orderRow = orderRes.rows[0];

    // Strict Security Proof: Session ID must match stored stripeCheckoutSessionId
    if (!orderRow.stripeCheckoutSessionId || orderRow.stripeCheckoutSessionId !== cleanSessionId) {
      return {
        authorized: false,
        error: 'Access Denied: Valid Order ID and matching Checkout Session ID proof are required.',
      };
    }

    // Fetch line items with product names
    const itemsRes = await client.query(
      `SELECT i.quantity, i."unitPriceCents", p.name AS "productName"
       FROM "orderItem" i
       LEFT JOIN "product" p ON i."productId" = p.id
       WHERE i."orderId" = $1`,
      [cleanOrderId]
    );

    const itemsSummary = itemsRes.rows.map((row) => ({
      productName: row.productName || 'Product Item',
      quantity: row.quantity,
      unitPriceCents: row.unitPriceCents,
    }));

    const shortId = cleanOrderId.length > 12 ? `${cleanOrderId.substring(0, 8)}...` : cleanOrderId;

    return {
      authorized: true,
      summary: {
        orderId: orderRow.id,
        shortId,
        status: orderRow.status,
        customerStatusExplanation: getCustomerStatusExplanation(orderRow.status),
        paymentStatus: orderRow.paymentStatus,
        createdAt: orderRow.createdAt,
        shippedAt: orderRow.status === 'SHIPPED' || orderRow.status === 'DELIVERED' ? orderRow.updatedAt : null,
        deliveredAt: orderRow.status === 'DELIVERED' ? orderRow.updatedAt : null,
        itemsSummary,
      },
    };
  } finally {
    if (!customClient) {
      (client as pg.PoolClient).release();
    }
  }
}
