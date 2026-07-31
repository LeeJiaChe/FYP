"use client";

import SeatGrid from "@/components/SeatGrid";
import { Activity, RefreshCw } from "lucide-react";

interface LiveMonitoringTabProps {
  trips: any[];
  selectedTripId: string | null;
  setSelectedTripId: (id: string) => void;
  liveTripDetails: any;
  onRefresh: () => void;
}

export default function LiveMonitoringTab({
  trips,
  selectedTripId,
  setSelectedTripId,
  liveTripDetails,
  onRefresh,
}: LiveMonitoringTabProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Selector & Refresh Bar */}
      <div
        className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center gap-3 flex-1 min-w-[240px]">
          <Activity className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="space-y-0.5">
            <span
              className="text-xs font-semibold block"
              style={{ color: "var(--text-muted)" }}
            >
              Select Active Trip to Monitor
            </span>
            <select
              value={selectedTripId || ""}
              onChange={(e) => setSelectedTripId(e.target.value)}
              className="input-field py-1 text-xs font-bold"
              style={{ minWidth: "220px" }}
            >
              {trips.length === 0 ? (
                <option value="">No active trips</option>
              ) : (
                trips.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.routeName} ({t.busPlateNumber}) — {t.status}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        <button
          onClick={onRefresh}
          className="btn-ghost flex items-center gap-1.5 text-xs shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {liveTripDetails ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Seat Grid Matrix */}
          <div
            className="lg:col-span-2 rounded-2xl p-6 space-y-4"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-white/5">
              <div>
                <h3
                  className="font-bold text-lg"
                  style={{ color: "var(--text-primary)" }}
                >
                  Live Seat Map — Bus {liveTripDetails.busPlateNumber}
                </h3>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {liveTripDetails.routeName} • Departs:{" "}
                  {new Date(liveTripDetails.departureTime).toLocaleTimeString(
                    [],
                    { hour: "2-digit", minute: "2-digit" }
                  )}
                </p>
              </div>
              <span className="badge badge-emerald text-xs uppercase font-extrabold">
                {liveTripDetails.status}
              </span>
            </div>

            <SeatGrid seats={liveTripDetails.seats || []} mode="admin" />
          </div>

          {/* Trip Summary Card */}
          <div
            className="rounded-2xl p-6 space-y-6 flex flex-col justify-between"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
            }}
          >
            <div className="space-y-4">
              <h3
                className="font-bold text-base border-b border-white/5 pb-3"
                style={{ color: "var(--text-primary)" }}
              >
                Occupancy Breakdown
              </h3>

              <div className="space-y-3">
                {[
                  {
                    label: "Total Capacity",
                    count: liveTripDetails.stats?.totalSeats || 0,
                    color: "var(--text-primary)",
                  },
                  {
                    label: "Available (White)",
                    count: liveTripDetails.stats?.availableSeats || 0,
                    color: "#e2e8f0",
                  },
                  {
                    label: "Reserved (Red)",
                    count: liveTripDetails.stats?.reservedSeats || 0,
                    color: "#ef4444",
                  },
                  {
                    label: "Checked-in (Green)",
                    count: liveTripDetails.stats?.checkedInSeats || 0,
                    color: "#22c55e",
                  },
                  {
                    label: "No-shows (Grey)",
                    count: liveTripDetails.stats?.noShowSeats || 0,
                    color: "#64748b",
                  },
                ].map(({ label, count, color }) => (
                  <div key={label} className="flex justify-between items-center text-xs">
                    <span style={{ color: "var(--text-muted)" }}>{label}</span>
                    <span className="font-bold text-sm" style={{ color }}>
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Offline Sensor Log Warning */}
            {liveTripDetails.seats?.some((s: any) => s.deviceHealth === "OFFLINE" || s.deviceHealth === "ERROR") && (
              <div
                className="p-3.5 rounded-xl text-xs flex items-center gap-2.5"
                style={{
                  background: "rgba(245,158,11,0.1)",
                  border: "1px solid rgba(245,158,11,0.3)",
                  color: "#fbbf24",
                }}
              >
                <Activity className="w-4 h-4 shrink-0" />
                <span>
                  Sensor Warning: Seat #
                  {liveTripDetails.seats.find((s: any) => s.deviceHealth === "OFFLINE" || s.deviceHealth === "ERROR")?.seatNumber}{" "}
                  reporting {liveTripDetails.seats.find((s: any) => s.deviceHealth !== "OK")?.deviceHealth} signal.
                </span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div
          className="py-16 text-center rounded-2xl"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
          }}
        >
          <Activity
            className="w-10 h-10 mx-auto mb-3"
            style={{ color: "var(--text-muted)" }}
          />
          <p className="font-bold" style={{ color: "var(--text-secondary)" }}>
            Select a trip to load live occupancy
          </p>
        </div>
      )}
    </div>
  );
}
