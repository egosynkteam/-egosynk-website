const { getStore } = require('../lib/blob-store');
const { ensureInvoice } = require('../lib/gst');
const { canViewOrder } = require('../lib/order-access');

// Used by invoice.html. Same access rule as get-order: paid orders only, for the order's
// view key, its signed-in customer, or an admin (lib/order-access.js). Generates the invoice on first view if payment
// verification couldn't (e.g. orders paid before invoicing existed).
exports.handler = async (event) => {
  const orderId = event.queryStringParameters && event.queryStringParameters.id;
  if (!orderId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing order id' }) };
  }

  try {
    const order = await getStore('orders').get(orderId, { type: 'json' });
    if (!order || order.status !== 'paid' || !(await canViewOrder(event, order))) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Invoice not found' }) };
    }

    const invoice = await ensureInvoice(order);
    return {
      statusCode: 200,
      body: JSON.stringify({ orderId: order.orderId, paymentId: order.paymentId, invoice }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Could not load invoice' }) };
  }
};
