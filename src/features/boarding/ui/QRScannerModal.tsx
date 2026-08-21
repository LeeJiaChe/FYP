"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Camera, CheckCircle2, QrCode, RefreshCw } from "lucide-react";
import Modal from "@/components/Modal";
import {
  startQrCamera,
  verifyScannedPass,
  type CameraScannerController,
} from "./qr-camera";

interface QRScannerModalProps {
  tripId: string;
  mode?: "BOARDING" | "ALIGHTING";
  onClose: () => void;
  onSuccess: () => void;
}

export default function QRScannerModal({
  tripId,
  mode = "BOARDING",
  onClose,
  onSuccess,
}: QRScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanningRef = useRef(false);
  const acceptedRef = useRef(false);
  const cameraRef = useRef<CameraScannerController | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ outcome?: string; passengerName?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraStatus, setCameraStatus] = useState("Starting camera…");

  async function handleScan(tokenToVerify?: string) {
    const token = tokenToVerify?.trim() || tokenInput.trim();
    if (!token || scanningRef.current || acceptedRef.current) return;
    scanningRef.current = true;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { ok, data } = await verifyScannedPass({
        fetcher: fetch,
        tripId,
        mode,
        token,
      });
      if (!ok) {
        if (data.outcome === "FULL") {
          setError("FULL — standing capacity is unavailable for the complete journey.");
        } else {
          setError(
            (typeof data.error === "string" ? data.error : data.error?.message) ||
              "Pass validation failed",
          );
        }
      } else {
        acceptedRef.current = true;
        cameraRef.current?.stop();
        setCameraStatus("Pass decoded and accepted.");
        setResult(data);
        onSuccess();
      }
    } catch {
      setError("Network error validating the pass");
    } finally {
      setLoading(false);
      if (!acceptedRef.current) {
        window.setTimeout(() => {
          scanningRef.current = false;
        }, 1_500);
      }
    }
  }

  useEffect(() => {
    let active = true;

    async function startCamera() {
      if (!videoRef.current) return;
      try {
        const camera = await startQrCamera(videoRef.current, (token) => {
          void handleScan(token);
        });
        if (!active) {
          camera.stop();
          camera.destroy();
          return;
        }
        cameraRef.current = camera;
        setCameraStatus("Camera active — hold a pass QR inside the frame.");
      } catch (cameraError) {
        if (!active) return;
        const name = cameraError instanceof DOMException ? cameraError.name : "";
        setCameraStatus(
          name === "NotAllowedError"
            ? "Camera permission was denied. Allow camera access and reopen the scanner, or use the labelled development/demo fallback."
            : name === "NotFoundError"
              ? "No usable camera was found. Connect a camera or use the labelled development/demo fallback."
              : "Camera QR scanning is unavailable in this browser or context. Use the labelled development/demo fallback.",
        );
      }
    }

    void startCamera();
    return () => {
      active = false;
      cameraRef.current?.stop();
      cameraRef.current?.destroy();
      cameraRef.current = null;
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
            <textarea rows={3} aria-label="Development token fallback" placeholder="Paste the short-lived signed token copied from the displayed demo pass" value={tokenInput} onChange={(event) => setTokenInput(event.target.value)} className="w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 font-mono" />
            <button onClick={() => void handleScan()} disabled={loading || !tokenInput.trim()} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Validate fallback token"}
            </button>
          </div>
        </details>
      </div>
    </Modal>
  );
}
