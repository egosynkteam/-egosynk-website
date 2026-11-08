"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { motion } from "motion/react";
import { inr, type Category, type Product } from "@/lib/catalog-shared";
import { legacy } from "@/lib/links";
import { EMark } from "./logo";

// Live gear from the catalog, as a swipeable rail with category filters. Each card opens the
// existing product page, where sizes, bag and checkout already work.
export function GearRail({ products, categories }: { products: Product[]; categories: Category[] }) {
  const cats = categories.filter((c) => products.some((p) => p.cat === c.id));
  const [cat, setCat] = useState<string>("all");
  const shown = cat === "all" ? products : products.filter((p) => p.cat === cat);
  const [ref, api] = useEmblaCarousel({ align: "start", dragFree: true, containScroll: "trimSnaps" });
  const [edges, setEdges] = useState({ prev: false, next: true });

  const update = useCallback(() => api && setEdges({ prev: api.canScrollPrev(), next: api.canScrollNext() }), [api]);
  useEffect(() => {
    if (!api) return;
    const raf = requestAnimationFrame(update);
    api.on("select", update).on("reInit", update).on("scroll", update);
    return () => { cancelAnimationFrame(raf); api.off("select", update).off("reInit", update).off("scroll", update); };
  }, [api, update]);
  useEffect(() => { api?.reInit(); api?.scrollTo(0, true); }, [cat, api]);

  if (!products.length) {
    return <p className="text-dim">The gear catalog didn&apos;t load. Refresh the page to try again.</p>;
  }

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div role="tablist" aria-label="Filter gear" className="flex flex-wrap gap-2">
          {[{ id: "all", name: "All" }, ...cats].map((c) => (
            <button key={c.id} role="tab" aria-selected={cat === c.id} onClick={() => setCat(c.id)}
              className={`chip relative border px-3.5 py-2 transition-colors ${cat === c.id ? "border-bone text-ink" : "border-line text-dim hover:text-bone"}`}>
              {cat === c.id && <motion.span layoutId="gear-pill" className="absolute inset-0 -z-0 bg-bone" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
              <span className="relative">{c.name}</span>
            </button>
          ))}
        </div>
        <div className="hidden gap-2 md:flex">
          <button type="button" aria-label="Previous" disabled={!edges.prev} onClick={() => api?.scrollPrev()} className="grid size-11 place-items-center rounded-[2px] border border-line disabled:opacity-30">←</button>
          <button type="button" aria-label="Next" disabled={!edges.next} onClick={() => api?.scrollNext()} className="grid size-11 place-items-center rounded-[2px] border border-line disabled:opacity-30">→</button>
        </div>
      </div>
      <div ref={ref} className="-mx-4 overflow-hidden px-4 md:mx-0 md:px-0">
        <ul className="flex touch-pan-y gap-4">
          {shown.map((p, i) => (
            <li key={p.id} className="min-w-0 flex-[0_0_78%] sm:flex-[0_0_44%] lg:flex-[0_0_23.5%]">
              <motion.a href={legacy.product(p.slug)} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                transition={{ duration: 0.6, delay: Math.min(i, 5) * 0.05, ease: [0.16, 1, 0.3, 1] }}
                className={`group block ${p.available === false ? "opacity-60" : ""}`}>
                <div className="relative aspect-[4/5] overflow-hidden rounded-[2px] border border-line bg-surface">
                  <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_40%,#1f2023_0%,#17181b_70%)]" />
                  {p.images?.[0] ? (
                    // Admin-uploaded photo, served by the media function; plain <img> because it lives on the store's own path.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/media/${encodeURIComponent(p.images[0])}`} alt={p.name} loading="lazy" decoding="async"
                      className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-out-expo group-hover:scale-105" />
                  ) : (
                    <EMark className="absolute left-1/2 top-1/2 w-1/2 -translate-x-1/2 -translate-y-1/2 text-surface-2 transition-transform duration-700 ease-out-expo group-hover:scale-110" accent="var(--color-rust-dim)" />
                  )}
                  <span className="mono absolute left-3 top-3 text-[10px] uppercase tracking-[0.14em] text-steel">{categories.find((c) => c.id === p.cat)?.name || p.cat}</span>
                  {p.tag && <span className="chip absolute right-3 top-3 bg-rust text-bone">{p.tag}</span>}
                  {p.available === false && <span className="chip absolute bottom-3 left-3 border border-line bg-ink text-dim">Sold out</span>}
                  <span className="absolute inset-x-3 bottom-3 translate-y-3 text-right opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                    <span className="mono text-[11px] font-bold uppercase tracking-[0.12em]">View →</span>
                  </span>
                </div>
                <div className="mt-3 flex items-start justify-between gap-3">
                  <h3 className="text-[15px] font-semibold leading-snug">{p.name}</h3>
                  <span className="mono shrink-0 text-[15px] font-bold">{inr(p.price)}</span>
                </div>
                {p.sizes && p.sizes.length > 1 && <p className="mono mt-1 text-[11px] uppercase text-steel">{p.sizes.join(" · ")}</p>}
              </motion.a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
