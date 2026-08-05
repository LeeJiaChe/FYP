import React from "react";
import Modal from "./Modal";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDestructive = false,
}: ConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="sm">
      <div className="space-y-6">
        <p style={{ color: "var(--text-secondary)" }}>{message}</p>
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="btn-ghost flex-1">
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 px-4 py-2 font-bold rounded-lg transition-colors"
            style={
              isDestructive
                ? { backgroundColor: "#ef4444", color: "#fff" } // red
                : { backgroundColor: "var(--accent-primary)", color: "#fff" } // primary
            }
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
