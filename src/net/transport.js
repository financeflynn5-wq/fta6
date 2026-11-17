// How players reach each other. A transport carries two things between everyone in a room:
//   state  - each player's latest snapshot, sent many times a second; only the newest one matters
//   events - one-off things (a shot, a hit, "I took that car")
// Three transports are built in, tried in this order:
//   "room"   the live room of the Claude page the game is published on (only there, and only if the page was given one)
//   "direct" players' browsers connected straight to each other (WebRTC, through the vendored PeerJS). The first player
//            to join a room code hosts it; the others connect to the host, who passes everything along. A free public
//            service (PeerJS's) introduces the browsers to each other; after that nothing goes through a server.
//   "tabs"   windows of one browser on one computer, for trying multiplayer alone, and the fallback when the
//            introduction service cannot be reached.
// Each has the same calls: id, setState(obj), emit(type, data, to?), onState(fn), onEvent(fn), onLeave(fn), onClose(fn), close()

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

// The best transport this page has. ?tabs in the address forces the one-computer kind; ?peer=host:port names our own
// introduction server.
export async function openTransport(room) {
  const q = new URLSearchParams(location.search);
  const live = await createRoomTransport(room); if (live) return live;
  if (!q.has('tabs')) {
    try { return await createRtcTransport(room, q.get('peer')); }
    catch (e) { const t = createTabTransport(room); t.note = String(e?.message || e?.type || e); return t; }
  }
  return createTabTransport(room);
}
