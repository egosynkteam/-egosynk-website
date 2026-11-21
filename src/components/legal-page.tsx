import Link from "next/link";
import { EMark } from "./logo";
import { legacy } from "@/lib/links";

// The policy pages, in the order they appear in the side list.
const POLICIES: [string, string][] = [
  [legacy.shipping, "Shipping"],
  [legacy.returns, "Returns & exchanges"],
  [legacy.terms, "Terms"],
  [legacy.privacy, "Privacy"],
  [legacy.contact, "Contact & grievances"],
];

export const SELLER = "EGOSYNK · Dadar (W), Mumbai, Maharashtra 400028 · GSTIN 27AKHPY6964E1ZI";
export const SUPPORT_EMAIL = "support@egosynk.com";

// Shared frame for the shipping, returns, terms, privacy and contact pages: a short hero,
// the text in a readable column, and the other policies beside it.
export function LegalPage({ path, eyebrow, title, updated, intro, actions, children }: {
  path: string;
  eyebrow: string;
  title: React.ReactNode;
  updated: string;
  intro?: React.ReactNode;
  /** Buttons under the intro (kept out of the article, whose link styles would restyle them). */
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <section className="gutter grain relative overflow-hidden border-b border-line pb-14 pt-[calc(var(--header-h)+3.5rem)] md:pb-20 md:pt-[calc(var(--header-h)+5rem)]">
        <EMark className="pointer-events-none absolute -right-20 -top-10 hidden w-110 text-surface lg:block" accent="var(--color-rust-dim)" />
        <div className="relative page">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="display mt-4 max-w-4xl text-display-lg">{title}</h1>
          {intro && <p className="mt-6 max-w-[56ch] text-lead text-dim">{intro}</p>}
          {actions && <div className="mt-8 flex flex-wrap gap-3">{actions}</div>}
          <p className="mono mt-8 text-micro uppercase text-steel">Last updated · {updated}</p>
        </div>
      </section>
      <div className="gutter pt-12 md:pt-16">
        <div className="page grid gap-12 md:grid-cols-[13rem_minmax(0,44rem)] md:gap-16 lg:gap-24">
          <nav aria-label="Policies" className="order-last md:order-first">
            <div className="md:sticky md:top-[calc(var(--header-h)+2rem)]">
              <h2 className="eyebrow mb-4 text-steel">Policies</h2>
              <ul className="space-y-1 border-l border-line">
                {POLICIES.map(([href, label]) => {
                  const here = href === path;
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        aria-current={here ? "page" : undefined}
                        className={`-ml-px block border-l py-1.5 pl-4 text-small transition-colors ${here ? "border-rust text-bone" : "border-transparent text-dim hover:text-bone"}`}
                      >
                        {label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </nav>
          <article className="legal">
            {children}
            <p className="mono mt-14 border-t border-line pt-6 text-micro text-steel">
              {SELLER} · <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            </p>
          </article>
        </div>
      </div>
    </>
  );
}

export function Mail({ subject }: { subject?: string }) {
  const href = `mailto:${SUPPORT_EMAIL}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
  return <a href={href}>{SUPPORT_EMAIL}</a>;
}
