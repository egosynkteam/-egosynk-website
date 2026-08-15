const { getStore } = require('@netlify/blobs');
const { isAdminAuthorized } = require('../lib/admin-auth');

// One-time migration: loads the original 16 hardcoded products (that used to live as a
// JS array inside index.html) into the `catalog` Blobs store. Idempotent by design —
// only runs if the catalog is currently empty, so calling it again after you've made
// admin edits will NOT overwrite your changes. Call once via:
//   POST /.netlify/functions/admin-seed-catalog   (header: x-admin-key: <ADMIN_SECRET>)
const SEED_PRODUCTS = [
  { id: 1, name: 'Full Compression Arm Sleeves', cat: 'sleeves', price: 1299, tag: 'BESTSELLER', sizes: ['S', 'M', 'L', 'XL'], guide: 'sleeves' },
  { id: 2, name: 'Half Compression Arm Sleeves', cat: 'sleeves', price: 999, tag: null, sizes: ['S', 'M', 'L', 'XL'], guide: 'sleeves' },
  { id: 3, name: 'Performance Trunks — Pack of 2', cat: 'innerwear', price: 899, tag: 'NEW', sizes: ['S', 'M', 'L', 'XL', 'XXL'], guide: 'underwear' },
  { id: 4, name: 'Performance Trunks — Pack of 3', cat: 'innerwear', price: 1249, tag: null, sizes: ['S', 'M', 'L', 'XL', 'XXL'], guide: 'underwear' },
  { id: 5, name: 'Full Length Grip Socks', cat: 'socks', price: 499, tag: null, sizes: ['Free Size'], guide: 'socks' },
  { id: 6, name: 'Ankle Grip Socks — Pack of 3', cat: 'socks', price: 649, tag: 'BESTSELLER', sizes: ['Free Size'], guide: 'socks' },
  { id: 7, name: 'Forge Compression Tee', cat: 'compression', price: 1499, tag: 'NEW', sizes: ['S', 'M', 'L', 'XL', 'XXL'], guide: 'apparel' },
  { id: 8, name: 'Sync Compression Leggings', cat: 'compression', price: 2199, tag: null, sizes: ['S', 'M', 'L', 'XL', 'XXL'], guide: 'apparel' },
  { id: 9, name: 'Compression Long Sleeve Tee', cat: 'compression', price: 1899, tag: null, sizes: ['S', 'M', 'L', 'XL', 'XXL'], guide: 'apparel' },
  { id: 10, name: 'Grit Lifting Grips (Pair)', cat: 'accessories', price: 799, tag: null, sizes: ['Free Size'], guide: null },
  { id: 11, name: 'Steel Core Lifting Belt 10mm', cat: 'accessories', price: 2499, tag: 'BESTSELLER', sizes: ['S', 'M', 'L'], guide: 'belt' },
  { id: 12, name: 'Chalk-Grip Wrist Wraps', cat: 'accessories', price: 599, tag: null, sizes: ['Free Size'], guide: null },
  { id: 13, name: 'EGOSYNK BOLD — Eau De Parfum 50ml', cat: 'fragrance', price: 1799, tag: 'NEW', sizes: ['50ml'], guide: null },
  { id: 14, name: 'EGOSYNK BOLD — Eau De Parfum 100ml', cat: 'fragrance', price: 2799, tag: null, sizes: ['100ml'], guide: null },
  { id: 15, name: 'Anvil Training Shorts', cat: 'bottoms', price: 1399, tag: null, sizes: ['S', 'M', 'L', 'XL', 'XXL'], guide: 'apparel' },
  { id: 16, name: 'Iron Line 2-in-1 Shorts', cat: 'bottoms', price: 1699, tag: 'BESTSELLER', sizes: ['S', 'M', 'L', 'XL', 'XXL'], guide: 'apparel' },
];

exports.handler = async (event) => {
  if (!isAdminAuthorized(event)) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const store = getStore('catalog');
    const { blobs } = await store.list();

    if (blobs.length > 0) {
      return { statusCode: 200, body: JSON.stringify({ seeded: false, reason: 'Catalog already has products — not overwriting.', count: blobs.length }) };
    }

    const now = new Date().toISOString();
    for (const p of SEED_PRODUCTS) {
      await store.setJSON(String(p.id), { ...p, available: true, stock: null, updatedAt: now });
    }

    return { statusCode: 200, body: JSON.stringify({ seeded: true, count: SEED_PRODUCTS.length }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Seed failed' }) };
  }
};
