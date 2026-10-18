const { getStore } = require('./blob-store');

// Discount codes, managed in admin → Coupons and stored as one list (`settings` store,
// key `coupons`). A coupon is:
//   { code, type: 'percent'|'flat', value, minSubtotal, maxDiscount, expiresAt,
//     usageLimit, usedCount, active }
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

async function findAndEvaluate(code, subtotal) {
  const wanted = normCode(code);
  if (!wanted) return { error: 'Enter a code' };
  const coupon = (await getCoupons()).find((c) => c.code === wanted);
  return evaluateCoupon(coupon, subtotal);
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

module.exports = { getCoupons, normCode, evaluateCoupon, findAndEvaluate, allocateDiscount, recordCouponUse };
