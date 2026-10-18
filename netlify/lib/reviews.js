const { getStore } = require('./blob-store');

// Product reviews, from verified buyers only and shown after admin approval.
// Stored in the `reviews` store as `r/<productId>/<orderId>` — one review per product per
// order, so a buyer edits by resubmitting rather than stacking reviews. A `summary` blob
// keeps { [productId]: { avg, count } } of APPROVED reviews for cards and rich results.
const STATUSES = ['pending', 'approved', 'rejected'];
const reviewKey = (productId, orderId) => `r/${Number(productId)}/${String(orderId)}`;

async function listReviews({ productId, status } = {}) {
  const store = getStore('reviews');
  const prefix = productId != null ? `r/${Number(productId)}/` : 'r/';
  const { blobs } = await store.list({ prefix });
  const all = (await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' })))).filter(Boolean);
  return all
    .filter((r) => !status || r.status === status)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// Public shape: no email, no order id, first name + initial only.
function publicReview(r) {
  const parts = String(r.name || 'Verified buyer').trim().split(/\s+/);
  const shortName = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
  return { rating: r.rating, title: r.title, body: r.body, name: shortName, size: r.size || null,
    createdAt: r.createdAt, reply: r.reply || null };
}

async function getSummary() {
  return (await getStore('reviews').get('summary', { type: 'json' })) || {};
}

async function rebuildSummary(productId) {
  const store = getStore('reviews');
  const approved = await listReviews({ productId, status: 'approved' });
  const summary = await getSummary();
  if (approved.length) {
    const avg = approved.reduce((a, r) => a + r.rating, 0) / approved.length;
    summary[productId] = { avg: Math.round(avg * 10) / 10, count: approved.length };
  } else {
    delete summary[productId];
  }
  await store.setJSON('summary', summary);
  return summary[productId] || null;
}

module.exports = { STATUSES, reviewKey, listReviews, publicReview, getSummary, rebuildSummary };
