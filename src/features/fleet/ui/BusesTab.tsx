"use client";

import { Edit, Plus, Trash2 } from "lucide-react";

export default function BusesTab({
  buses,
  onOpenModal,
  onEditBus,
  onRetireBus,
}: {
  buses: any[];
  onOpenModal: () => void;
  onEditBus: (bus: any) => void;
  onRetireBus: (bus: any) => void;
}) {
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
        <table className="management-table">
          <thead>
            <tr>
              <th>Plate number</th>
              <th>Status</th>
              <th>Seated</th>
              <th>Standing</th>
              <th>Scheduled Trips</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {buses.map((bus) => (
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
