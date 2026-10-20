const { getStore } = require('./blob-store');

// Nightly housekeeping (functions/nightly-cleanup.js): deletes records that are only
// useful for a short time, so stores don't grow forever.
//  - security: rate-limit windows older than a day; login-failure records with no
//    active lock and no failure in the last day (the Shiprocket token is left alone)
//  - one-time links (password resets, email verifications, admin resets) a day past expiry
//  - customer and admin sessions past expiry
const DAY = 24 * 3600 * 1000;

async function sweep(storeName, isStale) {
  const store = getStore(storeName);
  let removed = 0;
  for (const { key, value } of await store.listValues()) {
    if (isStale(key, value)) { await store.delete(key); removed++; }
  }
  return removed;
}

async function runCleanup(now = Date.now()) {
  const past = (iso, ms = 0) => !iso || new Date(iso).getTime() + ms < now;
  const report = {};
  report.security = await sweep('security', (key, v) => {
    if (key.startsWith('rl:')) return now - (v.start || 0) > DAY;
    if (key.startsWith('login:')) return past(v.lockedUntil) && past(v.lastFailure, DAY);
    return false;
  });
  for (const s of ['password-resets', 'email-verifications', 'admin-resets']) {
    report[s] = await sweep(s, (key, v) => past(v.expiresAt, DAY));
  }
  report.sessions = await sweep('sessions', (key, v) => past(v.expiresAt));
  report['admin-sessions'] = await sweep('admin-sessions', (key, v) => past(v.expiresAt));
  return report;
}

module.exports = { runCleanup };
