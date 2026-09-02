import { CrmSyncEvidenceSummary } from '@/lib/customer-workspace';

interface CrmSyncPanelProps {
  crmSync: CrmSyncEvidenceSummary;
}

export function CrmSyncPanel({ crmSync }: CrmSyncPanelProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight">HubSpot CRM Integration Context</h3>
          <p className="text-xs text-slate-400 mt-0.5">Automated Contact &amp; Deal Synchronization</p>
        </div>
        <span className="text-xs font-bold px-2.5 py-1 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          {crmSync.statusLabel}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-center">
          <div className="text-xs text-slate-400 font-semibold">Outbox Events</div>
          <div className="text-lg font-bold text-white mt-1">{crmSync.outboxEventCount}</div>
        </div>

        <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-center">
          <div className="text-xs text-slate-400 font-semibold">Delivered</div>
          <div className="text-lg font-bold text-emerald-400 mt-1">{crmSync.deliveredCount}</div>
        </div>

        <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-center">
          <div className="text-xs text-slate-400 font-semibold">Failed Retries</div>
          <div className={`text-lg font-bold mt-1 ${crmSync.failedCount > 0 ? 'text-rose-500' : 'text-slate-400'}`}>
            {crmSync.failedCount}
          </div>
        </div>
      </div>

      <div className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl text-xs text-slate-400 leading-relaxed italic">
        ℹ️ <span className="font-semibold text-slate-300">Persisted Evidence Note:</span> {crmSync.evidenceNote}
      </div>
    </div>
  );
}
