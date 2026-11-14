// The skewed E: three arms, the middle one short and red (MIND / MUSCLE / WATER on HYDRO).
export function EMark({ className = "", accent = "var(--color-rust)" }: { className?: string; accent?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <g transform="skewX(-10) translate(14 0)">
        <rect x="10" y="8" width="22" height="84" fill="currentColor" />
        <rect x="10" y="8" width="72" height="22" fill="currentColor" />
        <rect x="10" y="39" width="54" height="22" fill={accent} />
        <rect x="10" y="70" width="72" height="22" fill="currentColor" />
      </g>
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display text-xl uppercase tracking-[0.02em] ${className}`}>
      <span className="text-rust">EGO</span>SYNK
    </span>
  );
}
