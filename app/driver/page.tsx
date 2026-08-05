"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import SeatGrid, { SeatItem } from "@/components/SeatGrid";
import QRScannerModal from "@/components/QRScannerModal";
import ConfirmModal from "@/components/ConfirmModal";
import Modal from "@/components/Modal";
import { useAuth } from "@/hooks/useAuth";
import { useTrips } from "@/hooks/useTrips";
import toast from "react-hot-toast";
import {
  Bus,
  Clock,
  UserCheck,
  AlertTriangle,
  QrCode,
  CheckCircle2,
  RefreshCw,
  XCircle,
  FileText,
} from "lucide-react";

export default function DriverDashboard() {
  const { user, loading: userLoading } = useAuth();
  const { trips: myTrips, loadingTrips, fetchTrips } = useTrips(undefined, user?.id);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [selectedTripDetails, setSelectedTripDetails] = useState<any>(null);
  const loading = userLoading || loadingTrips;

  // Modals state
  const [showScanner, setShowScanner] = useState(false);
  const [showDelayModal, setShowDelayModal] = useState(false);
  const [delayStatus, setDelayStatus] = useState<"DELAYED" | "CANCELLED">("DELAYED");
  const [delayReason, setDelayReason] = useState("");
  const [updatingDelay, setUpdatingDelay] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{title: string, message: string, onConfirm: () => void, isDestructive?: boolean} | null>(null);

  useEffect(() => {
    if (myTrips.length > 0 && !selectedTripId) {
      setSelectedTripId(myTrips[0].id);
    }
  }, [myTrips, selectedTripId]);

  useEffect(() => {
    if (selectedTripId) {
      fetchTripDetails(selectedTripId);
      const interval = setInterval(() => fetchTripDetails(selectedTripId), 5000);
      return () => clearInterval(interval);
    }
  }, [selectedTripId]);



  async function fetchTripDetails(tripId: string) {
    try {
      const res = await fetch(`/api/trips/${tripId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedTripDetails(data.trip);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch trip details");
    }
  }

  async function handleManualCheckIn(seat: SeatItem) {
    if (!seat.booking || seat.status === "CHECKED_IN") return;
    if (!confirm(`Manually check in ${seat.booking.studentName} for Seat #${seat.seatNumber}?`)) return;

    try {
      const res = await fetch(`/api/trips/${selectedTripId}/manual-checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: seat.booking.id }),
      });

      if (res.ok) {
        toast.success(`Checked in ${seat.booking.studentName}`);
        fetchTripDetails(selectedTripId!);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to check in");
      }
    } catch (err: any) {
      toast.error(err.message || "Network error");
    }
  }

  async function handleUpdateTripStatus(newStatus: string) {
    if (!selectedTripId) return;
    

    try {
      const res = await fetch(`/api/trips/${selectedTripId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        toast.success(`Trip status updated to ${newStatus}`);
        fetchTripDetails(selectedTripId);
        fetchTrips();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update trip status");
      }
    } catch (err: any) {
      toast.error(err.message || "Network error");
    }
  }

  async function handleReportDelay(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTripId) return;
    setUpdatingDelay(true);

    try {
      const res = await fetch(`/api/trips/${selectedTripId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: delayStatus,
          delayReason,
        }),
      });

      if (res.ok) {
        toast.success(`Status broadcasted: ${delayStatus}`);
        setShowDelayModal(false);
        fetchTripDetails(selectedTripId);
        fetchTrips();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to broadcast update");
      }
    } catch (err: any) {
      toast.error(err.message || "Network error");
    } finally {
      setUpdatingDelay(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar initialUser={user} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Driver Header */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center space-x-3 mb-1">
              <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 font-extrabold text-xs rounded-lg uppercase tracking-wider">
                Driver Console
              </span>
              <span className="text-xs text-slate-400">Welcome, {user?.name}</span>
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Trip Manifest & Live Boarding Control</h1>
          </div>

          {/* Assigned Trip Selector Dropdown */}
          <div className="flex items-center space-x-3 w-full md:w-auto">
            <label className="text-xs font-semibold text-slate-400 shrink-0">Assigned Trip:</label>
            <select
              value={selectedTripId || ""}
              onChange={(e) => setSelectedTripId(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-4 py-2.5 focus:outline-none focus:border-amber-500 w-full md:w-64"
            >
              {myTrips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.routeName} ({t.busPlateNumber})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Selected Trip Info & Controls */}
        {loading ? (
          <div className="py-20 text-center text-xs text-slate-400">Loading driver manifest...</div>
        ) : !selectedTripDetails ? (
          <div className="glass-panel p-12 rounded-3xl text-center text-slate-400 text-xs">
            No trips currently assigned to your driver account.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Real-time Seat Manifest Grid */}
            <div className="lg:col-span-2 space-y-6">
              <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-white">{selectedTripDetails.routeName}</h2>
                    <p className="text-xs text-slate-400">
                      Bus: <span className="text-blue-400 font-bold">{selectedTripDetails.busPlateNumber}</span> • Departure:{" "}
                      {new Date(selectedTripDetails.departureTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowScanner(true)}
                      className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/25 flex items-center gap-2"
                    >
                      <QrCode className="w-4 h-4" /> Scan QR Pass
                    </button>
                    <button
                      onClick={() => setShowDelayModal(true)}
                      className="px-4 py-2.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
                    >
                      <AlertTriangle className="w-4 h-4" /> Report Delay
                    </button>
                    {selectedTripDetails.status === "SCHEDULED" || selectedTripDetails.status === "BOARDING" || selectedTripDetails.status === "DELAYED" ? (
                      <button
                        onClick={() => setConfirmAction({ title: "Start Trip", message: "Are you sure you want to mark this trip as DEPARTED?", onConfirm: () => handleUpdateTripStatus("DEPARTED") })}
                        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5"
                      >
                        Start Trip (Depart)
                      </button>
                    ) : selectedTripDetails.status === "DEPARTED" ? (
                      <button
                        onClick={() => setConfirmAction({ title: "End Trip", message: "Are you sure you want to mark this trip as ARRIVED?", onConfirm: () => handleUpdateTripStatus("ARRIVED") })}
                        className="px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5"
                      >
                        End Trip (Arrived)
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Seat Grid */}
                <SeatGrid
                  seats={selectedTripDetails.seats || []}
                  onManualCheckIn={handleManualCheckIn}
                  mode="driver"
                />
              </div>
            </div>

            {/* Right Column: Live Manifest List & Stats */}
            <div className="space-y-6">
              <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-400" /> Student Manifest
                </h3>

                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {(selectedTripDetails.seats || []).map((s: SeatItem) => {
                    if (!s.booking) return null;
                    return (
                      <div
                        key={s.id}
                        className="p-3 bg-slate-900/80 rounded-2xl border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-white">
                            Seat #{s.seatNumber} — {s.booking.studentName}
                          </div>
                          <div className="text-[10px] text-slate-400">ID: {s.booking.studentId}</div>
                        </div>

                        {s.status === "CHECKED_IN" ? (
                          <span className="px-2 py-1 bg-emerald-500/20 text-emerald-300 font-bold rounded-lg text-[10px] flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Checked In
                          </span>
                        ) : (
                          <button
                            onClick={() => handleManualCheckIn(s)}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-[10px]"
                          >
                            Manual Check-In
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* QR SCANNER MODAL */}
      {showScanner && selectedTripId && (
        <QRScannerModal
          tripId={selectedTripId}
          onClose={() => setShowScanner(false)}
          onSuccess={() => {
            fetchTripDetails(selectedTripId);
          }}
        />
      )}

      {/* DELAY REPORT MODAL */}
      {showDelayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="glass-panel w-full max-w-md rounded-3xl p-6 border border-slate-700/80 shadow-2xl relative space-y-4">
            <button
              onClick={() => setShowDelayModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800"
            >
              ✕
            </button>

            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" /> Report Delay or Breakdown
            </h2>
            <p className="text-xs text-slate-400">
              Broadcasting status updates to transport admins and booked students.
            </p>

            <form onSubmit={handleReportDelay} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Status Type</label>
                <select
                  value={delayStatus}
                  onChange={(e) => setDelayStatus(e.target.value as any)}
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 text-xs text-white rounded-xl"
                >
                  <option value="DELAYED">DELAYED</option>
                  <option value="CANCELLED">CANCELLED (Breakdown / Emergency)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Delay Reason</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe reason for delay (e.g. heavy traffic jam on DU Highway, engine breakdown)..."
                  value={delayReason}
                  onChange={(e) => setDelayReason(e.target.value)}
                  className="w-full p-3 bg-slate-900 border border-slate-800 text-xs text-white rounded-xl placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDelayModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingDelay}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow-lg disabled:opacity-50"
                >
                  {updatingDelay ? "Updating..." : "Broadcast Update"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => { if (confirmAction) confirmAction.onConfirm(); }}
        title={confirmAction?.title || ""}
        message={confirmAction?.message || ""}
        confirmText="Confirm"
        isDestructive={confirmAction?.isDestructive}
      />
    </div>
  );
}
