"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { motion } from "motion/react";
import { type Category, type Product } from "@/lib/catalog-shared";
import { useSavedIds } from "@/lib/saved";
import { ProductCard } from "./product-card";

// Live gear from the catalog, as a swipeable rail with category filters. Each card opens the
// product page; the full catalog with filters is the Shop page (/shop).
export function GearRail({ products, categories }: { products: Product[]; categories: Category[] }) {
  const cats = categories.filter((c) => products.some((p) => p.cat === c.id));
  const [cat, setCat] = useState<string>("all");
  const saved = useSavedIds();
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
          <button type="button" aria-label="Previous" disabled={!edges.prev} onClick={() => api?.scrollPrev()} className="grid size-11 place-items-center rounded-sharp border border-line disabled:opacity-30">←</button>
          <button type="button" aria-label="Next" disabled={!edges.next} onClick={() => api?.scrollNext()} className="grid size-11 place-items-center rounded-sharp border border-line disabled:opacity-30">→</button>
        </div>
      </div>
      <div ref={ref} className="-mx-4 overflow-hidden px-4 md:mx-0 md:px-0">
        <ul className="flex touch-pan-y gap-4">
          {shown.map((p, i) => (
            <li key={p.id} className="min-w-0 flex-[0_0_78%] sm:flex-[0_0_44%] lg:flex-[0_0_23.5%]">
              <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                transition={{ duration: 0.6, delay: Math.min(i, 5) * 0.05, ease: [0.16, 1, 0.3, 1] }}>
                <ProductCard p={p} categories={categories} saved={saved.has(p.id)} />
              </motion.div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
