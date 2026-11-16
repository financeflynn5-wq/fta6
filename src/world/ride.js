// How cars sit on the land. Collisions are still flat (2D); this adds the third dimension:
// cars follow slopes, get pulled downhill, leave the ground over crests and ramps, land
// with a thump, bounce off ledges too tall to climb, and stall in deep water.
// vehicle.js calls preStep() once per physics step and place() once per drawn frame.
import { CAR, RIDE } from '../config.js';
import { clamp, damp } from '../core/utils.js';
import { groundY, surfaceAt } from './terrain.js';
import { WATER } from './map.js';

const AXLE = 1.4, TRACK = .86, DUSTY = { dirt: 1, scrub: 1, sand: 1 };

export function createRide(game) {
  const vel = { x: 0, y: 0 }, pos = { x: 0, y: 0 };
  const listeners = { takeoff: [], land: [], splash: [] };
  const emit = (name, v, info) => { for (const fn of listeners[name]) fn(v, info); };

  function init(v) {
    v.gf = groundY(v.x + v.fx * AXLE, v.z + v.fz * AXLE); v.gr = groundY(v.x - v.fx * AXLE, v.z - v.fz * AXLE);
    v.y = (v.gf + v.gr) / 2; v.vy = 0; v.air = 0; v.sus = 0; v.slope = 0; v.tiltP = 0; v.tiltR = 0; v.qx = v.x; v.qz = v.z; v.wet = false;
    v.mesh.rotation.order = 'YZX'; v.rideReady = true;
  }

  function land(v, g, groundVy) {
    const impact = Math.max(0, groundVy - v.vy), jump = v.jump;
    const info = { time: v.air, impact, dist: jump ? Math.hypot(v.x - jump.x, v.z - jump.z) : 0, height: jump ? jump.top - Math.max(jump.y, g) : 0, from: jump, x: v.x, z: v.z };
    v.air = 0; v.y = g; v.vy = groundVy; v.sus = 0; v.jump = null;
    if (impact > RIDE.hardLanding) v.damage((impact - RIDE.hardLanding) * RIDE.landingDamage);
    if (info.time > .25) {
      const near = Math.hypot(v.x - game.player.x, v.z - game.player.z) < 60;
      if (near) { game.audio.crash(clamp(impact / 22, .08, .7)); if (impact > 5) game.fx.spark(v.x, g + .3, v.z, 4 + Math.round(impact * .5), .7); }
      if (v.driver === 'player') game.cam.shake(clamp(impact * .035, .08, .6));
    }
    emit('land', v, info);
  }

  const ride = {
    on(name, fn) { listeners[name].push(fn); },

    // Returns true while the car is in the air (vehicle.js then skips its tyre maths).
    preStep(v, dt) {
      if (!v.rideReady) init(v);
      const b = v.body, fx = v.fx, fz = v.fz, x = v.x, z = v.z;
      const gf = groundY(x + fx * AXLE, z + fz * AXLE), gr = groundY(x - fx * AXLE, z - fz * AXLE), g = (gf + gr) / 2;
      const gPrev = (v.gf + v.gr) / 2, groundVy = clamp((g - gPrev) / dt, -40, 40);

      if (v.air > 0) {                      // flying: gravity only, the tyres can't do anything
        const pf = v.gf, pr = v.gr;
        v.air += dt; v.vy -= RIDE.gravity * dt; v.y += v.vy * dt; v.gf = gf; v.gr = gr;
        if (v.jump && v.y > v.jump.top) v.jump.top = v.y;
        const lv = b.linvel(); vel.x = lv.x; vel.y = lv.y; b.setLinvel(vel, true); b.setAngvel(b.angvel() * (1 - .8 * dt), true);
        v._set.x = vel.x; v._set.y = vel.y;                       // nothing unexpected happened, so no crash is counted
        v.vf = vel.x * fx + vel.y * fz; v.vl = vel.x * v.rx + vel.y * v.rz; v.sliding = false; v.braking = false; v.slip = 0;
        if (v.air > .12 && !v.flying && v.y - g > 1.3) { v.flying = true; game.physics.setFlying(b, true); }   // clear of low walls, boxes and other cars
        if (v.y <= g) {
          if (g - v.y > 1 && (gf - pf > RIDE.ledge || gr - pr > RIDE.ledge)) {     // flew into the side of something tall: bounce off and keep falling
            pos.x = v.qx; pos.y = v.qz; b.setTranslation(pos, true); vel.x *= -.25; vel.y *= -.25; b.setLinvel(vel, true); v._set.x = vel.x; v._set.y = vel.y;
            v.gf = pf; v.gr = pr; v.x = v.qx; v.z = v.qz; v.damage(Math.hypot(vel.x, vel.y) * 6); game.onCrash(v, Math.hypot(vel.x, vel.y) * 4);
            return true;
          }
          if (v.flying) { v.flying = false; game.physics.setFlying(b, false); }
          land(v, g, Math.abs(g - gPrev) > .3 ? 0 : groundVy);     // touching down across a step (a deck's edge): that jump in height isn't speed
        }
        v.qx = x; v.qz = z;
        return true;
      }

      // a ledge too tall to climb (the back of a ramp, the side of the pier): bounce off it
      const lv = b.linvel(), speed = Math.hypot(lv.x, lv.y);
      if ((gf - v.gf > RIDE.ledge || gr - v.gr > RIDE.ledge) && Math.hypot(x - v.qx, z - v.qz) < 2.5) {
        pos.x = v.qx; pos.y = v.qz; b.setTranslation(pos, true); vel.x = -lv.x * .3; vel.y = -lv.y * .3; b.setLinvel(vel, true);
        const T = v.tune || CAR;
        if (speed > T.damageMin) { v.damage((speed - T.damageMin) * T.damageScale * (v.driver === 'player' ? .75 : 1)); game.onCrash(v, speed); }
        v.x = v.qx; v.z = v.qz;
        return false;
      }

      // would the car fly if nothing held it down? d = how far the ground dropped away beyond a smooth slope
      // (gPrev, not v.y: place() may have nudged v.y for drawing)
      const free = gPrev + (v.vy - RIDE.gravity * dt) * dt, d = g - (gPrev + v.vy * dt);
      const kerb = d < -.05 && d > -RIDE.absorb;                  // small steps are soaked up by the suspension
      if (free > g + .001 && !kerb && speed > 3) {
        v.air = dt; v.y = free; v.vy -= RIDE.gravity * dt; v.gf = gf; v.gr = gr; v.qx = x; v.qz = z;
        v.jump = { x, z, y: v.y, top: v.y, speed };
        emit('takeoff', v, v.jump);
        return true;
      }
      if (Math.abs(d) > .05) v.sus -= d;                          // hide the jolt, let it settle in place()
      v.y = g; v.vy = groundVy; v.gf = gf; v.gr = gr; v.qx = x; v.qz = z;
      v.slope = (gf - gr) / (2 * AXLE);

      // gravity along the slope (parked cars stay put)
      let changed = false; vel.x = lv.x; vel.y = lv.y;
      if ((v.driver || speed > .3) && Math.abs(v.slope) > .02) {
        const steep = Math.max(0, Math.abs(v.slope) - RIDE.steep) * RIDE.steepPull * Math.sign(v.slope);
        const a = -(RIDE.slopePull * v.slope / Math.hypot(1, v.slope) + steep) * dt; vel.x += fx * a; vel.y += fz * a; changed = true;
      }
      // water: slows you down, then floods the engine
      const depth = WATER - g;
      if (depth > .25) {
        const k = Math.max(0, 1 - Math.min(1, depth) * RIDE.waterDrag * dt); vel.x *= k; vel.y *= k; changed = true;
        if (!v.wet) { v.wet = true; if (speed > 4) emit('splash', v, { speed }); }
        if (depth > RIDE.floodDepth && !v.wrecked) {
          v.flooded = true;
          if (v.driver === 'player') game.hud.toast('ENGINE FLOODED!', 'bad');
          v.damage(1e5);
        }
      } else v.wet = false;
      if (changed) b.setLinvel(vel, true);
      return false;
    },

    // Put the car's model on the ground (or in the air) for this frame. Returns extra kerb pitch for the body (none).
    place(v, dt) {
      if (!v.rideReady) init(v);
      const x = v.ix ?? v.x, z = v.iz ?? v.z, h = v.ih ?? v.h, fx = Math.cos(h), fz = Math.sin(h);
      let y, pitch, roll = 0;
      if (v.air > 0) { y = v.y; pitch = clamp(Math.atan2(v.vy, Math.max(10, v.speed)) * .75, -.55, .55); }
      else {
        const yf = groundY(x + fx * AXLE, z + fz * AXLE), yr = groundY(x - fx * AXLE, z - fz * AXLE);
        v.sus = dt ? damp(v.sus, 0, 18, dt) : 0;
        y = (yf + yr) / 2 + v.sus; pitch = Math.atan2(yf - yr, 2 * AXLE);
        if (Math.abs(yf - yr) > .01 || v.tiltR) roll = Math.atan2(groundY(x + fz * TRACK, z - fx * TRACK) - groundY(x - fz * TRACK, z + fx * TRACK), 2 * TRACK);
      }
      const rate = v.air > 0 ? 3.5 : 16;
      v.tiltP = dt ? damp(v.tiltP, pitch, rate, dt) : pitch; v.tiltR = dt ? damp(v.tiltR, roll, rate, dt) : roll;
      if (Math.abs(v.tiltR) < 1e-4) v.tiltR = 0;
      const m = v.mesh; m.position.set(x, y, z); m.rotation.set(v.tiltR, -h, v.tiltP);
      if (v.air === 0) v.y = y;
      // dust on loose ground, spray in the shallows
      if (dt && v.air === 0 && v.speed > 7 && Math.abs(x - game.player.x) < 70 && Math.abs(z - game.player.z) < 70 && Math.random() < dt * (4 + v.speed * .25)) {
        if (v.wet) game.fx.smoke(x - fx * 1.5, y + .3, z - fz * 1.5, 1, 1.1, .5, v.vx * .3, v.vz * .3);
        else if (DUSTY[surfaceAt(x, z)]) game.fx.smoke(x - fx * 1.8, y + .25, z - fz * 1.8, .86, 1.2, .8, v.vx * .25, v.vz * .25);
      }
      return 0;
    },
  };
  return ride;
}
