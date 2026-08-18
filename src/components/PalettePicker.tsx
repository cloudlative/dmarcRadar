"use client";

import { useEffect, useRef, useState } from "react";

type Palette = "signal" | "ember" | "slate";

const PALETTES: { id: Palette; label: string; from: string; to: string }[] = [
  { id: "signal", label: "Signal", from: "#2a86e0", to: "#17a878" },
  { id: "ember", label: "Ember", from: "#d9622b", to: "#d9a12b" },
  { id: "slate", label: "Slate", from: "#4f46e5", to: "#6d28d9" },
];

export function PalettePicker() {
  const [palette, setPalette] = useState<Palette | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // The inline theme-init script (see layout.tsx) already applied the stored palette to
    // <html data-palette> before hydration — just read it back here.
    const applied = document.documentElement.dataset.palette as Palette | undefined;
    setPalette(applied ?? "signal");
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function choose(next: Palette) {
    setPalette(next);
    setOpen(false);
    if (next === "signal") {
      delete document.documentElement.dataset.palette;
      window.localStorage.removeItem("palette");
    } else {
      document.documentElement.dataset.palette = next;
      window.localStorage.setItem("palette", next);
    }
  }

  if (!palette) return <span className="h-8 w-8" />;

  const current = PALETTES.find((p) => p.id === palette) ?? PALETTES[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Choose color theme"
        title="Choose color theme"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-surface-raised"
      >
        <span
          className="h-4 w-4 rounded-full"
          style={{ backgroundImage: `linear-gradient(135deg, ${current.from}, ${current.to})` }}
        />
      </button>

      {open ? (
        <div className="absolute right-0 top-10 z-20 w-40 rounded-md border border-border bg-surface-raised p-1.5 shadow-md">
          {PALETTES.map((p) => (
            <button
              key={p.id}
              onClick={() => choose(p.id)}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-ink hover:bg-surface"
            >
              <span
                className="h-3.5 w-3.5 shrink-0 rounded-full"
                style={{ backgroundImage: `linear-gradient(135deg, ${p.from}, ${p.to})` }}
              />
              {p.label}
              {p.id === palette ? <span className="ml-auto text-ink-faint">✓</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
