const { getStore } = require('../lib/blob-store');
const { requireAdmin } = require('../lib/admin-auth');
const { logEvent } = require('../lib/audit');
const { notifyFulfilment, applyFulfilment } = require('../lib/orders');
const sr = require('../lib/shiprocket');

// Shipping a paid order through Shiprocket (admin → Orders). The order keeps its
// progress in `order.shiprocket`:
//   { orderId, shipmentId, package, awb, courier, pickup, labelUrl, tracking, lastError }
// POST with an `action`:
//   ship   { orderId, package? } — runs whatever is left of: create the Shiprocket order →
//          assign a courier (AWB) → request pickup → label. Saved after every step, so a
//          failure can be retried without creating a second Shiprocket order. Once the
//          pickup is booked the order is marked shipped and the customer is emailed.
//   label  { orderId } — fetch the label again
//   track  { orderId } — latest courier status; marks the order delivered when it is
//   cancel { orderId } — cancel the Shiprocket order (before the courier collects it)
//   GET → { configured, defaults } for the ship form; GET ?check=1 also logs in to
//   Shiprocket and lists its pickup addresses
exports.handler = async (event) => {
  const auth = await requireAdmin(event, event.httpMethod === 'GET' ? 'orders' : 'ship');
  if (auth.response) return auth.response;
  try {
    if (event.httpMethod === 'GET') {
      const out = { configured: sr.configured(), ...(await sr.getShiprocketSettings()) };
      if (event.queryStringParameters && event.queryStringParameters.check) {
        try {
          out.pickups = await sr.pickupLocations();
          out.pickupFound = out.pickups.some((p) => p.name === out.pickupLocation);
        } catch (err) {
          if (!(err instanceof sr.ShiprocketError)) throw err;
          out.checkError = err.message;
        }
      }
      return ok(out);
    }
    if (event.httpMethod !== 'POST') return bad('Method Not Allowed', 405);

    const b = JSON.parse(event.body || '{}');
    const orders = getStore('orders');
    const order = await orders.get(String(b.orderId || ''), { type: 'json' });
    if (!order) return bad('Order not found', 404);
    if (order.status !== 'paid') return bad('Only paid orders can be shipped');
    const s = order.shiprocket || (order.shiprocket = {});
    const save = () => orders.setJSON(order.orderId, order);

    if (b.action === 'ship') {
      if (s.cancelled) return bad('This shipment was cancelled in Shiprocket');
      if (order.fulfilment && ['shipped', 'delivered', 'cancelled'].includes(order.fulfilment.status) && !s.shipmentId) {
        return bad(`This order is already marked ${order.fulfilment.status}`);
      }
      const settings = await sr.getShiprocketSettings();
      const steps = [];
      try {
        if (!s.shipmentId) {
          s.package = cleanPackage(b.package) || sr.packageFor(order, settings.packages);
          const created = await sr.createOrder(order, settings.pickupLocation, s.package);
          if (!created.shipment_id) throw new sr.ShiprocketError(created.message || 'Shiprocket did not return a shipment');
          Object.assign(s, { orderId: created.order_id, shipmentId: created.shipment_id, createdAt: new Date().toISOString() });
          steps.push('created');
          await save();
        }
        if (!s.awb) {
          Object.assign(s, await sr.assignAwb(s.shipmentId));
          steps.push('courier');
          await save();
        }
        if (!s.pickup) {
          s.pickup = { ...(await sr.requestPickup(s.shipmentId)), requestedAt: new Date().toISOString() };
          steps.push('pickup');
          const prevTracking = applyFulfilment(order, { status: 'shipped', courier: s.courier, tracking: s.awb, trackUrl: sr.trackUrlFor(s.awb) });
          s.lastError = null;
          await save();
          s.emailed = (await notifyFulfilment(order, prevTracking)).sent;
          await save();
        }
        if (!s.labelUrl) {
          s.labelUrl = await sr.label(s.shipmentId);
          steps.push('label');
        }
        s.lastError = null;
        await save();
        await logEvent('shipment_booked', 'admin', { orderId: order.orderId, awb: s.awb, steps }, event);
        return ok({ order, steps });
      } catch (err) {
        if (!(err instanceof sr.ShiprocketError)) throw err;
        s.lastError = { message: err.message, at: new Date().toISOString() };
        await save();
        return { statusCode: 502, body: JSON.stringify({ error: err.message, order, steps }) };
      }
    }

    if (!s.shipmentId) return bad('Ship this order first');
    try {
      if (b.action === 'label') {
        s.labelUrl = await sr.label(s.shipmentId);
      } else if (b.action === 'track') {
        if (!s.awb) return bad('No courier assigned yet');
        s.tracking = { ...(await sr.track(s.awb)), checkedAt: new Date().toISOString() };
        const f = order.fulfilment || {};
        if (s.tracking.delivered && f.status !== 'delivered') {
          const prevTracking = applyFulfilment(order, { status: 'delivered', trackUrl: s.tracking.trackUrl });
          await save();
          s.emailed = (await notifyFulfilment(order, prevTracking)).sent;
        }
      } else if (b.action === 'cancel') {
        if (s.tracking && /picked|transit|delivered|out for/i.test(s.tracking.status || '')) {
          return bad('The courier already has this parcel, so it can\'t be cancelled from here');
        }
        await sr.cancelOrder(s.orderId);
        s.cancelled = new Date().toISOString();
      } else {
        return bad('Unknown action');
      }
    } catch (err) {
      if (!(err instanceof sr.ShiprocketError)) throw err;
      return bad(err.message, 502);
    }
    await save();
    await logEvent(`shipment_${b.action}`, 'admin', { orderId: order.orderId }, event);
    return ok({ order });
  } catch (err) {
    console.error(err);
    return bad('Shipping request failed', 500);
  }
};

// Admin-edited parcel: grams and cm within courier limits, or null to use the default.
function cleanPackage(p) {
  if (!p) return null;
  const n = (v, max) => { const x = Math.round(Number(v)); return x >= 1 && x <= max ? x : null; };
  const out = { weightG: n(p.weightG, 30000), l: n(p.l, 150), b: n(p.b, 150), h: n(p.h, 150) };
  return Object.values(out).every((v) => v !== null) ? out : null;
}

const ok = (data) => ({ statusCode: 200, body: JSON.stringify(data) });
const bad = (error, statusCode = 400) => ({ statusCode, body: JSON.stringify({ error }) });
