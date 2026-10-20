// Runs consent.js's cleanUrl on sample addresses.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'consent.js'), 'utf8').replace(/\r\n/g, '\n');
const start = src.indexOf('var KEEP');
const end = src.indexOf('function loadScript');
eval(src.slice(start, end));
const cases = {
  'https://egosynk.com/reset-password.html?token=abc': 'https://egosynk.com/reset-password.html',
  'https://egosynk.com/?utm_source=ig&utm_campaign=launch&restore=tok&gclid=G1': 'https://egosynk.com/?utm_source=ig&utm_campaign=launch&gclid=G1',
  'https://egosynk.com/order-confirmation.html?order=o1&payment_id=p&signature=s': 'https://egosynk.com/order-confirmation.html',
  'https://egosynk.com/invoice.html?id=o1&k=secret': 'https://egosynk.com/invoice.html',
  'https://egosynk.com/p/tee-1': 'https://egosynk.com/p/tee-1',
  '': '',
};
let bad = 0;
for (const [i, want] of Object.entries(cases)) {
  const got = cleanUrl(i);
  if (got !== want) { bad++; console.log('FAIL', i, '->', got); }
}
console.log(bad ? `${bad} failed` : 'ALL PASS');
if (bad) process.exit(1);
