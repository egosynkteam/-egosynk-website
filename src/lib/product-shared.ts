// Product page rules, shared by the page and its tests (tests/product.test.js runs this file
// directly in Node, so it imports nothing). Ported from product-template.html.

export type SizeGuide = { title: string; sub?: string; head: string[]; rows: string[][] };
export type Offer = { code: string; type: "percent" | "flat"; value: number; minSubtotal?: number; maxDiscount?: number | null; firstOrderOnly?: boolean; topBar?: boolean };
export type Review = { name: string; rating: number; title?: string; body: string; createdAt: string; size?: string; reply?: string };
export type PdpProduct = {
  id: number; name: string; cat: string; price: number; mrp?: number; tag?: string; sizes: string[]; images?: string[];
  available?: boolean; slug: string; colour?: string; description?: string; highlights?: string[];
  stockBySize?: Record<string, number>; rating?: { avg: number; count: number } | null;
  specs?: { fit?: string; fabric?: string; compression?: "light" | "medium" | "firm"; gsm?: number };
};
export type PdpData = {
  product: PdpProduct;
  category: { id: string; name: string } | null;
  related: PdpProduct[];
  reviews: Review[];
  sizeGuide: SizeGuide | null;
  settings: { shippingFee?: number; freeShippingThreshold?: number };
  offers?: Offer[];
  ld?: Record<string, unknown>;
};

export const isFreeSize = (p: PdpProduct) => p.sizes.length === 1 && /^free size$/i.test(p.sizes[0]);
// Units left in a size; Infinity when the admin doesn't track stock per size.
export const left = (p: PdpProduct, size: string) => (p.stockBySize && Number.isFinite(p.stockBySize[size]) ? p.stockBySize[size] : Infinity);
// Innerwear and socks: size exchange only with the hygiene seal intact (lib/exchanges.js).
export const isHygiene = (p: PdpProduct) => ["innerwear", "socks"].includes(p.cat);
export const soldOutSizes = (p: PdpProduct) => (isFreeSize(p) ? [] : p.sizes.filter((s) => left(p, s) <= 0));
// One-size products (Free Size, 50 ml…) start with that size picked, if it's in stock.
export const defaultSize = (p: PdpProduct) => (p.sizes.length === 1 && left(p, p.sizes[0]) > 0 ? p.sizes[0] : null);
export const percentOff = (p: { price: number; mrp?: number }) => (p.mrp && p.mrp > p.price ? Math.round((1 - p.price / p.mrp) * 100) : 0);
// Quantity cap: 10 a line, or what's left in the size.
export const maxQty = (p: PdpProduct, size: string | null) => (size ? Math.min(10, left(p, size)) : 10);

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
export function offerText(o: Offer) {
  const amount = o.type === "percent" ? `${o.value}% off` : `${inr(o.value)} off`;
  const scope = o.firstOrderOnly ? "your first order" : "your order";
  const min = o.minSubtotal ? ` over ${inr(o.minSubtotal)}` : "";
  const cap = o.type === "percent" && o.maxDiscount ? ` · up to ${inr(o.maxDiscount)}` : "";
  return `${amount} ${scope}${min}${cap}`;
}

export const COMPRESSION = { light: "Light compression", medium: "Medium compression", firm: "Firm compression" } as const;
export function specChips(p: PdpProduct) {
  const s = p.specs || {};
  return [s.fit, s.compression && COMPRESSION[s.compression], s.fabric, s.gsm ? `${Number(s.gsm)} GSM` : null].filter(Boolean) as string[];
}

// ---------- Size finder: measurement → size, from the chart's ranges ----------
// Measured columns are the ones whose header says inches, e.g. "Bicep (in)".
export function measuredColumns(g: SizeGuide) {
  return g.head.map((h, i) => ({ i, label: h.replace(/\s*\(in\)\s*/i, "") })).filter((c) => c.i > 0 && /\(in\)/i.test(g.head[c.i]));
}
const range = (cell: string): [number, number] | null => {
  const m = String(cell).match(/(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)/);
  return m ? [+m[1], +m[2]] : null;
};
export type FinderResult = { size: string; alt: string | null } | { outside: true; label: string } | null;
// For each measurement, the sizes whose range holds it; the pick is the largest size any
// measurement needs (so nothing is too tight). On a boundary (13 in for 11–13 / 13–15) both
// fit: name the snugger one and mention the other.
export function sizeFor(g: SizeGuide, values: Record<number, number>): FinderResult {
  let need = -1;
  let alt: number | null = null;
  for (const c of measuredColumns(g)) {
    const v = values[c.i];
    if (!(v > 0)) continue;
    const fits = g.rows.map((r, n) => [n, range(r[c.i])] as const).filter(([, rg]) => rg && v >= rg[0] && v <= rg[1]).map(([n]) => n);
    if (!fits.length) {
      // Between two sizes (chart gaps like 30 → 32) or below the smallest: the next size up.
      const up = g.rows.findIndex((r) => { const rg = range(r[c.i]); return !!rg && rg[0] > v; });
      if (up < 0) return { outside: true, label: c.label };
      need = Math.max(need, up);
      continue;
    }
    if (fits[0] > need) { need = fits[0]; alt = fits.length > 1 ? fits[1] : null; }
    else if (fits[0] === need && fits.length > 1) alt = fits[1];
  }
  if (need < 0) return null;
  return { size: g.rows[need][0], alt: alt != null && alt !== need ? g.rows[alt][0] : null };
}
export const CM_PER_IN = 2.54;

// ---------- Delivery estimate by pincode ----------
// No courier API yet, so this estimates from the pincode's region, shipping from Mumbai.
// Business days (Sundays skipped), including 1–2 days to dispatch, matching the shipping
// policy's "dispatched in 1–2, delivered in 3–7 business days".
const METRO_PREFIXES = ["110", "560", "600", "700", "500", "411", "380", "122", "201"];
export const isPincode = (pin: string) => /^[1-8]\d{5}$/.test(pin);
export function transitDays(pin: string) {
  const p3 = pin.slice(0, 3), p2 = pin.slice(0, 2);
  if (/^(400|401|410|421)/.test(pin)) return { min: 1, max: 2, zone: "Mumbai region" };
  if (["78", "79", "18", "19"].includes(p2) || p3 === "744" || /^68255/.test(pin)) return { min: 5, max: 8, zone: "Remote / North-East" };
  if (METRO_PREFIXES.includes(p3)) return { min: 2, max: 4, zone: "Metro city" };
  if ((p2 >= "40" && p2 <= "44") || (p2 >= "36" && p2 <= "39")) return { min: 2, max: 4, zone: "West India" };
  return { min: 3, max: 5, zone: "Rest of India" };
}
export function addBusinessDays(d: Date, n: number) {
  const out = new Date(d);
  while (n > 0) { out.setDate(out.getDate() + 1); if (out.getDay() !== 0) n--; }
  return out;
}
export function deliveryWindow(pin: string, now = new Date()) {
  const t = transitDays(pin);
  return { from: addBusinessDays(now, 1 + t.min), to: addBusinessDays(now, 2 + t.max), zone: t.zone };
}
