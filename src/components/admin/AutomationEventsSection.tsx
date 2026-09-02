import { OrderOutboxEventSummary } from '@/lib/order-timeline';

interface AutomationEventsSectionProps {
  outboxEvents: OrderOutboxEventSummary[];
}

export function AutomationEventsSection({ outboxEvents }: AutomationEventsSectionProps) {
  if (outboxEvents.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center text-xs text-slate-400">
        No OutboxEvent automation records associated with this order.
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DELIVERED':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'FAILED':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20 font-bold';
      case 'PROCESSING':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      default:
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg space-y-4">
      <div className="p-5 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight">Automation Outbox Events</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Read-only record of transactional outbox dispatches for this order
          </p>
        </div>
        <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-950 text-slate-400 border border-slate-800">
          {outboxEvents.length} Events Logged
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/60 text-slate-400 font-semibold uppercase border-b border-slate-800">
            <tr>
              <th className="px-5 py-3">Event Type</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Attempts</th>
              <th className="px-5 py-3">Created At</th>
              <th className="px-5 py-3">Delivered At</th>
              <th className="px-5 py-3">Error Info</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {outboxEvents.map((e) => (
              <tr key={e.id} className={e.status === 'FAILED' ? 'bg-rose-950/20' : 'hover:bg-slate-800/30'}>
                <td className="px-5 py-3.5 font-mono font-bold text-white">
                  {e.eventType}
                </td>
                <td className="px-5 py-3.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getStatusBadge(e.status)}`}>
                    {e.status}
                  </span>
                </td>
                <td className="px-5 py-3.5 font-mono">
                  {e.attemptCount}
                </td>
                <td className="px-5 py-3.5 text-slate-400">
                  {new Date(e.createdAt).toLocaleString()}
                </td>
                <td className="px-5 py-3.5 text-slate-400">
                  {e.deliveredAt ? new Date(e.deliveredAt).toLocaleString() : '—'}
                </td>
                <td className="px-5 py-3.5">
                  {e.lastError ? (
                    <span
                      className="font-mono text-rose-400 text-[11px] block max-w-xs truncate"
                      title={String(e.lastError)}
                    >
                      {String(e.lastError)}
                    </span>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
