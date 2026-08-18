"use client";

import { useEffect, useState } from "react";
import { useConfirm } from "@/hooks/useConfirm";

interface Domain {
  id: string;
  name: string;
  description?: string;
  _count: { reports: number };
}

export default function DomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  const load = () =>
    fetch("/api/domains")
      .then((r) => r.json())
      .then((d) => setDomains(d.domains ?? []));

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description: description || undefined }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(typeof data.error === "string" ? data.error : "Failed to create domain");
      return;
    }
    setName("");
    setDescription("");
    load();
  }

  async function handleDelete(id: string, force = false) {
    if (!force && !(await confirm("Delete this domain?", "Delete"))) return;
    setError(null);
    const url = force ? `/api/domains/${id}?force=true` : `/api/domains/${id}`;
    const res = await fetch(url, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      if (!force && res.status === 409) {
        const proceed = await confirm(
          `${data.error}\n\nDelete the domain AND all ${data.reportCount ?? ""} of its reports now?`,
          "Delete everything"
        );
        if (proceed) return handleDelete(id, true);
        return;
      }
      setError(typeof data.error === "string" ? data.error : "Failed to delete domain");
      return;
    }
    load();
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-ink">Domains</h1>

      <form onSubmit={handleCreate} className="mb-6 flex flex-wrap items-end gap-3">
        <label className="text-sm text-ink-muted">
          Domain name
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="example.com"
            className="mt-1 block rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-ink"
          />
        </label>
        <label className="text-sm text-ink-muted">
          Description (optional)
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 block rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-ink"
          />
        </label>
        <button type="submit" className="btn-primary rounded-md px-3 py-1.5 text-sm font-medium">
          Add domain
        </button>
      </form>
      {error ? <p className="mb-4 text-sm text-[var(--status-critical)]">{error}</p> : null}

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-ink-faint">
              <th className="px-4 py-2 font-medium">Domain</th>
              <th className="px-4 py-2 font-medium">Description</th>
              <th className="px-4 py-2 text-right font-medium">Reports</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {domains.map((d) => (
              <tr key={d.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2 text-ink">{d.name}</td>
                <td className="px-4 py-2 text-ink-muted">{d.description ?? "—"}</td>
                <td className="px-4 py-2 text-right tabular-nums text-ink">{d._count.reports}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => handleDelete(d.id)}
                    className="text-xs text-[var(--status-critical)] hover:underline"
                  >
                    Delete
                  </button>
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
