import type { Metadata } from "next";
import Image from "next/image";
import { TubViewer } from "@/components/tub-viewer";
import { Reveal } from "@/components/reveal";
import { WaitlistForm } from "@/components/waitlist-form";
import { Faq } from "@/components/faq";
import { Marquee } from "@/components/marquee";
import { EMark } from "@/components/logo";
import { HYDRO } from "@/lib/hydro";

export const metadata: Metadata = {
  title: "HYDRO 150 pre-workout",
  description: "HYDRO 150: 150 mg caffeine, 8 g citrulline malate and 500 mg electrolytes in Salted Nimbu. No proprietary blends. Join the drop list.",
  alternates: { canonical: "/hydro" },
  openGraph: {
    url: "/hydro",
    title: "HYDRO 150 pre-workout · EGOSYNK",
    description: "150 mg caffeine, 8 g citrulline malate and 500 mg electrolytes in Salted Nimbu. Every gram printed. Join the drop list.",
    images: [{ url: "/img/og-hydro.jpg", width: 1200, height: 630, alt: "HYDRO 150 pre-workout by EGOSYNK" }],
  },
};

const FAQ: [string, string][] = [
  ["When does HYDRO 150 launch?", "The formula is with our manufacturer for testing. Join the drop list and we'll email you the launch date before it goes public, with early access."],
  ["How much will it cost?", "We'll publish the price with the launch date. The drop list hears it first."],
  ["Why 150 mg of caffeine?", "It's enough to feel the session without a crash for most lifters. A caffeine-free version and a stronger 200 mg version are planned, so you can pick your number."],
  ["What's in it, exactly?", "Every active and its dose is printed on this page and on the tub: no proprietary blends. The full ingredient list, allergens and FSSAI licence numbers will be on the label and here at launch."],
  ["Who shouldn't take it?", "Anyone under 18, pregnant or breastfeeding, or sensitive to caffeine. If you have a heart condition or high blood pressure, or take medication, check with a doctor first."],
];

export default function HydroPage() {
  return (
    <>
      <section className="gutter grain relative overflow-hidden pb-16 pt-28 md:pb-24 md:pt-32">
        <div className="absolute inset-0 bg-[radial-gradient(50%_60%_at_70%_45%,#3d0f16_0%,transparent_70%)]" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-[1400px] items-center gap-10 md:grid-cols-[1fr_1fr]">
          <Reveal>
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <span className="eyebrow">Fuel · pre-workout</span>
              <span className="chip border border-line text-dim"><span className="size-1.5 rounded-full bg-rust-bright" />Drop list open</span>
            </div>
            <h1 className="display text-[clamp(64px,12vw,176px)]">HYDRO<br /><span className="text-rust">150</span></h1>
            <p className="mt-6 max-w-[44ch] text-lg leading-relaxed text-dim">
              Pre-workout for Indian heat. {HYDRO.caffeine} mg caffeine for the mind, citrulline for the muscle, electrolytes for the water you lose. {HYDRO.flavour}, {HYDRO.servings} servings.
            </p>
            <dl className="mt-8 grid max-w-[480px] grid-cols-3 border-y border-line">
              {[["Caffeine", "150 mg"], ["Servings", String(HYDRO.servings)], ["Net wt", HYDRO.netWeight]].map(([k, v]) => (
                <div key={k} className="py-4 pr-4">
                  <dt className="mono text-[11px] uppercase tracking-[0.12em] text-steel">{k}</dt>
                  <dd className="display mt-1 text-2xl">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-9 flex flex-wrap gap-3">
              <a href="#drop" className="btn btn-primary">Join the drop →</a>
              <a href="#formula" className="btn btn-ghost">Every gram</a>
            </div>
          </Reveal>
          <Reveal delay={0.15} className="mx-auto w-full max-w-[min(520px,60dvh)]">
            <TubViewer />
          </Reveal>
        </div>
      </section>

      <Marquee tone="line" items={["Prime the ego", "No proprietary blends", "150 mg caffeine", "8 g citrulline malate", "500 mg electrolytes", "Salted Nimbu"]} />

      <section className="gutter py-24 md:py-32" aria-labelledby="arms-h">
        <div className="mx-auto max-w-[1400px]">
          <Reveal className="mb-14 max-w-[720px]">
            <span className="eyebrow">Mind · Muscle · Water</span>
            <h2 id="arms-h" className="display mt-4 text-[clamp(40px,6vw,84px)]">Three arms, three jobs</h2>
            <p className="mt-5 text-dim">The E on the tub has three arms. Each one stands for something the scoop does.</p>
          </Reveal>
          <div className="grid gap-px overflow-hidden rounded-[2px] border border-line bg-line md:grid-cols-3">
            {HYDRO.arms.map((a, i) => (
              <Reveal key={a.key} delay={i * 0.1} className="relative overflow-hidden bg-ink p-8">
                <EMark className="mb-10 h-16 w-auto text-surface-2" accent={i === 1 ? "var(--color-rust)" : "var(--color-surface-2)"} />
                <span className="mono text-xs text-rust-text">{String(i + 1).padStart(2, "0")} · {a.key}</span>
                <p className="display mt-3 text-[64px] leading-none">{a.stat}<span className="mono ml-2 align-top text-sm font-bold normal-case text-dim">{a.unit}</span></p>
                <h3 className="mt-6 text-xl font-semibold">{a.line}</h3>
                <p className="mt-2 text-dim">{a.detail}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="formula" className="gutter scroll-mt-24 border-y border-line bg-surface py-24 md:py-32" aria-labelledby="formula-h">
        <div className="mx-auto grid max-w-[1400px] gap-14 md:grid-cols-[1fr_1.1fr]">
          <Reveal>
            <span className="eyebrow">Every gram printed</span>
            <h2 id="formula-h" className="display mt-4 text-[clamp(40px,6vw,84px)]">No proprietary blends</h2>
            <p className="mt-5 max-w-[46ch] text-dim">Per scoop ({HYDRO.scoop}). This is the draft formula: final doses are confirmed after the manufacturer&apos;s lab testing, and the tub you receive will match the label.</p>
            <h3 className="mono mt-10 text-xs font-bold uppercase tracking-[0.14em] text-dim">How to use</h3>
            <ol className="mt-4 space-y-3">
              {HYDRO.use.map((u, i) => (
                <li key={u} className="flex gap-4"><span className="mono text-rust-text">{i + 1}</span><span>{u}</span></li>
              ))}
            </ol>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="rounded-[2px] border border-bone/80 bg-ink p-6 md:p-8">
              <div className="flex items-baseline justify-between border-b-8 border-bone pb-3">
                <p className="display text-3xl">Actives</p>
                <p className="mono text-xs uppercase text-dim">Per serving</p>
              </div>
              <table className="w-full text-[15px]">
                <tbody>
                  {HYDRO.actives.map(([k, v]) => (
                    <tr key={k} className="border-b border-line">
                      <td className={`py-3 ${k.startsWith("=") ? "pl-5 text-dim" : "font-medium"}`}>{k.replace(/^= /, "of which ")}</td>
                      <td className="mono py-3 text-right font-bold tabular-nums">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-5 text-[13px] leading-relaxed text-steel">{HYDRO.warning}</p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="gutter py-24 md:py-32" aria-labelledby="ladder-h">
        <div className="mx-auto max-w-[1400px]">
          <Reveal className="mb-12 flex flex-wrap items-end justify-between gap-6">
            <div>
              <span className="eyebrow">Pick your number</span>
              <h2 id="ladder-h" className="display mt-4 text-[clamp(40px,6vw,84px)]">Caffeine, your call</h2>
            </div>
            <p className="max-w-[40ch] text-dim">150 launches first. The other two follow once HYDRO 150 is out.</p>
          </Reveal>
          <div className="grid gap-4 md:grid-cols-3">
            {HYDRO.ladder.map((l, i) => (
              <Reveal key={l.mg} delay={i * 0.08}
                className={`rounded-[2px] border p-8 ${l.mg === 150 ? "border-rust bg-rust-dim/40" : "border-line"}`}>
                <span className={`chip ${l.mg === 150 ? "bg-rust text-bone" : "border border-line text-dim"}`}>{l.status}</span>
                <p className="display mt-8 text-[96px] leading-none">{l.mg}</p>
                <p className="mono mt-2 text-xs uppercase tracking-[0.12em] text-dim">mg caffeine · {l.label}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="gutter relative overflow-hidden border-y border-line bg-surface py-20" aria-labelledby="synk-h">
        <div className="mx-auto grid max-w-[1400px] items-center gap-10 md:grid-cols-2">
          <Reveal>
            <Image src="/img/synk.webp" alt="SYNK, the EGOSYNK character, mid-lift" width={1400} height={995} sizes="(min-width: 768px) 50vw, 100vw" className="h-auto w-full" />
          </Reveal>
          <Reveal delay={0.1}>
            <span className="eyebrow">Get in Synk</span>
            <h2 id="synk-h" className="display mt-4 text-[clamp(40px,6vw,84px)]">Meet SYNK</h2>
            <p className="mt-5 max-w-[46ch] text-dim">SYNK is the lifter on our launch campaign. You&apos;ll see a lot more of SYNK around the drop.</p>
          </Reveal>
        </div>
      </section>

      <section id="drop" className="gutter scroll-mt-24 py-24 md:py-32" aria-labelledby="drop-h">
        <div className="mx-auto grid max-w-[1400px] gap-12 md:grid-cols-[1fr_1.1fr]">
          <Reveal>
            <span className="eyebrow">Drop list</span>
            <h2 id="drop-h" className="display mt-4 text-[clamp(44px,7vw,104px)]">Be first<br />in <span className="text-rust">line</span></h2>
            <p className="mt-5 max-w-[44ch] text-dim">Get the launch date and price before anyone else, plus early access to the first batch.</p>
          </Reveal>
          <Reveal delay={0.1} className="rounded-[2px] border border-line bg-surface p-6 md:p-8">
            <WaitlistForm product="hydro-150" />
          </Reveal>
        </div>
      </section>

      <section className="gutter pb-8" aria-labelledby="faq-h">
        <div className="mx-auto max-w-[1000px]">
          <h2 id="faq-h" className="display mb-8 text-[clamp(32px,4vw,56px)]">Questions</h2>
          <Faq items={FAQ} />
        </div>
      </section>
    </>
  );
}
