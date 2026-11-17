// Traffic on the elevated roads (world/highway.js): fast cars that follow the highway's lanes,
// street traffic that takes a ramp up, drivers that take an exit back down, and police who can
// follow you up there.
//   follow(driver)   aim point and speed for an AIDriver in 'lane' mode (aiDriver.js calls this)
//   pursue(driver)   the same for a cruiser on the highway, or where a cruiser on the street should
//                    head to get up to you
import { TRAFFIC } from '../config.js';
import { clamp, angleDiff, choose } from '../core/utils.js';
import { laneS, lanePoint } from '../world/highway.js';
import { nearestRoadLeg } from '../world/roads.js';
import { groundY, layer } from '../world/terrain.js';
import { AIDriver } from './aiDriver.js';
import { makeCharacter, CIVILIANS } from '../characters/models.js';

const H = TRAFFIC.highway;
const EXIT_PLAN = 90, EXIT_BRAKE = 4;       // metres before an exit a driver decides to take it, and how gently they slow for it (m/s^2)
const TURN_ROOM = 45;                      // metres past an exit a cruiser going the other way turns round, to come back to it

export function createHighwayTraffic(game) {
  const hw = game.city.highway, here = {}, tgt = {}, spot = {};
  const cars = game.traffic.vehicles;
  let scanT = 0;

  function pickType() {
    let total = 0; for (const k in H.mix) total += H.mix[k];
    let n = Math.random() * total; for (const k in H.mix) { n -= H.mix[k]; if (n < 0) return k; }
    return 'car';
  }
  const fwdGap = (L, from, to) => L.loop ? (((to - from) % L.len) + L.len) % L.len : to - from;

  // Move the driver's place on its lane up to where the car is now. False when the lane has run out.
  function track(d) {
    const v = d.v; let L = d.lane, s = d.s;
    lanePoint(L, s, here); let best = Math.hypot(here.x - v.x, here.z - v.z);
    for (let k = 0; k < 10; k++) {
      lanePoint(L, s + 1.5, tgt); const dd = Math.hypot(tgt.x - v.x, tgt.z - v.z);
      if (dd < best) { s += 1.5; best = dd; } else break;
    }
    if (L.loop) s = ((s % L.len) + L.len) % L.len;
    else if (s >= L.len - 1) {
      if (!L.next) return false;
      s = L.next.s + s - L.len; L = d.lane = L.next.lane;
    }
    d.s = s; d.off = best;
    return true;
  }
  // The exit a driver on this lane is passing right now, if any.
  function exitHere(d) {
    const L = d.lane;
    for (const ex of L.exits) if (fwdGap(L, d.s, ex.s) < 4) return ex;
    return null;
  }
  // Which exit should a cruiser on the Loop leave by to reach the player? None while the player is on the Loop too.
  //   - the player is on one of the roads that leave the Loop (Highway 6, a ramp): that one
  //   - the player is down on the streets: the exit that makes the shortest trip, counting the way round to it
  function wayOff(d, p, up) {
    const M = hw.main[0], v = d.v, sameWay = d.lane === M || d.lane === M.side;
    lanePoint(M, laneS(M, p.x, p.z), spot); const onMain = Math.abs(spot.y - p.y) < 2.5 ? Math.hypot(spot.x - p.x, spot.z - p.z) : 1e9;
    for (const ex of M.exits) {
      const s = laneS(ex.to, p.x, p.z); if (s < 10) continue;
      lanePoint(ex.to, s, spot);
      const far = Math.hypot(spot.x - p.x, spot.z - p.z);
      if (far < 5 && far + 2 < onMain && Math.abs(spot.y - p.y) < 2.5) return ex;
    }
    if (up) return null;
    let best = null, bd = 1e9; const at = laneS(M, v.x, v.z);
    for (const ex of M.exits) {
      const e = ex.to.pts[ex.to.pts.length - 1];
      const round = fwdGap(M, at, ex.s);
      // going the other way, the cruiser has to turn round: now if the exit is close behind, or else once it has passed it
      const way = sameWay ? round : (round < M.len * .5 ? Math.max(round, TURN_ROOM) : M.len - round + TURN_ROOM) + 60;
      const c = way + ex.to.len + Math.hypot(e.x - p.x, e.z - p.z) * 1.3;
      if (c < bd) { bd = c; best = ex; }
    }
    return best;
  }
  // Gap to whatever is in the way ahead on the same level, and how fast it is going our way.
  function ahead(v, reach) {
    let gap = 999, lead = 0, who = null;
    for (const o of cars) {
      if (o === v) continue;
      const dx = o.x - v.x, dz = o.z - v.z; if (Math.abs(dx) > reach || Math.abs(dz) > reach || Math.abs(o.y - v.y) > 3) continue;
      const lx = dx * v.fx + dz * v.fz, lz = dx * v.rx + dz * v.rz, room = v.halfLen + o.halfLen + .3;
      if (lx > 0 && Math.abs(lz) < Math.max(1.75, v.halfWid + o.halfWid - .1) && lx - room < gap) { gap = lx - room; who = o; lead = o.vx * v.fx + o.vz * v.fz; }
    }
    const p = game.player;
    if (p.mode === 'foot' && Math.abs(p.y - v.y) < 3) { const [lx, lz] = v.local(p.x, p.z); if (lx > 0 && lx < reach && Math.abs(lz) < v.halfWid + .6 && lx - v.halfLen - .8 < gap) { gap = lx - v.halfLen - .8; who = p; lead = 0; } }
    return [gap, Math.max(0, lead), who];
  }
  // Is the lane next door clear beside and just behind/ahead of this car?
  function sideClear(v, side) {
    const s = laneS(side, v.x, v.z); lanePoint(side, s, spot);
    for (const o of cars) {
      if (o === v || Math.abs(o.y - v.y) > 3) continue;
      const dx = o.x - spot.x, dz = o.z - spot.z, lx = dx * v.fx + dz * v.fz, lz = dx * v.rx + dz * v.rz;
      if (lx > -16 - o.speed * .5 && lx < 22 && Math.abs(lz) < 2.2) return -1;
    }
    return s;
  }
  function join(d, L, s) { d.mode = 'lane'; d.lane = L; d.s = s; d.pace = d.pace || .82 + Math.random() * .3; d.swap = 2; d.lastExit = null; }
  function leave(d) { d.lane = null; d.resumeCruise(); }

  function spawn(minDist) {
    const p = game.player;
    for (let tries = 0; tries < 14; tries++) {
      const L = choose(hw.main), s = Math.random() * L.len; lanePoint(L, s, spot);
      const far = Math.hypot(spot.x - p.x, spot.z - p.z);
      if (far < minDist || far > TRAFFIC.near) continue;
      if (cars.some(o => Math.abs(o.x - spot.x) < 16 && Math.abs(o.z - spot.z) < 16 && Math.abs(o.y - spot.y) < 3)) continue;
      const type = pickType(), v = game.traffic.add(type, spot.x, spot.z, spot.h); v.temp = true;
      game.ride.setHeight(v, spot.y);
      const leg = nearestRoadLeg(spot.x, spot.z, Math.cos(spot.h), Math.sin(spot.h)), d = new AIDriver(game, v, leg.from, leg.to);
      join(d, L, s);
      const sp = Math.min(L.speed * d.pace * (v.stats.cruise ?? 1), spot.v);
      v.body.setLinvel({ x: Math.cos(spot.h) * sp, y: Math.sin(spot.h) * sp }, true);
      if (v.stats.rider) { d.kind = choose(CIVILIANS); v.seat(makeCharacter(d.kind)); game.env?.touch(); }
      return v;
    }
    return null;
  }

  // The lane nearest a car that runs roughly the way it is facing (for a cruiser that finds itself up here).
  function laneFor(v) {
    let best = null, bd = 9, bs = 0;
    for (const L of hw.lanes) {
      const s = laneS(L, v.x, v.z); lanePoint(L, s, spot);
      if (Math.abs(spot.y - v.y) > 2.5) continue;
      const d = Math.hypot(spot.x - v.x, spot.z - v.z) + (1 - Math.cos(angleDiff(spot.h, v.h))) * 4;
      if (d < bd) { bd = d; best = L; bs = s; }
    }
    return best ? [best, bs] : null;
  }

  const highway = {
    plan: hw,
    count: () => cars.reduce((n, v) => n + (v.driver instanceof AIDriver && v.driver.mode === 'lane' && v.type !== 'police' && !v.wrecked ? 1 : 0), 0),
    playerUp: false,          // is the player up on the highway? (checked a few times a second)

    init() { for (let i = 0; i < H.count; i++) spawn(70); },

    // ---------- a driver in 'lane' mode ----------
    follow(d, dt, t) {
      const v = d.v;
      if (!track(d) || (!v.up && here.y - v.y > 3)) {                 // off the end of a ramp (or knocked off the road): back to street driving
        leave(d); return d.cruise(dt, t);
      }
      let L = d.lane;
      // an exit coming up: some take it. They make up their minds well before it, so there is room to slow down for a tight one
      let slow = 1e9, near = false;
      for (const ex of L.exits) {
        const gap = fwdGap(L, d.s, ex.s); if (gap < 0 || gap > EXIT_PLAN) continue;
        near = true;
        if (d.lastExit !== ex) { d.lastExit = ex; d.takeExit = Math.random() < ex.p ? ex : null; }
        if (d.takeExit !== ex) continue;
        if (gap < 4) { L = d.lane = ex.to; d.s = 0; d.takeExit = null; }
        else { lanePoint(ex.to, 8, tgt); slow = Math.sqrt(tgt.v * tgt.v + 2 * EXIT_BRAKE * gap); }
      }
      if (!near) d.lastExit = d.takeExit = null;

      const cruise = Math.min(L.speed * d.pace * (v.stats.cruise ?? 1), v.stats.maxSpeed * .9);
      lanePoint(L, d.s + 5 + v.speed * .55, tgt); const aimX = tgt.x, aimZ = tgt.z;
      let want = Math.min(cruise, tgt.v, slow);
      lanePoint(L, d.s + 10 + v.speed * 1.3, tgt); want = Math.min(want, tgt.v + 3);          // ease off before a bend
      const [gap, lead, who] = ahead(v, 70);
      const follow = lead + clamp((gap - 5 - v.speed * .25) * .8, -8, 30);
      if (follow < want) {
        // held up: move over if the next lane is free
        if ((d.swap -= dt) <= 0 && L.side && gap < 30 && who !== game.player && lead < cruise - 3) {
          d.swap = 1.5; const s = sideClear(v, L.side);
          if (s >= 0) { d.lane = L.side; d.s = s; d.swap = 5; }
        }
        want = Math.max(0, follow);
        if (gap < 2.5) want = 0;
        if (gap < 3 && v.speed < .5 && (who === game.player || who?.driver === 'player') && (d.honk -= dt) <= 0) { d.honk = 2.2 + Math.random() * 2; game.honk(v); }
      }
      d.nudge = 0;
      return [aimX, aimZ, want];
    },

    // A driver told to go back to ordinary driving while still up here keeps to the lanes until an exit.
    resume(d) {
      if (!d.v.up) return false;
      const f = d.lane ? [d.lane, d.s] : laneFor(d.v); if (!f) return false;
      join(d, f[0], f[1]); return true;
    },

    // ---------- police ----------
    // For a cruiser in pursuit. Returns [aimX, aimZ, speed] while it is driving a lane, { x, z } to send it to
    // the foot of a ramp, or null to chase as usual.
    pursue(d, dt) {
      const v = d.v, p = game.player, up = highway.playerUp;
      if (!d.lane) {
        if (v.up && (d.laneT = (d.laneT || 0) - dt) <= 0) { d.laneT = .6; const f = laneFor(v); if (f) { d.lane = f[0]; d.s = f[1]; } }
        if (!d.lane) {
          if (!up || v.up) return null;
          // the player is up there and we are not: head for the nearest way up
          let best = null, bd = 1e9;
          for (const E of hw.entries) { const c = Math.hypot(E.entry.x - v.x, E.entry.z - v.z) + Math.hypot(E.entry.x - p.x, E.entry.z - p.z) * .6; if (c < bd) { bd = c; best = E; } }
          const e = best.entry, dist = Math.hypot(e.x - v.x, e.z - v.z);
          if (dist < 7) { d.lane = best; d.s = laneS(best, v.x, v.z); }
          else { spot.x = e.x - Math.cos(e.h) * 5; spot.z = e.z - Math.sin(e.h) * 5; return spot; }
        }
      }
      if (!track(d) || (!v.up && here.y - v.y > 3)) { d.lane = null; return null; }
      let L = d.lane;
      const dist = Math.hypot(p.x - v.x, p.z - v.z), level = Math.abs(p.y - v.y) < 2.5;
      if (up && level && dist < 34 && v.up && !(L.main && d.wayOff)) return null;      // close enough to go straight at them (not across the rails of a fork)
      if ((d.planT = (d.planT || 0) - dt) <= 0) {
        d.planT = .7;
        d.wayOff = L.main ? wayOff(d, p, up) : null;
        if (d.wayOff) {
          // they have left the Loop: get into the lane the exits are on. A cruiser going the other way carries on
          // until it is just past the exit, and turns round there
          const M = hw.main[0], at = laneS(M, v.x, v.z), past = fwdGap(M, at, d.wayOff.s);
          if (L === M.side || (L !== M && past > TURN_ROOM && past < M.len * .5)) { d.lane = L = M; d.s = at; }
        } else if (L.main) {
          // the short way round to them: carry on, or turn round and use the lanes going the other way
          const gap = fwdGap(L, d.s, laneS(L, p.x, p.z));
          if (gap > L.len * .55) { const o = hw.main[(hw.main.indexOf(L) + 2) % 4]; d.lane = o; d.s = laneS(o, v.x, v.z); L = o; }
        }
      }
      const ex = exitHere(d);
      if (ex && ex === d.wayOff) { L = d.lane = ex.to; d.s = 0; d.wayOff = null; }
      lanePoint(L, d.s + 5 + v.speed * .55, tgt); const aimX = tgt.x, aimZ = tgt.z;
      let want = Math.min(d.maxSpeed, tgt.v * 1.25 + 2);
      lanePoint(L, d.s + 10 + v.speed * 1.3, tgt); want = Math.min(want, tgt.v * 1.25 + 5);
      // weave past traffic instead of queueing behind it
      const [gap, lead, who] = ahead(v, 60);
      d.nudge = 0;
      if (who && who !== p.vehicle && gap < 26) {
        if ((d.swap = (d.swap || 0) - dt) <= 0 && L.side) { d.swap = .8; const s = sideClear(v, L.side); if (s >= 0) { d.lane = L.side; d.s = s; d.swap = 2.5; } }
        want = Math.min(want, lead + Math.max(0, gap - 3) * 1.2);
      }
      d.slide = false; d.direct = true;
      return [aimX, aimZ, want];
    },
    // A fresh cruiser on the highway, ahead of or behind the player (police.js asks when the player is up here).
    spawnCop() {
      if (!highway.playerUp) return null;
      const p = game.player;
      for (let tries = 0; tries < 12; tries++) {
        const L = choose(hw.main), s = Math.random() * L.len; lanePoint(L, s, spot);
        const far = Math.hypot(spot.x - p.x, spot.z - p.z);
        if (far < 120 || far > 260) continue;
        if (fwdGap(L, s, laneS(L, p.x, p.z)) > L.len * .5) continue;           // must be coming our way
        if (cars.some(o => Math.abs(o.x - spot.x) < 14 && Math.abs(o.z - spot.z) < 14 && Math.abs(o.y - spot.y) < 3)) continue;
        const v = game.traffic.add('police', spot.x, spot.z, spot.h); v.temp = true; game.ride.setHeight(v, spot.y);
        const leg = nearestRoadLeg(spot.x, spot.z, Math.cos(spot.h), Math.sin(spot.h)), d = new AIDriver(game, v, leg.from, leg.to);
        d.lane = L; d.s = s;
        v.body.setLinvel({ x: Math.cos(spot.h) * 20, y: Math.sin(spot.h) * 20 }, true);
        return v;
      }
      return null;
    },

    // Every couple of seconds (traffic.maintain): keep the highway stocked.
    maintain() {
      const n = highway.count();
      for (let k = 0; k < 2 && n + k < H.count; k++) spawn(highway.playerUp ? 190 : 150);
    },

    update(dt) {
      if ((scanT -= dt) > 0) return; scanT = .25;
      const p = game.player, who = p.vehicle || p;
      groundY(who.x, who.z, who.y + .2); highway.playerUp = layer.up && !!layer.rib?.route;      // on a road ribbon, not a roof
      // street traffic passing the foot of a ramp may take it
      for (const v of cars) {
        const d = v.driver; if (!(d instanceof AIDriver) || d.mode !== 'cruise' || v.type === 'police' || v.wrecked) continue;
        let near = null;
        for (const E of hw.entries) if (Math.abs(E.entry.x - v.x) < 5 && Math.abs(E.entry.z - v.z) < 5 && Math.cos(angleDiff(E.entry.h, v.h)) > .8) near = E;
        if (near && d.entryRoll !== near) { d.entryRoll = near; if (Math.random() < H.rampChance && d.scared <= 0) join(d, near, laneS(near, v.x, v.z)); }
        else if (!near) d.entryRoll = null;
      }
    },
  };
  return highway;
}
