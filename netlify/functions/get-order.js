const { getStore } = require('../lib/blob-store');
const { canViewOrder } = require('../lib/order-access');

// Used by order-confirmation.html to render the receipt after a successful, verified payment.
// Only paid orders, and only for someone allowed to see them (lib/order-access.js): the
// receipt includes the delivery address. Anyone else gets the same 404 as a wrong id.
exports.handler = async (event) => {
  const orderId = event.queryStringParameters && event.queryStringParameters.id;
  if (!orderId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing order id' }) };
  }

  try {
    const store = getStore('orders');
    const order = await store.get(orderId, { type: 'json' });

    if (!order || order.status !== 'paid' || !(await canViewOrder(event, order))) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Order not found' }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        orderId: order.orderId,
        items: order.items,
        amount: order.amount,
        shippingFee: order.shippingFee,
        discount: order.discount || 0,
        coupon: order.coupon || null,
        currency: order.currency,
        shipping: order.shipping,
        paidAt: order.paidAt,
        invoiceNumber: order.invoice ? order.invoice.number : null,
      }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Could not fetch order' }) };
  }
};
