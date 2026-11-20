// Rocco's side of a fight: which weapons he carries, punching (jab, cross, haymaker), the knife, blocking,
// aiming, shooting and reloading, and how he holds each weapon. Damage rules live in hits.js; cops shooting back in copGuns.js.
import * as THREE from 'three';
import { WEAPONS, COMBAT, AIM, MELEE } from '../config.js';
import { damp, angleDiff, clamp, lerp, TAU } from '../core/utils.js';
import { makeWeapon } from './weaponModels.js';
import { createHits } from './hits.js';
import { createGunFx } from './gunfx.js';
import { createSightView } from './sightView.js';

export const WEAPON_ORDER = Object.keys(WEAPONS).sort((a, b) => WEAPONS[a].slot - WEAPONS[b].slot);
const HALF_PI = Math.PI / 2;

export function createCombat(game) {
  const hits = createHits(game), gfx = createGunFx(game.scene), view = createSightView(game);     // view: the gun as seen down its sights
  const player = game.player; let arms = player.model.userData.arms;
  const guns = {};                      // the gun meshes in Rocco's right hand, made on first pickup
  const muzzle = new THREE.Vector3(), d = new THREE.Vector3(), shot = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  let reportT = 0;

  const combat = {
    hits, gfx, view, guns, weapon: 'fists', owned: new Set(['fists']), clip: {}, ammo: {},
    aiming: false, aimT: 0, aimBlend: 0, aimPitch: 0, scopeStep: 0, spread: 0, onTarget: false, ready: false, cool: 0, reloading: 0, burstLeft: 0, burstT: 0,
    swingT: 0, swingDur: .3, swingKind: 'jab', swingSide: 0, lastShot: -9, lastSwing: -9, hitT: 0, killHit: false, bloom: 0, kick: 0,
    guard: false, combo: 0, heavy: false, swingFace: null, landT: 0, lungeT: 0,        // fists and knife: blocking, punches landed in a row, the blow on its way, the step in
    get def() { return WEAPONS[combat.weapon]; },

    // Pick up a gun, or more rounds for one we already have.
    give(id, rounds = WEAPONS[id].give) {
      const w = WEAPONS[id];
      if (id === 'fists') return;
      if (!combat.owned.has(id)) {
        combat.owned.add(id); if (!w.melee) { combat.clip[id] = Math.min(w.mag, rounds); combat.ammo[id] = rounds - combat.clip[id]; }
        if (!guns[id]) {
          const g = makeWeapon(id); g.visible = false; arms[0].add(g); guns[id] = g;
          if (w.blade) { g.position.set(0, -.47, .04); g.rotation.set(Math.PI / 4, 0, 0); } else { g.position.set(0, -.5, .02); g.rotation.set(HALF_PI, 0, 0); }
        }
        if (combat.weapon === 'fists' || WEAPONS[combat.weapon].slot < w.slot) combat.select(id);
      } else if (!w.melee) combat.ammo[id] += rounds;
    },
    select(id) {
      if (!combat.owned.has(id) || combat.weapon === id) return;
      combat.weapon = id; combat.reloading = 0; combat.burstLeft = 0; combat.cool = Math.max(combat.cool, .2);
      game.audio.equip(); game.hud.toast(WEAPONS[id].name, 'info');
    },
    // Nabbed: the cops keep your guns. Wasted: you keep them.
    reset(confiscate) {
      combat.aiming = false; combat.reloading = 0; combat.burstLeft = 0; combat.lastShot = -9; combat.guard = false; combat.combo = 0; combat.landT = 0;
      if (confiscate) { combat.owned = new Set(['fists']); combat.clip = {}; combat.ammo = {}; combat.weapon = 'fists'; }
    },
    // The player turned into someone else: move the guns to the new right hand, and repaint the hands in the sight view.
    rehand() {
      arms = player.model.userData.arms; for (const g of Object.values(guns)) arms[0].add(g);
      const u = player.model.userData; view.setHands(u.skinC ?? 0x8b8d94, u.sleeveC ?? 0xe8455b);
    },
    totalAmmo(id = combat.weapon) { return (combat.clip[id] || 0) + (combat.ammo[id] || 0); },
    hitMarker(kill) { combat.hitT = .28; combat.killHit = kill; game.audio.hitmark(); },
    // Somebody's fist or knife reaches you (combat/brawlers.js). (dx, dz): the way the blow travels. heavy: a haymaker, which floors you.
    // With your guard up and the blow coming from in front, most of it is soaked. Returns true when it got through.
    takeBlow(damage, dx, dz, { blade = false, heavy = false } = {}) {
      const p = player; if (p.mode !== 'foot' || game.over || p.sky) return false;
      const front = -(dx * Math.sin(p.face) + dz * Math.cos(p.face)) > .15;
      if (combat.guard && front) {
        p.hurt(damage * (blade ? MELEE.guardKnife : MELEE.guard)); game.audio.block(); game.cam.shake(.09); combat.kick = .5;
        if (heavy) p.reel(dx, dz, 3);                      // a haymaker still pushes you back
        game.brawlers?.blocked(); return false;
      }
      p.hurt(damage); blade ? game.audio.stab() : game.audio.punch(); game.cam.shake(heavy ? .45 : .22); combat.combo = 0;
      if (heavy) p.floor(dx, dz, 4.6, 1.5); else p.reel(dx, dz);
      return true;
    },

    // ---------- input, at the fixed physics rate ----------
    preStep(dt) {
      const input = game.input, p = player, w = combat.def;
      combat.cool -= dt; reportT -= dt; combat.bloom = Math.max(0, combat.bloom - dt * AIM.bloomMax * 2);
      if (game.state !== 'playing') return;
      if (input.hit('Digit1')) combat.select(combat.weapon === 'fists' && combat.owned.has('knife') ? 'knife' : 'fists');      // 1 swaps fists and knife
      for (const id of WEAPON_ORDER) if (WEAPONS[id].slot >= 2 && input.hit('Digit' + WEAPONS[id].slot)) combat.select(id);
      // the wheel changes weapon; while looking through a scope it changes the magnification instead
      const wh = input.takeWheel();
      if (wh && p.mode === 'foot') { if (combat.aiming && w.scope) combat.scopeStep = clamp(combat.scopeStep - wh, 0, AIM.scopeZoom.length - 1); else cycle(wh); }
      const free = !p.frozen && p.mode === 'foot' && p.tumble <= 0 && !p.sky && !game.over;
      if (!free) { combat.aiming = false; combat.guard = false; combat.landT = 0; combat.burstLeft = 0; combat.ready = false; p.aiming = false; return; }

      const was = combat.aiming;
      combat.aiming = !w.melee && input.down('Mouse2');
      if (combat.aiming && !was) game.cam.beginAim(snapTarget(w));
      if (combat.reloading > 0 && (combat.reloading -= dt) <= 0) finishReload();
      if (input.hit('KeyR')) reload();
      // fists and knife: right mouse is the guard, left swings; the blow itself lands a moment into the swing
      combat.guard = !!w.melee && input.down('Mouse2') && combat.swingT <= 0;
      if (combat.lungeT > 0) { combat.lungeT -= dt; p.body.setLinvel({ x: lunge.x * MELEE.lunge, y: lunge.z * MELEE.lunge }, true); }
      if (combat.landT > 0 && (combat.landT -= dt) <= 0) land();
      if (w.melee) { if (input.down('Mouse0') && combat.cool <= 0 && !combat.guard) swing(); }
      else if (combat.burstLeft > 0) { if ((combat.burstT -= dt) <= 0) shoot(); }
      else if ((w.auto ? input.down('Mouse0') : input.hit('Mouse0')) && combat.cool <= 0 && combat.reloading <= 0) {
        if (w.burst) combat.burstLeft = w.burst;
        shoot();
      }
      combat.ready = combat.aiming || combat.guard || game.time - combat.lastShot < .8 || combat.burstLeft > 0 || game.time - combat.lastSwing < (w.melee ? 1.6 : .6);
      p.aiming = combat.ready;
    },

    // ---------- every frame, after Rocco's walk animation ----------
    update(dt, t) {
      const p = player, w = combat.def, onFoot = p.mode === 'foot';
      for (const id in guns) guns[id].visible = onFoot && id === combat.weapon;
      // the gun comes up over a fixed time (heavier guns take longer), eased at both ends
      combat.aimT = clamp(combat.aimT + (combat.aiming ? dt / (w.ads || AIM.time) : -dt / AIM.timeOut), 0, 1);
      combat.aimBlend = combat.aimT * combat.aimT * (3 - 2 * combat.aimT);
      combat.spread = spreadNow(w);
      combat.hitT = Math.max(0, combat.hitT - dt); combat.swingT = Math.max(0, combat.swingT - dt); combat.kick = damp(combat.kick, 0, 14, dt);
      gfx.update(dt);
      if (!onFoot || p.tumble > 0 || p.sky) return;
      const cam = game.cam;
      combat.aimPitch = Math.asin(clamp(cam.dir.y, -1, 1)) * combat.aimBlend;
      // is the crosshair on somebody? (the HUD turns it red)
      combat.onTarget = false;
      if (combat.aiming && combat.aimBlend > .5 && !w.melee) {
        const h = hits.cast(cam.origin.x, cam.origin.y, cam.origin.z, cam.dir.x, cam.dir.y, cam.dir.z, w.range, pastRocco(cam.origin, cam.dir), COMBAT.aimAssist * .35);
        combat.onTarget = h.kind === 'ped' || h.kind === 'officer' || h.kind === 'rival';
      }
      if (combat.ready && !(w.melee && combat.swingT > 0 && combat.swingFace !== null)) p.face += angleDiff(faceYaw(), p.face) * Math.min(1, dt * 22);
      else if (combat.ready) p.face += angleDiff(combat.swingFace, p.face) * Math.min(1, dt * 26);      // mid-swing: keep facing whoever it is aimed at
      pose(w, t);
    },
  };

  const faceYaw = () => Math.atan2(Math.cos(game.cam.yaw), Math.sin(game.cam.yaw));
  function cycle(dir) {
    const own = WEAPON_ORDER.filter(id => combat.owned.has(id)); if (own.length < 2) return;
    const i = own.indexOf(combat.weapon); combat.select(own[(i + dir + own.length) % own.length]);
  }
  function reload() {
    const id = combat.weapon, w = WEAPONS[id];
    if (w.melee || combat.reloading > 0 || (combat.clip[id] || 0) >= w.mag || !(combat.ammo[id] > 0)) return;
    combat.reloading = w.reload; combat.burstLeft = 0; game.audio.reload();
  }
  function finishReload() {
    const id = combat.weapon, w = WEAPONS[id], n = Math.min(w.mag - combat.clip[id], combat.ammo[id]);
    combat.clip[id] += n; combat.ammo[id] -= n;
  }

  // ---------- shooting ----------
  function shoot() {
    const id = combat.weapon, w = WEAPONS[id], p = player, audio = game.audio;
    if (!(combat.clip[id] > 0)) { combat.burstLeft = 0; if (combat.ammo[id] > 0) reload(); else { audio.click(); combat.cool = .3; } return; }
    combat.clip[id]--; if (combat.burstLeft > 0) { combat.burstLeft--; combat.burstT = w.burstGap; }
    if (!w.burst || combat.burstLeft === w.burst - 1) combat.cool = 1 / w.rate;
    combat.lastShot = game.time; combat.ready = true;

    // face the shot and raise the gun before working out where the barrel is
    p.face = faceYaw(); pose(w, game.time, true); p.model.position.set(p.x, p.y, p.z); p.model.rotation.y = p.face; p.model.updateMatrixWorld(true);
    // the barrel tip: of the gun in front of the eye when looking down the sights, otherwise of the one in Rocco's hand
    const sighted = view.shown && view.up > .4;
    if (sighted) view.muzzle(muzzle); else { const gun = guns[id]; muzzle.copy(gun.userData.muzzle); gun.localToWorld(muzzle); }

    // aim: down the crosshair when aiming, otherwise at whoever is in front (hip fire auto-aim)
    const cam = game.cam; let ox, oy, oz, tmin, assist;
    if (combat.aiming && combat.aimBlend > .35) {
      // exactly the ray through the crosshair, as it was drawn on the frame the trigger was pulled
      d.copy(cam.dir); ox = cam.origin.x; oy = cam.origin.y; oz = cam.origin.z;
      tmin = pastRocco(cam.origin, d); assist = COMBAT.aimAssist * .35;
    } else {
      ox = p.x; oy = p.y + 1.35; oz = p.z; tmin = .3; assist = COMBAT.aimAssist;
      const yaw = game.cam.yaw; d.set(Math.cos(yaw), 0, Math.sin(yaw));
      const tgt = autoTarget(w.range * .7, d);
      if (tgt) d.set(tgt.x - ox, tgt.y + 1.15 - oy, tgt.z - oz).normalize();
    }
    // every pellet lands somewhere inside the cone the crosshair shows
    const spread = spreadNow(w);
    side.crossVectors(d, UP); if (side.lengthSq() < 1e-6) side.set(1, 0, 0); side.normalize(); up.crossVectors(side, d);
    const ends = game.net?.active ? [] : null;
    for (let i = 0; i < w.pellets; i++) {
      const r = Math.tan(spread * Math.sqrt(Math.random())), a = Math.random() * TAU;
      shot.copy(d).addScaledVector(side, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
      const dx = shot.x, dy = shot.y, dz = shot.z;
      const h = hits.cast(ox, oy, oz, dx, dy, dz, w.range, tmin, assist);
      // the barrel must also be able to see what the crosshair sees
      if (h.kind !== 'wall') {
        const b = game.physics.blocked(muzzle.x, muzzle.z, h.x, h.z);
        if (b >= 0) { const len = Math.hypot(h.x - muzzle.x, h.z - muzzle.z), k = b / len; h.x = muzzle.x + (h.x - muzzle.x) * k; h.y = muzzle.y + (h.y - muzzle.y) * k; h.z = muzzle.z + (h.z - muzzle.z) * k; h.kind = 'wall'; h.obj = null; }
      }
      gfx.tracer(muzzle.x, muzzle.y, muzzle.z, h.x, h.y, h.z, w.pellets > 1 ? .014 : .022);
      ends?.push(h.x, h.y, h.z);
      if (h.kind) hits.apply(h, w.damage, dx, dz);
    }
    gfx.flash(muzzle.x, muzzle.y, muzzle.z, (.35 + w.loud * .25) * (sighted ? .42 : 1));      // smaller when it goes off right in front of the eye
    view.fire(w);
    audio.shot(w.loud, 1);
    if (ends) game.net.shot(id, muzzle, ends);
    game.cam.shake(w.kick * .9); if (combat.aiming) game.cam.kick(w.kick); combat.kick = w.kick * 4; combat.bloom = Math.min(AIM.bloomMax, combat.bloom + AIM.bloom);
    game.peds.scare(p.x, p.z, 40, 8);
    if (!combat.quiet && reportT <= 0 && game.police.witnessed(p.x, p.z, COMBAT.witnessRange)) { reportT = 1.5; game.police.crime(...COMBAT.crime.shotsFired, 'SHOTS FIRED!'); }
    if (combat.clip[id] === 0 && combat.ammo[id] > 0 && !combat.burstLeft) setTimeout(() => { if (combat.weapon === id) reload(); }, 180);
  }

  // How wide the shots scatter right now (radians): tight when aiming, wider from the hip, on the move and in a long burst.
  function spreadNow(w) {
    if (w.melee) return 0;
    const hip = w.hipSpread ?? AIM.hipSpread, ads = w.adsSpread ?? AIM.adsSpread;
    return w.spread * (1 + combat.bloom) * lerp(hip, ads, combat.aimBlend) * (1 + clamp(player.speed / 4.3, 0, 1) * AIM.moveSpread);
  }
  // Distance along the crosshair ray to just short of Rocco, so shots ignore whatever is between the camera and him.
  const pastRocco = (o, dir) => Math.max(0, (player.x - o.x) * dir.x + (player.y + 1.2 - o.y) * dir.y + (player.z - o.z) * dir.z - .2);
  // Who the crosshair should land on when the gun comes up: somebody close to dead ahead, if anyone.
  function snapTarget(w) {
    if (!AIM.snap) return null;
    const yaw = game.cam.yaw; d.set(Math.cos(yaw), 0, Math.sin(yaw));
    const q = autoTarget(w.range * .7, d, AIM.snap);
    return q ? { x: q.x, y: q.y + 1.25, z: q.z } : null;
  }

  // Closest body near the line of fire (people, not cars).
  function autoTarget(range, dir, cone = .26) {
    const p = player; let best = null, bestScore = cone;
    const check = (q) => {
      const dx = q.x - p.x, dz = q.z - p.z, dist = Math.hypot(dx, dz); if (dist > range || dist < .5) return;
      const ang = Math.acos(clamp((dx * dir.x + dz * dir.z) / dist, -1, 1)), score = ang + dist / range * .08;
      if (score < bestScore && game.physics.canSee(p.x, p.z, q.x, q.z)) { bestScore = score; best = q; }
    };
    for (const q of game.peds.list) if (q.state !== 'ko' && q.state !== 'down' && q.state !== 'air') check(q);
    for (const o of game.police.officers) check(o.ped);
    if (game.net?.active) for (const r of game.net.targets) if (r.state !== 'down') check(r);
    return best;
  }

  // ---------- punching and stabbing ----------
  // A swing picks whoever is in front, steps toward them, and lands a moment later (land). Fists build a combination:
  // every MELEE.finisher-th punch in a row is a haymaker that floors them. Miss, get hit or dawdle and the count starts again.
  const lunge = { x: 0, z: 0 };
  function inFront(range, cone) {
    const p = player, yaw = game.cam.yaw, fx = Math.cos(yaw), fz = Math.sin(yaw);
    let best = null, bd = range;
    const check = (q, kind, obj) => {
      const dx = q.x - p.x, dz = q.z - p.z, dist = Math.hypot(dx, dz);
      if (dist < bd && (dx * fx + dz * fz) / (dist || 1) > cone && q.state !== 'ko' && q.state !== 'down' && q.state !== 'air' && Math.abs((q.y ?? p.y) - p.y) < 2) { bd = dist; best = { kind, obj, q, dist }; }
    };
    for (const q of game.peds.list) check(q, 'ped', q);
    for (const o of game.police.officers) check(o.ped, 'officer', o);
    if (game.net?.active) for (const r of game.net.targets) check(r, 'rival', r);
    return best;
  }
  function swing() {
    const w = combat.def, p = player, blade = !!w.blade;
    const chain = game.time - combat.lastSwing < MELEE.combo ? combat.combo : 0;
    const heavy = !blade && chain >= MELEE.finisher - 1;
    combat.combo = chain; combat.heavy = heavy;
    combat.cool = 1 / w.rate * (heavy ? 1.3 : 1); combat.swingDur = combat.swingT = heavy ? .44 : blade ? .34 : .3; combat.swingKind = blade ? 'slash' : heavy ? 'hay' : 'jab';
    combat.swingSide ^= 1; combat.lastSwing = game.time; combat.landT = heavy ? .2 : .11;
    blade ? game.audio.slash() : game.audio.whoosh();
    game.net?.swing();
    // step in on whoever it is meant for
    const t = inFront(MELEE.lungeRange, .45);
    if (t) {
      const dx = (t.q.x - p.x) / (t.dist || 1), dz = (t.q.z - p.z) / (t.dist || 1);
      combat.swingFace = p.face = Math.atan2(dx, dz);
      if (t.dist > w.range * .75) { lunge.x = dx; lunge.z = dz; combat.lungeT = .1; }
    } else { combat.swingFace = null; p.face = faceYaw(); }
  }
  function land() {
    const w = combat.def, p = player; if (!w.melee) return;
    const best = inFront(w.range + .45, .3);
    if (!best) { combat.combo = 0; return; }
    const q = best.q, dx = (q.x - p.x) / (best.dist || 1), dz = (q.z - p.z) / (best.dist || 1), heavy = combat.heavy;
    p.face = Math.atan2(dx, dz);
    const h = { kind: best.kind, obj: best.obj, x: q.x - dx * .3, y: q.y + 1.3, z: q.z - dz * .3, head: false };
    w.blade ? game.audio.stab() : game.audio.punch(); game.cam.shake(heavy ? .3 : .14);
    hits.apply(h, w.damage * (heavy ? MELEE.finisherDamage : 1), dx, dz, { melee: true, knock: heavy ? MELEE.finisherKnock : w.knock, floor: heavy, blade: !!w.blade });
    combat.combo = heavy ? 0 : combat.combo + 1;
    if (heavy) game.hud.toast('HAYMAKER!', 'good');
  }

  // how Rocco holds things (runs after the walk cycle has posed his arms)
  const pose = (w, t, force = false) => holdPose(arms, w, combat, t, force || combat.ready);

  combat.rehand();
  return combat;
}

// ---------- how anyone holds a weapon (runs after the walk cycle has posed the arms) ----------
// arms: [right, left]. c: { aimPitch, swingT, swingSide, reloading, kick }. Other players' bodies are posed with this too (net/remote.js).
export function holdPose(arms, w, c, t, ready) {
  const [R, L] = arms, pitch = c.aimPitch;
  R.rotation.y = L.rotation.y = 0; R.rotation.z = -.12; L.rotation.z = .12;   // the rig's resting shoulder angles
  if (w.melee) {
    const blade = !!w.blade;
    if (c.swingT > 0) {
      const k = 1 - c.swingT / (c.swingDur || .3);
      if (c.swingKind === 'slash') {
        // forehand down across the body, then a backhand the other way
        const a = Math.sin(Math.min(1, k * 1.5) * HALF_PI);
        if (c.swingSide) { R.rotation.x = -2.6 + a * 1.9; R.rotation.z = -.35 + a * .95; } else { R.rotation.x = -1.5 - Math.sin(k * Math.PI) * .35; R.rotation.z = .75 - a * 1.25; }
        L.rotation.x = -1.05; L.rotation.z = -.45;
      } else if (c.swingKind === 'hay') {
        // wound right back, then all the way through
        const wind = Math.min(1, k / .4), go = Math.min(1, Math.max(0, (k - .4) / .35)), ext = Math.sin(go * HALF_PI), back = 1 - Math.max(0, (k - .8) / .2);
        R.rotation.x = (.75 * wind * (1 - ext) - ext * 1.85) * back - 1.25 * (1 - back); R.rotation.z = .1 + .35 * ext;
        L.rotation.x = -1.3; L.rotation.z = -.55;
      } else {
        const ext = Math.sin(Math.min(1, k * 1.6) * Math.PI);
        const jab = c.swingSide ? L : R, guard = c.swingSide ? R : L;
        jab.rotation.x = -.9 - ext * .75; jab.rotation.z = (jab === R ? .25 : -.25) * (1 - ext * .5);
        guard.rotation.x = -1.25; guard.rotation.z = guard === R ? .5 : -.5;
      }
    } else if (c.guard) { R.rotation.x = L.rotation.x = -1.95 - (c.kick || 0) * .25; R.rotation.z = .68; L.rotation.z = -.68; }      // forearms up in front of the face
    else if (ready) {
      R.rotation.x = L.rotation.x = -1.25 + Math.sin(t * 6) * .05; R.rotation.z = .5; L.rotation.z = -.5;
      if (blade) { R.rotation.x = -1.0 - Math.sin(t * 6) * .05; R.rotation.z = .22; }
    }
    return;
  }
  if (c.reloading > 0) {
    const k = Math.sin(t * 14) * .08;
    R.rotation.x = -.85; R.rotation.z = .35; L.rotation.x = -1.05 + k; L.rotation.z = -.55; return;
  }
  if (ready) {
    R.rotation.x = -HALF_PI - pitch - c.kick * .5; R.rotation.z = .12;
    L.rotation.x = -HALF_PI - pitch + (w.twoHand ? .2 : .1) - c.kick * .4; L.rotation.z = w.twoHand ? -.62 : -.5;
  } else if (w.twoHand) {
    R.rotation.x = -.95; R.rotation.z = .2; L.rotation.x = -1.1; L.rotation.z = -.6;   // low ready across the body
  }
}
