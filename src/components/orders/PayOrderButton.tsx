'use client';

import React, { useState, useRef } from 'react';

interface PayOrderButtonProps {
  orderId: string;
}

export function PayOrderButton({ orderId }: PayOrderButtonProps) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);

  const handlePayOrder = async () => {
    if (isSubmittingRef.current || loading) return;

    isSubmittingRef.current = true;
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/orders/${orderId}/checkout-session`, {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok && data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.message || data.error || 'Failed to initialize payment checkout.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setErrorMessage(msg);
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      {errorMessage && (
        <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
          {errorMessage}
        </div>
      )}
      <button
        onClick={handlePayOrder}
        disabled={loading}
        className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Redirecting to Stripe...</span>
          </>
        ) : (
          <span>Complete Payment →</span>
        )}
      </button>
    </div>
  );
}
