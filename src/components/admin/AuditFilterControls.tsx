'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export interface AuditFilterControlsProps {
  currentAction: string;
  currentEntityType: string;
  actionsList: string[];
  entityTypesList: string[];
}

export function AuditFilterControls({
  currentAction,
  currentEntityType,
  actionsList,
  entityTypesList,
}: AuditFilterControlsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleFilterChange = (key: string, val: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (val && val !== 'ALL') {
      params.set(key, val);
    } else {
      params.delete(key);
    }
    params.set('page', '1'); // Reset to page 1 on filter change
    router.push(`/admin/audit?${params.toString()}`);
  };

  return (
    <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-wrap items-center gap-4 text-xs">
      {/* Action Filter */}
      <div className="flex items-center space-x-2">
        <label className="text-slate-400 font-semibold uppercase tracking-wider">Action:</label>
        <select
          value={currentAction}
          onChange={(e) => handleFilterChange('action', e.target.value)}
          className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500 font-mono"
        >
          <option value="ALL">All Actions</option>
          {actionsList.map((act) => (
            <option key={act} value={act}>
              {act}
            </option>
          ))}
        </select>
      </div>

      {/* Entity Type Filter */}
      <div className="flex items-center space-x-2">
        <label className="text-slate-400 font-semibold uppercase tracking-wider">Entity Type:</label>
        <select
          value={currentEntityType}
          onChange={(e) => handleFilterChange('entityType', e.target.value)}
          className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500 font-mono"
        >
          <option value="ALL">All Entity Types</option>
          {entityTypesList.map((ent) => (
            <option key={ent} value={ent}>
              {ent}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
