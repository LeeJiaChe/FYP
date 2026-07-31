"use client";

import { Bus, Users, Ticket, TrendingUp } from "lucide-react";

interface HeroStatsRowProps {
  activeTripsCount: number;
  availableSeatsCount: number;
  activeBookingsCount: number;
  creditScore: number;
}

export default function HeroStatsRow({
  activeTripsCount,
  availableSeatsCount,
  activeBookingsCount,
  creditScore,
}: HeroStatsRowProps) {
  const stats = [
    {
      icon: <Bus className="w-5 h-5 text-white" />,
      label: "Active Trips",
      value: activeTripsCount,
      color: "var(--accent-primary)",
    },
    {
      icon: <Users className="w-5 h-5 text-white" />,
      label: "Available Seats",
      value: availableSeatsCount,
      color: "#22c55e",
    },
    {
      icon: <Ticket className="w-5 h-5 text-white" />,
      label: "My Bookings",
      value: activeBookingsCount,
      color: "#f59e0b",
    },
    {
      icon: <TrendingUp className="w-5 h-5 text-white" />,
      label: "Credit Score",
      value: `${creditScore}`,
      color: creditScore < 40 ? "#ef4444" : "#10b981",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-slide-up">
      {stats.map((stat, i) => (
        <div key={i} className="stat-card">
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background: `linear-gradient(135deg, ${stat.color}, ${stat.color}cc)`,
              }}
            >
              {stat.icon}
            </div>
            <span
              className="text-xs font-semibold"
              style={{ color: "var(--text-muted)" }}
            >
              {stat.label}
            </span>
          </div>
          <span
            className="text-2xl font-extrabold"
            style={{ color: "var(--text-primary)" }}
          >
            {stat.value}
          </span>
        </div>
      ))}
    </div>
  );
}
