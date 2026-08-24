"use client";

import { useState } from "react";
import { Send, AlertTriangle } from "lucide-react";
import Modal from "@/components/Modal";

interface PenaltyAppealModalProps {
  penalty: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PenaltyAppealModal({ penalty, onClose, onSuccess }: PenaltyAppealModalProps) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/penalties/${penalty.id}/appeal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to submit appeal");
        setLoading(false);
        return;
      }

      onSuccess();
      onClose();
    } catch {
      setError("Network error submitting appeal");
      setLoading(false);
    }
  }

  return (
    <Modal isOpen onClose={onClose} title="Appeal penalty" description="Provide context for staff review. The penalty and journey remain attached to this appeal." maxWidth="lg">
      <div className="student-appeal-form">
        <div className="student-appeal-context">
          <span><AlertTriangle aria-hidden /></span>
          <p>Submit justification for staff review</p>
        </div>

        <dl className="student-appeal-summary">
          <div><dt>Reason for Penalty</dt><dd>{penalty.reason}</dd></div>
          <div><dt>Points Deducted</dt><dd>-{penalty.creditPointsDeducted} pts</dd></div>
        </dl>

        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="appeal-reason">
              Explanation / Medical Reason <span aria-hidden>*</span>
            </label>
            <textarea
              id="appeal-reason"
              name="reason"
              required
              rows={4}
              placeholder="Explain why you were unable to board or cancel in advance (e.g. medical emergency, transport delay)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input-field"
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || reason.length < 10}
              className="btn-primary"
            >
              <Send className="w-3.5 h-3.5" /> Submit Appeal
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
