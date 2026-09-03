"use client";

import { useEffect, useState } from "react";
import { Clock, Navigation, AlertCircle } from "lucide-react";

import type { StudentBookingEta } from "../contracts/eta.schemas";

interface StudentBookingEtaCardProps {
  readonly bookingId: string;
  readonly refreshIntervalMs?: number;
}

export function StudentBookingEtaCard({
  bookingId,
  refreshIntervalMs = 20_000,
}: StudentBookingEtaCardProps) {
  const [eta, setEta] = useState<StudentBookingEta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadEta() {
      try {
        const response = await fetch(`/api/bookings/${bookingId}/eta`, {
          cache: "no-store",
        });
        if (cancelled) return;
        if (!response.ok) {
          setError("ETA currently unavailable");
          setLoading(false);
          return;
        }
        const data = (await response.json()) as { eta: StudentBookingEta };
        if (cancelled) return;
        setEta(data.eta);
        setError(null);
      } catch {
        if (!cancelled) setError("ETA currently unavailable");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadEta();
    const timer = setInterval(() => void loadEta(), refreshIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [bookingId, refreshIntervalMs]);

  if (loading && !eta) {
    return (
      <div className="eta-container eta-loading flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-500">
        <Clock className="size-3.5 animate-spin" />
        <span>Calculating arrival time…</span>
      </div>
    );
  }

  if (error || !eta) {
    return null;
  }

  if (eta.isPassed) {
    return (
      <div className="eta-container flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 text-xs">
        <AlertCircle className="size-3.5 shrink-0" />
        <span>
          {eta.targetStopRole === "BOARDING"
            ? "Boarding stop has already passed"
            : "Drop-off stop reached"}
        </span>
      </div>
    );
  }

  const isTrafficAware = eta.source === "TRAFFIC_AWARE";
  const targetLabel = eta.targetStopRole === "BOARDING" ? "Boarding at" : "Drop-off at";

  return (
    <div className="eta-container p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm space-y-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-medium text-slate-900 dark:text-slate-100">
          <Navigation className="size-3.5 text-blue-600 dark:text-blue-400" />
          <span>{targetLabel} {eta.targetStopName}</span>
        </div>
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase ${
            isTrafficAware
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
          }`}
        >
          {isTrafficAware ? "Traffic-Aware" : "Schedule Estimate"}
        </span>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
          {eta.minutesAway !== null ? `~${eta.minutesAway} min` : "At stop"}
        </span>
        {eta.estimatedArrival && (
          <span className="text-slate-500 dark:text-slate-400 text-xs">
            (expected{" "}
            {new Date(eta.estimatedArrival).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
            )
          </span>
        )}
      </div>

      <div className="pt-1 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
        <div>
          {eta.locationSource === "SIMULATED" && (
            <span className="text-amber-700 dark:text-amber-300 font-medium">
              Based on simulated shuttle location
            </span>
          )}
          {eta.locationSource === "GPS" && <span>Live GPS telemetry</span>}
          {!eta.locationSource && <span>Timetable estimate</span>}
        </div>

        {isTrafficAware && (
          <span className="text-[10px] text-slate-400 tracking-tight">
            Powered by Google Routes
          </span>
        )}
      </div>
    </div>
  );
}
