const crypto = require('crypto');
const { getStore } = require('../lib/blob-store');
const { unsubToken, emailKey } = require('../lib/abandoned');

// One-click unsubscribe from reminder emails (abandoned bag). Order confirmations and
// shipping updates still send — those are about orders the customer placed. The link is
// signed per address, so nobody can unsubscribe someone else.
exports.handler = async (event) => {
  const q = event.queryStringParameters || {};
  const email = String(q.e || '').trim().toLowerCase();
  const expected = unsubToken(email);
  const ok = email && typeof q.t === 'string' && q.t.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(q.t), Buffer.from(expected));
  if (ok) await getStore('email-optout').setJSON(emailKey(email), { at: new Date().toISOString() });
  return {
    statusCode: ok ? 200 : 400,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>EGOSYNK</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0D0E10;color:#EDEAE3;font-family:system-ui,sans-serif;text-align:center;padding:24px">
<div><h1 style="font-size:20px;letter-spacing:.04em"><span style="color:#C41E3A">EGO</span>SYNK</h1>
<p>${ok ? 'You\'re unsubscribed from bag reminders. Order and shipping emails will still reach you.' : 'This unsubscribe link isn\'t valid.'}</p>
<p><a href="/" style="color:#E63950">Back to the store →</a></p></div></body>`,
  };
};
