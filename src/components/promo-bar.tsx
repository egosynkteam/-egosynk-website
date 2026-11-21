"use client";

import { useState } from "react";

// The offer strip above the header: the coupon ticked "Top bar" in admin → Coupons. It sits in
// the page flow and scrolls away; the header (fixed) starts below it and slides up to the top
// as it goes (site-header.tsx reads --promo-h). Closing it hides it for this visit.
const DISMISSED = "egosynk_promo_closed";

export function PromoBar({ code, text, short }: { code: string; text: string; short: string }) {
  const [closed, setClosed] = useState(false);
  const [copied, setCopied] = useState(false);
  if (closed) return null;

  const close = () => {
    try { sessionStorage.setItem(DISMISSED, code); } catch { /* ignore */ }
    document.documentElement.removeAttribute("data-promo");
    setClosed(true);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard blocked */ }
  };

  return (
    <div role="region" aria-label="Offer" className="promo-bar relative flex h-(--promo-h) items-center justify-center gap-2.5 bg-rust pl-3 pr-11 text-bone sm:gap-3">
      {/* Already closed this visit: hide before paint, without a flash (runs before hydration). */}
      <script dangerouslySetInnerHTML={{ __html: `try{if(sessionStorage.getItem(${JSON.stringify(DISMISSED)})===${JSON.stringify(code)}){document.documentElement.removeAttribute("data-promo")}}catch(e){}` }} />
      <p className="mono truncate text-nano font-bold uppercase tracking-[0.02em] min-[400px]:tracking-[0.08em] sm:text-micro sm:tracking-[0.12em]">
        <span className="sm:hidden">{short}</span>
        <span className="hidden sm:inline">{text} · code</span>
      </p>
      <button type="button" onClick={copy} className="mono grid min-h-6 shrink-0 place-items-center rounded-sharp bg-bone px-2 text-nano font-bold tracking-[0.04em] text-ink sm:px-2.5 sm:text-micro sm:tracking-[0.08em]" aria-label={`Copy code ${code}`}>
        {copied ? "Copied" : code}
      </button>
      <button type="button" onClick={close} aria-label="Close offer" className="absolute right-2 grid size-7 place-items-center text-bone/80 hover:text-bone pointer-coarse:size-9">
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.6" /></svg>
      </button>
    </div>
  );
}
