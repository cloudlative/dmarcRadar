"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";

export default function ProfilePage() {
  const { data: session } = useSession();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/users/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to update password");
        return;
      }
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="mb-1 text-xl font-semibold text-ink">Your profile</h1>
      <p className="mb-6 text-sm text-ink-muted">
        {session?.user?.name} · {session?.user?.email} · {session?.user?.role}
      </p>

      <div className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold text-ink">Change password</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="text-sm text-ink-muted">
            Current password
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border border-border bg-surface-raised px-3 py-1.5 text-sm text-ink"
            />
          </label>
          <label className="text-sm text-ink-muted">
            New password
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border border-border bg-surface-raised px-3 py-1.5 text-sm text-ink"
            />
          </label>
          <label className="text-sm text-ink-muted">
            Confirm new password
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border border-border bg-surface-raised px-3 py-1.5 text-sm text-ink"
            />
          </label>

          {error ? <p className="text-sm text-[var(--status-critical)]">{error}</p> : null}
          {success ? <p className="text-sm text-[var(--status-good)]">Password updated.</p> : null}

          <button
            type="submit"
            disabled={submitting}
            className="mt-1 btn-primary rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-60"
          >
            {submitting ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
