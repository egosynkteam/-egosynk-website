"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { inr, type Category, type Product } from "@/lib/catalog-shared";
import { GIFT_SECTIONS, ORDER_BY, ORDER_BY_LABEL, isFestive } from "@/lib/season";
import { useSavedIds } from "@/lib/saved";
import { ProductCard } from "./product-card";

const noop = () => () => {};
// The visitor's clock, read after hydration (the server's clock and cache don't know "now").
const useNow = () => useSyncExternalStore(noop, () => Math.floor(Date.now() / 60000) * 60000, () => 0);

// "Order by 16 December for delivery before Christmas", with days left; after the cut-off it
// says so plainly instead of promising a delivery date we can't keep.
export function OrderBy({ className = "" }: { className?: string }) {
  const now = useNow();
  if (!now) return <p className={`mono text-micro uppercase tracking-[0.12em] text-dim ${className}`}>Order by {ORDER_BY_LABEL} for delivery before Christmas</p>;
  const days = Math.ceil((ORDER_BY - now) / 86400000);
  return (
    <p className={`mono flex flex-wrap items-center gap-x-3 gap-y-1 text-micro uppercase tracking-[0.12em] ${className}`}>
      {days > 0 ? (
        <>
          <span className="chip bg-rust text-bone">{days === 1 ? "Last day" : `${days} days left`}</span>
          <span className="text-dim">Order by {ORDER_BY_LABEL} for delivery before Christmas</span>
        </>
      ) : (
        <span className="text-dim">Christmas delivery cut-off has passed · orders still ship in 1–2 days</span>
      )}
    </p>
  );
}

function Grid({ items, categories }: { items: Product[]; categories: Category[] }) {
  const saved = useSavedIds();
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-4 md:grid-cols-4">
      {items.map((p) => (
        <li key={p.id}><ProductCard p={p} categories={categories} saved={saved.has(p.id)} /></li>
      ))}
    </ul>
  );
}

// The full guide (/gifts): one section per GIFT_SECTIONS rule, from what's in stock.
export function GiftGuide({ products, categories, gift }: { products: Product[]; categories: Category[]; gift: { name: string; threshold: number } | null }) {
  const live = products.filter((p) => p.available !== false);
  return (
    <div className="grid gap-20 md:gap-28">
      {GIFT_SECTIONS.map((s) => {
        const items = live.filter(s.pick).sort((a, b) => a.price - b.price).slice(0, s.max);
        if (!items.length) return null;
        return (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-[calc(var(--header-h)+var(--promo-h)+1rem)]">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow">{s.eyebrow}</p>
                <h2 id={`${s.id}-h`} className="display mt-3 text-display-sm">{s.title}</h2>
              </div>
              <p className="max-w-[44ch] text-dim">
                {s.body}
                {s.id === "big" && gift && <> <b className="text-bone">Orders of {inr(gift.threshold)}+ get a free {gift.name}.</b></>}
              </p>
            </div>
            <Grid items={items} categories={categories} />
          </section>
        );
      })}
    </div>
  );
}

// Homepage section during the season: the deadline, four stocking fillers and a way in.
export function GiftBand({ products, categories }: { products: Product[]; categories: Category[] }) {
  const on = useSyncExternalStore(noop, () => isFestive(Date.now()), () => false);
  if (!on) return null;
  const picks = products.filter((p) => p.available !== false && GIFT_SECTIONS[0].pick(p)).sort((a, b) => a.price - b.price).slice(0, 4);
  if (!picks.length) return null;
  return (
    <section aria-labelledby="gift-band-h" className="gutter relative overflow-hidden border-y border-line bg-surface py-20 md:py-28">
      <div className="snow pointer-events-none absolute inset-0 opacity-30" aria-hidden="true" />
      <div className="relative page">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow">Christmas</p>
            <h2 id="gift-band-h" className="display mt-3 text-display-md">The gift <span className="text-rust">guide</span></h2>
            <OrderBy className="mt-5" />
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/gifts" className="btn btn-primary">See the full guide →</Link>
            <Link href="/gifts#fillers" className="btn btn-ghost">Under ₹1,000</Link>
          </div>
        </div>
        <Grid items={picks} categories={categories} />
      </div>
    </section>
  );
}
