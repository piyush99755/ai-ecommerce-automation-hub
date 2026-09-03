import Link from 'next/link';

interface AccessDeniedProps {
  error?: string;
  capability?: string;
}

export function AccessDenied({ error, capability }: AccessDeniedProps) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-rose-950/40 border border-rose-800 rounded-3xl p-8 max-w-lg space-y-4 shadow-xl">
        <div className="text-4xl">🚫</div>
        <h1 className="text-xl font-bold text-white tracking-tight">403 — Access Denied</h1>
        <p className="text-sm text-slate-300">
          {error || 'You do not have authorization to access this page.'}
        </p>
        {capability && (
          <p className="text-xs text-slate-400">
            Required capability: <span className="font-mono text-amber-300">{capability}</span>
          </p>
        )}
        <div className="pt-2">
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition-colors border border-slate-700"
          >
            Return to Operations Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
