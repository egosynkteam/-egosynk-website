const { requireAdmin } = require('../lib/admin-auth');
const { logEvent } = require('../lib/audit');
const { blobsStore, currentBackend, setBackend, STORES } = require('../lib/blob-store');
const { ensureSchema, query } = require('../lib/db');
const { copyStore, verifyStore } = require('../lib/migrate');

// Moving the store's data between Netlify Blobs and Supabase Postgres (admin → Settings →
// Database, owner only). The page runs it one store per request to stay inside the
// function time limit:
//   GET                                -> { configured, backend, override, switched, stores }
//   POST { action: 'setup' }           -> create the egosynk schema and tables
//   POST { action: 'copy', store }     -> mirror one store FROM the backend in use to the other
//   POST { action: 'verify', store }   -> compare one store on both sides
//   POST { action: 'switch', to }      -> re-verify every store, then switch (refused on any mismatch)
exports.handler = async (event) => {
  const auth = await requireAdmin(event, 'owner');
  if (auth.response) return auth.response;
  const { admin } = auth;
  try {
    const configured = !!process.env.SUPABASE_DB_URL;
    if (event.httpMethod === 'GET') {
      const switched = await blobsStore('system').get('backend', { type: 'json' });
      return ok({ configured, backend: await currentBackend(), override: process.env.DATA_BACKEND || null, switched, stores: STORES });
    }
    if (event.httpMethod !== 'POST') return bad('Method Not Allowed', 405);
    if (!configured) return bad('SUPABASE_DB_URL is not set in Netlify (or the site hasn\'t been redeployed since)');

    const b = JSON.parse(event.body || '{}');
    if (b.action === 'setup') {
      await ensureSchema();
      const { rows } = await query("SELECT current_setting('server_version') AS version");
      await logEvent('database_setup', 'admin', { version: rows[0].version }, event);
      return ok({ ready: true, version: rows[0].version });
    }
    if (b.action === 'copy' || b.action === 'verify') {
      if (!STORES.includes(b.store)) return bad('Unknown store');
      if (b.action === 'verify') return ok(await verifyStore(b.store));
      const from = await currentBackend();
      // Not audit-logged: the entry would land in audit-log after it was copied and make
      // the two sides differ.
      return ok({ ...(await copyStore(b.store, from)), from });
    }
    if (b.action === 'switch') {
      if (!['postgres', 'blobs'].includes(b.to)) return bad('Switch to postgres or blobs');
      if (b.to === (await currentBackend())) return bad(`Already on ${b.to}`);
      // The data must match on both sides at this moment, or orders since the last copy
      // would be left behind.
      const results = [];
      for (let i = 0; i < STORES.length; i += 6) {
        results.push(...await Promise.all(STORES.slice(i, i + 6).map(verifyStore)));
      }
      const bad_ = results.filter((r) => !r.ok);
      if (bad_.length) {
        return { statusCode: 409, body: JSON.stringify({ error: `Not switched: ${bad_.map((r) => r.store).join(', ')} differ. Copy again, then switch.`, results }) };
      }
      await setBackend(b.to, admin.email);
      await logEvent('database_switch', 'admin', { to: b.to }, event);
      return ok({ backend: b.to, results });
    }
    return bad('Unknown action');
  } catch (err) {
    console.error(err);
    return bad(`Database step failed: ${err.message || err}`, 500);
  }
};

const ok = (data) => ({ statusCode: 200, body: JSON.stringify(data) });
const bad = (error, statusCode = 400) => ({ statusCode, body: JSON.stringify({ error }) });
