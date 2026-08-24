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

  const isWalkIn = pass.purpose === "Walk-in Boarding";

  return (
    <Modal isOpen onClose={onClose} title={pass.title} description="Present this pass to the driver when boarding." maxWidth="md">
      <div className={`boarding-pass ${isWalkIn ? "walk-in" : "reserved"}`}>
        <div className="pass-heading">
          <span className="pass-icon"><QrCode aria-hidden className="size-5" /></span>
          <div><p className="eyebrow">{pass.purpose}</p><h3>{pass.routeName}</h3></div>
          {pass.seatNumber ? <strong className="pass-seat">Seat {pass.seatNumber}</strong> : <span className="badge badge-amber">Standing request</span>}
        </div>
        {pass.journey && <p className="pass-journey">{pass.journey}</p>}
        {pass.warning && <div className="pass-warning" role="note"><strong>Boarding not guaranteed</strong><span>{pass.warning}</span></div>}
        <div className="pass-qr-area">
          {loading ? (
            <div className="pass-qr-placeholder"><RefreshCw aria-hidden className="size-7 animate-spin" /><span>Issuing secure pass…</span></div>
          ) : error ? (
            <div className="pass-qr-error"><p>{error}</p><button onClick={() => void fetchQRToken()} className="btn-danger">Retry</button></div>
          ) : qrDataUrl ? (
            <div className="pass-qr"><Image unoptimized width={240} height={240} src={qrDataUrl} alt={`${pass.purpose} QR code`} className="size-60" /></div>
          ) : null}
          <div className="pass-expiry"><Clock aria-hidden className="size-4" /><span>Refreshes in</span><strong className="tabular-nums">{timeLeft}s</strong><button onClick={() => void fetchQRToken()} disabled={loading}>Refresh now</button></div>
          {showDemoToken && demoToken && (
            <div className="demo-token">
              <p>
                Development / Demo fallback only. Normal boarding uses the camera QR scanner.
              </p>
              <button
                type="button"
                onClick={() => void copyDemoToken()}
                className="btn-ghost"
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
