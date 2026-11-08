const { getStore: getStoreRaw } = require('@netlify/blobs');

// This site doesn't get Netlify's automatic Blobs context (NETLIFY_BLOBS_CONTEXT env var)
// injected at runtime — confirmed in production via MissingBlobsEnvironmentError. Passing
// siteID + an API token explicitly sidesteps auto-detection entirely and works
// unconditionally. Requires NETLIFY_SITE_ID and NETLIFY_API_TOKEN env vars in Netlify.
function blobsStore(name) {
  if (process.env.NETLIFY_SITE_ID && process.env.NETLIFY_API_TOKEN) {
    return getStoreRaw({
      name,
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_API_TOKEN,
    });
  }
  // Fall back to automatic detection, in case a future deploy/site migration does support it.
  return getStoreRaw(name);
}

// Data lives in Netlify Blobs or in Supabase Postgres (lib/db.js), switched from admin →
// Settings → Database without a deploy: the choice is the `backend` key in the Blobs
// `system` store. Photos (`media`) and the switch itself always stay in Blobs.
// Every store that holds data must be listed here so the migration copies it.
const STORES = [
  'orders', 'catalog', 'settings', 'invoices', 'reviews', 'users', 'sessions', 'admin-users',
  'admin-sessions', 'audit-log', 'security', 'email-optout', 'stock-alerts', 'wishlists',
  'buyers', 'enquiries', 'password-resets', 'email-verifications', 'admin-resets', 'waitlist', 'batches',
];

// Each function instance re-reads the switch at most every 10 s.
const FLAG_TTL_MS = 10 * 1000;
let flag = { at: 0, backend: 'blobs' };

async function currentBackend() {
  // DATA_BACKEND=blobs in Netlify is the emergency override (needs a redeploy).
  if (!process.env.SUPABASE_DB_URL || process.env.DATA_BACKEND === 'blobs') return 'blobs';
  if (Date.now() - flag.at < FLAG_TTL_MS) return flag.backend;
  try {
    const f = await blobsStore('system').get('backend', { type: 'json' });
    flag = { at: Date.now(), backend: f && f.backend === 'postgres' ? 'postgres' : 'blobs' };
  } catch (err) {
    // Keep the last known answer rather than guess; with none, fail the request.
    if (!flag.at) throw err;
    console.error('Backend switch unreadable, keeping', flag.backend, err);
  }
  return flag.backend;
}

async function setBackend(backend, by) {
  await blobsStore('system').setJSON('backend', { backend, by, at: new Date().toISOString() });
  flag = { at: Date.now(), backend };
}

// Keys + values. Blobs needs a read per key (in batches); Postgres does it in one query.
async function blobsListValues(store, opts) {
  const { blobs } = await store.list(opts);
  const out = [];
  for (let i = 0; i < blobs.length; i += 25) {
    const batch = blobs.slice(i, i + 25);
    const values = await Promise.all(batch.map((b) => store.get(b.key, { type: 'json' })));
    batch.forEach((b, n) => { if (values[n] != null) out.push({ key: b.key, value: values[n] }); });
  }
  return out;
}

function getStore(name) {
  if (!STORES.includes(name)) return blobsStore(name);
  const pick = async () => ((await currentBackend()) === 'postgres' ? require('./db').pgStore(name) : blobsStore(name));
  return {
    get: async (key, opts) => (await pick()).get(key, opts),
    setJSON: async (key, value) => (await pick()).setJSON(key, value),
    delete: async (key) => (await pick()).delete(key),
    list: async (opts) => (await pick()).list(opts),
    async listValues(opts) {
      const s = await pick();
      return s.listValues ? s.listValues(opts) : blobsListValues(s, opts);
    },
  };
}

module.exports = { getStore, blobsStore, blobsListValues, currentBackend, setBackend, STORES };
