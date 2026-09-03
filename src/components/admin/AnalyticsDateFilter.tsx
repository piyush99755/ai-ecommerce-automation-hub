'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { AnalyticsRange } from '@/lib/admin-analytics';

interface AnalyticsDateFilterProps {
  currentRange: AnalyticsRange;
}

export function AnalyticsDateFilter({ currentRange }: AnalyticsDateFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const options: { label: string; value: AnalyticsRange }[] = [
    { label: '7 Days', value: '7d' },
    { label: '30 Days', value: '30d' },
    { label: '90 Days', value: '90d' },
    { label: 'All Time', value: 'all' },
  ];

  const handleSelect = (val: AnalyticsRange) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('range', val);
    router.push(`/admin/analytics?${params.toString()}`);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-1.5 flex items-center space-x-1 shadow-md">
      {options.map((opt) => {
        const isActive = currentRange === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => handleSelect(opt.value)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              isActive
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
