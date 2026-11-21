// Free gift rule (netlify/lib/settings.js giftFor): judged on the goods after discount,
// like free shipping, and off when the admin switches it off or leaves it incomplete.
const path = require('path');
const assert = require('assert');
const { giftFor, DEFAULTS } = require(path.join(__dirname, '..', 'netlify', 'lib', 'settings.js'));

const on = { freeGift: { enabled: true, threshold: 2500, name: 'EGOSYNK 600 ml shaker' } };
assert.deepStrictEqual(giftFor(2500, on), { name: 'EGOSYNK 600 ml shaker', threshold: 2500 }, 'exactly at the line earns it');
assert.deepStrictEqual(giftFor(4199, on), { name: 'EGOSYNK 600 ml shaker', threshold: 2500 });
assert.strictEqual(giftFor(2499, on), null, 'a rupee short earns nothing');
// A ₹2,700 bag with WELCOME250 pays ₹2,450 for the goods: below the line.
assert.strictEqual(giftFor(2700 - 250, on), null, 'judged after the discount');
assert.strictEqual(giftFor(9999, { freeGift: { ...on.freeGift, enabled: false } }), null, 'switched off');
assert.strictEqual(giftFor(9999, { freeGift: { ...on.freeGift, name: '' } }), null, 'no name, no gift');
assert.strictEqual(giftFor(9999, {}), null, 'no setting at all');
assert.deepStrictEqual(DEFAULTS.freeGift, { enabled: true, threshold: 2500, name: 'EGOSYNK 600 ml shaker' });
// The storefront's fallback (used if the catalog can't be read) must match the server default.
const shared = require('fs').readFileSync(path.join(__dirname, '..', 'src', 'lib', 'catalog-shared.ts'), 'utf8');
const fb = /GIFT_FALLBACK = \{ enabled: (true|false), threshold: (\d+), name: "([^"]+)" \}/.exec(shared);
assert.ok(fb, 'GIFT_FALLBACK missing');
assert.deepStrictEqual({ enabled: fb[1] === 'true', threshold: +fb[2], name: fb[3] }, DEFAULTS.freeGift, 'GIFT_FALLBACK must equal DEFAULTS.freeGift');
console.log('ALL PASS');
