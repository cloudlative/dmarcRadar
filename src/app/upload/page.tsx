"use client";

import { useCallback, useRef, useState } from "react";
import clsx from "clsx";
import { Spinner } from "@/components/Spinner";

interface FileResult {
  filename: string;
  status: "created" | "duplicate" | "error";
  message?: string;
  recordCount?: number;
}

export default function UploadPage() {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<FileResult[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    const formData = new FormData();
    for (const file of Array.from(files)) formData.append("files", file);

    setUploading(true);
    setResults(null);
    try {
      const res = await fetch("/api/reports/upload", { method: "POST", body: formData });
      const data = await res.json();
      setResults(data.results ?? [{ filename: "unknown", status: "error", message: data.error }]);
    } finally {
      setUploading(false);
    }
  }, []);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-ink">Upload DMARC reports</h1>
      <p className="mb-5 text-sm text-ink-muted">
        Accepts <code>.xml</code>, <code>.xml.gz</code>, and <code>.zip</code> DMARC aggregate reports.
        Duplicate reports (same report ID, org, and domain) are skipped automatically.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={clsx(
          "flex h-48 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed text-sm",
          dragActive ? "border-accent bg-surface-raised" : "border-border bg-surface"
        )}
      >
        <p className="text-ink">Drag & drop report files here, or click to browse</p>
        <p className="mt-1 text-ink-faint">Multiple files supported</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".xml,.gz,.zip"
          className="hidden"
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        />
      </div>

      {uploading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-ink-muted">
          <Spinner size={16} />
          Uploading…
        </div>
      ) : null}

      {results ? (
        <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-ink-faint">
                <th className="px-4 py-2 font-medium">File</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.filename} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 text-ink">{r.filename}</td>
                  <td className="px-4 py-2">
                    <span
                      className={clsx(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        r.status === "created" && "bg-[color-mix(in_oklab,var(--status-good)_18%,transparent)] text-[var(--status-good)]",
                        r.status === "duplicate" && "bg-[color-mix(in_oklab,var(--status-warning)_18%,transparent)] text-ink-muted",
                        r.status === "error" && "bg-[color-mix(in_oklab,var(--status-critical)_18%,transparent)] text-[var(--status-critical)]"
                      )}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-ink-muted">
                    {r.status === "created" ? `${r.recordCount} records ingested` : r.message ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
