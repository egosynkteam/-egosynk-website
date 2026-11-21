import { cacheLife } from "next/cache";
import type { PdpData } from "./product-shared";

export * from "./product-shared";

const ORIGIN = process.env.STORE_ORIGIN || "https://egosynk.com";

export type ProductResult = { kind: "ok"; data: PdpData } | { kind: "redirect"; slug: string } | { kind: "missing" } | { kind: "error" };

// One product page's data from the product-page function (?format=json): the product,
// its category, related products, approved reviews, size chart, shipping and offers.
export async function getProduct(slug: string): Promise<ProductResult> {
  "use cache";
  cacheLife("minutes");
  try {
    const res = await fetch(`${ORIGIN}/.netlify/functions/product-page/${encodeURIComponent(slug)}?format=json`, { redirect: "manual" });
    if (res.status === 404) return { kind: "missing" };
    if (!res.ok) return { kind: "error" };
    const body = await res.json();
    if (body.redirect) return { kind: "redirect", slug: body.redirect };
    return { kind: "ok", data: body as PdpData };
  } catch {
    return { kind: "error" };
  }
}
