const { getStore } = require('../lib/blob-store');
const { findAndEvaluate } = require('../lib/coupons');
const { allowRequest } = require('../lib/rate-limit');

// Checks a discount code against the shopper's bag so the bag can show the saving before
// checkout. Prices come from the catalog, not the browser. create-order re-checks the
// code itself, so this is only a preview.
//   POST { code, cart: [{ id, qty }] } -> { code, discount } | { error }
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  // Slows down anyone trying to guess codes.
  if (!(await allowRequest('apply-coupon', event, 20, 10 * 60 * 1000))) {
    return { statusCode: 429, body: JSON.stringify({ error: 'Too many attempts — try again in a few minutes' }) };
  }
  try {
    const { code, cart } = JSON.parse(event.body || '{}');
    if (!Array.isArray(cart) || !cart.length) return bad('Your bag is empty');
    const catalog = getStore('catalog');
    let subtotal = 0;
    for (const item of cart) {
      const p = await catalog.get(String(item.id), { type: 'json' });
      if (p && Number.isInteger(item.qty) && item.qty > 0) subtotal += p.price * item.qty;
    }
    const result = await findAndEvaluate(code, subtotal);
    if (result.error) return bad(result.error);
    return { statusCode: 200, body: JSON.stringify({ code: result.coupon.code, discount: result.discount }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Could not check the code' }) };
  }
};

const bad = (error) => ({ statusCode: 400, body: JSON.stringify({ error }) });
