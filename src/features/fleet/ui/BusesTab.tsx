"use client";

import { Edit, Plus, Trash2 } from "lucide-react";
import {
  deriveBusOperationalAssignment,
  type BusAssignmentTrip,
} from "../domain/bus-operational-assignment";

function AssignmentDetails({
  label,
  trip,
}: {
  label: "Current" | "Next";
  trip: BusAssignmentTrip;
}) {
  return (
    <div className="bus-assignment">
      <span>{label}</span>
      <strong>
        {trip.lineCode || trip.lineName || "Service line unavailable"}
        {trip.direction ? ` · ${trip.direction}` : ""}
      </strong>
      <small>{trip.routeName || "Route unavailable"}</small>
      <small>Driver {trip.driverName || "Unassigned"}</small>
      <small>
        {new Date(trip.departureTime).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
        {` · ${trip.status}`}
      </small>
    </div>
  );
}

export default function BusesTab({
  buses,
  trips,
  onOpenModal,
  onEditBus,
  onRetireBus,
}: {
  buses: any[];
  trips: BusAssignmentTrip[];
  onOpenModal: () => void;
  onEditBus: (bus: any) => void;
  onRetireBus: (bus: any) => void;
}) {
  const now = new Date();

  return (
    <div className="management-view animate-fade-in">
      <header className="management-header">
        <div>
          <p className="eyebrow">Fleet inventory</p>
          <h1 className="section-title">Buses</h1>
          <p className="section-subtitle">
            {buses.length} registered vehicles and their operational capacity.
          </p>
        </div>
        <button onClick={onOpenModal} className="btn-primary">
          <Plus aria-hidden className="size-4" /> Add bus
        </button>
      </header>
      <div className="management-table-wrap">
        <table className="management-table buses-management-table">
          <thead>
            <tr>
              <th>Plate number</th>
              <th>Status</th>
              <th>Seated</th>
              <th>Standing</th>
              <th>Current / Next Assignment</th>
              <th>Total Trips</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {buses.map((bus) => {
              const assignment = deriveBusOperationalAssignment(
                trips,
                bus.id,
                now,
              );
              return (
                <tr key={bus.id}>
                  <td>
                    <strong>{bus.plateNumber}</strong>
                  </td>
                  <td>
                    <span
                      className={`badge ${bus.status === "ACTIVE" ? "badge-green" : "badge-amber"}`}
                    >
                      {bus.status}
                    </span>
                  </td>
                  <td className="tabular-nums">{bus.seatedCapacity}</td>
                  <td className="tabular-nums">{bus.standingCapacity}</td>
                  <td>
                    <div className="bus-assignment-stack">
                      {assignment.state === "MULTIPLE_ACTIVE_TRIPS" ? (
                        <div className="bus-assignment-conflict">
                          <strong>Multiple active Trips</strong>
                          <small>
                            {assignment.conflictTripIds.length} records require
                            operational review.
                          </small>
                        </div>
                      ) : assignment.current ? (
                        <AssignmentDetails
                          label="Current"
                          trip={assignment.current}
                        />
                      ) : null}
                      {assignment.next && (
                        <AssignmentDetails label="Next" trip={assignment.next} />
                      )}
                      {assignment.state === "NORMAL" &&
                        !assignment.current &&
                        !assignment.next && (
                          <span className="bus-assignment-empty">
                            No current or upcoming assignment
                          </span>
                        )}
                    </div>
                  </td>
                  <td className="tabular-nums">{bus._count?.trips || 0}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        onClick={() => onEditBus(bus)}
                        className="btn-ghost"
                      >
                        <Edit aria-hidden className="size-3.5" /> Edit
                      </button>
                      {bus.status !== "RETIRED" && (
                        <button
                          onClick={() => onRetireBus(bus)}
                          className="btn-ghost danger"
                        >
                          <Trash2 aria-hidden className="size-3.5" /> Retire
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
