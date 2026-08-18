"use client";

import { useEffect, useState } from "react";
import { useConfirm } from "@/hooks/useConfirm";

interface Mailbox {
  id: string;
  name: string;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  folder: string;
  pollIntervalMinutes: number;
  lastPolledAt: string | null;
  lastPollError: string | null;
  enabled: boolean;
}

const initialForm = {
  name: "",
  host: "",
  port: 993,
  secure: true,
  username: "",
  password: "",
  folder: "INBOX",
  pollIntervalMinutes: 15,
};

type EditForm = typeof initialForm;

function MailboxFormFields({
  form,
  onChange,
  passwordRequired,
}: {
  form: EditForm;
  onChange: (form: EditForm) => void;
  passwordRequired: boolean;
}) {
  return (
    <>
      <label className="text-sm text-ink-muted">
        Name
        <input
          required
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          placeholder="e.g. Support inbox"
          className="mt-1 block w-full rounded-md border border-border bg-surface-raised px-3 py-1.5 text-sm text-ink"
        />
      </label>
      <label className="text-sm text-ink-muted">
        Host
        <input
          required
          value={form.host}
          onChange={(e) => onChange({ ...form, host: e.target.value })}
          placeholder="imap.example.com"
          className="mt-1 block w-full rounded-md border border-border bg-surface-raised px-3 py-1.5 text-sm text-ink"
        />
      </label>
      <label className="text-sm text-ink-muted">
        Port
        <input
          type="number"
          value={form.port}
          onChange={(e) => onChange({ ...form, port: Number(e.target.value) })}
          className="mt-1 block w-full rounded-md border border-border bg-surface-raised px-3 py-1.5 text-sm text-ink"
        />
      </label>
      <label className="flex items-center gap-2 self-end text-sm text-ink-muted">
        <input
          type="checkbox"
          checked={form.secure}
          onChange={(e) => onChange({ ...form, secure: e.target.checked })}
        />
        Use TLS
      </label>
      <label className="text-sm text-ink-muted">
        Username
        <input
          required
          value={form.username}
          onChange={(e) => onChange({ ...form, username: e.target.value })}
          className="mt-1 block w-full rounded-md border border-border bg-surface-raised px-3 py-1.5 text-sm text-ink"
        />
      </label>
      <label className="text-sm text-ink-muted">
        Password {passwordRequired ? null : <span className="text-ink-faint">(leave blank to keep current)</span>}
        <input
          type="password"
          required={passwordRequired}
          value={form.password}
          onChange={(e) => onChange({ ...form, password: e.target.value })}
          className="mt-1 block w-full rounded-md border border-border bg-surface-raised px-3 py-1.5 text-sm text-ink"
        />
      </label>
      <label className="text-sm text-ink-muted">
        Folder
        <input
          value={form.folder}
          onChange={(e) => onChange({ ...form, folder: e.target.value })}
          className="mt-1 block w-full rounded-md border border-border bg-surface-raised px-3 py-1.5 text-sm text-ink"
        />
      </label>
      <label className="text-sm text-ink-muted">
        Poll interval (minutes)
        <input
          type="number"
          min={1}
          value={form.pollIntervalMinutes}
          onChange={(e) => onChange({ ...form, pollIntervalMinutes: Number(e.target.value) })}
          className="mt-1 block w-full rounded-md border border-border bg-surface-raised px-3 py-1.5 text-sm text-ink"
        />
      </label>
    </>
  );
}

export default function MailboxSettingsPage() {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [form, setForm] = useState<EditForm>(initialForm);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [pollResult, setPollResult] = useState<string | null>(null);
  const [pollingIds, setPollingIds] = useState<Set<string>>(new Set());
  const [rowResults, setRowResults] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Mailbox | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(initialForm);
  const [editError, setEditError] = useState<string | null>(null);
  const [rescanningIds, setRescanningIds] = useState<Set<string>>(new Set());
  const { confirm, dialog } = useConfirm();

  const load = () =>
    fetch("/api/settings/mailbox")
      .then((r) => r.json())
      .then((d) => setMailboxes(d.mailboxes ?? []));

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/settings/mailbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(typeof data.error === "string" ? data.error : "Failed to save mailbox");
      return;
    }
    setForm(initialForm);
    load();
  }

  function openEdit(mb: Mailbox) {
    setEditError(null);
    setEditForm({
      name: mb.name,
      host: mb.host,
      port: mb.port,
      secure: mb.secure,
      username: mb.username,
      password: "",
      folder: mb.folder,
      pollIntervalMinutes: mb.pollIntervalMinutes,
    });
    setEditing(mb);
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setEditError(null);
    const { password, ...rest } = editForm;
    const res = await fetch(`/api/settings/mailbox/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...rest, ...(password ? { password } : {}) }),
    });
    if (!res.ok) {
      const data = await res.json();
      setEditError(typeof data.error === "string" ? data.error : "Failed to save changes");
      return;
    }
    setEditing(null);
    load();
  }

  async function toggleEnabled(mb: Mailbox) {
    await fetch(`/api/settings/mailbox/${mb.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !mb.enabled }),
    });
    load();
  }

  async function handleDelete(id: string) {
    if (!(await confirm("Remove this mailbox configuration?", "Remove"))) return;
    await fetch(`/api/settings/mailbox/${id}`, { method: "DELETE" });
    load();
  }

  async function pollOne(id: string) {
    setPollingIds((prev) => new Set(prev).add(id));
    setRowResults((prev) => ({ ...prev, [id]: "" }));
    try {
      const res = await fetch(`/api/ingest/run/${id}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setRowResults((prev) => ({ ...prev, [id]: data.error ?? "Poll failed" }));
        return;
      }
      const s = data.summary as {
        messagesScanned: number;
        reportsCreated: number;
        reportsDuplicate: number;
        errors: number;
        rescannedFromStart: boolean;
        truncated: boolean;
      };
      const parts = [`${s.reportsCreated} new report${s.reportsCreated === 1 ? "" : "s"}`];
      if (s.errors > 0) parts.push(`${s.errors} error${s.errors === 1 ? "" : "s"}`);
      if (s.rescannedFromStart) parts.push("scanning full history");
      if (s.truncated) parts.push("more messages left — poll again to continue");
      setRowResults((prev) => ({ ...prev, [id]: parts.join(" · ") }));
      load();
    } finally {
      setPollingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function rescanFromStart(mb: Mailbox) {
    if (
      !(await confirm(
        `Rescan "${mb.name}" from the start of ${mb.folder}? This re-processes every message in the folder, including ones already seen — use this after deleting a domain's data if you want its reports re-ingested.`,
        "Rescan"
      ))
    )
      return;
    setRescanningIds((prev) => new Set(prev).add(mb.id));
    try {
      await fetch(`/api/settings/mailbox/${mb.id}/rescan`, { method: "POST" });
      await pollOne(mb.id);
    } finally {
      setRescanningIds((prev) => {
        const next = new Set(prev);
        next.delete(mb.id);
        return next;
      });
    }
  }

  async function pollNow() {
    setPolling(true);
    setPollResult(null);
    try {
      const res = await fetch("/api/ingest/run", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setPollResult(data.error ?? "Poll failed");
        return;
      }
      const summaries: { reportsCreated: number; rescannedFromStart: boolean; truncated: boolean }[] =
        data.summaries ?? [];
      const total = summaries.reduce((acc, s) => acc + s.reportsCreated, 0);
      const anyFullScan = summaries.some((s) => s.rescannedFromStart);
      const anyTruncated = summaries.some((s) => s.truncated);
      const fullScanNote = anyFullScan
        ? " (first poll for at least one mailbox — scanning its folder history, including already-read mail.)"
        : "";
      const truncatedNote = anyTruncated
        ? " Large backlog on at least one mailbox — poll again (or wait for the next scheduled poll) to continue."
        : "";
      setPollResult(
        `Poll complete: ${total} new report(s) ingested across ${summaries.length} mailbox(es).${fullScanNote}${truncatedNote}`
      );
      load();
    } finally {
      setPolling(false);
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-ink">Ingestion settings</h1>
      <p className="mb-5 text-sm text-ink-muted">
        Configure an IMAP mailbox that receives DMARC aggregate reports. The background worker polls
        each enabled mailbox on its configured interval and extracts report attachments automatically.
      </p>

      <form onSubmit={handleCreate} className="mb-6 grid grid-cols-2 gap-3 rounded-2xl border border-border bg-surface p-4 md:grid-cols-3">
        <MailboxFormFields form={form} onChange={setForm} passwordRequired />
        <button
          type="submit"
          className="col-span-2 btn-primary rounded-md px-3 py-1.5 text-sm font-medium md:col-span-1"
        >
          Add mailbox
        </button>
      </form>
      {error ? <p className="mb-4 text-sm text-[var(--status-critical)]">{error}</p> : null}

      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={pollNow}
          disabled={polling}
          className="rounded-md border border-border px-3 py-1.5 text-sm text-ink hover:bg-surface-raised disabled:opacity-60"
        >
          {polling ? "Polling…" : "Poll all"}
        </button>
        {pollResult ? <span className="text-sm text-ink-muted">{pollResult}</span> : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-ink-faint">
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Host</th>
              <th className="px-4 py-2 font-medium">Username</th>
              <th className="px-4 py-2 font-medium">Folder</th>
              <th className="px-4 py-2 font-medium">Interval</th>
              <th className="px-4 py-2 font-medium">Last polled</th>
              <th className="px-4 py-2 font-medium">Enabled</th>
              <th className="px-4 py-2 font-medium"></th>
              <th className="px-4 py-2 font-medium"></th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {mailboxes.map((mb) => (
              <tr key={mb.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2 font-medium text-ink">{mb.name}</td>
                <td className="px-4 py-2 text-ink-muted">
                  {mb.host}:{mb.port}
                </td>
                <td className="px-4 py-2 text-ink-muted">{mb.username}</td>
                <td className="px-4 py-2 text-ink-muted">{mb.folder}</td>
                <td className="px-4 py-2 text-ink-muted">{mb.pollIntervalMinutes}m</td>
                <td className="px-4 py-2 text-ink-muted">
                  {mb.lastPolledAt ? new Date(mb.lastPolledAt).toLocaleString() : "Never"}
                  {mb.lastPollError ? (
                    <div className="mt-0.5 text-xs text-[var(--status-critical)]" title={mb.lastPollError}>
                      Failed: {mb.lastPollError}
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-2">
                  <button onClick={() => toggleEnabled(mb)} className="text-xs text-ink-muted hover:underline">
                    {mb.enabled ? "Enabled" : "Disabled"}
                  </button>
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => pollOne(mb.id)}
                      disabled={pollingIds.has(mb.id) || rescanningIds.has(mb.id)}
                      className="rounded-md border border-border px-2 py-1 text-xs text-ink hover:bg-surface-raised disabled:opacity-60"
                    >
                      {pollingIds.has(mb.id) ? "Polling…" : "Poll"}
                    </button>
                    <button
                      onClick={() => rescanFromStart(mb)}
                      disabled={pollingIds.has(mb.id) || rescanningIds.has(mb.id)}
                      title="Reset the IMAP checkpoint and re-process every message from the start of the folder, including ones already seen"
                      className="rounded-md border border-border px-2 py-1 text-xs text-ink-muted hover:bg-surface-raised disabled:opacity-60"
                    >
                      {rescanningIds.has(mb.id) ? "Rescanning…" : "Rescan"}
                    </button>
                    {rowResults[mb.id] ? (
                      <span className="text-xs text-ink-faint">{rowResults[mb.id]}</span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => openEdit(mb)}
                    className="rounded-md border border-border px-2 py-1 text-xs text-ink hover:bg-surface-raised"
                  >
                    Edit
                  </button>
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => handleDelete(mb.id)}
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

      {editing ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setEditing(null)}
        >
          <form
            onSubmit={handleEditSave}
            onClick={(e) => e.stopPropagation()}
            className="grid w-full max-w-lg grid-cols-2 gap-3 rounded-2xl border border-border bg-surface p-5 shadow-lg"
          >
            <h2 className="col-span-2 text-sm font-semibold text-ink">Edit mailbox</h2>
            <MailboxFormFields form={editForm} onChange={setEditForm} passwordRequired={false} />
            {editError ? (
              <p className="col-span-2 text-sm text-[var(--status-critical)]">{editError}</p>
            ) : null}
            <div className="col-span-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-ink hover:bg-surface-raised"
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary rounded-md px-3 py-1.5 text-sm font-medium">
                Save
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
