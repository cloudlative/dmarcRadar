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
        </defs>
        <rect width="128" height="128" rx="28" fill="url(#dmarcradar-logo-bg)" />
        <circle cx="64" cy="64" r="46" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="2.5" />
        <circle cx="64" cy="64" r="30" fill="none" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="2" />
        <circle cx="64" cy="64" r="14" fill="none" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="1.5" />
        <line x1="64" y1="13" x2="64" y2="115" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="1.5" />
        <line x1="13" y1="64" x2="115" y2="64" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="1.5" />
        <rect x="51" y="56" width="26" height="18" rx="2.5" fill="none" stroke="#ffffff" strokeWidth="3" />
        <path
          d="M52 58 L64 69 L76 58"
          fill="none"
          stroke="#ffffff"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="87" cy="45" r="11" fill="none" stroke="#ff7a45" strokeOpacity="0.55" strokeWidth="2" />
        <circle cx="87" cy="45" r="8" fill="#ff7a45" />
        <path
          d="M83 45 L86 48 L92 41"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {withWordmark ? (
        <span className={wordmarkClassName ?? "text-sm font-bold tracking-tight text-ink"}>dmarcRadar</span>
      ) : null}
    </span>
  );
}
