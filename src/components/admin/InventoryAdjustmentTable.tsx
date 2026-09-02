import { InventoryAdjustmentItem } from '@/lib/inventory-workspace';

interface InventoryAdjustmentTableProps {
  adjustments: InventoryAdjustmentItem[];
}

export function InventoryAdjustmentTable({ adjustments }: InventoryAdjustmentTableProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg space-y-0">
      <div className="p-5 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white flex items-center space-x-2">
            <span>🛡️</span>
            <span>Manual Admin Adjustment History</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit log of manual stock delta mutations executed by authenticated admins
          </p>
        </div>
        <div className="text-xs text-slate-500 font-mono">
          {adjustments.length} adjustment records
        </div>
      </div>

      {adjustments.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-400">
          No manual stock adjustments have been recorded for this product.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950/60 text-slate-400 text-xs font-semibold uppercase border-b border-slate-800">
              <tr>
                <th className="px-5 py-3">Timestamp</th>
                <th className="px-5 py-3">Admin</th>
                <th className="px-5 py-3">Stock Change</th>
                <th className="px-5 py-3">Delta</th>
                <th className="px-5 py-3">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {adjustments.map((adj) => (
                <tr key={adj.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-5 py-4 text-xs font-mono text-slate-400">
                    {new Date(adj.createdAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-semibold text-white">{adj.adminName}</div>
                    <div className="text-xs text-slate-400 font-mono">{adj.adminEmail}</div>
                  </td>
                  <td className="px-5 py-4 text-xs font-bold text-white">
                    {adj.previousStock} → {adj.newStock} units
                  </td>
                  <td className="px-5 py-4">
                    {adj.delta > 0 ? (
                      <span className="text-xs font-black px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md">
                        +{adj.delta}
                      </span>
                    ) : (
                      <span className="text-xs font-black px-2.5 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-md">
                        {adj.delta}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-300">
                    {adj.reason}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
