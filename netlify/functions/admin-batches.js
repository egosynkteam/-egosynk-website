const { requireAdmin } = require('../lib/admin-auth');
const { logEvent } = require('../lib/audit');
const { normCode, parseBatch, getBatch, listBatches, saveBatch, deleteBatch, attachReport } = require('../lib/batches');

// Batch lab reports for admin.html → Batch tests.
//   GET                                                   -> { batches }
//   POST { action: 'save', batch, originalCode? }         -> { batch }   (create, or edit when originalCode is set)
//   POST { action: 'upload-report', code, data: <base64> } -> { batch }  (PDF)
//   POST { action: 'delete', code }
exports.handler = async (event) => {
  const auth = await requireAdmin(event, 'batches');
  if (auth.response) return auth.response;
  try {
    if (event.httpMethod === 'GET') {
      return { statusCode: 200, headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify({ batches: await listBatches() }) };
    }
    if (event.httpMethod !== 'POST') return bad('Method Not Allowed', 405);
    const b = JSON.parse(event.body || '{}');

    if (b.action === 'save') {
      const original = b.originalCode ? await getBatch(b.originalCode) : null;
      if (b.originalCode && !original) return bad('Batch not found', 404);
      const { batch, error } = parseBatch(b.batch, original);
      if (error) return bad(error);
      // The code is printed on the tubs and in the QR, so it never changes once created.
      if (original && original.code !== batch.code) return bad("The batch code can't be changed. Delete the batch and add it again.");
      if (!original && (await getBatch(batch.code))) return bad(`Batch ${batch.code} already exists`);
      await saveBatch(batch);
      await logEvent('batch_saved', auth.admin.email, { code: batch.code, published: batch.published }, event);
      return ok({ batch });
    }

    if (b.action === 'upload-report') {
      const { error } = await attachReport(b.code, b.data);
      if (error) return bad(error);
      await logEvent('batch_report_uploaded', auth.admin.email, { code: normCode(b.code) }, event);
      return ok({ batch: await getBatch(b.code) });
    }

    if (b.action === 'delete') {
      if (!(await deleteBatch(b.code))) return bad('Batch not found', 404);
      await logEvent('batch_deleted', auth.admin.email, { code: normCode(b.code) }, event);
      return ok({});
    }
    return bad('Unknown action');
  } catch (err) {
    console.error(err);
    return bad('Batch request failed', 500);
  }
};

const ok = (body) => ({ statusCode: 200, body: JSON.stringify(body) });
const bad = (error, statusCode = 400) => ({ statusCode, body: JSON.stringify({ error }) });
