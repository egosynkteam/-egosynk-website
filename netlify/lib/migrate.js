const { blobsStore, blobsListValues } = require('./blob-store');
const db = require('./db');

// Copies stores between Blobs and Postgres and checks the two sides match (admin →
// Settings → Database). A copy makes the target an exact mirror of the source, so it
// always runs FROM the backend currently in use, never into it.
//
// The invoice series is special: Blobs keeps it as `counter/<fy>` + `claim/<fy>/<n>` keys
// in the `invoices` store, Postgres in its own tables (db.claimInvoiceSeq). Both sides
// are turned into the same key form before comparing.
const COUNTER = /^counter\/(.+)$/;
const CLAIM = /^claim\/(.+)\/(\d+)$/;
const isSeriesKey = (k) => COUNTER.test(k) || CLAIM.test(k);

function seriesFromEntries(entries) {
  const last = {};
  const byOrder = {};
  for (const { key, value } of entries) {
    let m;
    if ((m = COUNTER.exec(key))) last[m[1]] = Math.max(last[m[1]] || 0, Number(value && value.last) || 0);
    else if ((m = CLAIM.exec(key)) && value && value.orderId) {
      const seq = Number(m[2]);
      // One number per order; if an old collision left two, the later claim is the real one.
      if (!byOrder[value.orderId] || byOrder[value.orderId].seq < seq) byOrder[value.orderId] = { order_id: value.orderId, fy: m[1], seq };
    }
  }
  const numbers = Object.values(byOrder);
  for (const n of numbers) last[n.fy] = Math.max(last[n.fy] || 0, n.seq);
  return { counters: Object.entries(last).map(([fy, l]) => ({ fy, last: l })), numbers };
}

function seriesToEntries({ counters, numbers }) {
  return [
    ...counters.map((c) => ({ key: `counter/${c.fy}`, value: { last: c.last } })),
    ...numbers.map((n) => ({ key: `claim/${n.fy}/${n.seq}`, value: { orderId: n.order_id } })),
  ];
}

// The store's entries as a { key: canonical JSON } map, invoice series normalised.
function canonical(name, entries, series) {
  let list = entries;
  if (name === 'invoices') {
    list = [...entries.filter((e) => !isSeriesKey(e.key)), ...seriesToEntries(series || seriesFromEntries(entries))];
  }
  return new Map(list.map((e) => [e.key, stableJson(e.value)]));
}

// JSON with object keys sorted, since jsonb doesn't keep key order.
function stableJson(v) {
  if (Array.isArray(v)) return `[${v.map(stableJson).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stableJson(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

async function readPostgres(name) {
  const entries = await db.pgStore(name).listValues();
  return { entries, series: name === 'invoices' ? await db.readInvoiceSeries() : null };
}

async function copyStore(name, from) {
  if (from === 'blobs') {
    const entries = await blobsListValues(blobsStore(name));
    await db.pgStore(name).replaceAll(entries);
    if (name === 'invoices') await db.replaceInvoiceSeries(seriesFromEntries(entries));
    return { store: name, copied: entries.length };
  }
  const { entries, series } = await readPostgres(name);
  const list = name === 'invoices' ? [...entries.filter((e) => !isSeriesKey(e.key)), ...seriesToEntries(series)] : entries;
  const target = blobsStore(name);
  const keep = new Set(list.map((e) => e.key));
  for (let i = 0; i < list.length; i += 25) {
    await Promise.all(list.slice(i, i + 25).map((e) => target.setJSON(e.key, e.value)));
  }
  const stale = (await target.list()).blobs.filter((b) => !keep.has(b.key));
  for (let i = 0; i < stale.length; i += 25) {
    await Promise.all(stale.slice(i, i + 25).map((b) => target.delete(b.key)));
  }
  return { store: name, copied: list.length, removed: stale.length };
}

async function verifyStore(name) {
  const [blobs, pg] = await Promise.all([blobsListValues(blobsStore(name)), readPostgres(name)]);
  const a = canonical(name, blobs);
  const b = canonical(name, pg.entries, pg.series);
  const missing = [...a.keys()].filter((k) => !b.has(k));
  const extra = [...b.keys()].filter((k) => !a.has(k));
  const different = [...a.keys()].filter((k) => b.has(k) && a.get(k) !== b.get(k));
  return {
    store: name, blobs: a.size, postgres: b.size,
    ok: !missing.length && !extra.length && !different.length,
    missing: missing.slice(0, 5), extra: extra.slice(0, 5), different: different.slice(0, 5),
    counts: { missing: missing.length, extra: extra.length, different: different.length },
  };
}

module.exports = { copyStore, verifyStore, seriesFromEntries, stableJson };
