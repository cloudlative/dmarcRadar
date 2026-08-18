"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import clsx from "clsx";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

const WORKSPACE_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/reports", label: "Reports" },
];

const ADMIN_LINKS = [
  { href: "/upload", label: "Upload" },
  { href: "/domains", label: "Domains" },
  { href: "/settings/mailbox", label: "Ingestion" },
  { href: "/settings/users", label: "Users" },
];

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={clsx(
        "relative rounded-md px-3 py-1.5 text-sm transition-colors",
        active ? "font-medium text-ink" : "text-ink-muted hover:bg-surface-raised hover:text-ink"
      )}
    >
      {label}
      {active ? (
        <span
          className="absolute inset-x-2 -bottom-[13px] h-0.5 rounded-full"
          style={{ backgroundImage: "linear-gradient(90deg, var(--brand-from), var(--brand-to))" }}
        />
      ) : null}
    </Link>
  );
}

export function Nav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface/80 backdrop-blur supports-[backdrop-filter]:bg-surface/60">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-3">
        <Link href="/" className="shrink-0">
          <Logo size={26} withWordmark />
        </Link>

        <nav className="flex flex-1 items-center gap-1">
          {WORKSPACE_LINKS.map((l) => (
            <NavLink key={l.href} href={l.href} label={l.label} active={pathname === l.href} />
          ))}
          {isAdmin ? (
            <>
              <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
              {ADMIN_LINKS.map((l) => (
                <NavLink key={l.href} href={l.href} label={l.label} active={pathname === l.href} />
              ))}
            </>
          ) : null}
        </nav>

        <ThemeToggle />

        {session?.user ? (
          <div className="flex items-center gap-3 text-sm text-ink-muted">
            <Link href="/profile" className="hover:underline">
              {session.user.name} <span className="text-ink-faint">({session.user.role})</span>
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded-md border border-border px-3 py-1.5 hover:bg-surface-raised"
            >
              Sign out
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
