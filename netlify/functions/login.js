const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { getStore } = require('../lib/blob-store');
const { sessionCookie, SESSION_MAX_AGE_SECONDS } = require('../lib/cookies');
const { logEvent } = require('../lib/audit');
const { checkLoginLock, recordLoginFailure, clearLoginFailures, MAX_ATTEMPTS } = require('../lib/rate-limit');

function normEmail(e) {
  return String(e || '').trim().toLowerCase();
}

// Existing-user path. Deliberately returns the same generic error whether the email
// doesn't exist or the password is wrong, so login can't be used to fish for which
// emails have accounts.
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { email, password } = JSON.parse(event.body || '{}');
    const emailNorm = normEmail(email);
    if (!emailNorm || !password) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Email and password are required' }) };
    }

    const lock = await checkLoginLock(emailNorm);
    if (lock.locked) {
      return {
        statusCode: 429,
        body: JSON.stringify({ error: `Too many failed attempts. Try again after ${new Date(lock.lockedUntil).toLocaleTimeString('en-IN')}.` }),
      };
    }

    const users = getStore('users');
    const user = await users.get(emailNorm, { type: 'json' });
    if (!user) {
      await recordLoginFailure(emailNorm);
      await logEvent('login_failed', emailNorm, { reason: 'no_such_user' }, event);
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid email or password' }) };
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      await recordLoginFailure(emailNorm);
      await logEvent('login_failed', emailNorm, { reason: 'bad_password' }, event);
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid email or password' }) };
    }

    await clearLoginFailures(emailNorm);

    const token = crypto.randomBytes(32).toString('hex');
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();
    const sessions = getStore('sessions');
    await sessions.setJSON(token, { userKey: emailNorm, email: emailNorm, createdAt: now, expiresAt });

    await logEvent('login', emailNorm, {}, event);

    return {
      statusCode: 200,
      headers: { 'Set-Cookie': sessionCookie(token) },
      body: JSON.stringify({ id: user.id, name: user.name, email: user.email, phone: user.phone }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Login failed' }) };
  }
};
