// The product page's size finder (sizeFor in product-template.html) against the default
// size charts in lib/settings.js.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'product-template.html'), 'utf8').replace(/\r\n/g, '\n');
const start = html.indexOf('function measuredColumns');
const end = html.indexOf('let finderUnit');
eval(html.slice(start, end));
const { DEFAULT_SIZE_GUIDES: G } = require(path.join(ROOT, 'netlify', 'lib', 'settings.js'));

const pick = (g, vals) => sizeFor(g, vals);
assert.deepStrictEqual(pick(G.sleeves, { 1: 12 }), { size: 'M', alt: null });
assert.deepStrictEqual(pick(G.sleeves, { 1: 13 }), { size: 'M', alt: 'L' });          // on the line
assert.deepStrictEqual(pick(G.sleeves, { 1: 16 }), { size: 'XL', alt: null });
assert.deepStrictEqual(pick(G.sleeves, { 1: 9 }), { size: 'S', alt: null });           // below the smallest
assert.deepStrictEqual(pick(G.sleeves, { 1: 18 }), { outside: true, label: 'Bicep' });  // above the largest
assert.deepStrictEqual(pick(G.underwear, { 1: 31 }), { size: 'M', alt: null });        // chart gap 30 → 32: size up
assert.deepStrictEqual(pick(G.underwear, { 1: 33 }), { size: 'M', alt: null });
// apparel: the bigger of chest and waist wins
assert.strictEqual(pick(G.apparel, { 1: 39, 2: 35 }).size, 'L');
assert.strictEqual(pick(G.apparel, { 1: 43, 2: 31 }).size, 'XL');
assert.strictEqual(pick(G.apparel, { 1: 39 }).size, 'M');                               // one measurement is enough
assert.strictEqual(pick(G.apparel, {}), null);
assert.strictEqual(pick(G.socks, { 1: 9 }), null);                                      // no measured columns
console.log('ALL PASS');
