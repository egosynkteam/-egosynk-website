const { allowRequest } = require('../lib/rate-limit');
const { logEvent } = require('../lib/audit');
const { PRODUCTS, join, count } = require('../lib/waitlist');

// Storefront "Join the drop". POST { product, email, phone?, consent?, website? }.
// `website` is a honeypot field people never see: anything in it is treated as a bot and
// quietly accepted without being stored. `consent` is the optional marketing opt-in; without
// it the email is only used for this product's launch.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?[0-9][0-9\s-]{8,15}$/;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!(await allowRequest('drop-waitlist', event, 10, 60 * 60 * 1000))) {
    return bad('Too many sign-ups from here. Try again later.', 429);
  }
  try {
    const b = JSON.parse(event.body || '{}');
    if (b.website) return ok({ position: null });

    const product = String(b.product || '');
    if (!PRODUCTS.has(product)) return bad('Unknown product', 404);
    const email = String(b.email || '').trim().toLowerCase().slice(0, 200);
    if (!EMAIL.test(email)) return bad('Enter a valid email');
    const phone = String(b.phone || '').trim().slice(0, 20);
    if (phone && !PHONE.test(phone)) return bad('Check the WhatsApp number, or leave it blank');

    const { added } = await join(product, { email, phone, marketing: b.consent === true, source: (event.headers && event.headers.referer) || '' });
    if (added) await logEvent('waitlist_signup', email, { product }, event);
    return ok({ position: await count(product), added });
  } catch (err) {
    console.error(err);
    return bad('Could not add you. Try again in a minute.', 500);
  }
};

const ok = (body) => ({ statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, ...body }) });
const bad = (error, statusCode = 400) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error }) });
