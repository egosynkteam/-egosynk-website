// 4a-2 end-to-end: in-memory Blobs + real Postgres (PGlite on 5499).
const path = require('path');
const assert = require('assert');
const ROOT = path.resolve(__dirname, '..');
process.env.SUPABASE_DB_URL = 'postgres://postgres:postgres@127.0.0.1:5499/postgres?sslmode=disable';
// Needs @electric-sql/pglite + pglite-socket (installed in CI, see .github/workflows/test.yml).
let pgServer = null;
async function startPostgres() {
  let PGlite, PGLiteSocketServer;
  try { ({ PGlite } = await import('@electric-sql/pglite')); ({ PGLiteSocketServer } = await import('@electric-sql/pglite-socket')); }
  catch (e) { console.log('SKIP: PGlite not installed (npm i --no-save @electric-sql/pglite@0.5.7 @electric-sql/pglite-socket@0.2.10 --legacy-peer-deps)'); process.exit(0); }
  const db = await PGlite.create();
  pgServer = new PGLiteSocketServer({ db, port: 5499, host: '127.0.0.1', maxConnections: 10 });
  await pgServer.start();
}
process.env.RAZORPAY_KEY_ID = 'rzp_test_x';
const lib = (f) => path.join(ROOT, 'netlify', 'lib', f);
const fn = (f) => path.join(ROOT, 'netlify', 'functions', f);

// In-memory @netlify/blobs
const blobs = {};
function rawStore(name) {
  const m = (blobs[typeof name === 'string' ? name : name.name] ||= new Map());
  return {
    async get(k, o) { if (!m.has(k)) return null; const v = m.get(k); return o && o.type === 'json' ? JSON.parse(v) : v; },
    async setJSON(k, v) { m.set(k, JSON.stringify(v)); },
    async delete(k) { m.delete(k); },
    async list(o = {}) { return { blobs: [...m.keys()].sort().filter((k) => !o.prefix || k.startsWith(o.prefix)).map((key) => ({ key })) }; },
  };
}
const stub = (file, exports) => { require.cache[file] = { id: file, filename: file, loaded: true, exports }; };
stub(require.resolve('@netlify/blobs', { paths: [ROOT] }), { getStore: rawStore });
stub(lib('admin-auth.js'), { isAdminAuthorized: async (e) => (e.admin = { email: 'owner@x', role: e.role || 'owner', permissions: ['orders','ship','catalog','prices','coupons','settings','reviews','enquiries','reports','audit'] }), requireAdmin: async (e, perm) => { const admin = (e.admin = { email: 'owner@x', role: e.role || 'owner', permissions: ['orders','ship','catalog','prices','coupons','settings','reviews','enquiries','reports','audit'] }); return perm === 'owner' && admin.role !== 'owner' ? { admin, response: { statusCode: 403, body: JSON.stringify({ error: 'Only the owner can do this' }) } } : { admin }; }, bodyOf: (e) => { try { return JSON.parse(e.body || '{}'); } catch (x) { return {}; } } });
stub(lib('email.js'), { sendEmail: async () => ({ sent: false }), emailWrapper: (h) => h, buttonHtml: () => '', escapeHtml: String, GSTIN: 'X' });

const call = async (file, method, body, extra = {}) => {
  const r = await require(fn(file)).handler({ httpMethod: method, body: body && JSON.stringify(body), headers: {}, queryStringParameters: {}, ...extra });
  return { status: r.statusCode, body: JSON.parse(r.body) };
};

(async () => {
  await startPostgres();
  const { getStore, STORES, currentBackend } = require(lib('blob-store.js'));
  const db = require(lib('db.js'));

  // ---- seed Blobs like the live site
  const put = (s, k, v) => rawStore(s).setJSON(k, v);
  await put('catalog', '1', { id: 1, name: 'Tee', cat: 'compression', price: 1200, visible: true, sizes: ['M'] });
  await put('catalog', '2', { id: 2, name: 'Sleeve', cat: 'sleeves', price: 999, visible: true, nested: { b: 1, a: [1, { z: 2, y: null }] } });
  await put('orders', 'order_A', { orderId: 'order_A', status: 'paid', userId: 'u1', createdAt: '2026-10-18T10:00:00Z', paidAt: '2026-10-18T10:01:00Z', items: [], shipping: { email: 'a@x' }, invoice: { number: 'EGS/26-27/00001', date: '2026-10-18T10:01:00Z' } });
  await put('orders', 'order_B', { orderId: 'order_B', status: 'pending', userId: null, createdAt: '2026-10-19T10:00:00Z', items: [], shipping: {}, restoreToken: 'f'.repeat(32) });
  await put('invoices', 'counter/26-27', { last: 2 });
  await put('invoices', 'claim/26-27/1', { orderId: 'order_A' });
  await put('invoices', 'claim/26-27/2', { orderId: 'order_old' });
  await put('reviews', 'r/1/order_A', { productId: 1, status: 'approved', createdAt: '2026-10-19T00:00:00Z', rating: 5 });
  await put('settings', 'coupons', [{ code: 'WELCOME10' }]);
  await put('audit-log', '1_a', { type: 'x', timestamp: '2026-10-19T00:00:00Z' });
  await put('media', 'img.webp', 'binary-ish'); // must never move

  assert.strictEqual(await currentBackend(), 'blobs');
  let r = await call('admin-database.js', 'POST', { action: 'setup' }, { role: 'staff' });
  assert.strictEqual(r.status, 403);
  r = await call('admin-database.js', 'POST', { action: 'setup' });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  await call('admin-database.js', 'POST', { action: 'setup' }); // idempotent

  // copy every store, verify, switch
  for (const store of STORES) {
    r = await call('admin-database.js', 'POST', { action: 'copy', store });
    assert.strictEqual(r.status, 200, store + JSON.stringify(r.body));
    assert.strictEqual(r.body.from, 'blobs');
  }
  for (const store of STORES) {
    r = await call('admin-database.js', 'POST', { action: 'verify', store });
    assert.ok(r.body.ok, JSON.stringify(r.body));
  }
  assert.ok(!(await db.query("SELECT 1 FROM egosynk.kv WHERE store = 'media'")).rows.length);
  assert.deepStrictEqual((await db.query('SELECT fy, last FROM egosynk.invoice_counters')).rows, [{ fy: '26-27', last: 2 }]);

  // drift blocks the switch
  await put('orders', 'order_C', { orderId: 'order_C', status: 'pending', createdAt: '2026-10-20T00:00:00Z', items: [], shipping: {} });
  r = await call('admin-database.js', 'POST', { action: 'switch', to: 'postgres' });
  assert.strictEqual(r.status, 409); assert.match(r.body.error, /orders/);
  await call('admin-database.js', 'POST', { action: 'copy', store: 'orders' });
  r = await call('admin-database.js', 'POST', { action: 'switch', to: 'postgres' });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  assert.strictEqual(await currentBackend(), 'postgres');
  r = await call('admin-database.js', 'POST', { action: 'switch', to: 'postgres' });
  assert.match(r.body.error, /Already/);

  // ---- running on Postgres
  const orders = getStore('orders');
  assert.strictEqual((await orders.get('order_A', { type: 'json' })).userId, 'u1');
  assert.strictEqual(await orders.get('nope', { type: 'json' }), null);
  assert.deepStrictEqual((await orders.list()).blobs.map((b) => b.key), ['order_A', 'order_B', 'order_C']);
  assert.strictEqual((await getStore('reviews').listValues({ prefix: 'r/1/' })).length, 1);
  assert.strictEqual((await getStore('reviews').listValues({ prefix: 'r/2/' })).length, 0);
  assert.strictEqual(typeof (await getStore('settings').get('coupons')), 'string'); // untyped get = text, like Blobs
  const { products } = await require(lib('catalog.js')).getPublicCatalog();
  assert.strictEqual(products.length >= 1, true);
  r = await call('list-orders.js', 'GET');
  assert.deepStrictEqual(r.body.orders.map((o) => o.orderId), ['order_C', 'order_B', 'order_A']);
  r = await call('restore-cart.js', 'GET', null, { queryStringParameters: { t: 'f'.repeat(32) } });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));

  // atomic invoice numbers: concurrent claims for different orders, and a race on one order
  const seqs = await Promise.all(['o1', 'o2', 'o3', 'o4', 'o5'].map((o) => db.claimInvoiceSeq(o, '26-27')));
  assert.deepStrictEqual([...seqs].sort(), [3, 4, 5, 6, 7]);
  const same = await Promise.all([db.claimInvoiceSeq('o9', '26-27'), db.claimInvoiceSeq('o9', '26-27'), db.claimInvoiceSeq('o9', '26-27')]);
  assert.ok(same.every((s) => s === 8), JSON.stringify(same));
  assert.strictEqual(await db.claimInvoiceSeq('o1', '26-27'), seqs[0]);
  assert.strictEqual(await db.claimInvoiceSeq('n1', '27-28'), 1); // new FY restarts

  // full payment path on Postgres → invoice EGS/26-27/00009
  await orders.setJSON('order_D', { orderId: 'order_D', status: 'pending', createdAt: new Date().toISOString(), items: [{ id: 1, name: 'Tee', size: 'M', qty: 1, price: 1200, cat: 'compression' }], subtotal: 1200, discount: 0, shippingFee: 0, amount: 120000, shipping: { name: 'A', email: 'd@x', phone: '9876543210', address1: 'x', city: 'Mumbai', state: 'Maharashtra', stateCode: '27', pincode: '400028' } });
  const paid = await require(lib('orders.js')).markOrderPaid('order_D', 'pay_1', null, 'test');
  const inv = (await orders.get('order_D', { type: 'json' })).invoice;
  assert.ok(paid.newlyPaid); assert.strictEqual(inv.number, 'EGS/26-27/00009');
  assert.strictEqual((await getStore('catalog').get('1', { type: 'json' })).id, 1);

  // copy back to Blobs (series included), verify, switch back
  for (const store of STORES) {
    r = await call('admin-database.js', 'POST', { action: 'copy', store });
    assert.strictEqual(r.body.from, 'postgres', JSON.stringify(r.body));
  }
  assert.deepStrictEqual(await rawStore('invoices').get('counter/26-27', { type: 'json' }), { last: 9 });
  assert.deepStrictEqual(await rawStore('invoices').get('claim/26-27/9', { type: 'json' }), { orderId: 'order_D' });
  assert.ok(await rawStore('orders').get('order_D'));
  r = await call('admin-database.js', 'POST', { action: 'switch', to: 'blobs' });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  assert.strictEqual(await currentBackend(), 'blobs');
  assert.strictEqual(await rawStore('media').get('img.webp', { type: 'json' }), 'binary-ish'); // media untouched

  // Blobs path keeps numbering from where Postgres left off
  await rawStore('orders').setJSON('order_E', { ...(await rawStore('orders').get('order_D', { type: 'json' })), orderId: 'order_E', status: 'pending', invoice: undefined });
  await require(lib('orders.js')).markOrderPaid('order_E', 'pay_2', null, 'test');
  assert.strictEqual((await rawStore('orders').get('order_E', { type: 'json' })).invoice.number, 'EGS/26-27/00010');

  // Reset test data on Postgres clears the series tables
  for (const store of STORES) await call('admin-database.js', 'POST', { action: 'copy', store });
  await call('admin-database.js', 'POST', { action: 'switch', to: 'postgres' });
  r = await call('admin-orders.js', 'POST', { action: 'reset-test', confirm: 'RESET' });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  assert.strictEqual((await db.query('SELECT count(*)::int AS n FROM egosynk.invoice_counters')).rows[0].n, 0);
  assert.strictEqual((await orders.list()).blobs.length, 0);
  assert.strictEqual(await db.claimInvoiceSeq('fresh', '26-27'), 1);

  // emergency override
  process.env.DATA_BACKEND = 'blobs';
  assert.strictEqual(await currentBackend(), 'blobs');
  delete process.env.DATA_BACKEND;

  console.log('ALL PASS');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
