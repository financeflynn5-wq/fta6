// Sharks. A handful of great whites patrol whatever sea is near you, fins cutting the surface.
// Swim out of your depth (off the beach, off a boat, down from a helicopter) and they notice: one circles,
// closing in, then charges and bites, swims off and comes round again. Others join in. The shallows are
// safe: they can't follow you into water under about a metre. They ram a boat left sitting still (a jet
// ski may throw you), a boat at speed runs them down, and they can be shot, or punched on the nose.
// Nothing here has a physics body: a shark steers itself round shallows, piers and hulls.
import * as THREE from 'three';
import { SHARK, WORLD, BOAT } from '../config.js';
import { WATER } from '../world/map.js';
import { waterDepth } from '../world/terrain.js';
import { clamp, angleDiff, rnd } from '../core/utils.js';
import { makeBeast, animateBeast } from './beasts.js';
import { raySphere } from './ray.js';

export function createSharks(game, calls) {
  const C = SHARK, p = game.player, LX = WORLD.LIMIT + BOAT.limit - 25, LN = WORLD.LIMIT_N + BOAT.limit - 25;
  const deep = (x, z) => Math.abs(x) < LX && z > -LX && z < LN && waterDepth(x, z) >= C.depth;
  const list = [];
  for (let i = 0; i < C.count; i++) {
    const model = makeBeast('shark', { scale: rnd(.88, 1.12) }); model.rotation.order = 'YXZ'; model.visible = false; game.scene.add(model);
    const s = { owner: null, i, model, x: 0, z: 0, y: WATER - 2, h: 0, speed: 0, state: 'gone', t: 0, hp: C.hp, wob: 0, wobT: 0, ring: 12, side: 1, rest: 0, pitch: 0, hitT: 0, foamT: 0, pose: 'idle', bites: 0 };
    s.marker = { x: 0, z: 0, color: '#ff4d6d', size: 4.2, visible: () => s.state !== 'gone' && s.state !== 'dead' && (afloat || hunting(s)) && Math.hypot(s.x - p.x, s.z - p.z) < 95 };
    game.markers.push(s.marker); list.push(s);
  }
  const hunting = (s) => s.state === 'stalk' || s.state === 'charge' || s.state === 'ram';
  let afloat = false, spawnT = 0, stingT = 0, idle = 0, told = 0, warnedBoat = 0, bitten = -9;

  // ---------- blood in the water: a few red patches that spread and fade ----------
  const stains = [];
  { const geo = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2);
    for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x9c0f1f, transparent: true, opacity: 0, depthWrite: false })); m.visible = false; m.renderOrder = 1; m.userData.noAO = true; game.scene.add(m); stains.push({ m, t: 0 }); } }
  let stainN = 0;
  function blood(x, z, size = 1.2) {
    const st = stains[stainN++ % stains.length]; st.m.position.set(x, WATER + .03 + (stainN % 6) * .002, z); st.t = 7; st.size = size; st.m.visible = true;
    for (let i = 0; i < 5; i++) { const a = Math.random() * 6.28; game.fx.smoke(x + Math.cos(a) * .4, WATER + .25, z + Math.sin(a) * .4, 1, .7, .5, Math.cos(a) * 2.2, Math.sin(a) * 2.2, { alpha: .55, rise: 2.4 }); }
  }
  const spray = (x, z, n = 6, power = 3) => { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28; game.fx.smoke(x + Math.cos(a) * .5, WATER + .25, z + Math.sin(a) * .5, 1, .8, .55, Math.cos(a) * power, Math.sin(a) * power, { alpha: .5, rise: 2.6 }); } game.wake.foam(x, z, 1.6, 2.4, 1.6, .9); };

  // ---------- where they are put ----------
  function place(s) {
    for (let k = 0; k < 10; k++) {
      const a = Math.random() * 6.283, d = rnd(C.near, C.far), x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
      if (!deep(x, z) || !deep(x + 7, z) || !deep(x - 7, z) || !deep(x, z + 7) || !deep(x, z - 7)) continue;
      if (game.physics.probeDrive(x - 4, z, 1, 0, 8) < 8) continue;                    // inside a hull or a breakwater
      Object.assign(s, { x, z, y: WATER - 1.7, h: Math.random() * 6.283, speed: C.cruise, state: 'cruise', t: 0, hp: C.hp, rest: rnd(0, 3), pitch: 0, bites: 0, pose: 'idle' });
      s.model.visible = true; s.model.userData.lie = 0; return true;
    }
    return false;
  }

  // ---------- steering ----------
  const FEEL = [0, .55, -.55, 1.15, -1.15, 1.9, -1.9, 2.7, -2.7];
  // Turn toward `want` as far as `rate` allows, round anything shallow or solid, and swim on.
  function swim(s, dt, want, top, rate) {
    let pick = want, found = false;
    const reach = 4 + s.speed * .5;
    for (const o of FEEL) {
      const a = want + o, sx = Math.sin(a), cz = Math.cos(a);
      if (deep(s.x + sx * reach, s.z + cz * reach) && deep(s.x + sx * reach * .5, s.z + cz * reach * .5) && game.physics.probeDrive(s.x, s.z, sx, cz, reach) >= reach) { pick = a; found = true; break; }
    }
    s.blocked = !found || pick !== want;
    s.h += clamp(angleDiff(pick, s.h), -rate * dt, rate * dt);
    s.speed += clamp(top - s.speed, -6 * dt, 7 * dt);
    const nx = s.x + Math.sin(s.h) * s.speed * dt, nz = s.z + Math.cos(s.h) * s.speed * dt;
    if (deep(nx, nz)) { s.x = nx; s.z = nz; } else { s.speed *= 1 - 4 * dt; s.h += rate * dt * (s.side || 1); }
  }
  const towards = (s, x, z) => Math.atan2(x - s.x, z - s.z);
  function set(s, state, t = 0) { s.state = state; s.t = t; }

  function bite(s) {
    const hx = Math.sin(s.h), hz = Math.cos(s.h);
    bitten = game.time; p.hurt(C.bite); p.tumble = Math.max(p.tumble, .7); p.body.setLinvel({ x: hx * 4.5, y: hz * 4.5 }, true);
    game.cam.shake(.6); calls.chomp(); blood(p.x, p.z, 1.4); spray(p.x, p.z, 5, 3);
    if (game.time - told > 8) { told = game.time; game.hud.toast(p.health <= 0 ? 'SHARK BAIT' : 'SHARK ATTACK!', 'bad'); }
    s.bites++; set(s, 'away', rnd(2.2, 3.4)); s.pose = 'bite';
  }

  const sharks = {
    list,
    // ---------- being shot at ----------
    cast(ox, oy, oz, dx, dy, dz, tmin, range, consider) {
      for (const s of list) {
        if (s.state === 'gone' || Math.abs(s.x - ox) > range + 3 || Math.abs(s.z - oz) > range + 3) continue;
        const hx = Math.sin(s.h), hz = Math.cos(s.h);
        for (const k of [-1.35, 0, 1.3]) consider(raySphere(ox, oy, oz, dx, dy, dz, s.x + hx * k, s.y + .05, s.z + hz * k, k ? .5 : .62, tmin, range), 'beast', s);
      }
    },
    hurt(s, h, damage, dx, dz, { byPlayer = true, melee = false } = {}) {
      if (s.state === 'dead' || s.state === 'gone') return false;
      s.hp -= damage; blood(h.x, h.z, .8); calls.thump(.5 * calls.near(s.x, s.z, 60));
      if (byPlayer) game.combat?.hitMarker(s.hp <= 0);
      if (s.hp <= 0) {
        set(s, 'dead', C.float); s.pose = 'ko'; s.speed = 0; spray(s.x, s.z, 8, 3.5);
        if (byPlayer) { game.addMoney(C.bounty); game.hud.toast('SHARK DOWN  +$' + C.bounty, 'good'); }
        return true;
      }
      if (melee && byPlayer && game.time - told > 3) { told = game.time; game.hud.toast('RIGHT ON THE NOSE!', 'good'); }
      set(s, 'flee', melee ? rnd(4, 6) : rnd(5, 9)); s.side = Math.random() < .5 ? 1 : -1;
      return false;
    },

    update(dt, t) {
      const boat = p.mode === 'car' && p.vehicle.stats.craft === 'boat' ? p.vehicle : null;
      const prey = p.mode === 'foot' && p.swimming && !p.sky && !game.over && game.state === 'playing';
      afloat = !!boat || (p.mode === 'foot' && waterDepth(p.x, p.z) > .2);
      stingT -= dt;
      for (const st of stains) if (st.t > 0) { st.t -= dt; const k = 1 - st.t / 7; st.m.scale.setScalar(st.size * (.6 + k * 2.6)); st.m.material.opacity = .55 * (1 - k) * (1 - k); if (st.t <= 0) st.m.visible = false; }

      // bring one in from out of sight now and then, and take away any that have been left far behind
      if ((spawnT -= dt) <= 0) {
        spawnT = .5;
        for (const s of list) {
          if (s.state !== 'gone' && Math.hypot(s.x - p.x, s.z - p.z) > C.gone) { s.state = 'gone'; s.model.visible = false; }
          if (s.state === 'gone' && (s.rest -= .5) <= 0) { if (!place(s)) s.rest = 2; break; }
        }
      }
      // a boat left sitting in deep water gets a visitor
      if (boat && boat.speed < 2.5 && !boat.wrecked && deep(boat.x, boat.z)) idle += dt; else idle = 0;
      if (idle > C.ramAfter && !list.some(s => s.state === 'ram')) {
        let best = null, bd = 60; for (const s of list) { if (s.state !== 'cruise') continue; const d = Math.hypot(s.x - boat.x, s.z - boat.z); if (d < bd) { bd = d; best = s; } }
        if (best) { set(best, 'ram', 7); if (stingT <= 0) { stingT = 12; calls.sting(.8); } }
      }

      let hunters = 0; for (const s of list) if (hunting(s)) hunters++;
      for (const s of list) {
        if (s.state === 'gone') continue;
        const dxp = p.x - s.x, dzp = p.z - s.z, far = Math.hypot(dxp, dzp);
        s.hitT -= dt; s.rest -= dt;
        let pose = 'idle', wantY = WATER - .52, wantPitch = 0;

        if (s.state === 'cruise') {
          if ((s.wobT -= dt) <= 0) { s.wobT = rnd(2, 5); s.wob = rnd(-.5, .5); }
          // drift about, but don't wander off: past the middle distance they lean back toward you (or round your boat)
          let want = s.h + s.wob;
          if (boat && far < 45) { const d = far || 1, rx = -dxp / d, rz = -dzp / d, err = clamp((d - 13) / 6, -1, 1); want = Math.atan2(-rz * s.side - rx * err, rx * s.side - rz * err); }      // keeping a boat company
          else if (far > C.far * .75) want = towards(s, p.x, p.z) + s.wob;
          swim(s, dt, want, C.cruise, C.turn * .6);
          if (prey && far < C.sense && hunters < C.hunters && s.rest <= 0) {
            hunters++; set(s, 'stalk', rnd(C.circle[0], C.circle[1]) * (hunters > 1 ? .6 : 1)); s.ring = clamp(far, 7, 17); s.side = Math.random() < .5 ? 1 : -1;
            if (stingT <= 0) { stingT = 14; calls.sting(); if (game.time - told > 6) { told = game.time; game.hud.toast('SHARK!', 'bad'); } }
          }
        } else if (s.state === 'stalk') {
          if (!prey) { set(s, 'cruise'); s.rest = rnd(2, 5); }
          else {
            s.ring = Math.max(5.5, s.ring - 1.5 * dt);
            const d = far || 1, rx = -dxp / d, rz = -dzp / d, err = clamp((d - s.ring) / 4, -1, 1);       // round the swimmer, easing onto the ring
            swim(s, dt, Math.atan2(-rz * s.side - rx * err, rx * s.side - rz * err), C.stalk, C.turn * 1.5);
            wantY = WATER - .3;
            if ((s.t -= dt) <= 0) { set(s, 'charge', 6); calls.splash(.6 * calls.near(s.x, s.z, 50)); }
          }
        } else if (s.state === 'charge') {
          wantY = WATER - .26;
          if (!prey || (s.t -= dt) <= 0) { set(s, 'away', 2); }
          else {
            swim(s, dt, towards(s, p.x, p.z), C.charge, C.turn * 2.2);
            const nx = s.x + Math.sin(s.h) * 1.95, nz = s.z + Math.cos(s.h) * 1.95, nd = Math.hypot(p.x - nx, p.z - nz);
            if (far < 6.5) { pose = 'bite'; wantPitch = -.3; wantY = WATER - .1; }
            if (nd < C.reach && p.tumble < .3 && game.time - bitten > C.gap) bite(s);
            else if (nd < C.reach) set(s, 'away', 1.6);                                        // another one got there first: sweep past
            else if (s.blocked && far < 9 && s.speed < 2) set(s, 'away', 2.5);                // you are in the shallows, out of reach
          }
        } else if (s.state === 'away' || s.state === 'flee') {
          const flee = s.state === 'flee';
          swim(s, dt, Math.atan2(-dxp, -dzp) + s.side * .5, flee ? C.charge : C.stalk * 1.25, C.turn * 1.6);
          if (s.pose === 'bite' && s.t > 1.6) pose = 'bite';
          if ((s.t -= dt) <= 0) { s.pose = 'idle'; if (!flee && prey && far < C.sense) { set(s, 'stalk', rnd(1.5, 3)); s.ring = clamp(far, 6, 12); } else { set(s, 'cruise'); s.rest = flee ? rnd(6, 10) : rnd(1, 3); } }
        } else if (s.state === 'ram') {
          wantY = WATER - .3;
          if (!boat || (s.t -= dt) <= 0) { set(s, 'cruise'); s.rest = 4; }
          else {
            const bd = Math.hypot(boat.x - s.x, boat.z - s.z);
            swim(s, dt, towards(s, boat.x, boat.z), C.charge * .85, C.turn * 2);
            if (bd < boat.halfLen + 1.9) {
              const hx = Math.sin(s.h), hz = Math.cos(s.h), lv = boat.body.linvel();
              boat.body.setLinvel({ x: lv.x + hx * 3.2, y: lv.y + hz * 3.2 }, true); boat._set.x += hx * 3.2; boat._set.y += hz * 3.2;      // a shove, not a crash
              boat.body.setAngvel(boat.body.angvel() + (Math.random() - .5) * 2.4, true); s.hitT = 2.5;
              boat.damage(C.ram); game.cam.shake(.55); calls.thump(); spray(s.x + hx * 2, s.z + hz * 2, 7, 3.5);
              if (game.time - warnedBoat > 20) { warnedBoat = game.time; game.hud.toast('SOMETHING HIT THE BOAT!', 'bad'); }
              idle = 0; set(s, 'away', 3);
              if (boat.stats.rider && Math.random() < C.tip) p.thrown(5);                  // off the jet ski and into the water with it
            }
          }
        } else if (s.state === 'dead') {
          pose = 'ko'; s.speed *= 1 - 2 * dt; wantY = (s.t -= dt) > 0 ? WATER - .12 : WATER - 3;
          if (s.y < WATER - 2.5) { s.state = 'gone'; s.model.visible = false; s.rest = rnd(14, 26); continue; }
        }

        // a boat at speed runs a shark down
        if (s.state !== 'dead' && s.hitT <= 0) for (const v of game.traffic.vehicles) {
          if (v.stats.craft !== 'boat' || v.speed < C.runOver || Math.abs(v.x - s.x) > 6 || Math.abs(v.z - s.z) > 6) continue;
          const [lx, lz] = v.local(s.x, s.z); if (Math.abs(lx) > v.halfLen + 1.2 || Math.abs(lz) > v.halfWid + .7) continue;
          s.hitT = 1; v.damage(3); if (v.driver === 'player') game.cam.shake(.35); calls.thump(calls.near(s.x, s.z, 50));
          sharks.hurt(s, { x: s.x, z: s.z }, v.speed * 3.2, v.vx, v.vz, { byPlayer: v.driver === 'player' }); break;
        }

        // draw it
        s.y += (wantY - s.y) * Math.min(1, dt * (s.state === 'dead' ? .5 : 2.2)); s.pitch += (wantPitch - s.pitch) * Math.min(1, dt * 6);
        s.marker.x = s.x; s.marker.z = s.z;
        const m = s.model; m.visible = far < 240; if (!m.visible) continue;
        m.position.set(s.x, s.y, s.z); m.rotation.y = s.h; m.rotation.x = s.pitch;
        animateBeast(m, t, dt, s.speed, pose);
        // the fin cuts a line of foam
        if (s.state !== 'dead' && far < 120 && s.y > WATER - .7 && (s.foamT -= dt * s.speed) <= 0) { s.foamT = 1.3; game.wake.foam(s.x - Math.sin(s.h) * .3, s.z - Math.cos(s.h) * .3, .45 + s.speed * .04, 1.3, .5, .3); }
      }
    },
  };
  for (const s of list) s.owner = sharks;
  return sharks;
}
