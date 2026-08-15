const { getStore } = require('./blob-store');
const { parseCookies } = require('./cookies');

// Resolves the egosynk_session cookie -> session record -> full user record.
// Returns null for any failure case (no cookie, unknown/expired session, deleted user)
// so callers can treat "not logged in" and "bad session" identically.
async function getSessionUser(event) {
  const cookies = parseCookies(event.headers && event.headers.cookie);
  const token = cookies['egosynk_session'];
  if (!token) return null;

  const sessions = getStore('sessions');
  const session = await sessions.get(token, { type: 'json' });
  if (!session) return null;
  if (new Date(session.expiresAt) < new Date()) return null;

  const users = getStore('users');
  const user = await users.get(session.userKey, { type: 'json' });
  if (!user) return null;

  return { user, token };
}

module.exports = { getSessionUser };
