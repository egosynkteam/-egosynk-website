import type { Metadata } from "next";
import { Suspense } from "react";
import { BatchResults } from "@/components/batch-results";

// One page per batch code, opened by the QR on the tub. Results are fetched in the browser,
// so a batch published in the admin appears without a rebuild. Not for search engines.
export const metadata: Metadata = {
  title: "Batch lab report",
  robots: { index: false, follow: true },
};

async function Results({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <BatchResults code={decodeURIComponent(code).trim().toUpperCase().slice(0, 24)} />;
}

export default function BatchPage({ params }: { params: Promise<{ code: string }> }) {
  return (
    <section className="gutter pb-24 pt-32 md:pt-40">
      <div className="mx-auto max-w-6xl">
        <Suspense fallback={<div className="h-64 animate-pulse rounded-sharp bg-surface" aria-label="Loading batch" />}>
          <Results params={params} />
        </Suspense>
      </div>
    </section>
  );
}
