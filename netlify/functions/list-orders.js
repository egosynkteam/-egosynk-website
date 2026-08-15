const { getStore } = require('../lib/blob-store');
const { isAdminAuthorized } = require('../lib/admin-auth');

// Protected endpoint backing admin.html's Orders tab. Gate is a shared-secret header
// checked against an env var — set ADMIN_SECRET in Netlify before using this.
// Not a real auth system: fine for a solo founder checking orders, not for a multi-user team.
exports.handler = async (event) => {
  if (!isAdminAuthorized(event)) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const store = getStore('orders');
    const { blobs } = await store.list();

    const orders = [];
    for (const b of blobs) {
      const order = await store.get(b.key, { type: 'json' });
      if (order) orders.push(order);
    }
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return { statusCode: 200, body: JSON.stringify({ orders }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Could not list orders' }) };
  }
};
