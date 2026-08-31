'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';

function formatPrice(priceCents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(priceCents / 100);
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotalCents, totalItemCount, clearCart, isHydrated } = useCart();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Synchronous ref lock to prevent same-tick duplicate submissions
  const isSubmittingRef = useRef(false);

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 flex justify-center items-center">
        <div className="text-gray-500 font-medium animate-pulse">Loading checkout...</div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-16 px-4">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Your Cart is Empty</h1>
          <p className="text-gray-600 text-sm mb-6">
            Please add items to your cart before proceeding to checkout.
          </p>
          <Link
            href="/products"
            className="inline-flex items-center justify-center px-6 py-3 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm"
          >
            Browse Products
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    // Guard against same-tick duplicate submissions using synchronous ref lock
    if (isSubmittingRef.current || submitting) return;

    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Please enter your full name');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address');
      return;
    }

    isSubmittingRef.current = true;
    setSubmitting(true);

    try {
      // Step 1: Create Order in database (paymentStatus = PENDING)
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer: {
            name: name.trim(),
            email: email.trim(),
            phone: phone.trim() || undefined,
          },
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to place order');
      }

      // Step 2: Request Stripe Checkout Session for the created Order
      let checkoutUrl: string | null = null;
      try {
        const sessionRes = await fetch(`/api/orders/${data.orderId}/checkout-session`, {
          method: 'POST',
        });
        const sessionData = await sessionRes.json();
        if (sessionRes.ok && sessionData.url) {
          checkoutUrl = sessionData.url;
        } else {
          console.warn('[checkout] Checkout Session API error:', sessionData);
        }
      } catch (sessionErr) {
        console.warn('[checkout] Failed to create Stripe Checkout Session:', sessionErr);
      }

      // Step 3: Clear shopping cart
      clearCart();

      // Step 4: Redirect browser to Stripe Checkout URL (or fallback order page)
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        router.push(`/orders/${data.orderId}`);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('An unexpected error occurred. Please try again.');
      }
      isSubmittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link
            href="/cart"
            className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            ← Back to Cart
          </Link>
        </div>

        <h1 className="text-3xl font-extrabold text-gray-900 mb-8 tracking-tight">Checkout</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Customer Information Form */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-3 border-b border-gray-100">
              Customer Information
            </h2>

            {errorMessage && (
              <div className="mb-6 p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmitOrder} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-xs uppercase tracking-wider font-semibold text-gray-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-xs uppercase tracking-wider font-semibold text-gray-700 mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. jane@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-xs uppercase tracking-wider font-semibold text-gray-700 mb-1">
                  Phone Number <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +1 555-0199"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div className="pt-4 border-t border-gray-100 mt-6">
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-xs text-indigo-800 mb-4">
                  <span className="font-semibold block mb-0.5">Secure Stripe Checkout:</span>
                  You will be automatically redirected to Stripe to complete your payment.
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {submitting ? 'Redirecting to Stripe Checkout...' : 'Proceed to Payment →'}
                </button>
              </div>
            </form>
          </div>

          {/* Order Items & Subtotal Preview */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4 pb-3 border-b border-gray-100">
                Order Summary ({totalItemCount} {totalItemCount === 1 ? 'item' : 'items'})
              </h2>

              <div className="space-y-3 max-h-80 overflow-y-auto pr-1 mb-6">
                {items.map((item) => (
                  <div key={item.productId} className="flex justify-between items-center text-sm py-2 border-b border-gray-50">
                    <div>
                      <span className="font-medium text-gray-900 block">{item.name}</span>
                      <span className="text-xs text-gray-500">
                        Qty: {item.quantity} × {formatPrice(item.priceCents)}
                      </span>
                    </div>
                    <span className="font-semibold text-gray-900">
                      {formatPrice(item.priceCents * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-sm text-gray-600">Subtotal</span>
                <span className="text-base font-semibold text-gray-900">{formatPrice(subtotalCents)}</span>
              </div>
              <div className="flex justify-between items-baseline mb-4">
                <span className="text-sm text-gray-600">Shipping</span>
                <span className="text-xs font-semibold text-emerald-600 uppercase">Free</span>
              </div>
              <div className="flex justify-between items-baseline pt-3 border-t border-gray-100">
                <span className="text-base font-bold text-gray-900">Total Due</span>
                <span className="text-2xl font-extrabold text-indigo-600">{formatPrice(subtotalCents)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
