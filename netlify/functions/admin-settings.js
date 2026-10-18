const { getStore } = require('../lib/blob-store');
const { isAdminAuthorized } = require('../lib/admin-auth');
const { logEvent } = require('../lib/audit');
const { getSettings, getCategories, getSizeGuides } = require('../lib/settings');
const { getCoupons, normCode } = require('../lib/coupons');

// Admin editing of store settings and categories (Settings + Categories tabs).
//   GET                                   -> { settings, categories, sizeGuides }
//   POST { section: 'store', data }       -> save shipping / banner / hero / links
//   POST { section: 'categories', data }  -> save the full ordered category list
//   POST { section: 'coupons', data }     -> save the full coupon list
//   POST { section: 'sizeGuides', data }  -> save all size charts { key: {title, sub, head, rows} }
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

async function allProducts() {
  const catalog = getStore('catalog');
  return (await Promise.all((await catalog.list()).blobs.map((b) => catalog.get(b.key, { type: 'json' })))).filter(Boolean);
}

async function cleanCoupons(list) {
  if (!Array.isArray(list)) return { error: 'Bad coupon list' };
  // Use counts only ever come from paid orders, never from the form.
  const used = Object.fromEntries((await getCoupons()).map((c) => [c.code, c.usedCount || 0]));
  const seen = new Set();
  const out = [];
  for (const c of list.slice(0, 100)) {
    const code = normCode(c.code);
    if (!/^[A-Z0-9-]{3,20}$/.test(code)) return { error: `Code "${c.code}" — 3–20 letters, numbers or dashes` };
    if (seen.has(code)) return { error: `Duplicate code ${code}` };
    seen.add(code);
    const type = c.type === 'flat' ? 'flat' : 'percent';
    const value = Number(c.value);
    if (!(value > 0) || (type === 'percent' && value > 90)) return { error: `${code}: ${type === 'percent' ? 'percent must be 1–90' : 'amount must be above 0'}` };
    const expiresAt = c.expiresAt ? str(c.expiresAt, 10) : null;
    if (expiresAt && !/^\d{4}-\d{2}-\d{2}$/.test(expiresAt)) return { error: `${code}: bad expiry date` };
    out.push({
      code, type, value: Math.round(value),
      minSubtotal: money(c.minSubtotal) || 0,
      maxDiscount: type === 'percent' ? money(c.maxDiscount) || null : null,
      expiresAt,
      usageLimit: money(c.usageLimit) || null,
      usedCount: used[code] || 0,
      active: c.active !== false,
    });
  }
  return { value: out };
}

async function cleanSizeGuides(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { error: 'Bad size guides' };
  const out = {};
  for (const [rawKey, g] of Object.entries(data).slice(0, 30)) {
    const key = str(rawKey, 30).toLowerCase();
    if (!/^[a-z0-9-]+$/.test(key)) return { error: `Guide id "${rawKey}" — lowercase letters, numbers, dashes` };
    const title = str(g && g.title, 60);
    if (!title) return { error: `Guide "${key}" needs a title` };
    const head = (Array.isArray(g.head) ? g.head : []).map((h) => str(h, 30)).filter(Boolean).slice(0, 6);
    if (head.length < 2) return { error: `"${title}": needs at least 2 columns` };
    const rows = (Array.isArray(g.rows) ? g.rows : []).slice(0, 25)
      .map((r) => (Array.isArray(r) ? r : []).slice(0, head.length).map((v) => str(v, 30)))
      .filter((r) => r.some(Boolean));
    if (!rows.length) return { error: `"${title}": add at least one row` };
    out[key] = { title, sub: str(g.sub, 60), head, rows: rows.map((r) => head.map((_, i) => r[i] || '')) };
  }
  if (!Object.keys(out).length) return { error: 'Keep at least one size guide' };
  // Don't strand categories or products pointing at a deleted guide.
  const categories = await getCategories();
  const cat = categories.find((c) => c.guide && !out[c.guide]);
  if (cat) return { error: `Category "${cat.name}" uses guide "${cat.guide}" — change it first` };
  const prod = (await allProducts()).find((p) => p.guide && !out[p.guide]);
  if (prod) return { error: `"${prod.name}" uses guide "${prod.guide}" — change it first` };
  return { value: out };
}

async function cleanCategories(list) {
  if (!Array.isArray(list) || !list.length) return { error: 'Keep at least one category' };
  const seen = new Set();
  const out = [];
  const guides = await getSizeGuides();
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
      guide: guides[c.guide] ? c.guide : null,
      hsn: hsn || null, tax, visible: c.visible !== false,
    });
  }
  // A category still used by products can't disappear, or those products lose their
  // storefront filter and tax default.
  const orphan = (await allProducts()).find((p) => !seen.has(p.cat));
  if (orphan) return { error: `"${orphan.name}" uses category "${orphan.cat}" — move it before removing that category` };
  return { value: out };
}

exports.handler = async (event) => {
  if (!isAdminAuthorized(event)) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  try {
    if (event.httpMethod === 'GET') {
      const [settings, categories, sizeGuides, coupons] = await Promise.all([getSettings(), getCategories(), getSizeGuides(), getCoupons()]);
      return { statusCode: 200, body: JSON.stringify({ settings, categories, sizeGuides, coupons }) };
    }
    if (event.httpMethod === 'POST') {
      const { section, data } = JSON.parse(event.body || '{}');
      const cleaned = section === 'store' ? cleanStore(data || {})
        : section === 'categories' ? await cleanCategories(data)
        : section === 'coupons' ? await cleanCoupons(data)
        : section === 'sizeGuides' ? await cleanSizeGuides(data)
        : { error: 'Unknown section' };
      if (cleaned.error) return { statusCode: 400, body: JSON.stringify({ error: cleaned.error }) };
      await getStore('settings').setJSON(section, cleaned.value);
      await logEvent('settings_updated', 'admin', { section }, event);
      return { statusCode: 200, body: JSON.stringify({ [section === 'store' ? 'settings' : section]: cleaned.value }) };
    }
    return { statusCode: 405, body: 'Method Not Allowed' };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Settings request failed' }) };
  }
};
