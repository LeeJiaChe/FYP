"use client";

import { CheckCircle2, AlertCircle } from "lucide-react";
import { productPolicy } from "@/shared/config/policies";
import { formatMytDate } from "@/shared/time/operational-time";

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
    <div className="account-view animate-fade-in">
      <section className="account-credit-stage">
        <div className="account-credit-copy">
          <p className="eyebrow">Account standing</p>
          <h2 className="section-title text-xl">
            Passenger credit and eligibility
          </h2>
          <p className="section-subtitle">
            Each reserved no-show deducts up to {productPolicy.noShowPenaltyPoints} credit
            points. Scores below {productPolicy.bookingRestrictionBelowCredit} restrict
            future booking.
          </p>
        </div>

        <div className={`credit-score ${currentCreditScore < productPolicy.bookingRestrictionBelowCredit ? "is-restricted" : ""}`}>
          <span>Current credit</span>
          <strong className="tabular-nums">{currentCreditScore}<small>/{productPolicy.initialCredit}</small></strong>
          <p>{currentCreditScore < productPolicy.bookingRestrictionBelowCredit ? "Reservation restricted" : "Booking available"}</p>
        </div>
      </section>

      <section className="penalty-list" aria-labelledby="penalty-history-heading">
        <header><h3 id="penalty-history-heading">Penalty history</h3><span>{penalties.length}</span></header>
        {penalties.length === 0 ? (
          <div className="account-empty">
            <CheckCircle2 aria-hidden />
            <strong>No penalties on record</strong>
            <p>
              No penalty points or active restrictions.
            </p>
          </div>
        ) : (
          penalties.map((p, idx) => (
            <article
              key={p.id}
              className="penalty-row animate-slide-up"
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              <div className="penalty-main">
                <div className="penalty-status">
                  <span className="badge badge-red">
                    -{p.creditPointsDeducted} pts
                  </span>
                  <span className={`badge ${p.status === "ACTIVE" ? "badge-red" : p.status === "APPEALED" ? "badge-amber" : p.status === "OVERTURNED" ? "badge-green" : ""}`}>
                    {p.status}
                  </span>
                </div>
                <h4>{p.reason}</h4>
                <p className="penalty-meta">
                  {p.booking?.routeName} •{" "}
                  {p.booking?.departureTime &&
                    formatMytDate(p.booking.departureTime)}
                </p>

                {p.appeal && (
                  <div className="penalty-appeal">
                    <span>Your Appeal</span>
                    <p>
                      &quot;{p.appeal.reason}&quot;
                    </p>
                    {p.appeal.adminComment && (
                      <div>
                        <strong>Staff Response</strong>
                        <p>{p.appeal.adminComment}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {p.status === "ACTIVE" && !p.appeal && (
                <button
                  onClick={() => onOpenAppealModal(p)}
                  className="btn-secondary penalty-action"
                >
                  <AlertCircle className="w-4 h-4" />
                  Submit Appeal
                </button>
              )}
            </article>
          ))
        )}
      </section>
    </div>
  );
}
