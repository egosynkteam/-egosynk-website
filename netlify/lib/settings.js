const { getStore } = require('./blob-store');

// Store-wide configuration the founder edits in admin.html instead of in code. Two blobs
// in the `settings` store: `store` (shipping, banner, hero, links) and `categories`.
// Anything never saved falls back to these defaults, so a fresh site works out of the box.
const DEFAULTS = {
  shippingFee: 79, // ₹ charged when the cart subtotal is below the threshold
  freeShippingThreshold: 999, // ₹ subtotal at or above which shipping is free
  announcement: {
    enabled: true,
    items: ['Compression sleeves', 'Performance compression wear', 'Training accessories', 'Free shipping over ₹999'],
  },
  hero: {
    eyebrow: 'Forged for the grind · Mumbai',
    headline: 'Sync your\nego to the',
    accent: 'iron.',
    sub: 'Compression gear engineered for lifters who train past the point everyone else stops. Sleeves, compression wear, and accessories built for load, not looks.',
    imageKey: null,
  },
  social: { instagram: '', whatsapp: '', youtube: '', facebook: '' },
  ogImageKey: null,
};

// `tax` is the category's default GST treatment: 'textile' = 5% up to ₹2,500 a piece and
// 18% above (Sept-2025 slabs), or a flat rate. Products can still override per item.
const DEFAULT_CATEGORIES = [
  { id: 'sleeves', name: 'Gym Sleeves', desc: 'Full & half arm compression', guide: 'sleeves', hsn: '6117', tax: 'textile' },
  { id: 'innerwear', name: 'Innerwear', desc: 'Performance trunks built to move', guide: 'underwear', hsn: '6107', tax: 'textile' },
  { id: 'socks', name: 'Gym Socks', desc: 'Full length & ankle, grip-fit', guide: 'socks', hsn: '6115', tax: 'textile' },
  { id: 'compression', name: 'Compression Wear', desc: 'Tees & leggings for load', guide: 'apparel', hsn: '6109', tax: 'textile' },
  { id: 'accessories', name: 'Accessories', desc: 'Grips, straps & belts', guide: null, hsn: '9506', tax: 5 },
  { id: 'fragrance', name: 'Bold Fragrance', desc: 'EGOSYNK BOLD, signature scent', guide: null, hsn: '3303', tax: 18 },
  { id: 'bottoms', name: 'Bottoms', desc: 'Gym shorts, built for reps', guide: 'apparel', hsn: '6103', tax: 'textile' },
].map((c) => ({ ...c, visible: true }));

const SIZE_GUIDES = ['apparel', 'sleeves', 'underwear', 'socks', 'belt'];

async function getSettings() {
  const saved = (await getStore('settings').get('store', { type: 'json' })) || {};
  return {
    ...DEFAULTS,
    ...saved,
    announcement: { ...DEFAULTS.announcement, ...(saved.announcement || {}) },
    hero: { ...DEFAULTS.hero, ...(saved.hero || {}) },
    social: { ...DEFAULTS.social, ...(saved.social || {}) },
  };
}

async function getCategories() {
  return (await getStore('settings').get('categories', { type: 'json' })) || DEFAULT_CATEGORIES;
}

function shippingFor(subtotal, settings) {
  return subtotal >= settings.freeShippingThreshold ? 0 : settings.shippingFee;
}

module.exports = { DEFAULTS, DEFAULT_CATEGORIES, SIZE_GUIDES, getSettings, getCategories, shippingFor };
