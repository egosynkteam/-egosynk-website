import Link from "next/link";
import { EMark, Wordmark } from "./logo";
import { legacy } from "@/lib/links";
import { CookieSettingsLink } from "./cookie-settings-link";
import { Year } from "./year";

const COLS: { title: string; links: [string, string][] }[] = [
  { title: "Shop", links: [["/hydro", "Fuel · HYDRO 150"], ["/#gear", "Gear"], ["/#scent", "Scent · BOLD"], [legacy.bulk, "Bulk orders"]] },
  { title: "Help", links: [["/batch", "Check your batch"], [legacy.shipping, "Shipping"], [legacy.returns, "Returns & exchanges"], [legacy.contact, "Contact"], [legacy.account, "Your account"]] },
  { title: "Legal", links: [[legacy.terms, "Terms"], [legacy.privacy, "Privacy"]] },
];

export function SiteFooter() {
  return (
    <footer className="gutter relative mt-24 overflow-hidden border-t border-line pb-10 pt-16">
      <EMark className="pointer-events-none absolute -bottom-24 -right-16 size-[420px] text-surface" accent="var(--color-rust-dim)" />
      <div className="relative mx-auto grid max-w-[1400px] gap-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="max-w-sm">
          <Wordmark />
          <p className="mt-4 text-sm leading-relaxed text-dim">Fuel, gear and scent for lifters who train past the point everyone else stops. Forged in Mumbai.</p>
        </div>
        {COLS.map((c) => (
          <div key={c.title}>
            <h2 className="eyebrow mb-4">{c.title}</h2>
            <ul className="space-y-2.5 text-sm">
              {c.links.map(([href, label]) => (
                <li key={href}>
                  {href.startsWith("/") && !href.includes(".html") && !href.startsWith("/#") ? (
                    <Link href={href} className="text-dim transition-colors hover:text-bone">{label}</Link>
                  ) : (
                    <a href={href} className="text-dim transition-colors hover:text-bone">{label}</a>
                  )}
                </li>
              ))}
              {c.title === "Legal" && (
                <li>
                  <CookieSettingsLink />
                </li>
              )}
            </ul>
          </div>
        ))}
      </div>
      <p className="mono relative mx-auto mt-14 max-w-[1400px] text-[11px] text-steel">© <Year />EGOSYNK.COM · GSTIN 27AKHPY6964E1ZI</p>
    </footer>
  );
}
