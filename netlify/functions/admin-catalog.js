const { getStore } = require('@netlify/blobs');
const { isAdminAuthorized } = require('../lib/admin-auth');
const { logEvent } = require('../lib/audit');

const VALID_CATS = ['sleeves', 'innerwear', 'socks', 'compression', 'accessories', 'fragrance', 'bottoms'];

function validateProduct(p) {
  if (!p.name || !String(p.name).trim()) return 'Name is required';
  if (!VALID_CATS.includes(p.cat)) return `Category must be one of: ${VALID_CATS.join(', ')}`;
  if (!Number.isFinite(p.price) || p.price <= 0) return 'Price must be a positive number';
  if (!Array.isArray(p.sizes) || p.sizes.length === 0) return 'At least one size/variant is required';
  return null;
}

// Full CRUD for the product catalog, gated by the same admin secret as orders/audit-log.
// GET    -> list every product (including unavailable ones, for the admin table)
// POST   -> create a new product, or update an existing one if `id` is supplied
// DELETE -> remove a product by id
exports.handler = async (event) => {
  if (!isAdminAuthorized(event)) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const store = getStore('catalog');

  try {
    if (event.httpMethod === 'GET') {
      const { blobs } = await store.list();
      const products = [];
      for (const b of blobs) {
        const p = await store.get(b.key, { type: 'json' });
        if (p) products.push(p);
      }
      products.sort((a, b) => a.id - b.id);
      return { statusCode: 200, body: JSON.stringify({ products }) };
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const err = validateProduct(body);
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
      } else {
        const existing = await store.get(String(id), { type: 'json' });
        isNew = !existing;
      }

      const product = {
        id,
        name: String(body.name).slice(0, 150),
        cat: body.cat,
        price: Math.round(body.price),
        tag: body.tag ? String(body.tag).slice(0, 30) : null,
        sizes: body.sizes.map((s) => String(s).slice(0, 20)).slice(0, 12),
        guide: body.guide ? String(body.guide).slice(0, 30) : null,
        available: body.available !== false,
        stock: Number.isFinite(body.stock) ? body.stock : null,
        updatedAt: new Date().toISOString(),
      };
      await store.setJSON(String(id), product);

      await logEvent(isNew ? 'product_created' : 'product_updated', 'admin', { id, name: product.name }, event);

      return { statusCode: 200, body: JSON.stringify({ product }) };
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
