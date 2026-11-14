// Launch bundles: placeholder defaults, validation, permissions, and what the storefront sees.
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
stub(lib('blob-store.js'), { getStore, currentBackend: async () => 'blobs', STORES: [] });
let purged = 0;
stub(lib('cdn.js'), { purgeCatalog: async () => { purged++; }, CATALOG_HEADERS: {} });
stub(lib('audit.js'), { logEvent: async () => {} });
let perms = ['catalog', 'prices'];
stub(lib('admin-auth.js'), { requireAdmin: async (e, p) => (perms.includes(p) ? { admin: { email: 'o@x.com' } } : { response: { statusCode: 403, body: '{}' } }) });

const { DEFAULT_BUNDLES, cleanBundles, publicBundles } = require(lib('bundles.js'));
const handler = require(fn('admin-bundles.js')).handler;
const save = (bundles) => handler({ httpMethod: 'POST', body: JSON.stringify({ bundles }), headers: {} });
const err = async (bundles) => JSON.parse((await save(bundles)).body).error;

(async () => {
  // Defaults: placeholders, all "coming", none marked final, MRP above price where set.
  assert.strictEqual(DEFAULT_BUNDLES.length, 3);
  assert.ok(DEFAULT_BUNDLES.every((b) => b.status === 'coming' && !b.priceFinal && (b.mrp == null || b.mrp > b.price)));
  assert.deepStrictEqual(cleanBundles(DEFAULT_BUNDLES).value, DEFAULT_BUNDLES, 'defaults pass their own validation');

  let r = await handler({ httpMethod: 'GET', headers: {} });
  assert.strictEqual(JSON.parse(r.body).bundles.length, 3);

  const base = { id: 'starter', name: 'Starter', items: ['Tub', 'Shaker'], price: 1799, mrp: 1998, art: 'tub-shaker', status: 'coming' };
  assert.match(await err([{ ...base, price: 'abc' }]), /whole rupees/);
  assert.match(await err([{ ...base, mrp: 1500 }]), /MRP must be more/);
  assert.match(await err([{ ...base, items: [] }]), /what's in it/);
  assert.match(await err([base, { ...base }]), /used twice/);
  assert.match(await err([{ ...base, status: 'live' }]), /link it to its product/);

  // Save: ids normalised, empty MRP allowed, unknown art falls back, slug kept only when valid.
  r = await save([{ ...base, id: ' Hydro Starter! ', mrp: '', art: 'nope', productSlug: 'not a slug' }, { ...base, id: 'live-one', status: 'live', productSlug: 'hydro-starter-17' }, { ...base, id: 'secret', status: 'hidden' }]);
  assert.strictEqual(r.statusCode, 200, r.body);
  const saved = JSON.parse(r.body).bundles;
  assert.deepStrictEqual(saved.map((b) => b.id), ['hydro-starter', 'live-one', 'secret']);
  assert.strictEqual(saved[0].mrp, null);
  assert.strictEqual(saved[0].art, 'tub');
  assert.strictEqual(saved[0].productSlug, '');
  assert.strictEqual(purged, 1, 'storefront catalog cache purged');

  // Storefront view: hidden dropped, product link only on live bundles.
  const pub = publicBundles(saved);
  assert.deepStrictEqual(pub.map((b) => b.id), ['hydro-starter', 'live-one']);
  assert.strictEqual('productSlug' in pub[0], false);
  assert.strictEqual(pub[1].productSlug, 'hydro-starter-17');

  // Saving needs the prices permission; viewing needs catalog.
  perms = ['catalog'];
  assert.strictEqual((await save(saved)).statusCode, 403);
  assert.strictEqual((await handler({ httpMethod: 'GET', headers: {} })).statusCode, 200);

  console.log('bundles ok');
})().catch((e) => { console.error(e); process.exit(1); });
