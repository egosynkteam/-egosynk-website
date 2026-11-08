"use client";

import { useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { track } from "@/lib/catalog-shared";

// Floating WhatsApp chat, only when a number is set in admin → Settings → Social (same rule
// as the old homepage). It waits until the visitor scrolls past the hero, so it never sits on
// the carousel controls.
export function WhatsAppButton({ href }: { href: string | null }) {
  const [show, setShow] = useState(false);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (y) => setShow(y > 360));
  if (!href) return null;
  return (
    <AnimatePresence>
      {show && (
        <motion.a href={href} target="_blank" rel="noopener" aria-label="Chat with us on WhatsApp"
          onClick={() => track("contact_whatsapp")}
          initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }}
          className="fixed z-40 grid size-14 place-items-center rounded-full bg-[#25d366] text-[#0d0e10] shadow-lg shadow-black/40 transition-transform hover:scale-105"
          style={{ right: "max(20px, env(safe-area-inset-right, 0px))", bottom: "calc(20px + env(safe-area-inset-bottom, 0px))" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.7a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z" /></svg>
        </motion.a>
      )}
    </AnimatePresence>
  );
}
