const { getStore } = require('../lib/blob-store');

// Public endpoint — the storefront (index.html) fetches the live catalog from here on
// every page load instead of using a hardcoded product list. This is what keeps the
// front store, the admin portal, and the database in sync: there's exactly one place
// product data lives (the `catalog` Blobs store), and everything else just reads it.
exports.handler = async () => {
  try {
    const store = getStore('catalog');
    const { blobs } = await store.list();

    const products = [];
    for (const b of blobs) {
      const p = await store.get(b.key, { type: 'json' });
      if (p) products.push(p);
    }
    products.sort((a, b) => a.id - b.id);

    return {
      statusCode: 200,
      headers: { 'Cache-Control': 'public, max-age=30' },
      body: JSON.stringify({ products }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Could not load catalog' }) };
  }
};
