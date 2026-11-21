"use client";

import { inr, type Category, type Product } from "@/lib/catalog-shared";
import { percentOff } from "@/lib/product-shared";
import { legacy } from "@/lib/links";
import { toggleSaved } from "@/lib/saved";
import { EMark } from "./logo";
import { Stars } from "./stars";

// One product tile, used by the homepage gear rail and the Shop page. The whole card links
// to the product page; the heart (optional) sits beside the link, not inside it.
export function ProductCard({ p, categories, saved, priority = false }: {
  p: Product;
  categories: Category[];
  saved?: boolean;
  priority?: boolean;
}) {
  const off = percentOff(p);
  const sold = p.available === false;
  return (
    <div className="group relative @container">
      <a href={legacy.product(p.slug)} className="block">
        <div className="relative aspect-[4/5] overflow-hidden rounded-sharp border border-line bg-surface">
          <div className={`absolute inset-0 ${sold ? "opacity-50 grayscale" : ""}`}>
            <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_40%,var(--color-surface-2)_0%,var(--color-surface)_70%)]" />
          {p.images?.[0] ? (
            // Admin-uploaded photo, served by the media function; plain <img> because it lives on the store's own path.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/media/${encodeURIComponent(p.images[0])}`} alt={p.name} loading={priority ? "eager" : "lazy"} decoding="async"
              className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-out-expo group-hover:scale-105" />
          ) : (
            <EMark className="absolute left-1/2 top-1/2 w-1/2 -translate-x-1/2 -translate-y-1/2 text-surface-2 transition-transform duration-700 ease-out-expo group-hover:scale-110" accent="var(--color-rust-dim)" />
          )}
          </div>
          <span className="mono absolute left-3 right-14 top-3 truncate text-nano uppercase tracking-[0.14em] text-steel">{categories.find((c) => c.id === p.cat)?.name || p.cat}</span>
          <span className="absolute bottom-3 left-3 flex gap-1.5">
            {p.tag && <span className="chip bg-rust text-bone">{p.tag}</span>}
            {off > 0 && <span className="chip bg-bone text-ink">−{off}%</span>}
            {sold && <span className="chip border border-line bg-ink text-bone">Sold out</span>}
          </span>
          {/* Hover hint for mouse users; on touch screens a tap would leave it stuck on. */}
          <span className="absolute bottom-3 right-3 translate-y-3 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 pointer-coarse:hidden">
            <span className="mono text-micro font-bold uppercase tracking-[0.12em]">View →</span>
          </span>
        </div>
        {/* Name and price side by side when the card is wide enough; in narrow cards (two
            columns on a small phone) the price goes under the name instead of overflowing. */}
        <div className="mt-3 flex flex-col gap-1 @[14rem]:flex-row @[14rem]:items-start @[14rem]:justify-between @[14rem]:gap-3">
          <h3 className="min-w-0 text-body font-semibold leading-snug">{p.name}</h3>
          <span className="shrink-0 @[14rem]:text-right">
            <span className="mono block text-body font-bold">{inr(p.price)}</span>
            {off > 0 && <s className="mono block text-micro text-steel">{inr(p.mrp!)}</s>}
          </span>
        </div>
        {p.rating && p.rating.count > 0 && <div className="mt-1.5"><Stars avg={p.rating.avg} count={p.rating.count} /></div>}
        {p.sizes && p.sizes.length > 1 && <p className="mono mt-1 text-micro uppercase text-dim">{p.sizes.join(" · ")}</p>}
      </a>
      {saved !== undefined && (
        <button type="button" onClick={() => toggleSaved(p)} aria-pressed={saved} aria-label={`${saved ? "Remove from saved" : "Save"}: ${p.name}`}
          className={`absolute right-2 top-2 grid size-9 place-items-center rounded-full bg-ink/70 backdrop-blur pointer-coarse:size-11 transition-colors ${saved ? "text-rust-bright" : "text-dim hover:text-bone"}`}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z" />
          </svg>
        </button>
      )}
    </div>
  );
}
