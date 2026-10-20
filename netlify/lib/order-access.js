const crypto = require('crypto');
const { getSessionUser } = require('./session');
const { getAdmin } = require('./admin-auth');

// Who may see an order's receipt or invoice (they include the delivery address):
//  - whoever holds its view key `k` (given to the buyer after payment and in the order
//    email's invoice link),
//  - the signed-in customer who placed it,
//  - a signed-in admin.
// The key is an HMAC of the order id, so it can't be guessed from the id. ORDER_VIEW_SECRET
// can be set in Netlify; otherwise the Razorpay secret is used (with a purpose prefix).
function secret() {
  return process.env.ORDER_VIEW_SECRET || process.env.RAZORPAY_KEY_SECRET || '';
}

function viewKey(orderId) {
  if (!secret()) throw new Error('No secret for order view keys');
  return crypto.createHmac('sha256', secret()).update(`order-view:${orderId}`).digest('hex').slice(0, 32);
}

function keyMatches(orderId, k) {
  if (!k || !secret()) return false;
  const a = Buffer.from(String(k));
  const b = Buffer.from(viewKey(orderId));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function canViewOrder(event, order) {
  const q = event.queryStringParameters || {};
  if (keyMatches(order.orderId, q.k)) return true;
  const session = await getSessionUser(event);
  if (session && order.userId && session.user.id === order.userId) return true;
  return !!(await getAdmin(event));
}

module.exports = { viewKey, keyMatches, canViewOrder };
