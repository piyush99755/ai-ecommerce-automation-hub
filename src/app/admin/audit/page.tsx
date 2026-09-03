import { redirect } from 'next/navigation';
import Link from 'next/link';
import { authorizeAdminCapability } from '@/lib/admin-rbac';
import { fetchAdminAuditLogs } from '@/lib/admin-audit';
import { AuditFilterControls } from '@/components/admin/AuditFilterControls';

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    action?: string;
    entityType?: string;
    page?: string;
  }>;
}) {
  // 1. Authoritative RBAC Capability Guard
  const auth = await authorizeAdminCapability('VIEW_AUDIT_LOG');

  if (!auth.authorized) {
    if (auth.status === 401) {
      redirect('/admin/login');
    }

    // 403 Forbidden UX for Authenticated users lacking capability
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-rose-950/40 border border-rose-800 rounded-3xl p-8 max-w-lg space-y-4 shadow-xl">
          <div className="text-4xl">🚫</div>
          <h1 className="text-xl font-bold text-white tracking-tight">403 — Access Denied</h1>
          <p className="text-sm text-slate-300">
            {auth.error}
          </p>
          <p className="text-xs text-slate-400">
            Your current role does not have authorization to view the central admin audit trail.
          </p>
          <div className="pt-2">
            <Link
              href="/admin/dashboard"
              className="inline-flex items-center px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition-colors border border-slate-700"
            >
              Return to Operations Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { action = 'ALL', entityType = 'ALL', page = '1' } = await searchParams;
  const pageNum = parseInt(page, 10) || 1;

  const data = await fetchAdminAuditLogs({
    action: action === 'ALL' ? undefined : action,
    entityType: entityType === 'ALL' ? undefined : entityType,
    page: pageNum,
    pageSize: 20,
  });

  const actionsList = ['INVENTORY_ADJUSTED', 'OUTBOX_EVENT_REQUEUED'];
  const entityTypesList = ['Product', 'OutboxEvent'];

  const createPaginationUrl = (p: number) => {
    const params = new URLSearchParams();
    if (action !== 'ALL') params.set('action', action);
    if (entityType !== 'ALL') params.set('entityType', entityType);
    params.set('page', p.toString());
    return `/admin/audit?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-3">
            <span>🛡️</span>
            <span>Central Admin Audit Trail</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Authoritative, transactional log of human administrative actions. Timezone: <span className="font-mono text-indigo-300">UTC</span>.
          </p>
        </div>

        <div className="text-xs font-mono text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl self-start sm:self-auto">
          Total Logs: <span className="font-bold text-white">{data.totalCount}</span>
        </div>
      </div>

      {/* Filter Controls */}
      <AuditFilterControls
        currentAction={action}
        currentEntityType={entityType}
        actionsList={actionsList}
        entityTypesList={entityTypesList}
      />

      {/* Audit Log Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        {data.logs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            No audit log records found matching the specified filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/60 text-slate-400 text-xs font-semibold uppercase border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">Timestamp (UTC)</th>
                  <th className="px-5 py-3.5">Admin</th>
                  <th className="px-5 py-3.5">Action</th>
                  <th className="px-5 py-3.5">Entity</th>
                  <th className="px-5 py-3.5">Safe Metadata Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {data.logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                    {/* Timestamp */}
                    <td className="px-5 py-4 font-mono text-xs text-slate-400 whitespace-nowrap">
                      {new Date(log.createdAt).toISOString().replace('T', ' ').slice(0, 19)}
                    </td>

                    {/* Admin Identity */}
                    <td className="px-5 py-4">
                      <div className="font-bold text-white">{log.adminName}</div>
                      <div className="text-xs text-slate-400 font-mono">{log.adminEmail}</div>
                    </td>

                    {/* Action Badge */}
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono font-bold border ${
                        log.action === 'INVENTORY_ADJUSTED'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : log.action === 'OUTBOX_EVENT_REQUEUED'
                          ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}>
                        {log.action}
                      </span>
                    </td>

                    {/* Entity Type & ID */}
                    <td className="px-5 py-4">
                      <span className="font-semibold text-slate-300">{log.entityType}: </span>
                      <span className="font-mono text-xs text-slate-400">{log.entityId}</span>
                    </td>

                    {/* Safe Metadata Summary */}
                    <td className="px-5 py-4 text-xs font-mono text-slate-300 max-w-md">
                      {log.metadata ? (
                        <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-2 overflow-x-auto space-y-0.5">
                          {Object.entries(log.metadata).map(([k, v]) => (
                            <div key={k} className="flex space-x-2">
                              <span className="text-slate-500">{k}:</span>
                              <span className="text-indigo-300 font-bold">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">None</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {data.totalPages > 1 && (
          <div className="p-4 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div>
              Showing Page <span className="font-bold text-white">{data.page}</span> of <span className="font-bold text-white">{data.totalPages}</span>
            </div>
            <div className="flex space-x-2">
              {data.page > 1 ? (
                <Link
                  href={createPaginationUrl(data.page - 1)}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-200 transition-colors font-semibold"
                >
                  ← Previous
                </Link>
              ) : (
                <span className="px-3 py-1.5 bg-slate-950 border border-slate-800/50 rounded-lg text-slate-600 font-semibold cursor-not-allowed">
                  ← Previous
                </span>
              )}

              {data.page < data.totalPages ? (
                <Link
                  href={createPaginationUrl(data.page + 1)}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-200 transition-colors font-semibold"
                >
                  Next →
                </Link>
              ) : (
                <span className="px-3 py-1.5 bg-slate-950 border border-slate-800/50 rounded-lg text-slate-600 font-semibold cursor-not-allowed">
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
