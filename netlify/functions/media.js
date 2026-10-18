const { getStore } = require('../lib/blob-store');
const { getSettings } = require('../lib/settings');

// Public image server. /media/<key> is rewritten here (netlify.toml). Keys are random and
// never reused, so responses can be cached for a year. /og-image serves whichever image
// the admin picked as the social-share preview (crawlers need a fixed URL in the HTML).
const MEDIA_KEY = /^[a-f0-9]{16}\.(webp|jpg|png)$/;

exports.handler = async (event) => {
  try {
    // /media/<key> and /og-image arrive via path rewrites (Netlify doesn't pass query
    // params added in a rewrite's `to`); ?key= / ?og=1 still work for direct calls.
    const q = event.queryStringParameters || {};
    const last = decodeURIComponent(String(event.path || '').split('/').filter(Boolean).pop() || '');
    let key = q.key || (MEDIA_KEY.test(last) ? last : null);
    const isOg = !key && (q.og === '1' || last === 'og-image');
    if (isOg) key = (await getSettings()).ogImageKey;
    if (!key || !MEDIA_KEY.test(key)) return { statusCode: 404, body: 'Not found' };

    const found = await getStore('media').getWithMetadata(key, { type: 'arrayBuffer' });
    if (!found || !found.data) return { statusCode: 404, body: 'Not found' };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': (found.metadata && found.metadata.contentType) || 'application/octet-stream',
        // The share image can change behind its fixed URL; media keys never do.
        'Cache-Control': isOg ? 'public, max-age=3600' : 'public, max-age=31536000, immutable',
      },
      body: Buffer.from(found.data).toString('base64'),
      isBase64Encoded: true,
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: 'Could not load image' };
  }
};
