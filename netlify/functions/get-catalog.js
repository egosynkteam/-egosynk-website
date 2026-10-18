const { getStore } = require('../lib/blob-store');
const { getSettings, getCategories } = require('../lib/settings');

// Public endpoint — the storefront (index.html) fetches the live catalog from here on
// every page load instead of using a hardcoded product list. This is what keeps the
// front store, the admin portal, and the database in sync: there's exactly one place
// product data lives (the `catalog` Blobs store), and everything else just reads it.
// Also returns the admin-configured categories and public store settings (shipping,
// banner, hero, social links).
exports.handler = async () => {
  try {
    const store = getStore('catalog');
    const { blobs } = await store.list();

    // Read every product at once rather than one after another — this list is on the
    // storefront's critical path.
    const [all, settings, categories] = await Promise.all([
      Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' }))),
      getSettings(),
      getCategories(),
    ]);
    // Hiding a category in admin hides its products too.
    const shownCats = new Set(categories.filter((c) => c.visible !== false).map((c) => c.id));
    const products = all
      .filter((p) => p && p.visible !== false && shownCats.has(p.cat))
      .map(({ hsn, gstRate, stock, ...p }) => p) // tax internals stay server-side
      .sort((a, b) => (a.sortOrder ?? a.id) - (b.sortOrder ?? b.id) || a.id - b.id);

    const { shippingFee, freeShippingThreshold, announcement, hero, social } = settings;
    return {
      statusCode: 200,
      headers: { 'Cache-Control': 'public, max-age=30' },
      body: JSON.stringify({
        products,
        categories: categories.filter((c) => c.visible !== false).map(({ id, name, desc, guide }) => ({ id, name, desc, guide })),
        settings: { shippingFee, freeShippingThreshold, announcement, hero, social },
      }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Could not load catalog' }) };
  }
};
