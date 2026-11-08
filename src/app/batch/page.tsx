import type { Metadata } from "next";
import { BatchLookup } from "@/components/batch-lookup";
import { EMark } from "@/components/logo";

export const metadata: Metadata = {
  title: "Check your batch",
  description: "Every EGOSYNK supplement batch is lab tested. Enter the batch code from your tub to see what the lab measured.",
  alternates: { canonical: "/batch" },
};

export default function BatchHome() {
  return (
    <section className="gutter grain relative overflow-hidden pb-24 pt-32 md:pt-40">
      <EMark className="pointer-events-none absolute -right-24 top-24 hidden w-[520px] text-surface md:block" accent="var(--color-rust-dim)" />
      <div className="relative mx-auto max-w-[1400px]">
        <span className="eyebrow">Lab tested, batch by batch</span>
        <h1 className="display mt-4 max-w-[900px] text-[clamp(48px,9vw,128px)]">Check your <span className="text-rust">batch</span></h1>
        <p className="mt-6 max-w-[52ch] text-lg text-dim">
          Every batch of EGOSYNK fuel goes to a lab before it ships. Scan the QR code on your tub, or type the batch code printed next to “Batch” on the label, to see what the lab measured against what we printed.
        </p>
        <div className="mt-10 max-w-[620px]"><BatchLookup /></div>
      </div>
    </section>
  );
}
