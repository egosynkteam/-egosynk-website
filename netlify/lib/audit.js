const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');

// One append-only trail for every meaningful account/order event — signups, logins,
// failed logins, orders created/paid. Never blocks the caller: a logging failure
// is swallowed so it can never break signup/login/checkout itself.
async function logEvent(type, actor, detail, event) {
  try {
    const store = getStore('audit-log');
    const id = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const ip =
      (event && event.headers &&
        (event.headers['x-nf-client-connection-ip'] || event.headers['client-ip'])) ||
      null;
    await store.setJSON(id, {
      type,
      actor: actor || 'guest',
      detail: detail || {},
      ip,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('audit log failed', err);
  }
}

module.exports = { logEvent };
