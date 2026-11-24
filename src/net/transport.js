// How players reach each other. A transport carries two things between everyone in a room:
//   state  - each player's latest snapshot, sent many times a second; only the newest one matters
//   events - one-off things (a shot, a hit, "I took that car")
// Four transports are built in:
//   "relay"  a small server that passes everything along: the game's own server (server/ in this repo), which also
//            hands out the game's files. Nobody's computer hosts: every player only sends their own snapshots and
//            receives the others'. The normal way to play; used whenever the page came from that server (see netOn below).
//   "room"   the live room of the Claude page the game is published on (only there, and only if the page was given one)
//   "tabs"   windows of one browser on one computer, for trying multiplayer alone, and the fallback when the
//            relay cannot be reached.
//   "direct" players' browsers connected straight to each other (WebRTC, through the vendored PeerJS). The first player
//            to join a room code hosts it and passes everything along, which costs that player's computer and
//            connection. Not used unless the address asks for it (?direct or ?peer=host:port).
// Each has the same calls: id, setState(obj), emit(type, data, to?), onState(fn), onEvent(fn), onLeave(fn), onClose(fn), close()

import { NET } from '../config.js';

const newId = () => Math.random().toString(36).slice(2, 8);
export const cleanRoom = (code) => (String(code || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)) || 'sunset';

function base(kind) {
  const on = { state: [], event: [], leave: [], close: [] };
  return {
    kind, id: null, on, host: false, note: '',
    onState(fn) { on.state.push(fn); }, onEvent(fn) { on.event.push(fn); }, onLeave(fn) { on.leave.push(fn); }, onClose(fn) { on.close.push(fn); },
    tell(list, ...a) { for (const fn of on[list]) fn(...a); },
  };
}

// The relay: one WebSocket to wss://<relay>/room/<code>. It gives us our id, stamps every message with its sender and
// passes it to the others. The other half is server/server.js (the game's own server); relay/ is the same for Cloudflare.
export function createRelayTransport(room, address) {
  const t = base('relay'), url = String(address).replace(/^http/, 'ws').replace(/\/+$/, '') + '/room/' + cleanRoom(room);
  return new Promise((res, rej) => {
    let ws, opened = false, closing = false;
    try { ws = new WebSocket(url); } catch (e) { rej(new Error('the relay address is not valid')); return; }
    // ten seconds to answer. If the page itself was busy all that time (still building the city), the answer may be
    // sitting unread, so look once more a moment later before giving up.
    const giveUp = () => { if (opened) return; closing = true; ws.close(); rej(new Error('the relay did not answer')); };
    let timer = setTimeout(() => { timer = setTimeout(giveUp, 400); }, 10000);
    const send = (m) => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); };
    ws.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (!m || typeof m !== 'object') return;
      if (m.k === 'hi') { t.id = m.id; opened = true; clearTimeout(timer); res(t); }
      else if (m.k === 's') t.tell('state', m.f, m.d); else if (m.k === 'e') t.tell('event', m.f, m.t, m.d); else if (m.k === 'bye') t.tell('leave', m.f);
    };
    ws.onclose = () => { clearTimeout(timer); if (!opened) rej(new Error('the relay refused the connection (the room may be full)')); else if (!closing) t.tell('close'); };
    t.setState = (d) => { if (ws.bufferedAmount < 65536) send({ k: 's', d }); };          // a slow link: skip snapshots instead of queueing them
    t.emit = (type, d, to) => send(to ? { k: 'e', t: type, d, to } : { k: 'e', t: type, d });
    const bye = () => { closing = true; ws.close(); };
    addEventListener('pagehide', bye);
    t.close = () => { removeEventListener('pagehide', bye); bye(); };
  });
}

// Tabs of one browser on one computer (BroadcastChannel). Nothing leaves the machine.
export function createTabTransport(room) {
  const t = base('tabs'), ch = new BroadcastChannel('fta6:' + cleanRoom(room)), heard = new Map();
  t.id = newId();
  ch.onmessage = (e) => {
    const m = e.data; if (!m || m.f === t.id) return;
    if (m.k === 'bye') { if (heard.delete(m.f)) t.tell('leave', m.f); return; }
    heard.set(m.f, Date.now());
    if (m.k === 's') t.tell('state', m.f, m.d);
    else if (m.k === 'e' && (!m.to || m.to === t.id)) t.tell('event', m.f, m.t, m.d);
  };
  // a tab that closed without saying goodbye goes quiet instead
  const sweep = setInterval(() => { const now = Date.now(); for (const [id, at] of heard) if (now - at > 8000) { heard.delete(id); t.tell('leave', id); } }, 2000);
  const bye = () => ch.postMessage({ f: t.id, k: 'bye' });
  addEventListener('pagehide', bye);
  t.setState = (d) => ch.postMessage({ f: t.id, k: 's', d });
  t.emit = (type, d, to) => ch.postMessage({ f: t.id, k: 'e', t: type, d, to });
  t.close = () => { bye(); clearInterval(sweep); removeEventListener('pagehide', bye); ch.close(); };
  return t;
}

// The live room of the Claude page the game is published on (its `room` capability): everyone who has the page open
// and joined the same room code. State rides on presence (latest wins, about 30 a second); events on one topic, 'ev',
// which the page opens to everyone it is shared with when it is published.
export async function createRoomTransport(room) {
  if (!globalThis.claude?.use) return null;
  let r;
  try { const lobby = await globalThis.claude.use('room'); if (!lobby) return null; r = await lobby.join('fta6-' + cleanRoom(room)); } catch { return null; }
  const t = base('room'), quiet = () => { };
  const offPeers = r.onPeers((c) => {
    for (const p of c.peers) if (p.sameTab) t.id = p.peer;
    for (const p of c.joined) if (!p.sameTab && p.presence?.s) t.tell('state', p.peer, p.presence.s);
    for (const p of c.updated) if (!p.sameTab && p.presence?.s) t.tell('state', p.peer, p.presence.s);
    for (const p of c.left) t.tell('leave', p.peer);
  }, quiet);
  const offEv = r.on('ev', (m) => { const d = m.data; if (m.sameTab || !d || (d.to && d.to !== t.id)) return; t.tell('event', m.peer, d.t, d.d); }, quiet);
  t.setState = (d) => { r.presence({ s: d }).catch(quiet); };
  t.emit = (type, d, to) => { r.emit('ev', to ? { t: type, d, to } : { t: type, d }).catch(quiet); };
  t.close = () => { offPeers(); offEv(); r.leave().catch(quiet); };
  // the room tells us our own label a moment after we join
  r.presence({ here: 1 }).catch(quiet);
  for (let i = 0; i < 80 && !t.id; i++) await new Promise(res => setTimeout(res, 50));
  if (!t.id) { t.close(); return null; }
  return t;
}

// ---------- direct connections (WebRTC) ----------
let peerLib = null;
const loadPeer = () => peerLib || (peerLib = new Promise((res, rej) => {
  if (globalThis.Peer) return res(globalThis.Peer);
  const s = document.createElement('script'); s.src = new URL('../../vendor/peerjs/peerjs.min.js', import.meta.url).href;
  s.onload = () => (globalThis.Peer ? res(globalThis.Peer) : rej(new Error('the connection library did not load')));
  s.onerror = () => { peerLib = null; rej(new Error('the connection library did not load')); };
  document.head.append(s);
}));

// server: 'host:port' of a PeerJS server of our own (the playtests run one); left out, PeerJS's free public one.
export async function createRtcTransport(room, server) {
  const Peer = await loadPeer(), t = base('direct'), hostId = 'fta6-sc-' + cleanRoom(room);
  const opts = { debug: 0 };
  if (server) { const [host, port] = server.split(':'); Object.assign(opts, { host, port: +port || 9000, path: '/', secure: false }); }
  const start = (id) => new Promise((res, rej) => {
    const p = id ? new Peer(id, opts) : new Peer(opts);
    const done = (fn, v) => { clearTimeout(timer); p.off('open', ok); p.off('error', bad); fn(v); };
    const ok = () => done(res, p), bad = (e) => { p.destroy(); done(rej, e); };
    const timer = setTimeout(() => bad(new Error('the connection service did not answer')), 12000);
    p.on('open', ok); p.on('error', bad);
  });
  // Whoever gets the room's name hosts it. If the name is taken, somebody already does: join them.
  let peer;
  try { peer = await start(hostId); t.host = true; }
  catch (e) { if (e?.type !== 'unavailable-id') throw e; peer = await start(null); }
  t.id = peer.id;
  const full = (c) => (c.dataChannel?.bufferedAmount || 0) > 65536;          // a slow link: skip snapshots instead of queueing them

  if (t.host) {
    const conns = new Map();
    const cast = (m, except) => { for (const [id, c] of conns) if (id !== except && c.open && !(m.k === 's' && full(c))) c.send(m); };
    peer.on('connection', (c) => {
      const gone = () => { if (conns.get(c.peer) === c) { conns.delete(c.peer); t.tell('leave', c.peer); cast({ k: 'bye', f: c.peer }); } };
      c.on('open', () => conns.set(c.peer, c));
      c.on('data', (m) => {
        if (!m || typeof m !== 'object') return;
        if (m.k === 's') { t.tell('state', c.peer, m.d); cast({ k: 's', f: c.peer, d: m.d }, c.peer); }
        else if (m.k === 'e') {
          if (!m.to || m.to === t.id) t.tell('event', c.peer, m.t, m.d);
          if (!m.to) cast({ k: 'e', f: c.peer, t: m.t, d: m.d }, c.peer);
          else if (m.to !== t.id) { const o = conns.get(m.to); if (o?.open) o.send({ k: 'e', f: c.peer, t: m.t, d: m.d }); }
        }
      });
      c.on('close', gone); c.on('error', gone);
    });
    peer.on('disconnected', () => { if (!peer.destroyed) setTimeout(() => { if (!peer.destroyed && peer.disconnected) peer.reconnect(); }, 2000); });   // stay findable for late joiners
    peer.on('error', () => { });
    t.setState = (d) => cast({ k: 's', f: t.id, d });
    t.emit = (type, d, to) => { const m = { k: 'e', f: t.id, t: type, d }; if (to) { const o = conns.get(to); if (o?.open) o.send(m); } else cast(m); };
  } else {
    const c = peer.connect(hostId, { reliable: false, serialization: 'json' });
    await new Promise((res, rej) => {
      const timer = setTimeout(() => { peer.destroy(); rej(new Error('could not reach the host of this room')); }, 20000);
      c.on('open', () => { clearTimeout(timer); res(); });
      c.on('error', (e) => { clearTimeout(timer); peer.destroy(); rej(e); });
      peer.on('error', (e) => { if (e?.type === 'peer-unavailable') { clearTimeout(timer); peer.destroy(); rej(new Error('the host of this room just left; try again')); } });
    });
    c.on('data', (m) => {
      if (!m || typeof m !== 'object') return;
      if (m.k === 's') t.tell('state', m.f, m.d); else if (m.k === 'e') t.tell('event', m.f, m.t, m.d); else if (m.k === 'bye') t.tell('leave', m.f);
    });
    c.on('close', () => t.tell('close'));
    t.setState = (d) => { if (c.open && !full(c)) c.send({ k: 's', d }); };
    t.emit = (type, d, to) => { if (c.open) c.send(to ? { k: 'e', t: type, d, to } : { k: 'e', t: type, d }); };
  }
  const bye = () => peer.destroy();
  addEventListener('pagehide', bye);
  t.close = () => { removeEventListener('pagehide', bye); peer.destroy(); };
  return t;
}

// Is playing together on for this page, and which relay does it use?
//   config.js NET              the answer built into every copy of the game (off, as it stands)
//   <meta name="fta-relay">    put into the page by the game's own server (server/): on. "same" means the relay is at the
//                              page's own address; anything else is the relay's address
//   ?mp and ?relay=ws://...    in the address, for the playtests
const fromServer = () => document.querySelector('meta[name="fta-relay"]')?.content || '';
export const netOn = () => !!(NET.enabled || fromServer() || new URLSearchParams(location.search).has('mp'));
export function relayAddress() {
  const m = fromServer();
  return new URLSearchParams(location.search).get('relay') || (m === 'same' ? new URL('.', location.href).href : m) || NET.relay;
}

// The best transport this page has: the relay if there is one, else the Claude page's room, else this computer only.
// In the address: ?tabs forces the one-computer kind, ?relay=ws://host:port names another relay (the playtests run
// one), ?direct or ?peer=host:port asks for direct connections.
export async function openTransport(room) {
  const q = new URLSearchParams(location.search), relay = relayAddress();
  if (q.has('tabs')) return createTabTransport(room);
  let note = relay ? '' : 'no relay is set up';
  try {
    if (q.has('direct') || q.has('peer')) return await createRtcTransport(room, q.get('peer'));
    if (relay) return await createRelayTransport(room, relay);
  } catch (e) { note = String(e?.message || e?.type || e); }
  const live = await createRoomTransport(room); if (live) return live;
  const t = createTabTransport(room); t.note = note; return t;
}
