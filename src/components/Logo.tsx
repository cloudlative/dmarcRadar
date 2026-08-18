interface LogoProps {
  size?: number;
  withWordmark?: boolean;
  wordmarkClassName?: string;
}

/** Inline SVG so it scales crisply at any size and needs no extra network request. */
export function Logo({ size = 28, withWordmark = false, wordmarkClassName }: LogoProps) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 128 128" aria-hidden="true">
        <defs>
          <linearGradient id="dmarcradar-logo-bg" x1="0" y1="0" x2="128" y2="128" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#2a86e0" />
            <stop offset="1" stopColor="#17a878" />
          </linearGradient>
          <radialGradient id="dmarcradar-logo-sweep" cx="64" cy="64" r="46" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="128" height="128" rx="28" fill="url(#dmarcradar-logo-bg)" />
        <path d="M64 64 L64 15 A49 49 0 0 1 104.4 37.7 Z" fill="url(#dmarcradar-logo-sweep)" />
        <circle cx="64" cy="64" r="46" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="2.5" />
        <circle cx="64" cy="64" r="30" fill="none" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="2" />
        <circle cx="64" cy="64" r="14" fill="none" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="1.5" />
        <line x1="64" y1="13" x2="64" y2="115" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="1.5" />
        <line x1="13" y1="64" x2="115" y2="64" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="1.5" />
        <circle cx="64" cy="64" r="5.5" fill="#ffffff" />
        <circle cx="87" cy="45" r="10" fill="none" stroke="#ff7a45" strokeOpacity="0.55" strokeWidth="2" />
        <circle cx="87" cy="45" r="6" fill="#ff7a45" />
      </svg>
      {withWordmark ? (
        <span className={wordmarkClassName ?? "text-sm font-bold tracking-tight text-ink"}>dmarcRadar</span>
      ) : null}
    </span>
  );
}
