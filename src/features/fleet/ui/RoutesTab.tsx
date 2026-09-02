"use client";

import { useState } from "react";
import { Edit, Plus, Trash2 } from "lucide-react";

export default function RoutesTab({
  routes,
  lines,
  onOpenModal,
  onEditRoute,
  onDeactivateRoute,
}: {
  routes: any[];
  lines: any[];
  onOpenModal: () => void;
  onEditRoute: (route: any) => void;
  onDeactivateRoute: (route: any) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    routes[0]?.id ?? null,
  );
  const route = routes.find((item) => item.id === selectedId) ?? routes[0];
  return (
    <div className="management-view route-management animate-fade-in">
      <header className="management-header">
        <div>
          <p className="eyebrow">Directional topology</p>
          <h1 className="section-title">Routes</h1>
          <p className="section-subtitle">
            Ordered stops and travel-time relationships.
          </p>
        </div>
        <button onClick={onOpenModal} className="btn-primary">
          <Plus aria-hidden className="size-4" /> Add route
        </button>
      </header>
      {routes.length === 0 ? (
        <div className="dashboard-empty">No active routes.</div>
      ) : (
        <div className="route-workspace">
          <nav aria-label="Route list">
            {lines.map((line) => (
              <section key={line.id} className="route-line-group">
                <h3>{line.name}</h3>
                <small>{line.code}</small>
                {routes
                  .filter((item) => item.lineId === line.id)
                  .map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      aria-current={route?.id === item.id ? "true" : undefined}
                      className={route?.id === item.id ? "active" : ""}
                    >
                      <strong>{item.direction}</strong>
                      <span>{item.routeStops?.length || 0} stops</span>
                    </button>
                  ))}
              </section>
            ))}
          </nav>
          {route && (
            <section className="route-detail">
              <header>
                <div>
                  <p className="eyebrow">Selected route</p>
                  <span className="badge badge-blue">
                    {route.line.code} · {route.direction}
                  </span>
                  <h2>{route.name}</h2>
                  <p className="section-subtitle">
                    {route.tripsCount ?? 0} scheduled Trip
                    {(route.tripsCount ?? 0) === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="row-actions">
                  <button
                    onClick={() => onEditRoute(route)}
                    className="btn-secondary"
                  >
                    <Edit aria-hidden className="size-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => onDeactivateRoute(route)}
                    className="btn-ghost danger"
                  >
                    <Trash2 aria-hidden className="size-3.5" /> Deactivate
                  </button>
                </div>
              </header>
              <ol className="route-topology">
                {route.routeStops?.map((routeStop: any, index: number) => (
                  <li key={routeStop.id}>
                    <span>{index + 1}</span>
                    <div>
                      <strong>{routeStop.stop.code}</strong>
                      <p>{routeStop.stop.name}</p>
                    </div>
                    {routeStop.travelDurationToNextMinutes === null ? (
                      <small>Final stop</small>
                    ) : (
                      <small className="tabular-nums">
                        {routeStop.travelDurationToNextMinutes} min to next
                      </small>
                    )}
                  </li>
                ))}
              </ol>
              <p className="route-snapshot-note">
                Changes apply only to Trips created after the edit; existing
                Trip snapshots remain unchanged.
              </p>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
