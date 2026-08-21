"use client";

import { useState } from "react";
import { UserCheck, Armchair } from "lucide-react";

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

export default function SeatGrid({
  seats,
  selectedSeatId,
  onSelectSeat,
  onManualCheckIn,
  mode = "student",
  interactive = true,
}: SeatGridProps) {
  const [hoveredSeat, setHoveredSeat] = useState<SeatItem | null>(null);

  function getSeatStyle(seat: SeatItem) {
    const isSelected = selectedSeatId === seat.id;

    if (isSelected) {
      return "bg-blue-600 text-white ring-2 ring-blue-400 scale-105 shadow-lg shadow-blue-500/40";
    }

    switch (seat.status) {
      case "AVAILABLE":
        return "bg-slate-100 text-slate-900 hover:bg-white hover:scale-105 shadow-sm border border-slate-300";
      case "RESERVED":
        return "bg-rose-500/90 text-white border border-rose-400 shadow-md shadow-rose-500/20";
      case "CHECKED_IN":
        return "bg-emerald-500 text-white border border-emerald-400 shadow-md shadow-emerald-500/20";
      case "NO_SHOW":
        return "bg-slate-700 text-slate-400 border border-slate-600";
      default:
        return "bg-slate-800 text-slate-300";
    }
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-semibold bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-md bg-slate-100 border border-slate-300 inline-block"></span>
          <span className="text-slate-300">Available (White)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-md bg-rose-500 inline-block"></span>
          <span className="text-slate-300">Reserved (Red)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-md bg-emerald-500 inline-block"></span>
          <span className="text-slate-300">Checked-In (Green)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-md bg-slate-700 inline-block"></span>
          <span className="text-slate-300">No-Show (Grey)</span>
        </div>
      </div>

      {/* Bus Seat Layout Diagram */}
      <div className="relative p-6 bg-slate-950/80 rounded-3xl border border-slate-800/80 max-w-xl mx-auto shadow-2xl">
        {/* Steering Wheel / Driver Front indicator */}
        <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-800 text-xs font-medium text-slate-500">
          <span className="flex items-center gap-2 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-blue-500 live-dot"></span>{" "}
            Bus Front / Entrance
          </span>
          <span className="bg-slate-900 px-3 py-1 rounded-full border border-slate-800 text-[11px] text-slate-400">
            Driver Cabin 🚌
          </span>
        </div>

        {/* Seats Grid: 4 seats per row (2 on left, aisle, 2 on right) */}
        <div className="grid grid-cols-5 gap-3 max-h-[420px] overflow-y-auto pr-2 pt-2 pl-2">
          {seats.map((seat, index) => {
            const isAisle = (index + 1) % 4 === 2 && (index + 1) % 4 !== 0;

            return (
              <div key={seat.id} className="contents">
                <button
                  type="button"
                  aria-label={`Seat ${seat.seatNumber}, ${seat.status.toLowerCase().replace("_", " ")}`}
                  disabled={!interactive || (mode === "student" && seat.status !== "AVAILABLE")}
                  onMouseEnter={() => setHoveredSeat(seat)}
                  onMouseLeave={() => setHoveredSeat(null)}
                  onClick={() => {
                    if (!interactive) return;
                    if (
                      mode === "student" &&
                      seat.status === "AVAILABLE" &&
                      onSelectSeat
                    ) {
                      onSelectSeat(seat.id);
                    } else if (mode === "driver" && onManualCheckIn) {
                      onManualCheckIn(seat);
                    }
                  }}
                  className={`relative aspect-square rounded-2xl font-bold text-sm flex flex-col items-center justify-center transition-all duration-200 cursor-pointer select-none disabled:opacity-100 ${getSeatStyle(
                    seat,
                  )} ${!interactive || (mode === "student" && seat.status !== "AVAILABLE") ? "cursor-default" : ""}`}
                >
                  <Armchair className="w-4 h-4 mb-0.5 opacity-80" />
                  <span>{seat.seatNumber}</span>

                  {/* Driver manual override indicator */}
                  {mode === "driver" && seat.status === "RESERVED" && (
                    <span className="absolute -bottom-1.5 bg-blue-600 text-white text-[9px] px-1 py-0.2 rounded-full font-extrabold flex items-center gap-0.5 shadow">
                      <UserCheck className="w-2.5 h-2.5" /> Check-in
                    </span>
                  )}
                </button>

                {/* Insert Aisle gap after every 2nd seat in row of 4 */}
                {(index + 1) % 2 === 0 && (index + 1) % 4 !== 0 && (
                  <div className="flex items-center justify-center text-[10px] text-slate-700 font-semibold tracking-widest uppercase">
                    Aisle
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
