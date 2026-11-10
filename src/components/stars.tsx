// Average of approved reviews, as on the old product cards: five stars filled to the average.
export function Stars({ avg, count }: { avg: number; count: number }) {
  const pct = Math.max(0, Math.min(100, (avg / 5) * 100));
  const row = "★★★★★";
  return (
    <span className="flex items-center gap-1.5 text-micro text-steel">
      <span className="relative inline-block leading-none tracking-[1px]" role="img" aria-label={`Rated ${avg.toFixed(1)} out of 5 from ${count} review${count === 1 ? "" : "s"}`}>
        <span className="text-line" aria-hidden="true">{row}</span>
        <span className="absolute inset-0 overflow-hidden whitespace-nowrap text-rust-text" style={{ width: `${pct}%` }} aria-hidden="true">{row}</span>
      </span>
      <span className="mono" aria-hidden="true">{avg.toFixed(1)} ({count})</span>
    </span>
  );
}
