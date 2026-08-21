"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Check, Clock, Copy, QrCode, RefreshCw } from "lucide-react";
import Modal from "@/components/Modal";

export interface DynamicPassDescriptor {
  endpoint: string;
  requestBody?: unknown;
  title: string;
  purpose: "Reserved Boarding" | "Walk-in Boarding" | "Alighting";
  routeName: string;
  journey?: string;
  seatNumber?: number | null;
  warning?: string;
}

interface DynamicQRModalProps {
  pass: DynamicPassDescriptor;
  onClose: () => void;
}

export default function DynamicQRModal({ pass, onClose }: DynamicQRModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [demoToken, setDemoToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQRToken = useCallback(async function fetchQRToken() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(pass.endpoint, {
        method: "POST",
        ...(pass.requestBody === undefined
          ? {}
          : {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(pass.requestBody),
            }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error?.message || data.error || "Failed to issue pass");
        return;
      }
      setQrDataUrl(data.qrDataUrl);
      setDemoToken(data.token);
      setCopied(false);
      setTimeLeft(data.expiresInSeconds ?? 60);
    } catch {
      setError("Network error issuing the pass");
    } finally {
      setLoading(false);
    }
  }, [pass.endpoint, pass.requestBody]);

  useEffect(() => {
    const initialFetch = window.setTimeout(() => void fetchQRToken(), 0);
    const autoRefresh = window.setInterval(() => void fetchQRToken(), 45_000);
    const timer = window.setInterval(
      () => setTimeLeft((previous) => Math.max(previous - 1, 0)),
      1_000,
    );
    return () => {
      window.clearInterval(autoRefresh);
      window.clearInterval(timer);
      window.clearTimeout(initialFetch);
    };
  }, [fetchQRToken]);

  const showDemoToken =
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  async function copyDemoToken() {
    if (!demoToken) return;
    try {
      await navigator.clipboard.writeText(demoToken);
      setCopied(true);
    } catch {
      setError("Clipboard access was unavailable. Use camera scanning instead.");
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={pass.title} maxWidth="md">
      <div className="p-5 sm:p-6">
        <div className="text-center space-y-1 mb-5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 mb-2"><QrCode className="w-6 h-6" /></div>
          <p className="text-sm font-bold text-slate-200">{pass.purpose}</p>
          <p className="text-xs text-slate-400">This QR refreshes automatically for your security.</p>
        </div>
        <div className="bg-slate-900/80 rounded-2xl p-4 mb-5 border border-slate-800 space-y-2 text-xs">
          <div className="flex justify-between"><span className="text-slate-400">Route</span><span className="font-semibold text-white">{pass.routeName}</span></div>
          {pass.journey && <div className="flex justify-between"><span className="text-slate-400">Journey</span><span className="font-semibold text-white">{pass.journey}</span></div>}
          {pass.seatNumber && <div className="flex justify-between"><span className="text-slate-400">Guaranteed seat</span><span className="font-bold text-blue-400">Seat {pass.seatNumber}</span></div>}
        </div>
        {pass.warning && <div className="mb-5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs font-semibold text-amber-200">{pass.warning}</div>}
        <div className="flex flex-col items-center gap-4">
          {loading ? (
            <div className="w-64 h-64 rounded-2xl bg-slate-900 flex items-center justify-center"><RefreshCw className="w-8 h-8 text-blue-400 animate-spin" /></div>
          ) : error ? (
            <div className="w-64 h-64 rounded-2xl bg-red-950/20 border border-red-500/30 flex flex-col items-center justify-center text-center p-4 text-xs text-red-300 gap-3"><p>{error}</p><button onClick={() => void fetchQRToken()} className="px-3 py-2 bg-red-700 text-white rounded-lg">Retry</button></div>
          ) : qrDataUrl ? (
            <div className="p-3 bg-white rounded-3xl border-4 border-blue-500/30"><Image unoptimized width={240} height={240} src={qrDataUrl} alt={`${pass.purpose} QR code`} className="w-60 h-60 rounded-2xl" /></div>
          ) : null}
          <div className="flex items-center gap-2 text-xs text-slate-300"><Clock className="w-4 h-4 text-amber-400" />Expires in <strong className="text-amber-300">{timeLeft}s</strong><button onClick={() => void fetchQRToken()} disabled={loading} className="text-blue-400 underline">Refresh</button></div>
          {showDemoToken && demoToken && (
            <div className="w-full border-t border-slate-800 pt-4 text-center">
              <p className="text-[11px] text-amber-300 mb-2">
                Development / Demo fallback only — normal boarding uses the camera QR scanner.
              </p>
              <button
                type="button"
                onClick={() => void copyDemoToken()}
                className="btn-ghost inline-flex items-center gap-2"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Demo token copied" : "Copy demo token"}
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
