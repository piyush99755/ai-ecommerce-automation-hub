import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAuthenticatedAdminServer } from '@/lib/admin-auth';
import { fetchOutboxEventsPage } from '@/lib/admin-automations';
import { OutboxMetricsHeader } from '@/components/admin/OutboxMetricsHeader';
import { OutboxTableFilterControls } from '@/components/admin/OutboxTableFilterControls';

export default async function AdminAutomationsListPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    eventType?: string;
    page?: string;
  }>;
}) {
  // Server-side authorization check before querying outbox events or rendering page
  const session = await getAuthenticatedAdminServer();
  if (!session) {
    redirect('/admin/login');
  }

  const { q = '', status = 'ALL', eventType = 'ALL', page = '1' } = await searchParams;
  const pageNum = parseInt(page, 10) || 1;

  const data = await fetchOutboxEventsPage({
    q,
    status,
    eventType,
    page: pageNum,
    pageSize: 15,
  });

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'PENDING':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'PROCESSING':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'DELIVERED':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'FAILED':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/40 font-extrabold shadow-sm shadow-rose-950';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const createPaginationUrl = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status !== 'ALL') params.set('status', status);
    if (eventType !== 'ALL') params.set('eventType', eventType);
    params.set('page', p.toString());
    return `/admin/automations?${params.toString()}`;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Automation Reliability Console</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Operational Outbox event monitoring, retry tracking, and failure context
          </p>
        </div>
        <div className="flex items-center space-x-2 text-xs font-mono text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
          <span>Read-Only Operations</span>
        </div>
      </div>

      {/* Operational KPI Cards */}
      <OutboxMetricsHeader metrics={data.metrics} />

      {/* Filter Controls */}
      <OutboxTableFilterControls
        initialSearch={q}
        initialStatus={status}
        initialEventType={eventType}
        eventTypes={data.eventTypes}
        statuses={data.statuses}
      />

      {/* Events Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg space-y-0">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Transactional Outbox Events</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Authoritative PostgreSQL event queue state (Sorted newest first)
            </p>
          </div>
          <div className="text-xs text-slate-400 font-mono">
            Showing {data.events.length} of {data.totalMatched} matched events
          </div>
        </div>

        {data.events.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No outbox events match the selected search or filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/60 text-slate-400 text-xs font-semibold uppercase border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3">Event ID</th>
                  <th className="px-5 py-3">Event Type</th>
                  <th className="px-5 py-3">Aggregate Entity</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Attempts</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3">Last Attempt</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {data.events.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-4 font-mono text-xs font-semibold text-slate-300">
                      {e.shortId}
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs font-mono font-bold text-white bg-slate-950 border border-slate-800 px-2 py-0.5 rounded">
                        {e.eventType}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-xs font-semibold text-white">{e.aggregateType}</div>
                      <div className="text-xs text-slate-400 font-mono">{e.shortAggregateId}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md border ${getStatusBadge(e.status)}`}>
                        {e.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs font-mono font-bold text-slate-300">
                      {e.attemptCount}
                    </td>
                    <td className="px-5 py-4 text-xs font-mono text-slate-400">
                      {new Date(e.createdAt).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-5 py-4 text-xs font-mono text-slate-400">
                      {e.lastAttemptAt
                        ? new Date(e.lastAttemptAt).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/admin/automations/${e.id}`}
                        className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-lg border border-slate-700 transition-colors inline-block"
                      >
                        View Event →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {data.totalPages > 1 && (
          <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div>
              Page <span className="font-bold text-white">{data.page}</span> of{' '}
              <span className="font-bold text-white">{data.totalPages}</span>
            </div>
            <div className="flex items-center space-x-2">
              {data.page > 1 ? (
                <Link
                  href={createPaginationUrl(data.page - 1)}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 font-semibold text-slate-200 rounded-lg border border-slate-700 transition-colors"
                >
                  ← Previous
                </Link>
              ) : (
                <span className="px-3.5 py-1.5 bg-slate-950 text-slate-600 font-semibold rounded-lg border border-slate-900 cursor-not-allowed">
                  ← Previous
                </span>
              )}

              {data.page < data.totalPages ? (
                <Link
                  href={createPaginationUrl(data.page + 1)}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 font-semibold text-slate-200 rounded-lg border border-slate-700 transition-colors"
                >
                  Next →
                </Link>
              ) : (
                <span className="px-3.5 py-1.5 bg-slate-950 text-slate-600 font-semibold rounded-lg border border-slate-900 cursor-not-allowed">
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
