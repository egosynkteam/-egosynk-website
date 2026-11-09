"use client";

import { useEffect, useState } from "react";

export type Launch = { date?: string | null; name?: string; href?: string };

// Is there a launch date set in admin → Settings, still in the future, for this page?
export function launchFor(launch: Launch | undefined, path?: string) {
  if (!launch?.date) return null;
  const at = Date.parse(launch.date);
  if (Number.isNaN(at)) return null;
  if (path && (launch.href || "/hydro").split("#")[0] !== path) return null;
  return { at, name: launch.name || "HYDRO 150", href: launch.href || "/hydro" };
}

const pad = (n: number) => String(n).padStart(2, "0");

// Ticks once a second. Renders nothing on the server and before mount (the server's clock
// isn't the visitor's), and nothing once the launch time has passed.
export function Countdown({ launch, path, className = "" }: { launch?: Launch; path?: string; className?: string }) {
  const l = launchFor(launch, path);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!l) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [l?.at]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!l || now === null || l.at <= now) return null;
  const s = Math.floor((l.at - now) / 1000);
  const parts: [number, string][] = [[Math.floor(s / 86400), "Days"], [Math.floor(s / 3600) % 24, "Hrs"], [Math.floor(s / 60) % 60, "Min"], [s % 60, "Sec"]];
  const when = new Date(l.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });

  return (
    <div className={`inline-flex flex-col gap-2 ${className}`}>
      <p className="mono text-[11px] uppercase tracking-[0.14em] text-dim">
        <span className="text-rust-text">{l.name}</span> drops {when} IST
      </p>
      <div role="timer" aria-label={`${parts[0][0]} days, ${parts[1][0]} hours and ${parts[2][0]} minutes until ${l.name} launches`} className="flex items-stretch gap-1.5">
        {parts.map(([v, label], i) => (
          <div key={label} className={`min-w-[64px] rounded-[2px] border px-3 py-2 text-center ${i === 0 ? "border-rust bg-rust-dim/40" : "border-line bg-ink/70"}`} aria-hidden="true">
            <span className="display block text-[30px] leading-none tabular-nums">{i === 0 ? v : pad(v)}</span>
            <span className="mono mt-1 block text-[10px] uppercase tracking-[0.14em] text-steel">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
