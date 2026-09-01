import Link from 'next/link';
import { AutomationHealthSummary } from '@/lib/admin-dashboard';

interface AutomationHealthPanelProps {
  health: AutomationHealthSummary;
}

export function AutomationHealthPanel({ health }: AutomationHealthPanelProps) {
  const totalEvents = health.pending + health.processing + health.delivered + health.failed;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Automation Health</h3>
            <p className="text-xs text-slate-400 mt-0.5">n8n Transactional Outbox Event Engine</p>
          </div>
          {health.failed > 0 ? (
            <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20">
              {health.failed} Failed
            </span>
          ) : (
            <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              ✓ All Healthy
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <div className="text-xs font-semibold text-slate-400">Delivered Events</div>
            <div className="text-xl font-extrabold text-emerald-400 mt-1">{health.delivered}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Authoritative Outbox State</div>
          </div>

          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <div className="text-xs font-semibold text-slate-400">Pending Outbox</div>
            <div className="text-xl font-extrabold text-amber-400 mt-1">{health.pending}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Queued for Dispatch</div>
          </div>

          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <div className="text-xs font-semibold text-slate-400">Processing Claims</div>
            <div className="text-xl font-extrabold text-indigo-400 mt-1">{health.processing}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Two-Phase Claim Active</div>
          </div>

          <div className={`p-3 bg-slate-950/60 rounded-xl border ${health.failed > 0 ? 'border-rose-500/50 bg-rose-950/10' : 'border-slate-800'}`}>
            <div className="text-xs font-semibold text-slate-400">Failed Events</div>
            <div className={`text-xl font-extrabold mt-1 ${health.failed > 0 ? 'text-rose-500' : 'text-slate-400'}`}>
              {health.failed}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Max Retries Exhausted</div>
          </div>
        </div>

        <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/60 flex items-center justify-between text-xs">
          <span className="text-slate-400">Total Outbox Log Volume:</span>
          <span className="font-bold text-white">{totalEvents} Events</span>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-800 text-right">
        <Link
          href="/admin/automations"
          className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
        >
          View Automations Log →
        </Link>
      </div>
    </div>
  );
}
