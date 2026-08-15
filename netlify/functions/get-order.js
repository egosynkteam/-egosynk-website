const { getStore } = require('@netlify/blobs');

// Used by order-confirmation.html to render the receipt after a successful, verified payment.
// Only returns paid orders — a pending/abandoned order id shouldn't be browsable.
exports.handler = async (event) => {
  const orderId = event.queryStringParameters && event.queryStringParameters.id;
  if (!orderId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing order id' }) };
  }

  try {
    const store = getStore('orders');
    const order = await store.get(orderId, { type: 'json' });

    if (!order || order.status !== 'paid') {
      return { statusCode: 404, body: JSON.stringify({ error: 'Order not found' }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        orderId: order.orderId,
        items: order.items,
        amount: order.amount,
        currency: order.currency,
        shipping: order.shipping,
        paidAt: order.paidAt,
      }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Could not fetch order' }) };
  }
};
