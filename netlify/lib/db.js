const { Pool } = require('pg');

// Supabase Postgres (SUPABASE_DB_URL, the transaction pooler on port 6543). Everything
// lives in the private `egosynk` schema, which Supabase's REST API doesn't expose.
//  - egosynk.kv holds the same key/value documents as the Blobs stores, so the code
//    above blob-store.js works unchanged on either backend.
//  - invoice_counters / invoice_numbers hand out GST invoice numbers atomically.
// The pooler runs in transaction mode, so no named prepared statements (pg only makes
// those when a query is given a `name`, which this file never does).
let pool = null;
function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.SUPABASE_DB_URL,
      // One function instance handles one request at a time; a couple of connections
      // covers the Promise.all reads without hogging the pooler.
      max: 2,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 8000,
      // Encrypted. Supabase's pooler certificate is signed by Supabase's own CA, which
      // isn't in Node's trust store, so the chain isn't verified. sslmode=disable in the
      // URL turns TLS off, for a local test database only.
      ssl: /[?&]sslmode=disable/.test(process.env.SUPABASE_DB_URL || '') ? false : { rejectUnauthorized: false },
    });
    pool.on('error', (err) => console.error('Postgres pool error:', err));
  }
  return pool;
}

const query = (text, params) => getPool().query(text, params);

const SCHEMA_SQL = `
CREATE SCHEMA IF NOT EXISTS egosynk;
CREATE TABLE IF NOT EXISTS egosynk.kv (
  store text NOT NULL,
  key text NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (store, key)
);
CREATE TABLE IF NOT EXISTS egosynk.invoice_counters (
  fy text PRIMARY KEY,
  last integer NOT NULL
);
CREATE TABLE IF NOT EXISTS egosynk.invoice_numbers (
  order_id text PRIMARY KEY,
  fy text NOT NULL,
  seq integer NOT NULL,
  UNIQUE (fy, seq)
);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON SCHEMA egosynk FROM anon, authenticated;
    REVOKE ALL ON ALL TABLES IN SCHEMA egosynk FROM anon, authenticated;
  END IF;
END $$;`;

const ensureSchema = () => query(SCHEMA_SQL);

// The Blobs store API that the rest of the code uses, on egosynk.kv.
function pgStore(name) {
  return {
    async get(key, opts) {
      const { rows } = await query('SELECT value FROM egosynk.kv WHERE store = $1 AND key = $2', [name, String(key)]);
      if (!rows.length) return null;
      return opts && opts.type === 'json' ? rows[0].value : JSON.stringify(rows[0].value);
    },
    async setJSON(key, value) {
      await query(
        `INSERT INTO egosynk.kv (store, key, value, updated_at) VALUES ($1, $2, $3::jsonb, now())
         ON CONFLICT (store, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [name, String(key), JSON.stringify(value)],
      );
    },
    async delete(key) {
      await query('DELETE FROM egosynk.kv WHERE store = $1 AND key = $2', [name, String(key)]);
    },
    async list(opts = {}) {
      const { rows } = await query(
        'SELECT key FROM egosynk.kv WHERE store = $1 AND starts_with(key, $2) ORDER BY key',
        [name, opts.prefix || ''],
      );
      return { blobs: rows.map((r) => ({ key: r.key })) };
    },
    // Keys and values in one query (the Blobs version needs a read per key).
    async listValues(opts = {}) {
      const { rows } = await query(
        'SELECT key, value FROM egosynk.kv WHERE store = $1 AND starts_with(key, $2) ORDER BY key',
        [name, opts.prefix || ''],
      );
      return rows;
    },
    // Replaces the whole store with `entries` ([{ key, value }]) — used by the migration.
    async replaceAll(entries) {
      const client = await getPool().connect();
      try {
        await client.query('BEGIN');
        await client.query('DELETE FROM egosynk.kv WHERE store = $1', [name]);
        for (let i = 0; i < entries.length; i += 500) {
          await client.query(
            `INSERT INTO egosynk.kv (store, key, value)
             SELECT $1, t.key, t.value FROM jsonb_to_recordset($2::jsonb) AS t(key text, value jsonb)`,
            [name, JSON.stringify(entries.slice(i, i + 500))],
          );
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },
  };
}

// Next number in a financial year's invoice series for an order, in one statement (so
// one transaction): an order that already has a number gets the same one back, and a
// race between verify-payment and the webhook for the same order makes one of them fail
// the order_id key — its counter bump rolls back with it — and the retry reads the
// winner's number. No gaps, no duplicates.
async function claimInvoiceSeq(orderId, fy) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { rows } = await query(
        `WITH existing AS (SELECT seq FROM egosynk.invoice_numbers WHERE order_id = $1),
         bump AS (
           INSERT INTO egosynk.invoice_counters (fy, last) SELECT $2, 1 WHERE NOT EXISTS (SELECT 1 FROM existing)
           ON CONFLICT (fy) DO UPDATE SET last = egosynk.invoice_counters.last + 1
           RETURNING last),
         ins AS (INSERT INTO egosynk.invoice_numbers (order_id, fy, seq) SELECT $1, $2, last FROM bump RETURNING seq)
         SELECT seq FROM existing UNION ALL SELECT seq FROM ins`,
        [orderId, fy],
      );
      return rows[0].seq;
    } catch (err) {
      if (err.code !== '23505') throw err; // unique_violation: lost a race, read again
    }
  }
  throw new Error('Could not allocate invoice number');
}

// The invoice series as the Blobs `invoices` store keeps it (counter/<fy>, claim/<fy>/<n>),
// for copying between backends.
async function readInvoiceSeries() {
  const [counters, numbers] = await Promise.all([
    query('SELECT fy, last FROM egosynk.invoice_counters'),
    query('SELECT order_id, fy, seq FROM egosynk.invoice_numbers'),
  ]);
  return { counters: counters.rows, numbers: numbers.rows };
}

async function replaceInvoiceSeries({ counters, numbers }) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM egosynk.invoice_numbers');
    await client.query('DELETE FROM egosynk.invoice_counters');
    if (counters.length) {
      await client.query(
        'INSERT INTO egosynk.invoice_counters (fy, last) SELECT fy, last FROM jsonb_to_recordset($1::jsonb) AS t(fy text, last int)',
        [JSON.stringify(counters)],
      );
    }
    if (numbers.length) {
      await client.query(
        `INSERT INTO egosynk.invoice_numbers (order_id, fy, seq)
         SELECT order_id, fy, seq FROM jsonb_to_recordset($1::jsonb) AS t(order_id text, fy text, seq int)`,
        [JSON.stringify(numbers)],
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { query, ensureSchema, pgStore, claimInvoiceSeq, readInvoiceSeries, replaceInvoiceSeries };
