const crypto = require('crypto');
const { getStore } = require('./blob-store');

// Discount codes, managed in admin → Coupons and stored as one list (`settings` store,
// key `coupons`). A coupon is:
//   { code, type: 'percent'|'flat', value, minSubtotal, maxDiscount, expiresAt,
//     usageLimit, usedCount, active, firstOrderOnly, showOnProduct, topBar }
// firstOrderOnly codes are refused at checkout when the email or phone already has a paid
// order (the `buyers` store). showOnProduct lists the code under Offers on product pages;
// topBar (one coupon at most) also shows it in the strip above the nav.
// Discounts are whole rupees, taken off the items (never shipping). For GST, a discount
// shown on the invoice at the time of sale reduces the taxable value, so the discount is
// split across item lines in proportion to their value and tax is worked out on what's
// left (see gst.js).
async function getCoupons() {
  return (await getStore('settings').get('coupons', { type: 'json' })) || [];
}

const normCode = (c) => String(c || '').trim().toUpperCase();

// Returns { coupon, discount } or { error } for a cart subtotal (₹, before shipping).
function evaluateCoupon(coupon, subtotal, now = new Date()) {
  if (!coupon || !coupon.active) return { error: 'This code isn\'t valid' };
  if (coupon.expiresAt && now > new Date(`${coupon.expiresAt}T23:59:59+05:30`)) return { error: 'This code has expired' };
  if (coupon.usageLimit && (coupon.usedCount || 0) >= coupon.usageLimit) return { error: 'This code has been fully used' };
  if (subtotal < (coupon.minSubtotal || 0)) {
    return { error: `Add ₹${(coupon.minSubtotal - subtotal).toLocaleString('en-IN')} more to use ${coupon.code}` };
  }
  let discount = coupon.type === 'percent' ? Math.round((subtotal * coupon.value) / 100) : Math.round(coupon.value);
  if (coupon.type === 'percent' && coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
  discount = Math.max(0, Math.min(discount, subtotal));
  return discount > 0 ? { coupon, discount } : { error: 'This code doesn\'t apply to your bag' };
}

// `buyer` ({ email, phone }) is only known at checkout. Without it a first-order code
// passes here and create-order checks it once the address is filled in.
async function findAndEvaluate(code, subtotal, buyer) {
  const wanted = normCode(code);
  if (!wanted) return { error: 'Enter a code' };
  const coupon = (await getCoupons()).find((c) => c.code === wanted);
  const result = evaluateCoupon(coupon, subtotal);
  if (!result.error && coupon.firstOrderOnly && buyer && (await hasPaidBefore(buyer))) {
    return { error: `${coupon.code} is for first orders only` };
  }
  return result;
}

// Everyone who has paid, keyed by a hash of their email and of their phone, so
// first-order codes can't be reused by changing just one of them.
const hash = (v) => crypto.createHash('sha256').update(v).digest('hex').slice(0, 32);
function buyerKeys({ email, phone }) {
  const keys = [];
  const e = String(email || '').trim().toLowerCase();
  if (e) keys.push('e/' + hash(e));
  if (/^\d{10}$/.test(String(phone || ''))) keys.push('p/' + hash(String(phone)));
  return keys;
}

async function hasPaidBefore(buyer) {
  const store = getStore('buyers');
  for (const k of buyerKeys(buyer)) {
    if (await store.get(k)) return true;
  }
  return false;
}

async function recordBuyer(order) {
  const s = order.shipping || {};
  const store = getStore('buyers');
  for (const k of buyerKeys(s)) {
    if (!(await store.get(k))) await store.setJSON(k, { firstOrderId: order.orderId, at: order.paidAt });
  }
}

// What the storefront may see: live codes marked for display, without usage counts.
function publicOffers(coupons, now = new Date()) {
  return coupons
    .filter((c) => (c.showOnProduct || c.topBar) && !evaluateCoupon(c, Infinity, now).error)
    .map(({ code, type, value, minSubtotal, maxDiscount, expiresAt, firstOrderOnly, topBar }) =>
      ({ code, type, value, minSubtotal, maxDiscount, expiresAt, firstOrderOnly: !!firstOrderOnly, topBar: !!topBar }));
}

// Splits `discount` (₹) over items by line value, to the paisa, with the rounding
// remainder on the largest line so the parts always add back up exactly.
function allocateDiscount(items, discount) {
  const totals = items.map((i) => i.price * i.qty);
  const subtotal = totals.reduce((a, b) => a + b, 0);
  const paise = Math.round(discount * 100);
  const parts = totals.map((t) => Math.floor((paise * t) / subtotal));
  const largest = totals.indexOf(Math.max(...totals));
  parts[largest] += paise - parts.reduce((a, b) => a + b, 0);
  return items.map((i, n) => ({ ...i, discount: parts[n] / 100 }));
}

// Counted when the order is paid, not when the code is applied, so abandoned checkouts
// don't use up a limited code.
async function recordCouponUse(code) {
  if (!code) return;
  const store = getStore('settings');
  const list = await getCoupons();
  const c = list.find((x) => x.code === code);
  if (!c) return;
  c.usedCount = (c.usedCount || 0) + 1;
  await store.setJSON('coupons', list);
}

module.exports = {
  getCoupons, normCode, evaluateCoupon, findAndEvaluate, allocateDiscount, recordCouponUse,
  hasPaidBefore, recordBuyer, publicOffers,
};
