const { getStore } = require('./blob-store');

// Store-wide settings the founder changes without touching code. Saved as one blob in
// the `settings` store; anything not saved yet falls back to these defaults, so a fresh
// site works out of the box.
const DEFAULTS = {
  shippingFee: 79, // ₹ charged when the cart subtotal is below the threshold
  freeShippingThreshold: 999, // ₹ subtotal at or above which shipping is free
};

async function getSettings() {
  const saved = (await getStore('settings').get('store', { type: 'json' })) || {};
  return { ...DEFAULTS, ...saved };
}

function shippingFor(subtotal, settings) {
  return subtotal >= settings.freeShippingThreshold ? 0 : settings.shippingFee;
}

module.exports = { DEFAULTS, getSettings, shippingFor };
