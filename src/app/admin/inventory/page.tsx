export default function AdminInventoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Inventory Control Console</h1>
        <p className="text-sm text-slate-400 mt-1">
          Stock levels, threshold alerts, and atomic concurrency monitoring.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
        <div className="text-4xl mb-3">🏬</div>
        <h2 className="text-lg font-bold text-white mb-1">Inventory Control Shell</h2>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          Phase 1 Protected Shell active. Catalogue stock levels, low-stock threshold triggers, and inventory adjustment controls will be rendered here in Phase 2.
        </p>
      </div>
    </div>
  );
}
