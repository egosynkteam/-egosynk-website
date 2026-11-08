"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";

export function Faq({ items }: { items: [string, string][] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <ul className="divide-y divide-line border-y border-line">
      {items.map(([q, a], i) => (
        <li key={q}>
          <button type="button" aria-expanded={open === i} aria-controls={`faq-${i}`} onClick={() => setOpen(open === i ? null : i)}
            className="flex w-full items-center justify-between gap-6 py-6 text-left">
            <span className="text-lg font-semibold">{q}</span>
            <motion.span animate={{ rotate: open === i ? 45 : 0 }} className="display text-2xl text-rust" aria-hidden="true">+</motion.span>
          </button>
          <AnimatePresence initial={false}>
            {open === i && (
              <motion.div id={`faq-${i}`} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
                <p className="max-w-[68ch] pb-6 text-dim">{a}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </li>
      ))}
    </ul>
  );
}
