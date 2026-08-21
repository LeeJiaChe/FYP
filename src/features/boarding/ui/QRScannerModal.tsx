"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Camera, CheckCircle2, QrCode, RefreshCw } from "lucide-react";
import Modal from "@/components/Modal";

interface QRScannerModalProps {
  tripId: string;
  mode?: "BOARDING" | "ALIGHTING";
  onClose: () => void;
  onSuccess: () => void;
}

interface BarcodeDetection {
  readonly rawValue: string;
}

interface BrowserBarcodeDetector {
  detect(source: ImageBitmapSource): Promise<readonly BarcodeDetection[]>;
}

type BarcodeDetectorConstructor = new (options: {
  formats: readonly string[];
}) => BrowserBarcodeDetector;

export default function QRScannerModal({
  tripId,
  mode = "BOARDING",
  onClose,
  onSuccess,
}: QRScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanningRef = useRef(false);
  const [tokenInput, setTokenInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ outcome?: string; passengerName?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraStatus, setCameraStatus] = useState("Starting camera…");

  async function handleScan(tokenToVerify?: string) {
    const token = tokenToVerify?.trim() || tokenInput.trim();
    if (!token || scanningRef.current) return;
    scanningRef.current = true;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const endpoint =
        mode === "BOARDING"
          ? `/api/trips/${tripId}/scan`
          : `/api/trips/${tripId}/alight`;
      const body = mode === "BOARDING" ? { token } : { mode: "QR", token };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.outcome === "FULL") {
          setError("FULL — standing capacity is unavailable for the complete journey.");
        } else {
          setError(data.error?.message || data.error || "Pass validation failed");
        }
      } else {
        setResult(data);
        onSuccess();
      }
    } catch {
      setError("Network error validating the pass");
    } finally {
      setLoading(false);
      window.setTimeout(() => {
        scanningRef.current = false;
      }, 1_500);
    }
  }

  useEffect(() => {
    let active = true;
    let stream: MediaStream | null = null;
    let frameTimer: number | null = null;

    async function startCamera() {
      const Detector = (window as typeof window & {
        BarcodeDetector?: BarcodeDetectorConstructor;
      }).BarcodeDetector;
      if (!Detector) {
        setCameraStatus(
          "This browser does not provide QR camera decoding. Use a current Chromium browser or the development/demo fallback.",
        );
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (!active || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraStatus("Camera active — hold a pass QR inside the frame.");
        const detector = new Detector({ formats: ["qr_code"] });

        const detect = async () => {
          if (!active || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const value = codes[0]?.rawValue;
            if (value) await handleScan(value);
          } catch {
            // A frame may be undecodable while the camera is moving. Continue.
          }
          frameTimer = window.setTimeout(detect, 250);
        };
        await detect();
      } catch {
        setCameraStatus(
          "Camera permission or secure-context access was unavailable. Use the labelled development/demo fallback if needed.",
        );
      }
    }

    void startCamera();
    return () => {
      active = false;
      if (frameTimer !== null) window.clearTimeout(frameTimer);
      stream?.getTracks().forEach((track) => track.stop());
    };
    // handleScan deliberately reads the latest component state; restarting the
    // camera for each fallback-token keystroke would make scanning unusable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, mode]);

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={mode === "BOARDING" ? "Boarding Pass Scanner" : "Exit / Alighting Scanner"}
      maxWidth="lg"
    >
      <div className="p-5 sm:p-6">
        <div className="text-center space-y-2 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
            {mode === "BOARDING" ? <QrCode className="w-6 h-6" /> : <Camera className="w-6 h-6" />}
          </div>
          <p className="text-xs text-slate-400">The server verifies the pass, assigned Trip, passenger journey, and current boarding state.</p>
        </div>

        <div className="rounded-2xl overflow-hidden border border-slate-700 bg-black aspect-video mb-3">
          <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
        </div>
        <p className="text-[11px] text-slate-400 mb-4">{cameraStatus}</p>

        {error && <div className="p-3 mb-4 bg-red-500/10 border border-red-500/30 text-xs text-red-300 rounded-xl flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span></div>}
        {result && <div className="p-4 mb-4 bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 rounded-xl text-center"><CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-1" /><div className="font-bold text-sm text-white">{result.outcome || "Accepted"}</div>{result.passengerName && <div className="text-slate-400">{result.passengerName}</div>}</div>}

        <details className="border-t border-slate-800 pt-4">
          <summary className="cursor-pointer text-xs font-semibold text-amber-300">Development / Demo fallback: paste pass token</summary>
          <div className="space-y-3 mt-3">
            <textarea rows={3} aria-label="Development token fallback" placeholder="Paste the signed JWT token from the displayed pass" value={tokenInput} onChange={(event) => setTokenInput(event.target.value)} className="w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 font-mono" />
            <button onClick={() => void handleScan()} disabled={loading || !tokenInput.trim()} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Validate fallback token"}
            </button>
          </div>
        </details>
      </div>
    </Modal>
  );
}
