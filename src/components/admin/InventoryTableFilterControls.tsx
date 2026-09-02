'use me';
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface InventoryTableFilterControlsProps {
  categories: string[];
}

export function InventoryTableFilterControls({ categories }: InventoryTableFilterControlsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get('q') || '');
  const [state, setState] = useState(searchParams.get('state') || 'ALL');
  const [category, setCategory] = useState(searchParams.get('category') || 'ALL');

  const handleFilter = (newQ = q, newState = state, newCat = category) => {
    const params = new URLSearchParams();
    if (newQ.trim()) params.set('q', newQ.trim());
    if (newState !== 'ALL') params.set('state', newState);
    if (newCat !== 'ALL') params.set('category', newCat);
    params.set('page', '1');

    router.push(`/admin/inventory?${params.toString()}`);
  };

  const handleReset = () => {
    setQ('');
    setState('ALL');
    setCategory('ALL');
    router.push('/admin/inventory');
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-4 md:space-y-0 md:flex md:items-center md:justify-between md:space-x-4">
      <div className="flex-1 max-w-md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleFilter();
          }}
          className="relative"
        >
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search product by name or slug..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          <span className="absolute left-3.5 top-3 text-slate-500 text-sm">📦</span>
        </form>
      </div>

      <div className="flex items-center space-x-3">
        <div>
          <select
            value={state}
            onChange={(e) => {
              setState(e.target.value);
              handleFilter(q, e.target.value, category);
            }}
            className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Inventory States</option>
            <option value="IN_STOCK">IN STOCK</option>
            <option value="LOW_STOCK">LOW STOCK</option>
            <option value="OUT_OF_STOCK">OUT OF STOCK</option>
          </select>
        </div>

        <div>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              handleFilter(q, state, e.target.value);
            }}
            className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {(q || state !== 'ALL' || category !== 'ALL') && (
          <button
            onClick={handleReset}
            className="px-3 py-2.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
