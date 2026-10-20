const crypto = require('crypto');
const { viewKey } = require('../lib/order-access');
const { markOrderPaid } = require('../lib/orders');

// Confirms the payment Razorpay's checkout widget reported is genuine, by recomputing
// the HMAC signature server-side with the secret key (which never reaches the browser).
// Without this step, anyone could fake a "successful payment" purely on the client.
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = JSON.parse(event.body || '{}');

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return { statusCode: 400, body: JSON.stringify({ verified: false, error: 'Missing fields' }) };
    }

    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    // Constant-time compare so the response time doesn't leak how much of a guess matched.
    const got = Buffer.from(String(razorpay_signature));
    const want = Buffer.from(expected);
    const verified = got.length === want.length && crypto.timingSafeEqual(got, want);

    // The confirmation URL carries the payment params, so a page reload re-verifies;
    // markOrderPaid is a no-op once the order is already paid.
    if (verified) await markOrderPaid(razorpay_order_id, razorpay_payment_id, event, 'checkout');

    // The buyer gets the order's view key to load the receipt and invoice (lib/order-access.js).
    return { statusCode: verified ? 200 : 400, body: JSON.stringify({ verified, orderId: razorpay_order_id, k: verified ? viewKey(razorpay_order_id) : undefined }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Verification failed' }) };
  }
};
