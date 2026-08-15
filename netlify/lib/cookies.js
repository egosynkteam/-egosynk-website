function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  });
  return out;
}

// 30-day sessions, as decided for this store — low-risk storefront, convenience over re-login friction.
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function sessionCookie(token) {
  return `egosynk_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}`;
}

function clearSessionCookie() {
  return `egosynk_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

module.exports = { parseCookies, sessionCookie, clearSessionCookie, SESSION_MAX_AGE_SECONDS };
