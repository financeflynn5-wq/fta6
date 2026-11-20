// The law off the road. A police helicopter that circles over you (while it has you in view the cops never
// lose you: put a building between you and it, get under a bridge, into the trees or indoors, outrun it, wait
// for it to run low on fuel, or shoot it down), and patrol boats that run you down on the water.
// They fly and float by the same rules as the craft you steal: this file only works their controls.
// police.js asks three things of it: can anyone here see the player, where should the cruisers wait while the
// player is out on the water or in the air, and stand down.
import * as THREE from 'three';
import { POLICE_CRAFT as PC, WORLD, HELI, CAMP } from '../config.js';
import { clamp, angleDiff } from '../core/utils.js';
import { groundY, ceilingY, waterDepth } from '../world/terrain.js';
import { WATER } from '../world/map.js';
import { ROAD_EDGES } from '../world/roads.js';
import { WOODS } from '../world/forest.js';

const N = WORLD.nodes;

export function createAirSea(game) {
  const units = [];           // { v, kind: 'heli' | 'boat', pilot, orbit, grab, leaving, idle, stay }   stay: seconds a helicopter has been over you
  const seen = { top: 0, wall: false, vague: false };
  let spawnT = 2, roadT = 0, heliWait = 0; const road = { x: 0, z: 0 };
  // every corner that has a road, for parking the cruisers as near the player as the streets go
  const corners = []; { const got = new Set(); for (const e of ROAD_EDGES) for (const [i, j] of [[e.i, e.j], [e.i + e.di, e.j + e.dj]]) { const k = i * 64 + j; if (!got.has(k)) { got.add(k); corners.push([N[i], N[j]]); } } }

  // ---------- the searchlight: a cone of light from the helicopter to you, after dark ----------
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff1c9, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  beamMat.userData.noAO = true;
  const beam = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 28, 1, true).translate(0, -.5, 0), beamMat), pool = new THREE.Mesh(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), beamMat);
  beam.visible = pool.visible = false; beam.renderOrder = pool.renderOrder = 4; beam.frustumCulled = pool.frustumCulled = false; game.scene.add(beam, pool);
  const DOWN = new THREE.Vector3(0, -1, 0), dir = new THREE.Vector3();

  const playerY = (p) => (p.vehicle ? p.vehicle.y : p.y);
  const afloat = (p) => p.vehicle?.stats.craft === 'boat' && waterDepth(p.x, p.z) > .4;
  const flying = (p) => p.vehicle?.stats.craft === 'heli' && p.vehicle.air > 0 && p.vehicle.y - groundY(p.x, p.z) > 4;
  const inTrees = (p) => p.x > WOODS.x0 && p.x < WOODS.x1 && p.z > WOODS.z0 && p.z < WOODS.z1 && Math.hypot(p.x - CAMP.x, p.z - CAMP.z) > CAMP.clear && !flying(p);
  const covered = (p) => !!game.indoors?.room || ceilingY(p.x, p.z, playerY(p)) < 1e8 || inTrees(p);       // indoors, under a bridge, or under the pines of Whisper Woods
  // Can the helicopter's crew see the player past the buildings? Walks the line from the player up to the helicopter;
  // anything standing taller than the line at that spot hides him (a tower, or just the wall he is pressed against).
  function clearLine(v, p) {
    const py = playerY(p) + 1.2, dx = v.x - p.x, dz = v.z - p.z, len = Math.hypot(dx, dz);
    for (let s = 1.5; s < len - 3; s += 2.5) {
      const t = s / len, x = p.x + dx * t, z = p.z + dz * t, y = py + (v.y - py) * t;
      game.physics.under(x, z, .6, y, seen);
      if (seen.wall || (seen.vague && groundY(x, z) + HELI.vague > y)) return false;
    }
    return true;
  }
  // A helicopter breaks off. Another one is a while coming.
  function peelOff(u, why) {
    u.leaving = true; heliWait = Math.max(heliWait, PC.heliAgain);
    if (why && !game.over) game.hud.toast(why, 'good');
  }

  function addHeli() {
    const p = game.player, a = Math.random() * 6.283, x = p.x + Math.cos(a) * PC.heliFrom, z = p.z + Math.sin(a) * PC.heliFrom;
    const v = game.traffic.add('policeheli', x, z, a + Math.PI); v.temp = true; v.stolen = true; v.craft.setHeight(v, WATER + PC.cruise, true);
    const pilot = { police: true }; v.driver = pilot; v.siren = true; game.env?.touch();
    units.push({ v, kind: 'heli', pilot, orbit: a, grab: 0, leaving: false, idle: 0, stay: 0 });
  }
  function addBoat() {
    const p = game.player;
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * 6.283, r = PC.boatFrom[0] + Math.random() * (PC.boatFrom[1] - PC.boatFrom[0]), x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
      let wet = true; for (let k = 0; k <= 4 && wet; k++) wet = groundY(p.x + (x - p.x) * k / 4, p.z + (z - p.z) * k / 4) < WATER - .9;       // open water all the way to you
      if (!wet || game.traffic.vehicles.some(o => Math.abs(o.x - x) < 9 && Math.abs(o.z - z) < 9)) continue;
      const v = game.traffic.add('policeboat', x, z, a + Math.PI); v.temp = true; v.stolen = true;
      const pilot = { police: true }; v.driver = pilot; v.siren = true; game.env?.touch();
      units.push({ v, kind: 'boat', pilot, orbit: 0, grab: 0, leaving: false, idle: 0, flank: (units.length % 3 - 1) * 6 });
      return;
    }
  }

  function flyHeli(u, dt) {
    const v = u.v, p = game.player, c = v.controls;
    let tx, tz, ty;
    if (u.leaving) { const d = Math.hypot(v.x - p.x, v.z - p.z) || 1; tx = v.x + (v.x - p.x) / d * 200; tz = v.z + (v.z - p.z) / d * 200; ty = WATER + PC.cruise + 20; }
    else {
      u.orbit += dt * PC.orbitRate;
      const police = game.police, chase = flying(p);
      if (police.hidden < PC.heliLag || !police.contact) {          // somebody has eyes on you: it follows
        const py = playerY(p), R = chase ? 16 : PC.orbit;
        tx = p.x + p.vx * 1.2 + Math.cos(u.orbit) * R; tz = p.z + p.vz * 1.2 + Math.sin(u.orbit) * R;
        ty = chase ? py + 7 : Math.max(py + PC.above, groundY(v.x, v.z) + PC.above + 2);
      } else {                                                      // lost you: it circles where you were last seen, wider and wider
        const lk = police.lastKnown, R = PC.orbit + Math.min((police.hidden - PC.heliLag) * PC.searchGrow, PC.searchMax);
        tx = lk.x + Math.cos(u.orbit) * R; tz = lk.z + Math.sin(u.orbit) * R;
        ty = Math.max(groundY(lk.x, lk.z), groundY(v.x, v.z)) + PC.above + 2;
      }
      if (Math.hypot(tx - v.x, tz - v.z) > 130) ty = Math.max(ty, WATER + PC.cruise);              // far off: come in high, over the towers
    }
    const dx = tx - v.x, dz = tz - v.z, d = Math.hypot(dx, dz), off = angleDiff(Math.atan2(dz, dx), v.h);
    c.steer = clamp(off * 1.8, -1, 1);
    c.throttle = clamp(d * .045, 0, 1) * Math.max(0, Math.cos(off)) * (u.leaving ? .8 : flying(p) ? PC.heliPaceAir : PC.heliPace);
    c.lift = clamp((ty - v.y) / 5, -1, 1);
    // something tall ahead: stop and climb over it
    game.physics.under(v.x + v.vx * 1.4, v.z + v.vz * 1.4, 5, v.y - 3, seen);
    if (seen.wall || seen.vague || groundY(v.x + v.vx * 1.4, v.z + v.vz * 1.4) > v.y - 6) { c.lift = 1; c.throttle = Math.min(c.throttle, .1); }
    v.siren = !u.leaving;
  }

  function sailBoat(u, dt) {
    const v = u.v, p = game.player, c = v.controls, stars = game.police.stars;
    const wet = afloat(p) || (p.mode === 'foot' && waterDepth(p.x, p.z) > .5);
    u.idle = wet ? 0 : u.idle + dt;
    const dist = Math.hypot(p.x - v.x, p.z - v.z), lead = clamp(dist / 28, 0, 1.2);
    let tx = p.x + p.vx * lead, tz = p.z + p.vz * lead;
    if (dist > 25 && stars >= 2 && p.speed > 3) { tx += -p.vz / (p.speed + 1) * u.flank; tz += p.vx / (p.speed + 1) * u.flank; }
    const off = angleDiff(Math.atan2(tz - v.z, tx - v.x), v.h);
    let steer = clamp(off * 1.8, -1, 1), thr = Math.cos(off) > .1 ? 1 : .45;
    thr *= [0, .8, .88, .95, 1, 1][stars] ?? 1;
    // shallows ahead: turn for the deeper side
    const look = 7 + v.speed * .9, shoal = (a) => groundY(v.x + Math.cos(v.h + a) * look, v.z + Math.sin(v.h + a) * look) > WATER - .85;
    if (shoal(0) || shoal(.3) || shoal(-.3)) { const l = shoal(-.9), r = shoal(.9); steer = l && !r ? 1 : r && !l ? -1 : steer >= 0 ? 1 : -1; thr = Math.min(thr, v.speed > 8 ? -.5 : .45); }
    const slow = p.speed < 3;
    if (!wet || (dist < 9 && slow) || game.over) { thr = 0; c.handbrake = v.speed > 2; } else c.handbrake = false;
    if (stars < 2 && dist < 14) thr = Math.min(thr, .4);                 // one star: they pull alongside, they don't ram
    c.steer = steer; c.throttle = thr; v.siren = true;
    // alongside a boat that has stopped (or someone in the water): you're nicked
    const reach = dist < (p.mode === 'foot' ? 5.5 : 8.5) && slow && wet && !game.over;
    u.grab = reach ? u.grab + dt : Math.max(0, u.grab - dt * 2);
    if (u.grab > PC.grab) { u.grab = 0; game.busted(); }
  }

  function retire(u, drift) {
    const i = units.indexOf(u); if (i >= 0) units.splice(i, 1);
    const v = u.v; if (v.gone) return;
    v.siren = false;
    if (v.driver === u.pilot) { if (drift) { v.driver = null; v.controls.throttle = 0; v.controls.steer = 0; v.controls.lift = 0; v.stolen = false; } else game.traffic.remove(v); }
  }

  const airSea = {
    units,
    owns: (v) => units.some(u => u.v === v),
    // police.js: is something of ours looking at the player?
    sees() {
      const p = game.player;
      for (const u of units) {
        if (u.v.wrecked || u.leaving) continue;
        const d = Math.hypot(u.v.x - p.x, u.v.z - p.z);
        if (u.kind === 'boat') { if (d < PC.boatSight) return true; continue; }
        // a helicopter that has lost you has to come close to find you again
        const lost = game.police.contact && game.police.hidden > PC.heliLag;
        if (d < (lost ? PC.heliSpot : PC.heliSight) && !covered(p) && clearLine(u.v, p)) return true;
      }
      return false;
    },
    // police.js: the player is out of the cruisers' reach (afloat or airborne): the nearest street corner to wait at, or null
    offRoad() {
      const p = game.player; if (!afloat(p) && !flying(p)) return null;
      if (game.time > roadT) {
        roadT = game.time + .7; let bd = 1e9;
        for (const [x, z] of corners) { const d = Math.hypot(x - p.x, z - p.z); if (d < bd && groundY(x, z) > WATER + .2) { bd = d; road.x = x; road.z = z; } }
      }
      return road;
    },
    standDown() { for (const u of units.slice()) { if (u.kind === 'heli') u.leaving = true; else retire(u, true); } },
    // main.js: one of ours was wrecked
    wrecked(v) {
      const u = units.find(o => o.v === v); if (!u) return false;
      retire(u, true); v.driver = null; if (u.kind === 'heli') heliWait = Math.max(heliWait, PC.heliAgain);
      if (Math.hypot(v.x - game.player.x, v.z - game.player.z) < 160) { game.addMoney(u.kind === 'heli' ? PC.heliPay : PC.boatPay); game.hud.toast(u.kind === 'heli' ? `CHOPPER DOWN  +$${PC.heliPay}` : `PATROL BOAT SUNK  +$${PC.boatPay}`, 'good'); game.police.crime(30, 0); }
      return true;
    },
    sirenLevel(best = 0) { const p = game.player; for (const u of units) if (u.v.siren && u.kind === 'boat') best = Math.max(best, clamp(1 - Math.hypot(u.v.x - p.x, u.v.z - p.z) / 110, 0, 1)); return best; },

    update(dt) {
      const p = game.player, stars = game.police.stars;
      for (const u of units.slice()) {
        const v = u.v;
        if (v.gone || v.driver !== u.pilot) { retire(u, false); continue; }                      // cleared away, or the player took it
        if (u.kind === 'heli') {
          flyHeli(u, dt);
          if (u.leaving) { if (Math.hypot(v.x - p.x, v.z - p.z) > 300) retire(u, false); }
          else if (stars > 0 && !game.over) {
            if (Math.hypot(v.x - p.x, v.z - p.z) < PC.heliSight) u.stay += dt;
            if (game.police.contact && game.police.hidden > PC.heliGiveUp) peelOff(u, u.stay > 0 ? 'CHOPPER LOST YOU' : null);
            else if (PC.heliStay > 0 && u.stay > PC.heliStay) peelOff(u, 'CHOPPER LOW ON FUEL');
          }
        }
        else { sailBoat(u, dt); if (u.idle > PC.giveUp) retire(u, true); }
      }
      if (stars === 0 || game.over) { if (units.length && stars === 0) airSea.standDown(); beam.visible = pool.visible = false; return; }
      heliWait -= dt;
      if ((spawnT -= dt) <= 0) {
        spawnT = 3;
        const helis = units.filter(u => u.kind === 'heli' && !u.leaving).length, boats = units.filter(u => u.kind === 'boat').length;
        const wantHeli = stars >= (flying(p) || afloat(p) ? PC.heliStarsOff : PC.heliStars) ? (stars >= 5 ? 2 : 1) : 0;
        if (helis < wantHeli && heliWait <= 0 && game.police.contact) addHeli();
        else if (afloat(p) && boats < PC.boats[stars]) addBoat();
      }
      // the searchlight of the nearest helicopter that has you
      let lit = null, ld = PC.heliSight;
      const night = clamp(((game.env.night ?? 0) - .25) / .4, 0, 1);
      if (night > 0 && !covered(p) && game.police.hidden < PC.heliLag) for (const u of units) { if (u.kind !== 'heli' || u.leaving || u.v.wrecked) continue; const d = Math.hypot(u.v.x - p.x, u.v.z - p.z); if (d < ld) { ld = d; lit = u.v; } }
      beam.visible = pool.visible = !!lit;
      if (lit) {
        const sx = lit.ix + Math.cos(lit.ih) * 1.7, sy = lit.y + .5, sz = lit.iz + Math.sin(lit.ih) * 1.7, gy = playerY(p) + .12;
        dir.set(p.ix - sx, gy - sy, p.iz - sz); const len = dir.length(); dir.divideScalar(len);
        beam.position.set(sx, sy, sz); beam.quaternion.setFromUnitVectors(DOWN, dir); beam.scale.set(len * .11, len, len * .11);
        pool.position.set(p.ix, gy, p.iz); pool.scale.setScalar(len * .11 * 1.05);
        beamMat.opacity = .13 * night;
      }
    },
  };
  return airSea;
}
