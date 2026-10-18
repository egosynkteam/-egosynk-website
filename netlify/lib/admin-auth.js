const crypto = require('crypto');
const { getStore } = require('./blob-store');
const { parseCookies } = require('./cookies');

// Admin access is by named accounts (email + password) with a short-lived session cookie.
//  - Accounts live in the `admin-users` store, keyed by lowercase email.
//  - Sessions live in `admin-sessions`, keyed by a SHA-256 of the cookie token, so a copy
//    of the store can't be replayed as a login.
//  - The cookie is HttpOnly + Secure + SameSite=Strict, and every admin request must also
//    send the X-EGOSYNK-Admin header — a cross-site page can't add custom headers, so a
//    malicious site can't drive the admin API with your cookie (CSRF).
//  - The old shared ADMIN_SECRET only works while NO admin account exists, purely to
//    create the first owner account; after that it's ignored.
const COOKIE = 'egosynk_admin';
const SESSION_HOURS = 12;
const HEADER = 'x-egosynk-admin';

const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const header = (event, name) => {
  const h = (event && event.headers) || {};
  const k = Object.keys(h).find((x) => x.toLowerCase() === name);
  return k ? h[k] : undefined;
};

function safeEqual(a, b) {
  const x = crypto.createHash('sha256').update(String(a || '')).digest();
  const y = crypto.createHash('sha256').update(String(b || '')).digest();
  return crypto.timingSafeEqual(x, y);
}

async function adminCount() {
  return (await getStore('admin-users').list()).blobs.length;
}

function adminCookie(token) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}`;
}
const clearAdminCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

async function createAdminSession(email) {
  const token = crypto.randomBytes(32).toString('hex');
  await getStore('admin-sessions').setJSON(hashToken(token), {
    email, createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + SESSION_HOURS * 3600 * 1000).toISOString(),
  });
  return token;
}

async function destroyAdminSession(event) {
  const token = parseCookies(header(event, 'cookie'))[COOKIE];
  if (token) await getStore('admin-sessions').delete(hashToken(token));
}

// Returns the signed-in admin { email, name, role } or null.
async function getAdmin(event) {
  const token = parseCookies(header(event, 'cookie'))[COOKIE];
  if (!token) return null;
  const session = await getStore('admin-sessions').get(hashToken(token), { type: 'json' });
  if (!session || new Date(session.expiresAt) < new Date()) return null;
  const user = await getStore('admin-users').get(session.email, { type: 'json' });
  if (!user || user.disabled) return null;
  return { email: user.email, name: user.name, role: user.role };
}

// Gate for every admin endpoint. Resolves to the admin (also stored on event.admin for
// the audit log) or null.
async function isAdminAuthorized(event) {
  const admin = await getAdmin(event);
  if (admin && header(event, HEADER)) {
    event.admin = admin;
    return admin;
  }
  // Bootstrap only: the shared key works until the first owner account exists.
  const key = header(event, 'x-admin-key') || (event.queryStringParameters && event.queryStringParameters.key);
  if (key && process.env.ADMIN_SECRET && safeEqual(key, process.env.ADMIN_SECRET) && (await adminCount()) === 0) {
    event.admin = { email: 'setup-key', name: 'Setup key', role: 'owner' };
    return event.admin;
  }
  return null;
}

module.exports = {
  isAdminAuthorized, getAdmin, adminCount, createAdminSession, destroyAdminSession,
  adminCookie, clearAdminCookie, safeEqual, HEADER,
};
