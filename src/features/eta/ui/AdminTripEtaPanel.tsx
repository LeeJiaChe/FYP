"use client";

import { useEffect, useState } from "react";
import { Activity, Clock, ShieldAlert, Sparkles } from "lucide-react";

import type { TripEta } from "../contracts/eta.schemas";

interface AdminTripEtaPanelProps {
  readonly tripId: string | null;
  readonly refreshIntervalMs?: number;
}

export function AdminTripEtaPanel({
  tripId,
  refreshIntervalMs = 20_000,
}: AdminTripEtaPanelProps) {
  const [eta, setEta] = useState<TripEta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tripId) return;

    let cancelled = false;

    async function fetchEta() {
      setLoading(true);
      try {
        const response = await fetch(`/api/trips/${tripId}/eta`, {
          cache: "no-store",
        });
        if (cancelled) return;
        if (!response.ok) {
          setError("Trip ETA unavailable");
          return;
        }
        const body = (await response.json()) as { eta: TripEta };
        if (cancelled) return;
        setEta(body.eta);
        setError(null);
      } catch {
        if (!cancelled) setError("Failed to fetch Trip ETA");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchEta();
    const interval = setInterval(() => void fetchEta(), refreshIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [tripId, refreshIntervalMs]);

  if (!tripId) return null;

  if (loading && !eta) {
    return (
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-500 flex items-center gap-2">
        <Clock className="size-4 animate-spin text-blue-500" />
        <span>Evaluating traffic and arrival predictions…</span>
      </div>
    );
  }

  if (error || !eta) {
    return (
      <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-500">
        <span>Operational ETA temporarily unavailable for this Trip.</span>
      </div>
    );
  }

  const isTrafficAware = eta.source === "TRAFFIC_AWARE";
  const nextStop = eta.stopEstimates[0] ?? null;
  const terminalStop =
    eta.stopEstimates.length > 1
      ? eta.stopEstimates[eta.stopEstimates.length - 1]
      : null;

  return (
    <div className="admin-eta-panel p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-blue-600 dark:text-blue-400" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Operational ETA Predictions
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase ${
              isTrafficAware
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
            }`}
          >
            {isTrafficAware ? "Traffic-Aware" : `Schedule (${eta.fallbackReason ?? "Fallback"})`}
          </span>
          {isTrafficAware && (
            <span className="text-[10px] text-slate-400 flex items-center gap-1">
              <Sparkles className="size-3 text-amber-500" /> Google Routes
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60">
          <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
            Next Stop ({nextStop?.stopCode ?? "N/A"})
          </span>
          <strong className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
            {nextStop ? `~${nextStop.minutesAway} min` : "At terminal"}
          </strong>
          {nextStop?.estimatedArrival && (
            <small className="block text-[10px] text-slate-500">
              {new Date(nextStop.estimatedArrival).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </small>
          )}
        </div>

        <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60">
          <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
            Terminal ({terminalStop?.stopCode ?? "Final"})
          </span>
          <strong className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
            {terminalStop ? `~${terminalStop.minutesAway} min` : "Arrived"}
          </strong>
          {terminalStop?.estimatedArrival && (
            <small className="block text-[10px] text-slate-500">
              {new Date(terminalStop.estimatedArrival).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </small>
          )}
        </div>

        <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60">
          <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
            Traffic Impact
          </span>
          <strong
            className={`text-sm font-bold tabular-nums ${
              (eta.trafficImpactMinutes ?? 0) > 2
                ? "text-amber-600 dark:text-amber-400"
                : "text-slate-900 dark:text-white"
            }`}
          >
            {eta.trafficImpactMinutes !== null
              ? `+${eta.trafficImpactMinutes} min`
              : "N/A"}
          </strong>
          <small className="block text-[10px] text-slate-500">
            vs static free-flow
          </small>
        </div>

        <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60">
          <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
            Timetable Variance
          </span>
          <strong
            className={`text-sm font-bold tabular-nums ${
              (nextStop?.scheduleVarianceMinutes ?? 0) > 0
                ? "text-red-600 dark:text-red-400"
                : (nextStop?.scheduleVarianceMinutes ?? 0) < 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-slate-900 dark:text-white"
            }`}
          >
            {nextStop
              ? nextStop.scheduleVarianceMinutes > 0
                ? `+${nextStop.scheduleVarianceMinutes} min late`
                : nextStop.scheduleVarianceMinutes < 0
                  ? `${nextStop.scheduleVarianceMinutes} min ahead`
                  : "On timetable"
              : "N/A"}
          </strong>
          <small className="block text-[10px] text-slate-500">
            vs planned arrival
          </small>
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-1.5">
          {eta.locationSource === "SIMULATED" && (
            <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
              <ShieldAlert className="size-3" /> Based on simulated shuttle location
            </span>
          )}
          {eta.locationSource === "GPS" && <span>Live GPS telemetry</span>}
          {!eta.locationSource && <span>No live telemetry available</span>}
        </div>

        {eta.locationAgeMs !== null && (
          <span className="tabular-nums">
            Telemetry age: {Math.round(eta.locationAgeMs / 1_000)}s
          </span>
        )}
      </div>
    </div>
  );
}
