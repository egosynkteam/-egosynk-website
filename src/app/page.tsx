import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import { HeroCarousel } from "@/components/hero-carousel";
import { Marquee } from "@/components/marquee";
import { Lines } from "@/components/lines";
import { HydroBand } from "@/components/hydro-band";
import { GearRail } from "@/components/gear-rail";
import { Manifesto } from "@/components/manifesto";
import { Reveal } from "@/components/reveal";
import { WaitlistForm } from "@/components/waitlist-form";
import { getCatalog, isGear, inr } from "@/lib/catalog";
import { legacy } from "@/lib/links";
import { JsonLd } from "@/components/json-ld";

const DESCRIPTION =
  "HYDRO 150 pre-workout, compression gear, lifting accessories and BOLD fragrance, built for lifters. Made in India. Free shipping over ₹999.";

export const metadata: Metadata = {
  title: { absolute: "EGOSYNK · Fuel, gear and scent for lifters" },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { url: "/", title: "EGOSYNK · Fuel, gear and scent for lifters", description: DESCRIPTION, images: [{ url: "/img/og-home.jpg", width: 1200, height: 630, alt: "EGOSYNK: HYDRO 150 pre-workout and BOLD eau de parfum" }] },
};

export default async function Home() {
  const { settings, products } = await getCatalog();
  // Same product rich results the old homepage published, now in the server HTML.
  const productList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: products.filter(isGear).map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Product", name: p.name, brand: { "@type": "Brand", name: "EGOSYNK" }, category: p.cat,
        url: `https://egosynk.com${legacy.product(p.slug)}`,
        offers: {
          "@type": "Offer", priceCurrency: "INR", price: p.price, url: `https://egosynk.com${legacy.product(p.slug)}`,
          availability: p.available === false ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
        },
      },
    })),
  };
  const free = settings.freeShippingThreshold;
  const ticker = [
    "HYDRO 150 · drop list open",
    ...(settings.announcement?.enabled ? settings.announcement.items || [] : []),
    ...(free ? [`Free shipping over ${inr(free)}`] : []),
  ];

  return (
    <>
      {products.length > 0 && <JsonLd data={productList} />}
      <HeroCarousel gearSub={settings.hero?.sub} launch={settings.launch} />
      <Marquee items={[...new Set(ticker)]} />
      <Lines />
      <HydroBand />

      {/* Older pages link to /#shop; it lands here. */}
      <span id="shop" className="block scroll-mt-24" aria-hidden="true" />
      <section id="gear" className="gutter scroll-mt-24 py-24 md:py-32" aria-labelledby="gear-h">
        <div className="mx-auto max-w-[1400px]">
          <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-6">
            <div>
              <span className="eyebrow">Gear · live now</span>
              <h2 id="gear-h" className="display mt-4 text-[clamp(40px,6vw,84px)]">Shop the drop</h2>
            </div>
            <p className="max-w-[40ch] text-dim">Compression and lifting gear, ready to ship.{free ? ` Free shipping over ${inr(free)}.` : ""}</p>
          </Reveal>
          <Suspense fallback={<RailSkeleton />}>
            <Gear />
          </Suspense>
        </div>
      </section>

      <section id="scent" className="gutter scroll-mt-24 border-y border-line bg-surface py-24 md:py-32" aria-labelledby="scent-h">
        <div className="mx-auto grid max-w-[1400px] items-center gap-12 md:grid-cols-[1fr_1.1fr]">
          <Reveal>
            <span className="eyebrow">Scent · in development</span>
            <h2 id="scent-h" className="display mt-4 text-[clamp(44px,7vw,104px)]">Wear your<br /><span className="text-rust">ego.</span></h2>
            <p className="mt-5 max-w-[44ch] text-dim">BOLD eau de parfum, in 30 and 100 ml. Ruby juice in clear glass, with the three arms of the E as the cap. Join the list to hear when it&apos;s ready.</p>
            <div className="mt-8 max-w-[560px]"><WaitlistForm product="bold" label="Notify me" /></div>
            <a href="/bold" className="mono mt-6 inline-block text-xs font-bold uppercase tracking-[0.12em] text-dim underline decoration-rust underline-offset-4 hover:text-bone">Meet BOLD →</a>
          </Reveal>
          <Reveal delay={0.1} className="relative">
            <Image src="/img/bold-pack.webp" alt="BOLD in its rigid box with the red WEAR YOUR EGO flap, next to the 30 ml bottle and boxes" width={1800} height={1227} sizes="(min-width: 768px) 50vw, 100vw" className="fade-edges h-auto w-full" />
          </Reveal>
        </div>
      </section>

      <Manifesto />
    </>
  );
}

async function Gear() {
  const { products, categories } = await getCatalog();
  return <GearRail products={products.filter(isGear)} categories={categories} />;
}

function RailSkeleton() {
  return (
    <div className="flex gap-4 overflow-hidden" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="aspect-[4/5] min-w-[78%] animate-pulse rounded-[2px] bg-surface sm:min-w-[44%] lg:min-w-[23.5%]" />
      ))}
    </div>
  );
}
