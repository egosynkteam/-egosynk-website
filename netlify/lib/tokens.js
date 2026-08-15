const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');

// Generic short-lived, single-use token helper shared by password reset and email
// verification. Storing `used:true` instead of deleting on consume means a replayed
// (already-used) link fails loudly rather than looking like "unknown token".
async function createToken(storeName, payload, ttlMs) {
  const store = getStore(storeName);
  const token = crypto.randomBytes(32).toString('hex');
  await store.setJSON(token, { ...payload, expiresAt: new Date(Date.now() + ttlMs).toISOString(), used: false });
  return token;
}

async function consumeToken(storeName, token) {
  const store = getStore(storeName);
  const rec = await store.get(token, { type: 'json' });
  if (!rec) return null;
  if (rec.used) return null;
  if (new Date(rec.expiresAt) < new Date()) return null;
  rec.used = true;
  await store.setJSON(token, rec);
  return rec;
}

module.exports = { createToken, consumeToken };
