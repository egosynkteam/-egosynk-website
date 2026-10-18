const { getSettings } = require('../lib/settings');

// Tiny public config for consent.js: which analytics tags to load once a visitor
// accepts cookies. IDs are set in admin → Settings → Analytics.
exports.handler = async () => {
  try {
    const { analytics } = await getSettings();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
      body: JSON.stringify({ ga4Id: (analytics && analytics.ga4Id) || null, metaPixelId: (analytics && analytics.metaPixelId) || null }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 200, body: JSON.stringify({ ga4Id: null, metaPixelId: null }) };
  }
};
