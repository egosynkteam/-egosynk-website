import Image from "next/image";
import Link from "next/link";
import { Reveal } from "./reveal";
import { EMark } from "./logo";

const LINES = [
  { key: "fuel", n: "01", name: "Fuel", status: "Launching", live: false, href: "/hydro", cta: "HYDRO 150", body: "Pre-workout, EAA and the supplements we trust. Open labels, no proprietary blends.", img: "/img/hydro-tub-front.webp" },
  { key: "gear", n: "02", name: "Gear", status: "Live", live: true, href: "/#gear", cta: "Shop gear", body: "Compression wear, sleeves, belts and grips, built for load rather than looks.", img: null },
  { key: "scent", n: "03", name: "Scent", status: "In development", live: false, href: "/#scent", cta: "BOLD", body: "BOLD eau de parfum. Ruby juice, clear glass, and the E on the cap.", img: "/img/bold-pair.webp" },
];

export function Lines() {
  return (
    <section className="gutter py-24 md:py-32" aria-labelledby="lines-h">
      <div className="mx-auto max-w-[1400px]">
        <Reveal className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <div>
            <span className="eyebrow">One brand, three lines</span>
            <h2 id="lines-h" className="display mt-4 text-[clamp(40px,6vw,84px)]">Built for the<br />whole session</h2>
          </div>
          <p className="max-w-[40ch] text-dim">What you drink before it, what you wear through it, what you wear after it.</p>
        </Reveal>
        <div className="grid gap-px overflow-hidden rounded-[2px] border border-line bg-line md:grid-cols-3">
          {LINES.map((l, i) => (
            <Reveal key={l.key} delay={i * 0.08} className="bg-ink">
              <Link href={l.href} className="group relative flex h-full min-h-[440px] flex-col overflow-hidden p-7 md:min-h-[520px]">
                <div className="flex items-center justify-between">
                  <span className="mono text-xs text-rust-bright">{l.n}</span>
                  <span className={`chip ${l.live ? "bg-[#5fb98a]/15 text-[#7fd1a4]" : "border border-line text-dim"}`}>{l.status}</span>
                </div>
                <div className="relative my-6 flex flex-1 items-center justify-center">
                  {l.img ? (
                    <Image src={l.img} alt="" width={600} height={600} sizes="(min-width: 768px) 30vw, 80vw"
                      className="h-[240px] w-auto object-contain transition-transform duration-700 ease-out-expo group-hover:-translate-y-2 group-hover:scale-[1.04]" />
                  ) : (
                    <EMark className="h-[200px] w-auto text-surface-2 transition-transform duration-700 ease-out-expo group-hover:-translate-y-2 group-hover:scale-[1.04]" />
                  )}
                </div>
                <h3 className="display text-5xl">{l.name}</h3>
                <p className="mt-3 max-w-[34ch] text-sm leading-relaxed text-dim">{l.body}</p>
                <span className="mono mt-6 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em]">
                  {l.cta} <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                </span>
                <span className="absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-rust transition-transform duration-500 group-hover:scale-x-100" />
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
