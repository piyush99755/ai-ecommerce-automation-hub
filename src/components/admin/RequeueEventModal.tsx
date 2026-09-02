'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface RequeueEventModalProps {
  eventId: string;
  shortId: string;
  eventType: string;
  status: string;
  orderStatus?: string | null;
}

const APPROVED_REPLAY_EVENT_TYPES = new Set([
  'PAYMENT_SUCCEEDED',
  'ORDER_PROCESSING_NOTIFICATION',
  'ORDER_SHIPPED_NOTIFICATION',
  'ORDER_DELIVERED_NOTIFICATION',
]);

export function RequeueEventModal({
  eventId,
  shortId,
  eventType,
  status,
  orderStatus,
}: RequeueEventModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (status !== 'FAILED') {
    return null;
  }

  // Display clear operational explanation if event type is globally blocked
  if (!APPROVED_REPLAY_EVENT_TYPES.has(eventType)) {
    return (
      <div className="px-3.5 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-400 font-semibold flex items-center space-x-2">
        <span className="text-amber-400">🛡️</span>
        <span>Manual replay disabled: Downstream side effect is not currently proven idempotent in live configuration.</span>
      </div>
    );
  }

  // Display operational explanation if PAYMENT_SUCCEEDED order has progressed beyond fulfillment stage
  if (
    eventType === 'PAYMENT_SUCCEEDED' &&
    orderStatus &&
    orderStatus !== 'PENDING' &&
    orderStatus !== 'PROCESSING'
  ) {
    return (
      <div className="px-3.5 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-400 font-semibold flex items-center space-x-2">
        <span className="text-amber-400">🛡️</span>
        <span>Manual replay disabled because this order has progressed beyond the fulfillment stage ({orderStatus}).</span>
      </div>
    );
  }

  const handleOpen = () => {
    setIsOpen(true);
    setReason('');
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleClose = () => {
    if (isPending) return;
    setIsOpen(false);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErrorMessage('Please provide a clear manual recovery reason.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/admin/automations/${eventId}/requeue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: reason.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.message || data.error || 'Failed to requeue outbox event.');
        return;
      }

      setSuccessMessage('Event successfully requeued! Refreshing workspace...');
      startTransition(() => {
        router.refresh();
        setTimeout(() => {
          setIsOpen(false);
        }, 1200);
      });
    } catch {
      setErrorMessage('An unexpected network error occurred.');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg transition-colors flex items-center space-x-2"
      >
        <span>🔄</span>
        <span>Requeue Event (Manual Recovery)</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <span>🔄</span>
                <span>Confirm Manual Event Requeue</span>
              </h3>
              <button
                type="button"
                onClick={handleClose}
                disabled={isPending}
                className="text-slate-400 hover:text-white text-lg font-bold disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 bg-rose-950/40 border border-rose-500/40 rounded-xl text-xs text-rose-200 space-y-1.5">
              <div className="font-bold flex items-center space-x-2 text-rose-400">
                <span>⚠️</span>
                <span>Operational Recovery Warning</span>
              </div>
              <p className="leading-relaxed">
                Requeueing event <span className="font-mono font-bold text-white">{shortId}</span> ({eventType}) will reset its status to <span className="font-bold text-amber-400">PENDING</span> and grant a fresh background worker retry budget. Downstream consumer claim deduplication and provider idempotency will prevent duplicate execution for completed events.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-xs font-semibold text-rose-300">
                {errorMessage}
              </div>
            )}

            {successMessage && (
              <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-xs font-semibold text-emerald-300">
                {successMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Reason for Manual Recovery <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why this FAILED event is safe to requeue (e.g., Target receiver endpoint service recovered)..."
                  maxLength={500}
                  required
                  disabled={isPending}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 disabled:opacity-50"
                />
                <div className="text-[10px] text-slate-500 text-right mt-1">
                  {reason.length}/500 characters
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isPending}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !reason.trim()}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition-colors disabled:opacity-50 shadow-lg"
                >
                  {isPending ? 'Requeueing...' : 'Confirm & Requeue Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
