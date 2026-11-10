"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { BatchLookup } from "./batch-lookup";

type Result = { test: string; label: string; found: string; ok: boolean };
type Batch = {
  code: string; productName: string; mfg: string; expiry: string; lab: string; reportDate: string;
  results: Result[]; notes: string; reportUrl: string | null;
};
type State = { kind: "loading" } | { kind: "found"; batch: Batch } | { kind: "missing" } | { kind: "error"; message: string };

const month = (m: string) => (m ? new Date(`${m}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "");
const day = (d: string) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "");

// Loaded in the browser from the get-batch function on the same site, so a batch published
// in the admin shows here straight away.
export function BatchResults({ code }: { code: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let live = true;
    fetch(`/.netlify/functions/get-batch?code=${encodeURIComponent(code)}`)
      .then(async (r) => {
        if (!live) return;
        if (r.status === 404) return setState({ kind: "missing" });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) return setState({ kind: "error", message: data.error || "Couldn't load this batch. Try again in a minute." });
        setState({ kind: "found", batch: data.batch });
      })
      .catch(() => live && setState({ kind: "error", message: "Couldn't load this batch. Check your connection and try again." }));
    return () => { live = false; };
  }, [code]);

  if (state.kind === "loading") {
    return <div className="space-y-3" aria-busy="true" aria-label="Loading batch">{[0, 1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-sharp bg-surface" />)}</div>;
  }
  if (state.kind !== "found") {
    return (
      <div className="max-w-2xl">
        <h1 className="display text-display-lg">{state.kind === "missing" ? "Batch not found" : "Something went wrong"}</h1>
        <p className="mt-4 text-dim">
          {state.kind === "missing"
            ? <>We don&apos;t have results for <span className="mono text-bone">{code}</span> yet. Check the code on the base of the tub, or the label next to “Batch”. Results go up when the lab report for the batch is in.</>
            : state.message}
        </p>
        <div className="mt-8"><BatchLookup initial={code} /></div>
      </div>
    );
  }

  const b = state.batch;
  const passed = b.results.filter((r) => r.ok).length;
  const allPass = b.results.length > 0 && passed === b.results.length;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="eyebrow">Batch lab report</span>
        {b.results.length > 0 && (
          <span className={`chip ${allPass ? "bg-ok/15 text-ok-bright" : "border border-line text-dim"}`}>
            {allPass ? "All tests passed" : `${passed} of ${b.results.length} passed`}
          </span>
        )}
      </div>
      <h1 className="display mt-4 text-display-md">{b.productName}</h1>
      <p className="mono mt-3 text-lg tracking-[0.08em] text-rust-text">BATCH {b.code}</p>

      <dl className="mt-8 grid max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-sharp border border-line bg-line sm:grid-cols-4">
        {[["Manufactured", month(b.mfg)], ["Best before", month(b.expiry)], ["Tested by", b.lab || "—"], ["Report date", day(b.reportDate) || "—"]].map(([k, v]) => (
          <div key={k} className="min-w-0 bg-ink p-4">
            <dt className="mono text-micro uppercase tracking-[0.12em] text-steel">{k}</dt>
            <dd className="mt-1 break-words font-semibold">{v}</dd>
          </div>
        ))}
      </dl>

      {b.results.length > 0 && (
        <div className="mt-10 overflow-x-auto rounded-sharp border border-line">
          <table className="w-full min-w-130 text-body">
            <thead>
              <tr className="mono border-b border-line text-left text-micro uppercase tracking-[0.12em] text-steel">
                <th className="p-4 font-bold">Test</th><th className="p-4 font-bold">On the label</th><th className="p-4 font-bold">Lab found</th><th className="p-4 text-right font-bold">Result</th>
              </tr>
            </thead>
            <tbody>
              {b.results.map((r, i) => (
                <motion.tr key={`${r.test}-${i}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.04 }}
                  className="border-b border-line last:border-0">
                  <td className="p-4 font-medium">{r.test}</td>
                  <td className="mono p-4 text-dim">{r.label || "—"}</td>
                  <td className="mono p-4 font-bold">{r.found || "—"}</td>
                  <td className="p-4 text-right">
                    <span className={`chip ${r.ok ? "bg-ok/15 text-ok-bright" : "bg-rust-dim text-rust-text"}`}>{r.ok ? "Pass" : "Fail"}</span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {b.notes && <p className="mt-6 max-w-[68ch] text-dim">{b.notes}</p>}

      <div className="mt-10 flex flex-wrap gap-3">
        {b.reportUrl && <a href={b.reportUrl} target="_blank" rel="noopener" className="btn btn-primary">Read the full lab report (PDF) →</a>}
        <a href="/hydro" className="btn btn-ghost">About {b.productName}</a>
      </div>
    </div>
  );
}
