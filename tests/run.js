// `npm test`: runs every tests/*.test.js in its own Node process (each one stubs modules
// differently) and fails if any does.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const files = fs.readdirSync(__dirname).filter((f) => f.endsWith('.test.js')).sort();
let failed = 0;
for (const f of files) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { encoding: 'utf8', timeout: 180000 });
  const out = `${r.stdout || ''}${r.stderr || ''}`.trim();
  const last = (r.stdout || '').trim().split('\n').filter(Boolean).pop() || '';
  const ok = r.status === 0;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${f.padEnd(22)} ${((Date.now() - t0) / 1000).toFixed(1)}s  ${last}`);
  if (!ok) console.log(out.split('\n').slice(-25).map((l) => '      ' + l).join('\n'));
}
console.log(failed ? `\n${failed} of ${files.length} failed` : `\nAll ${files.length} passed`);
process.exit(failed ? 1 : 0);
