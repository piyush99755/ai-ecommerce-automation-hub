import Link from 'next/link';

export default function AdminDashboardPage() {
  const metrics = [
    {
      title: 'Total Revenue',
      value: '$1,429.50',
      change: '+14.2% vs last week',
      tag: '[DEMO METRIC]',
      tagColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    },
    {
      title: 'Total Orders',
      value: '12',
      change: '100% Stripe Verified',
      tag: '[DEMO METRIC]',
      tagColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    },
    {
      title: 'Processing Orders',
      value: '3',
      change: 'Outbox Fan-out Active',
      tag: '[DEMO METRIC]',
      tagColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    },
    {
      title: 'Low Stock Items',
      value: '2',
      change: 'Threshold <= 5 units',
      tag: '[DEMO METRIC]',
      tagColor: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    },
    {
      title: 'Failed Automations',
      value: '0',
      change: '100% Outbox Success Rate',
      tag: '[SYSTEM HEALTH]',
      tagColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    },
  ];

  const quickNav = [
    {
      title: 'Orders Management',
      desc: 'Inspect order fulfillment lifecycle, payment statuses, and tracking dispatch.',
      href: '/admin/orders',
      icon: '📦',
    },
    {
      title: 'Customer CRM',
      desc: 'View customer purchase records and HubSpot CRM synchronization state.',
      href: '/admin/customers',
      icon: '👥',
    },
    {
      title: 'Inventory Control',
      desc: 'Manage product stock levels, threshold limits, and atomic stock decrements.',
      href: '/admin/inventory',
      icon: '🏬',
    },
    {
      title: 'n8n Automations',
      desc: 'Monitor outbox event delivery, two-phase claims, and Discord operations alerts.',
      href: '/admin/automations',
      icon: '⚡',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Operations Overview</h1>
        <p className="text-sm text-slate-400 mt-1">
          Real-time summary of storefront sales, inventory levels, and n8n workflow health.
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {metrics.map((m) => (
          <div
            key={m.title}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-400">{m.title}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${m.tagColor}`}>
                  {m.tag}
                </span>
              </div>
              <div className="text-2xl font-extrabold text-white">{m.value}</div>
            </div>
            <div className="text-xs text-slate-500 mt-4 pt-3 border-t border-slate-800/60">
              {m.change}
            </div>
          </div>
        ))}
      </div>

      {/* Operations Quick Console Navigation */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4">Operations Consoles</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quickNav.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className="group bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-6 transition-all duration-200 shadow-lg hover:shadow-indigo-500/5"
            >
              <div className="flex items-start space-x-4">
                <div className="text-3xl p-3 bg-slate-950 rounded-xl border border-slate-800 group-hover:border-indigo-500/30 transition-colors">
                  {card.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-white group-hover:text-indigo-400 transition-colors">
                      {card.title}
                    </h3>
                    <span className="text-slate-500 group-hover:translate-x-1 transition-transform">
                      →
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 mt-1">{card.desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
