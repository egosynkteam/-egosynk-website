const fs = require('fs');
const path = require('path');
const { getSettings, getSizeGuides } = require('../lib/settings');
const { getPublicCatalog, idFromSlug } = require('../lib/catalog');

// Server-renders /p/<slug> (rewritten here in netlify.toml) from product-template.html,
// putting the product's own title, description, share image and Product structured data
// in the HTML — link previews (WhatsApp, Instagram) and search engines read those
// without running JavaScript. The page's script then renders from the embedded JSON.
const SITE = 'https://egosynk.com';

let templateCache = null;
async function loadTemplate() {
  if (templateCache) return templateCache;
  // Bundled via netlify.toml `included_files`; fall back to fetching the deployed copy.
  for (const p of [path.resolve('product-template.html'), path.join(__dirname, 'product-template.html'),
    path.join(__dirname, '..', '..', 'product-template.html')]) {
    try { templateCache = fs.readFileSync(p, 'utf8'); return templateCache; } catch (e) { /* try next */ }
  }
  const res = await fetch(`${process.env.URL || SITE}/product-template.html`);
  if (!res.ok) throw new Error(`Template fetch failed: ${res.status}`);
  templateCache = await res.text();
  return templateCache;
}

const attr = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
// JSON inside <script> must not be able to close the tag.
const safeJson = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

exports.handler = async (event) => {
  // /p/<slug> arrives via a path rewrite; ?slug= kept for direct calls.
  const slug = (event.queryStringParameters && event.queryStringParameters.slug) ||
    decodeURIComponent(String(event.path || '').split('/').filter(Boolean).pop() || '');
  const id = idFromSlug(slug);
  try {
    const [{ products, categories }, settings, sizeGuides, template] = await Promise.all([
      getPublicCatalog(), getSettings(), getSizeGuides(), loadTemplate(),
    ]);
    const product = products.find((p) => p.id === id);
    if (!product) {
      return { statusCode: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' }, body: notFound() };
    }
    // Renamed products: send old links to the current URL.
    if (product.slug !== slug) {
      return { statusCode: 301, headers: { Location: `/p/${product.slug}`, 'Cache-Control': 'public, max-age=300' }, body: '' };
    }

    const category = categories.find((c) => c.id === product.cat) || null;
    const guideKey = product.guide || (category && category.guide);
    const related = products.filter((p) => p.cat === product.cat && p.id !== product.id).slice(0, 4);
    const url = `${SITE}/p/${product.slug}`;
    const image = product.images && product.images[0] ? `${SITE}/media/${product.images[0]}` : `${SITE}/og-image`;
    const desc = (product.description || `${product.name} by EGOSYNK — ${category ? category.name : 'training gear'} built for lifters.`)
      .replace(/\s+/g, ' ').slice(0, 160);
    const inStock = product.available !== false;

    const ld = {
      '@context': 'https://schema.org', '@type': 'Product', name: product.name, description: desc, url,
      image: (product.images || []).map((k) => `${SITE}/media/${k}`), brand: { '@type': 'Brand', name: 'EGOSYNK' },
      category: category && category.name, color: product.colour || undefined, sku: String(product.id),
      offers: { '@type': 'Offer', url, priceCurrency: 'INR', price: product.price,
        availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        seller: { '@type': 'Organization', name: 'EGOSYNK' } },
    };
    const head = `<title>${attr(product.name)} — EGOSYNK</title>
<meta name="description" content="${attr(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="product">
<meta property="og:site_name" content="EGOSYNK">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${attr(product.name)} — ₹${product.price.toLocaleString('en-IN')}">
<meta property="og:description" content="${attr(desc)}">
<meta property="og:image" content="${image}">
<meta property="product:price:amount" content="${product.price}">
<meta property="product:price:currency" content="INR">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${safeJson(ld)}</script>`;

    const { shippingFee, freeShippingThreshold, social } = settings;
    const data = { product, category, related, sizeGuide: guideKey ? sizeGuides[guideKey] || null : null,
      settings: { shippingFee, freeShippingThreshold, social } };

    // Function replacers, so "$" in product text isn't read as a replace pattern.
    const body = template
      .replace('<!--PRODUCT_HEAD-->', () => head)
      .replace('/*PRODUCT_DATA*/null', () => safeJson(data));
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60' },
      body,
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' }, body: notFound('Something went wrong loading this product.') };
  }
};

function notFound(msg = 'This product isn\'t available any more.') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Not found — EGOSYNK</title><meta name="robots" content="noindex">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0D0E10;color:#EDEAE3;font-family:system-ui,sans-serif;text-align:center;padding:24px}
a{color:#E63950}h1{font-size:22px;letter-spacing:.04em;text-transform:uppercase}</style></head>
<body><div><h1><span style="color:#C41E3A">EGO</span>SYNK</h1><p>${msg}</p><p><a href="/#shop">Back to the shop →</a></p></div></body></html>`;
}
