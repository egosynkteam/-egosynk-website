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
    <div role="region" aria-label="Offer" className="promo-bar gutter relative flex h-(--promo-h) items-center justify-center gap-3 bg-rust text-bone">
      {/* Already closed this visit: hide before paint, without a flash (runs before hydration). */}
      <script dangerouslySetInnerHTML={{ __html: `try{if(sessionStorage.getItem(${JSON.stringify(DISMISSED)})===${JSON.stringify(code)}){document.documentElement.removeAttribute("data-promo")}}catch(e){}` }} />
      <p className="mono truncate text-nano font-bold uppercase tracking-[0.1em] sm:text-micro sm:tracking-[0.12em]">
        <span className="sm:hidden">{short}</span>
        <span className="hidden sm:inline">{text} · code</span>
      </p>
      <button type="button" onClick={copy} className="mono shrink-0 rounded-sharp bg-bone px-2 py-0.5 text-nano font-bold tracking-[0.08em] text-ink sm:text-micro" aria-label={`Copy code ${code}`}>
        {copied ? "Copied" : code}
      </button>
      <button type="button" onClick={close} aria-label="Close offer" className="absolute right-2 grid size-7 place-items-center text-bone/80 hover:text-bone pointer-coarse:size-9">
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.6" /></svg>
      </button>
    </div>
  );
}
