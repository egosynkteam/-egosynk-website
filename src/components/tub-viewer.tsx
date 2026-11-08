"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";

// three.js is about 6 seconds of work on a mid-range phone, so the page opens on the still
// render and only downloads the 3D viewer when someone asks for it.
const Tub3D = dynamic(() => import("./tub-3d").then((m) => m.Tub3D), { ssr: false, loading: () => <Still /> });

function Still() {
  return (
    <div className="relative aspect-[4/5] w-full">
      <Image src="/img/hydro-tub-34.webp" alt="HYDRO 150 pre-workout tub, Salted Nimbu, 420 g" fill priority sizes="(min-width: 768px) 45vw, 90vw" className="object-contain" />
    </div>
  );
}

export function TubViewer() {
  const [on, setOn] = useState(false);
  if (on) return <Tub3D />;
  return (
    <div className="relative">
      <Still />
      <button type="button" onClick={() => setOn(true)}
        className="chip absolute bottom-2 left-1/2 -translate-x-1/2 border border-line bg-ink/80 px-4 py-2.5 text-bone backdrop-blur transition-colors hover:border-dim">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 3v6h-6" /></svg>
        View in 3D
      </button>
    </div>
  );
}
