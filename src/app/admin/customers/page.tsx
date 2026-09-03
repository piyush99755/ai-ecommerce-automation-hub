import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAuthenticatedAdminServer } from '@/lib/admin-auth';
import { fetchAdminCustomers, formatCurrencyCents } from '@/lib/admin-customers';
import { CustomersTableSearchControls } from '@/components/admin/CustomersTableSearchControls';
import { authorizeAdminCapability } from '@/lib/admin-rbac';
import { AccessDenied } from '@/components/admin/AccessDenied';

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    page?: string;
  }>;
}) {
  const auth = await authorizeAdminCapability('VIEW_CUSTOMERS');
  if (!auth.authorized) {
    if (auth.status === 401) {
      redirect('/admin/login');
    }
    return <AccessDenied error={auth.error} capability="VIEW_CUSTOMERS" />;
  }

  const { q, page } = await searchParams;

  const result = await fetchAdminCustomers({
    q,
    page: page ? parseInt(page, 10) : 1,
    pageSize: 10,
  });

  const buildPageUrl = (newPage: number) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    params.set('page', newPage.toString());
    return `/admin/customers?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Customer CRM &amp; Accounts</h1>
          <p className="text-sm text-slate-400 mt-1">
            Customer lifetime value, active orders, and purchase history overview.
          </p>
        </div>
        <div className="text-right text-xs text-slate-400">
          Showing <span className="text-white font-bold">{result.items.length}</span> of{' '}
          <span className="text-white font-bold">{result.totalCount}</span> registered customers
        </div>
      </div>

      {/* Interactive Search Controls */}
      <CustomersTableSearchControls />

      {/* Customers Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        {result.items.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <div className="text-3xl mb-2">👤</div>
            <div className="text-sm font-semibold text-white">No customers match your search criteria</div>
            <p className="text-xs text-slate-500 mt-1">
              Try searching with different name or email keywords.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/60 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">Customer</th>
                  <th className="px-5 py-3.5">Total Orders</th>
                  <th className="px-5 py-3.5">Paid Orders</th>
                  <th className="px-5 py-3.5">Lifetime Value (LTV)</th>
                  <th className="px-5 py-3.5">Active Orders</th>
                  <th className="px-5 py-3.5">Last Order Date</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {result.items.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-bold text-white">{c.name}</div>
                      <div className="text-xs text-slate-400 font-mono">{c.email}</div>
                    </td>
                    <td className="px-5 py-4 font-semibold text-white">
                      {c.totalOrders}
                    </td>
                    <td className="px-5 py-4 font-semibold text-emerald-400">
                      {c.paidOrders}
                    </td>
                    <td className="px-5 py-4 font-black text-emerald-400 text-base">
                      {formatCurrencyCents(c.lifetimeValueCents)}
                    </td>
                    <td className="px-5 py-4">
                      {c.activeOrders > 0 ? (
                        <span className="text-xs font-bold px-2.5 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {c.activeOrders} Active
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">0 Active</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-400">
                      {c.lastOrderDate
                        ? new Date(c.lastOrderDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : 'No Orders Yet'}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/admin/customers/${c.id}`}
                        className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-lg border border-slate-700 transition-colors inline-block"
                      >
                        Inspect CRM →
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
