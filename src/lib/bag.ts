// The bag, shared with the product pages (/p/…) and the old store page: same localStorage key
// and line shape, so a bag filled on one page is the bag on every other page.
export type BagLine = { lineId: string; id: number; name: string; cat?: string; price: number; size: string; qty: number; image?: string | null };
export type Coupon = { code: string; discount: number; firstOrderOnly?: boolean };
export type ShopProduct = { id: number; name: string; cat: string; price: number; image: string | null; available: boolean };

const KEY = "egosynk_cart";
export const BAG_KEY = KEY;

function raw() {
  try { return localStorage.getItem(KEY) || sessionStorage.getItem(KEY) || "[]"; } catch { return "[]"; }
}

export function parseBag(s: string): BagLine[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.filter((l) => l && Number.isFinite(l.id) && l.qty > 0) : [];
  } catch {
    return [];
  }
}

export const readBag = () => parseBag(raw());

// For useSyncExternalStore: the saved bag as a string (stable between changes), updated by
// this tab's writes and by other tabs and product pages through the storage event.
const CHANGE = "egosynk-bag";
export function subscribeBag(cb: () => void) {
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) cb(); };
  addEventListener("storage", onStorage);
  addEventListener(CHANGE, cb);
  return () => { removeEventListener("storage", onStorage); removeEventListener(CHANGE, cb); };
}
export const bagSnapshot = raw;
export const bagServerSnapshot = () => "[]";

export function writeBag(lines: BagLine[]) {
  const s = JSON.stringify(lines);
  try { localStorage.setItem(KEY, s); } catch { try { sessionStorage.setItem(KEY, s); } catch { /* storage blocked */ } }
  dispatchEvent(new Event(CHANGE));
}

export const mediaUrl = (key: string) => `/media/${encodeURIComponent(key)}`;

// Display only: create-order recomputes all of this from its own prices. Free shipping is
// judged after the discount, the same rule as the server.
export function totals(lines: BagLine[], coupon: Coupon | null, ship: { fee: number; freeOver: number }) {
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const discount = coupon ? Math.min(coupon.discount, subtotal) : 0;
  const after = subtotal - discount;
  const shipping = lines.length === 0 || after >= ship.freeOver ? 0 : ship.fee;
  return { count: lines.reduce((s, l) => s + l.qty, 0), subtotal, discount, shipping, total: after + shipping, toFree: Math.max(0, ship.freeOver - after) };
}

export const STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir",
  "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

// Pincode → state, from India Post's zones (same table as the old store page). Zones shared by
// two states are left out on purpose: the state decides CGST+SGST vs IGST on the invoice.
const PIN_STATE: Record<number, string> = (() => {
  const m: Record<number, string> = {};
  const set = (from: number, to: number, state: string) => { for (let i = from; i <= to; i++) m[i] = state; };
  set(110, 110, "Delhi"); set(120, 136, "Haryana"); set(140, 159, "Punjab"); set(170, 177, "Himachal Pradesh");
  set(180, 193, "Jammu and Kashmir"); set(194, 194, "Ladakh"); set(200, 239, "Uttar Pradesh"); set(248, 249, "Uttarakhand");
  set(250, 259, "Uttar Pradesh"); set(263, 263, "Uttarakhand"); set(270, 285, "Uttar Pradesh"); set(301, 345, "Rajasthan");
  set(360, 395, "Gujarat"); set(400, 402, "Maharashtra"); set(403, 403, "Goa"); set(404, 445, "Maharashtra");
  set(450, 488, "Madhya Pradesh"); set(490, 497, "Chhattisgarh"); set(500, 509, "Telangana"); set(515, 535, "Andhra Pradesh");
  set(560, 591, "Karnataka"); set(600, 604, "Tamil Nadu"); set(606, 608, "Tamil Nadu"); set(610, 643, "Tamil Nadu");
  set(670, 695, "Kerala"); set(700, 736, "West Bengal"); set(737, 737, "Sikkim"); set(738, 743, "West Bengal");
  set(744, 744, "Andaman and Nicobar Islands"); set(751, 770, "Odisha"); set(781, 788, "Assam"); set(790, 792, "Arunachal Pradesh");
  set(793, 794, "Meghalaya"); set(795, 795, "Manipur"); set(796, 796, "Mizoram"); set(797, 798, "Nagaland"); set(799, 799, "Tripura");
  set(800, 813, "Bihar"); set(814, 816, "Jharkhand"); set(821, 821, "Bihar"); set(822, 835, "Jharkhand"); set(841, 855, "Bihar");
  return m;
})();

export function stateForPin(pin: string) {
  if (!/^\d{6}$/.test(pin)) return null;
  if (pin === "673310") return "Puducherry"; // Mahe
  if (+pin >= 682551 && +pin <= 682559) return "Lakshadweep";
  return PIN_STATE[+pin.slice(0, 3)] || null;
}
