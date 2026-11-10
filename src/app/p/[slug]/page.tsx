import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { getCatalog } from "@/lib/catalog";
import { getProduct, percentOff, type PdpProduct, type ProductResult } from "@/lib/product";
import { mediaUrl } from "@/lib/bag";
import { inr } from "@/lib/catalog-shared";
import { JsonLd } from "@/components/json-ld";
import { ProductView } from "@/components/product/product-view";
import { Reviews } from "@/components/product/reviews";
import { Reveal } from "@/components/reveal";

const SITE = "https://egosynk.com";

// Every product in the live catalog is prerendered at build time; one added later renders on
// its first visit and is cached from then on.
export async function generateStaticParams() {
  const { products } = await getCatalog();
  // Cache Components needs at least one entry; an unknown slug simply renders "not found".
  return products.length ? products.map((p) => ({ slug: p.slug })) : [{ slug: "product-0" }];
}

export async function generateMetadata({ params }: PageProps<"/p/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const r = await getProduct(slug);
  if (r.kind !== "ok") return { title: "Product not found", robots: { index: false } };
  const { product: p, category } = r.data;
  const description = (p.description || `${p.name} by EGOSYNK: ${category ? category.name : "training gear"} built for lifters.`).replace(/\s+/g, " ").slice(0, 160);
  const image = p.images?.[0] ? `${SITE}${mediaUrl(p.images[0])}` : `${SITE}/img/og-home.jpg`;
  return {
    title: p.name,
    description,
    alternates: { canonical: `/p/${p.slug}` },
    openGraph: { type: "website", url: `/p/${p.slug}`, title: `${p.name} · ${inr(p.price)}`, description, images: [{ url: image, alt: p.name }] },
    other: { "product:price:amount": String(p.price), "product:price:currency": "INR" },
  };
}

function Product({ r }: { r: Exclude<ProductResult, { kind: "redirect" } | { kind: "missing" }> }) {
  if (r.kind === "error") {
    return (
      <div className="py-24 text-center">
        <p className="display text-display-sm">Couldn&apos;t load this product</p>
        <p className="mt-4 text-dim">Refresh in a minute, or <Link href="/#gear" className="underline decoration-rust underline-offset-4">browse the gear</Link>.</p>
      </div>
    );
  }
  const { data } = r;
  return (
    <>
      {data.ld && <JsonLd data={data.ld} />}
      <ProductView data={data} />
      <Reviews productId={data.product.id} reviews={data.reviews} rating={data.product.rating ?? null} />
      {data.related.length > 0 && <Related items={data.related} title={`More in ${data.category?.name || "the drop"}`} />}
    </>
  );
}

function Related({ items, title }: { items: PdpProduct[]; title: string }) {
  return (
    <section aria-labelledby="related-h" className="border-t border-line py-16 md:py-24">
      <h2 id="related-h" className="display mb-8 text-display-sm">{title}</h2>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {items.map((p, i) => {
          const off = percentOff(p);
          return (
            <li key={p.id} className="min-w-0">
              <Reveal delay={i * 0.06}>
                <Link href={`/p/${p.slug}`} className="group block">
                  <div className="grid aspect-[4/5] place-items-center overflow-hidden rounded-sharp border border-line bg-surface">
                    {p.images?.[0]
                      // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded photo served by the media function
                      ? <img src={mediaUrl(p.images[0])} alt={p.name} loading="lazy" decoding="async" className="size-full object-cover transition-transform duration-700 ease-out-expo group-hover:scale-[1.04]" />
                      : <span className="mono text-small text-steel">ES</span>}
                  </div>
                  <p className="mt-3 line-clamp-2 font-semibold leading-snug">{p.name}</p>
                  <p className="mono mt-1 text-small">
                    <span className="font-bold">{inr(p.price)}</span>
                    {off > 0 && <><span className="ml-2 text-steel line-through">{inr(p.mrp!)}</span><span className="ml-2 text-ok-bright">{off}% off</span></>}
                  </p>
                </Link>
              </Reveal>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// The product is resolved before anything is sent, so a renamed product answers with a real
// 308 + Location and a removed one with a real 404 for every visitor and link-preview bot.
// (Streaming the page first would fix the status at 200.) Listed products are prerendered,
// so this only waits on the first visit to a new or old URL.
export default async function ProductPage(props: PageProps<"/p/[slug]">) {
  const { slug } = await props.params;
  const r = await getProduct(slug);
  if (r.kind === "redirect") permanentRedirect(`/p/${r.slug}`);
  if (r.kind === "missing") notFound();
  return (
    <section className="gutter pb-24 pt-[calc(var(--header-h)+1.5rem)] md:pt-[calc(var(--header-h)+2.5rem)]">
      <div className="page">
        <Product r={r} />
      </div>
    </section>
  );
}
