import { CustomerTimelineItem } from '@/lib/customer-workspace';

interface CustomerActivityTimelineProps {
  timeline: CustomerTimelineItem[];
}

export function CustomerActivityTimeline({ timeline }: CustomerActivityTimelineProps) {
  if (timeline.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center text-xs text-slate-400">
        No recorded customer activity events.
      </div>
    );
  }

  const getTypeBadge = (type: CustomerTimelineItem['type']) => {
    switch (type) {
      case 'ACCOUNT':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'ORDER':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
      case 'PAYMENT':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'FULFILLMENT':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-6">
      <div>
        <h3 className="text-base font-bold text-white tracking-tight">Customer Activity History</h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Business-readable timeline derived from persisted PostgreSQL database evidence
        </p>
      </div>

      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2.5 before:bottom-2.5 before:w-0.5 before:bg-slate-800">
        {timeline.map((event) => (
          <div key={event.id} className="relative group">
            <span className="absolute -left-6 top-1.5 w-3 h-3 rounded-full ring-4 bg-indigo-500 ring-indigo-500/20" />

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white">{event.title}</h4>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getTypeBadge(event.type)}`}>
                  {event.type}
                </span>
              </div>

              <p className="text-xs text-slate-300">{event.detail}</p>

              <div className="text-[10px] text-slate-500 font-mono pt-1">
                {new Date(event.timestamp).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
