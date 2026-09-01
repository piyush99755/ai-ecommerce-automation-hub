import Link from 'next/link';
import { RecentOrderSummary, formatCurrencyCents } from '@/lib/admin-dashboard';

interface RecentOrdersTableProps {
  orders: RecentOrderSummary[];
}

export function RecentOrdersTable({ orders }: RecentOrdersTableProps) {
  if (orders.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
        No orders found in database.
      </div>
    );
  }

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'PENDING':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'FAILED':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PROCESSING':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'SHIPPED':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
      case 'DELIVERED':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'PENDING':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'CANCELLED':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
      <div className="p-5 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight">Recent Orders</h3>
          <p className="text-xs text-slate-400 mt-0.5">Latest customer transactions from Neon PostgreSQL</p>
        </div>
        <Link
          href="/admin/orders"
          className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
        >
          View All Orders →
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-950/60 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-800">
            <tr>
              <th className="px-5 py-3.5">Order ID</th>
              <th className="px-5 py-3.5">Customer</th>
              <th className="px-5 py-3.5">Total</th>
              <th className="px-5 py-3.5">Payment</th>
              <th className="px-5 py-3.5">Order Status</th>
              <th className="px-5 py-3.5">Date</th>
              <th className="px-5 py-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-200">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-slate-800/40 transition-colors">
                <td className="px-5 py-4 font-mono text-xs text-slate-300 font-semibold">
                  {o.shortId}
                </td>
                <td className="px-5 py-4">
                  <div className="font-semibold text-white">{o.customerName}</div>
                  <div className="text-xs text-slate-400">{o.customerEmail}</div>
                </td>
                <td className="px-5 py-4 font-bold text-white">
                  {formatCurrencyCents(o.totalCents)}
                </td>
                <td className="px-5 py-4">
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md border ${getPaymentBadge(o.paymentStatus)}`}>
                    {o.paymentStatus}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md border ${getStatusBadge(o.status)}`}>
                    {o.status}
                  </span>
                </td>
                <td className="px-5 py-4 text-xs text-slate-400">
                  {new Date(o.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td className="px-5 py-4 text-right">
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-lg border border-slate-700 transition-colors inline-block"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
