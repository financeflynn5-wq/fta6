// FTA 6 on a server of our own: one small program that hands out the game's files and is the relay for playing together.
//
//   http://<server>/                 the game
//   ws://<server>/room/<code>        the relay: a WebSocket; everyone on the same code is in the same room
//   http://<server>/health           "running", and how many players are in how many rooms
//   http://<server>/healthz          the same as JSON ({ok, players, rooms, multiplayer}), for the deploy tool's status
//
// The relay keeps no game state: it stamps each message with who sent it and passes it on.
//   from a player   {k:'s', d}             their latest snapshot      -> everyone else as {k:'s', f, d}
//                   {k:'e', t, d, to?}     a one-off event            -> everyone else, or only `to`, as {k:'e', f, t, d}
//   to a player     {k:'hi', id, n}        you are in; your id; how many were here before you
//                   {k:'bye', f}           that player left
// The game's side of this is createRelayTransport in src/net/transport.js.
//
// Settings (environment):
//   PORT=8080  HOST=0.0.0.0     where to listen
//   MULTIPLAYER=on|off          off: the game is handed out with playing together switched off, and the relay refuses
//   BASE=/fta6                  if the game lives under a folder of a bigger website and the web server in front does not
//                               strip that folder from the address
//   ALLOWED_ORIGINS=https://a,https://b    other websites whose copy of the game may use this relay (its own always may)
//   BEHIND_PROXY=1              a web server on this machine (Caddy, nginx) passes visitors on: take their address from it
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = +process.env.PORT || 8080, HOST = process.env.HOST || '0.0.0.0';
const MULTIPLAYER = !/^(off|0|false|no)$/i.test(process.env.MULTIPLAYER || 'on');
const BASE = (process.env.BASE || '').replace(/\/+$/, '');
const ALLOWED = String(process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const BEHIND_PROXY = /^(1|on|true|yes)$/i.test(process.env.BEHIND_PROXY || '');

// ---------- the game's files ----------
// Only what the game loads is handed out: the page and these folders. Not .git, not this server, not the dev tools.
const PUBLIC = new Set(['css', 'src', 'vendor', 'assets']);
const TYPES = {
  html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8', map: 'application/json; charset=utf-8', txt: 'text/plain; charset=utf-8', svg: 'image/svg+xml',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', ico: 'image/x-icon',
  glb: 'model/gltf-binary', gltf: 'model/gltf+json', bin: 'application/octet-stream', wasm: 'application/wasm',
  mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf',
};
const SHRINKS = new Set(['html', 'js', 'mjs', 'css', 'json', 'map', 'txt', 'svg', 'glb', 'gltf', 'bin', 'wasm']);   // worth compressing

const plain = (res, status, body, extra) => { res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'x-content-type-options': 'nosniff', ...extra }); res.end(body); };

// the file on disk an address means, or null
function fileFor(pathname) {
  let p; try { p = decodeURIComponent(pathname); } catch { return null; }
  if (p.includes('\0') || p.includes('\\')) return null;
  if (p === '/' || p === '') p = '/index.html';
  const parts = p.split('/').filter(Boolean);
  if (!parts.length || parts.some(s => s === '..' || s.startsWith('.'))) return null;
  if (!(parts.length === 1 && parts[0] === 'index.html') && !PUBLIC.has(parts[0])) return null;
  const file = path.join(ROOT, ...parts);
  return file.startsWith(ROOT + path.sep) ? file : null;
}

// The page, marked so the game knows it came from a server that is also the relay ("same": at the page's own address).
const MARK = '<meta name="fta-relay" content="same">';
const page = (html) => (MULTIPLAYER ? html.replace(/<meta charset=[^>]*>/i, (m) => m + '\n' + MARK) : html);

// Compressed copies are kept in memory (the whole game is a few megabytes) and thrown away when the file changes.
const kept = new Map(); let keptBytes = 0; const KEEP_UP_TO = 40 * 1024 * 1024;     // the server has 1 GB for everything
function shrunk(key, raw, how) {
  const k = how + ' ' + key, hit = kept.get(k); if (hit) return hit;
  const out = how === 'br'
    ? zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: raw.length } })
    : zlib.gzipSync(raw, { level: 6 });
  if (keptBytes + out.length > KEEP_UP_TO) { kept.clear(); keptBytes = 0; }
  kept.set(k, out); keptBytes += out.length;
  return out;
}

function serve(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return plain(res, 405, 'Only reading is allowed here.', { allow: 'GET, HEAD' });
  const file = fileFor(pathname); if (!file) return plain(res, 404, 'Not found.');
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return plain(res, 404, 'Not found.');
    const ext = path.extname(file).slice(1).toLowerCase(), isPage = file === path.join(ROOT, 'index.html');
    const tag = `"${st.size.toString(36)}-${Math.floor(st.mtimeMs).toString(36)}${isPage && MULTIPLAYER ? '-m' : ''}"`;
    const head = {
      'content-type': TYPES[ext] || 'application/octet-stream', 'x-content-type-options': 'nosniff',
      // always ask whether the file changed (a cheap "no"), so a new version of the game shows up on the next visit
      'cache-control': 'no-cache', etag: tag, 'last-modified': st.mtime.toUTCString(), vary: 'Accept-Encoding',
    };
    if (req.headers['if-none-match'] === tag) { res.writeHead(304, head); return res.end(); }
    const accepts = String(req.headers['accept-encoding'] || ''), how = !SHRINKS.has(ext) || st.size < 512 ? '' : /\bbr\b/.test(accepts) ? 'br' : /\bgzip\b/.test(accepts) ? 'gzip' : '';
    if (!how && !isPage) {                                    // pictures and the like: straight from disk
      head['content-length'] = st.size; res.writeHead(200, head);
      if (req.method === 'HEAD') return res.end();
      return fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
    }
    fs.readFile(file, (err2, raw) => {
      if (err2) return plain(res, 404, 'Not found.');
      if (isPage) raw = Buffer.from(page(raw.toString('utf8')));
      const body = how ? shrunk(file + tag, raw, how) : raw;
      if (how) head['content-encoding'] = how;
      head['content-length'] = body.length; res.writeHead(200, head); res.end(req.method === 'HEAD' ? undefined : body);
    });
  });
}

// ---------- the relay ----------
const MAX_PLAYERS = 12;         // per room
const MAX_BYTES = 6000;         // one message; a snapshot with three cars and the match score is about 1,500
const MAX_PER_SECOND = 80;      // per player; the game sends about 20 snapshots a second plus events
const MAX_EVERYONE = 600;       // connections to this server at once
const MAX_PER_ADDRESS = 16;     // connections from one visitor's address (a household or a school can share one)
const SLOW = 256 * 1024;        // bytes waiting to go to a player: beyond this they miss snapshots instead of queueing them
const STUCK = 4 * 1024 * 1024;  // beyond this they are cut off

const rooms = new Map();        // code -> Set of sockets
const perAddress = new Map();
let everyone = 0;

function allowed(req) {
  const origin = req.headers.origin; if (!origin) return true;                       // not a browser (a test script)
  let host = ''; try { host = new URL(origin).host; } catch { return false; }
  const name = host.replace(/:\d+$/, '');
  if (name === 'localhost' || name === '127.0.0.1') return true;
  if (host === req.headers.host) return true;                                         // the game this server hands out
  return ALLOWED.includes(origin);
}
const addressOf = (req) => (BEHIND_PROXY && String(req.headers['x-forwarded-for'] || '').split(',').pop().trim()) || req.socket.remoteAddress || '?';

const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024, perMessageDeflate: false });

function refuse(socket, status, why) {
  socket.write(`HTTP/1.1 ${status} ${http.STATUS_CODES[status]}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: ${Buffer.byteLength(why)}\r\nConnection: close\r\n\r\n${why}`);
  socket.destroy();
}

function join(req, socket, headBytes, code) {
  if (!MULTIPLAYER) return refuse(socket, 503, 'Playing together is switched off on this server.');
  if (!allowed(req)) return refuse(socket, 403, 'This page may not use this relay.');
  const room = rooms.get(code), from = addressOf(req);
  if (room && room.size >= MAX_PLAYERS) return refuse(socket, 503, 'This room is full.');
  if (everyone >= MAX_EVERYONE || (perAddress.get(from) || 0) >= MAX_PER_ADDRESS) return refuse(socket, 503, 'The server is full.');
  wss.handleUpgrade(req, socket, headBytes, (ws) => {
    const here = rooms.get(code) || new Set(); rooms.set(code, here);
    ws.id = crypto.randomBytes(4).toString('hex'); ws.alive = true; ws.at = 0; ws.n = 0;
    everyone++; perAddress.set(from, (perAddress.get(from) || 0) + 1);
    ws.send(JSON.stringify({ k: 'hi', id: ws.id, n: here.size }));
    here.add(ws);
    const pass = (out, snapshot, to) => {
      for (const other of here) {
        if (other === ws || other.readyState !== 1 || (to && other.id !== to)) continue;
        if (other.bufferedAmount > STUCK) { other.terminate(); continue; }
        if (snapshot && other.bufferedAmount > SLOW) continue;
        other.send(out);
      }
    };
    ws.on('pong', () => { ws.alive = true; });
    ws.on('message', (raw, binary) => {
      if (binary || raw.length > MAX_BYTES) return;
      // a player who floods is not passed on (the count restarts every second)
      const now = Date.now(); if (now - ws.at >= 1000) { ws.at = now; ws.n = 0; }
      if (++ws.n > MAX_PER_SECOND) return;
      let m; try { m = JSON.parse(raw.toString('utf8')); } catch { return; }
      if (!m || typeof m !== 'object') return;
      if (m.k === 's') pass(JSON.stringify({ k: 's', f: ws.id, d: m.d }), true);
      else if (m.k === 'e' && typeof m.t === 'string' && m.t.length <= 24) pass(JSON.stringify({ k: 'e', f: ws.id, t: m.t, d: m.d }), false, typeof m.to === 'string' ? m.to : null);
    });
    let gone = false;
    const leave = () => {
      if (gone) return; gone = true;
      here.delete(ws); if (!here.size && rooms.get(code) === here) rooms.delete(code);
      everyone--; const left = (perAddress.get(from) || 1) - 1; if (left > 0) perAddress.set(from, left); else perAddress.delete(from);
      pass(JSON.stringify({ k: 'bye', f: ws.id }), false);
    };
    ws.on('close', leave); ws.on('error', () => { leave(); ws.terminate(); });
  });
}

// a player whose connection died without a goodbye (a closed laptop, a dropped line) is found within a minute
const pulse = setInterval(() => {
  for (const room of rooms.values()) for (const ws of room) {
    if (!ws.alive) { ws.terminate(); continue; }
    ws.alive = false; try { ws.ping(); } catch { /* closing */ }
  }
}, 30000);

// ---------- the server ----------
const strip = (pathname) => (BASE && (pathname === BASE || pathname.startsWith(BASE + '/')) ? pathname.slice(BASE.length) || '/' : pathname);
const pathOf = (req) => { try { return strip(new URL(req.url, 'http://x').pathname); } catch { return null; } };

const server = http.createServer((req, res) => {
  const pathname = pathOf(req); if (pathname === null) return plain(res, 400, 'Bad address.');
  if (pathname === '/health' || pathname === '/healthz') {
    let players = 0; for (const r of rooms.values()) players += r.size;
    if (pathname === '/healthz') { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); return res.end(JSON.stringify({ ok: true, game: 'fta6', players, rooms: rooms.size, multiplayer: MULTIPLAYER })); }
    return plain(res, 200, `FTA 6 server: running. ${players} player${players === 1 ? '' : 's'} in ${rooms.size} room${rooms.size === 1 ? '' : 's'}. Playing together is ${MULTIPLAYER ? 'on' : 'off'}.\n`, { 'cache-control': 'no-store' });
  }
  if (/^\/room\//.test(pathname)) return plain(res, 426, 'This address is for the game to connect to.');
  serve(req, res, pathname);
});
server.on('upgrade', (req, socket, headBytes) => {
  socket.on('error', () => { });
  const pathname = pathOf(req), m = pathname && pathname.match(/^\/room\/([a-z0-9]{1,20})$/);
  if (!m || String(req.headers.upgrade).toLowerCase() !== 'websocket') return refuse(socket, 404, 'Not found.');
  join(req, socket, headBytes, m[1]);
});
server.headersTimeout = 20000; server.requestTimeout = 30000; server.keepAliveTimeout = 65000;
server.on('clientError', (e, socket) => { if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'); });
server.listen(PORT, HOST, () => console.log(`FTA 6 server: the game and the relay are on http://${HOST}:${PORT}${BASE}/ (playing together ${MULTIPLAYER ? 'on' : 'off'})`));

// Stopping (an update restarts it): tell the players' games, which join their room again by themselves a moment later.
function stop() {
  clearInterval(pulse);
  for (const room of rooms.values()) for (const ws of room) { try { ws.close(1012, 'restarting'); } catch { /* closing */ } }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on('SIGTERM', stop); process.on('SIGINT', stop);
