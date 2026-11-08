// The live catalog stays the single source of truth: admin edits it, the Netlify function
// serves it, and this storefront reads it. Nothing about products is hardcoded here.
export type Product = {
  id: number;
  name: string;
  cat: string;
  price: number;
  mrp?: number;
  tag?: string;
  sizes?: string[];
  images?: string[];
  available?: boolean;
  slug: string;
  rating?: { avg: number; count: number } | null;
  colour?: string;
  description?: string;
  specs?: { fit?: string; fabric?: string; compression?: string };
};
export type Category = { id: string; name: string; desc?: string };
export type Bundle = {
  id: string; name: string; tagline?: string; items: string[]; price: number; mrp: number | null;
  priceFinal: boolean; art: "sachets" | "tub-shaker" | "stack" | "tub"; status: "coming" | "live"; productSlug?: string;
};
export type Catalog = {
  products: Product[];
  categories: Category[];
  bundles?: Bundle[];
  settings: {
    shippingFee?: number;
    freeShippingThreshold?: number;
    announcement?: { enabled?: boolean; items?: string[] };
    hero?: { eyebrow?: string; headline?: string; accent?: string; sub?: string };
    social?: { instagram?: string; whatsapp?: string; youtube?: string; facebook?: string };
  };
};

// FUEL and SCENT launch from this storefront; the gear rail shows everything else.
export const SCENT_CATS = new Set(["fragrance"]);
export const FUEL_CATS = new Set(["supplements", "fuel", "pre-workout"]);
export const isGear = (p: Product) => !SCENT_CATS.has(p.cat) && !FUEL_CATS.has(p.cat);

// Text a product can be found by: name, category, colour, tag, fit, fabric, description.
export function searchText(p: Product, categories: Category[]) {
  const s = p.specs || {};
  return [p.name, categories.find((c) => c.id === p.cat)?.name, p.colour, p.tag, s.fit, s.fabric, s.compression, p.description]
    .filter(Boolean).join(" ").toLowerCase();
}

// WhatsApp number from admin → Settings → Social, as a wa.me link, or null if it isn't set.
export function whatsappLink(number: string | undefined, text: string) {
  const digits = String(number || "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `https://wa.me/${digits.length === 10 ? "91" + digits : digits}?text=${encodeURIComponent(text)}`;
}

declare global {
  interface Window { egoTrack?: (name: string, params?: Record<string, unknown>) => void }
}
// Store analytics through consent.js: nothing is sent until the visitor accepts cookies.
export function track(name: string, params: Record<string, unknown> = {}) {
  try { window.egoTrack?.(name, params); } catch { /* analytics never breaks the page */ }
}

export const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
