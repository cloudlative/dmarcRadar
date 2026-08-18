"use client";

import { useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

function AnimatedRadarMark() {
  return (
    <svg width="76" height="76" viewBox="0 0 128 128" aria-hidden="true">
      <defs>
        <linearGradient id="login-logo-bg" x1="0" y1="0" x2="128" y2="128" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--brand-from)" />
          <stop offset="1" stopColor="var(--brand-to)" />
        </linearGradient>
        <radialGradient id="login-logo-sweep" cx="64" cy="64" r="46" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="128" height="128" rx="28" fill="url(#login-logo-bg)" />
      <path
        className="radar-sweep"
        d="M64 64 L64 15 A49 49 0 0 1 104.4 37.7 Z"
        fill="url(#login-logo-sweep)"
      />
      <circle cx="64" cy="64" r="46" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="2.5" />
      <circle cx="64" cy="64" r="30" fill="none" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="2" />
      <circle cx="64" cy="64" r="14" fill="none" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="1.5" />
      <line x1="64" y1="13" x2="64" y2="115" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="1.5" />
      <line x1="13" y1="64" x2="115" y2="64" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="1.5" />
      <circle cx="64" cy="64" r="5.5" fill="#ffffff" />
      <circle cx="87" cy="45" r="10" fill="none" stroke="var(--brand-ember)" strokeOpacity="0.55" strokeWidth="2" />
      <circle cx="87" cy="45" r="6" fill="var(--brand-ember)" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // A stale bookmark to /login while already signed in should land on the dashboard, not
  // show the login form underneath the app nav.
  useEffect(() => {
    if (status === "authenticated") router.replace("/");
  }, [status, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (result?.error) {
      setError("Invalid email or password");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center">
      <AnimatedRadarMark />
      <h1 className="mb-1 mt-4 text-lg font-bold tracking-tight text-ink">dmarcRadar</h1>
      <p className="mb-6 text-sm text-ink-faint">Email authentication, scanned continuously</p>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 shadow-sm"
      >
        <p className="mb-5 text-sm font-medium text-ink">Sign in to your workspace</p>

        <label className="mb-3 block text-sm text-ink-muted">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-ink"
          />
        </label>

        <label className="mb-4 block text-sm text-ink-muted">
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-ink"
          />
        </label>

        {error ? <p className="mb-4 text-sm text-[var(--status-critical)]">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full btn-primary rounded-md px-3 py-2 text-sm font-medium disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
