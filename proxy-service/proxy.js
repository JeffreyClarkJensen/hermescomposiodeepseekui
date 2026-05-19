const http = require('http');
const https = require('https');
require('dotenv').config();

const PORT = process.env.PORT ?? 3333;
const HERMES_API = process.env.HERMES_API_URL ?? 'https://hermes-api-production-34cb.up.railway.app';
const COMPOSIO_MCP = process.env.COMPOSIO_MCP_URL ?? 'https://connect.composio.dev/mcp';

// ── In-memory config store ──
const configStore = {};

// ── Helpers ──

function log(method, path, status, extra) {
  const ts = new Date().toISOString().slice(11, 19);
  const line = `[${ts}] ${method} ${path} → ${status}${extra ? ' ' + extra : ''}`;
  console.log(line);
}

function sendJson(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-consumer-api-key, mcp-session-id');
  res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id, x-consumer-api-key');
}

// ── Proxy to Composio MCP with SSE streaming ──

function proxyMCP(req, res) {
  const bodyChunks = [];
  req.on('data', c => bodyChunks.push(c));
  req.on('end', () => {
    const upstreamUrl = new URL(COMPOSIO_MCP);
    const parsedMCPBody = Buffer.concat(bodyChunks).toString();

    // Build upstream headers — forward relevant ones, strip host/content-length (Node sets these)
    const upstreamHeaders = {
      'Accept': 'application/json, text/event-stream',
    };
    for (const [k, v] of Object.entries(req.headers)) {
      const lk = k.toLowerCase();
      if (['host', 'content-length', 'connection', 'keep-alive', 'transfer-encoding'].includes(lk)) continue;
      upstreamHeaders[k] = Array.isArray(v) ? v.join(', ') : v;
    }

    // Ensure we send the host Composio expects
    upstreamHeaders['host'] = upstreamUrl.host;

    const opts = {
      hostname: upstreamUrl.hostname,
      port: upstreamUrl.port || 443,
      path: upstreamUrl.pathname || '/mcp',
      method: 'POST',
      headers: upstreamHeaders,
    };

    const proxyReq = https.request(opts, (proxyRes) => {
      // Forward mcp-session-id header
      const sid = proxyRes.headers['mcp-session-id'];
      const extraHeaders = {};
      if (sid) extraHeaders['mcp-session-id'] = Array.isArray(sid) ? sid[0] : sid;

      // Determine content type
      const ct = proxyRes.headers['content-type'] || '';

      if (ct.includes('text/event-stream')) {
        // SSE — stream it through
        log('MCP', req.url, proxyRes.statusCode, `SSE stream → ${COMPOSIO_MCP}`);
        res.writeHead(proxyRes.statusCode ?? 200, {
          ...extraHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Expose-Headers': 'mcp-session-id',
        });
        proxyRes.pipe(res);

        // Cleanup on client disconnect
        req.on('close', () => {
          proxyReq.destroy();
        });
      } else {
        // JSON or other — buffer and forward
        let data = '';
        proxyRes.on('data', c => data += c);
        proxyRes.on('end', () => {
          log('MCP', req.url, proxyRes.statusCode, `${data.length}B → ${COMPOSIO_MCP}`);
          res.writeHead(proxyRes.statusCode ?? 200, {
            ...extraHeaders,
            'Content-Type': ct || 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Expose-Headers': 'mcp-session-id',
          });
          res.end(data);
        });
      }
    });

    proxyReq.on('error', (e) => {
      log('MCP', req.url, 502, `ERROR: ${e.message}`);
      res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: `MCP proxy error: ${e.message}` }));
    });

    proxyReq.write(parsedMCPBody);
    proxyReq.end();
  });
}

// ── Server ──
const server = http.createServer((req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // Extract pathname safely without url.parse
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = reqUrl.pathname;

  // ── Health & root ──
  if (path === '/health' || path === '/') {
    log('GET', path, 200);
    sendJson(res, 200, {
      ok: true,
      service: 'jarvis-composio-proxy',
      composioMCP: COMPOSIO_MCP,
      hermesAPI: HERMES_API,
      configKeys: Object.keys(configStore),
    });
    return;
  }

  // ── POST /api/config ── save a key-value pair
  if (req.method === 'POST' && path === '/api/config') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { key, value } = JSON.parse(body);
        if (!key) { sendJson(res, 400, { error: 'key required' }); return; }
        configStore[key] = String(value ?? '');
        log('POST', path, 200, `key="${key}"`);
        sendJson(res, 200, { ok: true, key });
      } catch (e) {
        sendJson(res, 400, { error: e.message });
      }
    });
    return;
  }

  // ── GET /api/config/<key> ── read a value
  if (req.method === 'GET' && path?.startsWith('/api/config/')) {
    const key = path.replace('/api/config/', '');
    log('GET', path, 200, `key="${key}"`);
    sendJson(res, 200, { key, value: configStore[key] ?? '' });
    return;
  }

  // ── POST /api/mcp ── proxy to Composio MCP (SSE-aware)
  if (req.method === 'POST' && path === '/api/mcp') {
    proxyMCP(req, res);
    return;
  }

  // ── POST /api/chat ── forward to Hermes API
  if (req.method === 'POST' && path === '/api/chat') {
    const parts = [];
    req.on('data', c => parts.push(c));
    req.on('end', () => {
      const parsedUrl = new URL(HERMES_API);
      const opts = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: '/api/chat',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(req.headers['authorization'] ? { Authorization: req.headers['authorization'] } : {}),
        },
      };

      // Recalculate content-length
      const body = Buffer.concat(parts);
      opts.headers['Content-Length'] = body.length;

      const proxyReq = https.request(opts, (proxyRes) => {
        const isSSE = (proxyRes.headers['content-type'] || '').includes('text/event-stream');
        log('CHAT', path, proxyRes.statusCode, isSSE ? 'SSE stream' : `${proxyRes.headers['content-length'] || '?'}B`);

        if (isSSE) {
          // Stream SSE through
          res.writeHead(proxyRes.statusCode ?? 200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
          });
          proxyRes.pipe(res);
          req.on('close', () => proxyReq.destroy());
        } else {
          // Buffer and forward
          let data = '';
          proxyRes.on('data', c => data += c);
          proxyRes.on('end', () => {
            res.writeHead(proxyRes.statusCode ?? 200, {
              'Content-Type': proxyRes.headers['content-type'] ?? 'application/json',
              'Access-Control-Allow-Origin': '*',
            });
            res.end(data);
          });
        }
      });

      proxyReq.on('error', (e) => {
        log('CHAT', path, 502, `ERROR: ${e.message}`);
        sendJson(res, 502, { error: `Chat proxy error: ${e.message}` });
      });

      proxyReq.write(body);
      proxyReq.end();
    });
    return;
  }

  // ── 404 ──
  log(req.method, path, 404);
  res.writeHead(404); res.end();
});

server.listen(PORT, () => {
  console.log(`╔══════════════════════════════════════╗`);
  console.log(`║  Jarvis Composio Proxy               ║`);
  console.log(`║  Port:    ${String(PORT).padEnd(33)}║`);
  console.log(`║  MCP:     ${COMPOSIO_MCP.slice(0, 38)}║`);
  console.log(`║  Hermes:  ${HERMES_API.slice(0, 38)}║`);
  console.log(`╚══════════════════════════════════════╝`);
});
