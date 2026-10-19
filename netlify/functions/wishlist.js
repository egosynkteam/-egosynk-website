const { getStore } = require('../lib/blob-store');
const { getSessionUser } = require('../lib/session');

// The logged-in customer's saved products, so the heart list follows them across devices.
// Guests keep their list in the browser only. The storefront merges the two on load.
//   GET  → { ids: [3, 7] }
//   POST { ids: [...] } → replaces the saved list
const MAX = 200;

exports.handler = async (event) => {
  try {
    const session = await getSessionUser(event);
    if (!session) return { statusCode: 401, body: JSON.stringify({ error: 'Not logged in' }) };
    const store = getStore('wishlists');
    const key = String(session.user.id);

    if (event.httpMethod === 'GET') {
      const rec = (await store.get(key, { type: 'json' })) || { ids: [] };
      return { statusCode: 200, body: JSON.stringify({ ids: rec.ids }) };
    }
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, MAX);
      await store.setJSON(key, { ids, updatedAt: new Date().toISOString() });
      return { statusCode: 200, body: JSON.stringify({ ids }) };
    }
    return { statusCode: 405, body: 'Method Not Allowed' };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Could not update saved items' }) };
  }
};
