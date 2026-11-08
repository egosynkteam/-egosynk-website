"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { motion, useScroll, useSpring, useTransform } from "motion/react";
import { HYDRO } from "@/lib/hydro";

// Scroll-driven feature: the tub turns and rises while the three arms of the E light up.
export function HydroBand() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const p = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 });
  const rotate = useTransform(p, [0, 1], [-14, 10]);
  const y = useTransform(p, [0, 1], [80, -80]);
  const scale = useTransform(p, [0, 0.5, 1], [0.9, 1.02, 0.96]);
  const glow = useTransform(p, [0.2, 0.5, 0.8], [0.2, 0.9, 0.3]);

  return (
    <section ref={ref} className="gutter relative overflow-hidden border-y border-line bg-surface py-24 md:py-36" aria-labelledby="hydro-band-h">
      <div className="mx-auto grid max-w-[1400px] items-center gap-14 md:grid-cols-2">
        <div className="relative order-2 aspect-[4/5] md:order-1">
          <motion.div style={{ opacity: glow }} className="absolute inset-[8%] rounded-full bg-[radial-gradient(circle,#c41e3a_0%,transparent_65%)] blur-2xl" />
          <motion.div style={{ rotate, y, scale }} className="relative h-full">
            <Image src="/img/hydro-tub-34.webp" alt="HYDRO 150 tub" fill sizes="(min-width: 768px) 45vw, 90vw" className="object-contain" />
          </motion.div>
        </div>
        <div className="order-1 md:order-2">
          <span className="eyebrow">Fuel · first drop</span>
          <h2 id="hydro-band-h" className="display mt-4 text-[clamp(44px,7vw,104px)]">HYDRO<br /><span className="text-rust">150</span></h2>
          <p className="mt-5 max-w-[44ch] text-dim">Three jobs, one scoop. The three arms of the E on the label each do one of them.</p>
          <ol className="mt-10 space-y-px overflow-hidden rounded-[2px] border border-line bg-line">
            {HYDRO.arms.map((a, i) => (
              <Arm key={a.key} i={i} progress={p} arm={a} />
            ))}
          </ol>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/hydro#drop" className="btn btn-primary">Join the drop →</Link>
            <Link href="/hydro" className="btn btn-ghost">Full formula</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Arm({ i, progress, arm }: { i: number; progress: ReturnType<typeof useSpring>; arm: (typeof HYDRO.arms)[number] }) {
  const start = 0.3 + i * 0.1;
  const fill = useTransform(progress, [start, start + 0.1], ["0%", "100%"]);
  return (
    <li className="relative grid grid-cols-[auto_1fr_auto] items-center gap-5 bg-ink px-5 py-5">
      <motion.span style={{ width: fill }} className="absolute inset-y-0 left-0 w-0 bg-rust-dim/70" aria-hidden="true" />
      <span className="mono relative text-xs text-rust-text">{String(i + 1).padStart(2, "0")}</span>
      <span className="relative">
        <span className="display block text-2xl">{arm.title}</span>
        <span className="text-sm text-dim">{arm.line}</span>
      </span>
      <span className="relative text-right">
        <span className="display block text-3xl">{arm.stat}</span>
        <span className="mono text-[11px] uppercase text-steel">{arm.unit}</span>
      </span>
    </li>
  );
}
