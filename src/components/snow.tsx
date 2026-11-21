"use client";

import { useSyncExternalStore } from "react";

import { isFestive } from "@/lib/season";

// A light snowfall over the homepage hero during the Christmas season (src/lib/season.ts).
// Past that it renders nothing, so nothing needs undoing.

const noop = () => () => {};

// Decorative only: behind the slide copy (the copy sits at z-10), never takes clicks, and
// still for anyone who asks for reduced motion (globals.css).
export function Snow() {
  const on = useSyncExternalStore(noop, () => isFestive(Date.now()), () => false);
  if (!on) return null;
  return <div aria-hidden="true" className="snow pointer-events-none absolute inset-0 z-[5]" />;
}
