// Stubs blob-store / auth / email / rate-limit / audit and exercises batch 3 server logic.
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
    async set(k, v) { m.set(k, v); },
    async delete(k) { m.delete(k); },
    async list(o = {}) { return { blobs: [...m.keys()].filter((k) => !o.prefix || k.startsWith(o.prefix)).map((key) => ({ key })) }; },
    async listValues(o = {}) { return [...m.keys()].filter((k) => !o.prefix || k.startsWith(o.prefix)).map((key) => ({ key, value: JSON.parse(m.get(key)) })); },
  };
}
const stub = (file, exports) => { require.cache[require.resolve(file)] = { id: file, filename: file, loaded: true, exports }; };
stub(lib('blob-store.js'), { getStore, currentBackend: async () => 'blobs' });
stub(lib('admin-auth.js'), { isAdminAuthorized: async (e) => (e.admin = { email: 'o@x', name: 'Ashish', role: 'owner', permissions: ['orders','ship','catalog','prices','coupons','settings','reviews','enquiries','reports','audit'] }), requireAdmin: async (e) => ({ admin: (e.admin = { email: 'o@x', name: 'Ashish', role: 'owner', permissions: ['orders','ship','catalog','prices','coupons','settings','reviews','enquiries','reports','audit'] }) }), bodyOf: (e) => { try { return JSON.parse(e.body || '{}'); } catch (x) { return {}; } } });
stub(lib('rate-limit.js'), { allowRequest: async () => true });
stub(lib('audit.js'), { logEvent: async () => {} });
const sent = [];
stub(lib('email.js'), { sendEmail: async (m) => { sent.push(m); return { sent: false }; }, emailWrapper: (h) => h, buttonHtml: () => '', escapeHtml: (s) => String(s), GSTIN: 'X' });

const call = async (file, method, body) => {
  const r = await require(fn(file)).handler({ httpMethod: method, body: body && JSON.stringify(body), headers: {}, queryStringParameters: {} });
  return { status: r.statusCode, body: r.body && r.body.startsWith('{') ? JSON.parse(r.body) : r.body };
};

(async () => {
  const coupons = require(lib('coupons.js'));

  // --- admin save: flags kept, only one top bar
  let r = await call('admin-settings.js', 'POST', { section: 'coupons', data: [
    { code: 'welcome10', type: 'percent', value: 10, minSubtotal: 999, maxDiscount: 300, firstOrderOnly: true, showOnProduct: true, topBar: true, active: true },
    { code: 'GYM15', type: 'percent', value: 15, topBar: true, active: true },
  ] });
  assert.strictEqual(r.status, 400); assert.match(r.body.error, /one coupon/);
  r = await call('admin-settings.js', 'POST', { section: 'coupons', data: [
    { code: 'welcome10', type: 'percent', value: 10, minSubtotal: 999, maxDiscount: 300, firstOrderOnly: true, showOnProduct: true, topBar: true, active: true },
    { code: 'SECRET5', type: 'flat', value: 50, active: true },
    { code: 'OLD20', type: 'percent', value: 20, showOnProduct: true, expiresAt: '2020-01-01', active: true },
  ] });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  const saved = await coupons.getCoupons();
  assert.deepStrictEqual([saved[0].firstOrderOnly, saved[0].showOnProduct, saved[0].topBar], [true, true, true]);

  // --- public offers: only displayed + live codes, no counts
  const offers = coupons.publicOffers(saved);
  assert.deepStrictEqual(offers.map((o) => o.code), ['WELCOME10']);
  assert.ok(!('usedCount' in offers[0]) && offers[0].topBar && offers[0].firstOrderOnly);
  const cat = await call('get-catalog.js', 'GET');
  assert.deepStrictEqual(cat.body.offers.map((o) => o.code), ['WELCOME10']);

  // --- first-order rule
  r = await coupons.findAndEvaluate('welcome10', 1500);
  assert.strictEqual(r.discount, 150);
  r = await coupons.findAndEvaluate('WELCOME10', 5000, { email: 'A@x.com', phone: '9876543210' });
  assert.strictEqual(r.discount, 300); // capped
  await coupons.recordBuyer({ orderId: 'o1', paidAt: 'now', shipping: { email: 'a@X.com ', phone: '9876543210' } });
  r = await coupons.findAndEvaluate('WELCOME10', 1500, { email: 'A@X.COM', phone: '9000000000' });
  assert.match(r.error, /first orders only/);
  r = await coupons.findAndEvaluate('WELCOME10', 1500, { email: 'new@x.com', phone: '9876543210' });
  assert.match(r.error, /first orders only/);
  r = await coupons.findAndEvaluate('WELCOME10', 1500, { email: 'new@x.com', phone: '9000000000' });
  assert.strictEqual(r.discount, 150);
  r = await coupons.findAndEvaluate('SECRET5', 1500, { email: 'a@x.com', phone: '9876543210' });
  assert.strictEqual(r.discount, 50); // non-first-order codes unaffected
  assert.ok([...stores.buyers.keys()].every((k) => !k.includes('9876543210') && !k.includes('@')));

  // --- apply-coupon reports the flag
  stores.catalog = new Map([['1', JSON.stringify({ id: 1, name: 'Tee', price: 1200, cat: 'compression' })],
    ['3', JSON.stringify({ id: 3, name: 'Trunks', price: 899, cat: 'innerwear', sizes: ['S', 'M', 'L'] })]]);
  r = await call('apply-coupon.js', 'POST', { code: 'welcome10', cart: [{ id: 1, qty: 1 }] });
  assert.deepStrictEqual(r.body, { code: 'WELCOME10', discount: 120, firstOrderOnly: true });

  // --- exchange seal rule
  stub(lib('session.js'), { getSessionUser: async () => ({ user: { id: 'u1', email: 'a@x.com' } }) });
  const delivered = new Date(Date.now() - 86400000).toISOString();
  const order = { orderId: 'o2', userId: 'u1', status: 'paid', shipping: { name: 'A', phone: '9876543210', email: 'a@x.com' },
    items: [{ id: 3, name: 'Trunks', size: 'M', qty: 1, cat: 'innerwear' }, { id: 1, name: 'Tee', size: 'M', qty: 1, cat: 'compression' }],
    fulfilment: { status: 'delivered', history: [{ status: 'delivered', at: delivered }] } };
  stores.orders = new Map([['o2', JSON.stringify(order)]]);
  r = await call('request-exchange.js', 'POST', { orderId: 'o2', reason: 'size', items: [{ index: 0, newSize: 'L' }] });
  assert.strictEqual(r.status, 400); assert.match(r.body.error, /hygiene seal/);
  r = await call('request-exchange.js', 'POST', { orderId: 'o2', reason: 'damaged', items: [{ index: 0 }] });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body)); // damaged needs no seal
  stores.orders.set('o2', JSON.stringify(order));
  r = await call('request-exchange.js', 'POST', { orderId: 'o2', reason: 'size', items: [{ index: 0, newSize: 'L', sealed: true }, { index: 1, newSize: 'L' }] });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  const ex = JSON.parse(stores.orders.get('o2')).exchange;
  assert.strictEqual(ex.items[0].sealed, true); assert.ok(!('sealed' in ex.items[1]));

  // --- bulk enquiry
  sent.length = 0;
  const good = { name: 'Raj', org: 'Iron Gym', email: 'Raj@Gym.in', phone: '9812345678', type: 'gym', quantity: '26–50', categories: ['sleeves', 'nope'], branding: true };
  r = await call('bulk-enquiry.js', 'POST', { ...good, phone: '12345' });
  assert.strictEqual(r.status, 400);
  r = await call('bulk-enquiry.js', 'POST', { ...good, categories: ['nope'] });
  assert.match(r.body.error, /product type/);
  r = await call('bulk-enquiry.js', 'POST', { ...good, website: 'spam.com' });
  assert.strictEqual(r.status, 200); assert.ok(!stores.enquiries || !stores.enquiries.size);
  r = await call('bulk-enquiry.js', 'POST', good);
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  assert.strictEqual(sent.length, 2);
  r = await call('admin-enquiries.js', 'GET');
  const q = r.body.enquiries[0];
  assert.deepStrictEqual([q.email, q.categories, q.status, q.branding], ['raj@gym.in', ['Gym Sleeves'], 'new', true]);
  r = await call('admin-enquiries.js', 'POST', { action: 'update', key: q.key, status: 'quoted', note: 'sent ₹ quote' });
  assert.strictEqual(r.body.enquiry.status, 'quoted');
  r = await call('admin-enquiries.js', 'POST', { action: 'delete', key: q.key });
  assert.strictEqual(stores.enquiries.size, 0);

  console.log('ALL PASS');
})().catch((e) => { console.error(e); process.exit(1); });
