import { redirect } from 'next/navigation';
import { authorizeAdminCapability } from '@/lib/admin-rbac';
import { fetchDashboardMetrics } from '@/lib/admin-dashboard';
import { DashboardKpis } from '@/components/admin/DashboardKpis';
import { RecentOrdersTable } from '@/components/admin/RecentOrdersTable';
import { InventoryAttentionPanel } from '@/components/admin/InventoryAttentionPanel';
import { AutomationHealthPanel } from '@/components/admin/AutomationHealthPanel';
import { OrderStatusDistribution } from '@/components/admin/OrderStatusDistribution';
import { AccessDenied } from '@/components/admin/AccessDenied';

export default async function AdminDashboardPage() {
  const auth = await authorizeAdminCapability('VIEW_DASHBOARD');
  if (!auth.authorized) {
    if (auth.status === 401) {
      redirect('/admin/login');
    }
    return <AccessDenied error={auth.error} capability="VIEW_DASHBOARD" />;
  }

  // Fetch real PostgreSQL metrics concurrently ONLY after authoritative capability verification
  const data = await fetchDashboardMetrics();

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Operations Overview</h1>
          <p className="text-sm text-slate-400 mt-1">
            Authoritative PostgreSQL metrics, stock threshold alerts, and n8n workflow health.
          </p>
        </div>
        <div className="text-right text-xs text-slate-400">
          <div>PostgreSQL Neon Direct</div>
          <div className="text-emerald-400 font-semibold mt-0.5">● Live Aggregations</div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <DashboardKpis
        totalRevenueCents={data.totalRevenueCents}
        totalOrdersCount={data.totalOrdersCount}
        paidOrdersCount={data.paidOrdersCount}
        processingOrdersCount={data.processingOrdersCount}
        lowStockProductsCount={data.lowStockProductsCount}
        failedAutomationsCount={data.failedAutomationsCount}
      />

      {/* Main Grid: Recent Orders & Operational Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Recent Orders Table */}
        <div className="lg:col-span-2 space-y-6">
          <RecentOrdersTable orders={data.recentOrders} />
          <OrderStatusDistribution
            distribution={data.orderStatusDistribution}
            totalOrders={data.totalOrdersCount}
          />
        </div>

        {/* Right Column (1 Col): Inventory Attention & Automation Health */}
        <div className="space-y-6">
          <InventoryAttentionPanel items={data.inventoryAttention} />
          <AutomationHealthPanel health={data.automationHealth} />
        </div>
      </div>
    </div>
  );
}
