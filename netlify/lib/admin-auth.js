// Admin endpoints check a header first (x-admin-key) — not visible in browser history,
// server access logs, or the Referer header the way a ?key= query string would be.
// Query param is still accepted as a fallback for quick manual/curl testing only.
const crypto = require('crypto');

function isAdminAuthorized(event) {
  const headerKey = event.headers && (event.headers['x-admin-key'] || event.headers['X-Admin-Key']);
  const queryKey = event.queryStringParameters && event.queryStringParameters.key;
  const provided = String(headerKey || queryKey || '');
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  // Constant-time compare on fixed-length digests, so response timing can't leak the key.
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(secret).digest();
  return crypto.timingSafeEqual(a, b);
}

module.exports = { isAdminAuthorized };
