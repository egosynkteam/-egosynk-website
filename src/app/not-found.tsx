import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Not found", robots: { index: false } };

// Any address that doesn't exist, and products that were removed (/p/… calls notFound()).
export default function NotFound() {
  return (
    <section className="gutter grain relative grid min-h-[min(80dvh,46rem)] place-items-center overflow-hidden pb-24 pt-[calc(var(--header-h)+3rem)] text-center">
      <div className="page relative">
        <p className="eyebrow">404</p>
        <h1 className="display mt-4 text-display-lg">Missed <span className="text-rust">the rep.</span></h1>
        <p className="mx-auto mt-5 max-w-md text-dim">This page isn&apos;t here any more. The product may have sold out for good or moved.</p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link href="/#gear" className="btn btn-primary">Shop gear →</Link>
          <Link href="/" className="btn btn-ghost">Home</Link>
        </div>
      </div>
    </section>
  );
}
