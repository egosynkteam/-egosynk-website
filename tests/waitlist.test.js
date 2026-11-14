// "Join the drop" waitlist: validation, honeypot, de-duplication, opt-in merge, count,
// confirmation email (once), and the signed "leave the list" link.
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
let emailOn = true;
const sent = [];
stub(lib('email.js'), { sendEmail: async (m) => { sent.push(m); return emailOn ? { sent: true } : { sent: false, reason: 'not_configured' }; },
  emailWrapper: (h) => h, buttonHtml: (u, t) => `<a href="${u}">${t}</a>`, escapeHtml: String, GSTIN: 'X' });

const { handler } = require(fn('drop-waitlist.js'));
const { list, leaveToken, toCsv } = require(lib('waitlist.js'));
const post = (body) => handler({ httpMethod: 'POST', body: JSON.stringify(body), headers: {} });
const leave = (q) => handler({ httpMethod: 'GET', queryStringParameters: q, headers: {} });
const json = (r) => JSON.parse(r.body);

(async () => {
  assert.strictEqual((await handler({ httpMethod: 'PUT' })).statusCode, 405);
  assert.strictEqual((await post({ product: 'nope', email: 'a@b.co' })).statusCode, 404);
  assert.strictEqual((await post({ product: 'hydro-150', email: 'not-an-email' })).statusCode, 400);
  assert.strictEqual((await post({ product: 'hydro-150', email: 'a@b.co', phone: 'call me' })).statusCode, 400);

  // Honeypot: accepted, not stored, no email.
  const bot = await post({ product: 'hydro-150', email: 'bot@spam.co', website: 'http://x' });
  assert.strictEqual(bot.statusCode, 200);
  assert.strictEqual((await list('hydro-150')).length, 0);
  assert.strictEqual(sent.length, 0);

  let r = await post({ product: 'hydro-150', email: ' Lifter@Example.com ', phone: '' });
  assert.strictEqual(r.statusCode, 200);
  assert.deepStrictEqual([json(r).position, json(r).added], [1, true]);
  assert.strictEqual(sent.length, 1, 'confirmation email on first sign-up');
  assert.strictEqual(sent[0].to, 'lifter@example.com');
  assert.match(sent[0].subject, /HYDRO 150/);
  assert.match(sent[0].html, /number <b>1<\/b>/);
  assert.match(sent[0].html, /only email you about this drop/);
  assert.match(sent[0].html, /drop-waitlist\?leave=1&p=hydro-150&e=lifter%40example\.com&t=[0-9a-f]{32}/);
  assert.ok((await list('hydro-150'))[0].confirmedEmailAt, 'send is recorded');

  // Same person again (different case): no duplicate, no second email, but the phone and opt-in are added.
  r = await post({ product: 'hydro-150', email: 'lifter@example.com', phone: '+91 98765 43210', consent: true });
  assert.deepStrictEqual([json(r).position, json(r).added], [1, false]);
  assert.strictEqual(sent.length, 1);
  let rows = await list('hydro-150');
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].phone, '+91 98765 43210');
  assert.strictEqual(rows[0].marketing, true);
  assert.ok(rows[0].confirmedEmailAt, 'merge keeps the confirmation record');

  // A later sign-up without consent never removes an earlier opt-in.
  await post({ product: 'hydro-150', email: 'lifter@example.com' });
  assert.strictEqual((await list('hydro-150'))[0].marketing, true);

  // Lists are per product. With email not configured, the send isn't recorded (so it can't be lost).
  emailOn = false;
  r = await post({ product: 'bold', email: 'lifter@example.com' });
  assert.strictEqual(json(r).position, 1);
  assert.match(sent[sent.length - 1].subject, /BOLD/);
  assert.strictEqual((await list('bold'))[0].confirmedEmailAt, undefined);
  emailOn = true;
  r = await post({ product: 'hydro-150', email: 'second@example.com', consent: true });
  assert.strictEqual(json(r).position, 2);
  assert.match(sent[sent.length - 1].html, /other EGOSYNK launches/);
  rows = await list('hydro-150');
  assert.strictEqual(rows[1].marketing, true);
  assert.strictEqual(events.filter((e) => e[0] === 'waitlist_signup').length, 3);

  // Leave link: a forged or mismatched token does nothing; the real one removes only that list.
  assert.strictEqual((await leave({ leave: '1', p: 'hydro-150', e: 'second@example.com', t: '0'.repeat(32) })).statusCode, 400);
  assert.strictEqual((await leave({ leave: '1', p: 'hydro-150', e: 'second@example.com', t: leaveToken('bold', 'second@example.com') })).statusCode, 400);
  assert.strictEqual((await list('hydro-150')).length, 2);
  r = await leave({ leave: '1', p: 'hydro-150', e: 'Lifter@Example.com', t: leaveToken('hydro-150', 'lifter@example.com') });
  assert.strictEqual(r.statusCode, 200);
  assert.match(r.body, /left the HYDRO 150 drop list/);
  assert.deepStrictEqual((await list('hydro-150')).map((x) => x.email), ['second@example.com']);
  assert.strictEqual((await list('bold')).length, 1, 'other lists untouched');

  // CSV: header, IST time, and formula-looking cells neutralised.
  const csv = toCsv([{ at: '2026-11-08T10:00:00.000Z', email: 'x@y.co', phone: '+91 98765 43210', marketing: false, product: 'bold' }, { at: '2026-11-08T10:00:00.000Z', email: '=HYPERLINK("x")@y.co', phone: '', marketing: true, product: 'bold' }]);
  const lines = csv.trim().split('\r\n');
  assert.strictEqual(lines.length, 3);
  assert.match(lines[0], /^Signed up \(IST\),Email,WhatsApp/);
  assert.match(lines[1], /3:30:00 pm/i);
  assert.match(lines[1], /'\+91 98765 43210/);
  assert.match(lines[2], /"'=HYPERLINK\(""x""\)@y\.co"/);

  allow = false;
  assert.strictEqual((await post({ product: 'hydro-150', email: 'c@d.co' })).statusCode, 429);

  console.log('waitlist ok');
})().catch((e) => { console.error(e); process.exit(1); });
