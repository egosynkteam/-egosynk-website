const { getStore } = require('../lib/blob-store');
const { allowRequest } = require('../lib/rate-limit');

// Refills the bag from an abandoned-checkout email link (/?restore=<token>). Returns only
// product ids, sizes and quantities — the storefront re-prices everything from the live
// catalog — and only for orders that are still unpaid.
exports.handler = async (event) => {
  const t = event.queryStringParameters && event.queryStringParameters.t;
  if (!t || !/^[a-f0-9]{32}$/.test(t)) return { statusCode: 400, body: JSON.stringify({ error: 'Bad link' }) };
  if (!(await allowRequest('restore-cart', event, 30, 10 * 60 * 1000))) return { statusCode: 429, body: '{}' };
  try {
    const store = getStore('orders');
    for (const b of (await store.list()).blobs) {
      const o = await store.get(b.key, { type: 'json' });
      if (o && o.restoreToken === t) {
        if (o.status !== 'pending') return { statusCode: 410, body: JSON.stringify({ error: 'This order was already completed' }) };
        return {
          statusCode: 200,
          body: JSON.stringify({ items: o.items.map((i) => ({ id: i.id, size: i.size, qty: i.qty })), coupon: o.coupon || null }),
        };
      }
    }
    return { statusCode: 404, body: JSON.stringify({ error: 'Link expired' }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: '{}' };
  }
};
