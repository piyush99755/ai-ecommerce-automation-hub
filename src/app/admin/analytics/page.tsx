import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAuthenticatedAdminServer } from '@/lib/admin-auth';
import { fetchAnalyticsWorkspace, formatCurrencyCents } from '@/lib/admin-analytics';
import { AnalyticsDateFilter } from '@/components/admin/AnalyticsDateFilter';
import { AnalyticsRevenueChart } from '@/components/admin/AnalyticsRevenueChart';
import { authorizeAdminCapability } from '@/lib/admin-rbac';
import { AccessDenied } from '@/components/admin/AccessDenied';

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const auth = await authorizeAdminCapability('VIEW_ANALYTICS');
  if (!auth.authorized) {
    if (auth.status === 401) {
      redirect('/admin/login');
    }
    return <AccessDenied error={auth.error} capability="VIEW_ANALYTICS" />;
  }

  const { range } = await searchParams;

  // 2. Fetch Authoritative PostgreSQL Analytics via Parameterized SQL
  const data = await fetchAnalyticsWorkspace(range);

  const { kpis, dailyTrends, topProducts, topCustomersLtv, fulfillmentDistribution, inventoryHealth, topFailingEventTypes } = data;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-3">
            <span>📈</span>
            <span>Business Intelligence &amp; Operational Analytics</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Authoritative PostgreSQL aggregations. Timezone: <span className="font-mono text-indigo-300">UTC</span>.
          </p>
        </div>

        {/* Date Range Filter Controls */}
        <AnalyticsDateFilter currentRange={data.range} />
      </div>

      {/* Scope Disclaimer Banner */}
      <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-slate-400 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shadow-sm">
        <div className="flex items-center space-x-2">
          <span className="text-indigo-400 font-bold">ℹ️ Date Range Filter Scope:</span>
          <span>Filter applies to orders, revenue, top products, and outbox events created in <span className="text-white font-bold">{data.rangeLabel}</span>.</span>
        </div>
        <div className="text-[11px] text-slate-500 font-mono">
          Inventory, Repeat Customers, &amp; Order Status are Current/All-Time Snapshots.
        </div>
      </div>

      {/* KPI Cards Grid (Headline Metrics with Precise Labels) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Revenue Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-1">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Range Paid Revenue
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono tracking-tight">
            {formatCurrencyCents(kpis.revenueCents)}
          </div>
          <div className="text-[11px] text-slate-500">
            Revenue from PAID orders created in {data.rangeLabel}
          </div>
        </div>

        {/* Paid Orders Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-1">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Range Orders (Paid / Total)
          </div>
          <div className="text-2xl font-black text-white font-mono tracking-tight">
            {kpis.paidOrders} <span className="text-sm font-normal text-slate-400">/ {kpis.totalOrders}</span>
          </div>
          <div className="text-[11px] text-slate-500">
            Paid Order Rate: <span className="font-bold text-indigo-300">{kpis.paidOrderRate}%</span> in {data.rangeLabel}
          </div>
        </div>

        {/* Average Order Value (AOV) Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-1">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Range Avg Order Value (AOV)
          </div>
          <div className="text-2xl font-black text-indigo-300 font-mono tracking-tight">
            {formatCurrencyCents(kpis.aovCents)}
          </div>
          <div className="text-[11px] text-slate-500">
            Range Paid Revenue / Range Paid Orders
          </div>
        </div>

        {/* Repeat Customers Card (All-Time) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-1">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Repeat Customers (All-Time)
          </div>
          <div className="text-2xl font-black text-purple-400 font-mono tracking-tight">
            {kpis.repeatCustomersCount}
          </div>
          <div className="text-[11px] text-slate-500">
            All-Time distinct customers with ≥ 2 PAID orders
          </div>
        </div>

        {/* Total Customers Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-1">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Customers (All-Time)
          </div>
          <div className="text-2xl font-black text-white font-mono tracking-tight">
            {kpis.totalCustomersCount}
          </div>
          <div className="text-[11px] text-slate-500">
            +{kpis.newCustomersInRange} new registrations in {data.rangeLabel}
          </div>
        </div>

        {/* Current Stock On Hand Card (Current-State) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-1">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Stock On Hand (Current-State)
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono tracking-tight">
            {inventoryHealth.totalUnitsOnHand}
          </div>
          <div className="text-[11px] text-slate-500">
            {inventoryHealth.lowStockCount} low stock • {inventoryHealth.outOfStockCount} out of stock
          </div>
        </div>

        {/* Range Outbox Events Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-1">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Outbox Events Created
          </div>
          <div className="text-2xl font-black text-slate-200 font-mono tracking-tight">
            {kpis.automationTotalEvents}
          </div>
          <div className="text-[11px] text-slate-500">
            Events created in {data.rangeLabel} ({kpis.automationDeliveredEvents} delivered)
          </div>
        </div>

        {/* Range Failure Rate Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-1">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Event Failure Rate
          </div>
          <div className={`text-2xl font-black font-mono tracking-tight ${
            kpis.automationFailureRate > 0 ? 'text-rose-400' : 'text-emerald-400'
          }`}>
            {kpis.automationFailureRate}%
          </div>
          <div className="text-[11px] text-slate-500">
            FAILED outcome rate among events created in range
          </div>
        </div>
      </div>

      {/* Daily Trends Section */}
      <AnalyticsRevenueChart data={dailyTrends} rangeLabel={data.rangeLabel} />

      {/* Main Grid: Top Products, Top Customers, Fulfillment Distribution & Reliability */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Top Products & Top Customers */}
        <div className="lg:col-span-2 space-y-6">
          {/* Top Products Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg space-y-0">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <span>🏆</span>
                  <span>Top Products by Range Paid Revenue ({data.rangeLabel})</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Calculated from PAID orders created in {data.rangeLabel} using persisted <span className="font-mono text-indigo-300">OrderItem.unitPriceCents</span> historical snapshot price
                </p>
              </div>
              <span className="text-xs font-mono text-slate-400 bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-lg">
                {topProducts.length} Items
              </span>
            </div>

            {topProducts.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No paid product orders recorded in {data.rangeLabel}.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-950/60 text-slate-400 text-xs font-semibold uppercase border-b border-slate-800">
                    <tr>
                      <th className="px-5 py-3">Product</th>
                      <th className="px-5 py-3">Units Sold</th>
                      <th className="px-5 py-3">Paid Orders</th>
                      <th className="px-5 py-3 text-right">Revenue Attributed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {topProducts.map((prod) => (
                      <tr key={prod.productId} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-4">
                          <Link href={`/admin/inventory/${prod.productId}`} className="font-bold text-white hover:text-indigo-400 transition-colors">
                            {prod.productName}
                          </Link>
                          <div className="text-xs text-slate-500 font-mono">/products/{prod.productSlug}</div>
                        </td>
                        <td className="px-5 py-4 font-mono font-bold text-slate-200">
                          {prod.unitsSold}
                        </td>
                        <td className="px-5 py-4 font-mono text-xs text-slate-400">
                          {prod.paidOrdersCount}
                        </td>
                        <td className="px-5 py-4 font-mono font-bold text-emerald-400 text-right">
                          {formatCurrencyCents(prod.revenueCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Top 5 Highest-LTV Customers Table (All-Time) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg space-y-0">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <span>💎</span>
                  <span>Top 5 Customers by All-Time Lifetime Value (LTV)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Sum of all-time historical paid orders per customer account (Excludes unpaid/pending orders)
                </p>
              </div>
              <span className="text-xs font-mono text-slate-400 bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-lg">
                All-Time Top 5
              </span>
            </div>

            {topCustomersLtv.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No customer orders recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-950/60 text-slate-400 text-xs font-semibold uppercase border-b border-slate-800">
                    <tr>
                      <th className="px-5 py-3">Customer</th>
                      <th className="px-5 py-3">Paid Orders</th>
                      <th className="px-5 py-3 text-right">All-Time LTV</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {topCustomersLtv.map((cust) => (
                      <tr key={cust.customerId} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-4">
                          <Link href={`/admin/customers/${cust.customerId}`} className="font-bold text-white hover:text-indigo-400 transition-colors">
                            {cust.customerName}
                          </Link>
                          <div className="text-xs text-slate-400 font-mono">{cust.customerEmail}</div>
                        </td>
                        <td className="px-5 py-4 font-mono text-xs font-bold text-slate-300">
                          {cust.paidOrdersCount}
                        </td>
                        <td className="px-5 py-4 font-mono font-bold text-emerald-400 text-right">
                          {formatCurrencyCents(cust.lifetimeValueCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1 Col): Order Status Distribution & Reliability Analytics */}
        <div className="space-y-6">
          {/* Current Order Status Distribution (Current-State Snapshot) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <span>📦</span>
                <span>Current Fulfillment Status</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Current order lifecycle state snapshot (Current-State Distribution)
              </p>
            </div>

            <div className="space-y-3">
              {fulfillmentDistribution.map((item) => (
                <div key={item.status} className="space-y-1 text-xs">
                  <div className="flex justify-between font-semibold">
                    <span className="text-slate-300">{item.status}</span>
                    <span className="font-mono text-slate-400">{item.count} ({item.percentage}%)</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div
                      style={{ width: `${item.percentage}%` }}
                      className={`h-full rounded-full ${
                        item.status === 'PROCESSING'
                          ? 'bg-indigo-500'
                          : item.status === 'DELIVERED'
                          ? 'bg-emerald-500'
                          : item.status === 'SHIPPED'
                          ? 'bg-blue-500'
                          : item.status === 'PENDING'
                          ? 'bg-amber-500'
                          : 'bg-slate-700'
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Failing Event Types Panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <span>⚡</span>
                <span>Top Failing Event Types</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Top FAILED event types among events created in {data.rangeLabel}
              </p>
            </div>

            {topFailingEventTypes.length === 0 ? (
              <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl text-center text-xs text-emerald-400 font-semibold">
                ✓ Zero failed outbox events created in {data.rangeLabel}!
              </div>
            ) : (
              <div className="space-y-2.5">
                {topFailingEventTypes.map((item) => (
                  <div key={item.eventType} className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-rose-300">{item.eventType}</span>
                    <span className="font-mono font-extrabold text-rose-400 bg-rose-950/60 border border-rose-800 px-2 py-0.5 rounded">
                      {item.failedCount} Failed
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
