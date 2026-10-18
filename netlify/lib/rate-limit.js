const { getStore } = require('./blob-store');

// Login brute-force protection. Deliberately keyed by email (not IP — Netlify Functions
// don't get a stable client IP in every runtime, and email-based lockout also stops
// distributed attempts against one account from many IPs).
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

function key(email) {
  return `login:${email}`;
}

async function checkLoginLock(email) {
  const store = getStore('security');
  const rec = await store.get(key(email), { type: 'json' });
  if (rec && rec.lockedUntil && new Date(rec.lockedUntil) > new Date()) {
    return { locked: true, lockedUntil: rec.lockedUntil };
  }
  return { locked: false };
}

// Recorded on ANY failure — wrong password or unknown email alike — so a lockout can't
// be used to fingerprint which emails have accounts (a locked account and a non-existent
// one behave identically after enough attempts).
async function recordLoginFailure(email) {
  const store = getStore('security');
  const k = key(email);
  const rec = (await store.get(k, { type: 'json' })) || { count: 0 };
  rec.count = (rec.count || 0) + 1;
  rec.lastFailure = new Date().toISOString();
  if (rec.count >= MAX_ATTEMPTS) {
    rec.lockedUntil = new Date(Date.now() + LOCKOUT_MS).toISOString();
  }
  await store.setJSON(k, rec);
}

async function clearLoginFailures(email) {
  const store = getStore('security');
  await store.delete(key(email));
}

// General per-client request cap (fixed window), keyed by the caller's IP. Fails open:
// if the IP is unknown or the store errors, the request is allowed rather than blocking
// real customers.
async function allowRequest(bucket, event, limit, windowMs) {
  const ip = event && event.headers &&
    (event.headers['x-nf-client-connection-ip'] || event.headers['client-ip']);
  if (!ip) return true;
  try {
    const store = getStore('security');
    const k = `rl:${bucket}:${ip}`;
    const now = Date.now();
    let rec = await store.get(k, { type: 'json' });
    if (!rec || now - rec.start > windowMs) rec = { start: now, count: 0 };
    rec.count++;
    await store.setJSON(k, rec);
    return rec.count <= limit;
  } catch (err) {
    console.error('rate limit check failed', err);
    return true;
  }
}

module.exports = { checkLoginLock, recordLoginFailure, clearLoginFailures, allowRequest, MAX_ATTEMPTS };
