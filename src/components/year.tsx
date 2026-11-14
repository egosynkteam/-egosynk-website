"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

// The year is read in the browser, so the prerendered footer never goes stale. The server
// copy leaves it out rather than bake in the build year.
export function Year() {
  const year = useSyncExternalStore(noop, () => new Date().getFullYear(), () => null);
  return <>{year ? `${year} ` : ""}</>;
}
