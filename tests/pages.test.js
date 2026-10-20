// Syntax-checks every inline <script> in the store pages, and tests the redirect rule
// exactly as written in login.html.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let bad = 0;
for (const f of fs.readdirSync(ROOT).filter((x) => x.endsWith('.html'))) {
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1].replace('/*PRODUCT_DATA*/null', '{}'));
  blocks.forEach((code, i) => {
    try { new vm.Script(code, { filename: `${f}#${i}` }); } catch (e) { bad++; console.log('SYNTAX', f, i, e.message); }
  });
}
for (const f of ['site.js']) {
  try { new vm.Script(fs.readFileSync(path.join(ROOT, f), 'utf8')); } catch (e) { bad++; console.log('SYNTAX', f, e.message); }
}
const line = fs.readFileSync(path.join(ROOT, 'login.html'), 'utf8').match(/const redirect = (\/.*?\/)\.test/)[1];
const re = eval(line);
const cases = { '/account.html': true, '/p/tee-1?review=x': true, '//evil.com': false, '/\\evil.com': false,
  'https://evil.com': false, 'javascript:alert(1)': false, 'account.html': false, '': false };
for (const [t, want] of Object.entries(cases)) if (re.test(t) !== want) { bad++; console.log('REDIRECT', JSON.stringify(t), 'expected', want); }
console.log(bad ? `${bad} problem(s)` : 'ALL PASS', '| redirect rule', line);
if (bad) process.exit(1);
