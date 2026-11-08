import Image from "next/image";
import { Reveal } from "./reveal";
import { inr, type Bundle } from "@/lib/catalog-shared";
import { legacy } from "@/lib/links";

// Shown until the live catalog serves bundles from admin → Bundles (same placeholders).
export const FALLBACK_BUNDLES: Bundle[] = [
  { id: "synk-pack", name: "Synk Pack", tagline: "Try it before the tub", items: ["5 × HYDRO 150 single-serve sachets (14 g)"], price: 299, mrp: null, priceFinal: false, art: "sachets", status: "coming" },
  { id: "hydro-starter", name: "HYDRO Starter", tagline: "Tub and shaker", items: ["HYDRO 150 · 420 g, 30 servings", "EGOSYNK shaker"], price: 1799, mrp: 1998, priceFinal: false, art: "tub-shaker", status: "coming" },
  { id: "lift-stack", name: "Lift Stack", tagline: "Fuel and gear for heavy day", items: ["HYDRO 150 · 420 g, 30 servings", "EGOSYNK shaker", "Steel Core Lifting Belt 10 mm"], price: 4199, mrp: 4497, priceFinal: false, art: "stack", status: "coming" },
];

function Sachets() {
  // Five stick packs in a slightly staggered row: drawn rather than rendered, since there is
  // no sachet artwork yet.
  return (
    <svg viewBox="0 0 260 210" className="h-full w-auto" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => {
        const x = 18 + i * 46;
        const lift = [10, 0, 6, 0, 12][i];
        const tilt = [-5, -2, 0, 2, 5][i];
        return (
          <g key={i} transform={`rotate(${tilt} ${x + 20} 205) translate(${x} ${18 + lift})`}>
            <rect width="40" height="180" rx="3" fill="#141518" stroke="#34353a" strokeWidth="1.5" />
            <rect width="40" height="12" fill="#26272b" />
            <rect y="168" width="40" height="12" fill="#26272b" />
            <path d="M0 6h40M0 174h40" stroke="#3a3b40" strokeDasharray="2 3" />
            <text x="20" y="96" fill="#edeae3" fontFamily="Archivo Black, Arial Black, sans-serif" fontSize="15" textAnchor="middle" transform="rotate(-90 20 96)">HYDRO</text>
            <rect x="6" y="128" width="28" height="14" fill="#c41e3a" />
            <text x="20" y="139" fill="#edeae3" fontFamily="monospace" fontWeight="700" fontSize="10" textAnchor="middle">150</text>
          </g>
        );
      })}
    </svg>
  );
}

function Art({ art }: { art: Bundle["art"] }) {
  if (art === "sachets") return <Sachets />;
  return (
    <div className="relative h-full w-full">
      <Image src="/img/hydro-tub-34.webp" alt="" fill sizes="(min-width: 768px) 30vw, 80vw"
        className={`object-contain ${art === "tub" ? "" : "-translate-x-[14%]"}`} />
      {art !== "tub" && (
        <Image src="/img/shaker.webp" alt="" width={232} height={732} sizes="120px"
          className="absolute bottom-0 right-[14%] h-[86%] w-auto object-contain drop-shadow-[0_10px_30px_rgba(0,0,0,.6)]" />
      )}
      {art === "stack" && <span className="chip absolute left-2 top-2 bg-rust text-bone">+ Lifting belt</span>}
    </div>
  );
}

export function Bundles({ bundles }: { bundles: Bundle[] }) {
  if (!bundles.length) return null;
  const indicative = bundles.some((b) => !b.priceFinal);
  return (
    <section id="bundles" className="gutter scroll-mt-24 py-24 md:py-32" aria-labelledby="bundles-h">
      <div className="mx-auto max-w-[1400px]">
        <Reveal className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <div>
            <span className="eyebrow">Launch bundles</span>
            <h2 id="bundles-h" className="display mt-4 text-[clamp(40px,6vw,84px)]">Start your stack</h2>
          </div>
          <p className="max-w-[40ch] text-dim">
            Try HYDRO with the trial pack, or start with the tub and shaker.
            {indicative && " Prices marked indicative are confirmed at launch, and the drop list hears them first."}
          </p>
        </Reveal>
        <div className="grid gap-4 md:grid-cols-3">
          {bundles.map((b, i) => {
            const save = b.mrp && b.mrp > b.price ? b.mrp - b.price : 0;
            const live = b.status === "live" && b.productSlug;
            return (
              <Reveal key={b.id} delay={i * 0.08}
                className={`flex flex-col rounded-[2px] border p-6 ${b.art === "tub-shaker" ? "border-rust bg-rust-dim/30" : "border-line bg-surface"}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className={`chip ${live ? "bg-[#5fb98a]/15 text-[#7fd1a4]" : "border border-line text-dim"}`}>{live ? "Available now" : "At launch"}</span>
                  {save > 0 && <span className="chip bg-rust text-bone">Save {inr(save)}</span>}
                </div>
                <div className="relative my-6 flex h-[220px] items-center justify-center"><Art art={b.art} /></div>
                <h3 className="display text-3xl">{b.name}</h3>
                {b.tagline && <p className="mt-1 text-sm text-dim">{b.tagline}</p>}
                <ul className="mt-5 flex-1 space-y-2 text-[15px]">
                  {b.items.map((it) => (
                    <li key={it} className="flex gap-3"><span className="mt-[9px] h-px w-3 shrink-0 bg-rust" aria-hidden="true" />{it}</li>
                  ))}
                </ul>
                <div className="mt-6 flex items-baseline gap-3">
                  <span className="display text-4xl">{inr(b.price)}</span>
                  {b.mrp && b.mrp > b.price && <span className="mono text-sm text-steel line-through">{inr(b.mrp)}</span>}
                </div>
                {!b.priceFinal && <p className="mono mt-1 text-[11px] uppercase tracking-[0.12em] text-steel">Indicative price</p>}
                {live ? (
                  <a href={legacy.product(b.productSlug!)} className="btn btn-primary mt-6">Shop {b.name} →</a>
                ) : (
                  <a href="#drop" className="btn btn-ghost mt-6">Join the drop for this →</a>
                )}
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
