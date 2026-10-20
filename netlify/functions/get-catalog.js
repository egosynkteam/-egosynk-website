const { getSettings, getSizeGuides } = require('../lib/settings');
const { getPublicCatalog } = require('../lib/catalog');
const { getCoupons, publicOffers } = require('../lib/coupons');

// Public endpoint — the storefront (index.html) fetches the live catalog from here on
// every page load instead of using a hardcoded product list. This is what keeps the
// front store, the admin portal, and the database in sync: there's exactly one place
// product data lives (the `catalog` Blobs store), and everything else just reads it.
// Also returns the admin-configured categories, size guides and public store settings
// (shipping, banner, hero, social links) and the coupons marked for display. Hidden
// products/categories are left out.
exports.handler = async () => {
  try {
    const [{ products, categories }, settings, sizeGuides, coupons] = await Promise.all([
      getPublicCatalog(), getSettings(), getSizeGuides(), getCoupons(),
    ]);
    const { shippingFee, freeShippingThreshold, announcement, hero, social } = settings;
    return {
      statusCode: 200,
      headers: { 'Cache-Control': 'public, max-age=30' },
      body: JSON.stringify({
        products,
        categories: categories.map(({ id, name, desc, guide }) => ({ id, name, desc, guide })),
        settings: { shippingFee, freeShippingThreshold, announcement, hero, social },
        sizeGuides,
        offers: publicOffers(coupons),
      }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Could not load catalog' }) };
  }
};
