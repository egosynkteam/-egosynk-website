const { getStore } = require('../lib/blob-store');
const { allowRequest } = require('../lib/rate-limit');
const { logEvent } = require('../lib/audit');
const { reviewKey, rebuildSummary } = require('../lib/reviews');

// Verified-buyer reviews from product pages. The buyer proves the purchase with their
// order ID + the email used at checkout; the order must be paid and contain the product.
// Reviews start as `pending` and only appear once approved in admin → Reviews.
//   POST { productId, orderId, email, rating 1–5, title, body, name }
const clean = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!(await allowRequest('submit-review', event, 10, 60 * 60 * 1000))) {
    return bad('Too many attempts — try again later', 429);
  }
  try {
    const b = JSON.parse(event.body || '{}');
    const productId = Number(b.productId);
    const rating = Number(b.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return bad('Pick a star rating');
    const title = clean(b.title, 80);
    const body = String(b.body || '').trim().replace(/\r\n/g, '\n').slice(0, 1500);
    if (body.length < 10) return bad('Tell us a little more (at least 10 characters)');
    const orderId = clean(b.orderId, 40);
    const email = clean(b.email, 200).toLowerCase();
    if (!orderId || !email) return bad('Enter your order ID and the email you ordered with');

    const order = await getStore('orders').get(orderId, { type: 'json' });
    // One message for every mismatch, so this can't be used to probe orders.
    const verified = order && order.status === 'paid' &&
      String((order.shipping && order.shipping.email) || '').toLowerCase() === email &&
      order.items.some((i) => Number(i.id) === productId);
    if (!verified) {
      await logEvent('review_rejected_unverified', email, { productId }, event);
      return bad('We couldn\'t match that order to this product. Check the order ID (starts with "order_") and email.', 403);
    }

    const store = getStore('reviews');
    const key = reviewKey(productId, orderId);
    const existing = await store.get(key, { type: 'json' });
    const item = order.items.find((i) => Number(i.id) === productId);
    const review = {
      key, productId, orderId, email, rating, title, body,
      name: clean(b.name, 40) || (order.shipping && order.shipping.name) || 'Verified buyer',
      size: item && item.size && !/^free size$/i.test(item.size) ? item.size : null,
      status: 'pending',
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await store.setJSON(key, review);
    // An edited review goes back to moderation, so it may leave the public summary.
    if (existing && existing.status === 'approved') await rebuildSummary(productId);
    await logEvent('review_submitted', email, { productId, orderId, rating, edited: !!existing }, event);
    return { statusCode: 200, body: JSON.stringify({ ok: true, edited: !!existing }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Could not save your review' }) };
  }
};

const bad = (error, statusCode = 400) => ({ statusCode, body: JSON.stringify({ error }) });
