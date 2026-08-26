import { db } from '@/prisma/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export const revalidate = 0;

function formatPrice(priceCents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(priceCents / 100);
}

interface ProductDetailPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { slug } = await params;

  const product = await db.orm.public.Product.where({ slug }).first();

  if (!product) {
    notFound();
  }

  const isLowStock = product.stock <= 3;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link
            href="/products"
            className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            ← Back to Product Catalog
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
              {product.category}
            </span>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                isLowStock
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}
            >
              {isLowStock ? 'Low Stock' : 'In Stock'}
            </span>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-4">{product.name}</h1>

          <p className="text-gray-600 text-base leading-relaxed mb-8">{product.description}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-gray-100">
            <div>
              <span className="text-xs text-gray-400 block uppercase tracking-wider font-semibold mb-1">
                Price
              </span>
              <span className="text-3xl font-extrabold text-gray-900">
                {formatPrice(product.priceCents)}
              </span>
            </div>

            <div>
              <span className="text-xs text-gray-400 block uppercase tracking-wider font-semibold mb-1">
                Stock Status
              </span>
              <span className="text-base font-semibold text-gray-800">
                {product.stock} units available
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
