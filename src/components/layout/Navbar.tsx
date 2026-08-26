'use client';

import Link from 'next/link';
import { useCart } from '@/context/CartContext';

export default function Navbar() {
  const { totalItemCount, isHydrated } = useCart();

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold text-gray-900 tracking-tight hover:text-indigo-600 transition-colors">
          AI E-Commerce Hub
        </Link>

        <nav className="flex items-center gap-6">
          <Link
            href="/products"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            Catalog
          </Link>

          <Link
            href="/cart"
            className="relative inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-medium text-gray-800 transition-colors"
          >
            <span>Cart</span>
            {isHydrated && totalItemCount > 0 && (
              <span className="inline-flex items-center justify-center bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {totalItemCount}
              </span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
}
