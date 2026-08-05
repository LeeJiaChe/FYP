"use client";

import { useEffect, useState, useRef } from "react";
import { Bus, MapPin, Clock, Navigation, RefreshCw, AlertCircle } from "lucide-react";

interface BusLocationProps {
  tripId: string;
  routeName: string;
  stops: string[];
  departureTime: string;
  estimatedArrivalTime: string;
  busPlateNumber: string;
  status: string;
}

// Simulate real-time bus position along the route
function simulateBusProgress(departureTime: string, estimatedArrivalTime: string): number {
  const now = new Date();
  const dep = new Date(departureTime);
  const arr = new Date(estimatedArrivalTime);
  const totalMs = arr.getTime() - dep.getTime();
  const elapsedMs = now.getTime() - dep.getTime();
  if (elapsedMs <= 0) return 0;
  if (elapsedMs >= totalMs) return 100;
  return Math.min(100, (elapsedMs / totalMs) * 100);
}

export default function BusLocationTracker({
  tripId,
  routeName,
  stops,
  departureTime,
  estimatedArrivalTime,
  busPlateNumber,
  status,
}: BusLocationProps) {
  const [progress, setProgress] = useState(0);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [eta, setEta] = useState("");
  const animFrameRef = useRef<number | null>(null);
  const progressRef = useRef(0);

  useEffect(() => {
    function tick() {
      const p = simulateBusProgress(departureTime, estimatedArrivalTime);
      // Small smoothing value instead of jitter to keep animation smooth
      const smoothed = Math.max(0, Math.min(100, p));
      setProgress(smoothed);
      progressRef.current = smoothed;

      // Calculate ETA
      const arr = new Date(estimatedArrivalTime);
      const now = new Date();
      const diffMs = arr.getTime() - now.getTime();
      if (diffMs <= 0) {
        setEta("Arrived");
      } else {
        const mins = Math.round(diffMs / 60000);
        setEta(`${mins} min`);
      }

      setLastUpdate(new Date());
    }

    tick();
    const interval = setInterval(tick, 3000);
    return () => clearInterval(interval);
  }, [departureTime, estimatedArrivalTime]);

  // Which stop is the bus currently closest to
  const currentStopIndex = Math.floor((progress / 100) * (stops.length - 1));
  const busLeftPercent = Math.max(2, Math.min(92, progress * 0.9));

  const statusColor =
    status === "BOARDING"
      ? "#4ade80"
      : status === "DEPARTED"
      ? "var(--accent-secondary)"
      : status === "DELAYED"
      ? "#fbbf24"
      : status === "ARRIVED"
      ? "#4ade80"
      : "var(--text-muted)";

  return (
    <div
      className="rounded-2xl p-5 space-y-5"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))` }}
            >
              <Navigation className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
              Estimated Bus Location
            </h3>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <AlertCircle className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              Simulated tracking — based on schedule, not live GPS.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <span
            className="text-[10px] font-bold px-2.5 py-1 rounded-full"
            style={{ background: `${statusColor}20`, color: statusColor, border: `1px solid ${statusColor}40` }}
          >
            {status.replace(/_/g, " ")}
          </span>
        </div>
      </div>

      {/* Route Track Visualization */}
      <div className="space-y-3">
        {/* Bus marker with track */}
        <div className="relative h-10 flex items-center">
          {/* Track background */}
          <div className="absolute left-4 right-4 h-1.5 rounded-full" style={{ background: "var(--border)" }} />

          {/* Track fill */}
          <div
            className="absolute left-4 h-1.5 rounded-full transition-all duration-3000 ease-in-out"
            style={{
              width: `calc(${busLeftPercent}% - 16px)`,
              background: `linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))`,
              transition: "width 3s ease-in-out",
            }}
          />

          {/* Stop dots */}
          {stops.map((_, i) => {
            const stopPercent = i === 0 ? 0 : i === stops.length - 1 ? 100 : (i / (stops.length - 1)) * 100;
            const leftOffset = `calc(${4 + stopPercent * 0.9}% + ${4 - stopPercent * 0.072}px)`;
            const isPassed = i <= currentStopIndex;
            return (
              <div
                key={i}
                className="absolute w-3 h-3 rounded-full border-2 border-white transition-all duration-500"
                style={{
                  left: leftOffset,
                  transform: "translateX(-50%)",
                  background: isPassed ? "var(--accent-primary)" : "var(--border)",
                  boxShadow: isPassed ? "0 0 8px var(--accent-glow)" : "none",
                  zIndex: 5,
                }}
              />
            );
          })}

          {/* Animated Bus marker */}
          <div
            className="absolute z-10 transition-all duration-3000 ease-in-out"
            style={{
              left: `calc(${4 + busLeftPercent * 0.86}% + 4px)`,
              transform: "translateX(-50%)",
              transition: "left 3s ease-in-out",
            }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center float-animation"
              style={{
                background: `linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))`,
                border: "2.5px solid white",
                boxShadow: `0 0 0 4px var(--accent-glow), 0 4px 12px var(--shadow-color)`,
              }}
            >
              <Bus className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>

        {/* Stop names */}
        <div className="flex justify-between px-1">
          {stops.map((stop, i) => (
            <div
              key={i}
              className="flex flex-col items-center text-center"
              style={{ maxWidth: `${100 / stops.length - 2}%` }}
            >
              <MapPin
                className="w-3 h-3 mb-0.5"
                style={{ color: i <= currentStopIndex ? "var(--accent-secondary)" : "var(--text-muted)" }}
              />
              <span
                className="text-[9px] font-semibold leading-tight"
                style={{ color: i <= currentStopIndex ? "var(--text-primary)" : "var(--text-muted)" }}
              >
                {stop}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Info Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-2 rounded-xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <span className="text-[10px] block" style={{ color: "var(--text-muted)" }}>Bus Plate</span>
          <span className="text-xs font-bold" style={{ color: "var(--accent-secondary)" }}>{busPlateNumber}</span>
        </div>
        <div className="text-center p-2 rounded-xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <span className="text-[10px] block" style={{ color: "var(--text-muted)" }}>Progress</span>
          <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>{Math.round(progress)}%</span>
        </div>
        <div className="text-center p-2 rounded-xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <span className="text-[10px] block" style={{ color: "var(--text-muted)" }}>ETA</span>
          <span className="text-xs font-bold" style={{ color: eta === "Arrived" ? "#4ade80" : "var(--text-primary)" }}>{eta}</span>
        </div>
      </div>

      {/* Updated at */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            Calculated at {lastUpdate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        </div>
      </div>
    </div>
  );
}
