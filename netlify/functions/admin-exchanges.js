const { getStore } = require('../lib/blob-store');
const { isAdminAuthorized } = require('../lib/admin-auth');
const { logEvent } = require('../lib/audit');
const { ADMIN_STATUSES, emailStatusUpdate } = require('../lib/exchanges');

// admin.html → Orders: move a customer's exchange/issue request along. Body:
//   { orderId, status: 'approved'|'rejected'|'completed', note? }
// `note` is shown to the customer (in their email and on My Orders) — use it for pickup
// or return-address details, or the reason for a rejection. The customer is emailed
// each time the status changes; saving the same status again only updates the note.
exports.handler = async (event) => {
  if (!(await isAdminAuthorized(event))) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const body = JSON.parse(event.body || '{}');
    if (!ADMIN_STATUSES.includes(body.status)) return bad(`Status must be one of: ${ADMIN_STATUSES.join(', ')}`);

    const store = getStore('orders');
    const order = await store.get(String(body.orderId || ''), { type: 'json' });
    if (!order) return bad('Order not found', 404);
    if (!order.exchange) return bad('This order has no exchange request');

    const ex = order.exchange;
    const changed = ex.status !== body.status;
    const now = new Date().toISOString();
    ex.status = body.status;
    ex.adminNote = String(body.note || '').trim().slice(0, 500) || ex.adminNote || null;
    ex.updatedAt = now;
    if (changed) ex.history = [...(ex.history || []), { status: body.status, at: now }];

    const email = changed ? await emailStatusUpdate(order) : { sent: false, reason: 'unchanged' };
    await store.setJSON(order.orderId, order);
    await logEvent('exchange_' + body.status, 'admin', { orderId: order.orderId, emailed: email.sent }, event);
    return { statusCode: 200, body: JSON.stringify({ order, email }) };
  } catch (err) {
    console.error(err);
    return bad('Exchange update failed', 500);
  }
};

const bad = (error, statusCode = 400) => ({ statusCode, body: JSON.stringify({ error }) });
