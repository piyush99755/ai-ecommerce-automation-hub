import { redirect } from 'next/navigation';
import { authorizeAdminCapability } from '@/lib/admin-rbac';
import { AccessDenied } from '@/components/admin/AccessDenied';
import { AdminCopilotClient } from './AdminCopilotClient';

export default async function AdminCopilotPage() {
  const auth = await authorizeAdminCapability('USE_AI_COPILOT');
  if (!auth.authorized) {
    if (auth.status === 401) {
      redirect('/admin/login');
    }
    return <AccessDenied capability="USE_AI_COPILOT" error={auth.error} />;
  }

  const { admin } = auth;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2">
              <span>🧠</span>
              <span>Admin AI Operations Copilot</span>
            </h1>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-bold border uppercase tracking-wider ${
                admin.role === 'SUPER_ADMIN'
                  ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                  : admin.role === 'OPERATIONS'
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}
            >
              {admin.role}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Read-only operational assistant grounded strictly in authorized PostgreSQL database facts.
          </p>
        </div>

        <div className="text-xs text-slate-400 font-mono">
          User: <span className="text-slate-200 font-bold">{admin.email}</span>
        </div>
      </div>

      {/* Client Chat Workspace */}
      <AdminCopilotClient adminRole={admin.role} />
    </div>
  );
}
