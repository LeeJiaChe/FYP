import React from "react";
import { User, Save } from "lucide-react";
import { SettingCard, Alert } from "./SettingUI";
import { useSettings } from "./SettingsContext";
import { productPolicy } from "@/shared/config/policies";

export function ProfileTab() {
  const {
    user,
    fetchUser,
    profileForm,
    setProfileForm,
    profileAlert,
    setProfileAlert,
    profileLoading,
    setProfileLoading,
  } = useSettings();

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setProfileLoading(true);
    setProfileAlert(null);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: profileForm.name }),
      });
      if (res.ok) {
        setProfileAlert({ type: "success", msg: "Profile updated successfully!" });
        fetchUser();
      } else {
        const d = await res.json();
        setProfileAlert({ type: "error", msg: d.error || "Failed to update profile." });
      }
    } catch {
      setProfileAlert({ type: "error", msg: "Network error. Please try again." });
    } finally {
      setProfileLoading(false);
    }
  }

  return (
    <SettingCard
      title="Profile Information"
      description="Update your personal details and display name"
      icon={<User className="w-5 h-5 text-white" />}
    >
      <form onSubmit={handleProfileSave} className="settings-form">
        {profileAlert && <Alert type={profileAlert.type} message={profileAlert.msg} />}

        <div className="profile-identity">
          <div className="profile-avatar">
            {profileForm.name?.charAt(0)?.toUpperCase() || "?"}
          </div>
          <div className="profile-identity-copy">
            <strong>{profileForm.name}</strong>
            <span>{profileForm.email}</span>
            {user?.studentId && (
              <small>Student ID: {user.studentId}</small>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="profile-name" className="block text-xs font-bold mb-1.5" style={{ color: "var(--text-secondary)" }}>Full Name</label>
          <input
            id="profile-name"
            name="name"
            autoComplete="name"
            type="text"
            value={profileForm.name}
            onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
            className="input-field"
            placeholder="Your full name"
          />
        </div>

        <div>
          <label htmlFor="profile-email" className="block text-xs font-bold mb-1.5" style={{ color: "var(--text-secondary)" }}>Email Address</label>
          <input
            id="profile-email"
            name="email"
            autoComplete="email"
            type="email"
            value={profileForm.email}
            readOnly
            className="input-field opacity-60 cursor-not-allowed"
          />
          <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>Email cannot be changed after registration.</p>
        </div>

        {user?.studentId && (
          <div>
            <label htmlFor="profile-student-id" className="block text-xs font-bold mb-1.5" style={{ color: "var(--text-secondary)" }}>Student ID</label>
            <input
              id="profile-student-id"
              name="studentId"
              type="text"
              value={profileForm.studentId}
              readOnly
              className="input-field opacity-60 cursor-not-allowed"
            />
          </div>
        )}

        {user?.role === "STUDENT" && (
          <div className={`profile-credit ${(user?.creditScore ?? productPolicy.initialCredit) < productPolicy.bookingRestrictionBelowCredit ? "is-restricted" : ""}`}>
            <div>
              <span>Credit Score</span>
              <strong>
                {user?.creditScore ?? productPolicy.initialCredit} / {productPolicy.initialCredit}
              </strong>
            </div>
            {(user?.creditScore ?? productPolicy.initialCredit) <
              productPolicy.bookingRestrictionBelowCredit && (
              <p>
                Booking privileges currently restricted.
              </p>
            )}
          </div>
        )}

        <div className="settings-form-actions">
          <button
            type="submit"
            className="btn-primary flex items-center gap-2"
            disabled={profileLoading}
          >
            <Save className="w-4 h-4" />
            {profileLoading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </SettingCard>
  );
}
