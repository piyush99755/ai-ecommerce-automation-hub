import { formatCurrencyCents } from '@/lib/admin-dashboard';

interface DashboardKpisProps {
  totalRevenueCents: number;
  totalOrdersCount: number;
  paidOrdersCount: number;
  processingOrdersCount: number;
  lowStockProductsCount: number;
  failedAutomationsCount: number;
}

export function DashboardKpis({
  totalRevenueCents,
  totalOrdersCount,
  paidOrdersCount,
  processingOrdersCount,
  lowStockProductsCount,
  failedAutomationsCount,
}: DashboardKpisProps) {
  const kpis = [
    {
      title: 'Total Revenue',
      value: formatCurrencyCents(totalRevenueCents),
      subtitle: 'Legitimately PAID orders only',
      accentColor: 'border-l-4 border-l-emerald-500',
      valueColor: 'text-emerald-400',
    },
    {
      title: 'Total Orders',
      value: totalOrdersCount.toLocaleString(),
      subtitle: 'All persisted orders',
      accentColor: 'border-l-4 border-l-indigo-500',
      valueColor: 'text-white',
    },
    {
      title: 'Paid Orders',
      value: paidOrdersCount.toLocaleString(),
      subtitle: 'Stripe paymentStatus = PAID',
      accentColor: 'border-l-4 border-l-sky-500',
      valueColor: 'text-sky-400',
    },
    {
      title: 'Processing Orders',
      value: processingOrdersCount.toLocaleString(),
      subtitle: 'Order status = PROCESSING',
      accentColor: 'border-l-4 border-l-amber-500',
      valueColor: 'text-amber-400',
    },
    {
      title: 'Low Stock Products',
      value: lowStockProductsCount.toLocaleString(),
      subtitle: 'Stock > 0 & <= threshold',
      accentColor: lowStockProductsCount > 0 ? 'border-l-4 border-l-rose-500' : 'border-l-4 border-l-slate-700',
      valueColor: lowStockProductsCount > 0 ? 'text-rose-400' : 'text-slate-200',
    },
    {
      title: 'Failed Automations',
      value: failedAutomationsCount.toLocaleString(),
      subtitle: 'OutboxEvent status = FAILED',
      accentColor: failedAutomationsCount > 0 ? 'border-l-4 border-l-rose-600' : 'border-l-4 border-l-emerald-500',
      valueColor: failedAutomationsCount > 0 ? 'text-rose-500 font-black' : 'text-emerald-400',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {kpis.map((kpi) => (
        <div
          key={kpi.title}
          className={`bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between ${kpi.accentColor}`}
        >
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              {kpi.title}
            </div>
            <div className={`text-2xl font-black tracking-tight ${kpi.valueColor}`}>
              {kpi.value}
            </div>
          </div>
          <div className="text-xs text-slate-500 mt-3 pt-2 border-t border-slate-800/60">
            {kpi.subtitle}
          </div>
        </div>
      ))}
    </div>
  );
}
