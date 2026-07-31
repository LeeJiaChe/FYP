"use client";

import { Plus } from "lucide-react";

interface TripsTabProps {
  trips: any[];
  onOpenModal: () => void;
}

export default function TripsTab({ trips, onOpenModal }: TripsTabProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="section-title text-xl">Shuttle Timetable & Trip Scheduler</h2>
          <p className="section-subtitle">{trips.length} trips scheduled</p>
        </div>
        <button onClick={onOpenModal} className="btn-primary flex items-center gap-1.5 text-xs">
          <Plus className="w-4 h-4" /> Schedule New Trip
        </button>
      </div>

      <div className="space-y-4">
        {trips.map((t) => (
          <div
            key={t.id}
            className="glass-card p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <div className="space-y-1">
              <span
                className="text-xs font-bold px-2 py-0.5 rounded border"
                style={{
                  background: "rgba(99,102,241,0.15)",
                  color: "var(--accent-secondary)",
                  borderColor: "var(--border-hover)",
                }}
              >
                {t.busPlateNumber}
              </span>
              <h3 className="font-bold text-base mt-1" style={{ color: "var(--text-primary)" }}>{t.routeName}</h3>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Driver: <span style={{ color: "var(--text-primary)" }}>{t.driverName || "Unassigned"}</span> • Departure:{" "}
                <span className="font-semibold" style={{ color: "#4ade80" }}>{new Date(t.departureTime).toLocaleString()}</span>
              </p>
            </div>
            <span
              className="px-3 py-1 text-xs font-bold rounded-xl border uppercase"
              style={{ background: "var(--bg-surface)", color: "var(--text-secondary)", borderColor: "var(--border)" }}
            >
              Status: {t.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
