import { InventoryMetricsSummary } from '@/lib/admin-inventory';

interface InventoryMetricsHeaderProps {
  metrics: InventoryMetricsSummary;
}

export function InventoryMetricsHeader({ metrics }: InventoryMetricsHeaderProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg border-l-4 border-l-indigo-500">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Products</div>
        <div className="text-2xl font-black text-white mt-1">{metrics.totalProducts}</div>
        <div className="text-[10px] text-slate-500 mt-2">Active catalog items</div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg border-l-4 border-l-emerald-500">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">In-Stock Products</div>
        <div className="text-2xl font-black text-emerald-400 mt-1">{metrics.inStockProducts}</div>
        <div className="text-[10px] text-slate-500 mt-2">Above low-stock threshold</div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg border-l-4 border-l-amber-500">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Low-Stock Products</div>
        <div className="text-2xl font-black text-amber-400 mt-1">{metrics.lowStockProducts}</div>
        <div className="text-[10px] text-slate-500 mt-2">Stock &gt; 0 &amp; &lt;= threshold</div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg border-l-4 border-l-rose-500">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Out-of-Stock Products</div>
        <div className={`text-2xl font-black mt-1 ${metrics.outOfStockProducts > 0 ? 'text-rose-500 font-extrabold' : 'text-slate-400'}`}>
          {metrics.outOfStockProducts}
        </div>
        <div className="text-[10px] text-slate-500 mt-2">Fully depleted stock</div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg border-l-4 border-l-sky-500">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Units on Hand</div>
        <div className="text-2xl font-black text-sky-400 mt-1">{metrics.totalUnitsOnHand.toLocaleString()}</div>
        <div className="text-[10px] text-slate-500 mt-2">Warehouse inventory volume</div>
      </div>
    </div>
  );
}
