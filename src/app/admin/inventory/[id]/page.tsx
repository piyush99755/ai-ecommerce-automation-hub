import { redirect } from 'next/navigation';
import Link from 'next/link';
import { authorizeAdminCapability, hasAdminCapability } from '@/lib/admin-rbac';
import { fetchDetailedInventoryWorkspace } from '@/lib/inventory-workspace';
import { formatCurrencyCents, InventoryState } from '@/lib/admin-inventory';
import { InventoryActivityTimeline } from '@/components/admin/InventoryActivityTimeline';
import { AdjustStockForm } from '@/components/admin/AdjustStockForm';
import { InventoryAdjustmentTable } from '@/components/admin/InventoryAdjustmentTable';
import { AccessDenied } from '@/components/admin/AccessDenied';

export default async function AdminProductInventoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const auth = await authorizeAdminCapability('VIEW_INVENTORY');
  if (!auth.authorized) {
    if (auth.status === 401) {
      redirect('/admin/login');
    }
    return <AccessDenied error={auth.error} capability="VIEW_INVENTORY" />;
  }

  const canAdjustStock = hasAdminCapability(auth.admin.role, 'ADJUST_INVENTORY');

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

  const { product, adjustments, orderUsage, timeline } = workspace;
  const inventoryState = product.state;

  const getStateBadge = (s: InventoryState) => {
    switch (s) {
      case 'IN_STOCK':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'LOW_STOCK':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40 font-extrabold animate-pulse';
      case 'OUT_OF_STOCK':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/40 font-extrabold shadow-sm shadow-rose-950';
    }
  };

  return (
    <div className="space-y-8">
      {/* Breadcrumb & Navigation */}
      <div>
        <Link href="/admin/inventory" className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold inline-flex items-center space-x-1">
          <span>← Back to Inventory List</span>
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">{product.name}</h1>
            <span className={`text-xs px-2.5 py-1 rounded-md border font-mono ${getStateBadge(inventoryState)}`}>
              {inventoryState}
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Category: <span className="text-slate-300 font-semibold">{product.category}</span> | Slug: <span className="font-mono text-xs text-slate-400">{product.slug}</span>
          </p>
        </div>

        <div className="text-right text-xs text-slate-400 font-mono">
          <div>Product ID: <span className="text-white font-semibold">{product.id}</span></div>
          <div className="mt-0.5 text-slate-500">Last updated: {new Date(product.updatedAt).toLocaleString()}</div>
        </div>
      </div>

      {/* Product Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-2">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Current Stock Snapshot</div>
          <div className="text-3xl font-black text-white">{product.stock} <span className="text-xs font-normal text-slate-400">units</span></div>
          <div className="text-[10px] text-slate-500">Live PostgreSQL row count</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-2">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Low Stock Threshold</div>
          <div className="text-3xl font-black text-amber-400">{product.lowStockThreshold} <span className="text-xs font-normal text-slate-400">units</span></div>
          <div className="text-[10px] text-slate-500">Alert triggers when stock ≤ threshold</div>
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

      {/* Audited Manual Stock Adjust Interface (Only rendered if admin possesses ADJUST_INVENTORY capability) */}
      {canAdjustStock ? (
        <AdjustStockForm productId={product.id} currentStock={product.stock} />
      ) : (
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl text-xs text-slate-400 flex items-center justify-between">
          <span>🔒 Manual stock adjustment is restricted to Super Admin and Operations roles.</span>
          <span className="font-mono text-slate-500">Role: {auth.admin.role}</span>
        </div>
      )}

      {/* Main Grid: History Tables & Activity Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Adjustment History & Order Usage */}
        <div className="lg:col-span-2 space-y-6">
          {/* Manual Admin Adjustment History Table */}
          <InventoryAdjustmentTable adjustments={adjustments} />

          {/* Order Consumption History Table */}
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
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Decremented (-{u.quantityPurchased})
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Not Decremented
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-slate-300">
                        {u.orderStatus}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/admin/orders/${u.orderId}`}
                          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-lg border border-slate-700 transition-colors inline-block"
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
        </div>

        {/* Right Column (1 Col): Activity Timeline */}
        <div className="space-y-6">
          <InventoryActivityTimeline timeline={timeline} />
        </div>
      </div>
    </div>
  );
}
