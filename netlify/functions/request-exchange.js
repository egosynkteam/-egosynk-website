const { getStore } = require('../lib/blob-store');
const { getSessionUser } = require('../lib/session');
const { logEvent } = require('../lib/audit');
const { REASONS, openReasons, customerView, emailRequestReceived } = require('../lib/exchanges');

// A logged-in customer raises an exchange or issue request on one of their delivered
// orders (account.html → My Orders). Body:
//   { orderId, reason: 'size'|'damaged'|'wrong_item', items: [{ index, newSize? }], note? }
// `index` points into order.items; a size exchange needs a new size the product offers.
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const session = await getSessionUser(event);
    if (!session) return bad('Please log in again', 401);

    const body = JSON.parse(event.body || '{}');
    const store = getStore('orders');
    const order = await store.get(String(body.orderId || ''), { type: 'json' });
    if (!order || order.userId !== session.user.id) return bad('Order not found', 404);

    const reason = String(body.reason || '');
    if (!REASONS[reason]) return bad('Pick a reason');
    if (!openReasons(order).some((r) => r.id === reason)) {
      return bad('This order is outside the window for that request, or already has one open. Email support@egosynk.com if you need help.');
    }

    const picked = Array.isArray(body.items) ? body.items : [];
    if (!picked.length) return bad('Pick at least one item');
    const catalog = getStore('catalog');
    const seen = new Set();
    const items = [];
    for (const p of picked) {
      const i = Number(p.index);
      const line = order.items[i];
      if (!line || seen.has(i)) return bad('Invalid item');
      seen.add(i);
      let newSize = null;
      if (reason === 'size') {
        newSize = String(p.newSize || '').slice(0, 20);
        const product = await catalog.get(String(line.id), { type: 'json' });
        const sizes = (product && product.sizes) || [];
        if (!newSize || newSize === line.size || (sizes.length && !sizes.includes(newSize))) {
          return bad(`Pick a different size for ${line.name}`);
        }
      }
      items.push({ index: i, id: line.id, name: line.name, size: line.size || null, qty: line.qty, newSize });
    }

    const now = new Date().toISOString();
    order.exchange = {
      status: 'requested',
      reason,
      items,
      note: String(body.note || '').trim().slice(0, 500),
      requestedAt: now,
      history: [...((order.exchange && order.exchange.history) || []), { status: 'requested', at: now }],
    };
    await store.setJSON(order.orderId, order);
    await logEvent('exchange_requested', session.user.email, { orderId: order.orderId, reason }, event);
    await emailRequestReceived(order);

    return { statusCode: 200, body: JSON.stringify({ exchange: customerView(order.exchange) }) };
  } catch (err) {
    console.error(err);
    return bad('Could not submit the request', 500);
  }
};

const bad = (error, statusCode = 400) => ({ statusCode, body: JSON.stringify({ error }) });
