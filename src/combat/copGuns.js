// Cops shoot back. From COMBAT.copGunStars stars, officers on foot draw pistols, hold back at
// range, and fire when they can see Rocco. They miss more at range and against a moving target.
import * as THREE from 'three';
import { COMBAT } from '../config.js';
import { clamp } from '../core/utils.js';
import { makeWeapon, dropWeapon } from './weaponModels.js';

export function createCopGuns(game) {
  const muzzle = new THREE.Vector3();
  const armed = new Set();

  function arm(o) {
    const g = makeWeapon('pistol'); g.position.set(0, -.5, .02); g.rotation.set(Math.PI / 2, 0, 0);
    o.ped.model.userData.arms[0].add(g); o.gun = g; o.hold = COMBAT.copHold; o.fireT = .6 + Math.random() * .8; armed.add(o);
  }
  function disarm(o) {
    if (o.gun) dropWeapon(o.gun); o.gun = null; o.hold = 0; armed.delete(o);
    const [R, L] = o.ped.model.userData.arms; R.rotation.z = -.12; L.rotation.z = .12;
  }

  return {
    update(dt) {
      const police = game.police, p = game.player;
      const live = police.stars >= COMBAT.copGunStars && !game.over;
      // officers who left the chase (knocked out, back in the car) put their guns away
      for (const o of armed) if (!live || !police.officers.includes(o)) disarm(o);
      if (!live) return;
      for (const o of police.officers) {
        if (!o.gun) arm(o);
        // a cop stays close enough to cuff you once you're down
        o.hold = p.tumble > 0 || p.health < 12 ? 0 : COMBAT.copHold;
        const [R, L] = o.ped.model.userData.arms; R.rotation.z = -.12; L.rotation.z = .12;
        if (o.state !== 'chase' || o.stun > 0) continue;
        const ped = o.ped, dx = p.x - ped.x, dz = p.z - ped.z, dist = Math.hypot(dx, dz);
        const sees = dist < COMBAT.copRange && game.physics.canSee(ped.x, ped.z, p.x, p.z);
        if (!sees) { o.fireT = Math.max(o.fireT, .4); continue; }
        // gun up, pointed at Rocco
        ped.face = Math.atan2(dx, dz); ped.model.rotation.y = ped.face;
        R.rotation.x = -Math.PI / 2; R.rotation.z = .12; L.rotation.x = -1.45; L.rotation.z = -.5;
        if ((o.fireT -= dt) > 0) continue;
        o.fireT = COMBAT.copRate * (.7 + Math.random() * .6);
        fire(o, dist);
      }
    },
    disarmAll() { for (const o of [...armed]) disarm(o); },
  };

  function fire(o, dist) {
    const p = game.player, inCar = p.mode === 'car';
    o.ped.model.updateMatrixWorld(true); muzzle.copy(o.gun.userData.muzzle); o.gun.localToWorld(muzzle);
    let chance = COMBAT.copAccuracy * (1 - clamp(dist / COMBAT.copRange, 0, 1) * .6) * (p.speed > 5 ? .55 : 1) * (inCar ? .8 : 1);
    if (game.combat?.aiming) chance *= .85;            // ducking behind your own gun
    const hit = Math.random() < chance;
    let tx = p.x, ty = p.y + 1.1, tz = p.z;
    if (inCar) { ty = p.vehicle.y + 1; }
    if (!hit) { const a = Math.random() * 6.28, m = 1 + Math.random() * 2; tx += Math.cos(a) * m; tz += Math.sin(a) * m; ty += (Math.random() - .5) * 1.2; }
    if (!hit) { // a miss keeps going past Rocco until it meets something
      const ddx = tx - muzzle.x, ddy = ty - muzzle.y, ddz = tz - muzzle.z, l = Math.hypot(ddx, ddy, ddz);
      const h = game.combat.hits.cast(muzzle.x, muzzle.y, muzzle.z, ddx / l, ddy / l, ddz / l, l + 25, .5, 0, inCar ? p.vehicle : null);
      tx = h.x; ty = h.y; tz = h.z;
      if (h.kind === 'wall' || h.kind === 'ground' || h.kind === 'car') game.fx.spark(tx, ty, tz, 3, .4);
    }
    const gfx = game.combat.gfx;
    gfx.tracer(muzzle.x, muzzle.y, muzzle.z, tx, ty, tz, .018);
    gfx.flash(muzzle.x, muzzle.y, muzzle.z, .5);
    game.audio.shot(1, clamp(1 - dist / 70, .15, .8));
    if (!hit) return;
    if (inCar) { p.vehicle.damage(COMBAT.copDamage * .7); game.fx.spark(tx, ty, tz, 4, .5); game.audio.ting(); p.hurt(COMBAT.copDamage * .25); }
    else p.hurt(COMBAT.copDamage);
  }
}
