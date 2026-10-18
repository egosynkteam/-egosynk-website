const { getPublicCatalog } = require('../lib/catalog');

// /sitemap.xml (rewritten here in netlify.toml): the static pages plus one URL per
// visible product, so new products reach search engines without editing a file.
const SITE = 'https://egosynk.com';
const STATIC = ['/', '/shipping-policy.html', '/refund-policy.html', '/terms.html', '/privacy-policy.html', '/contact.html'];
const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

exports.handler = async () => {
  try {
    const { products } = await getPublicCatalog();
    const urls = [
      ...STATIC.map((p) => `<url><loc>${SITE}${p}</loc></url>`),
      ...products.map((p) => `<url><loc>${SITE}/p/${xmlEsc(p.slug)}</loc>${p.updatedAt ? `<lastmod>${p.updatedAt.slice(0, 10)}</lastmod>` : ''}</url>`),
    ];
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
      body: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: 'Sitemap unavailable' };
  }
};
