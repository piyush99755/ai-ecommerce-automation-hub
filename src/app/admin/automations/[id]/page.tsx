import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAuthenticatedAdminServer } from '@/lib/admin-auth';
import { fetchDetailedAutomationWorkspace, formatCurrencyCents } from '@/lib/admin-automations';

export default async function AdminAutomationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Server-side authorization check before querying outbox details or rendering page
  const session = await getAuthenticatedAdminServer();
  if (!session) {
    redirect('/admin/login');
  }

  const { id } = await params;

  const workspace = await fetchDetailedAutomationWorkspace(id);

  if (!workspace) {
    return (
      <div className="space-y-6">
        <div>
          <Link href="/admin/automations" className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold">
            ← Back to Automation Console
          </Link>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
          Outbox Event with ID <span className="font-mono text-white">{id}</span> was not found in PostgreSQL.
        </div>
      </div>
    );
  }

  const {
    event,
    sanitizedPayloadJson,
    sanitizedLastError,
    relatedOrder,
    relatedCustomer,
    consumerEvents,
    timeline,
    evidenceNote,
  } = workspace;

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

  const getTimelineIcon = (type: string) => {
    switch (type) {
      case 'CREATED':
        return '📝';
      case 'ATTEMPT':
        return '⚙️';
      case 'RETRY_SCHEDULED':
        return '⏳';
      case 'DELIVERED':
        return '✅';
      case 'FAILED':
        return '🚨';
      default:
        return '📌';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/automations" className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold inline-block mb-2">
            ← Back to Automation Reliability Console
          </Link>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-3">
            <span>Event {event.shortId}</span>
            <span className={`text-xs font-bold px-3 py-1 rounded-lg border ${getStatusBadge(event.status)}`}>
              {event.status}
            </span>
          </h1>
          <p className="text-sm text-slate-400 font-mono mt-0.5">
            Type: {event.eventType} • Aggregate: {event.aggregateType} ({event.aggregateId.substring(0, 8)}...)
          </p>
        </div>
      </div>

      {/* Main Grid: Event Details & Reliability Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Event Summary, Entity Link, Failure Context, Payload & Consumer Events */}
        <div className="lg:col-span-2 space-y-6">
          {/* Event Summary Grid */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
            <h3 className="text-base font-bold text-white">Event Metadata</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="block text-slate-500 font-medium">Event ID</span>
                <span className="font-mono text-white font-semibold">{event.id}</span>
              </div>

              <div>
                <span className="block text-slate-500 font-medium">Event Type</span>
                <span className="font-mono text-indigo-300 font-bold">{event.eventType}</span>
              </div>

              <div>
                <span className="block text-slate-500 font-medium">Status</span>
                <span className={`font-bold px-2 py-0.5 rounded border inline-block mt-0.5 ${getStatusBadge(event.status)}`}>
                  {event.status}
                </span>
              </div>

              <div>
                <span className="block text-slate-500 font-medium">Aggregate Entity</span>
                <span className="text-slate-200">{event.aggregateType} ({event.aggregateId.substring(0, 8)}...)</span>
              </div>

              <div>
                <span className="block text-slate-500 font-medium">Attempt Count</span>
                <span className="font-mono text-white font-bold">{event.attemptCount}</span>
              </div>

              <div>
                <span className="block text-slate-500 font-medium">Enqueued At</span>
                <span className="font-mono text-slate-300">
                  {new Date(event.createdAt).toLocaleString()}
                </span>
              </div>

              <div>
                <span className="block text-slate-500 font-medium">Last Attempt</span>
                <span className="font-mono text-slate-300">
                  {event.lastAttemptAt ? new Date(event.lastAttemptAt).toLocaleString() : 'N/A'}
                </span>
              </div>

              <div>
                <span className="block text-slate-500 font-medium">Next Retry Scheduled</span>
                <span className="font-mono text-slate-300">
                  {event.nextAttemptAt ? new Date(event.nextAttemptAt).toLocaleString() : 'N/A'}
                </span>
              </div>

              <div>
                <span className="block text-slate-500 font-medium">Delivered At</span>
                <span className="font-mono text-emerald-400">
                  {event.deliveredAt ? new Date(event.deliveredAt).toLocaleString() : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Related Business Entity Panel */}
          {relatedOrder && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Related Order Entity</div>
                <div className="text-sm font-bold text-white mt-1">
                  Order {relatedOrder.shortId} • {relatedOrder.customerName} ({formatCurrencyCents(relatedOrder.totalCents)})
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Order Status: <span className="font-semibold text-white">{relatedOrder.status}</span> • Payment: <span className="font-semibold text-emerald-400">{relatedOrder.paymentStatus}</span>
                </div>
              </div>
              <Link
                href={`/admin/orders/${relatedOrder.id}`}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl transition-colors shadow-lg inline-block"
              >
                View Order Workspace →
              </Link>
            </div>
          )}

          {relatedCustomer && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Related Customer Entity</div>
                <div className="text-sm font-bold text-white mt-1">
                  {relatedCustomer.name} ({relatedCustomer.email})
                </div>
              </div>
              <Link
                href={`/admin/customers/${relatedCustomer.id}`}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl transition-colors shadow-lg inline-block"
              >
                View Customer Profile →
              </Link>
            </div>
          )}

          {/* Prominent Failure Context Banner (If FAILED) */}
          {event.status === 'FAILED' && (
            <div className="bg-rose-950/40 border-2 border-rose-500/50 rounded-2xl p-6 shadow-xl space-y-3">
              <div className="flex items-center space-x-2 text-rose-400 font-bold text-sm">
                <span>🚨</span>
                <span>Automated Retries Exhausted (Dead-Letter FAILED State)</span>
              </div>
              <p className="text-xs text-rose-200/90 leading-relaxed">
                This event failed after completing <span className="font-bold">{event.attemptCount}</span> automated worker retry attempt(s). Automated retry processing has stopped. Manual operational review is required.
              </p>
              {sanitizedLastError && (
                <div className="space-y-1">
                  <span className="block text-[11px] font-semibold text-rose-300 uppercase tracking-wider">Sanitized Error Output</span>
                  <pre className="p-3 bg-slate-950 border border-rose-900/50 rounded-xl text-xs font-mono text-rose-300 whitespace-pre-wrap overflow-x-auto">
                    {sanitizedLastError}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Sanitized Payload Viewer */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Event Payload (Sanitized)</h3>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Secrets Redacted</span>
            </div>
            <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-300 whitespace-pre-wrap overflow-x-auto">
              {sanitizedPayloadJson}
            </pre>
          </div>

          {/* ConsumerEvent Execution / Claims Visibility */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="p-5 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Consumer Processing Claims</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Downstream consumer processing logs associated with this event
              </p>
            </div>

            {consumerEvents.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No dedicated ConsumerEvent claim records registered for this outbox event ID in PostgreSQL.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-950/60 text-slate-400 text-xs font-semibold uppercase border-b border-slate-800">
                    <tr>
                      <th className="px-5 py-3">Consumer ID</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Attempts</th>
                      <th className="px-5 py-3">Claimed At</th>
                      <th className="px-5 py-3">Completed At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {consumerEvents.map((ce) => (
                      <tr key={ce.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-4 font-mono text-xs font-bold text-white">
                          {ce.consumerId}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${getStatusBadge(ce.status)}`}>
                            {ce.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs font-mono font-bold text-slate-300">
                          {ce.attemptCount}
                        </td>
                        <td className="px-5 py-4 text-xs font-mono text-slate-400">
                          {new Date(ce.claimedAt).toLocaleString()}
                        </td>
                        <td className="px-5 py-4 text-xs font-mono text-slate-400">
                          {ce.completedAt ? new Date(ce.completedAt).toLocaleString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Evidence Architecture Note */}
          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl text-xs text-slate-400 space-y-1">
            <div className="font-bold text-white flex items-center space-x-2">
              <span>📋</span>
              <span>Reliability Evidence Model</span>
            </div>
            <p className="leading-relaxed">{evidenceNote}</p>
          </div>
        </div>

        {/* Right Column (1 Col): Reliability Activity Timeline */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-6">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <span>⏱️</span>
              <span>Event Lifecycle Timeline</span>
            </h3>

            <div className="relative border-l border-slate-800 ml-3 space-y-6 pl-6">
              {timeline.map((item) => (
                <div key={item.id} className="relative">
                  {/* Icon Node */}
                  <span className="absolute -left-9 top-0 flex items-center justify-center w-6 h-6 rounded-full bg-slate-950 border border-slate-700 text-xs">
                    {getTimelineIcon(item.type)}
                  </span>

                  <div className="space-y-1">
                    <div className="text-xs font-bold text-white flex items-center justify-between">
                      <span>{item.title}</span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">
                      {new Date(item.timestamp).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 mt-1.5">
                      {item.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-800">
              Timeline events reflect persisted PostgreSQL snapshot timestamps.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
