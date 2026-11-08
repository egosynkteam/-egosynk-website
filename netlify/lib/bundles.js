const { getStore } = require('./blob-store');

// Launch bundles shown on the storefront (HYDRO page). Edited in admin → Bundles and kept in
// the `settings` store under `bundles`. A bundle is a display offer: while `coming` it sends
// people to the drop list; once `live` it links to a catalog product (created in admin →
// Products like any other), so the bag and checkout don't change.
//   { id, name, tagline, items: [string], price, mrp, priceFinal, art, status, productSlug }
// Prices start as placeholders; `priceFinal: false` makes the site label them "Indicative".
const ART = ['sachets', 'tub-shaker', 'stack', 'tub'];
const STATUS = ['coming', 'live', 'hidden'];
const SLUG = /^[a-z0-9-]+-\d+$/;

const DEFAULT_BUNDLES = [
  { id: 'synk-pack', name: 'Synk Pack', tagline: 'Try it before the tub', items: ['5 × HYDRO 150 single-serve sachets (14 g)'],
    price: 299, mrp: null, priceFinal: false, art: 'sachets', status: 'coming', productSlug: '' },
  { id: 'hydro-starter', name: 'HYDRO Starter', tagline: 'Tub and shaker', items: ['HYDRO 150 · 420 g, 30 servings', 'EGOSYNK shaker'],
    price: 1799, mrp: 1998, priceFinal: false, art: 'tub-shaker', status: 'coming', productSlug: '' },
  { id: 'lift-stack', name: 'Lift Stack', tagline: 'Fuel and gear for heavy day', items: ['HYDRO 150 · 420 g, 30 servings', 'EGOSYNK shaker', 'Steel Core Lifting Belt 10 mm'],
    price: 4199, mrp: 4497, priceFinal: false, art: 'stack', status: 'coming', productSlug: '' },
];

const str = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const rupees = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n > 0 && n < 1000000 ? n : null; };

async function getBundles() {
  return (await getStore('settings').get('bundles', { type: 'json' })) || DEFAULT_BUNDLES;
}

// Validates the full ordered list from the admin. Returns { value } or { error }.
function cleanBundles(list) {
  if (!Array.isArray(list) || list.length > 12) return { error: 'Bad bundle list' };
  const seen = new Set();
  const out = [];
  for (const [i, b] of list.entries()) {
    const n = i + 1;
    const id = str(b && b.id, 40).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    if (!id) return { error: `Bundle ${n}: needs an id` };
    if (seen.has(id)) return { error: `Bundle ${n}: id "${id}" is used twice` };
    seen.add(id);
    const name = str(b.name, 60);
    if (!name) return { error: `Bundle ${n}: needs a name` };
    const price = rupees(b.price);
    if (price === null) return { error: `${name}: price must be whole rupees` };
    const mrp = b.mrp === '' || b.mrp == null ? null : rupees(b.mrp);
    if (b.mrp !== '' && b.mrp != null && (mrp === null || mrp <= price)) return { error: `${name}: MRP must be more than the price, or left empty` };
    const items = (Array.isArray(b.items) ? b.items : []).map((x) => str(x, 80)).filter(Boolean).slice(0, 8);
    if (!items.length) return { error: `${name}: list what's in it` };
    const status = STATUS.includes(b.status) ? b.status : 'coming';
    const productSlug = str(b.productSlug, 120).toLowerCase();
    if (status === 'live' && !SLUG.test(productSlug)) {
      return { error: `${name}: to go live, link it to its product (the end of the product page address, e.g. hydro-starter-17)` };
    }
    out.push({ id, name, tagline: str(b.tagline, 60), items, price, mrp, priceFinal: !!b.priceFinal,
      art: ART.includes(b.art) ? b.art : 'tub', status, productSlug: SLUG.test(productSlug) ? productSlug : '' });
  }
  return { value: out };
}

// Storefront view: hidden bundles left out; product links only for live ones.
function publicBundles(list) {
  return list.filter((b) => b.status !== 'hidden')
    .map(({ productSlug, ...b }) => (b.status === 'live' ? { ...b, productSlug } : b));
}

module.exports = { DEFAULT_BUNDLES, ART, STATUS, getBundles, cleanBundles, publicBundles };
