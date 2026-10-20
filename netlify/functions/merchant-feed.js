const { getPublicCatalog } = require('../lib/catalog');
const { CATALOG_HEADERS } = require('../lib/cdn');

// /merchant-feed.xml (netlify.toml): the product feed for Google Merchant Center, which
// lists products for free in Google Shopping and search. One item per size so each size
// shows its own stock; sizes are grouped by `item_group_id`. Only products that are on
// the store and have a photo (Google requires an image). Shipping and returns are set
// in the Merchant Center account itself.
const SITE = 'https://egosynk.com';

// Google product taxonomy (text form) per store category; Google classifies the rest.
const GOOGLE_CATEGORY = {
  compression: 'Apparel & Accessories > Clothing > Activewear',
  bottoms: 'Apparel & Accessories > Clothing > Activewear',
  sleeves: 'Apparel & Accessories > Clothing > Activewear',
  innerwear: 'Apparel & Accessories > Clothing > Underwear & Socks > Underwear',
  socks: 'Apparel & Accessories > Clothing > Underwear & Socks > Socks',
  accessories: 'Sporting Goods > Exercise & Fitness',
  fragrance: 'Health & Beauty > Personal Care > Cosmetics > Perfume & Cologne',
};

const xml = (s) => String(s == null ? '' : s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
const money = (n) => `${Number(n).toFixed(2)} INR`;
const tag = (name, value) => (value === undefined || value === null || value === '' ? '' : `<g:${name}>${xml(value)}</g:${name}>`);

function inStock(p, size) {
  if (p.available === false) return false;
  const left = p.stockBySize && Number.isFinite(p.stockBySize[size]) ? p.stockBySize[size] : Infinity;
  return left > 0;
}

function items(p, categories) {
  const cat = categories.find((c) => c.id === p.cat);
  const link = `${SITE}/p/${p.slug}`;
  const description = (p.description || `${p.name} by EGOSYNK. ${cat ? cat.name + '. ' : ''}${(p.highlights || []).join('. ')}`).replace(/\s+/g, ' ').slice(0, 5000);
  const onSale = p.mrp && p.mrp > p.price;
  const sizes = p.sizes && p.sizes.length ? p.sizes : [null];
  return sizes.map((size) => [
    '<item>',
    tag('id', size && sizes.length > 1 ? `${p.id}-${size}` : String(p.id)),
    sizes.length > 1 ? tag('item_group_id', String(p.id)) : '',
    tag('title', size && sizes.length > 1 ? `${p.name} - ${size}` : p.name),
    tag('description', description),
    tag('link', size && sizes.length > 1 ? `${link}?size=${encodeURIComponent(size)}` : link),
    tag('image_link', `${SITE}/media/${p.images[0]}`),
    ...p.images.slice(1, 11).map((k) => tag('additional_image_link', `${SITE}/media/${k}`)),
    tag('availability', inStock(p, size) ? 'in_stock' : 'out_of_stock'),
    tag('price', money(onSale ? p.mrp : p.price)),
    onSale ? tag('sale_price', money(p.price)) : '',
    tag('brand', 'EGOSYNK'),
    tag('condition', 'new'),
    tag('identifier_exists', 'no'),
    tag('size', size && !/^free/i.test(size) ? size : ''),
    tag('color', p.colour),
    tag('age_group', 'adult'),
    tag('product_type', cat ? cat.name : ''),
    tag('google_product_category', GOOGLE_CATEGORY[p.cat]),
    '</item>',
  ].filter(Boolean).join(''));
}

exports.handler = async () => {
  try {
    const { products, categories } = await getPublicCatalog();
    const listed = products.filter((p) => (p.images || []).length);
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel>
<title>EGOSYNK</title><link>${SITE}</link><description>EGOSYNK training gear</description>
${listed.flatMap((p) => items(p, categories)).join('\n')}
</channel></rss>`;
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600', ...CATALOG_HEADERS },
      body,
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: 'Could not build the feed' };
  }
};
