import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAuthenticatedAdminServer } from '@/lib/admin-auth';
import { fetchAdminInventory, formatCurrencyCents, InventoryState } from '@/lib/admin-inventory';
import { InventoryMetricsHeader } from '@/components/admin/InventoryMetricsHeader';
import { InventoryTableFilterControls } from '@/components/admin/InventoryTableFilterControls';

export default async function AdminInventoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    state?: string;
    category?: string;
    page?: string;
  }>;
}) {
  // Server-side authorization check before querying inventory records or rendering data
  const session = await getAuthenticatedAdminServer();
  if (!session) {
    redirect('/admin/login');
  }

  const { q, state, category, page } = await searchParams;

  const result = await fetchAdminInventory({
    q,
    state,
    category,
    page: page ? parseInt(page, 10) : 1,
    pageSize: 10,
  });

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

  const buildPageUrl = (newPage: number) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (state && state !== 'ALL') params.set('state', state);
    if (category && category !== 'ALL') params.set('category', category);
    params.set('page', newPage.toString());
    return `/admin/inventory?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Inventory Operations Console</h1>
          <p className="text-sm text-slate-400 mt-1">
            Warehouse stock monitoring, threshold alert tracking, and product allocation metrics.
          </p>
        </div>
        <div className="text-right text-xs text-slate-400">
          Showing <span className="text-white font-bold">{result.items.length}</span> of{' '}
          <span className="text-white font-bold">{result.totalCount}</span> catalog products
        </div>
      </div>

      {/* Top-Level Metrics Header */}
      <InventoryMetricsHeader metrics={result.metrics} />

      {/* Interactive Search & Filter Controls */}
      <InventoryTableFilterControls categories={result.categories} />

      {/* Inventory Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        {result.items.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <div className="text-3xl mb-2">📦</div>
            <div className="text-sm font-semibold text-white">No products match your inventory filter</div>
            <p className="text-xs text-slate-500 mt-1">
              Try selecting a different inventory state or clearing search keywords.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/60 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">Product Name</th>
                  <th className="px-5 py-3.5">Category</th>
                  <th className="px-5 py-3.5">Current Stock</th>
                  <th className="px-5 py-3.5">Threshold</th>
                  <th className="px-5 py-3.5">State</th>
                  <th className="px-5 py-3.5">Price</th>
                  <th className="px-5 py-3.5">Last Updated</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {result.items.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-bold text-white">{p.name}</div>
                      <div className="text-xs text-slate-400 font-mono">{p.slug}</div>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-300">
                      {p.category}
                    </td>
                    <td className="px-5 py-4 font-black text-white text-base">
                      {p.stock}{' '}
                      <span className="text-xs font-normal text-slate-400">units</span>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-400 font-mono">
                      {p.lowStockThreshold} units
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md border ${getStateBadge(p.state)}`}>
                        {p.state.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-semibold text-white">
                      {formatCurrencyCents(p.priceCents)}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-400">
                      {new Date(p.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/admin/inventory/${p.id}`}
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
