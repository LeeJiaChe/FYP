"use client";

import { Armchair, UserCheck } from "lucide-react";

export interface SeatItem {
  id: string;
  seatNumber: number;
  status: "AVAILABLE" | "RESERVED" | "CHECKED_IN" | "NO_SHOW";
  booking?: {
    id: string;
    status: string;
    studentName?: string;
    studentId?: string;
    checkedInAt?: string | null;
    checkInMethod?: string | null;
  } | null;
}

interface SeatGridProps {
  seats: SeatItem[];
  selectedSeatId?: string | null;
  onSelectSeat?: (seatId: string) => void;
  onManualCheckIn?: (seat: SeatItem) => void;
  mode?: "student" | "driver" | "admin";
  interactive?: boolean;
}

const statusLabels: Record<SeatItem["status"], string> = {
  AVAILABLE: "Available",
  RESERVED: "Reserved",
  CHECKED_IN: "Checked in",
  NO_SHOW: "No-show",
};

export default function SeatGrid({
  seats,
  selectedSeatId,
  onSelectSeat,
  onManualCheckIn,
  mode = "student",
  interactive = true,
}: SeatGridProps) {
  const rows = Array.from({ length: Math.ceil(seats.length / 4) }, (_, index) => seats.slice(index * 4, index * 4 + 4));

  function canUseSeat(seat: SeatItem) {
    if (!interactive) return false;
    if (mode === "student") return seat.status === "AVAILABLE";
    if (mode === "driver") return seat.status === "RESERVED";
    return false;
  }

  function activate(seat: SeatItem) {
    if (!canUseSeat(seat)) return;
    if (mode === "student") onSelectSeat?.(seat.id);
    if (mode === "driver") onManualCheckIn?.(seat);
  }

  return (
    <div className={`seat-map seat-map-${mode}`}>
      <div className="seat-legend" aria-label="Seat availability legend">
        {(["AVAILABLE", "RESERVED", "CHECKED_IN", "NO_SHOW"] as const).map((status) => (
          <span key={status}><i className={`seat-swatch status-${status.toLowerCase()}`} />{statusLabels[status]}</span>
        ))}
        {mode === "student" && <span><i className="seat-swatch status-selected" />Selected</span>}
      </div>

      <div className="bus-cabin">
        <div className="bus-front">
          <span>Front of shuttle</span>
          <span>Driver</span>
        </div>
        <div className="seat-rows" role="group" aria-label="Shuttle seat map">
          {rows.map((row, rowIndex) => (
            <div className="seat-row" key={rowIndex}>
              {row.map((seat, seatIndex) => {
                const selected = selectedSeatId === seat.id;
                return (
                  <button
                    key={seat.id}
                    type="button"
                    aria-label={`Seat ${seat.seatNumber}, ${statusLabels[seat.status]}${seat.booking?.studentName ? `, ${seat.booking.studentName}` : ""}`}
                    aria-pressed={mode === "student" ? selected : undefined}
                    disabled={!canUseSeat(seat)}
                    onClick={() => activate(seat)}
                    className={`seat-button status-${seat.status.toLowerCase()} ${selected ? "status-selected" : ""} ${seatIndex === 2 ? "after-aisle" : ""}`}
                  >
                    <Armchair aria-hidden className="size-4" />
                    <span>{seat.seatNumber}</span>
                    {mode === "driver" && seat.status === "RESERVED" && <UserCheck aria-hidden className="seat-action-icon size-3" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="bus-entry">Entry / exit</div>
      </div>
    </div>
  );
}
