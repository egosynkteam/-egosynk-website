// Admin permissions, archive, and password recovery with the real admin-auth/admin-account.
const path = require('path');
const assert = require('assert');
const ROOT = path.resolve(__dirname, '..');
const lib = (f) => path.join(ROOT, 'netlify', 'lib', f);
const fn = (f) => path.join(ROOT, 'netlify', 'functions', f);
process.env.ADMIN_SECRET = 'setup-key-123';

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

const cookieOf = (r) => (r.headers && r.headers['Set-Cookie'] || '').split(';')[0];
async function call(file, { method = 'POST', body, cookie, query = {}, raw } = {}) {
  const headers = { 'x-egosynk-admin': '1' };
  if (cookie) headers.cookie = cookie;
  const r = await require(fn(file)).handler({ httpMethod: method, body: raw !== undefined ? raw : body && JSON.stringify(body), headers, queryStringParameters: query });
  let parsed = null; try { parsed = JSON.parse(r.body); } catch (e) {}
  return { status: r.statusCode, body: parsed, headers: r.headers };
}
const acct = (body, cookie) => call('admin-account.js', { body, cookie });

(async () => {
  // ---- owner + staff
  let r = await acct({ action: 'setup', setupKey: 'setup-key-123', name: 'Ashish', email: 'Owner@x.com', password: 'ownerpass123' });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  let owner = cookieOf(r);
  assert.strictEqual(r.body.admin.permissions.length, 12);
  r = await acct({ action: 'add-user', name: 'Sam', email: 'sam@x.com', password: 'staffpass123', role: 'staff', permissions: ['orders', 'bogus'] }, owner);
  assert.deepStrictEqual(r.body.users.find((u) => u.email === 'sam@x.com').permissions, ['orders']);
  r = await acct({ action: 'login', email: 'sam@x.com', password: 'staffpass123' });
  let staff = cookieOf(r);
  assert.deepStrictEqual(r.body.admin.permissions, ['orders']);

  // ---- permissions enforced server-side
  const expect = async (file, opts, status, label) => { const x = await call(file, opts); assert.strictEqual(x.status, status, `${label}: ${x.status} ${JSON.stringify(x.body)}`); return x; };
  await expect('list-orders.js', { method: 'GET', cookie: staff }, 200, 'staff orders');
  await expect('admin-catalog.js', { method: 'GET', cookie: staff }, 200, 'staff catalog read');
  const forb = await expect('admin-catalog.js', { body: { name: 'X', cat: 'sleeves', price: 100, sizes: ['M'] }, cookie: staff }, 403, 'staff create product');
  assert.match(forb.body.error, /Edit products/);
  await expect('admin-settings.js', { body: { section: 'coupons', data: [] }, cookie: staff }, 403, 'staff coupons');
  await expect('admin-settings.js', { body: { section: 'store', data: {} }, cookie: staff }, 403, 'staff settings');
  await expect('admin-settings.js', { method: 'GET', cookie: staff }, 200, 'staff settings read');
  await expect('list-audit-log.js', { method: 'GET', cookie: staff }, 403, 'staff audit');
  await expect('admin-gst-report.js', { method: 'GET', cookie: staff, query: { month: '2026-10', type: 'b2cs' } }, 403, 'staff gst');
  await expect('admin-orders.js', { body: { action: 'reset-test', confirm: 'RESET' }, cookie: staff }, 403, 'staff reset');
  await expect('admin-database.js', { method: 'GET', cookie: staff }, 403, 'staff db');
  await expect('admin-seed-catalog.js', { cookie: staff }, 403, 'staff seed');
  await expect('admin-shipping.js', { body: { action: 'ship', orderId: 'x' }, cookie: staff }, 403, 'staff ship');
  await expect('admin-reviews.js', { method: 'GET', cookie: staff }, 403, 'staff reviews');
  await expect('admin-orders.js', { raw: '{not json', cookie: staff }, 500, 'malformed body handled, no crash');
  await expect('list-orders.js', { method: 'GET' }, 401, 'signed out');
  await expect('admin-shipping.js', { method: 'GET', cookie: staff }, 200, 'staff ship settings read (orders)');

  // ---- prices permission
  r = await expect('admin-catalog.js', { body: { name: 'Tee', cat: 'sleeves', price: 999, sizes: ['M'] }, cookie: owner }, 200, 'owner create');
  const pid = r.body.product.id;
  r = await acct({ action: 'update-user', email: 'sam@x.com', role: 'staff', permissions: ['orders', 'catalog'] }, owner);
  assert.deepStrictEqual(r.body.users.find((u) => u.email === 'sam@x.com').permissions, ['orders', 'catalog']);
  await expect('admin-catalog.js', { body: { id: pid, name: 'Tee v2', cat: 'sleeves', price: 999, sizes: ['M'] }, cookie: staff }, 200, 'staff rename, same price');
  await expect('admin-catalog.js', { body: { id: pid, name: 'Tee v2', cat: 'sleeves', price: 899, sizes: ['M'] }, cookie: staff }, 403, 'staff price change');
  await expect('admin-catalog.js', { body: { id: pid, name: 'Tee v2', cat: 'sleeves', price: 999, mrp: 1299, sizes: ['M'] }, cookie: staff }, 403, 'staff mrp change');
  await expect('admin-catalog.js', { body: { name: 'New', cat: 'sleeves', price: 500, sizes: ['M'] }, cookie: staff }, 403, 'staff new product needs prices');

  // ---- archive / restore / delete forever
  r = await expect('admin-catalog.js', { body: { action: 'archive', id: pid }, cookie: staff }, 200, 'staff archive');
  assert.ok(r.body.product.archived && r.body.product.visible === false);
  await expect('admin-catalog.js', { body: { id: pid, name: 'Tee v3', cat: 'sleeves', price: 999, sizes: ['M'], visible: true }, cookie: owner }, 200, 'edit archived');
  assert.strictEqual(JSON.parse(stores.catalog.get(String(pid))).visible, false, 'archived stays hidden on edit');
  await expect('admin-catalog.js', { method: 'DELETE', query: { id: String(pid) }, cookie: staff }, 403, 'staff delete forever');
  stores.orders = new Map([['o1', JSON.stringify({ orderId: 'o1', items: [{ id: pid }] })]]);
  r = await expect('admin-catalog.js', { method: 'DELETE', query: { id: String(pid) }, cookie: owner }, 400, 'delete ordered product');
  assert.match(r.body.error, /has orders/);
  r = await expect('admin-catalog.js', { body: { action: 'restore', id: pid }, cookie: owner }, 200, 'restore');
  assert.ok(!r.body.product.archived && r.body.product.visible === true);
  r = await expect('admin-catalog.js', { body: { name: 'Never sold', cat: 'socks', price: 300, sizes: ['M'] }, cookie: owner }, 200, 'create 2');
  const p2 = r.body.product.id;
  await expect('admin-catalog.js', { method: 'DELETE', query: { id: String(p2) }, cookie: owner }, 400, 'delete unarchived');
  await expect('admin-catalog.js', { body: { action: 'archive', id: p2 }, cookie: owner }, 200, 'archive 2');
  await expect('admin-catalog.js', { method: 'DELETE', query: { id: String(p2) }, cookie: owner }, 200, 'delete forever');
  assert.ok(!stores.catalog.has(String(p2)));

  // ---- change password ends OTHER sessions only
  const owner2 = cookieOf(await acct({ action: 'login', email: 'owner@x.com', password: 'ownerpass123' }));
  r = await acct({ action: 'change-password', current: 'ownerpass123', next: 'ownerpass456' }, owner);
  assert.strictEqual(r.body.otherSessionsEnded, 1);
  assert.strictEqual((await call('list-orders.js', { method: 'GET', cookie: owner2 })).status, 401, 'other device signed out');
  assert.strictEqual((await call('list-orders.js', { method: 'GET', cookie: owner })).status, 200, 'this device kept');

  // ---- email reset
  r = await acct({ action: 'request-reset', email: 'nobody@x.com' });
  assert.strictEqual(r.status, 200); assert.strictEqual(sent.length, 0);
  r = await acct({ action: 'request-reset', email: 'Owner@x.com' });
  assert.strictEqual(r.status, 200); assert.strictEqual(sent.length, 1);
  const token = /#reset=([a-f0-9]{64})/.exec(sent[0].html)[1];
  r = await acct({ action: 'reset-password', token, password: 'short' });
  assert.strictEqual(r.status, 400);
  r = await acct({ action: 'reset-password', token, password: 'ownerpass789' });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  assert.strictEqual((await call('list-orders.js', { method: 'GET', cookie: owner })).status, 401, 'reset signs out everywhere');
  r = await acct({ action: 'reset-password', token, password: 'ownerpass000' });
  assert.match(r.body.error, /expired or was already used/);
  r = await acct({ action: 'login', email: 'owner@x.com', password: 'ownerpass789' });
  assert.strictEqual(r.status, 200); owner = cookieOf(r);

  // ---- setup-key recovery
  r = await acct({ action: 'recover', setupKey: 'wrong', email: 'owner@x.com', password: 'recovered123' });
  assert.strictEqual(r.status, 401);
  r = await acct({ action: 'recover', setupKey: 'setup-key-123', email: 'sam@x.com', password: 'recovered123' });
  assert.strictEqual(r.status, 404, 'recovery is for owners only');
  r = await acct({ action: 'recover', setupKey: 'setup-key-123', email: 'owner@x.com', password: 'recovered123' });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  assert.strictEqual((await call('list-orders.js', { method: 'GET', cookie: owner })).status, 401);
  owner = cookieOf(await acct({ action: 'login', email: 'owner@x.com', password: 'recovered123' }));
  for (let i = 0; i < 5; i++) await acct({ action: 'recover', setupKey: 'nope', email: 'owner@x.com', password: 'x'.repeat(12) });
  r = await acct({ action: 'recover', setupKey: 'setup-key-123', email: 'owner@x.com', password: 'y'.repeat(12) });
  assert.strictEqual(r.status, 429, 'locked after repeated wrong keys');

  // ---- team rules
  r = await acct({ action: 'update-user', email: 'owner@x.com', role: 'staff', permissions: [] }, owner);
  assert.strictEqual(r.status, 400);
  r = await acct({ action: 'update-user', email: 'sam@x.com', role: 'staff', permissions: ['orders'], disabled: true }, owner);
  assert.strictEqual(r.body.users.find((u) => u.email === 'sam@x.com').disabled, true);
  assert.strictEqual((await call('list-orders.js', { method: 'GET', cookie: staff })).status, 401, 'disabled staff signed out');
  r = await acct({ action: 'update-user', email: 'sam@x.com', role: 'staff', permissions: ['orders'] }, owner);
  r = await acct({ action: 'set-password', email: 'sam@x.com', password: 'newstaffpw1' }, owner);
  assert.strictEqual((await acct({ action: 'login', email: 'sam@x.com', password: 'newstaffpw1' })).status, 200);
  r = await acct({ action: 'list-users' }, staff);
  assert.strictEqual(r.status, 401);

  // ---- drop lists: owner can read and export, staff without the permission can't
  await getStore('waitlist').setJSON('hydro-150__a%40b.co', { product: 'hydro-150', email: 'a@b.co', phone: '=cmd', marketing: true, at: '2026-11-08T10:00:00.000Z' });
  const ownerW = cookieOf(await acct({ action: 'login', email: 'owner@x.com', password: 'recovered123' }));
  r = await call('admin-waitlist.js', { method: 'GET', cookie: ownerW });
  assert.strictEqual(r.status, 200);
  const hydro = r.body.products.find((p) => p.id === 'hydro-150');
  assert.deepStrictEqual([hydro.count, hydro.marketing, hydro.phones], [1, 1, 1]);
  const csv = await require(fn('admin-waitlist.js')).handler({ httpMethod: 'GET', headers: { 'x-egosynk-admin': '1', cookie: ownerW }, queryStringParameters: { format: 'csv', product: 'hydro-150' } });
  assert.strictEqual(csv.statusCode, 200);
  assert.match(csv.headers['Content-Disposition'], /hydro-150/);
  assert.ok(csv.body.includes("'=cmd"), 'formula-looking cells are neutralised');
  const staffW = cookieOf(await acct({ action: 'login', email: 'sam@x.com', password: 'newstaffpw1' }));
  assert.strictEqual((await call('admin-waitlist.js', { method: 'GET', cookie: staffW })).status, 403);
  r = await call('admin-waitlist.js', { body: { action: 'delete', product: 'hydro-150', email: 'a@b.co' }, cookie: ownerW });
  assert.strictEqual(r.status, 200);
  assert.strictEqual((await call('admin-waitlist.js', { method: 'GET', cookie: ownerW })).body.products[0].count, 0);

  // ---- sign out everywhere
  const ownerB = cookieOf(await acct({ action: 'login', email: 'owner@x.com', password: 'recovered123' }));
  await acct({ action: 'logout-all' }, owner);
  assert.strictEqual((await call('list-orders.js', { method: 'GET', cookie: ownerB })).status, 401);
  assert.strictEqual((await call('list-orders.js', { method: 'GET', cookie: owner })).status, 401);

  console.log('ALL PASS');
})().catch((e) => { console.error(e); process.exit(1); });
