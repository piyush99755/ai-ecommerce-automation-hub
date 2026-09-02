'use me';
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';

interface OutboxTableFilterControlsProps {
  initialSearch: string;
  initialStatus: string;
  initialEventType: string;
  eventTypes: string[];
  statuses: string[];
}

export function OutboxTableFilterControls({
  initialSearch,
  initialStatus,
  initialEventType,
  eventTypes,
  statuses,
}: OutboxTableFilterControlsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [q, setQ] = useState(initialSearch);
  const [status, setStatus] = useState(initialStatus);
  const [eventType, setEventType] = useState(initialEventType);

  const applyFilters = (newQ: string, newStatus: string, newType: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (newQ.trim()) {
      params.set('q', newQ.trim());
    } else {
      params.delete('q');
    }

    if (newStatus && newStatus !== 'ALL') {
      params.set('status', newStatus);
    } else {
      params.delete('status');
    }

    if (newType && newType !== 'ALL') {
      params.set('eventType', newType);
    } else {
      params.delete('eventType');
    }

    // Reset pagination to page 1 on filter change
    params.delete('page');

    startTransition(() => {
      router.push(`/admin/automations?${params.toString()}`);
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters(q, status, eventType);
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    setStatus(newStatus);
    applyFilters(q, newStatus, eventType);
  };

  const handleEventTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value;
    setEventType(newType);
    applyFilters(q, status, newType);
  };

  const handleReset = () => {
    setQ('');
    setStatus('ALL');
    setEventType('ALL');
    startTransition(() => {
      router.push('/admin/automations');
    });
  };

  const hasActiveFilters = q || status !== 'ALL' || eventType !== 'ALL';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
      <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Search by Event ID / Aggregate ID */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Search
          </label>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search Event or Aggregate ID..."
            className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Status
          </label>
          <select
            value={status}
            onChange={handleStatusChange}
            className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Event Type Filter */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Event Type
          </label>
          <select
            value={eventType}
            onChange={handleEventTypeChange}
            className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Event Types</option>
            {eventTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {/* Submit & Reset Buttons */}
        <div className="flex items-end space-x-2">
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl transition-colors disabled:opacity-50"
          >
            {isPending ? 'Filtering...' : 'Apply Filters'}
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-xl transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
