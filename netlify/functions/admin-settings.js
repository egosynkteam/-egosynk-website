const { getStore } = require('../lib/blob-store');
const { isAdminAuthorized } = require('../lib/admin-auth');
const { logEvent } = require('../lib/audit');
const { getSettings, getCategories, SIZE_GUIDES } = require('../lib/settings');

// Admin editing of store settings and categories (Settings + Categories tabs).
//   GET                                   -> { settings, categories, sizeGuides }
//   POST { section: 'store', data }       -> save shipping / banner / hero / links
//   POST { section: 'categories', data }  -> save the full ordered category list
const MEDIA_KEY = /^[a-f0-9]{16}\.(webp|jpg|png)$/;
const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const money = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 ? n : null; };
const mediaKey = (v) => (v && MEDIA_KEY.test(v) ? v : null);

function cleanStore(d) {
  const shippingFee = money(d.shippingFee);
  const freeShippingThreshold = money(d.freeShippingThreshold);
  if (shippingFee === null || freeShippingThreshold === null) return { error: 'Shipping fee and threshold must be whole rupees ≥ 0' };
  const a = d.announcement || {}, h = d.hero || {}, s = d.social || {};
  return {
    value: {
      shippingFee,
      freeShippingThreshold,
      announcement: {
        enabled: a.enabled !== false,
        items: (Array.isArray(a.items) ? a.items : []).map((x) => str(x, 60)).filter(Boolean).slice(0, 10),
      },
      hero: {
        eyebrow: str(h.eyebrow, 60),
        headline: str(h.headline, 80),
        accent: str(h.accent, 30),
        sub: str(h.sub, 300),
        imageKey: mediaKey(h.imageKey),
      },
      social: {
        instagram: str(s.instagram, 200),
        whatsapp: str(s.whatsapp, 15).replace(/\D/g, ''),
        youtube: str(s.youtube, 200),
        facebook: str(s.facebook, 200),
      },
      ogImageKey: mediaKey(d.ogImageKey),
    },
  };
}

async function cleanCategories(list) {
  if (!Array.isArray(list) || !list.length) return { error: 'Keep at least one category' };
  const seen = new Set();
  const out = [];
  for (const c of list.slice(0, 30)) {
    const id = str(c.id, 30).toLowerCase();
    if (!/^[a-z0-9-]+$/.test(id)) return { error: `Category id "${c.id}" — use lowercase letters, numbers, dashes` };
    if (seen.has(id)) return { error: `Duplicate category id "${id}"` };
    seen.add(id);
    const name = str(c.name, 40);
    if (!name) return { error: `Category "${id}" needs a name` };
    const tax = c.tax === 'textile' ? 'textile' : Number(c.tax);
    if (tax !== 'textile' && ![0, 5, 18, 40].includes(tax)) return { error: `"${name}": GST must be textile slab, 0, 5, 18 or 40%` };
    const hsn = str(c.hsn, 8);
    if (hsn && !/^\d{4,8}$/.test(hsn)) return { error: `"${name}": HSN must be 4–8 digits` };
    out.push({
      id, name, desc: str(c.desc, 80),
      guide: SIZE_GUIDES.includes(c.guide) ? c.guide : null,
      hsn: hsn || null, tax, visible: c.visible !== false,
    });
  }
  // A category still used by products can't disappear, or those products lose their
  // storefront filter and tax default.
  const catalog = getStore('catalog');
  const products = (await Promise.all((await catalog.list()).blobs.map((b) => catalog.get(b.key, { type: 'json' })))).filter(Boolean);
  const orphan = products.find((p) => !seen.has(p.cat));
  if (orphan) return { error: `"${orphan.name}" uses category "${orphan.cat}" — move it before removing that category` };
  return { value: out };
}

exports.handler = async (event) => {
  if (!isAdminAuthorized(event)) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  try {
    if (event.httpMethod === 'GET') {
      const [settings, categories] = await Promise.all([getSettings(), getCategories()]);
      return { statusCode: 200, body: JSON.stringify({ settings, categories, sizeGuides: SIZE_GUIDES }) };
    }
    if (event.httpMethod === 'POST') {
      const { section, data } = JSON.parse(event.body || '{}');
      const cleaned = section === 'store' ? cleanStore(data || {})
        : section === 'categories' ? await cleanCategories(data)
        : { error: 'Unknown section' };
      if (cleaned.error) return { statusCode: 400, body: JSON.stringify({ error: cleaned.error }) };
      await getStore('settings').setJSON(section, cleaned.value);
      await logEvent('settings_updated', 'admin', { section }, event);
      return { statusCode: 200, body: JSON.stringify({ [section === 'store' ? 'settings' : 'categories']: cleaned.value }) };
    }
    return { statusCode: 405, body: 'Method Not Allowed' };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Settings request failed' }) };
  }
};
