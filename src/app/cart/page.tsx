'use client';

import React from 'react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';

function formatPrice(priceCents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(priceCents / 100);
}

export default function CartPage() {
  const {
    items,
    updateQuantity,
    removeItem,
    clearCart,
    subtotalCents,
    totalItemCount,
    isHydrated,
  } = useCart();

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 flex justify-center items-center">
        <div className="text-gray-500 font-medium animate-pulse">Loading cart...</div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
            🛒
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Your Cart is Empty</h1>
          <p className="text-gray-600 text-sm mb-6">
            Looks like you haven&apos;t added any products to your cart yet.
          </p>
          <Link
            href="/products"
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm"
          >
            Explore Catalog →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 pb-4 border-b border-gray-200">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Shopping Cart</h1>
            <p className="mt-1 text-sm text-gray-600">
              {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'} in your cart
            </p>
          </div>
          <button
            onClick={clearCart}
            className="mt-4 sm:mt-0 text-xs font-semibold text-rose-600 hover:text-rose-800 transition-colors self-start sm:self-auto"
          >
            Clear Entire Cart
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items List */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => {
              const lineTotal = item.priceCents * item.quantity;
              return (
                <div
                  key={item.productId}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex-1">
                    <Link
                      href={`/products/${item.slug}`}
                      className="text-lg font-bold text-gray-900 hover:text-indigo-600 transition-colors block"
                    >
                      {item.name}
                    </Link>
                    <span className="text-xs text-gray-500 font-medium">
                      Unit Price: {formatPrice(item.priceCents)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6">
                    {/* Quantity Controls */}
                    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        className="px-3 py-1 text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed text-base font-bold transition-colors"
                        aria-label="Decrease quantity"
                      >
                        -
                      </button>
                      <span className="px-3 py-1 text-sm font-semibold text-gray-900 min-w-[2rem] text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                        className="px-3 py-1 text-gray-600 hover:bg-gray-200 text-base font-bold transition-colors"
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>

                    {/* Line Total & Remove */}
                    <div className="text-right flex items-center gap-4">
                      <div>
                        <span className="text-xs text-gray-400 block uppercase font-semibold">Total</span>
                        <span className="text-base font-bold text-gray-900">
                          {formatPrice(lineTotal)}
                        </span>
                      </div>

                      <button
                        onClick={() => removeItem(item.productId)}
                        className="text-gray-400 hover:text-rose-600 text-lg font-bold p-1 transition-colors"
                        title="Remove item"
                        aria-label="Remove item"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sticky top-24">
              <h2 className="text-lg font-bold text-gray-900 mb-4 pb-3 border-b border-gray-100">
                Order Summary
              </h2>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal ({totalItemCount} items)</span>
                  <span className="font-semibold text-gray-900">{formatPrice(subtotalCents)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Estimated Shipping</span>
                  <span className="text-emerald-600 font-semibold">Free</span>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-between items-baseline mb-6">
                <span className="text-base font-bold text-gray-900">Subtotal</span>
                <span className="text-2xl font-extrabold text-indigo-600">
                  {formatPrice(subtotalCents)}
                </span>
              </div>

              <Link
                href="/checkout"
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm transition-colors text-center text-sm block"
              >
                Proceed to Checkout →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
