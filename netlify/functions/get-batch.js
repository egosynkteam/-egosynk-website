const { allowRequest } = require('../lib/rate-limit');
const { CODE, normCode, getBatch, publicView } = require('../lib/batches');

// Public: GET ?code=<batch code> -> the published lab results for that batch, or 404.
// Used by egosynk.com/batch/<code>, the page the QR code on every tub opens.
exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };
  // Generous: a gym full of people scanning tubs shares one IP. Stops code-guessing sprees.
  if (!(await allowRequest('get-batch', event, 120, 10 * 60 * 1000))) return json(429, { error: 'Too many lookups. Try again in a few minutes.' });
  const code = normCode((event.queryStringParameters || {}).code);
  if (!CODE.test(code)) return json(404, { error: 'No batch with that code' });
  try {
    const batch = publicView(await getBatch(code));
    if (!batch) return json(404, { error: 'No batch with that code' });
    return json(200, { batch }, 'public, max-age=60');
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Could not load the batch' });
  }
};

const json = (statusCode, body, cache = 'no-store') => ({
  statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': cache }, body: JSON.stringify(body),
});
