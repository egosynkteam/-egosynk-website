// Design-system guard for the Next.js storefront (src/):
//  - the brand colours used in code (src/lib/brand.ts) equal the CSS tokens (globals.css)
//  - the shipping fallback equals the server defaults (netlify/lib/settings.js)
//  - components use tokens, not raw values: no hex colours, no px font sizes, no sizes tied
//    to the screen width (vw) where a container-relative unit belongs.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const css = read('src/app/globals.css');
const token = (name) => {
  const m = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  assert.ok(m, `--color-${name} missing from globals.css`);
  return m[1].toLowerCase();
};
const brand = read('src/lib/brand.ts');
const brandValue = (key) => (new RegExp(`${key}:\\s*"(#[0-9a-fA-F]{6})"`).exec(brand) || [])[1];
assert.strictEqual(brandValue('ink'), token('ink'), 'BRAND.ink must equal --color-ink');
assert.strictEqual(brandValue('rust'), token('rust'), 'BRAND.rust must equal --color-rust');
assert.strictEqual(brandValue('rustBright'), token('rust-bright'), 'BRAND.rustBright must equal --color-rust-bright');

const { DEFAULTS } = require(path.join(ROOT, 'netlify', 'lib', 'settings.js'));
const shared = read('src/lib/catalog-shared.ts');
const fb = /SHIPPING_FALLBACK = \{ shippingFee: (\d+), freeShippingThreshold: (\d+) \}/.exec(shared);
assert.ok(fb, 'SHIPPING_FALLBACK missing');
assert.strictEqual(+fb[1], DEFAULTS.shippingFee, 'shipping fee fallback must equal the server default');
assert.strictEqual(+fb[2], DEFAULTS.freeShippingThreshold, 'free-shipping fallback must equal the server default');

// Raw values in components. brand.ts is the one place hex colours are allowed in code.
const files = [];
(function walk(dir) {
  for (const f of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(f.name) && !p.endsWith(path.join('lib', 'brand.ts'))) files.push(p);
  }
})('src');
const problems = [];
for (const f of files) {
  read(f).split('\n').forEach((line, i) => {
    const at = `${f}:${i + 1}`;
    for (const m of line.matchAll(/["'`(\s_,]#[0-9a-fA-F]{3,8}\b/g)) if (!/href=|#(drop|formula|bottle|gear|bag|scent|main)\b/.test(line)) problems.push(`${at} hex colour ${m[0].trim()}`);
    for (const m of line.matchAll(/\btext-\[\d+(\.\d+)?px\]/g)) problems.push(`${at} px font size ${m[0]}`);
    for (const m of line.matchAll(/\b[\w:-]+-\[[^\]\s]*\d+(\.\d+)?vw[^\]\s]*\]/g)) problems.push(`${at} screen-width size ${m[0]}`);
  });
}
assert.deepStrictEqual(problems, [], 'Use the tokens in globals.css instead:\n' + problems.join('\n'));
console.log(`brand ok (${files.length} files checked)`);
