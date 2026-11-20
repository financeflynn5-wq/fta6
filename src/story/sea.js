// What story missions do on the water:
//   - a gun on the bow of your boat (left mouse while you are at the wheel; it locks on to whoever is nearest the way you look)
//   - crooks in boats who run you down and shoot, and blow up when their boat is finished
//   - fish, some of them rare, and the spears you throw at them from a boat
//   - a race round buoys against other boats
// None of it runs unless a mission has switched it on. Numbers: STORY2 in config.js.
import * as THREE from 'three';
import { STORY2 as C, BOAT } from '../config.js';
import { clamp, damp, angleDiff, rnd } from '../core/utils.js';
import { groundY } from '../world/terrain.js';
import { WATER } from '../world/map.js';
import { std } from '../world/materials.js';
import { makeCharacter } from '../characters/models.js';

const TAU = Math.PI * 2;
const wetAt = (x, z, deep = .9) => groundY(x, z) < WATER - deep;

export function createSea(game) {
  const p = game.player, traffic = game.traffic, hud = game.hud, audio = game.audio, fx = game.fx, scene = game.scene;
  const playing = () => game.state === 'playing' && !game.over && !p.frozen;
  const boatOf = () => (p.mode === 'car' && p.vehicle.stats.craft === 'boat' && !p.vehicle.wrecked ? p.vehicle : null);

  // ---------- the thing you are aiming at ----------
  // The nearest of `list` ({ x, z }) to the way the camera looks, within `cone` radians (wider up close) and `range` metres.
  function lock(list, range, cone) {
    const yaw = game.cam.yaw; let best = null, bo = 9;
    for (const o of list) {
      const d = Math.hypot(o.x - p.x, o.z - p.z); if (d > range || d < 1.5) continue;
      const off = Math.abs(angleDiff(Math.atan2(o.z - p.z, o.x - p.x), yaw)); if (off < cone + 2.5 / d && off < bo) { bo = off; best = o; }
    }
    return best;
  }
  // a ring lying on the water: under whatever is locked, or out ahead where a shot would land
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  const reticle = new THREE.Group(); reticle.visible = false; scene.add(reticle);
  { const a = new THREE.Mesh(new THREE.RingGeometry(.86, 1, 40).rotateX(-Math.PI / 2), ringMat); reticle.add(a); for (let i = 0; i < 4; i++) { const t = new THREE.Mesh(new THREE.PlaneGeometry(.5, .12).rotateX(-Math.PI / 2), ringMat); t.position.set(Math.cos(i * Math.PI / 2) * 1.25, 0, Math.sin(i * Math.PI / 2) * 1.25); t.rotation.y = -i * Math.PI / 2; reticle.add(t); } }
  function aimRing(x, z, size, color, t) { reticle.visible = true; reticle.position.set(x, WATER + .22, z); reticle.scale.setScalar(size * (1 + Math.sin(t * 9) * .05)); reticle.rotation.y = t * 1.4; ringMat.color.setHex(color); }
  const tip = document.createElement('div'); tip.className = 'prompt'; tip.style.bottom = '17%'; tip.hidden = true; document.getElementById('hud').appendChild(tip);
  let tipHtml = '';
  const setTip = (h) => { if (h !== tipHtml) { tip.innerHTML = h; tip.hidden = !h; tipHtml = h; } };

  // ---------- big bangs ----------
  function explode(x, y, z, size = 1) {
    for (let i = 0; i < 4; i++) fx.spark(x + rnd(-1, 1), y + .8, z + rnd(-1, 1), 12, 1.7 * size);
    for (let i = 0; i < 14; i++) fx.fire(x + rnd(-1.6, 1.6) * size, y + rnd(.2, 1.6), z + rnd(-1.6, 1.6) * size, 1.9 * size, rnd(-5, 5), rnd(-5, 5));
    for (let i = 0; i < 9; i++) fx.smoke(x + rnd(-1.5, 1.5), y + 1 + rnd(0, 1.5), z + rnd(-1.5, 1.5), .08, 2.4 * size, 2.8, rnd(-2, 2), rnd(-2, 2), { rise: 4, grow: 2.4, alpha: .88 });
    game.combat.gfx.flash(x, y + 1.2, z, 7 * size);
    const d = Math.hypot(x - p.x, z - p.z);
    audio.crash(clamp(1.25 - d / 140, .2, 1)); audio.shot(2.4, clamp(1.1 - d / 160, .15, 1)); game.cam.shake(clamp(.9 - d / 110, 0, .8));
  }
  const splash = (x, z, size = 1) => { for (let i = 0; i < 5; i++) fx.smoke(x + rnd(-.3, .3), WATER + .3, z + rnd(-.3, .3), 1, .5 * size, .5, rnd(-1.5, 1.5), rnd(-1.5, 1.5), { alpha: .55, rise: 2.6 * size }); game.wake?.foam(x, z, 1.1 * size, 1.6, 1.6, .9); };

  // ---------- the bow gun ----------
  const gunMat = std({ color: 0x2b2f35, roughness: .45, metalness: .7 }), gunTrim = std({ color: 0xf2c230, roughness: .5 });
  function makeGun() {
    const g = new THREE.Group(), turn = new THREE.Group(), add = (geo, m, x, y, z, into = turn) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; into.add(o); return o; };
    add(new THREE.CylinderGeometry(.13, .2, .42, 10), gunMat, 0, .21, 0, g);
    turn.position.y = .5; g.add(turn);
    add(new THREE.BoxGeometry(.5, .26, .34), gunMat, .02, 0, 0);
    for (const s of [-1, 1]) { const b = add(new THREE.CylinderGeometry(.035, .035, 1.05, 8), gunMat, .72, .02, s * .08); b.rotation.z = Math.PI / 2; }
    add(new THREE.BoxGeometry(.06, .5, .7), gunTrim, .3, .08, 0); add(new THREE.BoxGeometry(.22, .22, .3), gunTrim, -.3, -.02, 0);
    g.userData.turn = turn; return g;
  }
  const gun = { boat: null, mesh: makeGun(), cool: 0, yaw: 0 };
  function updateGun(dt, t) {
    const v = gun.boat; if (!v) return false;
    if (v.gone) { gun.boat = null; return false; }
    if (p.vehicle !== v || v.wrecked) return false;
    const foes = raiders.filter(r => !r.out).map(r => r.v), tg = lock(foes, C.gun.range, C.gun.cone);
    const want = tg ? Math.atan2(tg.z - v.z, tg.x - v.x) : game.cam.yaw;
    gun.yaw += angleDiff(want, gun.yaw) * Math.min(1, dt * 14); gun.mesh.userData.turn.rotation.y = -(gun.yaw - v.ih);
    if (tg) aimRing(tg.ix, tg.iz, 4.2, 0xff3048, t); else aimRing(v.ix + Math.cos(game.cam.yaw) * 42, v.iz + Math.sin(game.cam.yaw) * 42, 2.2, 0xffffff, t);
    setTip('<kbd>L-Click</kbd> Bow gun');
    gun.cool -= dt;
    if (!playing() || !game.input.down('Mouse0') || gun.cool > 0) return true;
    gun.cool = 1 / C.gun.rate;
    const mx = v.ix + Math.cos(v.ih) * 1.5 + Math.cos(gun.yaw) * 1.2, mz = v.iz + Math.sin(v.ih) * 1.5 + Math.sin(gun.yaw) * 1.2, my = v.y + 1.12;
    let ex, ey, ez;
    if (tg) {
      const d = Math.hypot(tg.x - v.x, tg.z - v.z), hit = Math.random() < clamp(1.02 - d / C.gun.range * .55, .4, .95);
      if (hit) { ex = tg.x + rnd(-1.2, 1.2); ey = tg.y + rnd(.2, .9); ez = tg.z + rnd(-1.2, 1.2); tg.damage(C.gun.damage); fx.spark(ex, ey, ez, 4, .8); if (Math.random() < .5) audio.ting(); game.combat.hitMarker(tg.wrecked); }
      else { const k = 1 + rnd(.05, .4), a = gun.yaw + rnd(-.05, .05); ex = v.x + Math.cos(a) * d * k; ez = v.z + Math.sin(a) * d * k; ey = WATER; splash(ex, ez, .8); }
    } else { const a = gun.yaw + rnd(-.03, .03), d = rnd(55, 90); ex = v.x + Math.cos(a) * d; ez = v.z + Math.sin(a) * d; ey = WATER; if (wetAt(ex, ez, 0)) splash(ex, ez, .8); }
    game.combat.gfx.tracer(mx, my, mz, ex, ey, ez, .04, .07); game.combat.gfx.flash(mx, my, mz, .8); audio.shot(1.15, .6); game.cam.shake(.035);
    return true;
  }

  // ---------- crooks in boats ----------
  const raiders = [];
  let sunk = 0;
  function sail(v, tx, tz, pace) {
    const c = v.controls, off = angleDiff(Math.atan2(tz - v.z, tx - v.x), v.h);
    let steer = clamp(off * 1.9, -1, 1), thr = Math.cos(off) > .15 ? pace : pace * .5;
    // shallows ahead: turn for the deeper side
    const look = 7 + v.speed * .9, shoal = (a) => groundY(v.x + Math.cos(v.h + a) * look, v.z + Math.sin(v.h + a) * look) > WATER - .85;
    if (shoal(0) || shoal(.3) || shoal(-.3)) { const l = shoal(-.9), r = shoal(.9); steer = l && !r ? 1 : r && !l ? -1 : steer >= 0 ? 1 : -1; thr = Math.min(thr, v.speed > 8 ? -.5 : .45); }
    c.steer = steer; c.throttle = thr; c.handbrake = false;
  }
  function updateRaiders(dt) {
    for (const r of raiders) {
      const v = r.v; if (r.out) continue;
      if (v.gone || v.driver !== r.pilot) { r.out = true; sunk++; continue; }
      if (v.wrecked) {
        r.out = true; sunk++; explode(v.x, v.y, v.z, 1.1); game.wake?.foam(v.x, v.z, 6, 3.5, 4, 1);
        v.sink = BOAT.sinkTime - 2.2; v.outlaw = false; v.temp = true; v.driver = null; v.body.setAngvel(rnd(-2, 2), true);
        r.onSunk?.(r); continue;
      }
      const tb = p.mode === 'car' ? p.vehicle : null, dist = Math.hypot(p.x - v.x, p.z - v.z), lead = clamp(dist / 26, 0, 1.2);
      // run at you from the side they were given, and swing wide instead of parking on top of you
      let tx = p.x + p.vx * lead, tz = p.z + p.vz * lead;
      if (dist > 22) { const s = p.speed + 1; tx += -p.vz / s * r.flank; tz += p.vx / s * r.flank; }
      else if (dist < 14 && p.speed < 6) { r.orbit += dt * .9; tx = p.x + Math.cos(r.orbit) * 16; tz = p.z + Math.sin(r.orbit) * 16; }
      v.stats.maxSpeed = r.top * (dist > 55 ? C.raider.fast : C.raider.pace);      // quicker than you until they have caught you up, then they hold station and shoot
      sail(v, tx, tz, game.over ? 0 : 1);
      // the one riding shotgun opens up
      if (dist < C.raider.range && !game.over && (r.fireT -= dt) <= 0) {
        r.fireT = C.raider.rate * rnd(.7, 1.3);
        const sx = v.x + v.fx * .6, sy = v.y + 1.25, sz = v.z + v.fz * .6, ty = (tb ? tb.y + .7 : p.y + 1.1);
        const hit = Math.random() < C.raider.accuracy * (1 - dist / C.raider.range * .55) * (p.speed > 16 ? .7 : 1);
        let ex = p.x, ez = p.z; if (!hit) { const a = Math.random() * TAU, m = 2 + Math.random() * 3; ex += Math.cos(a) * m; ez += Math.sin(a) * m; }
        game.combat.gfx.tracer(sx, sy, sz, ex, hit ? ty : WATER, ez, .02); game.combat.gfx.flash(sx, sy, sz, .5); audio.shot(1, clamp(1 - dist / 80, .12, .7));
        if (!hit) { if (wetAt(ex, ez, 0)) splash(ex, ez, .6); }
        else if (tb) { tb.damage(C.raider.damage); fx.spark(ex, ty, ez, 4, .5); audio.ting(); game.hud.hurt?.(); }
        else p.hurt(C.raider.damage * 1.5);
      }
    }
  }

  // ---------- fish and spears ----------
  const fishMat = { rare: std({ color: 0xffc83d, roughness: .25, metalness: .75, emissive: 0xff9a1f, emissiveIntensity: .55 }), sail: std({ color: 0xff6a3d, roughness: .5, emissive: 0xff5a2a, emissiveIntensity: .35, side: THREE.DoubleSide }), plain: std({ color: 0x8fb4c9, roughness: .35, metalness: .5 }), fin: std({ color: 0x4f7890, roughness: .6, side: THREE.DoubleSide }) };
  const fishGeo = {};
  function makeFish(rare) {
    if (!fishGeo.body) {
      fishGeo.body = new THREE.SphereGeometry(1, 16, 10); fishGeo.bill = new THREE.ConeGeometry(1, 1, 8).rotateZ(-Math.PI / 2);
      const tri = (pts) => { const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (const [x, y] of pts.slice(1)) s.lineTo(x, y); return new THREE.ShapeGeometry(s); };
      fishGeo.sail = tri([[-.55, 0], [-.35, .5], [-.05, .62], [.3, .5], [.5, .12], [.55, 0]]); fishGeo.tail = tri([[0, 0], [-.42, .44], [-.3, 0], [-.42, -.44]]); fishGeo.fin = tri([[0, 0], [-.3, -.26], [.08, -.05]]);
    }
    const g = new THREE.Group(), L = rare ? 1.15 : .55, body = rare ? fishMat.rare : fishMat.plain, fin = rare ? fishMat.sail : fishMat.fin;
    const add = (geo, m, x, y, z, sx, sy, sz) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; g.add(o); return o; };
    add(fishGeo.body, body, 0, 0, 0, L, L * .27, L * .19);
    if (rare) add(fishGeo.bill, body, L * 1.25, .03, 0, L * .62, L * .035, L * .035);
    add(fishGeo.sail, fin, -L * .05, L * .2, 0, L * 1.5, L * (rare ? 1.05 : .5), 1);
    const tail = new THREE.Group(); tail.position.set(-L * .92, 0, 0); g.add(tail);
    const tf = new THREE.Mesh(fishGeo.tail, fin); tf.scale.setScalar(L * 1.15); tf.castShadow = true; tail.add(tf);
    for (const s of [-1, 1]) { const f = add(fishGeo.fin, fin, L * .25, -L * .1, s * L * .12, L, L, 1); f.rotation.x = s * 1.1; }
    g.userData.tail = tail; g.rotation.order = 'YZX'; g.visible = false; scene.add(g);
    return g;
  }
  const fish = [];          // { x, z, h, v, rare, home, under, leap, mesh, out }
  let school = null;        // { x, z, r, caught, onCatch }
  const spearGeo = new THREE.CylinderGeometry(.022, .022, 2.1, 6).rotateZ(Math.PI / 2), headGeo = new THREE.ConeGeometry(.06, .3, 6).rotateZ(-Math.PI / 2);
  const spearMat = std({ color: 0xb98a54, roughness: .7 }), headMat = std({ color: 0xcfd3d8, roughness: .25, metalness: .9 });
  const spears = [];
  for (let i = 0; i < 4; i++) { const g = new THREE.Group(); g.add(new THREE.Mesh(spearGeo, spearMat)); const h = new THREE.Mesh(headGeo, headMat); h.position.x = 1.15; g.add(h); g.rotation.order = 'YZX'; g.visible = false; scene.add(g); spears.push({ g, t: -1 }); }
  let spearCool = 0, spearHeld = false;

  function scare(x, z, r, hard = false) { for (const f of fish) if (!f.out && f.under <= 0 && Math.hypot(f.x - x, f.z - z) < r) { f.fleeT = 2.5; f.fx = x; f.fz = z; if (hard && Math.random() < .5) dive(f); } }
  function dive(f) { f.under = rnd(3, 5); splash(f.x, f.z, .7); f.mesh.visible = false; }
  function updateFish(dt, t) {
    const b = boatOf();
    for (const f of fish) {
      if (f.out) continue;
      const S = school, dHome = Math.hypot(f.x - S.x, f.z - S.z), dBoat = Math.hypot(f.x - p.x, f.z - p.z);
      if (f.under > 0) {
        // down in the deep: comes up again somewhere away from the boat
        if ((f.under -= dt) <= 0) {
          for (let i = 0; i < 12; i++) { const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * S.r, x = S.x + Math.cos(a) * r, z = S.z + Math.sin(a) * r; if (wetAt(x, z) && Math.hypot(x - p.x, z - p.z) > 22) { f.x = x; f.z = z; break; } }
          f.h = Math.random() * TAU; f.leap = .001; splash(f.x, f.z, .6);
        }
        continue;
      }
      // a boat coming at them: they bolt, and one right on top of them sends them under
      if (b && dBoat < C.fish.dive && b.speed > 3) { dive(f); continue; }
      if (b && dBoat < C.fish.scare && b.speed > C.fish.calm) { f.fleeT = 2; f.fx = p.x; f.fz = p.z; }
      let want = f.wander, speed = C.fish.speed * (f.rare ? 1.25 : 1);
      if ((f.turnT -= dt) <= 0) { f.turnT = rnd(1.5, 4); f.wander = f.h + rnd(-1.3, 1.3); }
      if (f.fleeT > 0) { f.fleeT -= dt; want = Math.atan2(f.z - f.fz, f.x - f.fx); speed = C.fish.flee; }
      else if (dHome > S.r || !wetAt(f.x + Math.cos(f.h) * 6, f.z + Math.sin(f.h) * 6)) want = Math.atan2(S.z - f.z, S.x - f.x);
      f.h += angleDiff(want, f.h) * Math.min(1, dt * (f.fleeT > 0 ? 4 : 1.6)); f.v = damp(f.v, speed, 3, dt);
      f.vx = Math.cos(f.h) * f.v; f.vz = Math.sin(f.h) * f.v; f.x += f.vx * dt; f.z += f.vz * dt;
      // a leap now and then, so you can spot them from a long way off
      if (f.leap > 0) { f.leap += dt / (f.rare ? 1.1 : .8); if (f.leap >= 1) { f.leap = 0; f.leapT = rnd(f.rare ? 3 : 5, f.rare ? 6.5 : 12); splash(f.x, f.z, f.rare ? 1 : .6); } }
      else if ((f.leapT -= dt) <= 0) { f.leap = .001; splash(f.x, f.z, f.rare ? .8 : .5); }
      const near = dBoat < 170; f.mesh.visible = near; if (!near) continue;
      const k = f.leap, up = k > 0 ? Math.sin(k * Math.PI) * (f.rare ? 1.9 : 1) : 0, m = f.mesh;
      f.y = WATER - (f.rare ? .06 : .1) + Math.sin(t * 2.3 + f.x) * .04 + up;
      m.position.set(f.x, f.y, f.z); m.rotation.set(0, -f.h, k > 0 ? Math.cos(k * Math.PI) * .85 : Math.sin(t * 2 + f.z) * .05);
      m.userData.tail.rotation.y = Math.sin(t * (9 + f.v * 1.5) + f.x) * .5;
      if (f.rare && Math.random() < dt * 5) fx.spark(f.x + rnd(-.6, .6), f.y + .3, f.z + rnd(-.6, .6), 1, .25);
    }
  }
  function throwSpear(b, tg) {
    const s = spears.find(o => o.t < 0) || spears[0], yaw = game.cam.yaw;
    s.x0 = b.x + Math.cos(b.h) * .4; s.z0 = b.z + Math.sin(b.h) * .4; s.y0 = b.y + 1.7;
    let d = tg ? Math.hypot(tg.x - s.x0, tg.z - s.z0) : C.spear.range * .7;
    s.T = Math.max(.25, d / C.spear.speed);
    if (tg) { s.x1 = tg.x + tg.vx * s.T * .9; s.z1 = tg.z + tg.vz * s.T * .9; } else { s.x1 = s.x0 + Math.cos(yaw) * d; s.z1 = s.z0 + Math.sin(yaw) * d; }
    s.t = 0; s.g.visible = true; audio.whoosh(); spearCool = C.spear.cool;
  }
  function landSpear(s) {
    s.t = -1; s.g.visible = false; splash(s.x1, s.z1, .9);
    let best = null, bd = C.spear.hit;
    for (const f of fish) { if (f.out || f.under > 0) continue; const d = Math.hypot(f.x - s.x1, f.z - s.z1) - (f.rare ? .5 : 0); if (d < bd) { bd = d; best = f; } }
    scare(s.x1, s.z1, 13, true);
    if (!best) return;
    best.out = true; best.mesh.visible = false; splash(best.x, best.z, 1.6); fx.spark(best.x, WATER + .4, best.z, 10, .8); audio.pickup();
    if (best.rare) { school.caught++; school.onCatch?.(school.caught, best); }
    else { game.addMoney(C.fish.pay); hud.toast(`JUST A SNAPPER  +$${C.fish.pay}`, 'info'); }
  }
  function updateSpears(dt, t) {
    for (const s of spears) {
      if (s.t < 0) continue;
      s.t += dt / s.T; const k = Math.min(1, s.t), arc = Math.hypot(s.x1 - s.x0, s.z1 - s.z0) * .09;
      const x = s.x0 + (s.x1 - s.x0) * k, z = s.z0 + (s.z1 - s.z0) * k, y = s.y0 + (WATER - .2 - s.y0) * k + Math.sin(k * Math.PI) * arc;
      const dy = (WATER - .2 - s.y0) + Math.cos(k * Math.PI) * Math.PI * arc;
      s.g.position.set(x, y, z); s.g.rotation.set(0, -Math.atan2(s.z1 - s.z0, s.x1 - s.x0), Math.atan2(dy, Math.hypot(s.x1 - s.x0, s.z1 - s.z0)));
      if (s.t >= 1) landSpear(s);
    }
    if (!school) return false;
    const b = boatOf(); spearCool -= dt;
    if (!b) { spearHeld = game.input.down('Mouse0'); return false; }
    const seen = fish.filter(f => !f.out && f.under <= 0), tg = lock(seen, C.spear.range, C.spear.cone);
    if (tg) aimRing(tg.x, tg.z, tg.rare ? 2.4 : 1.6, tg.rare ? 0xffd34d : 0x9fe8ff, t); else aimRing(b.ix + Math.cos(game.cam.yaw) * C.spear.range * .7, b.iz + Math.sin(game.cam.yaw) * C.spear.range * .7, 1.5, 0xffffff, t);
    setTip(`<kbd>L-Click</kbd> Throw a spear${tg ? (tg.rare ? ' · <b style="color:#ffd34d">GOLDEN MARLIN</b>' : ' · snapper') : ''}`);
    const down = game.input.down('Mouse0');
    if (playing() && down && !spearHeld && spearCool <= 0) throwSpear(b, tg);
    spearHeld = down;
    return true;
  }

  // ---------- a race round buoys ----------
  const buoyMat = [std({ color: 0xff7a2f, roughness: .5 }), std({ color: 0xf4f1ea, roughness: .5 }), std({ color: 0xfff1c9, emissive: 0xffc94d, emissiveIntensity: 2 })];
  const buoyGeo = [new THREE.CylinderGeometry(.75, .9, .7, 14), new THREE.ConeGeometry(.6, 2.2, 14), new THREE.SphereGeometry(.2, 10, 8)];
  const buoys = [];
  function buoy(x, z) {
    let b = buoys.find(o => !o.used);
    if (!b) { const g = new THREE.Group(); const a = new THREE.Mesh(buoyGeo[0], buoyMat[1]), c = new THREE.Mesh(buoyGeo[1], buoyMat[0]), l = new THREE.Mesh(buoyGeo[2], buoyMat[2]); a.position.y = .1; c.position.y = 1.5; l.position.y = 2.7; g.add(a, c, l); scene.add(g); b = { g, used: false }; buoys.push(b); }
    b.used = true; b.x = x; b.z = z; b.g.visible = true; b.g.position.set(x, WATER, z); return b;
  }
  let race = null;
  const progress = (o, gates) => { const g = gates[Math.min(o.i, gates.length - 1)]; return o.i - clamp(Math.hypot(g[0] - o.x, g[1] - o.z) / 400, 0, .99); };
  function updateRace(dt, t) {
    const R = race, K = C.race; if (!R) return;
    for (const b of buoys) if (b.used) { b.g.position.y = WATER + Math.sin(t * 1.6 + b.x) * .07; b.g.rotation.z = Math.sin(t * 1.2 + b.z) * .05; }
    for (const m of R.marks) m.tick(t, p, 900);
    if (R.hold) { for (const r of R.rivals) { r.v.controls.throttle = 0; r.v.controls.steer = 0; r.v.controls.handbrake = true; } return; }      // lined up, waiting for you
    if (R.count > 0) {                                   // 3, 2, 1...
      const before = Math.ceil(R.count); R.count -= dt; p.frozen = true;
      for (const r of R.rivals) { r.v.controls.throttle = 0; r.v.controls.steer = 0; r.v.controls.handbrake = true; }
      if (Math.ceil(R.count) !== before && R.count > 0) { game.activities.kit.ui.banner(String(Math.ceil(R.count)), R.name, 'count', 1); audio.click(); }
      if (R.count <= 0) { p.frozen = false; game.activities.kit.ui.banner('GO!', '', 'go', 1); audio.star(); }
      return;
    }
    if (R.over) return;
    R.t += dt;
    const me = { i: R.i, x: p.x, z: p.z }, mine = progress(me, R.gates);
    let place = 1;
    for (const r of R.rivals) {
      const v = r.v; if (v.gone || v.wrecked) { r.dead = true; continue; }
      if (r.done) { place++; sail(v, v.x + v.fx * 30, v.z + v.fz * 30, .3); continue; }
      const g = R.gates[r.i], nx = R.normals[r.i], tx = g[0] + nx[0] * r.lane, tz = g[1] + nx[1] * r.lane;
      r.x = v.x; r.z = v.z; const gap = progress(r, R.gates) - mine;
      // they ease off when they are ahead and dig in when they are behind, so it stays a race; a clean run still beats them
      // (a boat's throttle hardly changes its top speed, so it is the top speed that is turned up and down)
      v.stats.maxSpeed = r.top * clamp(r.skill - gap * K.band, K.slow, K.fast);
      sail(v, tx, tz, 1);
      if (Math.hypot(g[0] - v.x, g[1] - v.z) < K.gate + 2) { if (++r.i >= R.gates.length) { r.done = true; R.beaten = true; } }
      if (gap > 0) place++;
    }
    R.place = place;
    const g = R.gates[R.i];
    if (boatOf() && Math.hypot(g[0] - p.x, g[1] - p.z) < K.gate) {
      R.i++; audio.pickup();
      if (R.i >= R.gates.length) { R.over = true; R.won = !R.beaten; for (const m of R.marks) m.hide(); return; }
      aimGate();
    }
    if (R.beaten) { R.over = true; R.won = false; for (const m of R.marks) m.hide(); }
  }
  function aimGate() {
    const R = race, a = R.gates[R.i], b = R.gates[R.i + 1], last = R.i === R.gates.length - 1;
    R.marks[0].place(a[0], a[1], WATER); R.marks[0].setColor(last ? 0xffffff : 0xffd34d); R.blip.x = a[0]; R.blip.z = a[1]; R.blip.glyph = last ? '⚑' : '';
    if (b) R.marks[1].place(b[0], b[1], WATER); else R.marks[1].hide();
  }

  const sea = {
    raiders, wetAt,
    // ----- the bow gun: fit it to a boat (the player's, for this mission)
    arm(v) { gun.boat = v; gun.yaw = v.h; v.mesh.add(gun.mesh); gun.mesh.position.set(1.55, .52, 0); },
    disarm() { gun.boat = null; gun.mesh.removeFromParent(); },
    // ----- crooks in boats. Returns the raider; sea.sunk counts the ones finished off since the last clear()
    raider(x, z, h, o = {}) {
      const v = traffic.add('speedboat', x, z, h, 0x23262e); v.temp = false; v.outlaw = true; v.stolen = true; v.health = C.raider.health;
      v.stats = { ...v.stats, accel: v.stats.accel * C.raider.fast };      // a copy of the boat's numbers, so theirs can be quicker than yours: you can't just run
      const pilot = { raider: true }; v.driver = pilot; v.seat(makeCharacter('possum')); game.env?.touch();
      const r = { v, pilot, top: v.stats.maxSpeed, out: false, fireT: rnd(1.5, 3), flank: o.flank ?? (raiders.length % 3 - 1) * 9, orbit: Math.random() * TAU, onSunk: o.onSunk };
      raiders.push(r); return r;
    },
    get sunk() { return sunk; }, afloat: () => raiders.filter(r => !r.out).length,
    // put a raider that has been left far behind somewhere else
    move(r, x, z, h) { if (!r.out && !r.v.gone) r.v.teleport(x, z, h); },
    // A spot of open water between rMin and rMax metres from (cx, cz), preferring the side `toward` (an angle) when given. null if none found.
    openWater(cx, cz, rMin, rMax, toward = null, spread = Math.PI) {
      for (let i = 0; i < 30; i++) {
        const a = toward === null ? Math.random() * TAU : toward + rnd(-spread, spread), r = rnd(rMin, rMax), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
        let wet = true; for (let k = 0; k <= 5 && wet; k++) wet = wetAt(cx + (x - cx) * k / 5, cz + (z - cz) * k / 5, k ? .9 : -9);
        if (!wet || traffic.vehicles.some(o => Math.abs(o.x - x) < 9 && Math.abs(o.z - z) < 9)) continue;
        return { x, z, h: Math.atan2(cz - z, cx - x) };
      }
      return null;
    },
    explode,
    // ----- fish: a school round (x, z). rare / common: how many of each. onCatch(n, fish) when a rare one is speared.
    school(x, z, r, { rare = C.fish.rare, common = C.fish.common, onCatch } = {}) {
      sea.endSchool(); school = { x, z, r, caught: 0, onCatch };
      for (let i = 0; i < rare + common; i++) {
        const isRare = i < rare; let fx0 = x, fz0 = z;
        for (let k = 0; k < 20; k++) { const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * r * (isRare ? 1 : .9); fx0 = x + Math.cos(a) * d; fz0 = z + Math.sin(a) * d; if (wetAt(fx0, fz0) && (!isRare || fish.every(f => !f.rare || Math.hypot(f.x - fx0, f.z - fz0) > r * .5))) break; }
        fish.push({ x: fx0, z: fz0, y: WATER, h: Math.random() * TAU, v: 0, vx: 0, vz: 0, rare: isRare, under: 0, leap: 0, leapT: rnd(1, 6), turnT: 0, wander: 0, fleeT: 0, fx: 0, fz: 0, out: false, mesh: makeFish(isRare) });
      }
      return school;
    },
    get fish() { return fish; },
    endSchool() { for (const f of fish) { scene.remove(f.mesh); } fish.length = 0; school = null; for (const s of spears) { s.t = -1; s.g.visible = false; } },
    // ----- a race. gates: [[x, z], ...] in order; rivals: how many; grid: [[x, z, heading], ...] with the player's place first.
    // hold: the others wait on the line until you call start() on what this returns.
    race({ name, gates, rivals = 3, grid, hold = false }) {
      sea.endRace();
      const kit = game.activities.kit, K = C.race, normals = gates.map((g, i) => { const a = gates[i - 1] || grid[0], b = gates[i + 1] || g, dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return [-dz / l, dx / l]; });
      const R = race = { name, gates, normals, i: 0, t: 0, count: 3.999, hold, rivals: [], marks: [kit.marker(0xffd34d, K.gate, true), kit.marker(0xffb23d, K.gate * .8)], over: false, won: false, beaten: false, place: 1 };
      R.start = () => { if (!R.hold) return; R.hold = false; aimGate(); kit.ui.banner('3', name, 'count', 1); audio.click(); };
      gates.forEach((g, i) => { for (const s of [-1, 1]) buoy(g[0] + normals[i][0] * s * (K.gate - 1.5), g[1] + normals[i][1] * s * (K.gate - 1.5)); });
      for (let k = 0; k < rivals; k++) {
        const [x, z, h] = grid[k + 1];
        for (const o of traffic.vehicles.slice()) if (!o.driver && Math.hypot(o.x - x, o.z - z) < 6) traffic.remove(o);      // whatever was left on the line makes way
        const v = traffic.add('speedboat', x, z, h, [0xff2d55, 0x34e06b, 0xb980ff, 0xff7a00][k % 4]);
        v.temp = false; v.outlaw = true; v.stolen = true; v.driver = { racer: true }; v.stats = { ...v.stats }; v.seat(makeCharacter(['possum', 'raccoon', 'scrap'][k % 3]));
        R.rivals.push({ v, top: v.stats.maxSpeed, i: 0, x, z, done: false, skill: K.skill[k % K.skill.length], lane: (k - (rivals - 1) / 2) * 5 });
      }
      R.blip = kit.blip({ x: 0, z: 0, color: '#ffd34d', glyph: '', pin: true, hot: true, size: 7, visible: () => !R.hold }); game.env?.touch();
      if (hold) { for (const m of R.marks) m.hide(); } else { aimGate(); kit.ui.banner('3', name, 'count', 1); audio.click(); }
      return R;
    },
    get racing() { return race; },
    endRace() {
      if (!race) return;
      for (const m of race.marks) m.hide(); game.activities.kit.unblip(race.blip);
      // the others go home: out of the world if you are not close enough to watch, left drifting if you are
      for (const r of race.rivals) { const v = r.v; if (v.gone) continue; v.dropRider(); if (Math.hypot(v.x - p.x, v.z - p.z) > 70 || race.hold) { traffic.remove(v); continue; } v.outlaw = false; v.temp = true; v.driver = null; v.controls.throttle = 0; v.controls.steer = 0; }
      for (const b of buoys) { b.used = false; b.g.visible = false; }
      if (!race.hold && race.count > 0 && race.count < 3.999 && !game.over) p.frozen = false;
      race = null;
    },

    // Everything a mission put on the water goes away (story.js, when a mission ends any way at all).
    clear() {
      sea.disarm(); sea.endSchool(); sea.endRace();
      for (const r of raiders) { const v = r.v; if (v.gone) continue; if (v.driver === r.pilot) { if (v.wrecked) v.driver = null; else traffic.remove(v); } else { v.outlaw = false; v.temp = true; } }
      raiders.length = 0; sunk = 0; reticle.visible = false; setTip('');
    },
    update(dt, t) {
      if (!gun.boat && !raiders.length && !school && !race && spears.every(s => s.t < 0)) { if (reticle.visible) reticle.visible = false; if (tipHtml) setTip(''); return; }
      updateRaiders(dt); updateFish(dt, t); updateRace(dt, t);
      const aiming = updateGun(dt, t) | updateSpears(dt, t);
      if (!aiming) { reticle.visible = false; setTip(''); }
    },
  };
  return sea;
}
