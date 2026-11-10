"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { Wordmark } from "./logo";
import { legacy } from "@/lib/links";
import { SearchDialog } from "./search-dialog";
import { useBag } from "./bag";

const NAV = [
  { href: "/hydro", label: "Fuel", note: "HYDRO 150" },
  { href: "/#gear", label: "Gear", note: "Live" },
  { href: "/bold", label: "Scent", note: "BOLD" },
];

export function SiteHeader() {
  const { count: bag, open: openBag } = useBag();
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [solid, setSolid] = useState(false);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (y) => setSolid(y > 24));

  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
  }, [open]);

  // Ctrl/⌘ K anywhere, or "/" when not typing in a field, opens search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if ((e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setOpen(false);
        setSearching(true);
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  return (
    <header
      className={`gutter fixed inset-x-0 top-0 z-(--z-header) pt-[env(safe-area-inset-top,0px)] transition-colors duration-300 ${
        solid || open ? "border-b border-line bg-ink/85 backdrop-blur-md" : "border-b border-transparent"
      }`}
    >
      <div className=" flex h-(--header-h) page items-center justify-between">
        <Link href="/" aria-label="EGOSYNK home" onClick={() => setOpen(false)}>
          <Wordmark />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="group relative font-mono text-small font-bold uppercase tracking-[0.12em] text-dim transition-colors hover:text-bone">
              {n.label}
              <span className="absolute -bottom-1.5 left-0 h-px w-full origin-left scale-x-0 bg-rust transition-transform duration-300 group-hover:scale-x-100" />
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          <button type="button" onClick={() => { setOpen(false); setSearching(true); }} aria-label="Search (Ctrl K)"
            className="grid size-10 pointer-coarse:size-11 place-items-center rounded-sharp border border-line transition-colors hover:border-dim">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          </button>
          <a href={legacy.account} aria-label="Account" className="grid size-10 pointer-coarse:size-11 place-items-center rounded-sharp border border-line transition-colors hover:border-dim">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
          </a>
          <button type="button" onClick={() => { setOpen(false); openBag(); }} aria-label={`Bag, ${bag} items`} aria-haspopup="dialog" className="relative grid size-10 pointer-coarse:size-11 place-items-center rounded-sharp border border-line transition-colors hover:border-dim">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>
            {bag > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-rust px-1 text-nano font-bold">{bag}</span>
            )}
          </button>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="grid size-10 pointer-coarse:size-11 place-items-center rounded-sharp border border-line md:hidden"
          >
            <span className="relative block h-3 w-4">
              <span className={`absolute left-0 h-0.5 w-4 bg-bone transition-all duration-300 ${open ? "top-[5px] rotate-45" : "top-0"}`} />
              <span className={`absolute left-0 top-[5px] h-0.5 w-4 bg-bone transition-opacity ${open ? "opacity-0" : ""}`} />
              <span className={`absolute left-0 h-0.5 w-4 bg-bone transition-all duration-300 ${open ? "top-[5px] -rotate-45" : "top-[10px]"}`} />
            </span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            aria-label="Mobile"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="h-[calc(100dvh-var(--header-h))] pb-10 pt-6 md:hidden"
          >
            {NAV.map((n, i) => (
              <motion.div key={n.href} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i + 0.05 }}>
                <Link href={n.href} onClick={() => setOpen(false)} className="flex items-baseline justify-between border-b border-line py-5">
                  <span className="display text-5xl">{n.label}</span>
                  <span className="mono text-xs uppercase text-dim">{n.note}</span>
                </Link>
              </motion.div>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>
      <SearchDialog open={searching} onClose={() => setSearching(false)} />
    </header>
  );
}
