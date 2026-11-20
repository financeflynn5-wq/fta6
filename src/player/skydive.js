// Falling. Jump out of a helicopter in the air (or step off a roof) and you drop: spread out flat on the wind,
// steering with W A S D (W tucks into a dive). With a parachute on your back, Space opens it and you float
// down under the canopy (A/D turn, W speeds up, S flares). Without one, the ground decides.
// A parachute is a pack you pick up beside a helipad or buy at Bullseye Guns; opening it uses it up.
// The flat physics body touches nothing while you are up there: this file keeps you out of walls and finds
// what is under you (the land, bridges, roofs) the same way the helicopters do. Landing on a roof leaves
// you standing on it (player.high) until you walk off the edge.
// Numbers: SKY in config.js.
import * as THREE from 'three';
import { SKY } from '../config.js';
import { clamp, damp, lerp, angleDiff } from '../core/utils.js';
import { groundY, layer } from '../world/terrain.js';
import { WATER } from '../world/map.js';
import { std, rbox } from '../world/materials.js';

const GORES = 12, COLORS = [0xff5a6e, 0xfff3dd, 0x1fb5a8, 0xfff3dd, 0xffc94d, 0xfff3dd];
let canopyGeo = null, lineGeo = null, canopyMat = null, lineMat = null, packMat = null, strapMat = null;

// The canopy: a dome of billowing gores, a vent at the top, lines down to a point (the shoulders).
export function makeCanopy() {
  if (!canopyGeo) {
    const R = 3.3, H = 2.1, RINGS = 7, pos = [], col = [], idx = [], lines = [], c = new THREE.Color();
    const at = (a, j, mid) => { const f = lerp(.07, 1.75, j / RINGS), puff = mid ? 1 + .09 * Math.sin(f / 1.75 * Math.PI * .75) : 1, r = R * Math.sin(Math.min(f, 1.62)) * puff * (f > 1.62 ? 1 - (f - 1.62) * .5 : 1); return [Math.cos(a) * r, H * Math.cos(f) + (mid ? .1 * Math.sin(f) : 0), Math.sin(a) * r]; };
    for (let g = 0; g < GORES; g++) {
      const a0 = g / GORES * Math.PI * 2, a1 = (g + 1) / GORES * Math.PI * 2, am = (a0 + a1) / 2, base = pos.length / 3; c.setHex(COLORS[g % COLORS.length]);
      for (let j = 0; j <= RINGS; j++) for (const [a, mid] of [[a0, 0], [am, 1], [a1, 0]]) { pos.push(...at(a, j, mid)); const k = j === RINGS ? .82 : 1; col.push(c.r * k, c.g * k, c.b * k); }
      for (let j = 0; j < RINGS; j++) for (let s = 0; s < 2; s++) { const p = base + j * 3 + s, q = p + 3; idx.push(p, q, p + 1, p + 1, q, q + 1); }
      const rim = at(a0, RINGS, 0); lines.push(rim[0], rim[1], rim[2], Math.sign(rim[0]) * .28, -4.55, 0);
    }
    canopyGeo = new THREE.BufferGeometry(); canopyGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); canopyGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); canopyGeo.setIndex(idx); canopyGeo.computeVertexNormals();
    lineGeo = new THREE.BufferGeometry(); lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    canopyMat = std({ vertexColors: true, side: THREE.DoubleSide, roughness: .85 }); lineMat = new THREE.LineBasicMaterial({ color: 0x2b2f3a });
  }
  const g = new THREE.Group(), dome = new THREE.Mesh(canopyGeo, canopyMat); dome.castShadow = true; g.add(dome, new THREE.LineSegments(lineGeo, lineMat));
  g.visible = false; g.userData.open = 0;
  return g;
}
// A Big Head needs the lines to meet above the head, not inside it.
export const headRoom = (model) => model?.userData.big ? Math.max(0, model.userData.big.top - 1.8) : 0;
// Place a canopy over someone whose feet are at (x, y, z). open: 0 packed .. 1 full; lean: banking into a turn.
export function setCanopy(g, x, y, z, face, open, lean = 0, t = 0) {
  g.visible = open > .01; if (!g.visible) return;
  const k = open * open * (3 - 2 * open), w = lerp(.12, 1, k);
  g.position.set(x, y + 1.42 + 4.55 * lerp(.55, 1, k), z); g.rotation.set(Math.sin(t * 1.3) * .03, face, lean + Math.sin(t * 1.9) * .025, 'YXZ');
  g.scale.set(w, lerp(.55, 1, k) * (1 + Math.sin(t * 5) * .012), w);
}
// The pack on your back while you carry a parachute.
export function makePack() {
  packMat ??= std({ color: 0xff7a3d, roughness: .7 }); strapMat ??= std({ color: 0x23262e, roughness: .8 });
  const g = new THREE.Group(), add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); };
  add(rbox(.4, .46, .2, .07), packMat, 0, 0, 0); add(rbox(.3, .1, .22, .04), strapMat, 0, .1, 0);
  for (const s of [-1, 1]) add(rbox(.07, .5, .34, .03), strapMat, s * .15, .02, .13);
  return g;
}

export function createSkydive(game) {
  const p = game.player, body = p.body, ph = game.physics;
  const seen = { top: 0, wall: false, vague: false }, F = { y: 0, roof: false, water: false, wall: false }, vel = { x: 0, y: 0 };
  const canopy = makeCanopy(); game.scene.add(canopy);
  const pack = makePack(); pack.position.set(0, 1.1, -.33);
  let prevY = 0, open = 0, closing = 0, lean = 0, wet = false, fellFrom = 0, hintT = 0;
  const shut = { x: 0, y: 0, z: 0, face: 0 };
  p.sky = null; p.high = false; p.vy = 0; p.chutes = 0;

  // What is under (x, z) for someone at height y: F.y = where their feet would rest; F.roof = that is a building top;
  // F.water = the sea; F.wall = something there stands higher than they are.
  function floor(x, z, y) {
    let top = groundY(x, z, y + .6); F.roof = false; F.wall = false;
    ph.under(x, z, .34, y + SKY.step, seen);
    if (seen.top > top) { top = seen.top; F.roof = true; }
    if (seen.vague) { const h = groundY(x, z) + SKY.vague; if (h > y + SKY.step) F.wall = true; else if (h > top) { top = h; F.roof = true; } }
    if (seen.wall) F.wall = true;
    F.water = !F.roof && top < WATER - .35; F.y = top; return F;
  }
  const solid = (on) => ph.setPersonAir(body, !on, p.up);
  function splash(x, z, power) {
    for (let i = 0; i < 9; i++) { const a = Math.random() * 6.283; game.fx.smoke(x + Math.cos(a) * .6, WATER + .3, z + Math.sin(a) * .6, 1, .9 + power * .05, .6, Math.cos(a) * 3, Math.sin(a) * 3, { alpha: .5, rise: 3 + power * .15 }); }
    game.wake?.foam(x, z, 2.2 + power * .1, 3, 2.4, 1); game.audio.crash(clamp(power / 40, .15, .6));
  }

  const sky = {
    canopy, floor,
    // player.exit(): how is this vehicle being left? 'fall' = out of a helicopter in the air, 'roof' = onto a roof it landed on.
    leaving(car) {
      if (car.stats.craft !== 'heli' || car.ditched) return null;
      if (car.air > 0) return car.y - Math.max(car.floorY ?? groundY(car.x, car.z, car.y + .6), WATER - 1.2) > SKY.step + .6 ? 'fall' : null;
      return car.roofed ? 'roof' : null;
    },
    // ...and what happens next. (vx, vz, vy): what the vehicle was doing.
    begin(kind, y, vx = 0, vz = 0, vy = 0) {
      solid(false); p.swimming = false; p.tumble = 0; wet = false; open = 0; closing = 0;
      if (kind === 'roof') { p.high = true; p.sky = null; p.y = y; return; }
      p.high = false; p.sky = 'fall'; p.y = prevY = y; p.vy = Math.min(2, vy * .6); fellFrom = y;
      vel.x = vx * .85; vel.y = vz * .85; body.setLinvel(vel, true); hintT = 0;
    },
    // Space in free fall.
    open() {
      if (p.sky !== 'fall' || game.over) return;
      if (p.chutes <= 0) { if (game.time > hintT) { hintT = game.time + 2; game.hud.toast('NO PARACHUTE!', 'bad'); } return; }
      if (p.y - floor(p.x, p.z, p.y).y < SKY.openAbove) { if (game.time > hintT) { hintT = game.time + 2; game.hud.toast('TOO LOW!', 'bad'); } return; }
      p.chutes--; p.sky = 'chute'; open = .01; closing = 0; game.audio.whoosh(); game.cam.shake(.25);
    },
    give(n = 1) { if (p.chutes >= SKY.carry) return false; p.chutes = Math.min(SKY.carry, p.chutes + n); return true; },
    // respawned, or put somewhere by a mission: back on the ground
    reset() { if (p.sky || p.high) { p.sky = null; p.high = false; solid(true); } p.vy = 0; open = 0; closing = 0; canopy.visible = false; },

    // ---------- once per physics step, in place of walking, while in the air. ----------
    preStep(dt) {
      const input = game.input, v = body.linvel(), frozen = p.frozen || game.state !== 'playing';
      const f = frozen ? 0 : input.axis(['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp']), r = frozen ? 0 : input.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']);
      if (p.sky === 'fall') {
        // spread out on the air: steer where the camera looks; W tucks in and drops faster
        const yaw = game.cam.yaw, len = Math.hypot(f, r) || 1, mx = (Math.cos(yaw) * f - Math.sin(yaw) * r) / len, mz = (Math.sin(yaw) * f + Math.cos(yaw) * r) / len, go = f || r;
        vel.x = damp(v.x, go ? mx * SKY.steer : 0, SKY.steerRate, dt); vel.y = damp(v.y, go ? mz * SKY.steer : 0, SKY.steerRate, dt);
        const term = f > 0 ? SKY.dive : SKY.terminal;
        if (p.vy > -term) p.vy = Math.max(-term, p.vy - SKY.gravity * dt); else p.vy = Math.min(-term, p.vy + 14 * dt);      // spreading out again after a dive slows you
        p.face += angleDiff(Math.atan2(Math.cos(yaw), Math.sin(yaw)), p.face) * Math.min(1, dt * 4);
        p.diving = f > 0;
        if (!frozen && input.hit('Space')) sky.open();
      } else {
        // under the canopy: it flies forward by itself; A/D turn it, W lets it run, S flares
        open = Math.min(1, open + dt / SKY.openTime);
        p.face -= r * SKY.turn * dt; lean = damp(lean, r * .3, 3, dt);
        const speed = f > 0 ? SKY.fast : f < 0 ? SKY.flare : SKY.glide, sink = f > 0 ? SKY.fastSink : f < 0 ? SKY.flareSink : SKY.sink;
        vel.x = damp(v.x, Math.sin(p.face) * speed, 2.2, dt); vel.y = damp(v.y, Math.cos(p.face) * speed, 2.2, dt);
        p.vy = damp(p.vy, -sink, SKY.brake * open, dt);
      }
      // a wall ahead (a tower taller than you are): slide off it
      floor(p.x + vel.x * dt * 3, p.z + vel.y * dt * 3, p.y);
      if (F.wall || F.y > p.y + SKY.step) {
        const hard = Math.hypot(vel.x, vel.y);
        vel.x *= -.25; vel.y *= -.25; if (hard > 7 && p.sky === 'fall') { game.audio.bonk(); game.cam.shake(.3); p.hurt((hard - 7) * 2); }
      }
      body.setLinvel(vel, true);
      // down
      const fl = floor(p.x, p.z, p.y); prevY = p.y;
      let ny = p.y + p.vy * dt;
      if (fl.water) {
        if (!wet && ny < WATER - .2) { wet = true; const hit = -p.vy; splash(p.x, p.z, hit); if (p.sky === 'fall' && hit > SKY.waterSafe) { p.hurt(Math.min(SKY.waterMax, (hit - SKY.waterSafe) * SKY.waterHurt)); game.cam.shake(.4); } }
        if (wet) p.vy = Math.max(p.vy, -3.2);
      }
      if (ny <= fl.y && !fl.wall) return land(fl, -p.vy);
      p.y = ny;
    },
    // ---------- once per physics step, after walking, while standing on a roof ----------
    onRoof(dt) {
      const v = body.linvel();
      floor(p.x + v.x * dt * 4, p.z + v.y * dt * 4, p.y);
      if (F.wall || F.y > p.y + SKY.step) { vel.x = vel.y = 0; body.setLinvel(vel, true); }
      const fl = floor(p.x, p.z, p.y);
      if (fl.wall) return;
      if (fl.y < p.y - SKY.step) { p.high = false; p.sky = 'fall'; p.vy = 0; prevY = p.y; fellFrom = p.y; wet = false; hintT = 0; }     // walked off the edge
      else if (!fl.roof) { p.high = false; solid(true); }                                                                              // back on honest ground
    },
    // where the feet rest on a roof (player.update eases to it)
    roofY: (x, z, y) => { const fl = floor(x, z, y); return fl.wall ? y : fl.y; },

    // ---------- once per drawn frame ----------
    update(dt, t) {
      // the pack rides on whoever the player is right now
      const back = p.model.userData.body;
      if (p.chutes > 0) { if (pack.parent !== back) back.add(pack); } else if (pack.parent) pack.removeFromParent();
      if (p.sky === 'chute') { shut.x = p.ix; shut.y = sky.drawY() + headRoom(p.model); shut.z = p.iz; shut.face = p.face; setCanopy(canopy, shut.x, shut.y, shut.z, shut.face, open, lean, t); }
      else if (closing > 0) {                       // on the ground: it sags and blows over
        closing = Math.max(0, closing - dt / .9); const k = 1 - closing;
        setCanopy(canopy, shut.x + Math.sin(shut.face) * k * 3, shut.y - k * 4.2, shut.z + Math.cos(shut.face) * k * 3, shut.face, closing * .8 + .2, k * 1.1, t);
        if (!closing) canopy.visible = false;
      } else if (canopy.visible) canopy.visible = false;
      // the air rushing past
      if (p.sky === 'fall' && Math.random() < dt * 14) { const a = Math.random() * 6.283; game.fx.smoke(p.ix + Math.cos(a) * 1.6, sky.drawY() - 1 + Math.random() * 2, p.iz + Math.sin(a) * 1.6, 1, .25, .35, 0, 0, { alpha: .22, rise: -p.vy * .7 }); }
    },
    // the height to draw the player at this frame (between the last two steps)
    drawY: () => lerp(prevY, p.y, game.alpha ?? 1),
    // metres of air under the player
    height: () => p.y - floor(p.x, p.z, p.y).y,
    // the pose for animateCharacter
    pose: () => (p.sky === 'chute' ? 'chute' : p.diving ? 'dive' : 'sky'),
  };

  function land(fl, speed) {
    const was = p.sky, h = Math.hypot(body.linvel().x, body.linvel().y);
    p.sky = null; p.y = prevY = fl.y; p.vy = 0; p.diving = false;
    if (fl.roof) p.high = true; else { p.high = false; solid(true); }
    if (was === 'chute') { closing = open; open = 0; shut.y = fl.y; }
    vel.x = body.linvel().x * .35; vel.y = body.linvel().y * .35; body.setLinvel(vel, true);
    if (wet) return;                                   // the sea took the fall
    const over = speed - SKY.safe, hurt = over > 0 ? over * over * SKY.hurt : 0;
    if (hurt > 0) {
      game.audio.crash(clamp(speed / 30, .2, 1)); game.audio.bonk(); game.cam.shake(clamp(speed * .03, .2, 1));
      for (let i = 0; i < 6; i++) { const a = Math.random() * 6.283; game.fx.smoke(p.x + Math.cos(a) * .5, fl.y + .2, p.z + Math.sin(a) * .5, .8, .7, .6, Math.cos(a) * 2.5, Math.sin(a) * 2.5, { alpha: .35, rise: .6 }); }
      p.hurt(hurt);
      if (!game.over) { p.tumble = clamp(speed * .07, .6, 1.6); if (hurt > 25) game.hud.toast('OUCH!', 'bad'); }
      else if (was === 'fall' && fellFrom - fl.y > 25) game.hud.toast(`${Math.round(fellFrom - fl.y)} M WITHOUT A PARACHUTE`, 'bad');
    } else { game.audio.step(); if (was === 'chute' && h > 5) p.tumble = 0; }
    if (was === 'chute' && !game.over) game.hud.toast('TOUCHDOWN', 'good');
  }

  // ---------- parachute packs lying by the helipads ----------
  const packs = [], ringGeo = new THREE.RingGeometry(.55, .8, 28).rotateX(-Math.PI / 2);
  sky.place = (x, z, ref) => {
    const root = new THREE.Group(), y = groundY(x, z, ref ?? 0); root.position.set(x, y, z); game.scene.add(root);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff7a3d).multiplyScalar(2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    ring.position.y = .04; const m = makePack(); m.scale.setScalar(1.5); m.position.y = .95; root.add(ring, m);
    packs.push({ x, y, z, root, m, ring, wait: 0, phase: Math.random() * 6 });
  };
  sky.packs = packs;
  sky.pickups = (dt, t) => {
    for (const it of packs) {
      if (it.wait > 0) { if ((it.wait -= dt) <= 0) it.root.visible = true; continue; }
      const near = Math.abs(it.x - p.x) < 90 && Math.abs(it.z - p.z) < 90; it.root.visible = near; if (!near) continue;
      it.m.rotation.y = t * 1.6 + it.phase; it.m.position.y = .95 + Math.sin(t * 2.4 + it.phase) * .12; it.ring.material.opacity = .55 + Math.sin(t * 4 + it.phase) * .25;
      if (!game.over && p.mode === 'foot' && Math.abs(it.y - p.y) < 2 && Math.hypot(it.x - p.x, it.z - p.z) < 1.3 && sky.give()) {
        it.wait = SKY.respawn; it.root.visible = false; game.audio.pickup(); game.hud.toast('PARACHUTE: SPACE OPENS IT IN THE AIR', 'good');
      }
    }
  };
  return sky;
}
