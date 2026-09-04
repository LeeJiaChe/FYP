"use client";

import SeatGrid from "@/components/SeatGrid";
import { Activity, RefreshCw } from "lucide-react";
import { AdminTripEtaPanel } from "@/features/eta/ui";
import { formatMytTime } from "@/shared/time/operational-time";

interface LiveMonitoringTabProps {
  trips: any[];
  selectedTripId: string | null;
  setSelectedTripId: (id: string | null) => void;
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
    <div className="live-operations animate-fade-in">
      <header className="live-operations-header">
        <div><p className="eyebrow">Live operations</p><h1 className="section-title">Current fleet activity</h1><p className="section-subtitle">Operational Trip state, current segment occupancy and persisted telemetry.</p></div>
        <button
          onClick={onRefresh}
          className="btn-ghost"
          disabled={!selectedTripId}
        >
          <RefreshCw aria-hidden />Refresh
        </button>
      </header>
      <div className="live-trip-selector">
        <Activity aria-hidden />
        <label htmlFor="live-trip-select">
          <span>Select Active Trip to Monitor</span>
          <small>Boarding and departed Trips</small>
        </label>
            <select
              id="live-trip-select"
              value={selectedTripId || ""}
              onChange={(e) => setSelectedTripId(e.target.value || null)}
              className="input-field"
              disabled={trips.length === 0}
            >
              {trips.length === 0 ? (
                <option value="">No active trips</option>
              ) : (
                trips.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.routeName} ({t.busPlateNumber}) · {t.status}
                  </option>
                ))
              )}
            </select>
      </div>
      {liveTripDetails && (
        <div className="live-eta-section my-4">
          <AdminTripEtaPanel tripId={selectedTripId} />
        </div>
      )}

      {liveTripDetails ? (
        <div className="live-operations-workspace">
          <section className="live-seat-region">
            <header>
              <div>
                <p className="eyebrow">Current segment occupancy</p>
                <h2>Bus {liveTripDetails.busPlateNumber}</h2>
                <p>
                  {liveTripDetails.routeName} • Departs:{" "}
                  {formatMytTime(liveTripDetails.departureTime)} MYT
                </p>
                <small>
                  {liveTripDetails.latestLocation
                    ? `${liveTripDetails.latestLocation.source === "SIMULATED" ? "Simulated GPS / Prototype" : "GPS"} · ${formatMytTime(liveTripDetails.latestLocation.recordedAt)} MYT`
                    : "No live telemetry received yet"}
                </small>
                <strong className="live-segment">
                  {liveTripDetails.currentSegment
                    ? `${liveTripDetails.currentSegment.fromStopName} → ${liveTripDetails.currentSegment.toStopName}`
                    : "No active segment"}
                </strong>
              </div>
              <span className="badge badge-blue">
                {liveTripDetails.status}
              </span>
            </header>

            <SeatGrid seats={liveTripDetails.seats || []} mode="admin" />
          </section>

          <aside className="live-occupancy-summary">
              <h2>
                Occupancy Breakdown
              </h2>

              <dl>
                {[
                  {
                    label: "Seated capacity",
                    count: liveTripDetails.stats?.totalSeats || 0,
                  },
                  {
                    label: "Free on current segment",
                    count: liveTripDetails.stats?.availableSeats || 0,
                  },
                  {
                    label: "Reserved on current segment",
                    count: liveTripDetails.stats?.reservedSeats || 0,
                  },
                  {
                    label: "Checked-in",
                    count: liveTripDetails.stats?.checkedInSeats || 0,
                  },
                  {
                    label: "Standing on current segment",
                    count: `${liveTripDetails.stats?.standingPassengers || 0} / ${liveTripDetails.stats?.standingCapacity || 0}`,
                  },
                ].map(({ label, count }) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd className="tabular-nums">{count}</dd>
                  </div>
                ))}
              </dl>
          </aside>
        </div>
      ) : (
        <div className="live-operations-empty">
          <Activity aria-hidden />
          <strong>
            {trips.length === 0
              ? "No active shuttle operations right now."
              : "Loading active Trip occupancy…"}
          </strong>
        </div>
      )}
    </div>
  );
}
