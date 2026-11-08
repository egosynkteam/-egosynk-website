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
};
export type Category = { id: string; name: string; desc?: string };
export type Catalog = {
  products: Product[];
  categories: Category[];
  settings: {
    shippingFee?: number;
    freeShippingThreshold?: number;
    announcement?: { enabled?: boolean; items?: string[] };
    hero?: { eyebrow?: string; headline?: string; accent?: string; sub?: string };
  };
};

// FUEL and SCENT launch from this storefront; the gear rail shows everything else.
export const SCENT_CATS = new Set(["fragrance"]);
export const FUEL_CATS = new Set(["supplements", "fuel", "pre-workout"]);
export const isGear = (p: Product) => !SCENT_CATS.has(p.cat) && !FUEL_CATS.has(p.cat);

export const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
