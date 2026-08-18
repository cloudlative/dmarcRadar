interface SpinnerProps {
  size?: number;
  className?: string;
}

/** A rolling ring spinner — brand-gradient arc on a faint track, used for any busy/loading state. */
export function Spinner({ size = 28, className }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block animate-spin rounded-full border-[3px] border-border ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        borderTopColor: "var(--brand-from)",
        borderRightColor: "var(--brand-to)",
      }}
    />
  );
}

export function FullPageSpinner() {
  return (
    <div className="flex h-[19rem] w-full items-center justify-center">
      <Spinner size={32} />
    </div>
  );
}
