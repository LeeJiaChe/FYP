"use client";

import { useEffect, useState } from "react";
import { Bus, DoorOpen, MapPin, Play, QrCode, UserCheck } from "lucide-react";
import toast from "react-hot-toast";

import Navbar from "@/components/Navbar";
import QRScannerModal from "./QRScannerModal";
import { useCurrentUser } from "@/features/identity/ui";
import { useTrips } from "@/features/trips/ui";
import type { CurrentUser } from "@/shared/ui/current-user";
import { operationalProgressLabel } from "@/features/trips/public";

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
  stops: Array<{
    id: string;
    position: number;
    name: string;
    actualArrival: string | null;
    actualDeparture: string | null;
    passedAt: string | null;
  }>;
  manifest: ManifestPassenger[];
}

function errorMessage(data: unknown): string {
  if (typeof data !== "object" || data === null) return "Operation failed";
  const value = data as { error?: string | { message?: string } };
  return typeof value.error === "string"
    ? value.error
    : value.error?.message || "Operation failed";
}

export default function DriverPortal({ initialUser }: { initialUser: CurrentUser }) {
  const { user, loading: userLoading } = useCurrentUser(initialUser);
  const { trips, loadingTrips, fetchTrips } = useTrips(undefined, user?.id);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const activeTripId = selectedTripId ?? trips[0]?.id ?? null;
  const [manifest, setManifest] = useState<DriverManifest | null>(null);
  const [scannerMode, setScannerMode] = useState<"BOARDING" | "ALIGHTING" | null>(null);

  async function refreshManifest(tripId: string) {
    const response = await fetch(`/api/trips/${tripId}/manifest`);
    const data = await response.json();
    if (!response.ok) {
      toast.error(errorMessage(data));
      return;
    }
    setManifest(data);
  }

  useEffect(() => {
    if (!activeTripId) return;
    const initialRefresh = window.setTimeout(() => void refreshManifest(activeTripId), 0);
    const interval = window.setInterval(() => void refreshManifest(activeTripId), 5_000);
    return () => { window.clearTimeout(initialRefresh); window.clearInterval(interval); };
  }, [activeTripId]);

  async function mutate(path: string, body: unknown) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(errorMessage(data));
    if (activeTripId) await refreshManifest(activeTripId);
    await fetchTrips();
    return data;
  }

  async function progress(action: string) {
    if (!activeTripId) return;
    if (
      (action === "DEPART_CURRENT_STOP" || action === "ARRIVE_NEXT_STOP") &&
      !window.confirm(
        action === "DEPART_CURRENT_STOP"
          ? "Confirm departure from the current stop? Boarding at this stop will close."
          : "Confirm arrival at the next stop?",
      )
    ) return;
    try {
      await mutate(`/api/trips/${activeTripId}/progress`, { action });
      toast.success("Trip progress updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Progress update failed");
    }
  }

  async function setDelay() {
    if (!activeTripId) return;
    const minutes = Number(window.prompt("Delay in minutes", String(manifest?.trip.delayMinutes ?? 0)));
    const reason = window.prompt("Delay reason")?.trim();
    if (!Number.isInteger(minutes) || minutes < 0 || !reason) return;
    try {
      await mutate(`/api/trips/${activeTripId}/progress`, {
        action: "SET_DELAY",
        delayMinutes: minutes,
        reason,
      });
      toast.success("Delay metadata updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delay update failed");
    }
  }

  async function cancelTrip() {
    if (!activeTripId) return;
    const reason = window.prompt("Cancellation reason (required)")?.trim();
    if (!reason) return;
    if (!window.confirm(`Cancel this Trip?\n\nReason: ${reason}`)) return;
    try {
      await mutate(`/api/trips/${activeTripId}/progress`, { action: "CANCEL", reason });
      toast.success("Trip cancelled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cancellation failed");
    }
  }

  async function manualReservedBoarding(passenger: ManifestPassenger) {
    if (!activeTripId || passenger.kind !== "RESERVED") return;
    try {
      await mutate(`/api/trips/${activeTripId}/manual-checkin`, {
        kind: "RESERVED",
        bookingId: passenger.recordId,
      });
      toast.success("Reserved passenger boarded manually");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Manual boarding failed");
    }
  }

  async function manualWalkInBoarding() {
    if (!activeTripId) return;
    const walkInIntentId = window.prompt("Walk-in Intent ID")?.trim();
    if (!walkInIntentId) return;
    try {
      await mutate(`/api/trips/${activeTripId}/manual-checkin`, {
        kind: "WALK_IN",
        walkInIntentId,
      });
      toast.success("Walk-in admission processed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Walk-in admission failed");
    }
  }

  async function manualAlight(passenger: ManifestPassenger) {
    if (!activeTripId) return;
    try {
      await mutate(`/api/trips/${activeTripId}/alight`, {
        mode: "MANUAL",
        kind: passenger.kind,
        recordId: passenger.recordId,
      });
      toast.success("Alighting recorded manually");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Manual alighting failed");
    }
  }

  const loading = userLoading || loadingTrips;
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar initialUser={user} />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <header className="glass-panel p-6 rounded-3xl border border-slate-800 flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-400">Assigned-driver operations</p>
            <h1 className="text-2xl font-extrabold">Boarding, alighting and Trip progress</h1>
          </div>
          <label className="text-sm font-semibold" htmlFor="assigned-trip">Assigned Trip</label>
          <select id="assigned-trip" value={activeTripId ?? ""} onChange={(event) => setSelectedTripId(event.target.value)} className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm">
            {trips.map((trip) => <option key={trip.id} value={trip.id}>{trip.routeName} — {new Date(trip.departureTime).toLocaleTimeString()}</option>)}
          </select>
        </header>

        {loading && <p className="text-slate-400">Loading assigned Trips…</p>}
        {!loading && trips.length === 0 && <p className="glass-panel p-8 rounded-3xl text-slate-400">No Trips are assigned to this driver.</p>}

        {manifest && (
          <>
            <section className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <h2 className="font-bold text-lg">{manifest.trip.routeName}</h2>
                  <p className="text-xs text-slate-400"><Bus className="inline w-3 h-3" /> {manifest.trip.busPlateNumber} · {manifest.trip.status} · standing {manifest.trip.standingCapacity}</p>
                  <p className="text-xs text-blue-300 mt-1"><MapPin className="inline w-3 h-3" /> {operationalProgressLabel(manifest.trip.status, manifest.currentStop?.name ?? null)}</p>
                  {manifest.trip.delayMinutes > 0 && <p className="text-xs text-amber-300">Delayed {manifest.trip.delayMinutes} min: {manifest.trip.delayReason}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setScannerMode("BOARDING")} className="px-3 py-2 bg-emerald-600 rounded-xl text-xs font-bold"><QrCode className="inline w-4 h-4" /> Scan Boarding</button>
                  <button onClick={() => setScannerMode("ALIGHTING")} className="px-3 py-2 bg-cyan-700 rounded-xl text-xs font-bold"><DoorOpen className="inline w-4 h-4" /> Scan Exit</button>
                  <button onClick={() => void manualWalkInBoarding()} className="px-3 py-2 bg-blue-700 rounded-xl text-xs font-bold"><UserCheck className="inline w-4 h-4" /> Manual Walk-in</button>
                  <button onClick={() => void setDelay()} className="px-3 py-2 bg-amber-700 rounded-xl text-xs font-bold">Set delay</button>
                  {manifest.trip.status !== "ARRIVED" && manifest.trip.status !== "CANCELLED" && <button onClick={() => void cancelTrip()} className="px-3 py-2 bg-rose-800 rounded-xl text-xs font-bold">Cancel Trip</button>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                {manifest.trip.status === "NOT_STARTED" && <button onClick={() => void progress("START_BOARDING")} className="px-4 py-2 bg-blue-600 rounded-xl text-sm font-bold"><Play className="inline w-4 h-4" /> Start boarding</button>}
                {manifest.trip.status === "DEPARTED" && !manifest.currentStop && <button onClick={() => void progress("ARRIVE_NEXT_STOP")} className="px-4 py-2 bg-blue-600 rounded-xl text-sm font-bold">Arrive next stop</button>}
                {(manifest.trip.status === "BOARDING" || manifest.trip.status === "DEPARTED") && manifest.currentStop && <button onClick={() => void progress("DEPART_CURRENT_STOP")} className="px-4 py-2 bg-indigo-600 rounded-xl text-sm font-bold">Depart {manifest.currentStop.name}</button>}
              </div>
            </section>

            <section className="glass-panel p-5 rounded-3xl border border-slate-800">
              <h2 className="font-bold mb-4">Operational manifest</h2>
              <div className="space-y-2">
                {manifest.manifest.map((passenger) => (
                  <div key={`${passenger.kind}-${passenger.recordId}`} className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                    <div>
                      <p className="font-bold text-white">{passenger.passengerName} · {passenger.kind}{passenger.seatNumber ? ` · Seat ${passenger.seatNumber}` : " · Standing"}</p>
                      <p className="text-slate-400">ID {passenger.studentId || "—"} · {passenger.boardingStop} → {passenger.dropOffStop}</p>
                      <p className="text-slate-300">{passenger.alighted ? "Alighted" : passenger.boarded ? "Boarded" : "Not boarded"}{passenger.expectedToAlightHere && !passenger.alighted ? " · Expected to alight here" : ""}</p>
                    </div>
                    <div className="flex gap-2">
                      {!passenger.boarded && passenger.kind === "RESERVED" && <button onClick={() => void manualReservedBoarding(passenger)} className="px-3 py-2 bg-blue-700 rounded-lg font-bold">Manual board</button>}
                      {passenger.boarded && !passenger.alighted && passenger.expectedToAlightHere && <button onClick={() => void manualAlight(passenger)} className="px-3 py-2 bg-cyan-700 rounded-lg font-bold">Confirm alighted</button>}
                    </div>
                  </div>
                ))}
                {manifest.manifest.length === 0 && <p className="text-slate-500">No reserved or admitted walk-in passengers.</p>}
              </div>
            </section>
          </>
        )}
      </main>

      {scannerMode && activeTripId && <QRScannerModal tripId={activeTripId} mode={scannerMode} onClose={() => setScannerMode(null)} onSuccess={() => void refreshManifest(activeTripId)} />}
    </div>
  );
}
