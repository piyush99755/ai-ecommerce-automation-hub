interface OrderStatusDistributionProps {
  distribution: Record<string, number>;
  totalOrders: number;
}

export function OrderStatusDistribution({ distribution, totalOrders }: OrderStatusDistributionProps) {
  const statusColors: Record<string, { bg: string; text: string; bar: string }> = {
    PENDING: { bg: 'bg-amber-500/10', text: 'text-amber-400', bar: 'bg-amber-500' },
    PROCESSING: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', bar: 'bg-indigo-500' },
    ON_HOLD: { bg: 'bg-purple-500/10', text: 'text-purple-400', bar: 'bg-purple-500' },
    SHIPPED: { bg: 'bg-sky-500/10', text: 'text-sky-400', bar: 'bg-sky-500' },
    DELIVERED: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', bar: 'bg-emerald-500' },
    CANCELLED: { bg: 'bg-rose-500/10', text: 'text-rose-400', bar: 'bg-rose-500' },
  };

  const statuses = ['PENDING', 'PROCESSING', 'ON_HOLD', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight">Order Status Distribution</h3>
          <p className="text-xs text-slate-400 mt-0.5">Fulfillment lifecycle breakdown</p>
        </div>
        <span className="text-xs font-bold text-slate-400">
          {totalOrders} Total Orders
        </span>
      </div>

      <div className="space-y-3">
        {statuses.map((status) => {
          const count = distribution[status] || 0;
          const percentage = totalOrders > 0 ? Math.round((count / totalOrders) * 100) : 0;
          const conf = statusColors[status] || { bg: 'bg-slate-800', text: 'text-slate-300', bar: 'bg-slate-500' };

          return (
            <div key={status} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className={`font-semibold ${conf.text}`}>{status}</span>
                <span className="text-slate-400 font-medium">
                  {count} ({percentage}%)
                </span>
              </div>
              <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                <div
                  className={`h-full ${conf.bar} transition-all duration-500`}
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
