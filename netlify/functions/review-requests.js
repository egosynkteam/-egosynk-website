const { sendReviewRequests } = require('../lib/review-requests');

// Scheduled daily at 11:00 IST (netlify.toml). See lib/review-requests.js.
exports.handler = async () => {
  try {
    const report = await sendReviewRequests();
    console.log('review-requests', JSON.stringify(report));
    return { statusCode: 200, body: JSON.stringify(report) };
  } catch (err) {
    console.error('review-requests failed', err);
    return { statusCode: 500, body: 'failed' };
  }
};
