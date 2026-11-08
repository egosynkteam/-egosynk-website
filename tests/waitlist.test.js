// "Join the drop" waitlist: validation, honeypot, de-duplication, opt-in merge and count.
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
stub(lib('blob-store.js'), { getStore, currentBackend: async () => 'blobs', STORES: [] });
let allow = true;
stub(lib('rate-limit.js'), { allowRequest: async () => allow });
const events = [];
stub(lib('audit.js'), { logEvent: async (...a) => { events.push(a); } });

const { handler } = require(fn('drop-waitlist.js'));
const { list } = require(lib('waitlist.js'));
const post = (body) => handler({ httpMethod: 'POST', body: JSON.stringify(body), headers: {} });
const json = (r) => JSON.parse(r.body);

(async () => {
  assert.strictEqual((await handler({ httpMethod: 'GET' })).statusCode, 405);
  assert.strictEqual((await post({ product: 'nope', email: 'a@b.co' })).statusCode, 404);
  assert.strictEqual((await post({ product: 'hydro-150', email: 'not-an-email' })).statusCode, 400);
  assert.strictEqual((await post({ product: 'hydro-150', email: 'a@b.co', phone: 'call me' })).statusCode, 400);

  // Honeypot: accepted, not stored.
  const bot = await post({ product: 'hydro-150', email: 'bot@spam.co', website: 'http://x' });
  assert.strictEqual(bot.statusCode, 200);
  assert.strictEqual((await list('hydro-150')).length, 0);

  let r = await post({ product: 'hydro-150', email: ' Lifter@Example.com ', phone: '' });
  assert.strictEqual(r.statusCode, 200);
  assert.deepStrictEqual([json(r).position, json(r).added], [1, true]);

  // Same person again (different case): no duplicate, but the phone and opt-in are added.
  r = await post({ product: 'hydro-150', email: 'lifter@example.com', phone: '+91 98765 43210', consent: true });
  assert.deepStrictEqual([json(r).position, json(r).added], [1, false]);
  let rows = await list('hydro-150');
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].email, 'lifter@example.com');
  assert.strictEqual(rows[0].phone, '+91 98765 43210');
  assert.strictEqual(rows[0].marketing, true);

  // A later sign-up without consent never removes an earlier opt-in.
  await post({ product: 'hydro-150', email: 'lifter@example.com' });
  assert.strictEqual((await list('hydro-150'))[0].marketing, true);

  // Lists are per product.
  r = await post({ product: 'bold', email: 'lifter@example.com' });
  assert.strictEqual(json(r).position, 1);
  r = await post({ product: 'hydro-150', email: 'second@example.com' });
  assert.strictEqual(json(r).position, 2);
  rows = await list('hydro-150');
  assert.strictEqual(rows[1].marketing, false);
  assert.strictEqual(events.filter((e) => e[0] === 'waitlist_signup').length, 3);

  allow = false;
  assert.strictEqual((await post({ product: 'hydro-150', email: 'c@d.co' })).statusCode, 429);

  console.log('waitlist ok');
})().catch((e) => { console.error(e); process.exit(1); });
