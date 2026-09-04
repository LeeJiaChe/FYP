"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import Navbar from "@/components/Navbar";
import Modal from "@/components/Modal";
import MotionSurface from "@/components/MotionSurface";
import ConfirmModal from "@/components/ConfirmModal";
import SeatGrid, { SeatItem } from "@/components/SeatGrid";
import { DynamicQRModal, type DynamicPassDescriptor } from "@/features/boarding/ui";
import { PenaltyAppealModal, PenaltiesTab } from "@/features/penalties/ui";
import StudentHome from "@/components/student/StudentHome";
import TripsTab from "@/features/bookings/ui/TripsTab";
import MyBookingsTab from "@/features/bookings/ui/MyBookingsTab";
import { TrackBusTab } from "@/features/location/ui";
import { useCurrentUser } from "@/features/identity/ui";
import { useTrips } from "@/features/trips/ui";
import { productPolicy } from "@/shared/config/policies";
import type { CurrentUser } from "@/shared/ui/current-user";
import { formatMytTime } from "@/shared/time/operational-time";
import { useOperationalClock } from "@/shared/ui/useOperationalClock";

import { AlertCircle, Bus, CheckCircle2, Home, Navigation, Ticket, UserRound } from "lucide-react";

type StudentView = "home" | "book" | "journeys" | "track" | "account";

export default function StudentPortal({ initialUser, initialTime, initialView = "home" }: { initialUser: CurrentUser; initialTime: string; initialView?: StudentView }) {
  const operationalNow = useOperationalClock();
  const [activeTab, setActiveTab] = useState<StudentView>(initialView);
  const scrollViewportRef = useRef<HTMLElement>(null);
  const { user, fetchUser } = useCurrentUser(initialUser);

  // Trips state
  const [routes, setRoutes] = useState<any[]>([]);
  const { trips, fetchTrips } = useTrips();

  // Seat booking modal state
  const [selectedTrip, setSelectedTrip] = useState<any>(null);
  const [selectedJourney, setSelectedJourney] = useState<{
    boardingTripStopId: string;
    dropOffTripStopId: string;
    boardingStopName: string;
    dropOffStopName: string;
  } | null>(null);
  const [tripSeats, setTripSeats] = useState<SeatItem[]>([]);
  const [selectedEligibility, setSelectedEligibility] = useState<any>(null);
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingConfirmation, setBookingConfirmation] = useState<any>(null);

  // My Bookings state
  const [myBookings, setMyBookings] = useState<any[]>([]);
  const [myWaitlist, setMyWaitlist] = useState<any[]>([]);
  const [myWalkIns, setMyWalkIns] = useState<any[]>([]);
  const [bookingsStatus, setBookingsStatus] = useState<"loading" | "ready" | "error">("loading");
  const [activePass, setActivePass] = useState<DynamicPassDescriptor | null>(null);

  // Tracked trip for real-time location
  const [trackedTrip, setTrackedTrip] = useState<any>(null);

  // Penalties state
  const [penalties, setPenalties] = useState<any[]>([]);
  const [appealPenalty, setAppealPenalty] = useState<any>(null);

  useLayoutEffect(() => {
    const scrollViewport = scrollViewportRef.current;
    if (window.matchMedia("(max-width: 767px)").matches && scrollViewport) {
      scrollViewport.scrollTo({ top: 0, left: 0, behavior: "auto" });
      return;
    }
    const root = document.documentElement;
    const previousScrollBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    root.style.scrollBehavior = previousScrollBehavior;
  }, [activeTab]);

  useEffect(() => {
    fetchRoutes();
    fetchBookings();
    fetchWalkIns();
    fetchPenalties();
  }, []);

  useEffect(() => {
    if (!selectedTrip) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedTrip(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedTrip]);

  async function fetchRoutes() {
    try {
      const res = await fetch("/api/routes");
      if (res.ok) {
        const data = await res.json();
        setRoutes(data.routes || []);
      }
    } catch (err: any) { toast.error(err.message || "An error occurred"); }
  }

  async function fetchBookings() {
    try {
      const res = await fetch("/api/bookings/mine");
      if (res.ok) {
        const data = await res.json();
        setMyBookings(data.bookings || []);
        setMyWaitlist(data.waitlist || []);
        setBookingsStatus("ready");
      } else {
        setBookingsStatus("error");
      }
    } catch (err: any) {
      setBookingsStatus("error");
      toast.error(err.message || "An error occurred");
    }
  }

  async function fetchWalkIns() {
    try {
      const response = await fetch("/api/walk-ins");
      if (response.ok) {
        const data = await response.json();
        setMyWalkIns(data.intents || []);
      }
    } catch (error: any) {
      toast.error(error.message || "Unable to load Walk-in Passes");
    }
  }

  function openReservedPass(booking: any) {
    setActivePass({
      endpoint: `/api/bookings/${booking.id}/qr-token`,
      title: "Reserved Boarding Pass",
      purpose: "Reserved Boarding",
      routeName: booking.trip.routeName,
      journey: `${booking.boardingStopName} → ${booking.dropOffStopName}`,
      seatNumber: booking.seatNumber,
    });
  }

  function openWalkInPass(intent: any) {
    setActivePass({
      endpoint: `/api/walk-ins/${intent.id}/pass`,
      title: "Walk-in Boarding Pass",
      purpose: "Walk-in Boarding",
      routeName: intent.trip.routeName,
      journey: `${intent.boardingStopName} → ${intent.dropOffStopName}`,
      warning: "This pass does not guarantee boarding. Standing capacity is checked when scanned.",
    });
  }

  function openAlightingPass(kind: "RESERVED" | "WALK_IN", record: any) {
    setActivePass({
      endpoint: "/api/passes/alighting",
      requestBody: { kind, recordId: record.id },
      title: "Exit / Alighting Pass",
      purpose: "Alighting",
      routeName: record.trip.routeName,
      journey: `${record.boardingStopName} → ${record.dropOffStopName}`,
    });
  }

  async function fetchPenalties() {
    try {
      const res = await fetch("/api/penalties/mine");
      if (res.ok) {
        const data = await res.json();
        setPenalties(data.penalties || []);
      }
    } catch (err: any) { toast.error(err.message || "An error occurred"); }
  }

  async function openSeatBookingModal(
    tripId: string,
    boardingTripStopId?: string,
    dropOffTripStopId?: string,
  ) {
    if (!boardingTripStopId || !dropOffTripStopId) {
      toast.error("Select a From and To stop before checking seats");
      return;
    }
    setBookingError(null);
    setSelectedSeatId(null);
    try {
      const params = new URLSearchParams({
        tripId,
        boardingTripStopId,
        dropOffTripStopId,
      });
      const res = await fetch(`/api/bookings/availability?${params}`);
      const data = await res.json();
      if (res.ok) {
        const trip = trips.find((candidate) => candidate.id === tripId);
        setSelectedTrip(trip);
        setSelectedJourney(data.availability.journey);
        setSelectedEligibility(data.availability.bookingEligibility);
        setTripSeats(
          data.availability.seats.map((seat: { id: string; seatNumber: number }) => ({
            ...seat,
            status: "AVAILABLE" as const,
          })),
        );
      } else {
        toast.error(typeof data.error === "string" ? data.error : data.error?.message || "Unable to check journey seats");
      }
    } catch (err: any) { toast.error(err.message || "An error occurred"); }
  }

  async function handleConfirmBooking() {
    if (!selectedTrip) return;
    setBookingLoading(true);
    setBookingError(null);

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId: selectedTrip.id,
          boardingTripStopId: selectedJourney?.boardingTripStopId,
          dropOffTripStopId: selectedJourney?.dropOffTripStopId,
          tripSeatId: selectedSeatId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setBookingError(typeof data.error === "string" ? data.error : data.error?.message || "Booking failed");
        setBookingLoading(false);
        return;
      }

      setBookingConfirmation({
        routeName: selectedTrip.routeName,
        departureTime: selectedTrip.departureTime,
        journey: selectedJourney,
        seatNumber: tripSeats.find((seat) => seat.id === selectedSeatId)?.seatNumber,
      });
      setSelectedTrip(null);
      setSelectedEligibility(null);
      await Promise.all([fetchBookings(), fetchTrips()]);
      setActiveTab("journeys");
      toast.success("Reserved seat confirmed");
    } catch {
      setBookingError("Network error completing booking");
    } finally {
      setBookingLoading(false);
    }
  }

  async function handleJoinWaitlist() {
    if (!selectedTrip || !selectedJourney) return;
    setBookingLoading(true);
    setBookingError(null);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId: selectedTrip.id,
          boardingTripStopId: selectedJourney.boardingTripStopId,
          dropOffTripStopId: selectedJourney.dropOffTripStopId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBookingError(data.error?.message || "Unable to join waitlist");
        return;
      }
      setSelectedTrip(null);
      setSelectedEligibility(null);
      await fetchBookings();
      setActiveTab("journeys");
      toast.success("Added to the journey waitlist");
    } catch {
      setBookingError("Network error joining waitlist");
    } finally {
      setBookingLoading(false);
    }
  }

  async function handleGenerateWalkInPass() {
    if (!selectedTrip || !selectedJourney) return;
    setBookingLoading(true);
    setBookingError(null);
    try {
      const response = await fetch("/api/walk-ins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId: selectedTrip.id,
          boardingTripStopId: selectedJourney.boardingTripStopId,
          dropOffTripStopId: selectedJourney.dropOffTripStopId,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setBookingError(data.error?.message || "Unable to create Walk-in Pass");
        return;
      }
      const intent = {
        ...data,
        boardingStopName: selectedJourney.boardingStopName,
        dropOffStopName: selectedJourney.dropOffStopName,
        trip: { routeName: selectedTrip.routeName },
      };
      setSelectedTrip(null);
      setSelectedEligibility(null);
      await fetchWalkIns();
      openWalkInPass(intent);
    } catch {
      setBookingError("Network error generating Walk-in Pass");
    } finally {
      setBookingLoading(false);
    }
  }

  async function handleLeaveWaitlist(entryId: string) {
    const res = await fetch(`/api/waitlist/${entryId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(typeof data.error === "string" ? data.error : data.error?.message || "Unable to leave waitlist");
      return;
    }
    toast.success("Waitlist request cancelled");
    fetchBookings();
  }

    async function handleCancelBooking(bookingId: string) {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: "PATCH",
      });
      if (res.ok) {
        toast.success("Booking cancelled successfully");
        fetchBookings();
        fetchTrips();
      } else {
        const data = await res.json();
        toast.error(typeof data.error === "string" ? data.error : data.error?.message || "Failed to cancel booking");
      }
    } catch (err: any) { toast.error(err.message || "Network error"); }
  }

  const activeBookingsCount = myBookings.filter(
    (b) => b.status === "CONFIRMED"
  ).length + myWaitlist.filter((entry) => entry.status === "WAITING").length;
  const isRestricted =
    (user?.creditScore ?? productPolicy.initialCredit) <
    productPolicy.bookingRestrictionBelowCredit;
  const studentNavigation = [
    { id: "home" as const, label: "Home", mobileLabel: "Home", icon: Home },
    { id: "book" as const, label: "Book Shuttle", mobileLabel: "Book", icon: Bus },
    { id: "journeys" as const, label: "My Journeys", mobileLabel: "Journeys", icon: Ticket, count: activeBookingsCount },
    { id: "track" as const, label: "Track", mobileLabel: "Track", icon: Navigation },
    { id: "account" as const, label: "Credit & Appeals", mobileLabel: "Account", icon: UserRound },
  ];

  return (
    <div className={`student-shell ${activeTab === "home" ? "student-home-pilot-mode" : ""}`}>
      <Navbar initialUser={user} />
      <nav className="student-desktop-nav" aria-label="Student navigation">
        {studentNavigation.map(({ id, label, icon: Icon, count }) => (
          <button key={id} type="button" onClick={() => setActiveTab(id)} aria-current={activeTab === id ? "page" : undefined} className={activeTab === id ? "active" : ""}>
            <Icon aria-hidden className="size-4" />{label}
            {count ? <span className="nav-count">{count}</span> : null}
          </button>
        ))}
      </nav>

      <main ref={scrollViewportRef} id="main-content" className="student-content">
        <MotionSurface motionKey={activeTab} disabled={activeTab === "home"}>
        {activeTab === "home" && (
          <StudentHome
            user={user}
            bookings={myBookings}
            bookingsStatus={bookingsStatus}
            currentTime={new Date(Math.max(operationalNow, new Date(initialTime).getTime())).toISOString()}
            activeJourneyCount={activeBookingsCount}
            isRestricted={isRestricted}
            defaultCreditScore={productPolicy.initialCredit}
            onPlanJourney={() => setActiveTab("book")}
            onViewJourneys={() => setActiveTab("journeys")}
            onTrackShuttle={() => setActiveTab("track")}
            onViewAccount={() => setActiveTab("account")}
            onOpenReservedPass={openReservedPass}
          />
        )}

        {activeTab === "book" && (
          <TripsTab
            routes={routes}
            trips={trips}
            isBookingRestricted={
              (user?.creditScore ?? productPolicy.initialCredit) <
              productPolicy.bookingRestrictionBelowCredit
            }
            onRefresh={fetchTrips}
            onOpenSeatModal={openSeatBookingModal}
            onTrackTrip={(t) => {
              setTrackedTrip(t);
              setActiveTab("track");
            }}
          />
        )}

        {activeTab === "journeys" && (
          <div className="space-y-5">
            {bookingConfirmation && (
              <section className="booking-success" role="status">
                <CheckCircle2 aria-hidden className="size-6" />
                <div><p className="eyebrow">Reservation confirmed</p><h2>{bookingConfirmation.journey?.boardingStopName} → {bookingConfirmation.journey?.dropOffStopName}</h2><p>{bookingConfirmation.routeName} · Seat {bookingConfirmation.seatNumber} · Your boarding pass is available below.</p></div>
                <button type="button" onClick={() => setBookingConfirmation(null)} className="btn-ghost">Dismiss</button>
              </section>
            )}
          <MyBookingsTab
            myBookings={myBookings}
            waitlistEntries={myWaitlist}
            walkInIntents={myWalkIns}
            onRefresh={() => { void fetchBookings(); void fetchWalkIns(); }}
            onBrowseTrips={() => setActiveTab("book")}
            onOpenQR={openReservedPass}
            onOpenWalkInQR={openWalkInPass}
            onOpenAlightingQR={openAlightingPass}
            onTrackTrip={(trip) => {
              setTrackedTrip(trip);
              setActiveTab("track");
            }}
            onCancelBooking={(id) => setConfirmCancelId(id)}
            onLeaveWaitlist={handleLeaveWaitlist}
          />
          </div>
        )}

        {activeTab === "track" && (
          <TrackBusTab
            trips={trips}
            trackedTrip={trackedTrip}
            setTrackedTrip={setTrackedTrip}
            user={user}
            onBrowseTrips={() => setActiveTab("book")}
          />
        )}

        {activeTab === "account" && (
          <PenaltiesTab
            user={user}
            penalties={penalties}
            onOpenAppealModal={setAppealPenalty}
          />
        )}
        </MotionSurface>
      </main>

      <nav className="student-mobile-nav" aria-label="Student mobile navigation">
        {studentNavigation.map(({ id, mobileLabel, icon: Icon, count }) => (
          <button key={id} type="button" onClick={() => setActiveTab(id)} aria-current={activeTab === id ? "page" : undefined} className={activeTab === id ? "active" : ""}>
            <span className="relative"><Icon aria-hidden className="size-5" />{count ? <span className="mobile-count">{count}</span> : null}</span><span>{mobileLabel}</span>
          </button>
        ))}
      </nav>

      {/* SEAT SELECTION MODAL */}
      {selectedTrip && (
        <Modal isOpen onClose={() => setSelectedTrip(null)} title="Choose your seat" maxWidth="2xl">
          <div className="seat-selection-flow">
            <div className="seat-journey-context">
              <p className="eyebrow">{selectedTrip.routeName}</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Bus: {selectedTrip.busPlateNumber} • Departs:{" "}
              {formatMytTime(selectedTrip.departureTime)} MYT
              </p>
              {selectedJourney && (
              <h3>
                {selectedJourney.boardingStopName} → {selectedJourney.dropOffStopName}
              </h3>
              )}
            </div>

            {bookingError && (
              <div className="booking-error p-3 mb-4 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {bookingError}
              </div>
            )}

            <SeatGrid
              seats={tripSeats}
              selectedSeatId={selectedSeatId}
              onSelectSeat={(seatId) => setSelectedSeatId(seatId)}
              mode="student"
            />
            {tripSeats.length === 0 && (
              <p className="mt-4 text-xs font-semibold text-[var(--warning)]">
                No single seat is free across this complete journey.
              </p>
            )}

            <div className="seat-confirmation-bar">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {selectedSeatId
                  ? "Seat selected. Your seat is guaranteed after booking confirmation."
                  : "Please select an available seat"}
              </span>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedTrip(null)}
                  className="btn-ghost text-xs"
                >
                  Cancel
                </button>

                {tripSeats.filter((s) => s.status === "AVAILABLE").length >
                0 ? (
                  <button
                    disabled={!selectedSeatId || bookingLoading}
                    onClick={handleConfirmBooking}
                    className="btn-primary text-xs"
                  >
                    {bookingLoading ? "Confirming…" : "Confirm Reserved Seat"}
                  </button>
                ) : (
                  <button
                    disabled={bookingLoading || !selectedEligibility?.canJoinWaitlist}
                    onClick={handleJoinWaitlist}
                    className="btn-primary text-xs"
                  >
                    {bookingLoading ? "Joining..." : "Join Waitlist"}
                  </button>
                )}
              </div>
            </div>
            <div className="walk-in-alternative">
              <p>
                Prefer standing walk-in? This does not reserve capacity or guarantee boarding. Capacity is checked only when the driver scans the pass.
              </p>
              <button disabled={bookingLoading || !selectedEligibility?.canCreateWalkInIntent} onClick={handleGenerateWalkInPass} className="btn-ghost text-xs shrink-0">
                Generate Walk-in Pass
              </button>
              {!selectedEligibility?.canCreateWalkInIntent && <small>Walk-in intent is not open for this stop at the current operational time.</small>}
            </div>
          </div>
        </Modal>
      )}

      {/* DYNAMIC QR MODAL */}
      {activePass && (
        <DynamicQRModal
          pass={activePass}
          onClose={() => setActivePass(null)}
        />
      )}

      {/* PENALTY APPEAL MODAL */}
      {appealPenalty && (
        <PenaltyAppealModal
          penalty={appealPenalty}
          onClose={() => setAppealPenalty(null)}
          onSuccess={() => {
            fetchPenalties();
            fetchUser();
          }}
        />
      )}
      <ConfirmModal
        isOpen={!!confirmCancelId}
        onClose={() => setConfirmCancelId(null)}
        onConfirm={() => { if (confirmCancelId) handleCancelBooking(confirmCancelId); }}
        title="Cancel Booking"
        message="Are you sure you want to cancel this booking? This action cannot be undone."
        confirmText="Yes, Cancel Booking"
        cancelText="Keep Booking"
        isDestructive={true}
      />
    </div>
  );
}
