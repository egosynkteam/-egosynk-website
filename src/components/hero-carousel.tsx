"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { AnimatePresence, motion } from "motion/react";
import { EMark } from "./logo";
import { Countdown, type Launch } from "./countdown";

type Slide = {
  id: string;
  line: string;
  status: string;
  title: [string, string];
  sub: string;
  cta: { href: string; label: string };
  alt?: { href: string; label: string };
  art: "hydro" | "gear" | "bold";
};

const DELAY = 6500;

export function HeroCarousel({ gearSub, launch }: { gearSub?: string; launch?: Launch }) {
  const slides: Slide[] = [
    {
      id: "hydro", line: "Fuel", status: "Drop list open", title: ["Prime the", "ego."],
      sub: "HYDRO 150 is our first pre-workout: 150 mg caffeine, 8 g citrulline and 500 mg electrolytes in Salted Nimbu. Every gram printed on the label.",
      cta: { href: "/hydro#drop", label: "Join the drop" }, alt: { href: "/hydro", label: "See the formula" }, art: "hydro",
    },
    {
      id: "gear", line: "Gear", status: "Live now", title: ["Sync your ego", "to the iron."],
      sub: gearSub || "Compression gear engineered for lifters who train past the point everyone else stops.",
      cta: { href: "/#gear", label: "Shop gear" }, art: "gear",
    },
    {
      id: "bold", line: "Scent", status: "In development", title: ["Wear your", "ego."],
      sub: "BOLD eau de parfum in 30 and 100 ml, with a cap shaped like the E. Join the drop list to hear first.",
      cta: { href: "/bold", label: "Meet BOLD" }, art: "bold",
    },
  ];

  const [ref, api] = useEmblaCarousel({ loop: true, duration: 32 }, [Autoplay({ delay: DELAY, stopOnInteraction: false, stopOnMouseEnter: true })]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setIndex(api.selectedScrollSnap());
    const auto = api.plugins().autoplay;
    const onPlay = () => setPlaying(true);
    const onStop = () => setPlaying(false);
    api.on("select", onSelect).on("autoplay:play", onPlay).on("autoplay:stop", onStop);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) auto?.stop();
    return () => { api.off("select", onSelect).off("autoplay:play", onPlay).off("autoplay:stop", onStop); };
  }, [api]);

  const go = useCallback((i: number) => api?.scrollTo(i), [api]);
  const toggle = () => {
    const auto = api?.plugins().autoplay;
    if (!auto) return;
    if (auto.isPlaying()) auto.stop(); else auto.play();
  };

  return (
    <section aria-roledescription="carousel" aria-label="Launches" className="grain relative isolate overflow-hidden bg-ink">
      <div ref={ref} className="overflow-hidden">
        <div className="flex touch-pan-y">
          {slides.map((s, i) => (
            <div key={s.id} className="relative min-w-0 flex-[0_0_100%]" role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${slides.length}: ${s.line}`}>
              <SlideView s={s} active={i === index} priority={i === 0} launch={launch} />
            </div>
          ))}
        </div>
      </div>

      <div className="gutter absolute inset-x-0 bottom-6 z-10 md:bottom-10">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3">
          {slides.map((s, i) => (
            <button key={s.id} type="button" onClick={() => go(i)} aria-label={`Show ${s.line}`} aria-current={i === index}
              className="group flex flex-1 flex-col gap-2 text-left md:max-w-[220px]">
              <span className="relative h-0.5 w-full overflow-hidden bg-line">
                {i === index && (
                  <motion.span key={`${index}-${playing}`} className="absolute inset-y-0 left-0 bg-bone"
                    initial={{ width: playing ? "0%" : "100%" }} animate={{ width: "100%" }}
                    transition={{ duration: playing ? DELAY / 1000 : 0, ease: "linear" }} />
                )}
              </span>
              <span className={`mono hidden text-[11px] uppercase tracking-[0.14em] transition-colors md:block ${i === index ? "text-bone" : "text-steel group-hover:text-dim"}`}>
                {String(i + 1).padStart(2, "0")} · {s.line}
              </span>
            </button>
          ))}
          <button type="button" onClick={toggle} aria-label={playing ? "Pause slides" : "Play slides"} className="ml-auto grid size-9 place-items-center rounded-[2px] border border-line text-dim hover:text-bone">
            {playing ? (
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="1" width="3" height="10" fill="currentColor" /><rect x="7" y="1" width="3" height="10" fill="currentColor" /></svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 1l9 5-9 5z" fill="currentColor" /></svg>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}

function SlideView({ s, active, priority, launch }: { s: Slide; active: boolean; priority: boolean; launch?: Launch }) {
  // The countdown sits on the slide for whatever is launching (admin → Settings → Launch countdown).
  const page = (s.alt?.href || s.cta.href).split("#")[0];
  const words = { hidden: { y: "105%" }, show: { y: "0%" } };
  return (
    <div className="gutter relative flex min-h-[min(92dvh,900px)] items-center pb-28 pt-28 md:pb-24">
      <Art kind={s.art} active={active} priority={priority} />
      <div className="relative z-10 mx-auto w-full max-w-[1400px]">
        <div className="max-w-[940px]">
          {/* initial={false}: the first slide is in the server HTML fully visible, so it paints
              before any JavaScript runs. Later slides animate in. */}
          <AnimatePresence mode="wait" initial={false}>
            {active && (
              <motion.div key={s.id} initial="hidden" animate="show" exit={{ opacity: 0, transition: { duration: 0.2 } }}
                variants={{ show: { transition: { staggerChildren: 0.08 } } }}>
                <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="mb-6 flex items-center gap-3">
                  <span className="eyebrow">{s.line}</span>
                  <span className="chip border border-line text-dim">
                    <span className={`size-1.5 rounded-full ${s.status === "Live now" ? "bg-[#5fb98a]" : "bg-rust-bright"}`} />
                    {s.status}
                  </span>
                </motion.div>
                <h1 className="display text-[clamp(50px,8.4vw,128px)]">
                  {s.title.map((line, k) => (
                    <span key={k} className="block overflow-hidden pb-[0.04em]">
                      <motion.span variants={words} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} className={`block ${k === 1 ? "text-rust" : ""}`}>
                        {line}
                      </motion.span>
                    </span>
                  ))}
                </h1>
                <motion.p variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }} className="mt-6 max-w-[46ch] text-[17px] leading-relaxed text-dim">
                  {s.sub}
                </motion.p>
                <motion.div variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }} className="mt-9 flex flex-wrap gap-3">
                  <Link href={s.cta.href} className="btn btn-primary">{s.cta.label} <span aria-hidden="true">→</span></Link>
                  {s.alt && <Link href={s.alt.href} className="btn btn-ghost">{s.alt.label}</Link>}
                </motion.div>
                <motion.div variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}>
                  <Countdown launch={launch} path={page} className="mt-8" />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function Art({ kind, active, priority }: { kind: Slide["art"]; active: boolean; priority: boolean }) {
  const enter = { initial: false as const, animate: active ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 1.06 }, transition: { duration: 1.2, ease: [0.16, 1, 0.3, 1] as const } };
  if (kind === "gear") {
    return (
      <motion.div {...enter} aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(60%_70%_at_75%_45%,#3d0f16_0%,transparent_70%)]" />
        <EMark className="absolute -bottom-[6%] -right-[22%] w-[78vw] text-surface-2 opacity-60 md:bottom-auto md:right-[4%] md:top-1/2 md:w-[min(720px,48vw)] md:-translate-y-1/2 md:opacity-90" accent="var(--color-rust-dim)" />
        <div className="absolute inset-0 bg-[repeating-linear-gradient(115deg,transparent_0_22px,rgba(237,234,227,.025)_22px_23px)]" />
      </motion.div>
    );
  }
  const img = kind === "hydro"
    ? { src: "/img/hydro-tub-34.webp", w: 1200, h: 1500, alt: "HYDRO 150 pre-workout tub, Salted Nimbu", cls: "right-[-18%] w-[min(560px,92vw)] md:right-[6%] md:w-[min(560px,42vw)]" }
    : { src: "/img/bold-pair.webp", w: 1600, h: 1200, alt: "BOLD eau de parfum, 100 and 30 ml", cls: "fade-edges right-[-25%] w-[min(760px,120vw)] md:right-[2%] md:w-[min(760px,52vw)]" };
  return (
    <motion.div {...enter} className="pointer-events-none absolute inset-0">
      <div className={`absolute inset-0 ${kind === "hydro" ? "bg-[radial-gradient(55%_65%_at_72%_50%,#3d0f16_0%,transparent_72%)]" : "bg-[radial-gradient(55%_60%_at_74%_55%,#2a0a10_0%,transparent_70%)]"}`} />
      <Image src={img.src} alt={img.alt} width={img.w} height={img.h} priority={priority} sizes="(min-width: 768px) 45vw, 90vw"
        className={`absolute top-1/2 h-auto -translate-y-1/2 opacity-40 md:opacity-100 ${img.cls}`} />
    </motion.div>
  );
}
