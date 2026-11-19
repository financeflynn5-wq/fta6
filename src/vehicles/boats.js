// How a boat moves. A boat is an ordinary Vehicle (vehicle.js hands its physics and drawing over to this
// file): the same body, the same controls (W/S throttle, A/D helm, Space hard astern), the same damage.
// Collisions with docks, ships and other boats are the flat physics everything else uses; the shore is felt
// here, by sounding the bottom under the hull: a beach slows a boat and slides it back, a quay wall is a crash.
// Numbers: BOAT in config.js, and each boat's own line in CAR.types.
import { BOAT, CAR, WORLD } from '../config.js';
import { clamp, damp, lerp, angleDiff } from '../core/utils.js';
import { groundY } from '../world/terrain.js';
import { WATER } from '../world/map.js';

// where the bottom is sounded, in hull lengths and widths from the middle: bow, shoulders, beam, quarters, stern
const HULL = [[1, 0], [.62, .8], [.62, -.8], [0, 1], [0, -1], [-.92, .85], [-.92, -.85], [-1, 0]];

export function createBoats(game) {
  const X1 = WORLD.LIMIT + BOAT.limit, Z0 = -WORLD.LIMIT - BOAT.limit, Z1 = WORLD.LIMIT_N + BOAT.limit;

  const boats = {
    init(v) {
      v.y = Math.max(WATER, groundY(v.x, v.z) + v.stats.draft - .1); v.vy = 0; v.air = 0; v.flying = false; v.up = false;
      v.roll = 0; v.pitch = 0; v.wakeD = 0; v.sink = 0; v.sunk = 0; v.gear = 1;
      v.mesh.rotation.order = 'YZX'; v.rideReady = true;
      game.physics.setCarMode(v.body, 4);
    },
    setHeight(v) { boats.init(v); },

    // ---------- once per physics step ----------
    preStep(v, dt) {
      const b = v.body, S = v.stats;
      if (!v.driver && b.isSleeping()) { v.speed = v.vf = v.vl = 0; v.accelLong = 0; return; }
      const lv = b.linvel(); v.h = b.rotation();
      const fx = v.fx, fz = v.fz, rx = v.rx, rz = v.rz;
      let vf = lv.x * fx + lv.y * fz, vl = lv.x * rx + lv.y * rz, w = b.angvel();
      const driven = v.driver && !v.wrecked && v.sunk < .3, c = v.controls;
      const thr = driven ? clamp(c.throttle, -1, 1) : 0, st = driven ? clamp(c.steer, -1, 1) : 0, before = vf;

      // engines
      let a = 0; v.braking = false;
      if (driven && c.handbrake && Math.abs(vf) > .3) { a = -Math.sign(vf) * BOAT.brake; v.braking = true; }
      else if (thr > 0) a = vf < -.5 ? BOAT.brake * thr : S.accel * thr * Math.max(0, 1 - (vf / S.maxSpeed) ** 2) * (vf < 6 ? 1.2 : 1);
      else if (thr < 0) a = vf > 1 ? BOAT.brake * thr : BOAT.reverseAccel * thr * Math.max(0, 1 + vf / BOAT.reverse);
      vf += a * dt;
      if (v.braking && before * vf < 0) vf = 0;
      vf -= BOAT.drag * vf * Math.abs(vf) * dt; if (thr === 0) vf *= Math.max(0, 1 - BOAT.coast * dt);
      // the keel holds it straight, less so the faster it planes
      const sp = clamp(Math.abs(vf) / S.maxSpeed, 0, 1);
      vl *= Math.max(0, 1 - lerp(BOAT.keel, BOAT.keelFast, sp) * dt);
      // helm: bites with speed through the water; the props swing the stern even at a standstill
      v.steer = damp(v.steer, st, 7, dt);
      const way = clamp(vf / BOAT.turnAt, -1, 1), bite = way * lerp(1, .72, sp) + thr * .4 * (1 - Math.abs(way));
      w = damp(w, v.steer * S.turn * bite, driven ? 3.5 : 1.2, dt);

      // the shore
      let vx = fx * vf + rx * vl, vz = fz * vf + rz * vl, hit = 0, pushX = 0, pushZ = 0;
      const keel = WATER - S.draft, hl = v.halfLen, hw = v.halfWid;
      for (const [ol, ow] of HULL) {
        const px = v.x + fx * ol * hl + rx * ow * hw, pz = v.z + fz * ol * hl + rz * ow * hw, pen = groundY(px, pz) - keel;
        if (pen <= 0) continue;
        // which way does the bottom fall away?
        const e = .7, gx = groundY(px + e, pz) - groundY(px - e, pz), gz = groundY(px, pz + e) - groundY(px, pz - e), gl = Math.hypot(gx, gz);
        let nx, nz;
        if (gl > .03) { nx = -gx / gl; nz = -gz / gl; } else { const d = Math.hypot(px - v.x, pz - v.z) || 1; nx = (v.x - px) / d; nz = (v.z - pz) / d; }
        const wall = pen > BOAT.hardHit && gl > .5, into = -(vx * nx + vz * nz);
        if (into > 0) { const k = wall ? 1.25 : Math.min(1, pen * 2.5); vx += nx * into * k; vz += nz * into * k; if (wall && into > hit) hit = into; }
        const p = Math.min(1, pen) * BOAT.beach * dt; pushX += nx * p; pushZ += nz * p;
      }
      vx += pushX; vz += pushZ;
      // the open sea goes on, but not for ever
      if (v.x > X1) vx -= (v.x - X1) * .5 * dt * 10; if (v.z < Z0) vz += (Z0 - v.z) * .5 * dt * 10; if (v.z > Z1) vz -= (v.z - Z1) * .5 * dt * 10;
      if (hit > CAR.damageMin) { v.damage((hit - CAR.damageMin) * CAR.damageScale * (v.driver === 'player' ? .75 : 1)); game.onCrash(v, hit); }

      vf = vx * fx + vz * fz; vl = vx * rx + vz * rz;
      v.slip = Math.abs(vl); v.sliding = false;
      v.accelLong = damp(v.accelLong, (vf - before) / dt, 6, dt);
      v.vf = vf; v.vl = vl; v.omega = w;
      v._set.x = vx; v._set.y = vz;
      const moving = driven || Math.abs(vf) > .06 || Math.abs(vl) > .06 || Math.abs(w) > .02;
      if (moving) { b.setLinvel(v._set, true); b.setAngvel(w, true); }
      else { v._set.x = v._set.y = 0; b.setLinvel(v._set, false); b.setAngvel(0, false); }
      // a wreck burns, then goes down
      if (v.wrecked) { v.sink += dt; if (v.sink > BOAT.sinkTime) v.sunk = Math.min(2.2, v.sunk + dt * .22); }
      v.rpm = damp(v.rpm, driven ? clamp(.2 + .5 * Math.abs(thr) + .45 * sp, 0, 1.1) : 0, 5, dt);
    },

    // ---------- once per drawn frame ----------
    syncVisual(v, dt, t) {
      const m = v.mesh, u = m.userData, S = v.stats, k = dt ? game.alpha ?? 1 : 1;
      const x = v.ix = lerp(v.px, v.x, k), z = v.iz = lerp(v.pz, v.z, k), h = v.ih = v.ph + angleDiff(v.h, v.ph) * k;
      const sp = clamp(Math.abs(v.vf) / S.maxSpeed, 0, 1), calm = 1 - sp * .7;
      // rides on the swell, lifts onto the plane, or sits on the sand
      let y = WATER + Math.sin(t * 1.7 + v.x * .31 + v.z * .17) * BOAT.bob * calm + BOAT.lift * sp * sp - v.sunk;
      const g = groundY(x, z); if (v.sunk < .1 && g + S.draft - .12 > y) y = g + S.draft - .12;
      v.y = dt ? damp(v.y, y, 7, dt) : y;
      const trim = clamp(v.accelLong * .012, -.05, .09) + BOAT.trim * (.6 * Math.sin(Math.min(1, sp * 1.7) * Math.PI) + .3 * sp) + Math.sin(t * 1.3 + v.z * .2) * .014 * calm;
      const bank = clamp(v.vf * v.omega * BOAT.lean, -BOAT.leanMax, BOAT.leanMax) + Math.sin(t * 1.1 + v.x * .4) * .022 * calm + (v.sunk > 0 ? Math.min(.5, v.sunk * .4) : 0);
      v.pitch = dt ? damp(v.pitch, trim + (v.sunk > 0 ? -Math.min(.35, v.sunk * .3) : 0), 4, dt) : trim; v.roll = dt ? damp(v.roll, bank, 5, dt) : bank;
      m.position.set(x, v.y, z); m.rotation.set(v.roll, -h, v.pitch);
      if (!dt) return;
      for (const e of u.engines) e.rotation.y = v.steer * .5;
      u.tail.emissiveIntensity = .6 + game.env.tailBase * .6;
      if (u.bar) { const on = v.siren ? Math.floor(t * 7) % 2 : -1; u.bar[0].material.emissiveIntensity = on === 1 ? 5 : 0; u.bar[1].material.emissiveIntensity = on === 0 ? 5 : 0; }

      // foam: a churned trail from the stern, bow waves peeling off either side, spray when it really moves
      const p = game.player, near = Math.abs(x - p.x) < 240 && Math.abs(z - p.z) < 240;
      if (near && BOAT.wake && v.sunk < .4 && g < WATER - .1) {
        const fx = Math.cos(h), fz = Math.sin(h), speed = Math.abs(v.vf);
        v.wakeD += (speed + Math.abs(v.omega) * 2) * dt;
        if (v.wakeD > .7 && speed > 1) {
          v.wakeD = 0;
          const sx = x + fx * u.stern * .92, sz = z + fz * u.stern * .92, wide = v.halfWid, life = 1.6 + sp * 2.6;
          game.wake.foam(sx, sz, wide * (1.5 + sp), life, 1.1 + sp * 1.6, .55 + sp * .45, v.vx * .08, v.vz * .08);
          if (speed > 4) for (const s of [-1, 1]) {
            const bx = x + fx * v.halfLen * (.35 - sp * .25) - fz * s * wide * .9, bz = z + fz * v.halfLen * (.35 - sp * .25) + fx * s * wide * .9;
            game.wake.foam(bx, bz, .9 + sp, life * .8, 1.4, .35 + sp * .4, -fz * s * (1.5 + sp * 3) + v.vx * .15, fx * s * (1.5 + sp * 3) + v.vz * .15);
          }
        }
        if (sp > .3 && Math.random() < dt * (6 + sp * 22)) {
          const s = Math.random() < .5 ? -1 : 1, at = v.halfLen * (.15 + Math.random() * .3);
          game.fx.smoke(x + fx * at - fz * s * v.halfWid, WATER + .25, z + fz * at + fx * s * v.halfWid, 1, .5 + sp * .7, .35 + sp * .3, v.vx * .55 - fz * s * 3, v.vz * .55 + fx * s * 3, { alpha: .5, rise: 1.2 });
        }
      }
      if (v.sunk < .5) v.engineSmoke(dt, u.engines.length ? u.stern * .96 : 0, u.engines.length ? .95 : .7);
    },

    // Where someone can step out to: the nearest dry footing beside the boat (a dock, the beach), else over the side.
    exitSpots(v) {
      const out = [], side = v.halfWid + .8;
      for (const reach of [side, side + .9, side + 1.9]) for (const s of [-1, 1]) for (const along of [0, -.5, .5]) {
        const ox = v.rx * s * reach + v.fx * along * v.halfLen, oz = v.rz * s * reach + v.fz * along * v.halfLen;
        if (groundY(v.x + ox, v.z + oz) > WATER - .15) out.push([ox, oz]);
      }
      out.push([-v.rx * side, -v.rz * side], [v.rx * side, v.rz * side]);
      return out;
    },
    canExit: () => true,
  };
  return boats;
}
