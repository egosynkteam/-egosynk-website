// Admin endpoints check a header first (x-admin-key) — not visible in browser history,
// server access logs, or the Referer header the way a ?key= query string would be.
// Query param is still accepted as a fallback for quick manual/curl testing only.
function isAdminAuthorized(event) {
  const headerKey = event.headers && (event.headers['x-admin-key'] || event.headers['X-Admin-Key']);
  const queryKey = event.queryStringParameters && event.queryStringParameters.key;
  const provided = headerKey || queryKey;
  return Boolean(process.env.ADMIN_SECRET) && provided === process.env.ADMIN_SECRET;
}

module.exports = { isAdminAuthorized };
