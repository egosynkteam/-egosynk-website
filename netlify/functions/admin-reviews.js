const { getStore } = require('../lib/blob-store');
const { isAdminAuthorized } = require('../lib/admin-auth');
const { logEvent } = require('../lib/audit');
const { STATUSES, listReviews, rebuildSummary } = require('../lib/reviews');

// Review moderation for admin.html → Reviews.
//   GET  ?status=pending|approved|rejected  -> { reviews }
//   POST { action: 'moderate', key, status, reply? }  -> approve / reject (+ optional public reply)
//   POST { action: 'delete', key }
exports.handler = async (event) => {
  if (!(await isAdminAuthorized(event))) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  const store = getStore('reviews');
  try {
    if (event.httpMethod === 'GET') {
      const status = event.queryStringParameters && event.queryStringParameters.status;
      const reviews = await listReviews({ status: STATUSES.includes(status) ? status : undefined });
      return { statusCode: 200, body: JSON.stringify({ reviews }) };
    }
    if (event.httpMethod === 'POST') {
      const b = JSON.parse(event.body || '{}');
      if (!/^r\/\d+\/[\w-]+$/.test(String(b.key || ''))) return bad('Bad review key');
      const review = await store.get(b.key, { type: 'json' });
      if (!review) return bad('Review not found', 404);

      if (b.action === 'moderate') {
        if (!['approved', 'rejected'].includes(b.status)) return bad('Status must be approved or rejected');
        review.status = b.status;
        if (b.reply !== undefined) review.reply = String(b.reply || '').trim().slice(0, 600) || null;
        review.moderatedAt = new Date().toISOString();
        await store.setJSON(b.key, review);
      } else if (b.action === 'delete') {
        await store.delete(b.key);
      } else {
        return bad('Unknown action');
      }
      const summary = await rebuildSummary(review.productId);
      await logEvent(`review_${b.action === 'delete' ? 'deleted' : b.status}`, 'admin', { key: b.key }, event);
      return { statusCode: 200, body: JSON.stringify({ review: b.action === 'delete' ? null : review, summary }) };
    }
    return { statusCode: 405, body: 'Method Not Allowed' };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Review request failed' }) };
  }
};

const bad = (error, statusCode = 400) => ({ statusCode, body: JSON.stringify({ error }) });
