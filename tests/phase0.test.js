// Order privacy (view keys), payment signature check, nightly cleanup, login-lock reset
// and CDN purges — with the real session/admin code on an in-memory store.
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');
const ROOT = path.resolve(__dirname, '..');
const lib = (f) => path.join(ROOT, 'netlify', 'lib', f);
const fn = (f) => path.join(ROOT, 'netlify', 'functions', f);
process.env.RAZORPAY_KEY_SECRET = 'rzp-secret';
process.env.RAZORPAY_KEY_ID = 'rzp_test_x';
process.env.NETLIFY_SITE_ID = 'site-1';
process.env.NETLIFY_API_TOKEN = 'nf-token';

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
const sent = [];
stub(lib('email.js'), { sendEmail: async (m) => { sent.push(m); return { sent: true }; }, emailWrapper: (h) => h, buttonHtml: (u, t) => `<a href="${u}">${t}</a>`, escapeHtml: String, GSTIN: 'X' });
const purges = [];
global.fetch = async (url, opts) => { purges.push({ url, body: JSON.parse(opts.body) }); return { ok: true, status: 200 }; };

const call = async (file, { method = 'GET', query = {}, body, cookie, headers = {} } = {}) => {
  const r = await require(fn(file)).handler({ httpMethod: method, queryStringParameters: query, body: body && JSON.stringify(body),
    headers: { ...(cookie ? { cookie } : {}), ...headers } });
  let parsed = null; try { parsed = JSON.parse(r.body); } catch (e) {}
  return { status: r.statusCode, body: parsed, headers: r.headers || {} };
};

(async () => {
  const put = (s, k, v) => getStore(s).setJSON(k, v);
  const order = { orderId: 'order_ABC', status: 'paid', userId: 'u1', paidAt: '2026-11-15T06:00:00Z', amount: 129900, currency: 'INR',
    items: [{ id: 1, name: 'Tee', size: 'M', qty: 1, price: 1299, cat: 'compression' }], subtotal: 1299, discount: 0, shippingFee: 0,
    shipping: { name: 'Ravi', phone: '9876543210', email: 'r@x.in', address1: '12 MG Road', city: 'Pune', state: 'Maharashtra', stateCode: '27', pincode: '411001' } };
  await put('orders', order.orderId, order);
  const { viewKey } = require(lib('order-access.js'));
  const k = viewKey(order.orderId);
  assert.match(k, /^[a-f0-9]{32}$/);

  // --- get-order / get-invoice: key, owner or admin only; everyone else gets the same 404
  for (const f of ['get-order.js', 'get-invoice.js']) {
    assert.strictEqual((await call(f, { query: { id: order.orderId } })).status, 404, f + ' no key');
    assert.strictEqual((await call(f, { query: { id: order.orderId, k: 'f'.repeat(32) } })).status, 404, f + ' wrong key');
    assert.strictEqual((await call(f, { query: { id: order.orderId, k: k.slice(0, 10) } })).status, 404, f + ' short key');
    assert.strictEqual((await call(f, { query: { id: order.orderId, k } })).status, 200, f + ' right key');
  }
  await put('users', 'r@x.in', { id: 'u1', email: 'r@x.in' });
  await put('sessions', 'sess-owner', { userKey: 'r@x.in', expiresAt: new Date(Date.now() + 3600e3).toISOString() });
  await put('users', 'other@x.in', { id: 'u2', email: 'other@x.in' });
  await put('sessions', 'sess-other', { userKey: 'other@x.in', expiresAt: new Date(Date.now() + 3600e3).toISOString() });
  assert.strictEqual((await call('get-order.js', { query: { id: order.orderId }, cookie: 'egosynk_session=sess-owner' })).status, 200, 'owner');
  assert.strictEqual((await call('get-order.js', { query: { id: order.orderId }, cookie: 'egosynk_session=sess-other' })).status, 404, 'another customer');
  await put('admin-users', 'owner@x.com', { email: 'owner@x.com', name: 'A', role: 'owner' });
  await put('admin-sessions', crypto.createHash('sha256').update('adm-tok').digest('hex'), { email: 'owner@x.com', expiresAt: new Date(Date.now() + 3600e3).toISOString() });
  assert.strictEqual((await call('get-invoice.js', { query: { id: order.orderId }, cookie: 'egosynk_admin=adm-tok' })).status, 200, 'admin');

  // --- verify-payment: constant-time check, hands the buyer the view key
  await put('orders', 'order_NEW', { ...order, orderId: 'order_NEW', status: 'pending', paidAt: null });
  const sig = crypto.createHmac('sha256', 'rzp-secret').update('order_NEW|pay_1').digest('hex');
  let r = await call('verify-payment.js', { method: 'POST', body: { razorpay_order_id: 'order_NEW', razorpay_payment_id: 'pay_1', razorpay_signature: 'x' + sig.slice(1) } });
  assert.strictEqual(r.body.verified, false); assert.ok(!r.body.k);
  r = await call('verify-payment.js', { method: 'POST', body: { razorpay_order_id: 'order_NEW', razorpay_payment_id: 'pay_1', razorpay_signature: 'short' } });
  assert.strictEqual(r.body.verified, false);
  r = await call('verify-payment.js', { method: 'POST', body: { razorpay_order_id: 'order_NEW', razorpay_payment_id: 'pay_1', razorpay_signature: sig } });
  assert.strictEqual(r.body.verified, true, JSON.stringify(r.body));
  assert.strictEqual(r.body.k, viewKey('order_NEW'));
  const mail = sent.find((m) => m.to === 'r@x.in');
  assert.ok(mail && mail.html.includes(`invoice.html?id=order_NEW&k=${viewKey('order_NEW')}`), 'invoice link in the email carries the key');

  // --- stock change on payment purges the CDN copy of the catalog
  await put('catalog', '1', { id: 1, name: 'Tee', price: 1299, sizes: ['M'], stockBySize: { M: 5 } });
  purges.length = 0;
  await put('orders', 'order_STK', { ...order, orderId: 'order_STK', status: 'pending', paidAt: null });
  await require(lib('orders.js')).markOrderPaid('order_STK', 'pay_2', null, 'test');
  assert.strictEqual(JSON.parse(stores.catalog.get('1')).stockBySize.M, 4);
  assert.deepStrictEqual(purges.map((p) => p.body), [{ site_id: 'site-1', cache_tags: ['catalog'] }]);

  // --- catalog responses are CDN-cacheable and tagged
  r = await call('get-catalog.js');
  assert.match(r.headers['Netlify-CDN-Cache-Control'], /durable.*stale-while-revalidate/);
  assert.strictEqual(r.headers['Netlify-Cache-Tag'], 'catalog');

  // --- login failures only count while recent
  const rl = require(lib('rate-limit.js'));
  for (let i = 0; i < 4; i++) await rl.recordLoginFailure('a@x');
  const rec = JSON.parse(stores.security.get('login:a@x'));
  rec.lastFailure = new Date(Date.now() - 2 * 3600e3).toISOString();
  stores.security.set('login:a@x', JSON.stringify(rec));
  await rl.recordLoginFailure('a@x');
  assert.strictEqual(JSON.parse(stores.security.get('login:a@x')).count, 1, 'old failures forgotten');
  assert.strictEqual((await rl.checkLoginLock('a@x')).locked, false);

  // --- nightly cleanup: stale goes, fresh and unrelated stay
  const now = Date.now(), iso = (ms) => new Date(now + ms).toISOString();
  stores.security = new Map(Object.entries({
    'rl:signup:1.1.1.1': JSON.stringify({ start: now - 2 * 86400e3, count: 3 }),
    'rl:signup:2.2.2.2': JSON.stringify({ start: now - 60e3, count: 1 }),
    'login:old@x': JSON.stringify({ count: 2, lastFailure: iso(-3 * 86400e3) }),
    'login:locked@x': JSON.stringify({ count: 5, lastFailure: iso(-60e3), lockedUntil: iso(600e3) }),
    'shiprocket-token': JSON.stringify({ token: 't', expiresAt: iso(-86400e3) }),
  }));
  stores['password-resets'] = new Map([['old', JSON.stringify({ expiresAt: iso(-2 * 86400e3) })], ['new', JSON.stringify({ expiresAt: iso(3600e3) })]]);
  stores.sessions.set('expired', JSON.stringify({ userKey: 'r@x.in', expiresAt: iso(-1000) }));
  const report = await require(lib('cleanup.js')).runCleanup(now);
  assert.deepStrictEqual([...stores.security.keys()].sort(), ['login:locked@x', 'rl:signup:2.2.2.2', 'shiprocket-token']);
  assert.deepStrictEqual([...stores['password-resets'].keys()], ['new']);
  assert.ok(!stores.sessions.has('expired') && stores.sessions.has('sess-owner'));
  assert.strictEqual(report.security, 2);

  console.log('ALL PASS');
})().catch((e) => { console.error(e); process.exit(1); });
