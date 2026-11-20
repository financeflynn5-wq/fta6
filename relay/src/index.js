// The relay for playing together. It runs on Cloudflare, so no player's computer hosts the room.
//
//   wss://<this worker>/room/<code>    a WebSocket; everyone on the same code is in the same room
//
// A room is one Durable Object. It keeps no game state: it stamps each message with who sent it and passes it on.
//   from a player   {k:'s', d}             their latest snapshot      -> everyone else as {k:'s', f, d}
//                   {k:'e', t, d, to?}     a one-off event            -> everyone else, or only `to`, as {k:'e', f, t, d}
//   to a player     {k:'hi', id, n}        you are in; your id; how many were here before you
//                   {k:'bye', f}           that player left
// The game's side of this is createRelayTransport in src/net/transport.js.
import { DurableObject } from 'cloudflare:workers';

const MAX_PLAYERS = 12;         // per room
const MAX_BYTES = 6000;         // one message; a snapshot with three cars and the match score is about 1,500
const MAX_PER_SECOND = 80;      // per player; the game sends about 20 snapshots a second plus events

const text = (body, status = 200) => new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'access-control-allow-origin': '*' } });

function allowed(origin, env) {
  if (!origin) return true;                                   // not a browser (a test script)
  let host = ''; try { host = new URL(origin).hostname; } catch { return false; }
  if (host === 'localhost' || host === '127.0.0.1') return true;
  return String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean).includes(origin);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url), m = url.pathname.match(/^\/room\/([a-z0-9]{1,20})$/);
    if (!m) return text(url.pathname === '/' ? 'FTA 6 relay: running.' : 'Not found.', url.pathname === '/' ? 200 : 404);
    if (request.headers.get('Upgrade') !== 'websocket') return text('This address is for the game to connect to.', 426);
    if (!allowed(request.headers.get('Origin'), env)) return text('This page may not use this relay.', 403);
    return env.ROOMS.get(env.ROOMS.idFromName(m[1])).fetch(request);
  },
};

export class Room extends DurableObject {
  constructor(ctx, env) { super(ctx, env); this.rate = new Map(); }

  async fetch() {
    const here = this.ctx.getWebSockets();
    if (here.length >= MAX_PLAYERS) return text('This room is full.', 503);
    const { 0: client, 1: server } = new WebSocketPair();
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
    this.ctx.acceptWebSocket(server);                         // hibernation: an idle room costs nothing
    server.serializeAttachment({ id });
    server.send(JSON.stringify({ k: 'hi', id, n: here.length }));
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > MAX_BYTES) return;
    // a player who floods is not passed on (the count restarts every second)
    const now = Date.now(); let r = this.rate.get(ws);
    if (!r || now - r.at >= 1000) this.rate.set(ws, r = { at: now, n: 0 });
    if (++r.n > MAX_PER_SECOND) return;
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;
    const from = ws.deserializeAttachment()?.id; if (!from) return;
    let out;
    if (m.k === 's') out = JSON.stringify({ k: 's', f: from, d: m.d });
    else if (m.k === 'e' && typeof m.t === 'string' && m.t.length <= 24) out = JSON.stringify({ k: 'e', f: from, t: m.t, d: m.d });
    else return;
    const to = m.k === 'e' && typeof m.to === 'string' ? m.to : null;
    for (const other of this.ctx.getWebSockets()) {
      if (other === ws) continue;
      if (to && other.deserializeAttachment()?.id !== to) continue;
      try { other.send(out); } catch { /* it is closing; its own close tells the others */ }
    }
  }

  webSocketClose(ws, code) { this.gone(ws); try { ws.close(code === 1005 || code === 1006 ? 1000 : code, 'bye'); } catch { /* already closed */ } }
  webSocketError(ws) { this.gone(ws); }

  gone(ws) {
    this.rate.delete(ws);
    const id = ws.deserializeAttachment()?.id; if (!id) return;
    const out = JSON.stringify({ k: 'bye', f: id });
    for (const other of this.ctx.getWebSockets()) if (other !== ws) { try { other.send(out); } catch { /* closing */ } }
  }
}
