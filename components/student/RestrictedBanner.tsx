"use client";

import { ShieldAlert } from "lucide-react";

interface RestrictedBannerProps {
  isBookingRestricted?: boolean;
  onViewPenalties: () => void;
}

export default function RestrictedBanner({
  isBookingRestricted,
  onViewPenalties,
}: RestrictedBannerProps) {
  if (!isBookingRestricted) return null;

  return (
    <div
      className="p-4 rounded-2xl flex items-center justify-between gap-4 animate-slide-up"
      style={{
        background: "rgba(239,68,68,0.08)",
        border: "1px solid rgba(239,68,68,0.3)",
      }}
    >
      <div className="flex items-center gap-3">
        <ShieldAlert
          className="w-6 h-6 shrink-0"
          style={{ color: "#f87171" }}
        />
        <div>
          <span
            className="font-bold text-sm block"
            style={{ color: "#fca5a5" }}
          >
            Booking Privilege Restricted
          </span>
          <span className="text-xs" style={{ color: "#f87171" }}>
            Your credit score is below 40 pts due to unexcused no-shows.
            Submit an appeal to restore privileges.
          </span>
        </div>
      </div>
      <button
        onClick={onViewPenalties}
        className="px-4 py-2 text-xs font-bold text-white rounded-xl shrink-0 transition-all duration-200 hover:opacity-90"
        style={{
          background: "linear-gradient(135deg, #ef4444, #f87171)",
        }}
      >
        View Penalties
      </button>
    </div>
  );
}
