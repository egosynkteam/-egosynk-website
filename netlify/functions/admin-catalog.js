const { getStore } = require('../lib/blob-store');
const { isAdminAuthorized } = require('../lib/admin-auth');
const { logEvent } = require('../lib/audit');
const { getCategories, getSizeGuides } = require('../lib/settings');
const { notifyRestock } = require('../lib/stock-alerts');

const MEDIA_KEY = /^[a-f0-9]{16}\.(webp|jpg|png)$/;
const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

// { S: 10, M: 0 } — only sizes the product actually has, whole numbers ≥ 0. Returns null
// (untracked) when nothing was entered.
function normaliseStock(raw, sizes) {
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  for (const size of sizes) {
    const n = Number(raw[size]);
    if (raw[size] !== '' && raw[size] != null && Number.isFinite(n)) out[size] = Math.max(0, Math.floor(n));
  }
  return Object.keys(out).length ? out : null;
}

// Product facts shown as chips on cards and the product page. Each is optional; a product
// with none of them stores null so the storefront shows nothing rather than empty chips.
const COMPRESSION_LEVELS = ['light', 'medium', 'firm'];
function normaliseSpecs(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const gsm = Math.round(Number(raw.gsm));
  const out = {
    fit: str(raw.fit, 30) || null,
    fabric: str(raw.fabric, 60) || null,
    gsm: Number.isFinite(gsm) && gsm >= 50 && gsm <= 800 ? gsm : null,
    compression: COMPRESSION_LEVELS.includes(raw.compression) ? raw.compression : null,
  };
  return Object.values(out).some((v) => v != null) ? out : null;
}

function validateProduct(p, categoryIds) {
  if (!p.name || !String(p.name).trim()) return 'Name is required';
  if (!categoryIds.includes(p.cat)) return `Category must be one of: ${categoryIds.join(', ')}`;
  if (!Number.isFinite(p.price) || p.price <= 0) return 'Price must be a positive number';
  if (p.mrp != null && p.mrp !== '' && (!Number.isFinite(Number(p.mrp)) || Number(p.mrp) < p.price)) {
    return 'MRP must be at least the selling price (or left blank)';
  }
  if (!Array.isArray(p.sizes) || p.sizes.length === 0) return 'At least one size/variant is required';
  if (p.hsn && !/^\d{4,8}$/.test(String(p.hsn))) return 'HSN override must be 4–8 digits';
  if (p.gstRate != null && p.gstRate !== '' && ![0, 5, 18, 40].includes(Number(p.gstRate))) return 'GST override must be 0, 5, 18 or 40';
  return null;
}

// Full CRUD for the product catalog, gated by the same admin secret as orders/audit-log.
// GET    -> list every product (including hidden/unavailable ones, for the admin table)
// POST   -> create a new product, or update an existing one if `id` is supplied
// DELETE -> remove a product by id
exports.handler = async (event) => {
  if (!(await isAdminAuthorized(event))) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const store = getStore('catalog');

  try {
    if (event.httpMethod === 'GET') {
      const { blobs } = await store.list();
      const products = (await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' })))).filter(Boolean);
      products.sort((a, b) => (a.sortOrder ?? a.id) - (b.sortOrder ?? b.id) || a.id - b.id);
      return { statusCode: 200, body: JSON.stringify({ products }) };
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const [cats, guides] = await Promise.all([getCategories(), getSizeGuides()]);
      const categoryIds = cats.map((c) => c.id);
      const err = validateProduct(body, categoryIds);
      if (err) return { statusCode: 400, body: JSON.stringify({ error: err }) };

      let id = body.id;
      let isNew = false;
      if (!id) {
        // Auto-assign the next id: 1 + the highest existing id (starts at 1 for an empty catalog).
        const { blobs } = await store.list();
        let maxId = 0;
        for (const b of blobs) maxId = Math.max(maxId, Number(b.key) || 0);
        id = maxId + 1;
        isNew = true;
      }

      // Keep fields this form doesn't manage instead of silently wiping them on every save.
      const existing = isNew ? {} : ((await store.get(String(id), { type: 'json' })) || {});
      isNew = isNew || !existing.id;
      const sizes = body.sizes.map((s) => str(s, 20)).filter(Boolean).slice(0, 12);
      // A field missing from the request keeps its saved value rather than being cleared.
      for (const k of ['mrp', 'tag', 'colour', 'description', 'highlights', 'images', 'guide', 'visible',
        'sortOrder', 'hsn', 'gstRate', 'stockBySize', 'specs']) {
        if (!(k in body) && k in existing) body[k] = existing[k];
      }
      const product = {
        ...existing,
        id,
        name: str(body.name, 150),
        cat: body.cat,
        price: Math.round(body.price),
        mrp: body.mrp != null && body.mrp !== '' ? Math.round(Number(body.mrp)) : null,
        tag: body.tag ? str(body.tag, 30) : null,
        colour: body.colour ? str(body.colour, 40) : null,
        description: str(body.description, 2000) || null,
        highlights: (Array.isArray(body.highlights) ? body.highlights : []).map((h) => str(h, 120)).filter(Boolean).slice(0, 8),
        images: (Array.isArray(body.images) ? body.images : []).filter((k) => MEDIA_KEY.test(k)).slice(0, 8),
        sizes,
        guide: guides[body.guide] ? body.guide : null,
        available: body.available !== false,
        visible: body.visible !== false,
        sortOrder: Number.isFinite(Number(body.sortOrder)) && body.sortOrder !== '' && body.sortOrder != null ? Number(body.sortOrder) : null,
        hsn: body.hsn ? str(body.hsn, 8) : null,
        gstRate: body.gstRate != null && body.gstRate !== '' ? Number(body.gstRate) : null,
        stockBySize: normaliseStock(body.stockBySize, sizes),
        specs: normaliseSpecs(body.specs),
        updatedAt: new Date().toISOString(),
      };
      delete product.stock; // replaced by stockBySize
      await store.setJSON(String(id), product);

      await logEvent(isNew ? 'product_created' : 'product_updated', 'admin', { id, name: product.name }, event);

      // A size (or the whole product) coming back into stock emails everyone who asked.
      let restock = { sent: 0 };
      if (!isNew) {
        try { restock = await notifyRestock(existing, product); } catch (err) { console.error('Restock alerts failed:', err); }
      }

      return { statusCode: 200, body: JSON.stringify({ product, restockEmails: restock.sent }) };
    }

    if (event.httpMethod === 'DELETE') {
      const id = (event.queryStringParameters && event.queryStringParameters.id) ||
        (JSON.parse(event.body || '{}').id);
      if (!id) return { statusCode: 400, body: JSON.stringify({ error: 'Missing product id' }) };

      await store.delete(String(id));
      await logEvent('product_deleted', 'admin', { id }, event);

      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, body: 'Method Not Allowed' };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Catalog operation failed' }) };
  }
};
