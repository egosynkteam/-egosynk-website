const { getStore } = require('./blob-store');
const { getCategories } = require('./settings');
const { getSummary } = require('./reviews');

// Product page URLs are /p/<name-slug>-<id>. Only the trailing id is used to find the
// product, so a rename keeps old links working (they redirect to the new slug).
function slugify(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '')
    .trim().replace(/[\s_-]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'product';
}
const productSlug = (p) => `${slugify(p.name)}-${p.id}`;
const idFromSlug = (slug) => { const m = /-(\d+)$/.exec(String(slug || '')) || /^(\d+)$/.exec(String(slug || '')); return m ? Number(m[1]) : null; };

// Everything the public may see: visible products in visible categories, without tax
// internals. Shared by get-catalog, product pages and the sitemap.
async function getPublicCatalog() {
  const store = getStore('catalog');
  const { blobs } = await store.list();
  const [all, categories, ratings] = await Promise.all([
    Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' }))),
    getCategories(),
    getSummary(),
  ]);
  const shownCats = new Set(categories.filter((c) => c.visible !== false).map((c) => c.id));
  const products = all
    .filter((p) => p && p.visible !== false && shownCats.has(p.cat))
    .map(({ hsn, gstRate, stock, ...p }) => ({ ...p, slug: productSlug(p), rating: ratings[p.id] || null }))
    .sort((a, b) => (a.sortOrder ?? a.id) - (b.sortOrder ?? b.id) || a.id - b.id);
  return { products, categories: categories.filter((c) => c.visible !== false) };
}

module.exports = { slugify, productSlug, idFromSlug, getPublicCatalog };
