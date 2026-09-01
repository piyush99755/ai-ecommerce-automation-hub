'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

export interface ProductCatalogItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  priceCents: number;
  stock: number;
  category: string;
  imageUrl?: string | null;
}

interface ProductCatalogClientProps {
  products: ProductCatalogItem[];
}

function formatPrice(priceCents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(priceCents / 100);
}

export default function ProductCatalogClient({ products }: ProductCatalogClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Extract unique categories dynamically
  const categories = useMemo(() => {
    const cats = Array.from(new Set(products.map((p) => p.category)));
    return ['All', ...cats.sort()];
  }, [products]);

  // Filter products by category and search query
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory =
        selectedCategory === 'All' || product.category === selectedCategory;

      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        q === '' ||
        product.name.toLowerCase().includes(q) ||
        product.description.toLowerCase().includes(q) ||
        product.category.toLowerCase().includes(q);

      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  return (
    <div>
      {/* Search & Category Filter Control Bar */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 mb-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products by name or description..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 text-xs font-semibold"
              >
                Clear
              </button>
            )}
          </div>

          {/* Category Filter Chips */}
          <div className="flex flex-wrap items-center gap-2">
            {categories.map((category) => {
              const isActive = selectedCategory === category;
              return (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  {category}
                </button>
              );
            })}
          </div>
        </div>

        {/* Results Counter */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing <strong className="text-slate-900 font-bold">{filteredProducts.length}</strong> of{' '}
            {products.length} catalogue items
          </span>
          {selectedCategory !== 'All' && (
            <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-medium">
              Category: {selectedCategory}
            </span>
          )}
        </div>
      </div>

      {/* Product Grid: 3-Column Desktop Grid with Breathing Room */}
      {filteredProducts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProducts.map((product) => {
            const isLowStock = product.stock <= 3;
            const hasImage = Boolean(product.imageUrl && product.imageUrl.trim() !== '');

            return (
              <Link
                key={product.id}
                href={`/products/${product.slug}`}
                className="bg-white rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden border border-slate-200/80 flex flex-col group"
              >
                {/* Product Image Stage */}
                <div className="w-full aspect-[4/3] bg-slate-950 relative overflow-hidden flex items-center justify-center border-b border-slate-100">
                  {hasImage ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={product.imageUrl!}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                      <svg
                        className="w-12 h-12 mb-2 text-indigo-400 opacity-60"
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
                      <span className="text-xs font-semibold text-slate-300">{product.category}</span>
                    </div>
                  )}

                  {/* Stock Status Badge Overlay */}
                  <div className="absolute top-3.5 right-3.5">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold shadow-sm backdrop-blur-md ${
                        isLowStock
                          ? 'bg-amber-500/90 text-white'
                          : 'bg-emerald-500/90 text-white'
                      }`}
                    >
                      {isLowStock ? 'Low Stock' : 'In Stock'}
                    </span>
                  </div>
                </div>

                {/* Card Content Body */}
                <div className="p-6 flex-1 flex flex-col">
                  <div className="mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
                      {product.category}
                    </span>
                  </div>

                  <h2 className="text-xl font-extrabold text-slate-900 mb-2 leading-snug group-hover:text-indigo-600 transition-colors">
                    {product.name}
                  </h2>

                  <p className="text-sm text-slate-600 mb-6 line-clamp-2 leading-relaxed flex-1">
                    {product.description}
                  </p>

                  <div className="pt-4 border-t border-slate-100 flex items-end justify-between mt-auto">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">
                        Price
                      </span>
                      <span className="text-2xl font-black text-slate-900 tracking-tight">
                        {formatPrice(product.priceCents)}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">
                        Availability
                      </span>
                      <span className="text-xs font-bold text-slate-700">
                        {product.stock} units
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/80 shadow-sm">
          <svg className="w-12 h-12 mx-auto text-slate-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-bold text-slate-900 mb-1">No matching products found</h3>
          <p className="text-sm text-slate-500 mb-4">Try adjusting your search terms or clearing category filters.</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('All');
            }}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors"
          >
            Reset Filters
          </button>
        </div>
      )}
    </div>
  );
}
