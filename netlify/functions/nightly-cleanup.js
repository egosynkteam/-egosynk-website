const { runCleanup } = require('../lib/cleanup');

// Scheduled daily at 03:00 IST (netlify.toml). See lib/cleanup.js.
exports.handler = async () => {
  try {
    const report = await runCleanup();
    console.log('nightly-cleanup', JSON.stringify(report));
    return { statusCode: 200, body: JSON.stringify(report) };
  } catch (err) {
    console.error('nightly-cleanup failed', err);
    return { statusCode: 500, body: 'failed' };
  }
};
