// Edge caching for public catalog responses (get-catalog, product pages, sitemap): served
// from Netlify's CDN (incl. its durable cache) and refreshed in the background, tagged
// `catalog`. Admin saves and paid orders (stock) purge the tag so changes show at once;
// without a purge, a response is at most a couple of minutes old.
const CATALOG_HEADERS = {
  'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=120, stale-while-revalidate=86400',
  'Netlify-Cache-Tag': 'catalog',
};

// Never throws: a failed purge only means the old copy lives out its two minutes.
async function purgeCatalog() {
  const site = process.env.NETLIFY_SITE_ID, token = process.env.NETLIFY_API_TOKEN;
  if (!site || !token) return false;
  try {
    const res = await fetch('https://api.netlify.com/api/v1/purge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ site_id: site, cache_tags: ['catalog'] }),
    });
    if (!res.ok) console.error('CDN purge failed', res.status);
    return res.ok;
  } catch (err) {
    console.error('CDN purge failed', err.message);
    return false;
  }
}

module.exports = { CATALOG_HEADERS, purgeCatalog };
