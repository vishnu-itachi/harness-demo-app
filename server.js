const http = require('http');
const fs = require('fs');

const PORT = Number(process.env.PORT || 3000);
const VERSION = process.env.APP_VERSION || '1.0.0';

// Fault injection: lets the demo simulate a bad release (a regression that
// Harness continuous verification should catch and roll back).
const FAULT_RATE = Number(process.env.FAULT_RATE || 0);          // 0..1 of /api/hello -> 500
const FAULT_LATENCY_MS = Number(process.env.FAULT_LATENCY_MS || 0);

// Runtime feature flag, read from a file on every request so it can be flipped
// without a redeploy (this is what Harness FME does at runtime).
const FLAG_FILE = process.env.FLAG_FILE || '';
const DEFAULT_GREETING_V2 = process.env.FF_GREETING_V2 === '1';

const stats = { total: 0, errors: 0, latencies: [] };

function sendJSON(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function greetingV2() {
  if (FLAG_FILE) {
    try {
      return fs.readFileSync(FLAG_FILE, 'utf8').trim() === 'on';
    } catch (_) {
      return DEFAULT_GREETING_V2;
    }
  }
  return DEFAULT_GREETING_V2;
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

const server = http.createServer(async (req, res) => {
  const path = (req.url || '/').split('?')[0];
  const t0 = Date.now();
  try {
    if (path === '/health') {
      return sendJSON(res, 200, {
        status: 'ok',
        version: VERSION,
        uptime_s: Math.round(process.uptime()),
      });
    }

    if (path === '/flags') {
      return sendJSON(res, 200, { greeting_v2: greetingV2() });
    }

    if (path === '/metrics') {
      return sendJSON(res, 200, {
        version: VERSION,
        requests: stats.total,
        errors: stats.errors,
        error_rate: stats.total ? +(stats.errors / stats.total).toFixed(4) : 0,
        p50_ms: percentile(stats.latencies, 50),
        p95_ms: percentile(stats.latencies, 95),
      });
    }

    if (path === '/api/hello') {
      if (FAULT_LATENCY_MS) await sleep(FAULT_LATENCY_MS);
      stats.total++;
      stats.latencies.push(Date.now() - t0);
      if (FAULT_RATE > 0 && Math.random() < FAULT_RATE) {
        stats.errors++;
        return sendJSON(res, 500, { error: 'internal_server_error', version: VERSION });
      }
      const v2 = greetingV2();
      return sendJSON(res, 200, {
        message: v2
          ? 'Hello from Harness demo! (v2 greeting via feature flag)'
          : 'Hello from Harness demo!',
        version: VERSION,
        greeting_v2: v2,
      });
    }

    if (path === '/') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      return res.end(
        `harness-demo-app v${VERSION} running. Try /health, /api/hello, /metrics, /flags\n`
      );
    }

    return sendJSON(res, 404, { error: 'not_found', path });
  } catch (e) {
    return sendJSON(res, 500, { error: 'unhandled', detail: String(e) });
  }
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`Listening on ${PORT} (v${VERSION})`));
}

module.exports = server;
