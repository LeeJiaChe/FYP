"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Camera, CheckCircle2, DoorOpen, QrCode, RefreshCw } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Modal from "@/components/Modal";
import {
  startQrCamera,
  verifyScannedPass,
  type CameraScannerController,
} from "./qr-camera";

interface QRScannerModalProps {
  tripId: string;
  routeName?: string;
  currentStopName?: string;
  mode?: "BOARDING" | "ALIGHTING";
  onClose: () => void;
  onSuccess: () => void;
}

export default function QRScannerModal({
  tripId,
  routeName,
  currentStopName,
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
  const [cameraSession, setCameraSession] = useState(0);
  const reduceMotion = useReducedMotion();

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
          setError("FULL: standing capacity is unavailable for the complete journey.");
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
        setCameraStatus("Camera active. Hold a pass QR inside the frame.");
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
  }, [tripId, mode, cameraSession]);

  function continueScanning() {
    acceptedRef.current = false;
    scanningRef.current = false;
    setResult(null);
    setError(null);
    setTokenInput("");
    setCameraStatus("Restarting camera…");
    setCameraSession((session) => session + 1);
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={mode === "BOARDING" ? "Boarding Pass Scanner" : "Exit / Alighting Scanner"}
      description={`${mode === "BOARDING" ? "Boarding" : "Alighting"} verification is authoritative on the server.`}
      maxWidth="lg"
    >
      <div className={`scanner-view ${mode === "ALIGHTING" ? "alighting" : "boarding"}`}>
        <div className="scanner-context">
          <span>{mode === "BOARDING" ? <QrCode aria-hidden /> : <DoorOpen aria-hidden />}</span>
          <div><p className="eyebrow">{mode === "BOARDING" ? "Boarding operation" : "Alighting operation"}</p><strong>{routeName || "Active Trip"}</strong>{currentStopName && <small>{currentStopName}</small>}</div>
        </div>

        <div className="scanner-camera">
          <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
          <div className="scanner-frame" aria-hidden />
        </div>
        <p className="scanner-status" role="status"><Camera aria-hidden className="size-4" />{cameraStatus}</p>

        {error && <motion.div initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="scan-result error" role="alert"><AlertCircle aria-hidden /><div><strong>Pass not accepted</strong><p>{error}</p></div></motion.div>}
        {result && <motion.div initial={reduceMotion ? false : { opacity: 0, scale: .97 }} animate={{ opacity: 1, scale: 1 }} transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 26 }} className="scan-result success" role="status"><CheckCircle2 aria-hidden /><div><span>{mode === "BOARDING" ? "Boarding recorded" : "Alighting recorded"}</span><strong>{result.passengerName || result.outcome || "Pass accepted"}</strong>{result.passengerName && result.outcome && <p>{result.outcome}</p>}</div><button type="button" onClick={continueScanning} className="btn-primary">Continue scanning</button></motion.div>}

        {!result && <details className="scanner-fallback">
          <summary>Development / Demo fallback: paste pass token</summary>
          <div className="space-y-3 mt-3">
            <textarea rows={3} aria-label="Development token fallback" placeholder="Paste the short-lived signed token copied from the displayed demo pass" value={tokenInput} onChange={(event) => setTokenInput(event.target.value)} className="input-field font-mono" />
            <button onClick={() => void handleScan()} disabled={loading || !tokenInput.trim()} className="btn-primary w-full">
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Validate fallback token"}
            </button>
          </div>
        </details>}
      </div>
    </Modal>
  );
}
