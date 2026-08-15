const { getStore } = require('@netlify/blobs');
const { consumeToken } = require('../lib/tokens');
const { logEvent } = require('../lib/audit');

exports.handler = async (event) => {
  try {
    const token = event.queryStringParameters && event.queryStringParameters.token;
    if (!token) return { statusCode: 400, body: JSON.stringify({ error: 'Missing token' }) };

    const rec = await consumeToken('email-verifications', token);
    if (!rec) {
      return { statusCode: 400, body: JSON.stringify({ error: 'This verification link is invalid or has expired.' }) };
    }

    const users = getStore('users');
    const user = await users.get(rec.email, { type: 'json' });
    if (!user) return { statusCode: 400, body: JSON.stringify({ error: 'Account not found' }) };

    user.emailVerified = true;
    user.updatedAt = new Date().toISOString();
    await users.setJSON(rec.email, user);

    await logEvent('email_verified', rec.email, {}, event);

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Verification failed' }) };
  }
};
