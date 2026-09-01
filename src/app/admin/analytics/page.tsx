export default function AdminAnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Analytics &amp; Performance Console</h1>
        <p className="text-sm text-slate-400 mt-1">
          Storefront sales trends, conversion rates, and automation processing latency.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
        <div className="text-4xl mb-3">📈</div>
        <h2 className="text-lg font-bold text-white mb-1">Analytics Shell</h2>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          Phase 1 Protected Shell active. Sales volume charts, fulfillment throughput latency, and outbox delivery metrics will be rendered here in Phase 2.
        </p>
      </div>
    </div>
  );
}
