"use client";

import { useSyncExternalStore } from "react";
import { track } from "./catalog-shared";

// The wishlist ("Saved"): product ids in localStorage for everyone, and on the account for
// signed-in customers (netlify/functions/wishlist). Same key as the product pages, so a heart
// set anywhere shows everywhere.
const KEY = "egosynk_saved";
const CHANGE = "egosynk-saved";

function raw() {
  try { return localStorage.getItem(KEY) || "[]"; } catch { return "[]"; }
}
function parse(s: string): number[] {
  try { const v = JSON.parse(s); return Array.isArray(v) ? v.filter(Number.isInteger) : []; } catch { return []; }
}
function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) cb(); };
  addEventListener("storage", onStorage);
  addEventListener(CHANGE, cb);
  return () => { removeEventListener("storage", onStorage); removeEventListener(CHANGE, cb); };
}
function write(ids: number[], push = true) {
  try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* storage blocked */ }
  dispatchEvent(new Event(CHANGE));
  if (push) fetch("/.netlify/functions/wishlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) }).catch(() => {});
}

/** The saved ids, as a string that only changes when the list does (stable for React). */
export function useSavedIds(): Set<number> {
  const s = useSyncExternalStore(subscribe, raw, () => "[]");
  return new Set(parse(s));
}

export function toggleSaved(p: { id: number; name: string; price: number }) {
  const ids = parse(raw());
  const on = !ids.includes(p.id);
  write(on ? [...ids, p.id] : ids.filter((x) => x !== p.id));
  track(on ? "add_to_wishlist" : "remove_from_wishlist", { items: [{ item_id: p.id, item_name: p.name, price: p.price }] });
}

/** Signed-in customers: merge the account's list with this browser's, both ways. Guests: no-op. */
export async function syncSaved() {
  try {
    const res = await fetch("/.netlify/functions/wishlist");
    if (!res.ok) return;
    const { ids, guest } = (await res.json()) as { ids: number[]; guest?: boolean };
    if (guest) return;
    const local = parse(raw());
    const merged = [...new Set([...local, ...ids])];
    if (merged.length !== local.length) write(merged, false);
    if (merged.length !== ids.length) write(merged, true);
  } catch { /* offline: keep the local list */ }
}
