import { db } from '@/prisma/db';
import ProductCatalogClient from '@/components/products/ProductCatalogClient';

export const revalidate = 0;

export const CURATED_DEMO_SLUGS = [
  'wireless-mechanical-keyboard',
  'ergonomic-wireless-mouse',
  'usbc-charging-hub',
  'noise-cancelling-headphones',
  'smart-desk-lamp',
  'aluminum-laptop-stand',
  'portable-ssd-1tb',
  'minimalist-tech-backpack',
  'wireless-charging-pad',
  'smart-water-bottle',
];

export default async function ProductsPage() {
  const allProducts = await db.orm.public.Product.all();

  // Public Catalogue Separation:
  // Filter PostgreSQL products so only the 10 curated demo products appear in the customer storefront.
  // Test-generated fixtures (e.g. concurrency_*, low_stock_*, shipping_*) remain untouched in DB for automated test suites.
  const curatedProducts = allProducts
    .filter((p) => CURATED_DEMO_SLUGS.includes(p.slug))
    .sort((a, b) => CURATED_DEMO_SLUGS.indexOf(a.slug) - CURATED_DEMO_SLUGS.indexOf(b.slug));

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Modern Storefront Hero Header */}
        <div className="mb-10 text-center md:text-left border-b border-slate-200 pb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100/80 border border-indigo-200 text-indigo-700 text-xs font-bold mb-3">
              <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
              AI E-commerce Automation Hub Demo Store
            </div>
            <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
              Premium Tech Catalogue
            </h1>
            <p className="mt-3 text-base text-slate-600 max-w-2xl font-normal leading-relaxed">
              Explore high-performance hardware backed by Neon PostgreSQL, Stripe payments, and automated n8n fulfillment workflows.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white p-3.5 rx-xl rounded-2xl shadow-sm border border-slate-200/80">
            <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v1H5zM5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">
                Catalogue Status
              </span>
              <span className="text-sm font-extrabold text-slate-900">
                {curatedProducts.length} Curated Products
              </span>
            </div>
          </div>
        </div>

        {/* Client-Side Search, Filter & Responsive Grid */}
        <ProductCatalogClient products={curatedProducts} />
      </div>
    </div>
  );
}
