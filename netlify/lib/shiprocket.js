const { getStore } = require('./blob-store');

// Shiprocket (apiv2.shiprocket.in) for shipping paid orders from admin → Orders. The API
// user's login is SHIPROCKET_EMAIL / SHIPROCKET_PASSWORD in Netlify; its token lasts 10
// days and is cached in the `security` store so each request doesn't log in again.
// Settings (admin → Settings → Shipping, `settings` store key `shiprocket`): the pickup
// address nickname as Shiprocket shows it, and a default parcel per category.
const API = 'https://apiv2.shiprocket.in/v1/external';
const TOKEN_KEY = 'shiprocket-token';
const TOKEN_DAYS = 9;

// Rough packed sizes until real parcels are weighed: grams and cm.
const DEFAULT_PACKAGES = {
  sleeves: { weightG: 150, l: 25, b: 18, h: 3 },
  innerwear: { weightG: 200, l: 28, b: 22, h: 4 },
  socks: { weightG: 120, l: 25, b: 18, h: 3 },
  compression: { weightG: 300, l: 30, b: 25, h: 4 },
  bottoms: { weightG: 350, l: 30, b: 25, h: 4 },
  accessories: { weightG: 500, l: 30, b: 20, h: 8 },
  fragrance: { weightG: 350, l: 15, b: 10, h: 10 },
};
const FALLBACK_PACKAGE = { weightG: 400, l: 30, b: 25, h: 5 };

const configured = () => !!(process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD);

async function getShiprocketSettings() {
  const saved = (await getStore('settings').get('shiprocket', { type: 'json' })) || {};
  return { pickupLocation: saved.pickupLocation || 'work', packages: { ...DEFAULT_PACKAGES, ...(saved.packages || {}) } };
}

// One parcel for the whole order: weights add up, the box is the biggest item's
// footprint with the items stacked. The admin can change it before shipping.
function packageFor(order, packages) {
  let weightG = 0, l = 0, b = 0, h = 0;
  for (const i of order.items) {
    const p = packages[i.cat] || FALLBACK_PACKAGE;
    weightG += p.weightG * i.qty;
    l = Math.max(l, p.l);
    b = Math.max(b, p.b);
    h += p.h * i.qty;
  }
  return { weightG: Math.max(weightG, 50), l: Math.max(l, 1), b: Math.max(b, 1), h: Math.min(Math.max(h, 1), 60) };
}

class ShiprocketError extends Error {}

// Shiprocket's error bodies: { message, errors: { field: [..] } } or { message }.
function errorText(data, status) {
  if (data && data.errors && typeof data.errors === 'object') {
    const first = Object.entries(data.errors).map(([k, v]) => `${k}: ${[].concat(v).join(', ')}`).join('; ');
    if (first) return first;
  }
  return (data && data.message) || `Shiprocket error ${status}`;
}

let memoToken = null;
async function token(force) {
  if (!configured()) throw new ShiprocketError('Shiprocket login (SHIPROCKET_EMAIL / SHIPROCKET_PASSWORD) is not set in Netlify');
  const store = getStore('security');
  if (!force) {
    const cached = memoToken || (await store.get(TOKEN_KEY, { type: 'json' }));
    if (cached && new Date(cached.expiresAt) > new Date()) return (memoToken = cached).token;
  }
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.SHIPROCKET_EMAIL, password: process.env.SHIPROCKET_PASSWORD }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.token) throw new ShiprocketError(`Shiprocket login failed: ${errorText(data, res.status)}`);
  memoToken = { token: data.token, expiresAt: new Date(Date.now() + TOKEN_DAYS * 86400e3).toISOString() };
  await store.setJSON(TOKEN_KEY, memoToken);
  return memoToken.token;
}

async function call(method, path, body, retried) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token(retried)}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && !retried) return call(method, path, body, true); // token revoked early
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ShiprocketError(errorText(data, res.status));
  return data;
}

// "2026-10-21 14:05" in IST, as Shiprocket wants it.
function istStamp(iso) {
  const d = new Date(new Date(iso).getTime() + 5.5 * 3600e3);
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

// Order payload. Prices are what the customer paid per unit after any coupon (same as
// the GST invoice), so Shiprocket's invoice and insurance values match ours.
function orderPayload(order, pickupLocation, pkg) {
  const s = order.shipping;
  const [first, ...rest] = String(s.name).trim().split(/\s+/);
  const items = order.items.map((i) => ({
    name: `${i.name}${i.size ? ` (${i.size})` : ''}`.slice(0, 100),
    sku: `${i.id}${i.size ? '-' + i.size : ''}`.slice(0, 50),
    units: i.qty,
    selling_price: Math.round(((i.price * i.qty - (i.discount || 0)) / i.qty) * 100) / 100,
    hsn: i.hsn || '',
  }));
  return {
    order_id: order.orderId,
    order_date: istStamp(order.paidAt || order.createdAt),
    pickup_location: pickupLocation,
    billing_customer_name: first,
    billing_last_name: rest.join(' '),
    billing_address: s.address1,
    billing_address_2: s.address2 || '',
    billing_city: s.city,
    billing_pincode: s.pincode,
    billing_state: s.state,
    billing_country: 'India',
    billing_email: s.email || '',
    billing_phone: s.phone,
    shipping_is_billing: true,
    order_items: items,
    payment_method: 'Prepaid',
    shipping_charges: order.shippingFee || 0,
    total_discount: 0,
    sub_total: Math.round(items.reduce((a, i) => a + i.selling_price * i.units, 0) * 100) / 100,
    length: pkg.l, breadth: pkg.b, height: pkg.h,
    weight: Math.round(pkg.weightG) / 1000,
  };
}

const createOrder = (order, pickupLocation, pkg) => call('POST', '/orders/create/adhoc', orderPayload(order, pickupLocation, pkg));

// Shiprocket picks its recommended courier when no courier_id is given.
async function assignAwb(shipmentId) {
  const data = await call('POST', '/courier/assign/awb', { shipment_id: shipmentId });
  const d = data && data.response && data.response.data;
  if (!data.awb_assign_status || !d || !d.awb_code) {
    throw new ShiprocketError((d && d.awb_assign_error) || data.message || 'No courier could take this shipment');
  }
  return { awb: d.awb_code, courier: d.courier_name, courierId: d.courier_company_id };
}

async function requestPickup(shipmentId) {
  const data = await call('POST', '/courier/generate/pickup', { shipment_id: [shipmentId] });
  if (!data.pickup_status) throw new ShiprocketError(data.message || 'Pickup could not be scheduled');
  const r = data.response || {};
  return { scheduledFor: r.pickup_scheduled_date || null, token: r.pickup_token_number || null };
}

async function label(shipmentId) {
  const data = await call('POST', '/courier/generate/label', { shipment_id: [shipmentId] });
  if (!data.label_url) throw new ShiprocketError(data.message || 'Label not ready yet');
  return data.label_url;
}

// Latest courier status. Delivered when Shiprocket's status says so.
async function track(awb) {
  const data = await call('GET', `/courier/track/awb/${encodeURIComponent(awb)}`);
  const t = (data && data.tracking_data) || {};
  const latest = (t.shipment_track && t.shipment_track[0]) || {};
  const status = latest.current_status || (t.shipment_track_activities && t.shipment_track_activities[0] && t.shipment_track_activities[0].activity) || 'Awaiting pickup';
  return {
    status: String(status).slice(0, 80),
    delivered: /^delivered$/i.test(String(latest.current_status || '').trim()) || t.shipment_status === 7,
    deliveredAt: latest.delivered_date || null,
    trackUrl: t.track_url || trackUrlFor(awb),
  };
}

const cancelOrder = (srOrderId) => call('POST', '/orders/cancel', { ids: [srOrderId] });
const trackUrlFor = (awb) => `https://shiprocket.co/tracking/${encodeURIComponent(awb)}`;

module.exports = {
  DEFAULT_PACKAGES, FALLBACK_PACKAGE, ShiprocketError, configured, getShiprocketSettings, packageFor,
  orderPayload, createOrder, assignAwb, requestPickup, label, track, cancelOrder, trackUrlFor,
};
