import React, { useState } from "react";
import { Lock, Eye, EyeOff, CheckCircle2, Shield, Smartphone } from "lucide-react";
import { SettingCard, Alert } from "./SettingUI";
import { useSettings } from "./SettingsContext";

export function SecurityTab() {
  const {
    secForm,
    setSecForm,
    secAlert,
    setSecAlert,
    secLoading,
    setSecLoading,
  } = useSettings();

  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (secForm.newPassword !== secForm.confirmPassword) {
      setSecAlert({ type: "error", msg: "New passwords do not match." });
      return;
    }
    if (secForm.newPassword.length < 8) {
      setSecAlert({ type: "error", msg: "Password must be at least 8 characters." });
      return;
    }
    setSecLoading(true);
    setSecAlert(null);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: secForm.currentPassword,
          newPassword: secForm.newPassword,
        }),
      });
      if (res.ok) {
        setSecAlert({ type: "success", msg: "Password changed successfully!" });
        setSecForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      } else {
        const d = await res.json();
        setSecAlert({ type: "error", msg: d.error || "Failed to change password." });
      }
    } catch {
      setSecAlert({ type: "error", msg: "Network error. Please try again." });
    } finally {
      setSecLoading(false);
    }
  }

  // Password strength meter
  function getPasswordStrength(password: string) {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  }

  const pwStrength = getPasswordStrength(secForm.newPassword);
  const pwStrengthLabel = ["", "Weak", "Fair", "Good", "Strong", "Very Strong"][pwStrength] || "";
  return (
    <SettingCard
      title="Security Settings"
      description="Change your password and manage account security"
      icon={<Lock className="w-5 h-5 text-white" />}
    >
      <form onSubmit={handlePasswordChange} className="settings-form">
        {secAlert && <Alert type={secAlert.type} message={secAlert.msg} />}

        {(["current", "new", "confirm"] as const).map((field) => {
          const labels = { current: "Current Password", new: "New Password", confirm: "Confirm New Password" };
          const keys = { current: "currentPassword", new: "newPassword", confirm: "confirmPassword" } as const;
          const showKey = field;
          return (
            <div key={field}>
              <label htmlFor={`security-${field}-password`}>
                {labels[field]}
              </label>
              <div className="relative">
                <input
                  id={`security-${field}-password`}
                  name={keys[field]}
                  autoComplete={field === "current" ? "current-password" : "new-password"}
                  type={showPasswords[showKey] ? "text" : "password"}
                  value={secForm[keys[field]] as string}
                  onChange={(e) => setSecForm({ ...secForm, [keys[field]]: e.target.value })}
                  className="input-field pr-10"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  aria-label={`${showPasswords[showKey] ? "Hide" : "Show"} ${labels[field].toLowerCase()}`}
                  onClick={() => setShowPasswords({ ...showPasswords, [showKey]: !showPasswords[showKey] })}
                  className="password-visibility"
                >
                  {showPasswords[showKey] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* Password strength for new password */}
              {field === "new" && secForm.newPassword && (
                <div className={`password-strength strength-${pwStrength}`}>
                  <div className="password-strength-segments" aria-hidden>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={i <= pwStrength ? "is-met" : ""}
                      />
                    ))}
                  </div>
                  <p>
                    {pwStrengthLabel}
                  </p>
                </div>
              )}
            </div>
          );
        })}

        {/* Password Requirements */}
        <div className="password-requirements">
          <strong>Password Requirements</strong>
          {[
            { label: "At least 8 characters", met: secForm.newPassword.length >= 8 },
            { label: "One uppercase letter (A-Z)", met: /[A-Z]/.test(secForm.newPassword) },
            { label: "One number (0-9)", met: /[0-9]/.test(secForm.newPassword) },
            { label: "One special character (!@#...)", met: /[^A-Za-z0-9]/.test(secForm.newPassword) },
          ].map((req) => (
            <div key={req.label} className={req.met ? "is-met" : ""}>
              <span>
                {req.met ? (
                  <CheckCircle2 aria-hidden />
                ) : (
                  <i aria-hidden />
                )}
              </span>
              <small>{req.label}</small>
            </div>
          ))}
        </div>

        <div className="settings-form-actions">
          <button type="submit" className="btn-primary flex items-center gap-2" disabled={secLoading}>
            <Shield className="w-4 h-4" />
            {secLoading ? "Updating..." : "Update Password"}
          </button>
        </div>
      </form>

      {/* Active Sessions */}
      <div className="active-sessions">
        <h3>Active Sessions</h3>
        <div
          className="flex items-center justify-between p-3 rounded-xl"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-3">
            <Smartphone className="w-4 h-4" style={{ color: "var(--accent-secondary)" }} />
            <div>
              <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>Current Session</p>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                Browser · {new Date().toLocaleDateString()}
              </p>
            </div>
          </div>
          <span className="badge badge-green">Active</span>
        </div>
      </div>
    </SettingCard>
  );
}
