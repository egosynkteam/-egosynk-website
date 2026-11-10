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
    // A deploy of the function from before ?format=json existed answers the old way: a
    // 301 for a renamed product, or the HTML page with its data embedded. Both are read
    // here so the page works against either. Safe to remove once main has the JSON mode.
    if (res.status === 301) {
      const to = res.headers.get("location") || "";
      const m = /\/p\/([^/?#]+)/.exec(to);
      return m ? { kind: "redirect", slug: decodeURIComponent(m[1]) } : { kind: "missing" };
    }
    if (!res.ok) return { kind: "error" };
    const type = res.headers.get("content-type") || "";
    if (type.includes("application/json")) {
      const body = await res.json();
      if (body.redirect) return { kind: "redirect", slug: body.redirect };
      return { kind: "ok", data: body as PdpData };
    }
    const html = await res.text();
    const m = /const DATA = (\{[\s\S]*?\});\s*\n/.exec(html);
    if (!m) return { kind: "error" };
    const data = JSON.parse(m[1]) as PdpData;
    // The old page carries its Product structured data in the head, not in DATA.
    const ld = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
    if (ld) { try { data.ld = JSON.parse(ld[1]); } catch { /* leave it out */ } }
    return { kind: "ok", data };
  } catch {
    return { kind: "error" };
  }
}
