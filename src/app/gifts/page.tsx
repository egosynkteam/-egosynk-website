import type { Metadata } from "next";
import Link from "next/link";
import { GiftGuide, OrderBy } from "@/components/gift-guide";
import { EMark } from "@/components/logo";
import { getCatalog, GIFT_FALLBACK } from "@/lib/catalog";
import { GIFT_SECTIONS } from "@/lib/season";

export const metadata: Metadata = {
  title: "Christmas gift guide",
  description: "Gifts for lifters from EGOSYNK: stocking fillers under ₹1,000, kit for the heavy lifter and the gym regular. Order by 16 December for delivery before Christmas.",
  alternates: { canonical: "/gifts" },
  openGraph: { url: "/gifts", title: "The EGOSYNK Christmas gift guide", description: "Gifts for lifters, from stocking fillers under ₹1,000 to the big ones. Free gift note on every order." },
};

const PERKS = [
  ["Free gift note", "Tick “This is a gift” at checkout and we print your message on a card in the parcel."],
  ["7-day size exchange", "Wrong size? They swap it within 7 days of delivery, unused with tags on."],
  ["Free shipping over ₹999", "And a GST invoice with every order."],
];

export default async function GiftsPage() {
  const { products, categories, settings } = await getCatalog();
  const fg = settings.freeGift ?? GIFT_FALLBACK;
  const gift = fg.enabled !== false && fg.name && fg.threshold ? { name: fg.name, threshold: fg.threshold } : null;
  return (
    <>
      <section className="gutter grain relative overflow-hidden border-b border-line pb-12 pt-[calc(var(--header-h)+3rem)] md:pb-16 md:pt-[calc(var(--header-h)+5rem)]">
        <div className="snow pointer-events-none absolute inset-0" aria-hidden="true" />
        <EMark className="pointer-events-none absolute -right-16 -top-8 hidden w-110 text-surface lg:block" accent="var(--color-rust-dim)" />
        <div className="relative page">
          <p className="eyebrow">Christmas 2026</p>
          <h1 className="display mt-3 max-w-5xl text-display-xl">The gift <span className="text-rust">guide.</span></h1>
          <p className="mt-6 max-w-[52ch] text-lead text-dim">For the one who&apos;s always at the gym. Picked from what&apos;s in stock today, from stocking fillers to the big one.</p>
          <OrderBy className="mt-8" />
          <nav aria-label="Gift guide sections" className="mt-10 flex flex-wrap gap-2">
            {GIFT_SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="chip border border-line px-3.5 py-2 text-dim transition-colors hover:border-dim hover:text-bone pointer-coarse:py-2.5">{s.eyebrow}</a>
            ))}
          </nav>
        </div>
      </section>

      <div className="gutter pt-16 md:pt-24">
        <div className="page">
          <ul className="mb-20 grid gap-px overflow-hidden rounded-sharp border border-line bg-line sm:grid-cols-3 md:mb-28">
            {PERKS.map(([title, body]) => (
              <li key={title} className="bg-ink p-5">
                <b className="mono block text-micro uppercase tracking-[0.12em] text-bone">{title}</b>
                <span className="mt-1 block text-small text-dim">{body}</span>
              </li>
            ))}
          </ul>
          {products.length ? (
            <GiftGuide products={products} categories={categories} gift={gift} />
          ) : (
            <p className="text-dim">The catalog didn&apos;t load. Refresh the page to try again.</p>
          )}
          <div className="mt-24 flex flex-wrap items-center justify-between gap-6 rounded-sharp border border-line bg-surface p-8">
            <div>
              <p className="display text-display-sm">Not sure of their size?</p>
              <p className="mt-2 max-w-[48ch] text-dim">Every product has a size guide with a size finder, and a 7-day size exchange if it&apos;s still wrong.</p>
            </div>
            <Link href="/shop" className="btn btn-ghost">Browse everything →</Link>
          </div>
        </div>
      </div>
    </>
  );
}
