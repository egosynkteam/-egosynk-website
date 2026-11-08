"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { Wordmark } from "./logo";
import { legacy } from "@/lib/links";

const NAV = [
  { href: "/hydro", label: "Fuel", note: "HYDRO 150" },
  { href: "/#gear", label: "Gear", note: "Live" },
  { href: "/#scent", label: "Scent", note: "BOLD" },
];

// Reads the same bag the product pages write, so the count matches across the old and new pages.
function useBagCount() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const read = () => {
      try {
        const cart = JSON.parse(localStorage.getItem("egosynk_cart") || sessionStorage.getItem("egosynk_cart") || "[]");
        setN(Array.isArray(cart) ? cart.reduce((s: number, c: { qty?: number }) => s + (Number(c.qty) || 0), 0) : 0);
      } catch {
        setN(0);
      }
    };
    read();
    const onStorage = (e: StorageEvent) => e.key === "egosynk_cart" && read();
    addEventListener("storage", onStorage);
    return () => removeEventListener("storage", onStorage);
  }, []);
  return n;
}

export function SiteHeader() {
  const bag = useBagCount();
  const [open, setOpen] = useState(false);
  const [solid, setSolid] = useState(false);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (y) => setSolid(y > 24));

  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
  }, [open]);

  return (
    <header
      className={`gutter fixed inset-x-0 top-0 z-50 pt-[env(safe-area-inset-top,0px)] transition-colors duration-300 ${
        solid || open ? "border-b border-line bg-ink/85 backdrop-blur-md" : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-[68px] max-w-[1400px] items-center justify-between">
        <Link href="/" aria-label="EGOSYNK home" onClick={() => setOpen(false)}>
          <Wordmark />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="group relative font-mono text-[13px] font-bold uppercase tracking-[0.12em] text-dim transition-colors hover:text-bone">
              {n.label}
              <span className="absolute -bottom-1.5 left-0 h-px w-full origin-left scale-x-0 bg-rust transition-transform duration-300 group-hover:scale-x-100" />
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          <a href={legacy.account} aria-label="Account" className="grid size-10 place-items-center rounded-[2px] border border-line transition-colors hover:border-dim">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
          </a>
          <a href={legacy.bag} aria-label={`Bag, ${bag} items`} className="relative grid size-10 place-items-center rounded-[2px] border border-line transition-colors hover:border-dim">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>
            {bag > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-rust px-1 text-[10px] font-bold">{bag}</span>
            )}
          </a>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="grid size-10 place-items-center rounded-[2px] border border-line md:hidden"
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
            className="h-[calc(100dvh-68px)] pb-10 pt-6 md:hidden"
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
    </header>
  );
}
