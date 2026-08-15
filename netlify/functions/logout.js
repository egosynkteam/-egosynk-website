const { getStore } = require('@netlify/blobs');
const { parseCookies, clearSessionCookie } = require('../lib/cookies');
const { logEvent } = require('../lib/audit');

exports.handler = async (event) => {
  try {
    const cookies = parseCookies(event.headers && event.headers.cookie);
    const token = cookies['egosynk_session'];

    if (token) {
      const sessions = getStore('sessions');
      const session = await sessions.get(token, { type: 'json' });
      await sessions.delete(token);
      if (session) await logEvent('logout', session.email, {}, event);
    }

    return { statusCode: 200, headers: { 'Set-Cookie': clearSessionCookie() }, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Logout failed' }) };
  }
};
