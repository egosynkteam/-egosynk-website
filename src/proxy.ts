import { NextResponse, type NextRequest } from "next/server";

// Product links that need a different answer than the page: a renamed product (old slug,
// same id) gets a real 308 to its current address, and an id that's not in the catalog gets
// a real 404. Done here, before rendering, because the page itself streams and its status
// would already be 200. Everything else passes straight through.
const ORIGIN = process.env.STORE_ORIGIN || "https://egosynk.com";
const TTL_MS = 60_000;
let slugs: { at: number; byId: Map<number, string> } | null = null;

async function currentSlugs() {
  if (slugs && Date.now() - slugs.at < TTL_MS) return slugs.byId;
  const res = await fetch(`${ORIGIN}/.netlify/functions/get-catalog`);
  if (!res.ok) throw new Error(`catalog ${res.status}`);
  const { products } = (await res.json()) as { products: { id: number; slug: string }[] };
  slugs = { at: Date.now(), byId: new Map(products.map((p) => [p.id, p.slug])) };
  return slugs.byId;
}

// Same rule as netlify/lib/catalog.js idFromSlug: the trailing number is the product id.
const idFromSlug = (slug: string) => { const m = /-(\d+)$/.exec(slug) || /^(\d+)$/.exec(slug); return m ? Number(m[1]) : null; };

export async function proxy(request: NextRequest) {
  const slug = decodeURIComponent(request.nextUrl.pathname.split("/")[2] || "");
  let byId: Map<number, string>;
  try { byId = await currentSlugs(); } catch { return NextResponse.next(); } // catalog unreachable: let the page decide
  const id = idFromSlug(slug);
  const current = id == null ? undefined : byId.get(id);
  if (current === slug) return NextResponse.next();
  if (current) {
    const to = request.nextUrl.clone();
    to.pathname = `/p/${current}`; // keeps ?review= and ?size= from emails
    return NextResponse.redirect(to, 308);
  }
  return NextResponse.rewrite(new URL("/_not-found", request.url), { status: 404 });
}

export const config = { matcher: "/p/:slug" };
