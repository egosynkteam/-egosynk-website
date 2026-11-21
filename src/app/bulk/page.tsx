import type { Metadata } from "next";
import { BulkForm } from "@/components/bulk-form";
import { EMark } from "@/components/logo";
import { getCatalog } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Bulk & team orders",
  description: "EGOSYNK gear for gyms, coaches, teams and corporate events: volume pricing, size runs, your logo on request and a GST invoice. Reply within 1 working day.",
  alternates: { canonical: "/bulk" },
};

const PERKS = [
  ["Volume pricing", "Better rates as the quantity goes up, quoted per order."],
  ["Size runs sorted", "We help you split sizes across your members or squad using our size charts."],
  ["Your logo, on request", "Ask about adding your gym or team logo. We'll tell you what's possible for your order."],
  ["GST invoice", "Every order comes with a GST tax invoice. Share your GSTIN when we quote."],
];

// Fallback chips if the catalog can't be read (the enquiry function checks ids against the
// admin's categories either way).
const FALLBACK = [
  { id: "sleeves", name: "Gym Sleeves" }, { id: "compression", name: "Compression Wear" }, { id: "bottoms", name: "Bottoms" },
  { id: "innerwear", name: "Innerwear" }, { id: "socks", name: "Gym Socks" }, { id: "accessories", name: "Accessories" },
];

export default async function BulkPage() {
  const { categories, products } = await getCatalog();
  // Only categories with something on sale, so nobody asks for a line we don't stock.
  const cats = categories.filter((c) => products.some((p) => p.cat === c.id));
  return (
    <section className="gutter grain relative overflow-hidden pb-24 pt-[calc(var(--header-h)+3rem)] md:pt-[calc(var(--header-h)+5rem)]">
      <EMark className="pointer-events-none absolute -left-24 bottom-0 hidden w-110 text-surface lg:block" accent="var(--color-rust-dim)" />
      <div className="relative page grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-20">
        <div>
          <p className="eyebrow">Bulk &amp; team orders</p>
          <h1 className="display mt-3 text-display-lg">Kit out the <span className="text-rust">whole floor.</span></h1>
          <p className="mt-6 max-w-[48ch] text-lead text-dim">For gyms, coaches, sports teams and corporate events. Tell us what you need and roughly how many. We&apos;ll come back with pricing and sizing within 1 working day.</p>
          <ol className="mt-10 grid gap-px overflow-hidden rounded-sharp border border-line bg-line">
            {PERKS.map(([title, body], i) => (
              <li key={title} className="grid grid-cols-[auto_1fr] gap-5 bg-ink p-5">
                <span className="mono text-small text-rust-text">{String(i + 1).padStart(2, "0")}</span>
                <span><b className="block text-bone">{title}</b><span className="text-small text-dim">{body}</span></span>
              </li>
            ))}
          </ol>
        </div>
        <div className="lg:pt-4">
          <BulkForm categories={cats.length ? cats : FALLBACK} />
        </div>
      </div>
    </section>
  );
}
