"use client";

import { useEffect } from "react";
import { motion, useReducedMotion } from "motion/react";

interface AppealsTabProps {
  appeals: any[];
  selectedAppeal: any;
  setSelectedAppeal: (appeal: any) => void;
  adminComment: string;
  setAdminComment: (comment: string) => void;
  onReviewAppeal: (appealId: string, status: "APPROVED" | "REJECTED") => void;
  isReviewing: boolean;
}

export default function AppealsTab({ appeals, selectedAppeal, setSelectedAppeal, adminComment, setAdminComment, onReviewAppeal, isReviewing }: AppealsTabProps) {
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    if (appeals.length === 0) {
      if (selectedAppeal) setSelectedAppeal(null);
      return;
    }
    if (!selectedAppeal) {
      setSelectedAppeal(appeals.find((appeal) => appeal.status === "PENDING") ?? appeals[0]);
      return;
    }
    const authoritativeAppeal = appeals.find((appeal) => appeal.id === selectedAppeal.id);
    if (!authoritativeAppeal) {
      setSelectedAppeal(appeals.find((appeal) => appeal.status === "PENDING") ?? appeals[0]);
    } else if (authoritativeAppeal !== selectedAppeal) {
      setSelectedAppeal(authoritativeAppeal);
    }
  }, [appeals, selectedAppeal, setSelectedAppeal]);
  return <div className="appeals-view animate-fade-in"><header><p className="eyebrow">Passenger review</p><h1 className="section-title">Appeals</h1><p className="section-subtitle">Review penalty context, student explanation and journey evidence together.</p></header>{appeals.length === 0 ? <div className="dashboard-empty">No penalty appeals submitted for review.</div> : <div className="appeals-workspace"><section className="appeal-queue"><h2>Review queue <span>{appeals.filter((appeal) => appeal.status === "PENDING").length} pending</span></h2>{appeals.map((appeal) => <button type="button" key={appeal.id} onClick={() => { setSelectedAppeal(appeal); setAdminComment(""); }} aria-current={selectedAppeal?.id === appeal.id ? "true" : undefined} className={selectedAppeal?.id === appeal.id ? "active" : ""}><span className={`badge ${appeal.status === "PENDING" ? "badge-amber" : appeal.status === "APPROVED" ? "badge-green" : "badge-red"}`}>{appeal.status}</span><strong>{appeal.studentName}</strong><small>{appeal.penaltyReason} · -{appeal.creditPointsDeducted} credit</small></button>)}</section>{selectedAppeal && <motion.article key={selectedAppeal.id} initial={reduceMotion ? false : { opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={reduceMotion ? { duration: 0 } : { duration: .2 }} className="appeal-detail"><header><div><p className="eyebrow">Appeal detail</p><h2>{selectedAppeal.studentName}</h2><p>{selectedAppeal.studentId || "Student ID unavailable"}</p></div><span className={`badge ${selectedAppeal.status === "PENDING" ? "badge-amber" : selectedAppeal.status === "APPROVED" ? "badge-green" : "badge-red"}`}>{selectedAppeal.status}</span></header><dl><div><dt>Penalty</dt><dd>{selectedAppeal.penaltyReason}<strong>-{selectedAppeal.creditPointsDeducted} credit</strong></dd></div><div><dt>Journey</dt><dd>{selectedAppeal.journey.routeName}<span>{selectedAppeal.journey.boardingStopName} → {selectedAppeal.journey.dropOffStopName} · Seat {selectedAppeal.journey.seatNumber}</span></dd></div><div className="appeal-explanation"><dt>Student explanation</dt><dd>“{selectedAppeal.appealReason}”</dd></div></dl>{selectedAppeal.status === "PENDING" ? <div className="appeal-decision"><label htmlFor="appeal-comment"><span>Review comment</span><textarea id="appeal-comment" rows={4} className="input-field" value={adminComment} onChange={(event) => setAdminComment(event.target.value)} placeholder="Record the reason for this decision" disabled={isReviewing} /></label><div><button type="button" disabled={isReviewing} onClick={() => onReviewAppeal(selectedAppeal.id, "REJECTED")} className="btn-danger">Reject appeal</button><button type="button" disabled={isReviewing} onClick={() => onReviewAppeal(selectedAppeal.id, "APPROVED")} className="btn-primary">{isReviewing ? "Saving decision…" : "Approve and restore credit"}</button></div></div> : <div className={`appeal-resolved ${selectedAppeal.status === "REJECTED" ? "is-rejected" : ""}`} role="status"><strong>{selectedAppeal.status === "APPROVED" ? "Appeal approved" : "Appeal rejected"}</strong>{selectedAppeal.reviewedBy && <span>Reviewed by {selectedAppeal.reviewedBy}</span>}{selectedAppeal.adminComment && <p>{selectedAppeal.adminComment}</p>}</div>}</motion.article>}</div>}</div>;
}
