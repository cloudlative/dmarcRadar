"use client";

import { useCallback, useState } from "react";

interface ConfirmState {
  message: string;
  confirmLabel: string;
  resolve: (value: boolean) => void;
}

/**
 * In-app replacement for window.confirm(). The native dialog is a blocking, browser-owned
 * primitive that doesn't reliably fire in every embedding/automation context — this renders
 * a real component instead, so "confirm" always resolves from an actual click.
 */
export function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((message: string, confirmLabel = "Confirm") => {
    return new Promise<boolean>((resolve) => {
      setState({ message, confirmLabel, resolve });
    });
  }, []);

  function respond(result: boolean) {
    state?.resolve(result);
    setState(null);
  }

  const dialog = state ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={() => respond(false)}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-5 whitespace-pre-line text-sm text-ink">{state.message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => respond(false)}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-ink hover:bg-surface-raised"
          >
            Cancel
          </button>
          <button onClick={() => respond(true)} className="btn-primary rounded-md px-3 py-1.5 text-sm font-medium">
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, dialog };
}
