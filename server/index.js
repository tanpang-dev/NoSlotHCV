'use strict';

/*
 * NoSlotHCV standalone server.
 *
 * One process serves everything the UI and the 3DS need:
 *   - the built UI (client/dist)
 *   - card data        GET /mushiking/db/cards.json   (data/cards.json | sample)
 *   - selection rules  GET /mushiking/config/barcode.json , /config/summon.json
 *   - card images      GET /mushiking/<path>          (data/images/<path>)
 *   - card feed        POST /mushiking/select-card , GET /mushiking/current-card , /status
 *   - 3DS discovery    UDP :9001  (broadcast "GBAWIIPC" + reply "3DS_HERE")
 *
 * Zero npm dependencies on purpose (Node stdlib only) so `npm run setup` only
 * has to build the client.
 */

const http = require('http');
const dgram = require('dgram');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const keybaker = require('./lib/keybaker');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'client', 'dist');
const DATA_DIR = path.join(ROOT, 'data');
const CONFIG_DIR = path.join(ROOT, 'config');
const IMAGES_DIR = path.join(DATA_DIR, 'images');
const MWIFI_BIN = process.env.MWIFI_BIN || path.join(ROOT, 'device', 'MWIFI.BIN');

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const DISCOVERY_PORT = process.env.DISCOVERY_PORT ? parseInt(process.env.DISCOVERY_PORT, 10) : 9001;
const CODE39_RE = /^[0-9A-Z\-. $/+%]{1,13}$/;

/* ---- card feed state ---- */
let mushikingCard = null;   // { code39, name, seq, ts } | null
let mushikingSeq = 0;

/* ---- helpers ---- */

/** Resolve a data/config file, falling back to its *.sample.* sibling. */
function resolveWithSample(realPath, samplePath) {
  if (fs.existsSync(realPath)) return realPath;
  if (fs.existsSync(samplePath)) return samplePath;
  return null;
}

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function sendFile(res, filePath, contentType) {
  const type = contentType || CONTENT_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  fs.createReadStream(filePath).pipe(res);
}

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
}

/** Map an under-/mushiking/ image request to a safe path inside data/images. */
function safeImagePath(urlPath) {
  const rel = decodeURIComponent(urlPath.replace(/^\/mushiking\//, '').split('?')[0]);
  const full = path.normalize(path.join(IMAGES_DIR, rel));
  if (!full.startsWith(IMAGES_DIR + path.sep)) return null; // path-traversal guard
  return full;
}

/* ---- card feed handlers ---- */

function handleCurrentCard(res) {
  const code39 = mushikingCard ? mushikingCard.code39 : '';
  res.writeHead(200, {
    'Content-Type': 'text/plain',
    'Cache-Control': 'no-store',
    'X-Mushiking-Seq': String(mushikingCard ? mushikingCard.seq : mushikingSeq),
    'Content-Length': Buffer.byteLength(code39, 'ascii'),
    'Connection': 'close',
  });
  res.end(code39);
}

function handleSelectCard(req, res) {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    let body;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'invalid JSON' }));
      return;
    }
    const code39 = typeof body.code39 === 'string' ? body.code39.trim().toUpperCase() : '';
    if (code39 === '') {
      mushikingCard = null;
      mushikingSeq++;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, card: null }));
      return;
    }
    if (!CODE39_RE.test(code39)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'invalid CODE39 (need 1-13 CODE39 chars)' }));
      return;
    }
    mushikingCard = {
      code39,
      name: typeof body.name === 'string' ? body.name : null,
      seq: ++mushikingSeq,
      ts: new Date().toISOString(),
    };
    console.log(`[mushiking] card selected: ${code39}${mushikingCard.name ? ` (${mushikingCard.name})` : ''}`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, card: mushikingCard }));
  });
}

/* ---- shared helpers ---- */

function jsonError(res, code, msg) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: msg }));
}

function jsonOk(res, obj) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, ...obj }));
}

/** Read a full request body as a Buffer, rejecting if it exceeds `limit`. */
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (limit && size > limit) {
        reject(new Error('ファイルが大きすぎます'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/* ---- card-data import (Phase 3b wizard) ---- */

const MAX_CARDS_JSON = 50 * 1024 * 1024;
const MAX_IMAGE = 20 * 1024 * 1024;
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);

/** Loose validation: must be an object whose card sections are arrays. */
function validateCardsObject(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { ok: false, error: 'cards.json はオブジェクト形式である必要があります' };
  }
  if (!Array.isArray(obj.mushi_cards)) {
    return { ok: false, error: 'mushi_cards 配列が見つかりません（cards.schema.json を参照）' };
  }
  for (const key of ['mushi_cards', 'waza_cards', 'ada_cards', 'license_cards']) {
    if (obj[key] !== undefined && !Array.isArray(obj[key])) {
      return { ok: false, error: `${key} は配列である必要があります` };
    }
  }
  return {
    ok: true,
    counts: {
      mushi: obj.mushi_cards.length,
      waza: (obj.waza_cards || []).length,
      ada: (obj.ada_cards || []).length,
      license: (obj.license_cards || []).length,
    },
  };
}

function importCards(req, res) {
  readBody(req, MAX_CARDS_JSON).then((buf) => {
    let obj;
    try { obj = JSON.parse(buf.toString('utf8')); }
    catch { return jsonError(res, 400, 'JSON として読み込めませんでした'); }
    const v = validateCardsObject(obj);
    if (!v.ok) return jsonError(res, 400, v.error);
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(path.join(DATA_DIR, 'cards.json'), JSON.stringify(obj));
    console.log(`[import] cards.json saved (mushi=${v.counts.mushi} waza=${v.counts.waza})`);
    jsonOk(res, { counts: v.counts });
  }).catch((e) => jsonError(res, 413, e.message));
}

function importJsonConfig(req, res, filename) {
  readBody(req, 4 * 1024 * 1024).then((buf) => {
    let obj;
    try { obj = JSON.parse(buf.toString('utf8')); }
    catch { return jsonError(res, 400, 'JSON として読み込めませんでした'); }
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(path.join(CONFIG_DIR, filename), JSON.stringify(obj));
    console.log(`[import] ${filename} saved`);
    jsonOk(res, {});
  }).catch((e) => jsonError(res, 413, e.message));
}

function importImage(req, res, rawUrl) {
  const u = new URL(rawUrl, 'http://localhost');
  const rel = u.searchParams.get('path');
  if (!rel) return jsonError(res, 400, 'path クエリがありません');
  const full = path.normalize(path.join(IMAGES_DIR, decodeURIComponent(rel)));
  if (!full.startsWith(IMAGES_DIR + path.sep)) return jsonError(res, 400, '不正なパスです');
  if (!IMAGE_EXT.has(path.extname(full).toLowerCase())) {
    return jsonError(res, 400, '対応していない画像形式です（png/jpg/gif/webp）');
  }
  readBody(req, MAX_IMAGE).then((buf) => {
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, buf);
    jsonOk(res, {});
  }).catch((e) => jsonError(res, 413, e.message));
}

function importStatus(res) {
  const userCards = fs.existsSync(path.join(DATA_DIR, 'cards.json'));
  let imageCount = 0;
  (function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else imageCount++;
    }
  })(IMAGES_DIR);
  jsonOk(res, { cardsSource: userCards ? 'user' : 'sample', imageCount });
}

/* POST /mushiking/bake-key { ssid, psk } -> patched MWIFI.BIN download.
 * The passphrase is used only to derive the PMK and is never stored or logged. */
function handleBakeKey(req, res) {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    let body;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    } catch {
      return jsonError(res, 400, 'invalid JSON');
    }
    if (!fs.existsSync(MWIFI_BIN)) {
      return jsonError(res, 404, 'MWIFI.BIN が見つかりません。Bリポジトリの Release から取得して device/MWIFI.BIN に置いてください。');
    }
    let out;
    try {
      const blob = fs.readFileSync(MWIFI_BIN);
      out = keybaker.bake(blob, body.ssid, body.psk); // throws on bad input / missing slot
    } catch (e) {
      return jsonError(res, 400, e.message);
    }
    console.log(`[keybaker] baked MWIFI.BIN for SSID "${String(body.ssid)}" (${out.length} bytes)`); // never log psk
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="MWIFI.BIN"',
      'Content-Length': out.length,
      'Cache-Control': 'no-store',
    });
    res.end(out);
  });
}

/* ---- static UI ---- */

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  let rel = urlPath === '/' ? '/index.html' : urlPath;
  let full = path.normalize(path.join(DIST, rel));
  if (!full.startsWith(DIST)) return notFound(res);

  if (fs.existsSync(full) && fs.statSync(full).isFile()) {
    return sendFile(res, full);
  }
  // SPA fallback: serve index.html for unknown non-asset routes.
  const indexHtml = path.join(DIST, 'index.html');
  if (fs.existsSync(indexHtml)) return sendFile(res, indexHtml);
  res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('UI not built yet. Run `npm run setup` first.');
}

/* ---- HTTP routing ---- */

const httpServer = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  if (req.method === 'GET' && url === '/mushiking/current-card') return handleCurrentCard(res);
  if (req.method === 'POST' && url === '/mushiking/select-card') return handleSelectCard(req, res);
  if (req.method === 'POST' && url === '/mushiking/bake-key') return handleBakeKey(req, res);

  if (req.method === 'GET' && url === '/mushiking/import/status') return importStatus(res);
  if (req.method === 'POST' && url === '/mushiking/import/cards') return importCards(req, res);
  if (req.method === 'POST' && url === '/mushiking/import/barcode-config') return importJsonConfig(req, res, 'barcode-config.json');
  if (req.method === 'POST' && url === '/mushiking/import/summon') return importJsonConfig(req, res, 'summon-cards.json');
  if (req.method === 'PUT' && url === '/mushiking/import/image') return importImage(req, res, req.url);
  if (req.method === 'GET' && url === '/mushiking/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ card: mushikingCard }));
  }

  if (req.method === 'GET' && url === '/mushiking/db/cards.json') {
    const file = resolveWithSample(path.join(DATA_DIR, 'cards.json'), path.join(DATA_DIR, 'cards.sample.json'));
    return file ? sendFile(res, file, CONTENT_TYPES['.json']) : notFound(res);
  }
  if (req.method === 'GET' && url === '/mushiking/config/barcode.json') {
    const file = resolveWithSample(path.join(CONFIG_DIR, 'barcode-config.json'), path.join(CONFIG_DIR, 'barcode-config.sample.json'));
    return file ? sendFile(res, file, CONTENT_TYPES['.json']) : notFound(res);
  }
  if (req.method === 'GET' && url === '/mushiking/config/summon.json') {
    const file = resolveWithSample(path.join(CONFIG_DIR, 'summon-cards.json'), path.join(CONFIG_DIR, 'summon-cards.sample.json'));
    return file ? sendFile(res, file, CONTENT_TYPES['.json']) : notFound(res);
  }
  if (req.method === 'GET' && url === '/mushiking/config/medal-dirs.json') {
    const file = resolveWithSample(path.join(CONFIG_DIR, 'medal-image-dirs.json'), path.join(CONFIG_DIR, 'medal-image-dirs.sample.json'));
    return file ? sendFile(res, file, CONTENT_TYPES['.json']) : notFound(res);
  }

  // Any other /mushiking/* GET is treated as a card image (user-supplied).
  if (req.method === 'GET' && url.startsWith('/mushiking/')) {
    const img = safeImagePath(url);
    if (img && fs.existsSync(img) && fs.statSync(img).isFile()) return sendFile(res, img);
    return notFound(res); // UI shows a "画像なし" placeholder
  }

  if (req.method === 'GET') return serveStatic(req, res);
  notFound(res);
});

/* ---- UDP discovery (so the 3DS can find this PC on the LAN) ---- */

function startDiscovery() {
  const beacon = dgram.createSocket('udp4');
  const BEACON_MSG = Buffer.from('GBAWIIPC');
  beacon.on('error', (err) => console.error(`[discovery] ${err.message}`));
  beacon.bind(DISCOVERY_PORT, '0.0.0.0', () => {
    beacon.setBroadcast(true);
    setInterval(() => {
      beacon.send(BEACON_MSG, 0, BEACON_MSG.length, DISCOVERY_PORT, '255.255.255.255');
    }, 1000);
    console.log(`Discovery: UDP :${DISCOVERY_PORT} (broadcast GBAWIIPC + reply 3DS_HERE)`);
  });
  beacon.on('message', (msg, rinfo) => {
    if (msg.length >= 8 && msg.toString('ascii', 0, 8) === '3DS_FIND') {
      beacon.send(Buffer.from('3DS_HERE'), 0, 8, rinfo.port, rinfo.address);
    }
  });
}

/* ---- browser auto-open ---- */

function openBrowser(url) {
  try {
    const cmd = process.platform === 'darwin' ? 'open'
      : process.platform === 'win32' ? 'cmd' : 'xdg-open';
    const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
    spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();
  } catch {
    /* opening the browser is best-effort */
  }
}

/* ---- start ---- */

httpServer.on('error', (err) => {
  console.error(`[http] ${err.message}`);
  process.exit(1);
});

httpServer.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`NoSlotHCV: ${url}`);
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    console.log('  (UI not built — run `npm run setup` first)');
  }
  startDiscovery();
  if (process.env.NO_OPEN !== '1') openBrowser(url);
});
