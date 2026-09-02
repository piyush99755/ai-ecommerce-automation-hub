import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAuthenticatedAdminServer } from '@/lib/admin-auth';
import { fetchAdminOrders, formatCurrencyCents } from '@/lib/admin-orders';
import { OrdersTableFilterControls } from '@/components/admin/OrdersTableFilterControls';

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    paymentStatus?: string;
    page?: string;
  }>;
}) {
  // Server-side authorization check before querying orders or rendering data
  const session = await getAuthenticatedAdminServer();
  if (!session) {
    redirect('/admin/login');
  }

  const { q, status, paymentStatus, page } = await searchParams;

  const result = await fetchAdminOrders({
    q,
    status,
    paymentStatus,
    page: page ? parseInt(page, 10) : 1,
    pageSize: 10,
  });

  const getPaymentBadge = (s: string) => {
    switch (s) {
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

  const getStatusBadge = (s: string) => {
    switch (s) {
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

  const buildPageUrl = (newPage: number) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status && status !== 'ALL') params.set('status', status);
    if (paymentStatus && paymentStatus !== 'ALL') params.set('paymentStatus', paymentStatus);
    params.set('page', newPage.toString());
    return `/admin/orders?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Orders Management</h1>
          <p className="text-sm text-slate-400 mt-1">
            Search, filter, and inspect customer orders across fulfillment and automation states.
          </p>
        </div>
        <div className="text-right text-xs text-slate-400">
          Showing <span className="text-white font-bold">{result.items.length}</span> of{' '}
          <span className="text-white font-bold">{result.totalCount}</span> total orders
        </div>
      </div>

      {/* Interactive Filter Controls */}
      <OrdersTableFilterControls />

      {/* Orders Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        {result.items.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <div className="text-3xl mb-2">🔍</div>
            <div className="text-sm font-semibold text-white">No orders match your filter criteria</div>
            <p className="text-xs text-slate-500 mt-1">
              Try adjusting your search keywords or clearing status filters.
            </p>
          </div>
        ) : (
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
                {result.items.map((o) => (
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
                        className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-lg border border-slate-700 transition-colors inline-block"
                      >
                        Inspect →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {result.totalPages > 1 && (
          <div className="p-4 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-xs">
            <div className="text-slate-400">
              Page <span className="font-bold text-white">{result.page}</span> of{' '}
              <span className="font-bold text-white">{result.totalPages}</span>
            </div>

            <div className="flex items-center space-x-2">
              {result.page > 1 ? (
                <Link
                  href={buildPageUrl(result.page - 1)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 font-medium transition-colors"
                >
                  ← Previous
                </Link>
              ) : (
                <span className="px-3 py-1.5 bg-slate-900 text-slate-600 rounded-lg border border-slate-800 cursor-not-allowed">
                  ← Previous
                </span>
              )}

              {result.page < result.totalPages ? (
                <Link
                  href={buildPageUrl(result.page + 1)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 font-medium transition-colors"
                >
                  Next →
                </Link>
              ) : (
                <span className="px-3 py-1.5 bg-slate-900 text-slate-600 rounded-lg border border-slate-800 cursor-not-allowed">
                  Next →
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
