'use me';
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export function OrdersTableFilterControls() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get('q') || '');
  const [status, setStatus] = useState(searchParams.get('status') || 'ALL');
  const [paymentStatus, setPaymentStatus] = useState(searchParams.get('paymentStatus') || 'ALL');

  const handleFilter = (newQ = q, newStatus = status, newPayment = paymentStatus) => {
    const params = new URLSearchParams();
    if (newQ.trim()) params.set('q', newQ.trim());
    if (newStatus !== 'ALL') params.set('status', newStatus);
    if (newPayment !== 'ALL') params.set('paymentStatus', newPayment);
    params.set('page', '1');

    router.push(`/admin/orders?${params.toString()}`);
  };

  const handleReset = () => {
    setQ('');
    setStatus('ALL');
    setPaymentStatus('ALL');
    router.push('/admin/orders');
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-4 md:space-y-0 md:flex md:items-center md:justify-between md:space-x-4">
      {/* Search Input */}
      <div className="flex-1 max-w-md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleFilter();
          }}
          className="relative"
        >
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by Order ID, Customer Name, or Email..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          <span className="absolute left-3.5 top-3 text-slate-500 text-sm">🔍</span>
        </form>
      </div>

      {/* Dropdown Filters */}
      <div className="flex items-center space-x-3">
        <div>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              handleFilter(q, e.target.value, paymentStatus);
            }}
            className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Order Statuses</option>
            <option value="PENDING">PENDING</option>
            <option value="PROCESSING">PROCESSING</option>
            <option value="ON_HOLD">ON_HOLD</option>
            <option value="SHIPPED">SHIPPED</option>
            <option value="DELIVERED">DELIVERED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>

        <div>
          <select
            value={paymentStatus}
            onChange={(e) => {
              setPaymentStatus(e.target.value);
              handleFilter(q, status, e.target.value);
            }}
            className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Payment Statuses</option>
            <option value="PENDING">PENDING</option>
            <option value="PAID">PAID</option>
            <option value="FAILED">FAILED</option>
            <option value="REFUNDED">REFUNDED</option>
          </select>
        </div>

        {(q || status !== 'ALL' || paymentStatus !== 'ALL') && (
          <button
            onClick={handleReset}
            className="px-3 py-2.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
