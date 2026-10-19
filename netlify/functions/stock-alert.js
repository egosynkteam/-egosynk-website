const { getStore } = require('../lib/blob-store');
const { allowRequest } = require('../lib/rate-limit');
const { logEvent } = require('../lib/audit');
const { addAlert } = require('../lib/stock-alerts');

// Product page "Notify me when back in stock". POST { productId, size?, email }.
// Only accepted for a size that is actually sold out (or a product switched off), so the
// list can't be filled with sign-ups for things already on sale.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!(await allowRequest('stock-alert', event, 20, 60 * 60 * 1000))) {
    return bad('Too many sign-ups — try again later', 429);
  }
  try {
    const b = JSON.parse(event.body || '{}');
    const email = String(b.email || '').trim().toLowerCase().slice(0, 200);
    if (!EMAIL.test(email)) return bad('Enter a valid email');

    const product = await getStore('catalog').get(String(Number(b.productId)), { type: 'json' });
    if (!product || product.visible === false) return bad('Product not found', 404);

    const size = b.size ? String(b.size).slice(0, 20) : null;
    if (size && !(product.sizes || []).includes(size)) return bad('Pick a size');
    const m = product.stockBySize;
    const soldOut = product.available === false || (size && m && Number.isFinite(m[size]) && m[size] <= 0);
    if (!soldOut) return bad('That size is in stock — you can order it now');

    await addAlert(product.id, product.available === false ? null : size, email);
    await logEvent('stock_alert_signup', email, { productId: product.id, size }, event);
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error(err);
    return bad('Could not sign you up', 500);
  }
};

const bad = (error, statusCode = 400) => ({ statusCode, body: JSON.stringify({ error }) });
