const bcrypt = require('bcryptjs');
const { getStore } = require('../lib/blob-store');
const { consumeToken } = require('../lib/tokens');
const { clearLoginFailures } = require('../lib/rate-limit');
const { logEvent } = require('../lib/audit');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { token, password } = JSON.parse(event.body || '{}');
    if (!token || !password) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing token or password' }) };
    }
    if (String(password).length < 8) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Password must be at least 8 characters' }) };
    }

    const rec = await consumeToken('password-resets', token);
    if (!rec) {
      return { statusCode: 400, body: JSON.stringify({ error: 'This reset link is invalid or has expired. Request a new one.' }) };
    }

    const users = getStore('users');
    const user = await users.get(rec.email, { type: 'json' });
    if (!user) return { statusCode: 400, body: JSON.stringify({ error: 'Account not found' }) };

    user.passwordHash = await bcrypt.hash(password, 10);
    user.updatedAt = new Date().toISOString();
    await users.setJSON(rec.email, user);
    await clearLoginFailures(rec.email); // a successful reset also clears any lockout

    await logEvent('password_reset', rec.email, {}, event);

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Could not reset password' }) };
  }
};
