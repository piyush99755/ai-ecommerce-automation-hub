import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAuthenticatedAdminServer } from '@/lib/admin-auth';
import { fetchDetailedInventoryWorkspace } from '@/lib/inventory-workspace';
import { formatCurrencyCents, InventoryState } from '@/lib/admin-inventory';
import { InventoryActivityTimeline } from '@/components/admin/InventoryActivityTimeline';

export default async function AdminProductInventoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Server-side authorization check before querying inventory records or rendering data
  const session = await getAuthenticatedAdminServer();
  if (!session) {
    redirect('/admin/login');
  }

  const { id } = await params;

  const workspace = await fetchDetailedInventoryWorkspace(id);

  if (!workspace) {
    return (
      <div className="space-y-6">
        <div>
          <Link href="/admin/inventory" className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold">
            ← Back to Inventory List
          </Link>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
          Product with ID <span className="font-mono text-white">{id}</span> was not found in PostgreSQL.
        </div>
      </div>
    );
  }

  const { product, orderUsage, timeline, schemaNote } = workspace;

  const getStateBadge = (s: InventoryState) => {
    switch (s) {
      case 'IN_STOCK':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'LOW_STOCK':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20 font-bold';
      case 'OUT_OF_STOCK':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20 font-extrabold';
    }
  };

  const getOrderStatusBadge = (s: string) => {
    switch (s) {
      case 'PROCESSING':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'SHIPPED':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
      case 'DELIVERED':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/inventory" className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold inline-block mb-2">
            ← Back to Inventory Console
          </Link>
          <h1 className="text-2xl font-bold text-white tracking-tight">{product.name}</h1>
          <p className="text-sm text-slate-400 font-mono mt-0.5">
            SKU: {product.slug} • Category: {product.category}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <span className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${getStateBadge(product.state)}`}>
            {product.state.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Product & Stock Details Card */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-2">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Current Stock</div>
          <div className="text-3xl font-black text-white">{product.stock} <span className="text-xs font-normal text-slate-400">units</span></div>
          <div className="text-[10px] text-slate-500">Live PostgreSQL snapshot</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-2">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Low-Stock Threshold</div>
          <div className="text-3xl font-black text-amber-400">{product.lowStockThreshold} <span className="text-xs font-normal text-slate-400">units</span></div>
          <div className="text-[10px] text-slate-500">Alert trigger limit</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-2">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Retail Unit Price</div>
          <div className="text-3xl font-black text-emerald-400">{formatCurrencyCents(product.priceCents)}</div>
          <div className="text-[10px] text-slate-500">Catalog price</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-2">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Orders Linked</div>
          <div className="text-3xl font-black text-sky-400">{orderUsage.length} <span className="text-xs font-normal text-slate-400">orders</span></div>
          <div className="text-[10px] text-slate-500">Associated order line items</div>
        </div>
      </div>

      {/* Main Grid: Order Usage Table & Activity Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Order Usage Table */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="p-5 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Order Line Item History</h3>
              <p className="text-xs text-slate-400 mt-0.5">Orders referencing units of {product.name}</p>
            </div>

            {orderUsage.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No orders have purchased this product yet.
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/60 text-slate-400 text-xs font-semibold uppercase border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3">Order ID</th>
                    <th className="px-5 py-3">Customer</th>
                    <th className="px-5 py-3">Qty Ordered</th>
                    <th className="px-5 py-3">Stock Decrement</th>
                    <th className="px-5 py-3">Order Status</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {orderUsage.map((u) => (
                    <tr key={u.orderId} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-4 font-mono text-xs font-semibold text-slate-300">
                        {u.shortId}
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-white">{u.customerName}</div>
                        <div className="text-xs text-slate-400">{u.customerEmail}</div>
                      </td>
                      <td className="px-5 py-4 font-black text-white">
                        {u.quantityPurchased}
                      </td>
                      <td className="px-5 py-4">
                        {u.inventoryDecremented ? (
                          <span className="text-[11px] font-bold px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                            Decremented
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium px-2 py-0.5 bg-slate-800 text-slate-400 border border-slate-700 rounded">
                            Pending Fulfillment
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md border ${getOrderStatusBadge(u.orderStatus)}`}>
                          {u.orderStatus}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/admin/orders/${u.orderId}`}
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

          {/* Audit Limitation Note Panel */}
          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl text-xs text-slate-400 space-y-2">
            <div className="font-bold text-white flex items-center space-x-2">
              <span>📋</span>
              <span>Inventory Audit Schema Note</span>
            </div>
            <p className="leading-relaxed">{schemaNote}</p>
            <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-500">
              <span className="font-semibold text-indigo-400">Phase 5B Proposal:</span> To support manual admin stock adjustments, an explicit <code className="text-slate-300 font-mono">InventoryAdjustment</code> audit model (<code className="text-slate-300 font-mono">id, productId, adminId, previousStock, newStock, delta, reason, createdAt</code>) with a real <code className="text-slate-300 font-mono">Admin</code> relation is recommended to prevent un-audited stock mutations.
            </div>
          </div>
        </div>

        {/* Right Column (1 Col): Inventory Activity Timeline */}
        <div className="space-y-6">
          <InventoryActivityTimeline timeline={timeline} />
        </div>
      </div>
    </div>
  );
}
