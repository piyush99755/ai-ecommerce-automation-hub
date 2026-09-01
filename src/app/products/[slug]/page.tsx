import { db } from '@/prisma/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import AddToCartButton from '@/components/cart/AddToCartButton';

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
  const hasImage = Boolean(product.imageUrl && product.imageUrl.trim() !== '');

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 hover:text-indigo-800 transition-colors bg-white px-4 py-2 rounded-xl border border-slate-200/80 shadow-sm"
          >
            ← Back to Product Catalog
          </Link>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
          {/* Product Detail Hero Stage */}
          <div className="w-full aspect-[16/9] bg-slate-950 relative overflow-hidden flex items-center justify-center border-b border-slate-100">
            {hasImage ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={product.imageUrl!}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                <svg
                  className="w-16 h-16 mb-3 text-indigo-400 opacity-60"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
                <span className="text-sm font-semibold text-slate-300">{product.category} Catalogue Item</span>
              </div>
            )}

            {/* Badge Overlay */}
            <div className="absolute top-4 right-4">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold shadow-md backdrop-blur-md ${
                  isLowStock ? 'bg-amber-500/90 text-white' : 'bg-emerald-500/90 text-white'
                }`}
              >
                {isLowStock ? 'Low Stock Warning' : 'In Stock'}
              </span>
            </div>
          </div>

          <div className="p-8 sm:p-10">
            <div className="mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-3 py-1 rounded-md">
                {product.category}
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4 tracking-tight">
              {product.name}
            </h1>

            <p className="text-slate-600 text-base sm:text-lg leading-relaxed mb-8 font-normal">
              {product.description}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-slate-100 mb-8">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                  Price
                </span>
                <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                  {formatPrice(product.priceCents)}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                  Inventory Level
                </span>
                <span className="text-base font-bold text-slate-800">
                  {product.stock} units remaining
                </span>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 flex items-center justify-end">
              <AddToCartButton
                product={{
                  id: product.id,
                  slug: product.slug,
                  name: product.name,
                  priceCents: product.priceCents,
                  stock: product.stock,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
