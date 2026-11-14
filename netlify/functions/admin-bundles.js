const { getStore } = require('../lib/blob-store');
const { purgeCatalog } = require('../lib/cdn');
const { requireAdmin } = require('../lib/admin-auth');
const { logEvent } = require('../lib/audit');
const { getBundles, cleanBundles } = require('../lib/bundles');

// Launch bundles for admin.html → Bundles. Prices, so the `prices` permission.
//   GET                  -> { bundles }
//   POST { bundles: [] } -> save the full ordered list
exports.handler = async (event) => {
  const auth = await requireAdmin(event, event.httpMethod === 'GET' ? 'catalog' : 'prices');
  if (auth.response) return auth.response;
  try {
    if (event.httpMethod === 'GET') {
      return { statusCode: 200, headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify({ bundles: await getBundles() }) };
    }
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
    const { value, error } = cleanBundles(JSON.parse(event.body || '{}').bundles);
    if (error) return { statusCode: 400, body: JSON.stringify({ error }) };
    await getStore('settings').setJSON('bundles', value);
    await purgeCatalog();
    await logEvent('bundles_saved', auth.admin.email, { count: value.length, live: value.filter((b) => b.status === 'live').map((b) => b.id) }, event);
    return { statusCode: 200, body: JSON.stringify({ bundles: value }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Could not save bundles' }) };
  }
};
