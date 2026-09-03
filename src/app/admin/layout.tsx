import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAuthenticatedAdminServer } from '@/lib/admin-auth';
import { getFreshAdmin, hasAdminCapability } from '@/lib/admin-rbac';
import { AdminHeader } from '@/components/admin/AdminHeader';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuthenticatedAdminServer();

  if (!session) {
    return <>{children}</>;
  }

  // Fetch fresh Admin record to ensure 100% role freshness in navigation UI
  const admin = await getFreshAdmin(session.id);
  const role = admin ? admin.role : 'SUPPORT';

  const navItems = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: '📊', capability: 'VIEW_DASHBOARD' as const },
    { name: 'Orders', href: '/admin/orders', icon: '📦', capability: 'VIEW_ORDERS' as const },
    { name: 'Customers', href: '/admin/customers', icon: '👥', capability: 'VIEW_CUSTOMERS' as const },
    { name: 'Inventory', href: '/admin/inventory', icon: '🏬', capability: 'VIEW_INVENTORY' as const },
    { name: 'Automations', href: '/admin/automations', icon: '⚡', capability: 'VIEW_AUTOMATIONS' as const },
    { name: 'Analytics', href: '/admin/analytics', icon: '📈', capability: 'VIEW_ANALYTICS' as const },
    { name: 'Audit Trail', href: '/admin/audit', icon: '🛡️', capability: 'VIEW_AUDIT_LOG' as const },
  ];

  const visibleNavItems = navItems.filter((item) => hasAdminCapability(role, item.capability));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col flex-shrink-0">
        <div className="p-6 border-b border-slate-800 flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center font-black text-white text-lg">
            Hub
          </div>
          <div>
            <div className="font-bold text-white tracking-tight">E-commerce Ops</div>
            <div className="text-xs text-slate-400">Admin Control Center</div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {visibleNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.name}</span>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Outbox &amp; CRM Engine
            </div>
            <div className="text-xs text-slate-300 flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>n8n Active (7 Workflows)</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader adminEmail={session.email} adminName={session.name} adminRole={role} />
        <main className="flex-1 p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
