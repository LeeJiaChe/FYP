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
    <div className="restricted-banner p-4 rounded-2xl flex items-center justify-between gap-4 animate-slide-up">
      <div className="flex items-center gap-3">
        <ShieldAlert className="restricted-banner-icon w-6 h-6 shrink-0" />
        <div>
          <span className="restricted-banner-title font-bold text-sm block">
            Booking Privilege Restricted
          </span>
          <span className="restricted-banner-copy text-xs">
            Your credit score is below 40 pts due to unexcused no-shows.
            Submit an appeal to restore privileges.
          </span>
        </div>
      </div>
      <button
        onClick={onViewPenalties}
        className="restricted-banner-action px-4 py-2 text-xs font-bold text-white rounded-xl shrink-0 transition-all duration-200 hover:opacity-90"
      >
        View Penalties
      </button>
    </div>
  );
}
