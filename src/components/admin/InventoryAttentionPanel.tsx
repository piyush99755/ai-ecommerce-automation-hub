import Link from 'next/link';
import { InventoryAttentionItem } from '@/lib/admin-dashboard';

interface InventoryAttentionPanelProps {
  items: InventoryAttentionItem[];
}

export function InventoryAttentionPanel({ items }: InventoryAttentionPanelProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Inventory Attention</h3>
            <p className="text-xs text-slate-400 mt-0.5">Low-stock &amp; out-of-stock products</p>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
            {items.length} Flagged
          </span>
        </div>

        {items.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            ✓ All catalog products have healthy inventory levels above low-stock thresholds.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-sm text-white">{item.name}</div>
                  <div className="text-xs text-slate-400">
                    Category: {item.category} • Threshold: {item.lowStockThreshold}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-extrabold text-white">
                    {item.stock} <span className="text-xs font-normal text-slate-400">in stock</span>
                  </div>
                  {item.state === 'OUT_OF_STOCK' ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      OUT OF STOCK
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      LOW STOCK
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-800 text-right">
        <Link
          href="/admin/inventory"
          className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
        >
          Manage Inventory →
        </Link>
      </div>
    </div>
  );
}
