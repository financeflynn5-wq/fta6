// How a helicopter flies. A helicopter is an ordinary Vehicle (vehicle.js hands its physics and drawing over
// to this file). On the ground it is a parked thing like any car. In the air its flat physics body touches
// nothing; this file keeps it out of walls and hills instead, by looking at what is under and ahead of it:
// the land, bridges and roofs (terrain.js) and the height of every building (physics.under).
// Controls: W/S forward and back, A/D turn, Space up, Shift down. Let go and it hovers.
// Numbers: HELI in config.js, and each helicopter's own line in CAR.types.
import { HELI, WORLD } from '../config.js';
import { clamp, damp, lerp, angleDiff } from '../core/utils.js';
import { groundY, layer, surfaceAt } from '../world/terrain.js';
import { WATER } from '../world/map.js';

const DUSTY = { dirt: 1, scrub: 1, sand: 1 };

export function createHelis(game) {
  const seen = { top: 0, wall: false, vague: false }, F = { y: 0, roof: false, up: false, water: false, wall: false };
  const X0 = -WORLD.LIMIT - HELI.limit, X1 = WORLD.LIMIT + HELI.limit, Z0 = -WORLD.LIMIT - HELI.limit, Z1 = WORLD.LIMIT_N + HELI.limit;

  // What is under a helicopter at (x, z) flying at height y: F.y = where its skids would rest, and what that is
  // (a roof, the upper level, the sea); F.wall = something there stands higher than it can step onto.
  function floor(x, z, y) {
    const g = groundY(x, z, y + .6); F.up = layer.up; F.roof = false; F.wall = false;
    let top = g;
    game.physics.under(x, z, HELI.skids, y + HELI.step, seen);
    if (seen.top > top) { top = seen.top; F.roof = true; F.up = false; }
    if (seen.vague) { const h = groundY(x, z) + HELI.vague; if (h > y + HELI.step) F.wall = true; else if (h > top) { top = h; F.roof = true; F.up = false; } }
    if (seen.wall) F.wall = true;
    if (!F.wall) { game.physics.under(x, z, HELI.radius, y + HELI.step, seen); if (seen.wall || (seen.vague && groundY(x, z) + HELI.vague > y + HELI.step)) F.wall = true; }
    F.water = !F.roof && top < WATER - .35; if (F.water) top = WATER - .3;
    F.y = top; return F;
  }
  // which things its flat body can touch: nothing in the air or on a roof, the street's when down on it
  function setMode(v, mode) { if (v.mode !== mode) { v.mode = mode; v.flying = mode === 3; v.up = mode === 2; game.physics.setCarMode(v.body, mode); } }

  function crash(v, power, wreck) {
    const p = game.player, near = Math.hypot(v.x - p.x, v.z - p.z) < 90;
    if (near) { game.audio.crash(clamp(power / 16, .15, 1)); game.fx.spark(v.x, v.y + 1, v.z, 6 + Math.round(power), 1); }
    if (wreck && !v.wrecked) v.damage(1e5);
    if (v.driver === 'player') { game.cam.shake(clamp(power * .05, .15, .9)); if (power > 9) p.hurt((power - 9) * 2.2); }
  }
  function explode(v) {
    if (v.blown) return; v.blown = true;
    for (let i = 0; i < 10; i++) game.fx.fire(v.x + (Math.random() - .5) * 3, v.y + .6 + Math.random() * 1.6, v.z + (Math.random() - .5) * 3, 1.3);
    for (let i = 0; i < 6; i++) game.fx.smoke(v.x + (Math.random() - .5) * 3, v.y + 1.5, v.z + (Math.random() - .5) * 3, .08, 2.2, 3, 0, 0, { rise: 3 });
    game.fx.spark(v.x, v.y + 1.2, v.z, 26, 1.6);
  }

  const helis = {
    init(v) {
      const g = groundY(v.x, v.z, (v.y ?? 0) + .6); v.y = v.py2 = g; v.vy = 0; v.air = 0; v.rotor = v.rotor || 0; v.rotorA = v.rotorA || 0;
      v.roll = 0; v.pitch = 0; v.roofed = false; v.washT = 0; v.gear = 1; v.mode = -1; v.landY = g;
      v.mesh.rotation.order = 'YZX'; v.rideReady = true;
      setMode(v, layer.up ? 2 : 0);
    },
    // Put one down (or hang it in the air) at a height: another player's helicopter becoming ours, a police one arriving.
    setHeight(v, y, flying = false) {
      v.y = y; helis.init(v); const g = v.y;
      if (flying || y > g + .5) { v.y = v.py2 = Math.max(y, g); v.air = 1; v.rotor = 1; setMode(v, 3); }
    },

    // ---------- once per physics step ----------
    preStep(v, dt) {
      const b = v.body, S = v.stats, c = v.controls;
      v.py2 = v.y;
      if (v.air === 0 && !v.driver && b.isSleeping()) { v.speed = v.vf = v.vl = 0; v.accelLong = 0; return; }
      const lv = b.linvel(); v.h = b.rotation();
      const fx = v.fx, fz = v.fz, rx = v.rx, rz = v.rz;
      let vf = lv.x * fx + lv.y * fz, vl = lv.x * rx + lv.y * rz, w = b.angvel();
      const driven = v.driver && !v.wrecked, power = driven && v.rotor > .85, before = vf;
      const thr = driven ? clamp(c.throttle, -1, 1) : 0, st = driven ? clamp(c.steer, -1, 1) : 0, lift = driven ? clamp(c.lift || 0, -1, 1) : 0;
      v.braking = false; v.sliding = false; v.slip = 0;

      if (v.air === 0) {
        // down: the skids grip. Space with the rotor up to speed lifts off.
        vf = damp(vf, 0, 5, dt); vl = damp(vl, 0, 8, dt); w = damp(w, 0, 6, dt); v.vy = 0;
        if (!v.roofed) { const g = groundY(v.x, v.z, v.y + .6); v.y = g; if (!v.wrecked && g < WATER - .35) { v.air = dt; } }     // pushed off a quay: it drops in
        if (power && lift > 0) { v.air = dt; v.vy = 1.2; if (v.driver === 'player') game.hints.heli = 0; }
        v.accelLong = 0; v.vf = vf; v.vl = vl; v.omega = w;
        v._set.x = fx * vf + rx * vl; v._set.y = fz * vf + rz * vl;
        const moving = Math.abs(vf) > .05 || Math.abs(vl) > .05 || Math.abs(w) > .02;
        if (moving || driven) { b.setLinvel(v._set, true); b.setAngvel(w, true); } else { v._set.x = v._set.y = 0; b.setLinvel(v._set, false); b.setAngvel(0, false); }
        return;
      }

      // ----- flying -----
      v.air += dt;
      const sp = clamp(Math.abs(vf) / S.maxSpeed, 0, 1);
      if (power) {
        // it flares by itself close to the ground, so holding Shift all the way down is a soft landing
        const room = v.y - (v.floorY ?? v.y), sink = lerp(HELI.flare, HELI.sink, clamp((room - 1) / 9, 0, 1));
        v.vy = damp(v.vy, lift > 0 ? HELI.climb * lift : sink * lift, HELI.liftRate, dt); if (v.vy < -sink) v.vy = damp(v.vy, -sink, 6, dt);
        const want = thr >= 0 ? thr * S.maxSpeed : thr * HELI.back, rate = S.accel * (thr === 0 ? HELI.brake : Math.sign(want - vf) === Math.sign(vf || 1) ? 1 : 1.5) * dt;
        vf += clamp(want - vf, -rate, rate);
        vl *= Math.max(0, 1 - HELI.slide * dt);
        w = damp(w, st * lerp(HELI.yaw, HELI.yawFast, sp), HELI.yawRate, dt);
      } else {
        // no power: it comes down, turning as it goes
        v.vy = Math.max(-26, v.vy - HELI.fall * dt); vf *= 1 - .25 * dt; vl *= 1 - .4 * dt; w = damp(w, v.wrecked ? 2.2 : 0, 1.2, dt);
      }
      const top = WATER + HELI.ceiling; if (v.y > top - 12 && v.vy > 0) v.vy *= clamp((top - v.y) / 12, 0, 1);
      let vx = fx * vf + rx * vl, vz = fz * vf + rz * vl;
      if (v.x < X0 && vx < 0) vx *= .9; if (v.x > X1 && vx > 0) vx *= .9; if (v.z < Z0 && vz < 0) vz *= .9; if (v.z > Z1 && vz > 0) vz *= .9;

      // what is ahead and below
      let ny = v.y + v.vy * dt;
      let f = floor(v.x + vx * dt, v.z + vz * dt, v.y);
      if (f.wall || f.y > v.y + HELI.step) {
        // flew into the side of something: thrown back off it
        const speed = Math.hypot(vx, vz);
        if (speed > 1.5 && !v.driver?.police) { v.damage(speed * HELI.wallDamage * (v.driver === 'player' ? .75 : 1)); game.onCrash(v, speed); crash(v, speed, false); }
        vx *= -.35; vz *= -.35; w *= .5;
        f = floor(v.x, v.z, v.y);
        if (f.wall || f.y > v.y + HELI.step) { f.y = Math.min(f.y, v.y); f.wall = false; }       // wedged: never pulled up through a wall
      }
      if (ny <= f.y) {
        const down = -v.vy, speed = Math.hypot(vx, vz);
        if (f.water) {                                   // ditched
          if (!v.ditched) {
            v.ditched = true; for (let i = 0; i < 8; i++) game.fx.smoke(v.x + (Math.random() - .5) * 4, WATER + .4, v.z + (Math.random() - .5) * 4, 1, 1.6, .9, 0, 0, { rise: 3 });
            game.wake?.foam(v.x, v.z, 5, 4, 3, 1); crash(v, 6 + down, true);
          }
          ny = Math.max(ny, Math.max(groundY(v.x, v.z) + .5, WATER - 1.9)); v.vy = Math.max(v.vy, -.6); vx *= 1 - 3 * dt; vz *= 1 - 3 * dt;
          if (ny <= groundY(v.x, v.z) + .52 || ny <= WATER - 1.88) { v.air = 0; v.roofed = true; v.vy = 0; }      // on the bottom: stays put
        } else if (down > .5 || !power) {                // landing, gently or not
          ny = f.y; v.air = 0; v.vy = 0; v.roofed = f.roof; v.landY = f.y;
          if (down > HELI.hardLanding) { v.damage((down - HELI.hardLanding) * HELI.landingDamage); crash(v, down, !power && down > 12); }
          if (!power && down > 9) explode(v);
          if (speed > 9) { v.damage((speed - 9) * 2); game.onCrash(v, speed * .6); }
          setMode(v, f.roof ? 3 : f.up ? 2 : 0);
          if (v.driver === 'player' && f.roof && !v.wrecked) game.hud.toast('NO WAY DOWN FROM THIS ROOF', 'info');
        } else {                                         // skimming over rising ground
          ny = f.y + .02; v.vy = Math.max(v.vy, 0);
        }
      }
      if (v.air > 0) setMode(v, ny - f.y > 1.2 || f.roof || f.water ? 3 : f.up ? 2 : 0);
      v.floorY = f.y;
      v.y = ny;
      vf = vx * fx + vz * fz; vl = vx * rx + vz * rz;
      v.accelLong = damp(v.accelLong, (vf - before) / dt, 5, dt);
      v.vf = vf; v.vl = vl; v.omega = w;
      v._set.x = vx; v._set.y = vz; b.setLinvel(v._set, true); b.setAngvel(w, true);
    },

    // ---------- once per drawn frame ----------
    syncVisual(v, dt, t) {
      const m = v.mesh, u = m.userData, S = v.stats, k = dt ? game.alpha ?? 1 : 1;
      const x = v.ix = lerp(v.px, v.x, k), z = v.iz = lerp(v.pz, v.z, k), h = v.ih = v.ph + angleDiff(v.h, v.ph) * k;
      const y = v.ghost ? v.y : lerp(v.py2 ?? v.y, v.y, k);
      // the rotor runs up when someone is at the controls, and winds down when they leave
      if (dt) {
        const want = v.driver && !v.wrecked ? 1 : 0;
        v.rotor = want > v.rotor ? Math.min(1, v.rotor + dt / HELI.spoolUp) : Math.max(0, v.rotor - dt / HELI.spoolDown * (v.wrecked && v.air === 0 ? 4 : 1));
        if (v.ghost && v.air > 0 && want) v.rotor = 1;
        v.rotorA = (v.rotorA + v.rotor * 39 * dt) % (Math.PI * 200);
      }
      const r = v.rotor, blur = clamp((r - .3) / .5, 0, 1);
      u.blades.rotation.y = v.rotorA; u.blades.visible = r < .62; u.disc.visible = r > .3; u.disc.material.opacity = blur * .55; u.disc.rotation.z = v.rotorA * .11;
      u.tailBlades.rotation.z = v.rotorA * 4.3; u.tailBlades.visible = r < .45; u.tailDisc.visible = r > .22; u.tailDisc.material.opacity = clamp((r - .22) / .4, 0, 1) * .5;
      // it leans the way it is going
      let pitch = 0, roll = 0;
      if (v.air > 0) {
        const sp = v.vf / S.maxSpeed;
        pitch = -sp * HELI.tilt * (sp < 0 ? 1.8 : 1) - clamp(v.accelLong * .011, -.13, .13);
        roll = clamp(v.omega * (.2 + Math.abs(sp) * .55), -HELI.bank, HELI.bank) + clamp(v.vl * .02, -.15, .15);
        if (v.wrecked) { pitch += Math.sin(t * 3.1) * .15; roll += Math.sin(t * 2.3) * .22; }
        else { pitch += Math.sin(t * 1.3 + v.x) * .008; roll += Math.sin(t * 1.7 + v.z) * .008; }
      } else if (v.ditched) { roll = .28; pitch = -.1; }
      v.pitch = dt ? damp(v.pitch, pitch, 3.5, dt) : pitch; v.roll = dt ? damp(v.roll, roll, 4, dt) : roll;
      const shake = v.air === 0 && r > .1 && r < 1 ? Math.sin(t * 40) * .004 * r : 0;
      m.position.set(x, y + shake, z); m.rotation.set(v.roll, -h, v.pitch);
      if (!dt) return;
      // beacon, searchlight bar
      u.tail.emissiveIntensity = r > .05 && Math.floor(t * 1.4 + v.x * .1) % 2 === 0 && (t * 1.4 + v.x * .1) % 1 < .25 ? 6 : .3;
      if (u.bar) { const on = v.siren ? Math.floor(t * 7) % 2 : -1; u.bar[0].material.emissiveIntensity = on === 1 ? 6 : 0; u.bar[1].material.emissiveIntensity = on === 0 ? 6 : 0; }
      // rotor wash: dust off the ground, spray off the sea
      const p = game.player;
      if (r > .7 && Math.abs(x - p.x) < 150 && Math.abs(z - p.z) < 150 && (v.washT -= dt) <= 0) {
        v.washT = .05;
        const g = groundY(x, z, y + .6), wet = g < WATER - .2, base = wet ? WATER : g, hgt = y - base;
        if (hgt < HELI.wash) {
          const a = Math.random() * 6.283, rad = 2.5 + Math.random() * 3.5, ca = Math.cos(a), sa = Math.sin(a), near = 1 - hgt / HELI.wash;
          if (wet) { game.fx.smoke(x + ca * rad, WATER + .2, z + sa * rad, 1, .7 + near, .5, ca * 6, sa * 6, { alpha: .35 * near + .1, rise: .6 }); if (Math.random() < .5) game.wake.foam(x + ca * rad, z + sa * rad, 1.6, 1.4, 2.5, .5 * near, ca * 3, sa * 3); }
          else if (DUSTY[surfaceAt(x, z)] || Math.random() < .25) game.fx.smoke(x + ca * rad, base + .25, z + sa * rad, .82, .8 + near, .7, ca * 6, sa * 6, { alpha: (DUSTY[surfaceAt(x, z)] ? .4 : .14) * near, rise: .5 });
        }
      }
      if (!v.ditched) v.engineSmoke(dt, -.9, u.rotorY - .55);
      v.rpm = r;
    },

    // Getting out: on the ground, or a short jump. Not from a roof with no stairs, and not from the sky.
    canExit(v) {
      if (v.air > 0 && !v.ditched) {
        const g = groundY(v.x, v.z, v.y + .6);
        if (v.y - Math.max(g, WATER - 1.2) > HELI.jump) { game.hud.toast('TOO HIGH TO JUMP: LAND FIRST', 'info'); return false; }
      } else if (v.roofed && !v.ditched) { game.hud.toast('NO WAY DOWN FROM HERE: TAKE OFF AGAIN', 'info'); return false; }
      return true;
    },
  };
  return helis;
}
