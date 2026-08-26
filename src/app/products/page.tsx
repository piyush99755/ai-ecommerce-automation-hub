import { db } from '@/prisma/db';
import Link from 'next/link';

export const revalidate = 0;

function formatPrice(priceCents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(priceCents / 100);
}

export default async function ProductsPage() {
  const products = await db.orm.public.Product.all();

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 pb-4 border-b border-gray-200">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Product Catalog</h1>
            <p className="mt-2 text-sm text-gray-600">
              Direct server-side data fetching from PostgreSQL via Prisma 8
            </p>
          </div>
          <div className="mt-4 md:mt-0 bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-100">
            <span className="text-sm font-semibold text-indigo-700">
              Total Products: {products.length}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => {
            const isLowStock = product.stock <= 3;
            return (
              <Link
                key={product.id}
                href={`/products/${product.slug}`}
                className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden border border-gray-100 flex flex-col group"
              >
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {product.category}
                    </span>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        isLowStock
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {isLowStock ? 'Low Stock' : 'In Stock'}
                    </span>
                  </div>

                  <h2 className="text-lg font-bold text-gray-900 mb-1 leading-snug group-hover:text-indigo-600 transition-colors">
                    {product.name}
                  </h2>

                  <p className="text-sm text-gray-600 mb-4 line-clamp-2 flex-1">
                    {product.description}
                  </p>

                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between mt-auto">
                    <div>
                      <span className="text-xs text-gray-400 block uppercase tracking-wider font-semibold">
                        Price
                      </span>
                      <span className="text-xl font-bold text-gray-900">
                        {formatPrice(product.priceCents)}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-gray-400 block uppercase tracking-wider font-semibold">
                        Stock
                      </span>
                      <span className="text-sm font-semibold text-gray-700">
                        {product.stock} units
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
