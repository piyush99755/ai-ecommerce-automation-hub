import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAuthenticatedAdminServer } from '@/lib/admin-auth';
import { fetchDetailedOrderWorkspace } from '@/lib/order-timeline';
import { formatCurrencyCents } from '@/lib/admin-dashboard';
import { OrderActivityTimeline } from '@/components/admin/OrderActivityTimeline';
import { AutomationEventsSection } from '@/components/admin/AutomationEventsSection';
import { authorizeAdminCapability } from '@/lib/admin-rbac';
import { AccessDenied } from '@/components/admin/AccessDenied';

function maskId(id: string | null | undefined): string {
  if (!id) return 'None';
  if (id.length <= 12) return `${id.substring(0, 4)}...`;
  return `${id.substring(0, 8)}...${id.substring(id.length - 4)}`;
}

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const auth = await authorizeAdminCapability('VIEW_ORDERS');
  if (!auth.authorized) {
    if (auth.status === 401) {
      redirect('/admin/login');
    }
    return <AccessDenied error={auth.error} capability="VIEW_ORDERS" />;
  }

  const { id } = await params;

  const workspace = await fetchDetailedOrderWorkspace(id);

  if (!workspace) {
    return (
      <div className="space-y-6">
        <div>
          <Link href="/admin/orders" className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold">
            ← Back to Orders List
          </Link>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
          Order with ID <span className="font-mono text-white">{id}</span> was not found in PostgreSQL.
        </div>
      </div>
    );
  }

  const { order, customer, items, timeline, outboxEvents } = workspace;

  return (
    <div className="space-y-8">
      {/* Workspace Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/orders" className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold inline-block mb-2">
            ← Back to Orders Management
          </Link>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Order Workspace <span className="font-mono text-indigo-400">{order.id}</span>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Persisted record created on {new Date(order.createdAt).toLocaleString()}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Payment: {order.paymentStatus}
          </span>
          <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            Status: {order.status}
          </span>
        </div>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Customer Information */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-lg">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Customer Details</div>
          <div className="text-base font-bold text-white">{customer?.name || 'Unknown Customer'}</div>
          <div className="text-xs text-slate-400 font-mono">{customer?.email || 'N/A'}</div>
          {customer?.phone && <div className="text-xs text-slate-400">Phone: {customer.phone}</div>}
        </div>

        {/* Payment & Stripe Pointers */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-lg">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Payment Details</div>
          <div className="text-xs text-slate-300">
            Provider: <span className="font-bold text-white">Stripe (Test Mode)</span>
          </div>
          <div className="text-xs text-slate-400">
            Checkout Session: <span className="font-mono text-slate-300">{maskId(order.stripeCheckoutSessionId)}</span>
          </div>
          <div className="text-xs text-slate-400">
            Payment Intent: <span className="font-mono text-slate-300">{maskId(order.stripePaymentIntentId)}</span>
          </div>
        </div>

        {/* Shipping & Delivery */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-lg">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Shipping &amp; Delivery</div>
          <div className="text-xs text-slate-300">Carrier: {order.carrier || 'Unassigned'}</div>
          <div className="text-xs text-slate-300">Tracking #: {order.trackingNumber || 'Pending'}</div>
          <div className="text-xs text-slate-400">
            Shipped: {order.shippedAt ? new Date(order.shippedAt).toLocaleString() : 'Not Shipped'}
          </div>
        </div>
      </div>

      {/* Main Grid: Line Items & Activity Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Line Items & Outbox Events */}
        <div className="lg:col-span-2 space-y-6">
          {/* Line Items Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="p-5 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Order Line Items</h3>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/60 text-slate-400 text-xs font-semibold uppercase border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3">Qty</th>
                  <th className="px-5 py-3">Unit Price</th>
                  <th className="px-5 py-3 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-5 py-4 font-semibold text-white">{item.productName}</td>
                    <td className="px-5 py-4 text-slate-300 font-mono">{item.quantity}</td>
                    <td className="px-5 py-4 text-slate-300">{formatCurrencyCents(item.unitPriceCents)}</td>
                    <td className="px-5 py-4 text-right font-bold text-white">
                      {formatCurrencyCents(item.unitPriceCents * item.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-5 bg-slate-950/40 border-t border-slate-800 text-right space-y-1">
              <div className="text-xs text-slate-400">
                Subtotal: <span className="text-slate-200 font-bold">{formatCurrencyCents(order.subtotalCents)}</span>
              </div>
              <div className="text-xl font-black text-white">
                Total: {formatCurrencyCents(order.totalCents)}
              </div>
            </div>
          </div>

          {/* Automation Events Section */}
          <AutomationEventsSection outboxEvents={outboxEvents} />
        </div>

        {/* Right Column (1 Col): Order Activity Timeline */}
        <div className="space-y-6">
          <OrderActivityTimeline timeline={timeline} />
        </div>
      </div>
    </div>
  );
}
