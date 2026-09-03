import { DailyTrendPoint, formatCurrencyCents } from '@/lib/admin-analytics';

interface AnalyticsRevenueChartProps {
  data: DailyTrendPoint[];
  rangeLabel: string;
}

export function AnalyticsRevenueChart({ data, rangeLabel }: AnalyticsRevenueChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg text-center text-xs text-slate-400">
        No daily revenue trend data available for {rangeLabel}.
      </div>
    );
  }

  const maxRevenue = Math.max(...data.map((d) => d.revenueCents), 1);
  const totalRevenueCents = data.reduce((acc, d) => acc + d.revenueCents, 0);
  const totalPaidOrders = data.reduce((acc, d) => acc + d.paidOrders, 0);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-6">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center space-x-2">
            <span>📈</span>
            <span>Daily Revenue &amp; Paid Orders Trend</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Range: <span className="font-semibold text-indigo-300">{rangeLabel}</span> (UTC Grouped Daily Series)
          </p>
        </div>

        <div className="flex items-center space-x-6 text-xs">
          <div>
            <span className="block text-slate-500 font-medium">Range Revenue</span>
            <span className="font-mono text-emerald-400 font-bold text-sm">
              {formatCurrencyCents(totalRevenueCents)}
            </span>
          </div>
          <div>
            <span className="block text-slate-500 font-medium">Range Paid Orders</span>
            <span className="font-mono text-indigo-300 font-bold text-sm">
              {totalPaidOrders}
            </span>
          </div>
        </div>
      </div>

      {/* Lightweight Native Bar Chart Visualization */}
      <div className="space-y-2">
        <div className="h-48 flex items-end justify-between gap-1 pt-4 pb-2 px-2 bg-slate-950/60 border border-slate-800/80 rounded-xl overflow-x-auto">
          {data.map((point) => {
            const heightPercent = Math.max(Math.round((point.revenueCents / maxRevenue) * 100), 4);
            const dateLabel = point.date.split('-').slice(1).join('/'); // MM/DD
            return (
              <div
                key={point.date}
                className="flex-1 min-w-[12px] flex flex-col items-center justify-end h-full group relative"
              >
                {/* Tooltip on Hover */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-12 z-20 pointer-events-none bg-slate-950 border border-slate-700 text-slate-100 text-[10px] py-1 px-2 rounded-lg shadow-xl whitespace-nowrap font-mono">
                  <div className="font-bold text-white">{point.date}</div>
                  <div className="text-emerald-400">{formatCurrencyCents(point.revenueCents)}</div>
                  <div className="text-slate-400">{point.paidOrders} paid / {point.totalOrders} total</div>
                </div>

                {/* Revenue Bar */}
                <div
                  style={{ height: `${heightPercent}%` }}
                  className={`w-full max-w-[18px] rounded-t transition-all ${
                    point.revenueCents > 0
                      ? 'bg-gradient-to-t from-emerald-600 to-emerald-400 group-hover:from-emerald-500 group-hover:to-emerald-300'
                      : 'bg-slate-800/40'
                  }`}
                />
              </div>
            );
          })}
        </div>

        {/* Date Labels Axis */}
        <div className="flex justify-between text-[10px] font-mono text-slate-500 px-2 pt-1">
          <span>{data[0]?.date}</span>
          {data.length > 2 && <span>{data[Math.floor(data.length / 2)]?.date}</span>}
          <span>{data[data.length - 1]?.date}</span>
        </div>
      </div>
    </div>
  );
}
