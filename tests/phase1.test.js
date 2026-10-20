// Google Merchant Center feed and post-delivery review requests.
const path = require('path');
const assert = require('assert');
const ROOT = path.resolve(__dirname, '..');
const lib = (f) => path.join(ROOT, 'netlify', 'lib', f);
const fn = (f) => path.join(ROOT, 'netlify', 'functions', f);

const stores = {};
function getStore(name) {
  const m = (stores[name] = stores[name] || new Map());
  return {
    async get(k, o) { const v = m.get(k); return v === undefined ? null : (o && o.type === 'json' ? JSON.parse(v) : v); },
    async setJSON(k, v) { m.set(k, JSON.stringify(v)); },
    async delete(k) { m.delete(k); },
    async list(o = {}) { return { blobs: [...m.keys()].filter((k) => !o.prefix || k.startsWith(o.prefix)).map((key) => ({ key })) }; },
    async listValues(o = {}) { return [...m.keys()].filter((k) => !o.prefix || k.startsWith(o.prefix)).map((key) => ({ key, value: JSON.parse(m.get(key)) })); },
  };
}
const stub = (file, exports) => { require.cache[require.resolve(file)] = { id: file, filename: file, loaded: true, exports }; };
stub(lib('blob-store.js'), { getStore, currentBackend: async () => 'blobs' });
let emailOn = false;
const sent = [];
stub(lib('email.js'), { sendEmail: async (m) => { sent.push(m); return emailOn ? { sent: true } : { sent: false, reason: 'not_configured' }; },
  emailWrapper: (h) => h, buttonHtml: (u, t) => `<a href="${u}">${t}</a>`, escapeHtml: (s) => String(s).replace(/</g, '&lt;'), GSTIN: 'X' });

const put = (s, k, v) => getStore(s).setJSON(k, v);

(async () => {
  // ---- catalog: one with photos + sizes + sale + stock, one without photos, one hidden
  await put('catalog', '1', { id: 1, name: 'Arm Sleeves "Pro" & Co', cat: 'sleeves', price: 999, mrp: 1299, sizes: ['S', 'M'], images: ['a1b2c3d4e5f60718.webp', 'b1b2c3d4e5f60718.webp'],
    stockBySize: { S: 0, M: 3 }, visible: true, colour: 'Black', description: 'Firm <compression>' });
  await put('catalog', '2', { id: 2, name: 'No Photo Tee', cat: 'compression', price: 1499, sizes: ['M'], images: [], visible: true });
  await put('catalog', '3', { id: 3, name: 'Hidden', cat: 'socks', price: 499, sizes: ['Free Size'], images: ['c1b2c3d4e5f60718.webp'], visible: false });
  await put('catalog', '4', { id: 4, name: 'Grip Socks', cat: 'socks', price: 499, sizes: ['Free Size'], images: ['d1b2c3d4e5f60718.webp'], visible: true });

  const r = await require(fn('merchant-feed.js')).handler({});
  assert.strictEqual(r.statusCode, 200);
  assert.match(r.headers['Content-Type'], /xml/);
  assert.strictEqual(r.headers['Netlify-Cache-Tag'], 'catalog');
  const x = r.body;
  const items = x.split('<item>').slice(1);
  assert.strictEqual(items.length, 3, 'two sizes of product 1 + the one-size socks; no photo-less or hidden products');
  const s = items.find((i) => i.includes('<g:id>1-S</g:id>'));
  const m = items.find((i) => i.includes('<g:id>1-M</g:id>'));
  assert.ok(s.includes('<g:availability>out_of_stock</g:availability>') && m.includes('<g:availability>in_stock</g:availability>'));
  assert.ok(m.includes('<g:price>1299.00 INR</g:price>') && m.includes('<g:sale_price>999.00 INR</g:sale_price>'));
  assert.ok(m.includes('<g:item_group_id>1</g:item_group_id>') && m.includes('<g:size>M</g:size>') && m.includes('<g:color>Black</g:color>'));
  assert.ok(m.includes('Arm Sleeves &quot;Pro&quot; &amp; Co - M'), 'XML-escaped title');
  assert.ok(m.includes('Firm &lt;compression&gt;'));
  assert.ok(m.includes('?size=M</g:link>') && m.includes('<g:additional_image_link>'));
  const socks = items.find((i) => i.includes('<g:id>4</g:id>'));
  assert.ok(!socks.includes('<g:size>') && !socks.includes('item_group_id') && socks.includes('Underwear &amp; Socks &gt; Socks'));

  // ---- review requests
  const day = 86400e3, now = Date.now();
  const delivered = (daysAgo) => ({ status: 'delivered', history: [{ status: 'delivered', at: new Date(now - daysAgo * day).toISOString() }] });
  const order = (id, daysAgo, extra = {}) => ({ orderId: id, status: 'paid', items: [{ id: 1, name: 'Arm Sleeves', size: 'M', qty: 1 }, { id: 4, name: 'Grip Socks', size: 'Free Size', qty: 2 }],
    shipping: { name: 'Ravi Kumar', email: `${id}@x.in` }, fulfilment: delivered(daysAgo), ...extra });
  await put('orders', 'fresh', order('fresh', 1));
  await put('orders', 'due', order('due', 5));
  await put('orders', 'old', order('old', 40));
  await put('orders', 'reviewed', order('reviewed', 6));
  await put('reviews', 'r/1/reviewed', { rating: 5 }); await put('reviews', 'r/4/reviewed', { rating: 4 });
  await put('orders', 'shipped', { ...order('shipped', 6), fulfilment: { status: 'shipped', history: [] } });
  await put('orders', 'optout', order('optout', 6));
  const { emailKey } = require(lib('abandoned.js'));
  await put('email-optout', emailKey('optout@x.in'), { at: 'x' });

  const { sendReviewRequests } = require(lib('review-requests.js'));
  let rep = await sendReviewRequests(now);
  assert.deepStrictEqual(rep, { checked: 3, sent: 0, skipped: 2, failed: 1 }, JSON.stringify(rep));     // email not set up yet
  assert.ok(!JSON.parse(stores.orders.get('due')).reviewRequest, 'retried later');
  emailOn = true; sent.length = 0;
  rep = await sendReviewRequests(now);
  assert.deepStrictEqual(rep, { checked: 1, sent: 1, skipped: 0, failed: 0 }, JSON.stringify(rep));
  assert.strictEqual(sent[0].to, 'due@x.in');
  assert.ok(sent[0].html.includes('/p/arm-sleeves-pro-co-1?review=due#reviews') && sent[0].html.includes('/p/grip-socks-4?review=due#reviews'));
  assert.ok(sent[0].html.includes('unsubscribe?e=due%40x.in&t='));
  rep = await sendReviewRequests(now);
  assert.strictEqual(rep.sent, 0, 'only once per order');

  console.log('ALL PASS');
})().catch((e) => { console.error(e); process.exit(1); });
