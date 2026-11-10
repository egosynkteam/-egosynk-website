// Product pages:
//  1. src/lib/product-shared.ts (the Next.js page's rules) gives the same answers as the old
//     product-template.html for the size finder and delivery estimate, over many inputs.
//  2. product-page.js ?format=json: data, renamed-product redirect, 404, and the HTML page
//     still works without it.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const ROOT = path.resolve(__dirname, '..');
const lib = (f) => path.join(ROOT, 'netlify', 'lib', f);

// The old page's functions, evaluated as it runs them.
const html = fs.readFileSync(path.join(ROOT, 'product-template.html'), 'utf8').replace(/\r\n/g, '\n');
const slice = (from, to) => html.slice(html.indexOf(from), html.indexOf(to));
const old = new Function(`${slice('function measuredColumns', 'let finderUnit')}
${slice('const METRO_PREFIXES', 'function checkPin')}
return { sizeFor, transitDays, addBusinessDays };`)();
const { DEFAULT_SIZE_GUIDES: G } = require(lib('settings.js'));

(async () => {
  // Node strips the TypeScript types itself (Node 22.18+ / 23.6+).
  const pdp = await import(require('url').pathToFileURL(path.join(ROOT, 'src', 'lib', 'product-shared.ts')).href);

  // 1a. Size finder: every chart, every measured column, 0–60 in 0.25 steps, alone and paired.
  let checked = 0;
  for (const g of Object.values(G)) {
    const cols = pdp.measuredColumns(g).map((c) => c.i);
    for (let v = 0; v <= 60; v += 0.25) {
      for (const c of cols) {
        const values = { [c]: v };
        assert.deepStrictEqual(pdp.sizeFor(g, values), old.sizeFor(g, values), `${g.title} col ${c} = ${v}`);
        checked++;
      }
      if (cols.length > 1) {
        const values = { [cols[0]]: v, [cols[1]]: 60 - v };
        assert.deepStrictEqual(pdp.sizeFor(g, values), old.sizeFor(g, values), `${g.title} pair ${v}`);
        checked++;
      }
    }
  }
  assert.deepStrictEqual(pdp.sizeFor(G.sleeves, { 1: 13 }), { size: 'M', alt: 'L' }); // on the line

  // 1b. Delivery estimate: every 3-digit pincode prefix, from several start days.
  for (let p = 100; p <= 899; p++) {
    const pin = `${p}001`;
    assert.deepStrictEqual(pdp.transitDays(pin), old.transitDays(pin), pin);
    for (const day of ['2026-11-07T10:00:00', '2026-11-08T10:00:00', '2026-11-10T10:00:00']) {
      const d = new Date(day), t = old.transitDays(pin);
      const w = pdp.deliveryWindow(pin, d);
      assert.strictEqual(w.from.toDateString(), old.addBusinessDays(d, 1 + t.min).toDateString(), `${pin} from ${day}`);
      assert.strictEqual(w.to.toDateString(), old.addBusinessDays(d, 2 + t.max).toDateString(), `${pin} to ${day}`);
    }
  }
  assert.strictEqual(pdp.isPincode('400001'), true);
  assert.strictEqual(pdp.isPincode('000001'), false);
  assert.strictEqual(pdp.isPincode('40001'), false);

  // 1c. Stock and size rules.
  const P = { id: 1, name: 'T', cat: 'socks', price: 499, mrp: 699, sizes: ['S', 'M', 'L'], slug: 't-1', stockBySize: { S: 0, M: 3 } };
  assert.strictEqual(pdp.left(P, 'S'), 0);
  assert.strictEqual(pdp.left(P, 'L'), Infinity); // untracked
  assert.deepStrictEqual(pdp.soldOutSizes(P), ['S']);
  assert.strictEqual(pdp.maxQty(P, 'M'), 3);
  assert.strictEqual(pdp.maxQty(P, 'L'), 10);
  assert.strictEqual(pdp.isHygiene(P), true);
  assert.strictEqual(pdp.percentOff(P), 29);
  assert.strictEqual(pdp.defaultSize({ ...P, sizes: ['Free Size'], stockBySize: {} }), 'Free Size');
  assert.strictEqual(pdp.defaultSize({ ...P, sizes: ['Free Size'], stockBySize: { 'Free Size': 0 } }), null);
  assert.strictEqual(pdp.offerText({ code: 'X', type: 'percent', value: 10, minSubtotal: 999, maxDiscount: 200, firstOrderOnly: true }),
    '10% off your first order over ₹999 · up to ₹200');

  // 2. product-page.js with the data layer stubbed.
  const stub = (file, exports) => { require.cache[require.resolve(file)] = { id: file, filename: file, loaded: true, exports }; };
  const product = { id: 7, name: 'Grip Socks', cat: 'socks', price: 399, sizes: ['Free Size'], slug: 'grip-socks-7', images: [] };
  stub(lib('catalog.js'), {
    getPublicCatalog: async () => ({ products: [product, { ...product, id: 8, slug: 'other-8' }], categories: [{ id: 'socks', name: 'Gym Socks' }] }),
    idFromSlug: (s) => { const m = /-(\d+)$/.exec(s); return m ? +m[1] : null; },
  });
  stub(lib('settings.js'), { getSettings: async () => ({ shippingFee: 79, freeShippingThreshold: 999, social: {} }), getSizeGuides: async () => ({}) });
  stub(lib('reviews.js'), { listReviews: async () => [], publicReview: (r) => r });
  stub(lib('coupons.js'), { getCoupons: async () => [], publicOffers: () => [] });
  stub(lib('cdn.js'), { CATALOG_HEADERS: {} });
  const { handler } = require(path.join(ROOT, 'netlify', 'functions', 'product-page.js'));
  const call = (slug, q = {}) => handler({ path: `/.netlify/functions/product-page/${slug}`, queryStringParameters: q });

  let r = await call('grip-socks-7', { format: 'json' });
  assert.strictEqual(r.statusCode, 200);
  assert.match(r.headers['Content-Type'], /json/);
  const body = JSON.parse(r.body);
  assert.strictEqual(body.product.id, 7);
  assert.strictEqual(body.category.name, 'Gym Socks');
  assert.strictEqual(body.related.length, 1);
  assert.strictEqual(body.ld['@type'], 'Product');
  assert.strictEqual(body.settings.freeShippingThreshold, 999);

  r = await call('old-name-7', { format: 'json' });
  assert.deepStrictEqual(JSON.parse(r.body), { redirect: 'grip-socks-7' });
  r = await call('old-name-7', { review: 'order_1' });
  assert.strictEqual(r.statusCode, 301);
  assert.strictEqual(r.headers.Location, '/p/grip-socks-7?review=order_1');

  r = await call('gone-99', { format: 'json' });
  assert.strictEqual(r.statusCode, 404);
  assert.match(r.headers['Content-Type'], /json/);

  r = await call('grip-socks-7');
  assert.strictEqual(r.statusCode, 200);
  assert.match(r.body, /<title>Grip Socks/);
  assert.match(r.body, /const DATA = \{/);

  console.log(`product ok (${checked} size-finder cases, 800 pincode zones)`);
})().catch((e) => { console.error(e); process.exit(1); });
