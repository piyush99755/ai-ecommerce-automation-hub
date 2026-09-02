import { AutomationMetricsData } from '@/lib/admin-automations';

interface OutboxMetricsHeaderProps {
  metrics: AutomationMetricsData;
}

export function OutboxMetricsHeader({ metrics }: OutboxMetricsHeaderProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {/* Pending */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-1">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending</div>
        <div className="text-2xl font-black text-amber-400">{metrics.pending}</div>
        <div className="text-[10px] text-slate-500">Awaiting processing</div>
      </div>

      {/* Processing */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-1">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Processing</div>
        <div className="text-2xl font-black text-indigo-400">{metrics.processing}</div>
        <div className="text-[10px] text-slate-500">Active worker claim</div>
      </div>

      {/* Delivered */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-1">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Delivered</div>
        <div className="text-2xl font-black text-emerald-400">{metrics.delivered}</div>
        <div className="text-[10px] text-slate-500">Dispatch acknowledged</div>
      </div>

      {/* Failed (Prominent) */}
      <div className={`bg-slate-900 rounded-2xl p-4 shadow-lg space-y-1 border ${
        metrics.failed > 0
          ? 'border-rose-500/50 bg-rose-950/20'
          : 'border-slate-800'
      }`}>
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
          <span>Failed</span>
          {metrics.failed > 0 && <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />}
        </div>
        <div className="text-2xl font-black text-rose-400">{metrics.failed}</div>
        <div className="text-[10px] text-slate-500">Retries exhausted</div>
      </div>

      {/* Total Events */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-1 col-span-2 md:col-span-1">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Events</div>
        <div className="text-2xl font-black text-white">{metrics.totalEvents}</div>
        <div className="text-[10px] text-slate-500">Persisted Outbox events</div>
      </div>
    </div>
  );
}
