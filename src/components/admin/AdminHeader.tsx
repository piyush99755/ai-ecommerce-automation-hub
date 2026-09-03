'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface AdminHeaderProps {
  adminEmail: string;
  adminName: string;
  adminRole?: string;
}

export function AdminHeader({ adminEmail, adminName, adminRole }: AdminHeaderProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
      router.push('/admin/login');
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30 font-bold';
      case 'OPERATIONS':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30 font-bold';
      case 'SUPPORT':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30 font-bold';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center space-x-3">
        <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          PROD ENVIRONMENT
        </span>
        {adminRole && (
          <span className={`text-xs font-mono px-2.5 py-1 rounded-md border ${getRoleBadge(adminRole)}`}>
            {adminRole}
          </span>
        )}
      </div>

      <div className="flex items-center space-x-4">
        <div className="text-right">
          <div className="text-sm font-semibold text-white">{adminName}</div>
          <div className="text-xs text-slate-400 font-mono">{adminEmail}</div>
        </div>

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
        >
          {loggingOut ? 'Signing out...' : 'Sign Out'}
        </button>
      </div>
    </header>
  );
}
