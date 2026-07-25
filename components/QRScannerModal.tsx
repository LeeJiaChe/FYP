"use client";

import { useState } from "react";
import { X, QrCode, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";

interface QRScannerModalProps {
  tripId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function QRScannerModal({ tripId, onClose, onSuccess }: QRScannerModalProps) {
  const [tokenInput, setTokenInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleScan(tokenToVerify?: string) {
    const token = tokenToVerify || tokenInput.trim();
    if (!token) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/trips/${tripId}/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Scan validation failed");
      } else {
        setResult(data);
        onSuccess();
      }
    } catch {
      setError("Network error validating QR scan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="glass-panel w-full max-w-md rounded-3xl p-6 border border-slate-700/80 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-2 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
            <QrCode className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white">Boarding QR Scanner</h2>
          <p className="text-xs text-slate-400">Scan student's dynamic QR token to record check-in</p>
        </div>

        {error && (
          <div className="p-3 mb-4 bg-red-500/10 border border-red-500/30 text-xs text-red-400 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="p-4 mb-4 bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 rounded-xl space-y-1 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-1" />
            <div className="font-bold text-sm text-white">{result.message}</div>
            {result.student && (
              <div className="text-slate-400">Student ID: {result.student.studentId}</div>
            )}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Paste or Scan QR Token Payload String
            </label>
            <textarea
              rows={3}
              placeholder="Paste encrypted JWT token string from student QR pass..."
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              className="w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handleScan()}
              disabled={loading || !tokenInput.trim()}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Verify & Check In"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
