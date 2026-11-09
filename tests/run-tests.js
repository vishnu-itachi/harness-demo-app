const http = require('http');
const assert = require('assert');

function get(path, port) {
  return new Promise((resolve, reject) => {
    http
      .get({ host: '127.0.0.1', port, path }, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      })
      .on('error', reject);
  });
}

async function main() {
  const server = require('../server.js');
  let PORT = 0; // ephemeral: avoids colliding with a dev server or a parallel run
  await new Promise((r) => server.listen(PORT, r));
  PORT = server.address().port;

  let passed = 0;
  let failed = 0;
  async function check(name, fn) {
    try {
      await fn();
      passed++;
      console.log(`  PASS: ${name}`);
    } catch (e) {
      failed++;
      console.log(`  FAIL: ${name} -> ${e.message}`);
    }
  }

  await check('GET /health returns 200 with status ok and a version', async () => {
    const r = await get('/health', PORT);
    assert.strictEqual(r.status, 200);
    const body = JSON.parse(r.body);
    assert.strictEqual(body.status, 'ok');
    assert.ok(body.version, 'version should be present');
  });

  await check('GET /api/hello returns the greeting and a version', async () => {
    const r = await get('/api/hello', PORT);
    assert.strictEqual(r.status, 200);
    const body = JSON.parse(r.body);
    assert.ok(body.message.includes('Harness'));
    assert.ok(body.version);
  });

  await check('feature flag defaults to off (v2 greeting disabled)', async () => {
    const r = await get('/api/hello', PORT);
    assert.strictEqual(JSON.parse(r.body).greeting_v2, false);
  });

  await check('GET /flags reports a boolean flag state', async () => {
    const r = await get('/flags', PORT);
    assert.strictEqual(typeof JSON.parse(r.body).greeting_v2, 'boolean');
  });

  await check('GET /metrics counts requests and exposes latency', async () => {
    await get('/api/hello', PORT);
    const r = await get('/metrics', PORT);
    const m = JSON.parse(r.body);
    assert.ok(m.requests >= 3, `expected >=3 requests, got ${m.requests}`);
    assert.strictEqual(typeof m.p95_ms, 'number');
    assert.strictEqual(typeof m.error_rate, 'number');
  });

  await check('unknown path returns 404', async () => {
    const r = await get('/nope', PORT);
    assert.strictEqual(r.status, 404);
  });

  await check('GET / returns the version banner', async () => {
    const r = await get('/', PORT);
    assert.strictEqual(r.status, 200);
    assert.ok(r.body.includes('harness-demo-app'));
  });

  server.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main();
