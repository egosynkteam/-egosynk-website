const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');
const { logEvent } = require('../lib/audit');
const { sendEmail, emailWrapper, escapeHtml } = require('../lib/email');

const OWNER_EMAIL = 'support@egosynk.com';

function orderEmailHtml(order, forOwner) {
  const itemsRows = order.items
    .map((i) => `<tr><td style="padding:6px 0;">${escapeHtml(i.name)}${i.size ? ' (' + escapeHtml(i.size) + ')' : ''} × ${i.qty}</td><td style="padding:6px 0;text-align:right;">₹${(i.price * i.qty).toLocaleString('en-IN')}</td></tr>`)
    .join('');
  const s = order.shipping;
  const intro = forOwner
    ? `<p style="font-size:14px;line-height:1.6;"><strong>New paid order.</strong></p>`
    : `<p style="font-size:14px;line-height:1.6;">Thanks for your order, ${escapeHtml(s.name)} — here's your receipt.</p>`;

  return `
    ${intro}
    <p style="font-size:12px;color:#8B8D93;">Order ID: ${escapeHtml(order.orderId)}</p>
    <table style="width:100%;font-size:13px;border-collapse:collapse;margin:16px 0;">
      ${itemsRows}
      <tr><td style="padding-top:10px;font-weight:700;">Total</td><td style="padding-top:10px;text-align:right;font-weight:700;">₹${(order.amount / 100).toLocaleString('en-IN')}</td></tr>
    </table>
    <p style="font-size:12px;color:#8B8D93;line-height:1.6;">
      Delivering to:<br>
      ${escapeHtml(s.name)}<br>
      ${escapeHtml(s.address1)}${s.address2 ? ', ' + escapeHtml(s.address2) : ''}<br>
      ${escapeHtml(s.city)}, ${escapeHtml(s.state)} ${escapeHtml(s.pincode)}<br>
      ${escapeHtml(s.phone)}
    </p>
  `;
}

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

    const verified = expected === razorpay_signature;

    if (verified) {
      const store = getStore('orders');
      const order = await store.get(razorpay_order_id, { type: 'json' });
      if (order) {
        order.status = 'paid';
        order.paymentId = razorpay_payment_id;
        order.paidAt = new Date().toISOString();
        await store.setJSON(razorpay_order_id, order);
        await logEvent('order_paid', order.shipping && order.shipping.email, { orderId: razorpay_order_id, paymentId: razorpay_payment_id }, event);

        // Fire-and-forget: a customer receipt (if they gave an email) + an owner alert so
        // the founder finds out about a sale without having to keep the admin portal open.
        if (order.shipping && order.shipping.email) {
          await sendEmail({
            to: order.shipping.email,
            subject: `Order Confirmed — ${order.orderId}`,
            html: emailWrapper(orderEmailHtml(order, false)),
          });
        }
        await sendEmail({
          to: OWNER_EMAIL,
          subject: `New Order — ₹${(order.amount / 100).toLocaleString('en-IN')} (${order.orderId})`,
          html: emailWrapper(orderEmailHtml(order, true)),
        });
      }
    }

    return { statusCode: verified ? 200 : 400, body: JSON.stringify({ verified, orderId: razorpay_order_id }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Verification failed' }) };
  }
};
