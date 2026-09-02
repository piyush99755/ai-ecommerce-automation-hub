import { TimelineEventItem } from '@/lib/order-timeline';

interface OrderActivityTimelineProps {
  timeline: TimelineEventItem[];
}

export function OrderActivityTimeline({ timeline }: OrderActivityTimelineProps) {
  if (timeline.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center text-slate-400 text-xs">
        No recorded lifecycle timeline events for this order.
      </div>
    );
  }

  const getStatusDot = (status: TimelineEventItem['status']) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-emerald-500 ring-emerald-500/20';
      case 'FAILED':
        return 'bg-rose-500 ring-rose-500/20';
      case 'PENDING':
        return 'bg-amber-500 ring-amber-500/20';
      default:
        return 'bg-indigo-500 ring-indigo-500/20';
    }
  };

  const getOutboxBadge = (status?: string) => {
    switch (status) {
      case 'DELIVERED':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'FAILED':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'PROCESSING':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      default:
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-6">
      <div>
        <h3 className="text-base font-bold text-white tracking-tight">Order Activity Timeline</h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Audited lifecycle history derived strictly from persisted PostgreSQL database evidence
        </p>
      </div>

      <div className="relative pl-6 space-y-8 before:absolute before:left-2.5 before:top-2.5 before:bottom-2.5 before:w-0.5 before:bg-slate-800">
        {timeline.map((event) => (
          <div key={event.id} className="relative group">
            {/* Timeline Circle Marker */}
            <span
              className={`absolute -left-6 top-1 w-3 h-3 rounded-full ring-4 ${getStatusDot(event.status)}`}
            />

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">{event.title}</h4>
                  {event.eventType && (
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="font-mono text-xs text-indigo-400 font-semibold">
                        {event.eventType}
                      </span>
                      {event.outboxStatus && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getOutboxBadge(event.outboxStatus)}`}>
                          {event.outboxStatus}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="text-right">
                  <div className="text-xs text-slate-400 font-mono">
                    {new Date(event.timestamp).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </div>
                  {event.attemptCount !== undefined && (
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Attempt {event.attemptCount}
                    </div>
                  )}
                </div>
              </div>

              <p className="text-xs text-slate-300">{event.detail}</p>

              {event.lastError && (
                <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-lg text-xs font-mono text-rose-300">
                  <span className="font-bold text-rose-400">Error:</span> {event.lastError}
                </div>
              )}

              {event.semanticsNote && (
                <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-[11px] text-slate-400 italic">
                  ℹ️ {event.semanticsNote}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
