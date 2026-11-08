const { getStore } = require('./blob-store');

// "Join the drop" sign-ups for products that aren't on sale yet (HYDRO, BOLD…), in the
// `waitlist` store. One record per product + email, so two sign-ups at the same moment can
// never overwrite each other (a single shared list blob could lose one of them).
//   key   `${product}__${email}`
//   value { product, email, phone, marketing, at, source }
const PRODUCTS = new Set(['hydro-150', 'bold']);
const keyFor = (product, email) => `${product}__${encodeURIComponent(email)}`;

async function join(product, { email, phone, marketing, source }) {
  const store = getStore('waitlist');
  const key = keyFor(product, email);
  const existing = await store.get(key, { type: 'json' });
  if (existing) {
    // Signing up again can add a phone number or opt in to marketing, never remove either.
    const merged = { ...existing, phone: existing.phone || phone || '', marketing: existing.marketing || !!marketing };
    if (merged.phone !== existing.phone || merged.marketing !== existing.marketing) await store.setJSON(key, merged);
    return { added: false };
  }
  await store.setJSON(key, { product, email, phone: phone || '', marketing: !!marketing, at: new Date().toISOString(), source: source || '' });
  return { added: true };
}

async function count(product) {
  const { blobs } = await getStore('waitlist').list({ prefix: `${product}__` });
  return blobs.length;
}

async function list(product) {
  const rows = await getStore('waitlist').listValues({ prefix: `${product}__` });
  return rows.map((r) => r.value).sort((a, b) => String(a.at).localeCompare(String(b.at)));
}

module.exports = { PRODUCTS, join, count, list, keyFor };
