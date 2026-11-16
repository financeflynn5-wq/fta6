// Rocco's side of a fight: which weapons he carries, punching, aiming, shooting and reloading,
// and how he holds each gun. Damage rules live in hits.js; cops shooting back in copGuns.js.
import * as THREE from 'three';
import { WEAPONS, COMBAT } from '../config.js';
import { damp, angleDiff, clamp } from '../core/utils.js';
import { makeWeapon } from './weaponModels.js';
import { createHits } from './hits.js';
import { createGunFx } from './gunfx.js';

export const WEAPON_ORDER = Object.keys(WEAPONS).sort((a, b) => WEAPONS[a].slot - WEAPONS[b].slot);
const HALF_PI = Math.PI / 2;

export function createCombat(game) {
  const hits = createHits(game), gfx = createGunFx(game.scene);
  const player = game.player, arms = player.model.userData.arms;
  const guns = {};                      // the gun meshes in Rocco's right hand, made on first pickup
  const camDir = new THREE.Vector3(), muzzle = new THREE.Vector3(), d = new THREE.Vector3();
  let reportT = 0;

  const combat = {
    hits, gfx, guns, weapon: 'fists', owned: new Set(['fists']), clip: {}, ammo: {},
    aiming: false, aimBlend: 0, aimPitch: 0, ready: false, cool: 0, reloading: 0, burstLeft: 0, burstT: 0,
    swingT: 0, swingSide: 0, lastShot: -9, lastSwing: -9, hitT: 0, killHit: false, bloom: 0, kick: 0,
    get def() { return WEAPONS[combat.weapon]; },

    // Pick up a gun, or more rounds for one we already have.
    give(id, rounds = WEAPONS[id].give) {
      const w = WEAPONS[id];
      if (w.melee) return;
      if (!combat.owned.has(id)) {
        combat.owned.add(id); combat.clip[id] = Math.min(w.mag, rounds); combat.ammo[id] = rounds - combat.clip[id];
        if (!guns[id]) { const g = makeWeapon(id); g.position.set(0, -.5, .02); g.rotation.set(HALF_PI, 0, 0); g.visible = false; arms[0].add(g); guns[id] = g; }
        if (combat.weapon === 'fists' || WEAPONS[combat.weapon].slot < w.slot) combat.select(id);
      } else combat.ammo[id] += rounds;
    },
    select(id) {
      if (!combat.owned.has(id) || combat.weapon === id) return;
      combat.weapon = id; combat.reloading = 0; combat.burstLeft = 0; combat.cool = Math.max(combat.cool, .2);
      game.audio.equip(); game.hud.toast(WEAPONS[id].name, 'info');
    },
    // Nabbed: the cops keep your guns. Wasted: you keep them.
    reset(confiscate) {
      combat.aiming = false; combat.reloading = 0; combat.burstLeft = 0; combat.lastShot = -9;
      if (confiscate) { combat.owned = new Set(['fists']); combat.clip = {}; combat.ammo = {}; combat.weapon = 'fists'; }
    },
    totalAmmo(id = combat.weapon) { return (combat.clip[id] || 0) + (combat.ammo[id] || 0); },
    hitMarker(kill) { combat.hitT = .28; combat.killHit = kill; game.audio.hitmark(); },

    // ---------- input, at the fixed physics rate ----------
    preStep(dt) {
      const input = game.input, p = player, w = combat.def;
      combat.cool -= dt; reportT -= dt; combat.bloom = Math.max(0, combat.bloom - dt * 2.5);
      if (game.state !== 'playing') return;
      for (const id of WEAPON_ORDER) if (input.hit('Digit' + WEAPONS[id].slot)) combat.select(id);
      const wh = input.takeWheel(); if (wh && p.mode === 'foot') cycle(wh);
      const free = !p.frozen && p.mode === 'foot' && p.tumble <= 0 && !game.over;
      if (!free) { combat.aiming = false; combat.burstLeft = 0; combat.ready = false; p.aiming = false; return; }

      combat.aiming = !w.melee && input.down('Mouse2');
      if (combat.reloading > 0 && (combat.reloading -= dt) <= 0) finishReload();
      if (input.hit('KeyR')) reload();
      if (w.melee) { if (input.down('Mouse0') && combat.cool <= 0) swing(); }
      else if (combat.burstLeft > 0) { if ((combat.burstT -= dt) <= 0) shoot(); }
      else if ((w.auto ? input.down('Mouse0') : input.hit('Mouse0')) && combat.cool <= 0 && combat.reloading <= 0) {
        if (w.burst) combat.burstLeft = w.burst;
        shoot();
      }
      combat.ready = combat.aiming || game.time - combat.lastShot < .8 || combat.burstLeft > 0 || game.time - combat.lastSwing < .6;
      p.aiming = combat.ready;
    },

    // ---------- every frame, after Rocco's walk animation ----------
    update(dt, t) {
      const p = player, w = combat.def, onFoot = p.mode === 'foot';
      for (const id in guns) guns[id].visible = onFoot && id === combat.weapon;
      combat.aimBlend = damp(combat.aimBlend, combat.aiming ? 1 : 0, 14, dt);
      combat.hitT = Math.max(0, combat.hitT - dt); combat.swingT = Math.max(0, combat.swingT - dt); combat.kick = damp(combat.kick, 0, 14, dt);
      gfx.update(dt);
      if (!onFoot || p.tumble > 0) return;
      game.camera.getWorldDirection(camDir);
      combat.aimPitch = combat.aiming ? Math.asin(clamp(camDir.y, -1, 1)) : 0;
      if (combat.ready) p.face += angleDiff(faceYaw(), p.face) * Math.min(1, dt * 22);
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
    const gun = guns[id]; muzzle.copy(gun.userData.muzzle); gun.localToWorld(muzzle);

    // aim: down the crosshair when aiming, otherwise at whoever is in front (hip fire auto-aim)
    const cam = game.camera; let ox, oy, oz, tmin, assist;
    if (combat.aiming) {
      cam.getWorldDirection(d); ox = cam.position.x; oy = cam.position.y; oz = cam.position.z;
      tmin = Math.max(0, (p.x - ox) * d.x + (p.y + 1.2 - oy) * d.y + (p.z - oz) * d.z - .2); assist = COMBAT.aimAssist * .35;
    } else {
      ox = p.x; oy = p.y + 1.35; oz = p.z; tmin = .3; assist = COMBAT.aimAssist;
      const yaw = game.cam.yaw; d.set(Math.cos(yaw), 0, Math.sin(yaw));
      const tgt = autoTarget(w.range * .7, d);
      if (tgt) d.set(tgt.x - ox, tgt.y + 1.15 - oy, tgt.z - oz).normalize();
    }
    const spread = w.spread * (1 + combat.bloom) * (combat.aiming ? 1 : 1.8);
    for (let i = 0; i < w.pellets; i++) {
      let dx = d.x + (Math.random() - .5) * 2 * spread, dy = d.y + (Math.random() - .5) * 2 * spread, dz = d.z + (Math.random() - .5) * 2 * spread;
      const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l;
      const h = hits.cast(ox, oy, oz, dx, dy, dz, w.range, tmin, assist);
      // the barrel must also be able to see what the crosshair sees
      if (h.kind !== 'wall') {
        const b = game.physics.blocked(muzzle.x, muzzle.z, h.x, h.z);
        if (b >= 0) { const len = Math.hypot(h.x - muzzle.x, h.z - muzzle.z), k = b / len; h.x = muzzle.x + (h.x - muzzle.x) * k; h.y = muzzle.y + (h.y - muzzle.y) * k; h.z = muzzle.z + (h.z - muzzle.z) * k; h.kind = 'wall'; h.obj = null; }
      }
      gfx.tracer(muzzle.x, muzzle.y, muzzle.z, h.x, h.y, h.z, w.pellets > 1 ? .014 : .022);
      if (h.kind) hits.apply(h, w.damage, dx, dz);
    }
    gfx.flash(muzzle.x, muzzle.y, muzzle.z, .35 + w.loud * .25);
    audio.shot(w.loud, 1);
    game.cam.shake(w.kick * .9); game.cam.pitch -= w.kick * (combat.aiming ? .12 : 0); combat.kick = w.kick * 4; combat.bloom = Math.min(2.5, combat.bloom + .5);
    game.peds.scare(p.x, p.z, 40, 8);
    if (reportT <= 0 && game.police.witnessed(p.x, p.z, COMBAT.witnessRange)) { reportT = 1.5; game.police.crime(...COMBAT.crime.shotsFired, 'SHOTS FIRED!'); }
    if (combat.clip[id] === 0 && combat.ammo[id] > 0 && !combat.burstLeft) setTimeout(() => { if (combat.weapon === id) reload(); }, 180);
  }

  // Closest body near the line of fire (people, not cars).
  function autoTarget(range, dir) {
    const p = player; let best = null, bestScore = .26;
    const check = (q) => {
      const dx = q.x - p.x, dz = q.z - p.z, dist = Math.hypot(dx, dz); if (dist > range || dist < .5) return;
      const ang = Math.acos(clamp((dx * dir.x + dz * dir.z) / dist, -1, 1)), score = ang + dist / range * .08;
      if (score < bestScore && game.physics.canSee(p.x, p.z, q.x, q.z)) { bestScore = score; best = q; }
    };
    for (const q of game.peds.list) if (q.state !== 'ko' && q.state !== 'down' && q.state !== 'air') check(q);
    for (const o of game.police.officers) check(o.ped);
    return best;
  }

  // ---------- punching ----------
  function swing() {
    const w = combat.def, p = player;
    combat.cool = 1 / w.rate; combat.swingT = .3; combat.swingSide ^= 1; combat.lastSwing = game.time; game.audio.whoosh();
    const yaw = game.cam.yaw, fx = Math.cos(yaw), fz = Math.sin(yaw);
    let best = null, bd = w.range + .4;
    const check = (q, kind, obj) => {
      const dx = q.x - p.x, dz = q.z - p.z, dist = Math.hypot(dx, dz);
      if (dist < bd && (dx * fx + dz * fz) / (dist || 1) > .35 && q.state !== 'ko') { bd = dist; best = { kind, obj, q }; }
    };
    for (const q of game.peds.list) check(q, 'ped', q);
    for (const o of game.police.officers) check(o.ped, 'officer', o);
    if (!best) { p.face = faceYaw(); return; }
    const q = best.q, dx = (q.x - p.x) / (bd || 1), dz = (q.z - p.z) / (bd || 1);
    p.face = Math.atan2(dx, dz);
    const h = { kind: best.kind, obj: best.obj, x: q.x - dx * .3, y: q.y + 1.3, z: q.z - dz * .3, head: false };
    game.audio.punch(); game.cam.shake(.14);
    hits.apply(h, w.damage, dx, dz, { melee: true, knock: w.knock });
  }

  // ---------- how Rocco holds things (runs after the walk cycle has posed his arms) ----------
  function pose(w, t, force = false) {
    const [R, L] = arms, ready = force || combat.ready, pitch = combat.aimPitch;
    R.rotation.y = L.rotation.y = 0; R.rotation.z = -.12; L.rotation.z = .12;   // the rig's resting shoulder angles
    if (w.melee) {
      if (combat.swingT > 0) {
        const k = 1 - combat.swingT / .3, ext = Math.sin(Math.min(1, k * 1.6) * Math.PI);
        const jab = combat.swingSide ? L : R, guard = combat.swingSide ? R : L;
        jab.rotation.x = -.9 - ext * .75; jab.rotation.z = (jab === R ? .25 : -.25) * (1 - ext * .5);
        guard.rotation.x = -1.25; guard.rotation.z = guard === R ? .5 : -.5;
      } else if (ready) { R.rotation.x = L.rotation.x = -1.25 + Math.sin(t * 6) * .05; R.rotation.z = .5; L.rotation.z = -.5; }
      return;
    }
    if (combat.reloading > 0) {
      const k = Math.sin(t * 14) * .08;
      R.rotation.x = -.85; R.rotation.z = .35; L.rotation.x = -1.05 + k; L.rotation.z = -.55; return;
    }
    if (ready) {
      R.rotation.x = -HALF_PI - pitch - combat.kick * .5; R.rotation.z = .12;
      L.rotation.x = -HALF_PI - pitch + (w.twoHand ? .2 : .1) - combat.kick * .4; L.rotation.z = w.twoHand ? -.62 : -.5;
    } else if (w.twoHand) {
      R.rotation.x = -.95; R.rotation.z = .2; L.rotation.x = -1.1; L.rotation.z = -.6;   // low ready across the body
    }
  }

  return combat;
}
