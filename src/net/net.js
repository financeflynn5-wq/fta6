// Playing together. Every player's own game stays in charge of their own body, their own car and their own
// health; this file tells the others about them about 20 times a second and plays back what the others say.
// Street traffic and pedestrians are not shared yet: each screen has its own crowd.
//
//   state  (20 a second)  where I am, what I hold, and the cars I own (the one I drive plus the last few I left)
//   events                shot, swing, hit, carhit, take (a car changes owner), horn, down
//
// A car belongs to whoever drove it last. Its owner's game moves it; everyone else sees a ghost (ghostCar.js).
// Getting into a car another player left makes it yours. The parked cars the city starts with are the same on
// every screen, so the first player to touch one takes it away from everyone else's copy of the street.
import { WEAPONS, COMBAT } from '../config.js';
import { openTransport, cleanRoom, netOn } from './transport.js';
import { createRemote } from './remote.js';
import { packCar } from './ghostCar.js';

const RATE = 1 / 20;          // seconds between snapshots
const DELAY = .11;            // other players are drawn this far in the past, so there is always a report either side
const ALONE = 1;               // seconds between snapshots while nobody else is in the room
const KEEP_CARS = 3;          // how many of my cars the others are told about
const r2 = (n) => Math.round(n * 100) / 100, r1 = (n) => Math.round(n * 10) / 10;

export function createNet(game) {
  const remotes = new Map(), targets = [], owned = [], taken = new Map();
  let tr = null, clock = 0, sendT = 0, serial = 0, joined = 0, wasOver = false, lastHit = null, lastState = null, beat = 0, hosting = false;
  const handlers = [], extra = new Map();

  const net = {
    active: false, id: null, room: '', kind: '', host: false, note: '', name: 'Player', remotes, targets,
    get count() { return remotes.size + (net.active ? 1 : 0); },
    get clock() { return clock; },
    onChange(fn) { handlers.push(fn); },
    poke() { changed(); },                             // the player list should be redrawn (a match changed its colours)
    // Who keeps the score for the room. With direct connections it is whoever opened the room. Otherwise it is whoever
    // already says they do; when nobody does (the room is new, or that player left) the lowest id present takes it up.
    get hostId() {
      if (!net.active) return null; if (net.kind === 'direct') return net.host ? net.id : 'fta6-sc-' + net.room;
      let h = hosting ? net.id : null; for (const r of remotes.values()) if (r.hosting && (h === null || r.id < h)) h = r.id;
      return h;
    },
    get isHost() { return net.active && net.hostId === net.id; },
    // Hooks for a game mode on top (match.js): more fields in my snapshot, a look at everyone else's, its own events,
    // who may be hurt, and whether I can be.
    pack: null, unpack: null, canHit: () => true, shielded: () => false,
    on(type, fn) { extra.set(type, fn); },
    send(type, d, to) { if (net.active) tr.emit(type, d, to); },
    hitter() { return lastHit && clock - lastHit.at < 6 ? lastHit.from : null; },

    // Join a room (anyone who joins the same code sees each other). Resolves once connected.
    async join(room, name, transport) {
      if (!netOn()) throw new Error('playing together is switched off');
      if (net.active) net.leave();
      net.room = cleanRoom(room); net.name = String(name || 'Player').slice(0, 14) || 'Player';
      tr = transport || await openTransport(net.room);
      net.id = tr.id; net.kind = tr.kind; net.host = tr.host; net.note = tr.note; net.active = true; clock = 0; sendT = 0; wasOver = game.over; hosting = false;
      for (const v of owned) v.netId = net.id + '.' + (++serial);
      tr.onState(onState); tr.onEvent(onEvent); tr.onLeave(drop);
      tr.onClose(() => {
        const kind = net.kind, was = net.room, me = net.name; net.leave();
        if (kind !== 'relay') { game.hud.toast('THE HOST LEFT: THE ROOM IS CLOSED', 'bad'); return; }
        // the line to the relay dropped: try once to get back into the room
        game.hud.toast('CONNECTION LOST: REJOINING…', 'bad');
        setTimeout(() => { if (!net.active) net.join(was, me).then(() => { if (net.kind === 'relay') game.hud.toast(`BACK IN ROOM ${was.toUpperCase()}`, 'good'); else { net.leave(); game.hud.toast('COULD NOT GET BACK INTO THE ROOM', 'bad'); } }, () => game.hud.toast('COULD NOT GET BACK INTO THE ROOM', 'bad')); }, 1500);
      });
      beat = setInterval(() => { if (document.hidden && lastState) { lastState.aw = 1; tr.setState(lastState); } }, 1000);    // a tab in the background still says "I'm here"
      changed();
      return net;
    },
    leave() {
      if (!net.active) return;
      clearInterval(beat); tr.close(); tr = null; net.active = false; net.id = null;
      for (const id of [...remotes.keys()]) drop(id, true);
      for (const v of owned) v.netId = undefined;
      taken.clear(); lastState = null; changed();
    },

    // main.js: the player got into a car. It is ours to tell the others about from now on.
    own(car) {
      if (car.ghost) return;
      const i = owned.indexOf(car); if (i >= 0) owned.splice(i, 1);
      owned.unshift(car);
      if (net.active && !car.netId) car.netId = net.id + '.' + (++serial);
    },

    // player.js: getting into a car another player left behind. Their ghost becomes a real car of ours.
    claim(ghost) {
      const owner = ghost.owner, id = ghost.netId;
      const v = game.traffic.add(ghost.type, ghost.x, ghost.z, ghost.h, ghost.color);
      v.health = ghost.health; v.sid = ghost.sid; v.stolen = true; v.temp = true; v.netId = id; if (v.craft) v.craft.setHeight(v, ghost.y, ghost.air > 0); else game.ride.setHeight(v, ghost.y); v.syncVisual(0, 0);
      owner.dropCar(id); taken.set(id, clock + 3);
      owned.unshift(v); tr.emit('take', { id });
      return v;
    },

    // combat.js / hits.js
    shot(weapon, muzzle, ends) { tr.emit('shot', { w: weapon, m: [r2(muzzle.x), r2(muzzle.y), r2(muzzle.z)], e: ends.map(r1) }); },
    swing() { if (net.active) tr.emit('swing', 0); },
    hitRival(r, damage, head, dx, dz, knock) { if (net.canHit(r)) tr.emit('hit', { d: damage, hd: head ? 1 : 0, dx: r2(dx), dz: r2(dz), kn: knock }, r.id); },
    carHit(ghost, d) { if (net.canHit(ghost.owner)) tr.emit('carhit', { id: ghost.netId, d: r1(d) }, ghost.owner.id); },
    horn(v) { if (net.active && v.netId) tr.emit('horn', { id: v.netId }); },

    // ---------- once per physics step ----------
    preStep() {
      if (!net.active) return;
      const T = clock - DELAY;
      for (const r of remotes.values()) r.preStep(T);
    },

    // ---------- once per drawn frame ----------
    update(dt, t) {
      if (!net.active) return;
      clock += dt;
      const camPos = game.camera.position;
      targets.length = 0;
      for (const r of remotes.values()) {
        r.update(dt, t, camPos);
        if (!r.inCar && !r.away && r.model && net.canHit(r)) targets.push(r);
        if (clock - r.heard > (net.kind === 'tabs' ? 8 : 20)) drop(r.id);
      }
      for (let i = owned.length - 1; i >= 0; i--) if (owned[i].gone) owned.splice(i, 1);
      for (const [id, until] of taken) if (clock > until) taken.delete(id);
      if (net.kind !== 'direct') {                       // see hostId
        let other = null, low = net.id; for (const r of remotes.values()) { if (r.hosting && (other === null || r.id < other)) other = r.id; if (r.id < low) low = r.id; }
        if (other !== null) { if (!hosting || other < net.id) hosting = false; } else if (!hosting && clock > 1.5 && low === net.id) hosting = true;
      }
      // knocked out with other players around: tell them who did it
      if (game.over && !wasOver && !game.match?.on) tr.emit('down', { by: lastHit && clock - lastHit.at < 6 ? lastHit.from : null });
      wasOver = game.over;
      // alone in a room there is nobody to tell 20 times a second: once a second keeps my place, and costs the relay next to nothing
      const every = remotes.size ? RATE : ALONE;
      if ((sendT -= dt) <= 0) { sendT = sendT < -every ? every : sendT + every; tr.setState(lastState = snapshot()); }
    },
  };

  const changed = () => { for (const fn of handlers) fn(net); };

  function snapshot() {
    const p = game.player, c = game.combat, car = p.vehicle;
    const s = {
      t: Math.round(clock * 1000) / 1000, nm: net.name, who: p.who, m: car ? 1 : 0, x: r2(p.x), y: r2(p.y), z: r2(p.z), f: r2(p.face), sp: r1(p.speed),
      st: p.sky === 'chute' ? 5 : p.sky ? (p.diving ? 4 : 3) : game.over || p.tumble > 0 ? 2 : p.speed > .4 ? 1 : 0, w: c.weapon, r: c.ready ? 1 : 0, ap: r2(c.aimPitch), rl: c.reloading > 0 ? 1 : 0, hp: Math.round(p.health), up: p.up ? 1 : 0, c: [],
    };
    if (p.who === 'bighead') s.lk = p.model.userData.look;
    // my car first, then the last few I left standing
    if (car && !car.ghost) { if (owned[0] !== car) net.own(car); s.c.push(packCar(car)); }
    for (const v of owned) { if (s.c.length >= KEEP_CARS) break; if (v !== car && v.netId) s.c.push(packCar(v)); }
    if (hosting) s.hs = 1;
    net.pack?.(s);
    return s;
  }

  // ---------- what the others say ----------
  function onState(from, s) {
    if (!s || typeof s !== 'object' || typeof s.t !== 'number') return;
    let r = remotes.get(from);
    if (!r) {
      r = createRemote(game, from, joined++); remotes.set(from, r);
      r.dress(s.who, s.lk, s.nm); r.heard = clock;
      game.hud.toast(`${r.name.toUpperCase()} JOINED`, 'info'); changed();
      sendT = 0;                                       // tell the newcomer about me now, not at the next slow beat
    } else if (s.nm !== r.name || s.who !== r.who || (s.who === 'bighead' && JSON.stringify(s.lk) !== r.lookJson)) { const n = r.name; r.dress(s.who, s.lk, s.nm); if (n !== r.name) changed(); }
    r.lookJson = s.who === 'bighead' ? JSON.stringify(s.lk) : '';
    r.heard = clock; r.hosting = !!s.hs;
    net.unpack?.(r, s);
    if (s.t <= r.lastT && r.lastT - s.t < 2) return;             // an older report that arrived late (or the same one again)
    r.lastT = s.t;
    // their clock on ours: the freshest report sets it, a pause on their side resets it
    const d = clock - s.t;
    if (r.off === null || d < r.off || d - r.off > 1) { if (r.off !== null && d - r.off > 1) { r.buf.length = 0; for (const g of r.cars.values()) g.buf.length = 0; } r.off = d; }
    else r.off += (d - r.off) * .01;
    const at = s.t + r.off;
    r.take(s, at);

    const seen = new Set();
    for (const cs of s.c || []) {
      if (!cs || !cs.id || taken.has(cs.id)) continue;
      const mine = owned.find(v => v.netId === cs.id);
      if (mine) {                                       // we both think it is ours: whoever is at the wheel keeps it
        if (mine.driver === 'player' || !(cs.f & 1)) continue;
        owned.splice(owned.indexOf(mine), 1); game.traffic.remove(mine);
      }
      seen.add(cs.id);
      const fresh = !r.cars.has(cs.id);
      r.car(cs, at);
      // one of the city's own parked cars: it has driven off, so our copy of it goes
      if (fresh && cs.sid !== undefined) { const twin = game.traffic.vehicles.find(v => v.sid === cs.sid && !v.ghost && !v.netId && v.driver !== 'player'); if (twin) game.traffic.remove(twin); }
    }
    for (const idc of [...r.cars.keys()]) if (!seen.has(idc)) r.dropCar(idc);
  }

  function drop(id, quiet) {
    const r = remotes.get(id); if (!r) return;
    remotes.delete(id); const i = targets.indexOf(r); if (i >= 0) targets.splice(i, 1);
    r.dispose();
    if (quiet !== true) { game.hud.toast(`${r.name.toUpperCase()} LEFT`, 'info'); changed(); }
  }

  function onEvent(from, type, d) {
    const r = remotes.get(from), p = game.player; if (!r) return;
    const near = (x, z, range) => Math.max(0, 1 - Math.hypot(x - p.x, z - p.z) / range);
    if (type === 'shot') {
      const w = WEAPONS[d?.w]; if (!w || !Array.isArray(d.m) || !Array.isArray(d.e)) return;
      const [mx, my, mz] = d.m, gfx = game.combat.gfx;
      for (let i = 0; i + 2 < d.e.length && i < 36; i += 3) gfx.tracer(mx, my, mz, d.e[i], d.e[i + 1], d.e[i + 2], w.pellets > 1 ? .014 : .022);
      gfx.flash(mx, my, mz, .35 + w.loud * .25); r.kick = w.kick * 4;
      game.audio.shot(w.loud, near(mx, mz, 140)); game.peds.scare(mx, mz, 40, 8);
    } else if (type === 'swing') { r.swingT = .3; r.swingSide ^= 1; if (near(r.x, r.z, 25) > 0) game.audio.whoosh(); }
    else if (type === 'hit') {
      if (game.over || p.mode !== 'foot' || !(d?.d > 0) || net.shielded()) return;
      lastHit = { from, at: clock };
      p.hurt(Math.min(200, d.d) * (d.hd ? COMBAT.headshot : 1)); game.cam.shake(.22);
      if (d.kn > 0 && !game.over) { p.body.setLinvel({ x: d.dx * d.kn * 1.2, y: d.dz * d.kn * 1.2 }, true); p.tumble = Math.max(p.tumble, .7); game.audio.punch(); }
    } else if (type === 'carhit') {
      const v = owned.find(o => o.netId === d?.id); if (v && d.d > 0 && !net.shielded()) { v.damage(Math.min(400, d.d)); lastHit = { from, at: clock }; }
    } else if (type === 'take') {
      const v = owned.find(o => o.netId === d?.id);
      if (v && v.driver !== 'player') { owned.splice(owned.indexOf(v), 1); game.traffic.remove(v); }
    } else if (type === 'horn') { const g = r.cars.get(d?.id); if (g) game.audio.horn(g, false); }
    else if (extra.has(type)) extra.get(type)(from, d, r);
    else if (type === 'down') {
      if (game.match?.on) return;                       // a match tells its own story
      const by = d?.by === net.id ? 'YOU' : remotes.get(d?.by)?.name.toUpperCase();
      game.hud.toast(by ? `${by} TOOK DOWN ${r.name.toUpperCase()}` : `${r.name.toUpperCase()} IS DOWN`, by === 'YOU' ? 'good' : 'info');
    }
  }

  return net;
}
