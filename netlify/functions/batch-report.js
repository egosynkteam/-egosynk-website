const { blobsStore } = require('../lib/blob-store');
const { REPORT_KEY, getBatch, publicView } = require('../lib/batches');

// Public: /batch-report/<key> (rewritten here in netlify.toml) -> the lab report PDF, but only
// while its batch is published, so a draft report can't be opened by guessing the URL.
exports.handler = async (event) => {
  const key = decodeURIComponent(String(event.path || '').split('/').filter(Boolean).pop() || '');
  if (!REPORT_KEY.test(key)) return { statusCode: 404, body: 'Not found' };
  try {
    const code = key.replace(/-[a-f0-9]{12}\.pdf$/, '');
    const batch = publicView(await getBatch(code));
    if (!batch || batch.reportUrl !== `/batch-report/${key}`) return { statusCode: 404, body: 'Not found' };
    const found = await blobsStore('batch-reports').getWithMetadata(key, { type: 'arrayBuffer' });
    if (!found || !found.data) return { statusCode: 404, body: 'Not found' };
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="EGOSYNK-${code}-lab-report.pdf"`,
        'Cache-Control': 'public, max-age=300',
        'X-Robots-Tag': 'noindex',
      },
      body: Buffer.from(found.data).toString('base64'),
      isBase64Encoded: true,
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: 'Could not load the report' };
  }
};
