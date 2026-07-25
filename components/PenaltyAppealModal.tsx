"use client";

import { useState } from "react";
import { X, Send, AlertTriangle } from "lucide-react";

interface PenaltyAppealModalProps {
  penalty: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PenaltyAppealModal({ penalty, onClose, onSuccess }: PenaltyAppealModalProps) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/penalties/${penalty.id}/appeal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to submit appeal");
        setLoading(false);
        return;
      }

      onSuccess();
      onClose();
    } catch {
      setError("Network error submitting appeal");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="glass-panel w-full max-w-lg rounded-3xl p-6 border border-slate-700/80 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Appeal Penalty</h2>
            <p className="text-xs text-slate-400">Submit justification for staff review</p>
          </div>
        </div>

        <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-xs mb-4 space-y-1">
          <div className="text-slate-300">
            <span className="text-slate-500">Reason for Penalty: </span>
            <span className="font-semibold text-rose-400">{penalty.reason}</span>
          </div>
          <div className="text-slate-300">
            <span className="text-slate-500">Points Deducted: </span>
            <span className="font-bold text-amber-400">-{penalty.creditPointsDeducted} pts</span>
          </div>
        </div>

        {error && (
          <div className="p-3 mb-4 bg-red-500/10 border border-red-500/30 text-xs text-red-400 rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Explanation / Medical Reason <span className="text-rose-400">*</span>
            </label>
            <textarea
              required
              rows={4}
              placeholder="Explain why you were unable to board or cancel in advance (e.g. medical emergency, transport delay)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || reason.length < 10}
              className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-500/20 flex items-center gap-1.5 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" /> Submit Appeal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
