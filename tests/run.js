// Atlas API test suite — Phase 1: sandbox testing.
// Nothing leaves until it passes.

const http = require('http');

const BASE = 'http://localhost:3000';
let passed = 0, failed = 0;

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      method, hostname: 'localhost', port: 3000, path,
      headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}
    };
    const r = http.request(opts, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => resolve({ status: res.statusCode, body: buf }));
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function check(name, cond, detail) {
  if (cond) { passed++; console.log(`  PASS ${name}`); }
  else { failed++; console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}

async function run() {
  console.log('Atlas API — sandbox tests\n');

  // 1. Health
  console.log('Health:');
  let r = await req('GET', '/health');
  check('returns 200', r.status === 200, `got ${r.status}`);
  let h = JSON.parse(r.body);
  check('status alive', h.status === 'alive');
  check('lists 3 programs', h.programs && h.programs.length === 3, JSON.stringify(h.programs));

  // 2. Sense — missing target → 400
  console.log('\nSense validation:');
  r = await req('POST', '/sense', {});
  check('rejects missing target', r.status === 400, `got ${r.status}`);

  // 3. Shape — missing spec → 400
  console.log('\nShape validation:');
  r = await req('POST', '/shape', {});
  check('rejects missing spec', r.status === 400, `got ${r.status}`);

  // 4. Prove — missing path → 400
  console.log('\nProve validation:');
  r = await req('POST', '/prove', {});
  check('rejects missing path', r.status === 400, `got ${r.status}`);

  // 5. Conduct — missing fields → 400
  console.log('\nConduct validation:');
  r = await req('POST', '/conduct', { target: 'x' });
  check('rejects missing spec', r.status === 400, `got ${r.status}`);
  r = await req('POST', '/conduct', { spec: 'y' });
  check('rejects missing target', r.status === 400, `got ${r.status}`);

  // 6. Unknown route → 404
  console.log('\nRouting:');
  r = await req('GET', '/nonexistent');
  check('unknown route 404s', r.status === 404, `got ${r.status}`);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

run().catch(e => { console.error('TEST CRASH:', e.message); process.exit(1); });
