const crypto = require('crypto');
const { allowRequest } = require('../lib/rate-limit');
const { logEvent } = require('../lib/audit');
const { PRODUCTS, join, remove, count, leaveToken, sendConfirmation } = require('../lib/waitlist');

// Storefront "Join the drop".
//   POST { product, email, phone?, consent?, website? } -> { ok, position, added }
//   GET  ?leave=1&p=<product>&e=<email>&t=<token>        -> "you've left the list" page
// `website` is a honeypot field people never see: anything in it is treated as a bot and
// quietly accepted without being stored. `consent` is the optional marketing opt-in; without
// it the email is only used for this product's launch.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?[0-9][0-9\s-]{8,15}$/;

exports.handler = async (event) => {
  if (event.httpMethod === 'GET') return leave(event);
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!(await allowRequest('drop-waitlist', event, 10, 60 * 60 * 1000))) {
    return bad('Too many sign-ups from here. Try again later.', 429);
  }
  try {
    const b = JSON.parse(event.body || '{}');
    if (b.website) return ok({ position: null });

    const product = String(b.product || '');
    if (!PRODUCTS[product]) return bad('Unknown product', 404);
    const email = String(b.email || '').trim().toLowerCase().slice(0, 200);
    if (!EMAIL.test(email)) return bad('Enter a valid email');
    const phone = String(b.phone || '').trim().slice(0, 20);
    if (phone && !PHONE.test(phone)) return bad('Check the WhatsApp number, or leave it blank');

    const { added, record } = await join(product, { email, phone, marketing: b.consent === true, source: (event.headers && event.headers.referer) || '' });
    const position = await count(product);
    if (added) {
      await logEvent('waitlist_signup', email, { product }, event);
      // A failed email never fails the sign-up; it just isn't marked as sent.
      try { await sendConfirmation(record, position); } catch (err) { console.error('waitlist email', err); }
    }
    return ok({ position, added });
  } catch (err) {
    console.error(err);
    return bad('Could not add you. Try again in a minute.', 500);
  }
};

async function leave(event) {
  const q = event.queryStringParameters || {};
  const product = String(q.p || '');
  const email = String(q.e || '').trim().toLowerCase();
  const expected = PRODUCTS[product] && email ? leaveToken(product, email) : '';
  const valid = !!expected && typeof q.t === 'string' && q.t.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(q.t), Buffer.from(expected));
  if (valid && (await remove(product, email))) await logEvent('waitlist_leave', email, { product }, event);
  const name = PRODUCTS[product] ? PRODUCTS[product].name : 'the';
  return {
    statusCode: valid ? 200 : 400,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex' },
    body: `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>EGOSYNK</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0D0E10;color:#EDEAE3;font-family:system-ui,sans-serif;text-align:center;padding:24px">
<div><h1 style="font-size:20px;letter-spacing:.04em"><span style="color:#C41E3A">EGO</span>SYNK</h1>
<p>${valid ? `You've left the ${name} drop list. We won't email you about it again.` : "This link isn't valid."}</p>
<p><a href="/" style="color:#E63950">Back to the store →</a></p></div></body>`,
  };
}

const ok = (body) => ({ statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, ...body }) });
const bad = (error, statusCode = 400) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error }) });
