"use client";

import { useEffect, useRef, useState } from "react";
import { CM_PER_IN, left, measuredColumns, sizeFor, type PdpProduct, type SizeGuide } from "@/lib/product-shared";

// The size chart from admin → Size guides, with "Find my size" when the chart has measured
// (inch) columns. A native <dialog>: Escape closes it and focus stays inside.
export function SizeGuideDialog({ open, onClose, guide, product, onPick }: {
  open: boolean; onClose: () => void; guide: SizeGuide; product: PdpProduct; onPick: (size: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [unit, setUnit] = useState<"in" | "cm">("in");
  const [values, setValues] = useState<Record<number, string>>({});
  const cols = measuredColumns(guide);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const inches = Object.fromEntries(Object.entries(values).map(([k, v]) => { const n = parseFloat(v); return [k, n > 0 ? (unit === "cm" ? n / CM_PER_IN : n) : 0]; }));
  const result = sizeFor(guide, inches);
  const canPick = result && !("outside" in result) && product.sizes.includes(result.size) && left(product, result.size) > 0;

  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }} aria-labelledby="guide-h"
      className="m-auto max-h-[90dvh] w-[min(36rem,calc(100%-2rem))] overflow-y-auto rounded-sharp border border-line bg-surface p-0 text-bone backdrop:bg-black/70 backdrop:backdrop-blur-[2px]">
      <div className="p-5 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="guide-h" className="display text-display-sm">{guide.title}</h2>
            {guide.sub && <p className="mono mt-1 text-micro uppercase tracking-[0.12em] text-dim">{guide.sub}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close size guide" className="grid size-10 shrink-0 place-items-center rounded-sharp border border-line hover:border-dim pointer-coarse:size-11">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="2" /></svg>
          </button>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-body">
            <thead><tr className="border-b border-line">{guide.head.map((h) => <th key={h} scope="col" className="mono py-2 pr-4 text-left text-micro font-bold uppercase tracking-[0.1em] text-dim">{h}</th>)}</tr></thead>
            <tbody>
              {guide.rows.map((r) => (
                <tr key={r[0]} className={`border-b border-line ${result && !("outside" in result) && result.size === r[0] ? "bg-rust-dim/50" : ""}`}>
                  {r.map((c, i) => i === 0 ? <th key={i} scope="row" className="py-2.5 pr-4 text-left font-bold">{c}</th> : <td key={i} className="mono py-2.5 pr-4 tabular-nums">{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {cols.length > 0 && (
          <div className="mt-8 rounded-sharp border border-line bg-ink p-4">
            <h3 className="font-semibold">Find my size</h3>
            <p className="mt-1 text-small text-dim">Measure around the widest part, relaxed, with a soft tape.</p>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              {cols.map((c) => (
                <label key={c.i} className="grid min-w-0 flex-1 basis-32 gap-1.5">
                  <span className="mono text-micro uppercase tracking-[0.12em] text-dim">{c.label}</span>
                  <input type="number" inputMode="decimal" min="1" step="0.1" value={values[c.i] || ""} onChange={(e) => setValues((v) => ({ ...v, [c.i]: e.target.value }))}
                    className="h-11 w-full rounded-sharp border border-line bg-surface px-3 focus:border-dim focus:outline-none" />
                </label>
              ))}
              <div role="group" aria-label="Units" className="flex rounded-sharp border border-line">
                {(["in", "cm"] as const).map((u) => (
                  <button key={u} type="button" aria-pressed={unit === u} onClick={() => setUnit(u)}
                    className={`mono h-11 px-4 text-small font-bold uppercase ${unit === u ? "bg-bone text-ink" : "text-dim hover:text-bone"}`}>{u}</button>
                ))}
              </div>
            </div>
            <div aria-live="polite" className="mt-4 text-small">
              {result && ("outside" in result
                ? <p>That {result.label.toLowerCase()} is above our largest size. Email support@egosynk.com and we&apos;ll help.</p>
                : <>
                    <p>We suggest <b className="text-bone">{result.size}</b>{result.alt ? `. You're on the line, so ${result.alt} if you prefer a looser fit` : ""}.</p>
                    {canPick
                      ? <button type="button" onClick={() => onPick(result.size)} className="btn btn-primary mt-3">Select {result.size}</button>
                      : product.sizes.includes(result.size) && <p className="mt-2 text-dim">That size is sold out right now. Use &quot;Notify me&quot; below the sizes.</p>}
                  </>)}
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}
