// Batch lab reports: validation, drafts stay private, PDF upload checks, public view, report access.
const path = require('path');
const assert = require('assert');
const ROOT = path.resolve(__dirname, '..');
const lib = (f) => path.join(ROOT, 'netlify', 'lib', f);
const fn = (f) => path.join(ROOT, 'netlify', 'functions', f);

const stores = {};
function getStore(name) {
  const m = (stores[name] = stores[name] || new Map());
  return {
    async get(k, o) { const v = m.get(k); return v === undefined ? null : (o && o.type === 'json' ? JSON.parse(v.data) : v.data); },
    async getWithMetadata(k) { const v = m.get(k); return v ? { data: v.data, metadata: v.metadata } : null; },
    async set(k, data, o) { m.set(k, { data, metadata: (o && o.metadata) || {} }); },
    async setJSON(k, v) { m.set(k, { data: JSON.stringify(v) }); },
    async delete(k) { m.delete(k); },
    async list(o = {}) { return { blobs: [...m.keys()].filter((k) => !o.prefix || k.startsWith(o.prefix)).map((key) => ({ key })) }; },
    async listValues(o = {}) { return [...m.keys()].filter((k) => !o.prefix || k.startsWith(o.prefix)).map((key) => ({ key, value: JSON.parse(m.get(key).data) })); },
  };
}
const stub = (file, exports) => { require.cache[require.resolve(file)] = { id: file, filename: file, loaded: true, exports }; };
stub(lib('blob-store.js'), { getStore, blobsStore: getStore, currentBackend: async () => 'blobs', STORES: [] });
let allow = true;
stub(lib('rate-limit.js'), { allowRequest: async () => allow });
const events = [];
stub(lib('audit.js'), { logEvent: async (...a) => { events.push(a); } });
let role = { email: 'owner@x.com', permissions: ['batches'] };
stub(lib('admin-auth.js'), {
  requireAdmin: async (event, perm) => (role.permissions.includes(perm)
    ? { admin: role } : { response: { statusCode: 403, body: JSON.stringify({ error: 'Not allowed' }) } }),
});

const admin = (body) => require(fn('admin-batches.js')).handler({ httpMethod: 'POST', body: JSON.stringify(body), headers: {} });
const lookup = (code) => require(fn('get-batch.js')).handler({ httpMethod: 'GET', queryStringParameters: { code }, headers: {} });
const report = (p) => require(fn('batch-report.js')).handler({ httpMethod: 'GET', path: p, headers: {} });
const body = (r) => JSON.parse(r.body);
const PDF = Buffer.from('%PDF-1.4\n% test report\n%%EOF').toString('base64');

const good = {
  code: ' h150-2702-01 ', product: 'hydro-150', mfg: '2027-02', expiry: '2029-01', lab: 'Test Lab Pvt Ltd', reportDate: '2027-02-20',
  results: [{ test: 'Caffeine', label: '150 mg', found: '148 mg', ok: true }, { test: '', label: 'dropped', found: '', ok: true }],
};

(async () => {
  // Validation
  assert.match(body(await admin({ action: 'save', batch: { ...good, code: 'x' } })).error, /Batch code/);
  assert.match(body(await admin({ action: 'save', batch: { ...good, product: 'nope' } })).error, /product/);
  assert.match(body(await admin({ action: 'save', batch: { ...good, mfg: '2027-13' } })).error, /Manufactured/);
  assert.match(body(await admin({ action: 'save', batch: { ...good, expiry: '2027-01' } })).error, /Best before/);
  assert.match(body(await admin({ action: 'save', batch: { ...good, results: [], published: true } })).error, /before publishing/);

  // Create as a draft: normalised, empty result rows dropped, not public yet.
  let r = await admin({ action: 'save', batch: good });
  assert.strictEqual(r.statusCode, 200, r.body);
  assert.strictEqual(body(r).batch.code, 'H150-2702-01');
  assert.strictEqual(body(r).batch.results.length, 1);
  assert.strictEqual((await lookup('H150-2702-01')).statusCode, 404, 'drafts are private');
  assert.match(body(await admin({ action: 'save', batch: good })).error, /already exists/);

  // PDF upload: must be a PDF, under 4 MB; replaces the previous file.
  assert.match(body(await admin({ action: 'upload-report', code: 'H150-2702-01', data: Buffer.from('hello').toString('base64') })).error, /PDF/);
  assert.match(body(await admin({ action: 'upload-report', code: 'NOPE-1', data: PDF })).error, /Save the batch first/);
  r = await admin({ action: 'upload-report', code: 'h150-2702-01', data: PDF });
  const firstKey = body(r).batch.reportKey;
  assert.match(firstKey, /^H150-2702-01-[a-f0-9]{12}\.pdf$/);
  r = await admin({ action: 'upload-report', code: 'H150-2702-01', data: PDF });
  const key = body(r).batch.reportKey;
  assert.notStrictEqual(key, firstKey);
  assert.strictEqual(stores['batch-reports'].has(firstKey), false, 'old report removed');
  assert.strictEqual((await report(`/batch-report/${key}`)).statusCode, 404, 'draft report is private');

  // Edit and publish; the code can't change.
  assert.match(body(await admin({ action: 'save', originalCode: 'H150-2702-01', batch: { ...good, code: 'H150-OTHER' } })).error, /can't be changed/);
  r = await admin({ action: 'save', originalCode: 'H150-2702-01', batch: { ...good, published: true, notes: 'Heavy metals within limits.' } });
  assert.strictEqual(r.statusCode, 200);
  assert.strictEqual(body(r).batch.reportKey, key, 'edit keeps the report');

  // Public lookup: case-insensitive, no internal fields.
  r = await lookup(' h150-2702-01 ');
  assert.strictEqual(r.statusCode, 200);
  const pub = body(r).batch;
  assert.strictEqual(pub.productName, 'HYDRO 150');
  assert.strictEqual(pub.reportUrl, `/batch-report/${key}`);
  assert.strictEqual(pub.published, undefined);
  assert.strictEqual(pub.reportKey, undefined);
  assert.strictEqual((await lookup('../../etc')).statusCode, 404);

  // Report: served as PDF while published; a made-up key for the same batch is refused.
  r = await report(`/batch-report/${key}`);
  assert.strictEqual(r.statusCode, 200);
  assert.strictEqual(r.headers['Content-Type'], 'application/pdf');
  assert.strictEqual(Buffer.from(r.body, 'base64').subarray(0, 5).toString(), '%PDF-');
  assert.strictEqual((await report('/batch-report/H150-2702-01-000000000000.pdf')).statusCode, 404);
  assert.strictEqual((await report('/batch-report/..%2Fsecret.pdf')).statusCode, 404);

  // Permission and rate limit
  role = { email: 'staff@x.com', permissions: ['orders'] };
  assert.strictEqual((await admin({ action: 'delete', code: 'H150-2702-01' })).statusCode, 403);
  role = { email: 'owner@x.com', permissions: ['batches'] };
  allow = false;
  assert.strictEqual((await lookup('H150-2702-01')).statusCode, 429);
  allow = true;

  // Delete removes the record and its PDF.
  assert.strictEqual((await admin({ action: 'delete', code: 'H150-2702-01' })).statusCode, 200);
  assert.strictEqual((await lookup('H150-2702-01')).statusCode, 404);
  assert.strictEqual(stores['batch-reports'].size, 0);
  assert.ok(events.some((e) => e[0] === 'batch_saved') && events.some((e) => e[0] === 'batch_deleted'));

  console.log('batches ok');
})().catch((e) => { console.error(e); process.exit(1); });
