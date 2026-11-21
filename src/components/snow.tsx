"use client";

import { useSyncExternalStore } from "react";

// The Christmas season on the storefront: a light snowfall over the homepage hero, from now
// until Boxing Day night (IST). Past that it renders nothing, so nothing needs undoing.
const SEASON = { from: Date.parse("2026-11-22T00:00:00+05:30"), to: Date.parse("2026-12-26T23:59:59+05:30") };
export const isFestive = (now: number) => now >= SEASON.from && now <= SEASON.to;

const noop = () => () => {};

// Decorative only: behind the slide copy (the copy sits at z-10), never takes clicks, and
// still for anyone who asks for reduced motion (globals.css).
export function Snow() {
  const on = useSyncExternalStore(noop, () => isFestive(Date.now()), () => false);
  if (!on) return null;
  return <div aria-hidden="true" className="snow pointer-events-none absolute inset-0 z-[5]" />;
}
