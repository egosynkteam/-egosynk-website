const { getStore } = require('@netlify/blobs');
const { isAdminAuthorized } = require('../lib/admin-auth');

// Same shared-secret gate as list-orders.js. Returns the most recent 500 events across
// signup/login/login_failed/logout/order_created/order_paid for audit/troubleshooting.
exports.handler = async (event) => {
  if (!isAdminAuthorized(event)) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const store = getStore('audit-log');
    const { blobs } = await store.list();

    const logs = [];
    for (const b of blobs) {
      const entry = await store.get(b.key, { type: 'json' });
      if (entry) logs.push(entry);
    }
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return { statusCode: 200, body: JSON.stringify({ logs: logs.slice(0, 500) }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Could not list audit log' }) };
  }
};
