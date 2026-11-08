// Copies the original store pages into public/ before `next dev` / `next build`, so Netlify
// serves them next to the new storefront. They stay at the repo root as their source of
// truth (tests read them there); the copies in public/ are build output and git-ignored.
// The original homepage becomes /shop.html: it keeps the bag, coupons and checkout.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, "public");
// product-template.html is read by the product-page function; it is not a page of its own.
const SKIP = new Set(["product-template.html"]);
const RENAME = { "index.html": "shop.html" };
const ASSETS = ["site.css", "site.js", "consent.js", "favicon.svg", "robots.txt"];

mkdirSync(PUBLIC, { recursive: true });
const pages = readdirSync(ROOT).filter((f) => f.endsWith(".html") && !SKIP.has(f));
for (const f of [...pages, ...ASSETS]) {
  if (!existsSync(join(ROOT, f))) continue;
  copyFileSync(join(ROOT, f), join(PUBLIC, RENAME[f] || f));
}
console.log(`copy-legacy: ${pages.length} pages and ${ASSETS.length} assets copied to public/`);
