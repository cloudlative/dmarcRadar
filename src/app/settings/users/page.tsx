"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useConfirm } from "@/hooks/useConfirm";

interface User {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "VIEWER";
  createdAt: string;
}

const initialForm = { email: "", name: "", password: "", role: "VIEWER" as "ADMIN" | "VIEWER" };

export default function UsersSettingsPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  const load = () =>
    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => setUsers(d.users ?? []));

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(typeof data.error === "string" ? data.error : "Failed to create user");
      return;
    }
    setForm(initialForm);
    load();
  }

  async function handleDelete(id: string) {
    if (!(await confirm("Delete this user?", "Delete"))) return;
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-ink">Users</h1>

      <form onSubmit={handleCreate} className="mb-6 grid grid-cols-2 gap-3 rounded-2xl border border-border bg-surface p-4 md:grid-cols-4">
        <label className="text-sm text-ink-muted">
          Name
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="mt-1 block w-full rounded-md border border-border bg-surface-raised px-3 py-1.5 text-sm text-ink"
          />
        </label>
        <label className="text-sm text-ink-muted">
          Email
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="mt-1 block w-full rounded-md border border-border bg-surface-raised px-3 py-1.5 text-sm text-ink"
          />
        </label>
        <label className="text-sm text-ink-muted">
          Password
          <input
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="mt-1 block w-full rounded-md border border-border bg-surface-raised px-3 py-1.5 text-sm text-ink"
          />
        </label>
        <label className="text-sm text-ink-muted">
          Role
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as "ADMIN" | "VIEWER" })}
            className="mt-1 block w-full rounded-md border border-border bg-surface-raised px-3 py-1.5 text-sm text-ink"
          >
            <option value="VIEWER">Viewer</option>
            <option value="ADMIN">Admin</option>
          </select>
        </label>
        <button
          type="submit"
          className="col-span-2 btn-primary rounded-md px-3 py-1.5 text-sm font-medium md:col-span-1"
        >
          Add user
        </button>
      </form>
      {error ? <p className="mb-4 text-sm text-[var(--status-critical)]">{error}</p> : null}

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-ink-faint">
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2 text-ink">{u.name}</td>
                <td className="px-4 py-2 text-ink-muted">{u.email}</td>
                <td className="px-4 py-2 text-ink-muted">{u.role}</td>
                <td className="px-4 py-2 text-right">
                  {u.id !== session?.user?.id ? (
                    <button
                      onClick={() => handleDelete(u.id)}
                      className="text-xs text-[var(--status-critical)] hover:underline"
                    >
                      Delete
                    </button>
                  ) : (
                    <span className="text-xs text-ink-faint">You</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dialog}
    </div>
  );
}
