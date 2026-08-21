"use client";

import { CheckCircle2, AlertCircle } from "lucide-react";
import { productPolicy } from "@/shared/config/policies";

interface PenaltiesTabProps {
  user?: any;
  penalties: any[];
  onOpenAppealModal: (penalty: any) => void;
}

export default function PenaltiesTab({
  user,
  penalties,
  onOpenAppealModal,
}: PenaltiesTabProps) {
  const currentCreditScore = user?.creditScore ?? 100;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Score overview */}
      <div
        className="rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="flex-1 space-y-1">
          <h2 className="section-title text-xl">
            Credit Score & Penalty Record
          </h2>
          <p className="section-subtitle">
            Each reserved no-show deducts up to {productPolicy.noShowPenaltyPoints} credit
            points. Scores below {productPolicy.bookingRestrictionBelowCredit} restrict
            future booking.
          </p>
        </div>

        <div
          className="text-center p-5 rounded-2xl min-w-[160px]"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
          }}
        >
          <span
            className="text-[10px] uppercase font-bold block mb-1"
            style={{ color: "var(--text-muted)" }}
          >
            Current Score
          </span>
          <span
            className="text-4xl font-extrabold block"
            style={{
              color:
                currentCreditScore < productPolicy.bookingRestrictionBelowCredit
                  ? "#f87171"
                  : "#4ade80",
            }}
          >
            {currentCreditScore}
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            / {productPolicy.initialCredit}
          </span>
          <div className="mt-2 progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${(currentCreditScore / productPolicy.initialCredit) * 100}%`,
                background:
                  currentCreditScore < productPolicy.bookingRestrictionBelowCredit
                    ? "linear-gradient(90deg, #ef4444, #f87171)"
                    : "linear-gradient(90deg, var(--accent-primary), #4ade80)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Penalties list */}
      <div className="space-y-4">
        {penalties.length === 0 ? (
          <div
            className="py-16 text-center rounded-2xl"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
            }}
          >
            <CheckCircle2
              className="w-10 h-10 mx-auto mb-3"
              style={{ color: "#4ade80" }}
            />
            <p
              className="font-bold"
              style={{ color: "var(--text-secondary)" }}
            >
              Clean record!
            </p>
            <p
              className="text-xs mt-1"
              style={{ color: "var(--text-muted)" }}
            >
              No penalty points or active restrictions.
            </p>
          </div>
        ) : (
          penalties.map((p, idx) => (
            <div
              key={p.id}
              className="rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 animate-slide-up"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                animationDelay: `${idx * 60}ms`,
              }}
            >
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge badge-red">
                    -{p.creditPointsDeducted} pts
                  </span>
                  <span
                    className="badge"
                    style={
                      p.status === "ACTIVE"
                        ? {
                            background: "rgba(239,68,68,0.1)",
                            color: "#f87171",
                            borderColor: "rgba(239,68,68,0.3)",
                          }
                        : p.status === "APPEALED"
                          ? {
                              background: "rgba(245,158,11,0.1)",
                              color: "#fbbf24",
                              borderColor: "rgba(245,158,11,0.3)",
                            }
                          : p.status === "OVERTURNED"
                            ? {
                                background: "rgba(34,197,94,0.1)",
                                color: "#4ade80",
                                borderColor: "rgba(34,197,94,0.3)",
                              }
                            : {
                                background: "var(--bg-surface)",
                                color: "var(--text-muted)",
                                borderColor: "var(--border)",
                              }
                    }
                  >
                    {p.status}
                  </span>
                </div>
                <h3
                  className="font-semibold text-sm"
                  style={{ color: "var(--text-primary)" }}
                >
                  {p.reason}
                </h3>
                <p
                  className="text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  {p.booking?.routeName} •{" "}
                  {p.booking?.departureTime &&
                    new Date(p.booking.departureTime).toLocaleDateString()}
                </p>

                {p.appeal && (
                  <div
                    className="mt-2 p-3 rounded-xl text-xs"
                    style={{
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <span
                      className="block font-bold mb-1"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Your Appeal:
                    </span>
                    <span style={{ color: "var(--text-secondary)" }}>
                      &quot;{p.appeal.reason}&quot;
                    </span>
                    {p.appeal.adminComment && (
                      <div
                        className="mt-2 pt-2 border-t"
                        style={{ borderColor: "var(--border)" }}
                      >
                        <span
                          className="font-bold"
                          style={{ color: "var(--accent-secondary)" }}
                        >
                          Staff Response:{" "}
                        </span>
                        <span style={{ color: "var(--text-secondary)" }}>
                          {p.appeal.adminComment}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {p.status === "ACTIVE" && !p.appeal && (
                <button
                  onClick={() => onOpenAppealModal(p)}
                  className="btn-primary text-xs flex items-center gap-2 shrink-0"
                  style={{
                    background: "linear-gradient(135deg, #d97706, #f59e0b)",
                  }}
                >
                  <AlertCircle className="w-4 h-4" />
                  Submit Appeal
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
