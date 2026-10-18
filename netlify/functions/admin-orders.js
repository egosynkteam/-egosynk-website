const { getStore } = require('../lib/blob-store');
const { isAdminAuthorized } = require('../lib/admin-auth');
const { logEvent } = require('../lib/audit');
const { notifyFulfilment } = require('../lib/orders');

const FULFILMENT_STATUSES = ['processing', 'shipped', 'delivered', 'cancelled'];

// Order management for admin.html's Orders tab. POST with an `action`:
//   fulfilment — set shipping status (+ courier/tracking) on a PAID order
//   delete     — remove an UNPAID (pending/abandoned) order; paid orders carry a GST
//                invoice and must never be deleted, only cancelled + credit-noted
//   reset-test — wipe every order and the invoice series; refused unless the site is
//                on Razorpay test keys, so it can't run once real sales exist
exports.handler = async (event) => {
  if (!(await isAdminAuthorized(event))) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const orders = getStore('orders');

    if (body.action === 'fulfilment') {
      if (!FULFILMENT_STATUSES.includes(body.status)) {
        return bad(`Status must be one of: ${FULFILMENT_STATUSES.join(', ')}`);
      }
      const order = await orders.get(String(body.orderId), { type: 'json' });
      if (!order) return bad('Order not found', 404);
      if (order.status !== 'paid') return bad('Only paid orders can be fulfilled');

      const now = new Date().toISOString();
      const prev = order.fulfilment || { history: [] };
      order.fulfilment = {
        status: body.status,
        courier: body.courier ? String(body.courier).slice(0, 60) : prev.courier || null,
        tracking: body.tracking ? String(body.tracking).slice(0, 80) : prev.tracking || null,
        updatedAt: now,
        history: [...(prev.history || []), { status: body.status, at: now }],
        notified: prev.notified || {},
      };
      const email = await notifyFulfilment(order, prev.tracking);
      await orders.setJSON(order.orderId, order);
      await logEvent('order_fulfilment', 'admin', { orderId: order.orderId, status: body.status, emailed: email.sent }, event);
      return ok({ order, email });
    }

    if (body.action === 'delete') {
      const order = await orders.get(String(body.orderId), { type: 'json' });
      if (!order) return bad('Order not found', 404);
      if (order.status === 'paid' || order.invoice) {
        return bad('Paid orders have a GST invoice and cannot be deleted — mark them cancelled instead');
      }
      await orders.delete(order.orderId);
      await logEvent('order_deleted', 'admin', { orderId: order.orderId }, event);
      return ok({ deleted: order.orderId });
    }

    if (body.action === 'reset-test') {
      if (!String(process.env.RAZORPAY_KEY_ID || '').startsWith('rzp_test_')) {
        return bad('Reset is only allowed while Razorpay is in test mode');
      }
      if (body.confirm !== 'RESET') return bad('Type RESET to confirm');

      const invoices = getStore('invoices');
      const counts = { orders: 0, invoiceKeys: 0 };
      for (const b of (await orders.list()).blobs) { await orders.delete(b.key); counts.orders++; }
      for (const b of (await invoices.list()).blobs) { await invoices.delete(b.key); counts.invoiceKeys++; }
      await logEvent('test_data_reset', 'admin', counts, event);
      return ok({ reset: counts });
    }

    return bad('Unknown action');
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Order update failed' }) };
  }
};

const ok = (data) => ({ statusCode: 200, body: JSON.stringify(data) });
const bad = (error, statusCode = 400) => ({ statusCode, body: JSON.stringify({ error }) });
