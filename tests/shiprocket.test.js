// Shiprocket integration against a fake Shiprocket API (global fetch stub).
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
    async list() { return { blobs: [...m.keys()].map((key) => ({ key })) }; },
    async listValues() { return [...m.keys()].map((key) => ({ key, value: JSON.parse(m.get(key)) })); },
  };
}
const stub = (file, exports) => { require.cache[require.resolve(file)] = { id: file, filename: file, loaded: true, exports }; };
stub(lib('blob-store.js'), { getStore, currentBackend: async () => 'blobs' });
stub(lib('admin-auth.js'), { isAdminAuthorized: async (e) => (e.admin = { email: 'o@x', name: 'Ashish', role: 'owner', permissions: ['orders','ship','catalog','prices','coupons','settings','reviews','enquiries','reports','audit'] }), requireAdmin: async (e) => ({ admin: (e.admin = { email: 'o@x', name: 'Ashish', role: 'owner', permissions: ['orders','ship','catalog','prices','coupons','settings','reviews','enquiries','reports','audit'] }) }), bodyOf: (e) => { try { return JSON.parse(e.body || '{}'); } catch (x) { return {}; } } });
stub(lib('audit.js'), { logEvent: async () => {} });
const sent = [];
stub(lib('email.js'), { sendEmail: async (m) => { sent.push(m); return { sent: true }; }, emailWrapper: (h) => h, buttonHtml: (u, t) => `<a href="${u}">${t}</a>`, escapeHtml: String, GSTIN: 'X' });

// ---- fake Shiprocket
const calls = [];
let fail = {};
let tokenN = 0;
let validToken = null;
global.fetch = async (url, opts = {}) => {
  const u = new URL(url);
  const p = u.pathname.replace('/v1/external', '');
  const body = opts.body ? JSON.parse(opts.body) : null;
  calls.push({ p, body });
  const reply = (status, data) => ({ ok: status < 300, status, json: async () => data });
  if (p === '/auth/login') {
    if (body.email !== 'api@x' || body.password !== 'pw') return reply(400, { message: 'Invalid credentials' });
    validToken = `tok${++tokenN}`;
    return reply(200, { token: validToken });
  }
  if (opts.headers.Authorization !== `Bearer ${validToken}`) return reply(401, { message: 'Unauthenticated' });
  if (p === '/orders/create/adhoc') {
    if (fail.create) return reply(422, { message: 'The given data was invalid.', errors: { billing_pincode: ['Invalid pincode'] } });
    return reply(200, { order_id: 9001, shipment_id: 7001, status: 'NEW' });
  }
  if (p === '/courier/assign/awb') {
    if (fail.awb) return reply(200, { awb_assign_status: 0, response: { data: { awb_assign_error: 'Insufficient wallet balance' } } });
    return reply(200, { awb_assign_status: 1, response: { data: { awb_code: 'AWB123', courier_name: 'Delhivery Surface', courier_company_id: 12 } } });
  }
  if (p === '/courier/generate/pickup') return reply(200, { pickup_status: 1, response: { pickup_scheduled_date: '2026-11-16 10:00:00', pickup_token_number: 'T1' } });
  if (p === '/courier/generate/label') return reply(200, { label_created: 1, label_url: 'https://kr-shipmultichannel.s3.amazonaws.com/label.pdf' });
  if (p.startsWith('/courier/track/awb/')) {
    return reply(200, { tracking_data: { track_status: 1, shipment_status: fail.delivered ? 7 : 6, shipment_track: [{ current_status: fail.delivered ? 'Delivered' : 'In Transit', delivered_date: fail.delivered ? '2026-11-19 14:00:00' : null }], track_url: 'https://shiprocket.co/tracking/AWB123' } });
  }
  if (p === '/orders/cancel') return reply(204, null);
  if (p === '/settings/company/pickup') return reply(200, { data: { shipping_address: [{ pickup_location: 'work', pin_code: '400028', phone_verified: 1, status: 2 }] } });
  return reply(404, { message: 'not found ' + p });
};

const call = async (file, method, body) => {
  const r = await require(fn(file)).handler({ httpMethod: method, body: body && JSON.stringify(body), headers: {}, queryStringParameters: {} });
  return { status: r.statusCode, body: JSON.parse(r.body) };
};
const order = (id, extra = {}) => ({
  orderId: id, status: 'paid', createdAt: '2026-11-15T06:00:00Z', paidAt: '2026-11-15T06:01:00Z',
  items: [
    { id: 1, name: 'Arm Sleeves', size: 'M', qty: 2, price: 1000, discount: 200, cat: 'sleeves', hsn: '6117' },
    { id: 3, name: 'Trunks', size: 'L', qty: 1, price: 899, discount: 0, cat: 'innerwear', hsn: '6107' },
  ],
  subtotal: 2899, discount: 200, shippingFee: 0, amount: 269900,
  shipping: { name: 'Ravi Kumar Sharma', phone: '9876543210', email: 'r@x.in', address1: '12 MG Road', address2: null, city: 'Pune', state: 'Maharashtra', stateCode: '27', pincode: '411001' },
  ...extra,
});

(async () => {
  const sr = require(lib('shiprocket.js'));
  const orders = getStore('orders');

  // not configured
  await orders.setJSON('o1', order('o1'));
  let r = await call('admin-shipping.js', 'POST', { action: 'ship', orderId: 'o1' });
  assert.strictEqual(r.status, 502); assert.match(r.body.error, /not set in Netlify/);
  assert.strictEqual(calls.length, 0);
  process.env.SHIPROCKET_EMAIL = 'api@x'; process.env.SHIPROCKET_PASSWORD = 'pw';

  // package + payload
  const pkg = sr.packageFor(order('x'), sr.DEFAULT_PACKAGES);
  assert.deepStrictEqual(pkg, { weightG: 500, l: 28, b: 22, h: 10 });
  const pl = sr.orderPayload(order('x'), 'work', pkg);
  assert.strictEqual(pl.order_date, '2026-11-15 11:31');
  assert.deepStrictEqual([pl.billing_customer_name, pl.billing_last_name], ['Ravi', 'Kumar Sharma']);
  assert.deepStrictEqual(pl.order_items.map((i) => [i.sku, i.units, i.selling_price]), [['1-M', 2, 900], ['3-L', 1, 899]]);
  assert.strictEqual(pl.sub_total, 2699); // = amount paid for goods
  assert.strictEqual(pl.billing_pincode, 411001); assert.strictEqual(pl.billing_phone, 9876543210);
  assert.strictEqual(pl.weight, 0.5); assert.strictEqual(pl.pickup_location, 'work'); assert.strictEqual(pl.payment_method, 'Prepaid');

  // settings: custom pickup + package, validation
  r = await call('admin-settings.js', 'POST', { section: 'shiprocket', data: { pickupLocation: '', packages: {} } });
  assert.strictEqual(r.status, 400);
  r = await call('admin-settings.js', 'POST', { section: 'shiprocket', data: { pickupLocation: 'work', packages: { sleeves: { weightG: 0, l: 1, b: 1, h: 1 } } } });
  assert.match(r.body.error, /sleeves/);
  r = await call('admin-settings.js', 'POST', { section: 'shiprocket', data: { pickupLocation: 'work', packages: { sleeves: { weightG: 180, l: 26, b: 18, h: 3 }, bogus: { weightG: 1, l: 1, b: 1, h: 1 } } } });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  assert.deepStrictEqual(Object.keys(r.body.shiprocket.packages), ['sleeves']);
  r = await call('admin-shipping.js', 'GET');
  assert.strictEqual(r.body.configured, true); assert.strictEqual(r.body.packages.sleeves.weightG, 180); assert.ok(r.body.packages.socks);

  r = await require(fn('admin-shipping.js')).handler({ httpMethod: 'GET', headers: {}, queryStringParameters: { check: '1' } });
  r = JSON.parse(r.body);
  assert.strictEqual(r.pickupFound, true, JSON.stringify(r)); assert.deepStrictEqual(r.pickups, [{ name: 'work', pincode: '400028', verified: true }]);
  // pending orders can't ship
  await orders.setJSON('p1', order('p1', { status: 'pending' }));
  r = await call('admin-shipping.js', 'POST', { action: 'ship', orderId: 'p1' });
  assert.strictEqual(r.status, 400);

  // create fails (bad pincode): nothing saved but the error
  fail = { create: true };
  r = await call('admin-shipping.js', 'POST', { action: 'ship', orderId: 'o1' });
  assert.strictEqual(r.status, 502); assert.match(r.body.error, /billing_pincode: Invalid pincode/);
  assert.ok(!r.body.order.shiprocket.shipmentId && r.body.order.shiprocket.lastError);

  // courier fails after the Shiprocket order exists
  fail = { awb: true };
  r = await call('admin-shipping.js', 'POST', { action: 'ship', orderId: 'o1', package: { weightG: 600, l: 30, b: 25, h: 6 } });
  assert.strictEqual(r.status, 502); assert.match(r.body.error, /wallet/);
  let o = await orders.get('o1', { type: 'json' });
  assert.strictEqual(o.shiprocket.shipmentId, 7001); assert.deepStrictEqual(o.shiprocket.package, { weightG: 600, l: 30, b: 25, h: 6 });
  assert.ok(!o.fulfilment, 'not shipped yet'); assert.strictEqual(sent.length, 0);

  // retry: no second create, finishes, customer emailed with tracking link
  fail = {};
  const creates = () => calls.filter((c) => c.p === '/orders/create/adhoc').length;
  const before = creates();
  r = await call('admin-shipping.js', 'POST', { action: 'ship', orderId: 'o1' });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  assert.deepStrictEqual(r.body.steps, ['courier', 'pickup', 'label']);
  assert.strictEqual(creates(), before);
  o = await orders.get('o1', { type: 'json' });
  assert.deepStrictEqual([o.fulfilment.status, o.fulfilment.courier, o.fulfilment.tracking, o.fulfilment.trackUrl],
    ['shipped', 'Delhivery Surface', 'AWB123', 'https://shiprocket.co/tracking/AWB123']);
  assert.strictEqual(o.shiprocket.labelUrl.endsWith('label.pdf'), true);
  assert.strictEqual(o.shiprocket.lastError, null);
  assert.strictEqual(sent.length, 1); assert.match(sent[0].subject, /Shipped/); assert.match(sent[0].html, /Track my parcel/);
  assert.strictEqual(calls.filter((c) => c.p === '/auth/login').length, 1); // token reused

  // shipping again is a no-op
  r = await call('admin-shipping.js', 'POST', { action: 'ship', orderId: 'o1' });
  assert.deepStrictEqual(r.body.steps, []); assert.strictEqual(sent.length, 1);

  // token revoked → logs in again once
  validToken = 'rotated';
  r = await call('admin-shipping.js', 'POST', { action: 'track', orderId: 'o1' });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  assert.strictEqual(r.body.order.shiprocket.tracking.status, 'In Transit');
  assert.strictEqual(calls.filter((c) => c.p === '/auth/login').length, 2);

  // can't cancel once in transit
  r = await call('admin-shipping.js', 'POST', { action: 'cancel', orderId: 'o1' });
  assert.strictEqual(r.status, 400);

  // delivered → order delivered + delivered email
  fail = { delivered: true };
  r = await call('admin-shipping.js', 'POST', { action: 'track', orderId: 'o1' });
  o = await orders.get('o1', { type: 'json' });
  assert.strictEqual(o.fulfilment.status, 'delivered');
  assert.strictEqual(sent.length, 2); assert.match(sent[1].subject, /Delivered/);
  r = await call('admin-shipping.js', 'POST', { action: 'track', orderId: 'o1' });
  assert.strictEqual(sent.length, 2); // no repeat

  // cancel before pickup works
  fail = {};
  await orders.setJSON('o2', order('o2'));
  await call('admin-shipping.js', 'POST', { action: 'ship', orderId: 'o2' });
  r = await call('admin-shipping.js', 'POST', { action: 'cancel', orderId: 'o2' });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body)); assert.ok(r.body.order.shiprocket.cancelled);
  r = await call('admin-shipping.js', 'POST', { action: 'ship', orderId: 'o2' });
  assert.match(r.body.error, /cancelled/);

  // manual fulfilment still works and keeps the link only for the same AWB
  r = await call('admin-orders.js', 'POST', { action: 'fulfilment', orderId: 'o2', status: 'shipped', courier: 'DTDC', tracking: 'NEW999' });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  assert.strictEqual(r.body.order.fulfilment.trackUrl, null);
  // an order already marked shipped by hand isn't re-booked
  await orders.setJSON('o3', { ...order('o3'), fulfilment: { status: 'shipped', history: [] } });
  r = await call('admin-shipping.js', 'POST', { action: 'ship', orderId: 'o3' });
  assert.match(r.body.error, /already marked shipped/);

  // my-orders exposes the link
  stub(lib('session.js'), { getSessionUser: async () => ({ user: { id: 'u1' } }) });
  await orders.setJSON('o1', { ...(await orders.get('o1', { type: 'json' })), userId: 'u1' });
  r = await call('my-orders.js', 'GET');
  assert.strictEqual(r.body.orders[0].fulfilment.trackUrl, 'https://shiprocket.co/tracking/AWB123');

  console.log('ALL PASS');
})().catch((e) => { console.error(e); process.exit(1); });
