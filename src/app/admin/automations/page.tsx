export default function AdminAutomationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">n8n Automations Console</h1>
        <p className="text-sm text-slate-400 mt-1">
          Transactional outbox delivery, ConsumerEvent claims, and workflow logs.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
        <div className="text-4xl mb-3">⚡</div>
        <h2 className="text-lg font-bold text-white mb-1">n8n Automations Shell</h2>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          Phase 1 Protected Shell active. Outbox event table viewer, failed event retry controls, and n8n webhook health status will be rendered here in Phase 2.
        </p>
      </div>
    </div>
  );
}
