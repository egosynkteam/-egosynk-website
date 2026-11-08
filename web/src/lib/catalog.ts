import { cacheLife } from "next/cache";
import type { Catalog } from "./catalog-shared";

export * from "./catalog-shared";

const ORIGIN = process.env.STORE_ORIGIN || "https://egosynk.com";
const EMPTY: Catalog = { products: [], categories: [], settings: {} };

export async function getCatalog(): Promise<Catalog> {
  "use cache";
  cacheLife("minutes");
  try {
    const res = await fetch(`${ORIGIN}/.netlify/functions/get-catalog`);
    if (!res.ok) return EMPTY;
    const data = (await res.json()) as Catalog;
    return { products: data.products || [], categories: data.categories || [], settings: data.settings || {} };
  } catch {
    // The page still renders (with the launch content) if the catalog is unreachable.
    return EMPTY;
  }
}
