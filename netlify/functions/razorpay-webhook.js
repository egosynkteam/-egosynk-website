const crypto = require('crypto');
const { markOrderPaid } = require('../lib/orders');

// Razorpay calls this server-to-server when a payment is captured, so an order still gets
// marked paid (invoice, stock, emails) if the customer closed the tab before the
// confirmation page could run verify-payment.
//
// Setup (Razorpay Dashboard → Accounts & Settings → Webhooks): URL
//   https://egosynk.com/.netlify/functions/razorpay-webhook
// events "payment.captured" + "order.paid", and a secret saved in Netlify as
// RAZORPAY_WEBHOOK_SECRET. Unsigned or wrongly-signed calls are rejected.
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('RAZORPAY_WEBHOOK_SECRET not set — rejecting webhook');
    return { statusCode: 503, body: 'Webhook not configured' };
  }

  // The signature covers the exact raw bytes Razorpay sent.
  const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
  const signature = (event.headers && (event.headers['x-razorpay-signature'] || event.headers['X-Razorpay-Signature'])) || '';
  const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  const valid = signature.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!valid) return { statusCode: 400, body: 'Invalid signature' };

  try {
    const body = JSON.parse(raw);
    const payment = body.payload && body.payload.payment && body.payload.payment.entity;
    if (['payment.captured', 'order.paid'].includes(body.event) && payment && payment.order_id) {
      const { order } = await markOrderPaid(payment.order_id, payment.id, event, 'webhook');
      if (!order) console.warn('Webhook for unknown order', payment.order_id);
    }
    // Always 200 for a valid signature, so Razorpay doesn't keep retrying events we ignore.
    return { statusCode: 200, body: 'ok' };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: 'Webhook processing failed' };
  }
};
