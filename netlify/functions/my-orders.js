const { getStore } = require('@netlify/blobs');
const { getSessionUser } = require('../lib/session');

// Order history for the logged-in user's account.html. Matches by userId (attached at
// checkout time when the buyer was logged in) — guest orders have no userId and won't
// show here, which is correct: nothing ties them to an account.
exports.handler = async (event) => {
  try {
    const session = await getSessionUser(event);
    if (!session) return { statusCode: 401, body: JSON.stringify({ error: 'Not logged in' }) };

    const store = getStore('orders');
    const { blobs } = await store.list();

    const orders = [];
    for (const b of blobs) {
      const order = await store.get(b.key, { type: 'json' });
      if (order && order.status === 'paid' && order.userId === session.user.id) {
        orders.push({
          orderId: order.orderId,
          items: order.items,
          amount: order.amount,
          paidAt: order.paidAt,
        });
      }
    }
    orders.sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));

    return { statusCode: 200, body: JSON.stringify({ orders }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Could not load orders' }) };
  }
};
