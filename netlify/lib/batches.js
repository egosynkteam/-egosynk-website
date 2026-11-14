const crypto = require('crypto');
const { getStore, blobsStore } = require('./blob-store');

// Batch lab reports. Every tub carries a batch code and a QR code to
// egosynk.com/batch/<code>, where the buyer sees what the lab measured in that batch.
// Records live in the `batches` store (keyed by code); the report PDFs in the blobs-only
// `batch-reports` store (binary, like `media`). Only published batches are public.
//   { code, product, mfg, expiry, lab, reportDate, reportKey, results: [{ test, label, found, ok }],
//     notes, published, createdAt, updatedAt }
const PRODUCTS = { 'hydro-150': 'HYDRO 150', 'hydro-0': 'HYDRO 0', 'hydro-200': 'HYDRO 200', eaa: 'EAA' };
const CODE = /^[A-Z0-9][A-Z0-9-]{2,23}$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const REPORT_KEY = /^[A-Z0-9-]{3,24}-[a-f0-9]{12}\.pdf$/;
const MAX_REPORT_BYTES = 4 * 1024 * 1024;   // a function response caps at 6 MB of base64

const normCode = (c) => String(c || '').trim().toUpperCase();
const clean = (v, n = 200) => String(v == null ? '' : v).trim().slice(0, n);

// Validates and normalises an admin-submitted batch. Returns { batch } or { error }.
function parseBatch(input, existing) {
  const b = input || {};
  const code = normCode(b.code);
  if (!CODE.test(code)) return { error: 'Batch code: 3–24 capital letters, digits or dashes, e.g. H150-2702-01' };
  if (!PRODUCTS[b.product]) return { error: 'Pick a product' };
  const mfg = clean(b.mfg, 7);
  const expiry = clean(b.expiry, 7);
  if (!MONTH.test(mfg)) return { error: 'Manufactured: month as YYYY-MM' };
  if (!MONTH.test(expiry) || expiry <= mfg) return { error: 'Best before: month as YYYY-MM, after the manufacturing month' };
  const reportDate = clean(b.reportDate, 10);
  if (reportDate && !DAY.test(reportDate)) return { error: 'Report date: YYYY-MM-DD' };
  const results = (Array.isArray(b.results) ? b.results : []).slice(0, 40)
    .map((r) => ({ test: clean(r && r.test, 80), label: clean(r && r.label, 40), found: clean(r && r.found, 40), ok: !!(r && r.ok) }))
    .filter((r) => r.test);
  const published = !!b.published;
  if (published && !results.length && !(existing && existing.reportKey)) {
    return { error: 'Add the lab results or upload the report before publishing' };
  }
  const now = new Date().toISOString();
  return {
    batch: {
      code, product: b.product, mfg, expiry, lab: clean(b.lab, 120), reportDate,
      reportKey: existing ? existing.reportKey || null : null,
      results, notes: clean(b.notes, 1000), published,
      createdAt: existing ? existing.createdAt : now, updatedAt: now,
    },
  };
}

async function getBatch(code) {
  return getStore('batches').get(normCode(code), { type: 'json' });
}

async function listBatches() {
  const rows = await getStore('batches').listValues();
  return rows.map((r) => r.value).sort((a, b) => String(b.mfg).localeCompare(String(a.mfg)) || a.code.localeCompare(b.code));
}

async function saveBatch(batch) {
  await getStore('batches').setJSON(batch.code, batch);
  return batch;
}

async function deleteBatch(code) {
  const b = await getBatch(code);
  if (!b) return false;
  if (b.reportKey) await blobsStore('batch-reports').delete(b.reportKey);
  await getStore('batches').delete(b.code);
  return true;
}

// Stores a PDF report for a batch, replacing any earlier one. Returns { key } or { error }.
async function attachReport(code, base64) {
  const b = await getBatch(code);
  if (!b) return { error: 'Save the batch first' };
  const bytes = Buffer.from(String(base64 || ''), 'base64');
  if (!bytes.length) return { error: 'Empty file' };
  if (bytes.length > MAX_REPORT_BYTES) return { error: 'Report too large (max 4 MB). Save it as a smaller PDF.' };
  if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-') return { error: 'Upload the report as a PDF' };
  const key = `${b.code}-${crypto.randomBytes(6).toString('hex')}.pdf`;
  const store = blobsStore('batch-reports');
  await store.set(key, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length),
    { metadata: { contentType: 'application/pdf', size: bytes.length, uploadedAt: new Date().toISOString() } });
  if (b.reportKey) await store.delete(b.reportKey);
  await saveBatch({ ...b, reportKey: key, updatedAt: new Date().toISOString() });
  return { key };
}

// What the public page shows: published batches only, without internal fields.
function publicView(b) {
  if (!b || !b.published) return null;
  return {
    code: b.code, product: b.product, productName: PRODUCTS[b.product], mfg: b.mfg, expiry: b.expiry,
    lab: b.lab, reportDate: b.reportDate, results: b.results, notes: b.notes,
    reportUrl: b.reportKey ? `/batch-report/${b.reportKey}` : null, updatedAt: b.updatedAt,
  };
}

module.exports = { PRODUCTS, CODE, REPORT_KEY, normCode, parseBatch, getBatch, listBatches, saveBatch, deleteBatch, attachReport, publicView };
