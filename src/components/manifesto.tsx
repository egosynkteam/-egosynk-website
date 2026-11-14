"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "motion/react";

const TEXT = "We don't make gear for the warm-up. We make it for the set after the one you planned to stop on. Fuel that tells you every gram. Gear built for load. A scent for after. Sync your ego to the iron.";

// Words light up as the paragraph scrolls through the screen.
export function Manifesto() {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.45"] });
  const words = TEXT.split(" ");
  return (
    <section className="gutter py-28 md:py-40" aria-label="Manifesto">
      <div className="mx-auto max-w-6xl">
        <span className="eyebrow">Manifesto</span>
        <p ref={ref} className="display mt-6 flex flex-wrap text-statement leading-[1.02]">
          {words.map((w, i) => (
            <Word key={i} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]} accent={/iron\.$|ego$/.test(w)}>
              {w}
            </Word>
          ))}
        </p>
      </div>
    </section>
  );
}

function Word({ children, progress, range, accent }: { children: string; progress: MotionValue<number>; range: [number, number]; accent: boolean }) {
  const opacity = useTransform(progress, range, [0.14, 1]);
  return (
    <motion.span style={{ opacity }} className={`mr-[0.25em] ${accent ? "text-rust" : ""}`}>
      {children}
    </motion.span>
  );
}
