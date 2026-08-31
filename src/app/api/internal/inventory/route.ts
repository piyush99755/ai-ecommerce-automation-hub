import { db } from '@/prisma/db';
import { NextResponse } from 'next/server';
import { authenticateAutomationSecret } from '@/lib/auth';

export type InventoryState = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export function deriveInventoryState(stock: number, lowStockThreshold: number): InventoryState {
  if (stock <= 0) {
    return 'OUT_OF_STOCK';
  }
  if (stock <= lowStockThreshold) {
    return 'LOW_STOCK';
  }
  return 'IN_STOCK';
}

export async function GET(request: Request) {
  try {
    // 1. Authenticate Automation Secret
    const authError = authenticateAutomationSecret(request);
    if (authError) {
      return authError;
    }

    // 2. Parse optional state and productIds query parameters
    const { searchParams } = new URL(request.url);
    const stateFilter = searchParams.get('state')?.trim().toUpperCase();
    const productIdsFilter = searchParams.get('productIds')?.split(',').map((id) => id.trim()).filter(Boolean);

    // 3. Fetch all Products from PostgreSQL
    const products = await db.orm.public.Product.all();

    // 4. Map to Operational Payload with derived inventoryState
    const mappedProducts = products.map((product) => {
      const inventoryState = deriveInventoryState(product.stock, product.lowStockThreshold ?? 5);
      return {
        productId: product.id,
        name: product.name,
        slug: product.slug,
        stock: product.stock,
        lowStockThreshold: product.lowStockThreshold ?? 5,
        inventoryState,
      };
    });

    // 5. Apply optional filtering
    let filteredProducts = mappedProducts;
    if (stateFilter && stateFilter !== 'ALL') {
      filteredProducts = filteredProducts.filter((p) => p.inventoryState === stateFilter);
    }
    if (productIdsFilter && productIdsFilter.length > 0) {
      const idSet = new Set(productIdsFilter);
      filteredProducts = filteredProducts.filter((p) => idSet.has(p.productId));
    }

    return NextResponse.json(filteredProducts, { status: 200 });
  } catch (error: unknown) {
    console.error('[internal-api] Unexpected error fetching inventory:', error);
    return NextResponse.json(
      { error: 'An unexpected internal error occurred.' },
      { status: 500 }
    );
  }
}
