export default function AdminOrdersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Orders Console</h1>
        <p className="text-sm text-slate-400 mt-1">
          Inspect order status, payment claims, and tracking dispatch.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
        <div className="text-4xl mb-3">📦</div>
        <h2 className="text-lg font-bold text-white mb-1">Orders Management Shell</h2>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          Phase 1 Protected Shell active. Full order list, status filters, and manual status override tools will be rendered here in Phase 2.
        </p>
      </div>
    </div>
  );
}
