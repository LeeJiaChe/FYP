"use client";

import { useState, useEffect } from "react";
import { X, RefreshCw, Clock, ShieldCheck, QrCode } from "lucide-react";

interface DynamicQRModalProps {
  booking: any;
  onClose: () => void;
}

export default function DynamicQRModal({ booking, onClose }: DynamicQRModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchQRToken() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/bookings/${booking.id}/qr-token`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setQrDataUrl(data.qrDataUrl);
        setTimeLeft(60);
      } else {
        setError(data.error || "Failed to generate QR token");
      }
    } catch {
      setError("Network error fetching QR token");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchQRToken();

    // Auto-refresh QR code every 45 seconds to guarantee active token & prevent screenshots
    const autoRefreshInterval = setInterval(() => {
      fetchQRToken();
    }, 45000);

    // 1-second countdown timer UI
    const timerInterval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      clearInterval(autoRefreshInterval);
      clearInterval(timerInterval);
    };
  }, [booking.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="glass-panel w-full max-w-md rounded-3xl p-6 border border-slate-700/80 shadow-2xl relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="text-center space-y-1 mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 mb-2">
            <QrCode className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Boarding Pass QR Code</h2>
          <p className="text-xs text-slate-400">Dynamic single-use security token (Auto-refreshes every 45s)</p>
        </div>

        {/* Details card */}
        <div className="bg-slate-900/80 rounded-2xl p-4 mb-6 border border-slate-800 space-y-2 text-xs">
          <div className="flex justify-between items-center text-slate-300">
            <span className="text-slate-400">Route:</span>
            <span className="font-semibold text-white">{booking.trip.routeName}</span>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span className="text-slate-400">Seat Number:</span>
            <span className="font-bold text-blue-400 text-sm">Seat #{booking.seatNumber}</span>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span className="text-slate-400">Bus Plate:</span>
            <span className="font-semibold text-white">{booking.trip.busPlateNumber}</span>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span className="text-slate-400">Departure:</span>
            <span className="font-semibold text-emerald-400">
              {new Date(booking.trip.departureTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>

        {/* QR Display Area */}
        <div className="flex flex-col items-center justify-center space-y-4">
          {loading ? (
            <div className="w-64 h-64 rounded-2xl bg-slate-900 flex items-center justify-center border border-slate-800">
              <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
          ) : error ? (
            <div className="w-64 h-64 rounded-2xl bg-red-950/20 border border-red-500/30 flex flex-col items-center justify-center text-center p-4 text-xs text-red-400 space-y-2">
              <p>{error}</p>
              <button
                onClick={fetchQRToken}
                className="px-3 py-1.5 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-500"
              >
                Retry
              </button>
            </div>
          ) : (
            qrDataUrl && (
              <div className="p-3 bg-white rounded-3xl shadow-xl border-4 border-blue-500/30">
                <img src={qrDataUrl} alt="Boarding QR Code" className="w-60 h-60 rounded-2xl" />
              </div>
            )
          )}

          {/* 60s Countdown Timer */}
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-300">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>
              Token expires in: <span className="text-amber-400 font-bold">{timeLeft}s</span>
            </span>
            <button
              onClick={fetchQRToken}
              disabled={loading}
              className="ml-2 text-blue-400 hover:text-blue-300 underline flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Refresh Now
            </button>
          </div>
        </div>

        {/* Dynamic Security Note */}
        <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Encrypted signed JWT token • Anti-screenshot mechanism</span>
        </div>
      </div>
    </div>
  );
}
