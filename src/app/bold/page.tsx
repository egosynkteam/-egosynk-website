import type { Metadata } from "next";
import Image from "next/image";
import { Reveal } from "@/components/reveal";
import { WaitlistForm } from "@/components/waitlist-form";
import { Faq } from "@/components/faq";
import { Marquee } from "@/components/marquee";
import { EMark } from "@/components/logo";
import { Countdown } from "@/components/countdown";
import { getCatalog } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "BOLD eau de parfum",
  description: "BOLD eau de parfum by EGOSYNK, in 30 and 100 ml. Ruby juice in clear glass, with the E as the cap. Scent notes and price revealed at launch. Join the list.",
  alternates: { canonical: "/bold" },
  openGraph: {
    url: "/bold",
    title: "BOLD eau de parfum · EGOSYNK",
    description: "Ruby juice, clear glass, and the three arms of the E on the cap. In 30 and 100 ml. Join the list to hear first.",
    images: [{ url: "/img/og-bold.jpg", width: 1200, height: 630, alt: "BOLD eau de parfum by EGOSYNK in 30 and 100 ml: ruby juice in clear glass with an E-shaped cap" }],
  },
};

// Only what's decided. Scent notes and prices stay "at launch" until the vendor confirms them.
const DETAILS = [
  { n: "01", title: "The E is the cap", body: "Three arms, the middle one in red. The same cap sits on both sizes, so the 30 ml looks like a scaled-down 100 ml, not a lesser bottle." },
  { n: "02", title: "Clear glass", body: "A rectangular bottle with nothing hiding the juice. What you see is what's left." },
  { n: "03", title: "Ruby juice", body: "The colour of the brand, inside the bottle. It reads as red from across the room." },
  { n: "04", title: "A gauge on the label", body: "A clear label marked in ml down the side, like a measuring cylinder. You always know how much ego you have left." },
];

const SIZES = [
  { ml: 30, label: "Carry", pack: "Soft-touch folding carton, printed red on the inside.", note: "Gym bag, desk drawer, travel." },
  { ml: 100, label: "Signature", pack: "Rigid flap box with a card insert. Open the flap and it says WEAR YOUR EGO. in red.", note: "The full bottle, and the full unboxing." },
];

const FAQ: [string, string][] = [
  ["When does BOLD launch?", "BOLD is in development with our perfumer. Join the list and we'll email you the launch date before it goes public."],
  ["What does it smell like?", "We're revealing the notes at launch, once the final formula is locked. The list hears it first."],
  ["How much will it cost?", "Prices for both sizes are published with the launch date."],
  ["30 ml or 100 ml?", "Same scent, same cap. The 30 ml is the one you carry; the 100 ml is the signature bottle in the rigid box."],
  ["Can I order it now?", "Not yet. Nothing ships until the first batch is made. Join the list and you'll get early access when it opens."],
  ["How should I use it?", "Spray on pulse points from about 15 cm. For external use only. Keep away from eyes, flames and children. Stop if your skin reacts."],
];

export default async function BoldPage() {
  const { settings } = await getCatalog();
  return (
    <>
      <section className="gutter grain relative overflow-hidden pb-16 pt-28 md:pb-24 md:pt-32">
        <div className="absolute inset-0 bg-[radial-gradient(45%_60%_at_72%_50%,var(--color-rust-dim)_0%,transparent_70%)]" aria-hidden="true" />
        <div className="relative grid page items-center gap-10 md:grid-cols-[1.1fr_1fr]">
          <Reveal>
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <span className="eyebrow">Scent · eau de parfum</span>
              <span className="chip border border-line text-dim"><span className="size-1.5 rounded-full bg-rust-bright" />In development</span>
            </div>
            <h1 className="display text-display-xl">Wear<br />your <span className="text-rust">ego.</span></h1>
            <p className="mt-6 max-w-[44ch] text-lg leading-relaxed text-dim">
              BOLD is the EGOSYNK eau de parfum. Ruby juice in clear glass, with the three arms of the E as the cap. In 30 and 100 ml.
            </p>
            <dl className="mt-8 grid max-w-lg grid-cols-3 border-y border-line">
              {[["Type", "EDP"], ["Sizes", "30 · 100"], ["Notes", "At launch"]].map(([k, v]) => (
                <div key={k} className="py-4 pr-4">
                  <dt className="mono text-micro uppercase tracking-[0.12em] text-steel">{k}</dt>
                  <dd className="display mt-1 text-2xl">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-9 flex flex-wrap gap-3">
              <a href="#drop" className="btn btn-primary">Notify me →</a>
              <a href="#bottle" className="btn btn-ghost">The bottle</a>
            </div>
            <Countdown launch={settings.launch} path="/bold" className="mt-8" />
          </Reveal>
          <Reveal delay={0.15} className="mx-auto w-full max-w-[min(30rem,62dvh)]">
            <Image src="/img/bold-100.webp" alt="BOLD eau de parfum, 100 ml: a clear rectangular bottle of ruby juice with a black E-shaped cap" width={1200} height={1500}
              sizes="(min-width: 768px) 40vw, 90vw" priority className="fade-edges h-auto w-full" />
          </Reveal>
        </div>
      </section>

      <Marquee tone="line" items={["Wear your ego", "Eau de parfum", "30 ml · 100 ml", "Ruby in clear glass", "The E on the cap", "Notes at launch"]} />

      <section id="bottle" className="gutter scroll-mt-24 py-24 md:py-32" aria-labelledby="bottle-h">
        <div className="page">
          <Reveal className="mb-14 max-w-3xl">
            <span className="eyebrow">The bottle</span>
            <h2 id="bottle-h" className="display mt-4 text-display-lg">Built like the brand</h2>
            <p className="mt-5 text-dim">No gold, no curves, no crystal. A block of glass and the E, the same mark that&apos;s on the tub and the tee.</p>
          </Reveal>
          <div className="grid items-center gap-12 md:grid-cols-[1.15fr_1fr]">
            <Reveal>
              <Image src="/img/bold-pair.webp" alt="BOLD in 100 ml and 30 ml side by side, both with the same E cap and an ml gauge on the label" width={1600} height={1200}
                sizes="(min-width: 768px) 55vw, 100vw" className="fade-edges h-auto w-full" />
            </Reveal>
            <div className="grid gap-px overflow-hidden rounded-sharp border border-line bg-line">
              {DETAILS.map((d, i) => (
                <Reveal key={d.n} delay={i * 0.08} className="bg-ink p-6 md:p-7">
                  <span className="mono text-xs text-rust-text">{d.n}</span>
                  <h3 className="mt-2 text-xl font-semibold">{d.title}</h3>
                  <p className="mt-2 text-dim">{d.body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="gutter border-y border-line bg-surface py-24 md:py-32" aria-labelledby="sizes-h">
        <div className="page">
          <Reveal className="mb-12 flex flex-wrap items-end justify-between gap-6">
            <div>
              <span className="eyebrow">Two sizes</span>
              <h2 id="sizes-h" className="display mt-4 text-display-lg">Same scent, your size</h2>
            </div>
            <p className="max-w-[40ch] text-dim">Both launch together. Prices are announced with the launch date.</p>
          </Reveal>
          <div className="grid gap-4 md:grid-cols-2">
            {SIZES.map((s, i) => (
              <Reveal key={s.ml} delay={i * 0.08}
                className={`relative overflow-hidden rounded-sharp border p-8 md:p-10 ${s.ml === 100 ? "border-rust bg-rust-dim/40" : "border-line bg-ink"}`}>
                <EMark className="pointer-events-none absolute -bottom-8 -right-8 hidden h-36 sm:block w-auto text-surface-2 opacity-60" accent={s.ml === 100 ? "var(--color-rust)" : "var(--color-surface-2)"} />
                <span className={`chip relative ${s.ml === 100 ? "bg-rust text-bone" : "border border-line text-dim"}`}>{s.label}</span>
                <p className="display relative mt-8 text-stat leading-none">{s.ml}<span className="mono ml-2 align-top text-base font-bold normal-case text-dim">ml</span></p>
                <p className="relative mt-6 text-lg font-semibold">{s.pack}</p>
                <p className="relative mt-2 text-dim">{s.note}</p>
                <p className="mono relative mt-8 border-t border-line pt-4 text-xs uppercase tracking-[0.12em] text-steel">Price · at launch</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="gutter py-24 md:py-32" aria-labelledby="unbox-h">
        <div className="page">
          <Reveal className="mb-10 max-w-3xl">
            <span className="eyebrow">Unboxing</span>
            <h2 id="unbox-h" className="display mt-4 text-display-lg">Open the <span className="text-rust">flap</span></h2>
            <p className="mt-5 text-dim">Black outside, red inside. The 100 ml box opens like a book onto WEAR YOUR EGO., with the bottle held in a card insert. The 30 ml carton is printed red on the inside, so even the small one has a reveal.</p>
          </Reveal>
          <Reveal delay={0.1}>
            <Image src="/img/bold-pack.webp" alt="The 100 ml BOLD bottle in its open rigid box with the red WEAR YOUR EGO flap, the 30 ml bottle, and both closed boxes" width={1800} height={1227}
              sizes="(min-width: 1400px) 1400px, 100vw" className="fade-edges h-auto w-full" />
          </Reveal>
        </div>
      </section>

      <section className="gutter border-y border-line bg-surface py-24 md:py-32" aria-labelledby="notes-h">
        <div className=" grid page gap-12 md:grid-cols-[1fr_1.1fr]">
          <Reveal>
            <span className="eyebrow">The scent</span>
            <h2 id="notes-h" className="display mt-4 text-display-lg">Revealed at launch</h2>
            <p className="mt-5 max-w-[44ch] text-dim">We&apos;ll publish the full pyramid when the formula is final. The list gets it first.</p>
          </Reveal>
          <Reveal delay={0.1}>
            <ul className="divide-y divide-line border-y border-line">
              {["Top", "Heart", "Base"].map((t) => (
                <li key={t} className="flex items-center justify-between gap-6 py-6">
                  <span className="display text-3xl">{t}</span>
                  <span className="mono flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-steel">
                    <span className="h-2 w-24 rounded-full bg-line" aria-hidden="true" />At launch
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      <section id="drop" className="gutter scroll-mt-24 py-24 md:py-32" aria-labelledby="drop-h">
        <div className=" grid page gap-12 md:grid-cols-[1fr_1.1fr]">
          <Reveal>
            <span className="eyebrow">Drop list</span>
            <h2 id="drop-h" className="display mt-4 text-display-md">Smell it<br /><span className="text-rust">first</span></h2>
            <p className="mt-5 max-w-[44ch] text-dim">Get the notes, the price and the launch date before anyone else, plus early access to the first batch.</p>
          </Reveal>
          <Reveal delay={0.1} className="rounded-sharp border border-line bg-surface p-6 md:p-8">
            <WaitlistForm product="bold" label="Notify me" />
          </Reveal>
        </div>
      </section>

      <section className="gutter pb-8" aria-labelledby="faq-h">
        <div className="mx-auto max-w-5xl">
          <h2 id="faq-h" className="display mb-8 text-display-sm">Questions</h2>
          <Faq items={FAQ} />
        </div>
      </section>
    </>
  );
}
