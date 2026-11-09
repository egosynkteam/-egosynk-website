"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { inr, searchText, track, type Catalog } from "@/lib/catalog-shared";
import { legacy } from "@/lib/links";

type Hit = { key: string; href: string; title: string; meta: string; note?: string };

// Launches that aren't in the catalog yet, so searching "pre workout" or "perfume" finds them.
const LAUNCHES: (Hit & { words: string })[] = [
  { key: "hydro", href: "/hydro", title: "HYDRO 150 pre-workout", meta: "Fuel", note: "Drop list open", words: "hydro 150 pre-workout preworkout pre workout supplement caffeine citrulline electrolytes fuel energy salted nimbu" },
  { key: "bold", href: "/bold", title: "BOLD eau de parfum", meta: "Scent", note: "In development", words: "bold perfume fragrance scent eau de parfum edp cologne" },
];

let catalogPromise: Promise<Catalog | null> | null = null;
const loadCatalog = () =>
  (catalogPromise ??= fetch("/.netlify/functions/get-catalog")
    .then((r) => (r.ok ? (r.json() as Promise<Catalog>) : null))
    .catch(() => { catalogPromise = null; return null; }));

// Product search over the live catalog. Opens from the header button, Ctrl/⌘ K or "/".
export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    loadCatalog().then((c) => { if (!live) return; if (c) setCatalog(c); else setFailed(true); });
    const t = setTimeout(() => input.current?.focus(), 30);
    document.documentElement.style.overflow = "hidden";
    return () => { live = false; clearTimeout(t); document.documentElement.style.overflow = ""; };
  }, [open]);

  const hits = useMemo<Hit[]>(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const launches = LAUNCHES.filter((l) => words.every((w) => l.words.includes(w) || l.title.toLowerCase().includes(w)));
    const products = (catalog?.products || [])
      .filter((p) => words.every((w) => searchText(p, catalog?.categories || []).includes(w)))
      .slice(0, 8)
      .map((p) => ({
        key: String(p.id), href: legacy.product(p.slug), title: p.name,
        meta: catalog?.categories.find((c) => c.id === p.cat)?.name || p.cat,
        note: p.available === false ? "Sold out" : inr(p.price),
      }));
    return [...launches, ...products];
  }, [q, catalog]);

  const go = useCallback((h: Hit) => {
    track("search", { search_term: q.trim(), result: h.title });
    onClose();
    location.href = h.href;
  }, [q, onClose]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && hits[active]) { e.preventDefault(); go(hits[active]); }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] flex items-start justify-center bg-ink/70 px-4 pt-[max(12vh,env(safe-area-inset-top,0px))] backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div role="dialog" aria-modal="true" aria-label="Search the store" onKeyDown={onKey}
            initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }} transition={{ duration: 0.2 }}
            className="w-full max-w-[640px] overflow-hidden rounded-[2px] border border-line bg-surface shadow-2xl">
            <div className="flex items-center gap-3 border-b border-line px-4">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-steel" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input id="site-search" ref={input} value={q} onChange={(e) => { setQ(e.target.value); setActive(0); }}
                type="search" placeholder="Search gear, HYDRO, BOLD…" autoComplete="off" spellCheck={false}
                role="combobox" aria-expanded={hits.length > 0} aria-controls="site-search-results"
                aria-activedescendant={hits[active] ? `hit-${hits[active].key}` : undefined}
                className="h-14 w-full bg-transparent text-[17px] text-bone placeholder:text-steel focus:outline-none focus-visible:outline-none" />
              <kbd className="mono hidden shrink-0 rounded-[2px] border border-line px-1.5 py-0.5 text-[10px] text-steel sm:block">ESC</kbd>
            </div>
            <ul id="site-search-results" role="listbox" className="max-h-[60vh] overflow-y-auto py-2">
              {hits.map((h, i) => (
                <li key={h.key} id={`hit-${h.key}`} role="option" aria-selected={i === active}>
                  <a href={h.href} onClick={(e) => { e.preventDefault(); go(h); }} onMouseEnter={() => setActive(i)}
                    className={`flex items-center justify-between gap-4 px-4 py-3 ${i === active ? "bg-surface-2" : ""}`}>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{h.title}</span>
                      <span className="mono text-[11px] uppercase tracking-[0.1em] text-steel">{h.meta}</span>
                    </span>
                    {h.note && <span className="mono shrink-0 text-sm font-bold">{h.note}</span>}
                  </a>
                </li>
              ))}
            </ul>
            {q.trim() && !hits.length && (
              <p className="px-4 pb-5 text-sm text-dim">
                {failed ? "Search couldn't load the catalog. Check your connection and try again." : catalog ? `Nothing matches "${q.trim()}". Try "sleeves", "shorts" or "belt".` : "Loading…"}
              </p>
            )}
            {!q.trim() && (
              <div className="flex flex-wrap gap-2 px-4 pb-5 pt-1">
                {["Pre-workout", "Sleeves", "Compression", "Lifting belt", "Shorts", "Perfume"].map((s) => (
                  <button key={s} type="button" onClick={() => { setQ(s); setActive(0); input.current?.focus(); }}
                    className="chip border border-line text-dim hover:text-bone">{s}</button>
                ))}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
