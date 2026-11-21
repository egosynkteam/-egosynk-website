"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { searchText, track, type Category, type Product } from "@/lib/catalog-shared";
import { syncSaved, useSavedIds } from "@/lib/saved";
import { ProductCard } from "./product-card";

// The full catalog with filters: collection (category, Saved, New in, Sale), search, size,
// price band, in stock, and sort. Filters live in the address (?cat=sleeves&q=black&size=M),
// so a filtered view can be shared or linked from Instagram, and Back works.
const PRICE_BANDS = [
  { id: "u1000", label: "Under ₹1,000", test: (p: Product) => p.price < 1000 },
  { id: "1000-1999", label: "₹1,000–₹1,999", test: (p: Product) => p.price >= 1000 && p.price < 2000 },
  { id: "2000", label: "₹2,000+", test: (p: Product) => p.price >= 2000 },
];
const SORTS = [
  { id: "featured", label: "Featured" },
  { id: "newest", label: "Newest" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
  { id: "rating", label: "Top rated" },
] as const;
const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];

const onSale = (p: Product) => !!p.mrp && p.mrp > p.price;
// Tagged NEW, or else the newest eight.
function newIds(products: Product[]) {
  const tagged = products.filter((p) => /new/i.test(p.tag || ""));
  return new Set((tagged.length ? tagged : [...products].sort((a, b) => b.id - a.id).slice(0, 8)).map((p) => p.id));
}

export function ShopBrowser({ products, categories }: { products: Product[]; categories: Category[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const saved = useSavedIds();
  useEffect(() => { syncSaved(); }, []);

  const cat = params.get("cat") || "all";
  const q = params.get("q") || "";
  const sizes = new Set((params.get("size") || "").split(",").filter(Boolean));
  const band = params.get("price") || "";
  const inStock = params.get("stock") === "1";
  const sort = params.get("sort") || "featured";

  // Search box: typed text updates the address after a short pause.
  const [text, setText] = useState(q);
  useEffect(() => { setText(q); }, [q]); // eslint-disable-line react-hooks/set-state-in-effect -- Back/Forward changes ?q
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onType = (v: string) => {
    setText(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      set({ q: v.trim() || null });
      if (v.trim().length > 2) track("search", { search_term: v.trim() });
    }, 250);
  };

  const fresh = useMemo(() => newIds(products), [products]);
  const inCollection = (p: Product) =>
    cat === "all" ? true : cat === "saved" ? saved.has(p.id) : cat === "new" ? fresh.has(p.id) : cat === "sale" ? onSale(p) : p.cat === cat;
  const pool = products.filter(inCollection);
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);

  let list = pool.filter((p) => !words.length || words.every((w) => searchText(p, categories).includes(w)));
  if (sizes.size) list = list.filter((p) => p.available !== false && (p.sizes || []).some((s) => sizes.has(s)));
  const priceBand = PRICE_BANDS.find((b) => b.id === band);
  if (priceBand) list = list.filter(priceBand.test);
  if (inStock) list = list.filter((p) => p.available !== false);
  const sorters: Record<string, (a: Product, b: Product) => number> = {
    newest: (a, b) => b.id - a.id,
    "price-asc": (a, b) => a.price - b.price,
    "price-desc": (a, b) => b.price - a.price,
    rating: (a, b) => (b.rating?.avg || 0) - (a.rating?.avg || 0) || (b.rating?.count || 0) - (a.rating?.count || 0),
  };
  // Featured: in-stock first, then the admin's order.
  list = [...list].sort(sorters[sort] || ((a, b) => Number(b.available !== false) - Number(a.available !== false)));

  const collections = [
    { id: "all", name: "All" },
    ...(saved.size || cat === "saved" ? [{ id: "saved", name: `♥ Saved (${products.filter((p) => saved.has(p.id)).length})` }] : []),
    { id: "new", name: "New in" },
    ...(products.some(onSale) ? [{ id: "sale", name: "Sale" }] : []),
    ...categories.filter((c) => products.some((p) => p.cat === c.id)),
  ];
  // Size chips come from what's in the current collection; "Free Size" isn't a filter.
  const sizeChips = [...new Set(pool.flatMap((p) => p.sizes || []))].filter((s) => !/^free size$/i.test(s))
    .sort((a, b) => (SIZE_ORDER.indexOf(a) + 1 || 99) - (SIZE_ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b));
  const refined = sizes.size || band || inStock || q;
  const chip = (on: boolean) =>
    `chip border px-3.5 py-2 pointer-coarse:py-2.5 transition-colors ${on ? "border-bone bg-bone text-ink" : "border-line text-dim hover:border-dim hover:text-bone"}`;

  return (
    <div>
      {/* Collections: one row that scrolls sideways on phones instead of wrapping into a wall of chips. */}
      <div role="tablist" aria-label="Collections" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
        {collections.map((c) => (
          <button key={c.id} role="tab" aria-selected={cat === c.id} onClick={() => set({ cat: c.id === "all" ? null : c.id, size: null })} className={`shrink-0 ${chip(cat === c.id)}`}>
            {c.name}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="relative">
          <span className="sr-only">Search gear</span>
          <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-steel" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input type="search" value={text} onChange={(e) => onType(e.target.value)} placeholder="Search gear: black, compression, belt…" autoComplete="off" enterKeyHint="search"
            className="h-12 w-full rounded-sharp border border-line bg-surface pl-10 pr-3.5 text-bone placeholder:text-steel focus:border-dim focus:outline-none" />
        </label>
        <label className="flex items-center gap-3">
          <span className="mono text-micro uppercase tracking-[0.12em] text-steel">Sort</span>
          <select value={sort} onChange={(e) => set({ sort: e.target.value === "featured" ? null : e.target.value })}
            className="h-12 flex-1 rounded-sharp border border-line bg-surface px-3 text-bone focus:border-dim focus:outline-none sm:flex-none">
            {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Refine">
        {sizeChips.map((s) => (
          <button key={s} type="button" aria-pressed={sizes.has(s)} className={chip(sizes.has(s))}
            onClick={() => { const n = new Set(sizes); if (n.has(s)) n.delete(s); else n.add(s); set({ size: [...n].join(",") || null }); }}>
            {s}
          </button>
        ))}
        {sizeChips.length > 0 && <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" />}
        {PRICE_BANDS.map((b) => (
          <button key={b.id} type="button" aria-pressed={band === b.id} className={chip(band === b.id)} onClick={() => set({ price: band === b.id ? null : b.id })}>{b.label}</button>
        ))}
        <button type="button" aria-pressed={inStock} className={chip(inStock)} onClick={() => set({ stock: inStock ? null : "1" })}>In stock</button>
        {refined && (
          <button type="button" onClick={() => { setText(""); set({ size: null, price: null, stock: null, q: null }); }}
            className="chip px-2 py-2 text-rust-text underline decoration-rust underline-offset-4">Clear all</button>
        )}
      </div>

      <p className="mono mt-6 text-micro uppercase tracking-[0.12em] text-steel" aria-live="polite">
        {list.length} {list.length === 1 ? "product" : "products"}{q && <> for “{q}”</>}
      </p>

      {list.length ? (
        <motion.ul layout className="mt-4 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-4 md:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence initial={false} mode="popLayout">
            {list.map((p, i) => (
              <motion.li key={p.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
                <ProductCard p={p} categories={categories} saved={saved.has(p.id)} priority={i < 4} />
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      ) : (
        <div className="mt-6 rounded-sharp border border-line bg-surface px-6 py-14 text-center">
          <p className="display text-display-sm">{cat === "saved" ? "Nothing saved yet." : "No match."}</p>
          <p className="mx-auto mt-3 max-w-sm text-dim">
            {cat === "saved" ? "Tap the heart on any product to keep it here." : "Try fewer filters or a different word."}
          </p>
          <button type="button" onClick={() => { setText(""); router.replace(pathname, { scroll: false }); }} className="btn btn-ghost mt-6">Show everything</button>
        </div>
      )}
    </div>
  );
}
