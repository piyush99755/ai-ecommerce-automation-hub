'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface OrderStatusPollerProps {
  orderId: string;
  initialStatus: string;
  initialPaymentStatus: string;
  sessionId?: string;
}

const STABLE_STATUSES = new Set(['PROCESSING', 'ON_HOLD', 'SHIPPED', 'DELIVERED', 'CANCELLED']);

export function OrderStatusPoller({
  orderId,
  initialStatus,
  initialPaymentStatus,
  sessionId,
}: OrderStatusPollerProps) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [paymentStatus, setPaymentStatus] = useState(initialPaymentStatus);
  const [isPolling, setIsPolling] = useState(initialStatus === 'PENDING');

  useEffect(() => {
    // If order has reached a stable/terminal state, do not start polling
    if (STABLE_STATUSES.has(status)) {
      setIsPolling(false);
      return;
    }

    setIsPolling(true);

    const intervalId = setInterval(async () => {
      try {
        const query = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : '';
        const res = await fetch(`/api/orders/${orderId}/status${query}`, { cache: 'no-store' });
        if (!res.ok) return;

        const data = await res.json();
        if (data.status) {
          setStatus(data.status);
          setPaymentStatus(data.paymentStatus);

          // Stop polling if a stable/terminal state is reached
          if (STABLE_STATUSES.has(data.status)) {
            setIsPolling(false);
            clearInterval(intervalId);
            router.refresh();
          }
        }
      } catch (err) {
        console.warn('[order-status-poller] Polling fetch error:', err);
      }
    }, 3000);

    return () => {
      clearInterval(intervalId);
    };
  }, [orderId, status, sessionId, router]);

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 py-6 border-b border-gray-100 text-center">
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 relative">
          <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold block mb-1">
            Order Status
          </span>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
            status === 'PROCESSING'
              ? 'bg-blue-100 text-blue-800'
              : status === 'SHIPPED'
              ? 'bg-purple-100 text-purple-800'
              : status === 'DELIVERED'
              ? 'bg-emerald-100 text-emerald-800'
              : status === 'CANCELLED'
              ? 'bg-red-100 text-red-800'
              : 'bg-amber-100 text-amber-800'
          }`}>
            {status}
          </span>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
          <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold block mb-1">
            Payment Status
          </span>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
            paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
          }`}>
            {paymentStatus}
          </span>
        </div>
      </div>

      {isPolling && (
        <div className="mt-2 text-center">
          <span className="inline-flex items-center gap-1.5 text-xs text-indigo-600 font-medium bg-indigo-50 px-3 py-1 rounded-full animate-pulse">
            <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
            Auto-refreshing order status...
          </span>
        </div>
      )}
    </div>
  );
}
