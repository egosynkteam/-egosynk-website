const { sendReminders } = require('../lib/abandoned');

// Scheduled every 30 minutes (netlify.toml). Sends abandoned-checkout reminders —
// see lib/abandoned.js for the rules.
exports.handler = async () => {
  try {
    const report = await sendReminders();
    console.log('abandoned-carts', JSON.stringify(report));
    return { statusCode: 200, body: JSON.stringify(report) };
  } catch (err) {
    console.error('abandoned-carts failed', err);
    return { statusCode: 500, body: 'failed' };
  }
};
