const { getStore } = require('../lib/blob-store');
const { getSessionUser } = require('../lib/session');
const { openReasons, customerView } = require('../lib/exchanges');

// Order history for the logged-in user's account.html. Matches by userId (attached at
// checkout time when the buyer was logged in) — guest orders have no userId and won't
// show here, which is correct: nothing ties them to an account.
exports.handler = async (event) => {
  try {
    const session = await getSessionUser(event);
    if (!session) return { statusCode: 401, body: JSON.stringify({ error: 'Not logged in' }) };

    const store = getStore('orders');
    const catalog = getStore('catalog');
    const { blobs } = await store.list();

    const orders = [];
    for (const b of blobs) {
      const order = await store.get(b.key, { type: 'json' });
      if (order && order.status === 'paid' && order.userId === session.user.id) {
        // Exchange options only for orders still inside a window; the size list lets the
        // form offer only sizes the product actually comes in.
        const reasons = openReasons(order);
        let sizesByItem = null;
        if (reasons.length) {
          sizesByItem = [];
          for (const i of order.items) {
            const product = await catalog.get(String(i.id), { type: 'json' });
            sizesByItem.push((product && product.sizes) || []);
          }
        }
        orders.push({
          exchange: customerView(order.exchange),
          exchangeOptions: reasons.length ? { reasons, sizesByItem } : null,
          orderId: order.orderId,
          items: order.items,
          amount: order.amount,
          paidAt: order.paidAt,
          invoiceNumber: order.invoice ? order.invoice.number : null,
          fulfilment: order.fulfilment
            ? { status: order.fulfilment.status, courier: order.fulfilment.courier, tracking: order.fulfilment.tracking }
            : { status: 'processing' },
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
