"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  AlertTriangle,
  Bus,
  ChevronDown,
  DoorOpen,
  MapPin,
  MoreHorizontal,
  Play,
  QrCode,
  Route,
  UserCheck,
  Users,
  Calendar,
} from "lucide-react";
import toast from "react-hot-toast";

import ConfirmModal from "@/components/ConfirmModal";
import Modal from "@/components/Modal";
import MotionSurface from "@/components/MotionSurface";
import Navbar from "@/components/Navbar";
import { useCurrentUser } from "@/features/identity/ui";
import { operationalProgressLabel } from "@/features/trips/public";
import { TripsTab, useTrips } from "@/features/trips/ui";
import type { CurrentUser } from "@/shared/ui/current-user";
import QRScannerModal from "./QRScannerModal";

interface ManifestPassenger {
  recordId: string;
  kind: "RESERVED" | "WALK_IN";
  passengerName: string;
  studentId: string | null;
  seatNumber: number | null;
  boardingStop: string;
  dropOffStop: string;
  boarded: boolean;
  alighted: boolean;
  expectedToBoardHere: boolean;
  expectedToAlightHere: boolean;
}

interface DriverManifest {
  trip: {
    id: string;
    routeName: string;
    busPlateNumber: string;
    status: "NOT_STARTED" | "BOARDING" | "DEPARTED" | "ARRIVED" | "CANCELLED";
    delayMinutes: number;
    delayReason: string | null;
    standingCapacity: number;
  };
  currentStop: { id: string; position: number; name: string } | null;
  stops: Array<{ id: string; position: number; name: string; actualArrival: string | null; actualDeparture: string | null; passedAt: string | null }>;
  manifest: ManifestPassenger[];
}

type DriverDialog = "delay" | "cancel" | "walkin" | null;

function errorMessage(data: unknown): string {
  if (typeof data !== "object" || data === null) return "Operation failed";
  const value = data as { error?: string | { message?: string } };
  return typeof value.error === "string" ? value.error : value.error?.message || "Operation failed";
}

export default function DriverPortal({ initialUser }: { initialUser: CurrentUser }) {
  const { user, loading: userLoading } = useCurrentUser(initialUser);
  const { trips, loadingTrips, fetchTrips } = useTrips(undefined, user?.id);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const activeTripId = selectedTripId ?? trips[0]?.id ?? null;
  const [manifest, setManifest] = useState<DriverManifest | null>(null);
  const [scannerMode, setScannerMode] = useState<
    "BOARDING" | "ALIGHTING" | null
  >(null);
  const [view, setView] = useState<"trip" | "manifest" | "timetable">("trip");
  const [secondaryOpen, setSecondaryOpen] = useState(false);
  const [dialog, setDialog] = useState<DriverDialog>(null);
  const [delayMinutes, setDelayMinutes] = useState("0");
  const [reason, setReason] = useState("");
  const [walkInIntentId, setWalkInIntentId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingProgress, setPendingProgress] = useState<"DEPART_CURRENT_STOP" | "ARRIVE_NEXT_STOP" | null>(null);

  async function refreshManifest(tripId: string) {
    const response = await fetch(`/api/trips/${tripId}/manifest`);
    const data = await response.json();
    if (!response.ok) { toast.error(errorMessage(data)); return; }
    setManifest(data);
  }

  useEffect(() => {
    if (!activeTripId) return;
    const initialRefresh = window.setTimeout(() => void refreshManifest(activeTripId), 0);
    const interval = window.setInterval(() => void refreshManifest(activeTripId), 5_000);
    return () => { window.clearTimeout(initialRefresh); window.clearInterval(interval); };
  }, [activeTripId]);

  async function mutate(path: string, body: unknown) {
    const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(errorMessage(data));
    if (activeTripId) await refreshManifest(activeTripId);
    await fetchTrips();
    return data;
  }

  async function progress(action: string) {
    if (!activeTripId) return;
    try {
      await mutate(`/api/trips/${activeTripId}/progress`, { action });
      toast.success("Trip progress updated");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Progress update failed"); }
  }

  async function submitDialog(event: FormEvent) {
    event.preventDefault();
    if (!activeTripId || !dialog) return;
    setSubmitting(true);
    try {
      if (dialog === "delay") {
        const minutes = Number(delayMinutes);
        if (!Number.isInteger(minutes) || minutes < 0 || !reason.trim()) return;
        await mutate(`/api/trips/${activeTripId}/progress`, { action: "SET_DELAY", delayMinutes: minutes, reason: reason.trim() });
        toast.success("Delay metadata updated");
      } else if (dialog === "cancel") {
        if (!reason.trim()) return;
        await mutate(`/api/trips/${activeTripId}/progress`, { action: "CANCEL", reason: reason.trim() });
        toast.success("Trip cancelled");
      } else {
        if (!walkInIntentId.trim()) return;
        await mutate(`/api/trips/${activeTripId}/manual-checkin`, { kind: "WALK_IN", walkInIntentId: walkInIntentId.trim() });
        toast.success("Walk-in admission processed");
      }
      setDialog(null); setReason(""); setWalkInIntentId(""); setSecondaryOpen(false);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Operation failed"); }
    finally { setSubmitting(false); }
  }

  async function manualReservedBoarding(passenger: ManifestPassenger) {
    if (!activeTripId || passenger.kind !== "RESERVED") return;
    try { await mutate(`/api/trips/${activeTripId}/manual-checkin`, { kind: "RESERVED", bookingId: passenger.recordId }); toast.success("Reserved passenger boarded manually"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Manual boarding failed"); }
  }

  async function manualAlight(passenger: ManifestPassenger) {
    if (!activeTripId) return;
    try { await mutate(`/api/trips/${activeTripId}/alight`, { mode: "MANUAL", kind: passenger.kind, recordId: passenger.recordId }); toast.success("Alighting recorded manually"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Manual alighting failed"); }
  }

  const loading = userLoading || loadingTrips;
  const boardNow = manifest?.manifest.filter((passenger) => !passenger.boarded && passenger.expectedToBoardHere) ?? [];
  const onBoard = manifest?.manifest.filter((passenger) => passenger.boarded && !passenger.alighted) ?? [];
  const alightHere = onBoard.filter((passenger) => passenger.expectedToAlightHere);
  const terminal = manifest?.trip.status === "ARRIVED" || manifest?.trip.status === "CANCELLED";

  function manifestRows(passengers: ManifestPassenger[], kind: "board" | "alight" | "onboard" | "all") {
    return (
      <div className="manifest-rows">
        {passengers.map((passenger) => (
          <article key={`${kind}-${passenger.kind}-${passenger.recordId}`} className="manifest-row">
            <div className="manifest-passenger">
              <span>Passenger</span>
              <strong>{passenger.passengerName}</strong>
              {passenger.studentId && <small>{passenger.studentId}</small>}
            </div>
            <div className="manifest-seat">
              <span>Seat</span>
              <strong>{passenger.kind === "RESERVED" ? passenger.seatNumber : "Standing"}</strong>
            </div>
            <div className="manifest-segment">
              <span>Journey segment</span>
              <p>{passenger.boardingStop} → {passenger.dropOffStop}</p>
            </div>
            <div className="manifest-state">
              <span>Boarding state</span>
              <strong className={`manifest-state-label ${passenger.alighted ? "is-alighted" : passenger.boarded ? "is-onboard" : "is-waiting"}`}>
                {passenger.alighted ? "Alighted" : passenger.boarded ? "On board" : "Waiting"}
              </strong>
            </div>
            {(kind === "board" && passenger.kind === "RESERVED") || kind === "alight" ? (
              <div className="manifest-action">
                {kind === "board" && passenger.kind === "RESERVED" && <button type="button" onClick={() => void manualReservedBoarding(passenger)} className="btn-secondary">Manual board</button>}
                {kind === "alight" && <button type="button" onClick={() => void manualAlight(passenger)} className="btn-secondary">Confirm alighted</button>}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    );
  }

  function manifestEmptyMessage(kind: "board" | "alight" | "onboard") {
    if (kind === "board") return manifest?.currentStop ? "No passengers waiting to board at this stop" : "No passengers currently waiting to board";
    if (kind === "alight") return manifest?.currentStop ? "No passengers alighting at this stop" : "No passengers currently due to alight";
    return "No passengers currently on board";
  }

  function primaryAction() {
    if (!manifest || terminal) return null;
    if (manifest.trip.status === "NOT_STARTED") return <button type="button" onClick={() => void progress("START_BOARDING")} className="driver-primary-action"><Play aria-hidden /> Start boarding</button>;
    if (manifest.trip.status === "BOARDING") return <button type="button" onClick={() => setScannerMode("BOARDING")} className="driver-primary-action"><QrCode aria-hidden /> Scan boarding pass</button>;
    if (manifest.currentStop && alightHere.length > 0) return <button type="button" onClick={() => setScannerMode("ALIGHTING")} className="driver-primary-action"><DoorOpen aria-hidden /> Scan alighting pass</button>;
    if (manifest.trip.status === "DEPARTED" && !manifest.currentStop) return <button type="button" onClick={() => setPendingProgress("ARRIVE_NEXT_STOP")} className="driver-primary-action"><MapPin aria-hidden /> Arrive next stop</button>;
    if (manifest.currentStop) return <button type="button" onClick={() => setPendingProgress("DEPART_CURRENT_STOP")} className="driver-primary-action"><Route aria-hidden /> Depart {manifest.currentStop.name}</button>;
    return null;
  }

  return (
    <div className="driver-shell">
      <Navbar initialUser={user} />
      <main id="main-content" className="driver-content">
        <header className="driver-trip-selector">
          <div>
            <h1>Today&apos;s operation</h1>
            <p>Select an assigned Trip to begin.</p>
          </div>
          <label htmlFor="assigned-trip">
            <span>Assigned Trip</span>
            <select
              id="assigned-trip"
              value={activeTripId ?? ""}
              onChange={(event) => setSelectedTripId(event.target.value)}
              className="input-field"
            >
              {trips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {trip.routeName} ·{" "}
                  {new Date(trip.departureTime).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </option>
              ))}
            </select>
          </label>
        </header>

        <nav className="driver-view-nav" aria-label="Driver workspace">
          <button
            type="button"
            className={view === "trip" ? "active" : ""}
            aria-current={view === "trip" ? "page" : undefined}
            onClick={() => setView("trip")}
          >
            <Bus aria-hidden /> Trip
          </button>
          <button
            type="button"
            className={view === "manifest" ? "active" : ""}
            aria-current={view === "manifest" ? "page" : undefined}
            onClick={() => setView("manifest")}
          >
            <Users aria-hidden /> Manifest{" "}
            <span>{manifest?.manifest.length || 0}</span>
          </button>
          <button
            type="button"
            className={view === "timetable" ? "active" : ""}
            aria-current={view === "timetable" ? "page" : undefined}
            onClick={() => setView("timetable")}
          >
            <Calendar aria-hidden /> Timetable{" "}
          </button>
        </nav>

        <MotionSurface motionKey={view}>
        {loading && <div className="driver-empty">Loading assigned Trips…</div>}
        {!loading && trips.length === 0 && <div className="driver-empty">No Trips are assigned to this driver.</div>}

        {manifest && view === "trip" && (
          <section className="driver-mission-surface">
            <header className="driver-mission-header">
              <div className="driver-mission-identity"><span><Bus aria-hidden /></span><div><strong>{manifest.trip.routeName}</strong><small>{manifest.trip.busPlateNumber}</small></div></div>
              <div className="driver-mission-controls"><div className="active-trip-status"><span className="badge badge-blue">{manifest.trip.status.replace("_", " ")}</span>{manifest.trip.delayMinutes > 0 && <span className="badge badge-amber">Delayed {manifest.trip.delayMinutes} min</span>}</div><button type="button" aria-expanded={secondaryOpen} onClick={() => setSecondaryOpen((value) => !value)} className="driver-overflow"><MoreHorizontal aria-hidden /><span>More operations</span><ChevronDown aria-hidden /></button>{secondaryOpen && <div className="driver-secondary-menu"><button type="button" onClick={() => { setDialog("walkin"); setSecondaryOpen(false); }}><UserCheck aria-hidden /> Manual walk-in</button><button type="button" onClick={() => { setDelayMinutes(String(manifest.trip.delayMinutes)); setDialog("delay"); setSecondaryOpen(false); }}><AlertTriangle aria-hidden /> Set delay</button><button type="button" className="danger" onClick={() => { setDialog("cancel"); setSecondaryOpen(false); }}>Cancel Trip</button></div>}</div>
            </header>
            <div className="driver-trip-workspace">
            <section className="active-trip-panel">
              <div className="driver-current-stop"><MapPin aria-hidden /><div><span>Current stop</span><h2><span className="sr-only">Current stop: </span>{manifest.currentStop?.name || "Between stops"}</h2><p className="active-trip-progress">{operationalProgressLabel(manifest.trip.status, manifest.currentStop?.name ?? null)}</p></div></div>
              <div className="driver-passenger-load"><span><strong className="tabular-nums">{boardNow.length}</strong> waiting</span><span><strong className="tabular-nums">{onBoard.length}</strong> on board</span></div>
              {manifest.trip.delayReason && <p className="delay-reason">{manifest.trip.delayReason}</p>}
              <div className="driver-primary-area"><span className="driver-action-label">{terminal ? "Current state" : "Next operation"}</span>{primaryAction() || <p>This Trip is complete. No operational action is available.</p>}</div>
              {!terminal && <div className="driver-context-actions">{manifest.trip.status === "BOARDING" && manifest.currentStop && <button type="button" className="btn-secondary" onClick={() => setPendingProgress("DEPART_CURRENT_STOP")}>Depart stop</button>}{manifest.trip.status !== "BOARDING" && manifest.currentStop && <button type="button" className="btn-secondary" onClick={() => setScannerMode("BOARDING")}><QrCode aria-hidden className="size-4" /> Scan boarding</button>}{alightHere.length > 0 && <button type="button" className="btn-secondary" onClick={() => setScannerMode("ALIGHTING")}><DoorOpen aria-hidden className="size-4" /> Scan alighting</button>}</div>}
            </section>

            <section className="driver-progress-panel" aria-labelledby="driver-route-progress">
              <div className="driver-panel-heading"><div><h2 id="driver-route-progress">Route progress</h2></div></div>
              <ol className="driver-stop-list">{manifest.stops.map((stop) => { const current = manifest.currentStop?.id === stop.id; const passed = !!(stop.actualDeparture || stop.passedAt); return <li key={stop.id} className={current ? "current" : passed ? "passed" : ""}><span>{stop.position + 1}</span><div><strong>{stop.name}</strong><small>{current ? "Current stop" : passed ? "Completed" : "Upcoming"}</small></div></li>; })}</ol>
            </section>
            </div>
          </section>
        )}

          {manifest && view === "trip" && (
            <section className="driver-mission-surface">
              <header className="driver-mission-header">
                <div className="driver-mission-identity">
                  <span>
                    <Bus aria-hidden />
                  </span>
                  <div>
                    <strong>{manifest.trip.routeName}</strong>
                    <small>{manifest.trip.busPlateNumber}</small>
                  </div>
                </div>
                <div className="driver-mission-controls">
                  <div className="active-trip-status">
                    <span className="badge badge-blue">
                      {manifest.trip.status.replace("_", " ")}
                    </span>
                    {manifest.trip.delayMinutes > 0 && (
                      <span className="badge badge-amber">
                        Delayed {manifest.trip.delayMinutes} min
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-expanded={secondaryOpen}
                    onClick={() => setSecondaryOpen((value) => !value)}
                    className="driver-overflow"
                  >
                    <MoreHorizontal aria-hidden />
                    <span>More operations</span>
                    <ChevronDown aria-hidden />
                  </button>
                  {secondaryOpen && (
                    <div className="driver-secondary-menu">
                      <button
                        type="button"
                        onClick={() => {
                          setDialog("walkin");
                          setSecondaryOpen(false);
                        }}
                      >
                        <UserCheck aria-hidden /> Manual walk-in
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDelayMinutes(String(manifest.trip.delayMinutes));
                          setDialog("delay");
                          setSecondaryOpen(false);
                        }}
                      >
                        <AlertTriangle aria-hidden /> Set delay
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => {
                          setDialog("cancel");
                          setSecondaryOpen(false);
                        }}
                      >
                        Cancel Trip
                      </button>
                    </div>
                  )}
                </div>
              </header>
              <div className="driver-trip-workspace">
                <section className="active-trip-panel">
                  <div className="driver-current-stop">
                    <MapPin aria-hidden />
                    <div>
                      <span>Current stop</span>
                      <h2>
                        <span className="sr-only">Current stop: </span>
                        {manifest.currentStop?.name || "Between stops"}
                      </h2>
                      <p className="active-trip-progress">
                        {operationalProgressLabel(
                          manifest.trip.status,
                          manifest.currentStop?.name ?? null,
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="driver-passenger-load">
                    <span>
                      <strong className="tabular-nums">
                        {boardNow.length}
                      </strong>{" "}
                      waiting
                    </span>
                    <span>
                      <strong className="tabular-nums">{onBoard.length}</strong>{" "}
                      on board
                    </span>
                  </div>
                  {manifest.trip.delayReason && (
                    <p className="delay-reason">{manifest.trip.delayReason}</p>
                  )}
                  <div className="driver-primary-area">
                    <span className="driver-action-label">
                      {terminal ? "Current state" : "Next operation"}
                    </span>
                    {primaryAction() || (
                      <p>
                        This Trip is complete. No operational action is
                        available.
                      </p>
                    )}
                  </div>
                  {!terminal && (
                    <div className="driver-context-actions">
                      {manifest.trip.status === "BOARDING" &&
                        manifest.currentStop && (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() =>
                              setPendingProgress("DEPART_CURRENT_STOP")
                            }
                          >
                            Depart stop
                          </button>
                        )}
                      {manifest.trip.status !== "BOARDING" &&
                        manifest.currentStop && (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setScannerMode("BOARDING")}
                          >
                            <QrCode aria-hidden className="size-4" /> Scan
                            boarding
                          </button>
                        )}
                      {alightHere.length > 0 && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => setScannerMode("ALIGHTING")}
                        >
                          <DoorOpen aria-hidden className="size-4" /> Scan
                          alighting
                        </button>
                      )}
                    </div>
                  )}
                </section>

                <section
                  className="driver-progress-panel"
                  aria-labelledby="driver-route-progress"
                >
                  <div className="driver-panel-heading">
                    <div>
                      <h2 id="driver-route-progress">Route progress</h2>
                    </div>
                  </div>
                  <ol className="driver-stop-list">
                    {manifest.stops.map((stop) => {
                      const current = manifest.currentStop?.id === stop.id;
                      const passed = !!(stop.actualDeparture || stop.passedAt);
                      return (
                        <li
                          key={stop.id}
                          className={
                            current ? "current" : passed ? "passed" : ""
                          }
                        >
                          <span>{stop.position + 1}</span>
                          <div>
                            <strong>{stop.name}</strong>
                            <small>
                              {current
                                ? "Current stop"
                                : passed
                                  ? "Completed"
                                  : "Upcoming"}
                            </small>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              </div>
            </section>
          )}

          {manifest && view === "manifest" && (
            <section className="driver-manifest">
              <header>
                <div>
                  <h2>Passenger worklist</h2>
                  <p>
                    {manifest.trip.routeName} · {manifest.trip.busPlateNumber}
                  </p>
                </div>
                <strong>
                  {manifest.currentStop
                    ? `At ${manifest.currentStop.name}`
                    : "Between stops"}
                </strong>
              </header>
              {[
                { title: "Board now", items: boardNow, kind: "board" as const },
                {
                  title: "Alight here",
                  items: alightHere,
                  kind: "alight" as const,
                },
                {
                  title: "On board",
                  items: onBoard.filter(
                    (passenger) => !passenger.expectedToAlightHere,
                  ),
                  kind: "onboard" as const,
                },
              ].map((group) => (
                <section
                  key={group.title}
                  className={`manifest-group group-${group.kind} ${group.items.length === 0 ? "empty" : ""} ${group.kind === "board" && group.items.length > 0 ? "priority" : group.kind === "alight" && boardNow.length === 0 && group.items.length > 0 ? "priority" : ""}`}
                >
                  <h3>
                    {group.title}
                    <span>{group.items.length}</span>
                  </h3>
                  {group.items.length === 0 ? (
                    <p className="manifest-empty">
                      {manifestEmptyMessage(group.kind)}
                    </p>
                  ) : (
                    manifestRows(group.items, group.kind)
                  )}
                </section>
              ))}
              <details className="manifest-archive">
                <summary>
                  <span>All passengers</span>
                  <span className="tabular-nums">
                    {manifest.manifest.length}
                  </span>
                </summary>
                {manifest.manifest.length > 0 ? (
                  manifestRows(manifest.manifest, "all")
                ) : (
                  <p className="manifest-empty">
                    No passengers are attached to this Trip
                  </p>
                )}
              </details>
            </section>
          )}

          {view === "timetable" && (
            <TripsTab
              isDriverPortal={true}
              trips={trips}
              onOpenModal={null}
              onEditTrip={null}
              onCancelTrip={null}
            />
          )}
        </MotionSurface>
      </main>

      {scannerMode && activeTripId && <QRScannerModal tripId={activeTripId} routeName={manifest?.trip.routeName} currentStopName={manifest?.currentStop?.name ?? undefined} mode={scannerMode} onClose={() => setScannerMode(null)} onSuccess={() => void refreshManifest(activeTripId)} />}

      <Modal isOpen={dialog !== null} onClose={() => !submitting && setDialog(null)} title={dialog === "delay" ? "Set Trip delay" : dialog === "cancel" ? "Cancel Trip" : "Manual walk-in admission"} description={dialog === "cancel" ? "This destructive action requires an operational reason." : undefined} maxWidth="sm">
        <form onSubmit={submitDialog} className="driver-operation-form">
          {dialog === "delay" && <label><span>Delay in minutes</span><input className="input-field tabular-nums" type="number" min="0" step="1" required value={delayMinutes} onChange={(event) => setDelayMinutes(event.target.value)} /></label>}
          {(dialog === "delay" || dialog === "cancel") && <label><span>{dialog === "cancel" ? "Cancellation reason" : "Delay reason"}</span><textarea className="input-field" rows={3} required value={reason} onChange={(event) => setReason(event.target.value)} /></label>}
          {dialog === "walkin" && <label><span>Walk-in Intent ID</span><input className="input-field" required value={walkInIntentId} onChange={(event) => setWalkInIntentId(event.target.value)} autoComplete="off" /></label>}
          <div className="driver-form-actions"><button type="button" className="btn-ghost" onClick={() => setDialog(null)}>Back</button><button disabled={submitting} className={dialog === "cancel" ? "btn-danger" : "btn-primary"}>{submitting ? "Saving…" : dialog === "cancel" ? "Cancel Trip" : "Confirm"}</button></div>
        </form>
      </Modal>
      <ConfirmModal isOpen={pendingProgress !== null} onClose={() => setPendingProgress(null)} onConfirm={() => { if (pendingProgress) void progress(pendingProgress); setPendingProgress(null); }} title={pendingProgress === "DEPART_CURRENT_STOP" ? "Depart current stop?" : "Arrive at next stop?"} message={pendingProgress === "DEPART_CURRENT_STOP" ? "Boarding at this stop will close when the Trip departs." : "Confirm that the shuttle has arrived at the next stop."} confirmText="Confirm progress" cancelText="Go back" />
    </div>
  );
}
