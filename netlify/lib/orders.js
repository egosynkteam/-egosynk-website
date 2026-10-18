const { getStore } = require('./blob-store');
const { logEvent } = require('./audit');
const { sendEmail, emailWrapper, escapeHtml, GSTIN } = require('./email');
const { ensureInvoice } = require('./gst');

const OWNER_EMAIL = 'egosynkteam@gmail.com';

// Per-size stock lives on the product as `stockBySize: { S: 4, M: 0, … }`. A product
// without it (or a size missing from it) is untracked — treated as always in stock.
function stockLeft(product, size) {
  const map = product.stockBySize;
  if (!map || typeof map !== 'object' || !Number.isFinite(map[size])) return Infinity;
  return map[size];
}

async function decrementStock(items) {
  const catalog = getStore('catalog');
  for (const i of items) {
    const product = await catalog.get(String(i.id), { type: 'json' });
    if (!product || stockLeft(product, i.size) === Infinity) continue;
    product.stockBySize[i.size] = Math.max(0, product.stockBySize[i.size] - i.qty);
    product.updatedAt = new Date().toISOString();
    await catalog.setJSON(String(i.id), product);
  }
}

function orderEmailHtml(order, forOwner) {
  const money = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
  const itemsRows = order.items
    .map((i) => `<tr><td style="padding:6px 0;">${escapeHtml(i.name)}${i.size ? ' (' + escapeHtml(i.size) + ')' : ''} × ${i.qty}</td><td style="padding:6px 0;text-align:right;">${money(i.price * i.qty)}</td></tr>`)
    .join('');
  const shippingRow = order.shippingFee != null
    ? `<tr><td style="padding:6px 0;">Shipping</td><td style="padding:6px 0;text-align:right;">${order.shippingFee ? money(order.shippingFee) : 'Free'}</td></tr>`
    : '';
  const s = order.shipping;
  const intro = forOwner
    ? `<p style="font-size:14px;line-height:1.6;"><strong>New paid order.</strong></p>`
    : `<p style="font-size:14px;line-height:1.6;">Thanks for your order, ${escapeHtml(s.name)} — here's your receipt.</p>`;

  return `
    ${intro}
    <p style="font-size:12px;color:#8B8D93;">Order ID: ${escapeHtml(order.orderId)}${order.invoice ? '<br>Invoice: ' + escapeHtml(order.invoice.number) : ''}<br>Sold by EGOSYNK · GSTIN: ${GSTIN}</p>
    <table style="width:100%;font-size:13px;border-collapse:collapse;margin:16px 0;">
      ${itemsRows}
      ${shippingRow}
      <tr><td style="padding-top:10px;font-weight:700;">Total</td><td style="padding-top:10px;text-align:right;font-weight:700;">${money(order.amount / 100)}</td></tr>
    </table>
    <p style="font-size:12px;color:#8B8D93;line-height:1.6;">
      Delivering to:<br>
      ${escapeHtml(s.name)}<br>
      ${escapeHtml(s.address1)}${s.address2 ? ', ' + escapeHtml(s.address2) : ''}<br>
      ${escapeHtml(s.city)}, ${escapeHtml(s.state)} ${escapeHtml(s.pincode)}<br>
      ${escapeHtml(s.phone)}
    </p>
    ${order.invoice ? `<p style="font-size:13px;"><a href="https://egosynk.com/invoice.html?id=${encodeURIComponent(order.orderId)}" style="color:#C41E3A;">View / download GST tax invoice</a></p>` : ''}
  `;
}

// The single place an order becomes paid — called by verify-payment (customer's browser
// after checkout) and razorpay-webhook (Razorpay's server, which still fires if the
// customer closed the tab). Whichever arrives first does the work; the other is a no-op.
async function markOrderPaid(orderId, paymentId, event, source) {
  const store = getStore('orders');
  const order = await store.get(orderId, { type: 'json' });
  if (!order) return { order: null, newlyPaid: false };
  if (order.status === 'paid') return { order, newlyPaid: false };

  order.status = 'paid';
  order.paymentId = paymentId;
  order.paidAt = new Date().toISOString();
  order.paidVia = source;
  await store.setJSON(orderId, order);

  // Nothing below may undo a confirmed payment: each step logs and carries on.
  try { await ensureInvoice(order); } catch (err) { console.error('Invoice generation failed:', err); }
  try { await decrementStock(order.items); } catch (err) { console.error('Stock update failed:', err); }
  await logEvent('order_paid', order.shipping && order.shipping.email, { orderId, paymentId, source }, event);

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
  return { order, newlyPaid: true };
}

module.exports = { markOrderPaid, stockLeft };
