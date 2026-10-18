const { getStore } = require('../lib/blob-store');
const { getSettings } = require('../lib/settings');

// Public endpoint — the storefront (index.html) fetches the live catalog from here on
// every page load instead of using a hardcoded product list. This is what keeps the
// front store, the admin portal, and the database in sync: there's exactly one place
// product data lives (the `catalog` Blobs store), and everything else just reads it.
// Also returns the public store settings (shipping fee/threshold) the cart needs.
exports.handler = async () => {
  try {
    const store = getStore('catalog');
    const { blobs } = await store.list();

    // Read every product at once rather than one after another — this list is on the
    // storefront's critical path.
    const products = (await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' })))).filter(Boolean);
    products.sort((a, b) => a.id - b.id);

    const { shippingFee, freeShippingThreshold } = await getSettings();

    return {
      statusCode: 200,
      headers: { 'Cache-Control': 'public, max-age=30' },
      body: JSON.stringify({ products, settings: { shippingFee, freeShippingThreshold } }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Could not load catalog' }) };
  }
};
