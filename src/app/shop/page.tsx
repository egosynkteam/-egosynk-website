import type { Metadata } from "next";
import { Suspense } from "react";
import { ShopBrowser } from "@/components/shop-browser";
import { EMark } from "@/components/logo";
import { getCatalog } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Shop gear",
  description: "Compression wear, arm sleeves, performance trunks, grip socks, belts and grips from EGOSYNK. Free shipping over ₹999, 7-day size exchange.",
  alternates: { canonical: "/shop" },
};

// Every product on the store, with filters (src/components/shop-browser.tsx). Replaces the
// old /shop.html grid; the catalog comes from the same live function as the rest of the site.
export default async function ShopPage() {
  const { products, categories } = await getCatalog();
  return (
    <>
      <section className="gutter grain relative overflow-hidden border-b border-line pb-10 pt-[calc(var(--header-h)+3rem)] md:pb-14 md:pt-[calc(var(--header-h)+4.5rem)]">
        <EMark className="pointer-events-none absolute -right-16 -top-8 hidden w-96 text-surface lg:block" accent="var(--color-rust-dim)" />
        <div className="relative page">
          <p className="eyebrow">Gear</p>
          <h1 className="display mt-3 text-display-lg">Built for <span className="text-rust">load.</span></h1>
          <p className="mt-4 max-w-[52ch] text-dim">Compression wear, sleeves, trunks, socks, belts and grips. Free shipping over ₹999, and a 7-day size exchange if the fit&apos;s wrong.</p>
        </div>
      </section>
      <section className="gutter pt-8 md:pt-10" aria-label="Products">
        <div className="page">
          {products.length ? (
            // useSearchParams needs a boundary; the fallback is the same grid's footprint.
            <Suspense fallback={<div className="h-[60dvh] animate-pulse rounded-sharp bg-surface" aria-label="Loading products" />}>
              <ShopBrowser products={products} categories={categories} />
            </Suspense>
          ) : (
            <p className="text-dim">The catalog didn&apos;t load. Refresh the page to try again.</p>
          )}
        </div>
      </section>
    </>
  );
}
