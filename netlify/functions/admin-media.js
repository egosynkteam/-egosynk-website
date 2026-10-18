const crypto = require('crypto');
const { getStore } = require('../lib/blob-store');
const { isAdminAuthorized } = require('../lib/admin-auth');
const { logEvent } = require('../lib/audit');

// Image uploads for products, the homepage hero and the share image. admin.html resizes
// and converts images to WebP in the browser first, so uploads stay small; this only
// checks type and size and stores the bytes in the `media` store. Served by media.js at
// /media/<key>.
//   POST   { data: <base64>, contentType }  -> { key, url }
//   DELETE ?key=<key>
const TYPES = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };
const MAX_BYTES = 1.5 * 1024 * 1024;

exports.handler = async (event) => {
  if (!(await isAdminAuthorized(event))) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  const store = getStore('media');

  try {
    if (event.httpMethod === 'POST') {
      const { data, contentType } = JSON.parse(event.body || '{}');
      if (!TYPES[contentType]) return bad('Only WebP, JPEG or PNG images');
      const bytes = Buffer.from(String(data || ''), 'base64');
      if (!bytes.length) return bad('Empty image');
      if (bytes.length > MAX_BYTES) return bad('Image too large (max 1.5 MB after resizing)');

      const key = `${crypto.randomBytes(8).toString('hex')}.${TYPES[contentType]}`;
      const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length);
      await store.set(key, buf, { metadata: { contentType, size: bytes.length, uploadedAt: new Date().toISOString() } });
      await logEvent('media_uploaded', 'admin', { key, size: bytes.length }, event);
      return { statusCode: 200, body: JSON.stringify({ key, url: `/media/${key}` }) };
    }

    if (event.httpMethod === 'DELETE') {
      const key = event.queryStringParameters && event.queryStringParameters.key;
      if (!key || !/^[a-f0-9]{16}\.(webp|jpg|png)$/.test(key)) return bad('Bad key');
      await store.delete(key);
      await logEvent('media_deleted', 'admin', { key }, event);
      return { statusCode: 200, body: JSON.stringify({ deleted: key }) };
    }

    return { statusCode: 405, body: 'Method Not Allowed' };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Media request failed' }) };
  }
};

const bad = (error) => ({ statusCode: 400, body: JSON.stringify({ error }) });
