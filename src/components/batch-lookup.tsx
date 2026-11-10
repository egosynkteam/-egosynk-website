"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Type the code printed on the tub to open its lab results.
export function BatchLookup({ initial = "" }: { initial?: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initial);
  const clean = code.trim().toUpperCase();
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (clean) router.push(`/batch/${encodeURIComponent(clean)}`); }}
      className="flex flex-wrap gap-3"
    >
      <label htmlFor="batch-code" className="sr-only">Batch code</label>
      <input id="batch-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. H150-2702-01" autoComplete="off"
        autoCapitalize="characters" spellCheck={false} maxLength={24}
        className="mono h-13 min-w-0 flex-1 basis-56 rounded-sharp border border-line bg-ink px-4 uppercase tracking-[0.08em] text-bone placeholder:normal-case placeholder:tracking-normal placeholder:text-steel focus:border-dim focus:outline-none" />
      <button type="submit" className="btn btn-primary" disabled={!clean}>Check batch →</button>
    </form>
  );
}
