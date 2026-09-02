'use me';
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface AdjustStockFormProps {
  productId: string;
  currentStock: number;
}

export function AdjustStockForm({ productId, currentStock }: AdjustStockFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [delta, setDelta] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const parsedDelta = parseInt(delta, 10);

    if (isNaN(parsedDelta) || parsedDelta === 0) {
      setErrorMsg('Adjustment amount must be a non-zero integer (e.g. +20 or -2).');
      return;
    }

    if (!reason.trim()) {
      setErrorMsg('Please enter an adjustment reason.');
      return;
    }

    if (currentStock + parsedDelta < 0) {
      setErrorMsg(`Adjustment of ${parsedDelta} would result in negative stock (${currentStock + parsedDelta} units).`);
      return;
    }

    try {
      const response = await fetch(`/api/admin/inventory/${productId}/adjust`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          delta: parsedDelta,
          reason: reason.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setErrorMsg(data.message || data.error || 'Failed to apply stock adjustment.');
        return;
      }

      setSuccessMsg(
        `Stock successfully adjusted (${parsedDelta > 0 ? '+' : ''}${parsedDelta}): ${data.adjustment.previousStock} → ${data.adjustment.newStock} units.`
      );
      setDelta('');
      setReason('');

      startTransition(() => {
        router.refresh();
      });
    } catch {
      setErrorMsg('An unexpected network error occurred.');
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
      <div>
        <h3 className="text-base font-bold text-white tracking-tight">Adjust Stock (Audited)</h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Execute transactional stock delta mutations with explicit reason logging.
        </p>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 font-medium">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 font-medium">
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Adjustment Amount (Delta)
            </label>
            <input
              type="number"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              placeholder="e.g. +20 or -2"
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <div className="text-[10px] text-slate-500 mt-1">Positive to restock, negative to reduce</div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Reason for Adjustment
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Restock shipment received, Damaged units removed"
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <div className="text-[10px] text-slate-500 mt-1">Audit log reason (required)</div>
          </div>
        </div>

        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition-colors shadow-lg"
          >
            {isPending ? 'Processing Adjustment...' : 'Apply Stock Adjustment'}
          </button>
        </div>
      </form>
    </div>
  );
}
