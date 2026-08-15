"use client";

interface AppealsTabProps {
  appeals: any[];
  selectedAppeal: any;
  setSelectedAppeal: (appeal: any) => void;
  adminComment: string;
  setAdminComment: (comment: string) => void;
  onReviewAppeal: (appealId: string, status: "APPROVED" | "REJECTED") => void;
}

export default function AppealsTab({
  appeals,
  selectedAppeal,
  setSelectedAppeal,
  adminComment,
  setAdminComment,
  onReviewAppeal,
}: AppealsTabProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="section-title text-xl">Student Penalty Appeal Queue</h2>
        <p className="section-subtitle">{appeals.filter((a) => a.status === "PENDING").length} pending reviews</p>
      </div>

      {appeals.length === 0 ? (
        <div className="py-12 text-center rounded-2xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>No penalty appeals submitted for review.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {appeals.map((a) => (
            <div
              key={a.id}
              className="glass-card p-6 rounded-2xl space-y-4"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b" style={{ borderColor: "var(--border)" }}>
                <div>
                  <span className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{a.studentName}</span>
                  <span className="text-xs ml-2" style={{ color: "var(--text-muted)" }}>({a.studentId || "Student ID unavailable"})</span>
                </div>
                <span
                  className="px-3 py-1 rounded-full text-xs font-extrabold"
                  style={
                    a.status === "PENDING"
                      ? { background: "rgba(245,158,11,0.15)", color: "#fbbf24" }
                      : a.status === "APPROVED"
                        ? { background: "rgba(34,197,94,0.15)", color: "#4ade80" }
                        : { background: "rgba(239,68,68,0.15)", color: "#f87171" }
                  }
                >
                  Status: {a.status}
                </span>
              </div>

              <div className="text-xs space-y-1" style={{ color: "var(--text-secondary)" }}>
                <div><span className="font-semibold" style={{ color: "var(--text-muted)" }}>Penalty Reason:</span> {a.penaltyReason} (-{a.creditPointsDeducted} pts)</div>
                <div><span className="font-semibold" style={{ color: "var(--text-muted)" }}>Student Explanation:</span> &quot;{a.appealReason}&quot;</div>
                <div>
                  <span className="font-semibold" style={{ color: "var(--text-muted)" }}>Journey:</span>{" "}
                  {a.journey.routeName} — {a.journey.boardingStopName} to {a.journey.dropOffStopName}, Seat {a.journey.seatNumber}
                </div>
              </div>

              {a.status === "PENDING" && (
                <div className="pt-3 border-t flex flex-col sm:flex-row items-center gap-3" style={{ borderColor: "var(--border)" }}>
                  <input
                    type="text"
                    placeholder="Admin review comment / note..."
                    value={selectedAppeal?.id === a.id ? adminComment : ""}
                    onChange={(e) => {
                      setSelectedAppeal(a);
                      setAdminComment(e.target.value);
                    }}
                    className="input-field py-2 text-xs flex-1"
                  />
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => onReviewAppeal(a.id, "APPROVED")}
                      className="btn-primary text-xs flex-1 sm:flex-none"
                      style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}
                    >
                      Approve (Restore Score)
                    </button>
                    <button
                      onClick={() => onReviewAppeal(a.id, "REJECTED")}
                      className="btn-primary text-xs flex-1 sm:flex-none"
                      style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)" }}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
