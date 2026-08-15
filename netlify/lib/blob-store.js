const { getStore: getStoreRaw } = require('@netlify/blobs');

// This site doesn't get Netlify's automatic Blobs context (NETLIFY_BLOBS_CONTEXT env var)
// injected at runtime — confirmed in production via MissingBlobsEnvironmentError. Passing
// siteID + an API token explicitly sidesteps auto-detection entirely and works
// unconditionally. Requires NETLIFY_SITE_ID and NETLIFY_API_TOKEN env vars in Netlify.
function getStore(name) {
  if (process.env.NETLIFY_SITE_ID && process.env.NETLIFY_API_TOKEN) {
    return getStoreRaw({
      name,
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_API_TOKEN,
    });
  }
  // Fall back to automatic detection, in case a future deploy/site migration does support it.
  return getStoreRaw(name);
}

module.exports = { getStore };
