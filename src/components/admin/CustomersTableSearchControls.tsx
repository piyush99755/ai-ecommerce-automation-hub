'use me';
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export function CustomersTableSearchControls() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get('q') || '');

  const handleSearch = (newQ = q) => {
    const params = new URLSearchParams();
    if (newQ.trim()) params.set('q', newQ.trim());
    params.set('page', '1');

    router.push(`/admin/customers?${params.toString()}`);
  };

  const handleReset = () => {
    setQ('');
    router.push('/admin/customers');
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center justify-between">
      <div className="flex-1 max-w-md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="relative"
        >
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search customer by name or email..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          <span className="absolute left-3.5 top-3 text-slate-500 text-sm">👤</span>
        </form>
      </div>

      {q && (
        <button
          onClick={handleReset}
          className="px-3.5 py-2 text-xs text-slate-400 hover:text-white transition-colors"
        >
          Clear Search
        </button>
      )}
    </div>
  );
}
