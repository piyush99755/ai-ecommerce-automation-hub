import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAuthenticatedAdminServer } from '@/lib/admin-auth';
import { fetchDetailedCustomerWorkspace } from '@/lib/customer-workspace';
import { formatCurrencyCents } from '@/lib/admin-dashboard';
import { CustomerActivityTimeline } from '@/components/admin/CustomerActivityTimeline';
import { CrmSyncPanel } from '@/components/admin/CrmSyncPanel';
import { authorizeAdminCapability } from '@/lib/admin-rbac';
import { AccessDenied } from '@/components/admin/AccessDenied';

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const auth = await authorizeAdminCapability('VIEW_CUSTOMERS');
  if (!auth.authorized) {
    if (auth.status === 401) {
      redirect('/admin/login');
    }
    return <AccessDenied error={auth.error} capability="VIEW_CUSTOMERS" />;
  }

  const { id } = await params;

  const workspace = await fetchDetailedCustomerWorkspace(id);

  if (!workspace) {
    return (
      <div className="space-y-6">
        <div>
          <Link href="/admin/customers" className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold">
            ← Back to Customer List
          </Link>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
          Customer record with ID <span className="font-mono text-white">{id}</span> was not found in PostgreSQL.
        </div>
      </div>
    );
  }

  const { customer, kpis, orders, timeline, crmSync } = workspace;

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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/customers" className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold inline-block mb-2">
            ← Back to Customer CRM
          </Link>
          <h1 className="text-2xl font-bold text-white tracking-tight">{customer.name}</h1>
          <p className="text-sm text-slate-400 font-mono mt-0.5">
            {customer.email} • Registered {new Date(customer.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg border-l-4 border-l-emerald-500">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Lifetime Value (LTV)</div>
          <div className="text-2xl font-black text-emerald-400 mt-1">{formatCurrencyCents(kpis.lifetimeValueCents)}</div>
          <div className="text-[10px] text-slate-500 mt-2">PAID orders only</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg border-l-4 border-l-indigo-500">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Orders</div>
          <div className="text-2xl font-black text-white mt-1">{kpis.totalOrders}</div>
          <div className="text-[10px] text-slate-500 mt-2">All time customer orders</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg border-l-4 border-l-sky-500">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Paid Orders</div>
          <div className="text-2xl font-black text-sky-400 mt-1">{kpis.paidOrders}</div>
          <div className="text-[10px] text-slate-500 mt-2">Stripe payment confirmed</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg border-l-4 border-l-amber-500">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Orders</div>
          <div className="text-2xl font-black text-amber-400 mt-1">{kpis.activeOrders}</div>
          <div className="text-[10px] text-slate-500 mt-2">Non-terminal fulfillment states</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg border-l-4 border-l-purple-500">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Last Order Date</div>
          <div className="text-sm font-extrabold text-white mt-2">
            {kpis.lastOrderDate
              ? new Date(kpis.lastOrderDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'N/A'}
          </div>
          <div className="text-[10px] text-slate-500 mt-2">Most recent transaction</div>
        </div>
      </div>

      {/* Main Grid: Order History & CRM / Timeline Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Order History Table */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="p-5 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Customer Order History</h3>
              <p className="text-xs text-slate-400 mt-0.5">All purchase transactions for {customer.name}</p>
            </div>

            {orders.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No order history recorded for this customer.
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/60 text-slate-400 text-xs font-semibold uppercase border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3">Order ID</th>
                    <th className="px-5 py-3">Total Amount</th>
                    <th className="px-5 py-3">Payment</th>
                    <th className="px-5 py-3">Fulfillment Status</th>
                    <th className="px-5 py-3">Created Date</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-4 font-mono text-xs font-semibold text-slate-300">
                        {o.shortId}
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
                        {new Date(o.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-lg border border-slate-700 transition-colors inline-block"
                        >
                          View Order →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <CrmSyncPanel crmSync={crmSync} />
        </div>

        {/* Right Column (1 Col): Customer Activity Timeline */}
        <div className="space-y-6">
          <CustomerActivityTimeline timeline={timeline} />
        </div>
      </div>
    </div>
  );
}
