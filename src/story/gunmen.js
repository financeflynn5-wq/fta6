// Armed gunmen for missions (the Possum Posse). Each one is an ordinary citizen as far as bullets, fists and
// bumpers are concerned (they live in the pedestrian list, so everything that hurts a citizen hurts them), but
// instead of strolling they stand guard, close in when they notice you and shoot when they can see you.
// Nobody calls the police when one goes down (ped.outlaw).
import * as THREE from 'three';
import { STORY } from '../config.js';
import { clamp, rnd, angleDiff } from '../core/utils.js';
import { makeWeapon, dropWeapon } from '../combat/weaponModels.js';

export function createGunmen(game) {
  const list = [], muzzle = new THREE.Vector3();
  const p = game.player, peds = game.peds;

  function scrapModel(ped) { game.scene.remove(ped.model); ped.model.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); }
  // Take a gunman out of the game for good (the pedestrian system never hears about it, so no replacement walks in).
  function drop(g) {
    const i = list.indexOf(g); if (i >= 0) list.splice(i, 1);
    if (g.gun) { dropWeapon(g.gun); g.gun = null; }
    if (peds.list.includes(g.ped)) peds.release(g.ped);
    scrapModel(g.ped);
  }

  function fire(g, dist) {
    const ped = g.ped, inCar = p.mode === 'car';
    ped.model.updateMatrixWorld(true); muzzle.copy(g.gun.userData.muzzle); g.gun.localToWorld(muzzle);
    let chance = g.accuracy * (1 - clamp(dist / g.range, 0, 1) * .6) * (p.speed > 5 ? .55 : 1) * (inCar ? .8 : 1);
    if (game.combat?.aiming) chance *= .85;
    const hit = Math.random() < chance;
    let tx = p.x, ty = (inCar ? p.vehicle.y + 1 : p.y + 1.1), tz = p.z;
    if (!hit) {
      const a = Math.random() * 6.28, m = 1 + Math.random() * 2; tx += Math.cos(a) * m; tz += Math.sin(a) * m; ty += (Math.random() - .5) * 1.2;
      const dx = tx - muzzle.x, dy = ty - muzzle.y, dz = tz - muzzle.z, l = Math.hypot(dx, dy, dz);
      const h = game.combat.hits.cast(muzzle.x, muzzle.y, muzzle.z, dx / l, dy / l, dz / l, l + 25, .7, 0, inCar ? p.vehicle : null);
      tx = h.x; ty = h.y; tz = h.z;
      if (h.kind === 'wall' || h.kind === 'ground' || h.kind === 'car') game.fx.spark(tx, ty, tz, 3, .4);
    }
    game.combat.gfx.tracer(muzzle.x, muzzle.y, muzzle.z, tx, ty, tz, .018);
    game.combat.gfx.flash(muzzle.x, muzzle.y, muzzle.z, .5);
    game.audio.shot(1, clamp(1 - dist / 70, .15, .8));
    if (!hit) return;
    if (inCar) { p.vehicle.damage(g.damage * .7); game.fx.spark(tx, ty, tz, 4, .5); game.audio.ting(); p.hurt(g.damage * .25); }
    else p.hurt(g.damage);
  }

  const gunmen = {
    list,
    // kind: a character kind ('possum'...). o: any of STORY.goon's numbers, face (which way they look), gun.
    add(kind, x, z, o = {}) {
      const ped = peds.spawn(kind, x, z);
      ped.state = 'goon'; ped.panic = 0; ped.outlaw = true; ped.speed = 0; ped.face = o.face ?? Math.random() * 6.28;
      const g = { ped, gun: null, alert: false, fireT: rnd(.6, 1.5), stuck: 0, side: 0, sideT: 0, ...STORY.goon, ...o, out: false };
      ped.hp = g.hp; g.full = g.hp;
      g.gun = makeWeapon(o.gun || 'pistol'); g.gun.position.set(0, -.5, .02); g.gun.rotation.set(Math.PI / 2, 0, 0); ped.model.userData.arms[0].add(g.gun);
      list.push(g); return g;
    },
    alive: (group) => group.filter(g => !g.out).length,
    // Mission over (or abandoned): whoever is still standing goes away.
    clear(group = list.slice()) { for (const g of group) drop(g); },

    update(dt, t) {
      if (!list.length) return;
      const live = !game.over && game.state === 'playing';
      for (const g of list.slice()) {
        const ped = g.ped;
        if (!peds.list.includes(ped)) { drop(g); continue; }                    // carted off by the pedestrian system
        if (ped.ko || ped.state === 'ko') {
          if (!g.out) { g.out = true; if (g.gun) { dropWeapon(g.gun); g.gun = null; } game.pickups?.drop(ped.x, ped.z); }
          if (ped.state === 'ko' && ped.timer < 1.2) drop(g);                    // before the street sweeper counts him as a missing citizen
          continue;
        }
        if (ped.state === 'air' || ped.state === 'down' || ped.state === 'up' || ped.state === 'reel' || ped.state === 'dive') { g.alert = true; continue; }
        if (ped.state !== 'goon') { ped.state = 'goon'; ped.panic = 0; }        // back on his feet
        ped.panic = 0;
        { const [R, L] = ped.model.userData.arms; R.rotation.z = -.12; L.rotation.z = .12; }      // arms down unless he is aiming
        const dx = p.x - ped.x, dz = p.z - ped.z, dist = Math.hypot(dx, dz) || 1;
        const sees = live && dist < g.range + 10 && Math.abs(p.y - ped.y) < 6 && game.physics.canSee(ped.x, ped.z, p.x, p.z);
        if (!g.alert && live && (ped.hp < g.full || (dist < g.wake && sees) || list.some(o => o.alert && Math.hypot(o.ped.x - ped.x, o.ped.z - ped.z) < 40))) g.alert = true;
        if (!g.alert || !live) { ped.speed = 0; continue; }

        // close in until he has a clear shot from the distance he likes
        let moving = false;
        if (dist > g.hold || !sees) {
          let mx = dx / dist, mz = dz / dist;
          if ((g.sideT -= dt) > 0) { const sx = -mz * g.side, sz = mx * g.side; mx = mx * .2 + sx; mz = mz * .2 + sz; const l = Math.hypot(mx, mz); mx /= l; mz /= l; }
          const nx = ped.x + mx * g.speed * dt, nz = ped.z + mz * g.speed * dt;
          if (game.physics.blocked(ped.x, ped.z, ped.x + mx * .8, ped.z + mz * .8) < 0) { ped.x = nx; ped.z = nz; moving = true; g.stuck = 0; }
          else if ((g.stuck += dt) > .25 && g.sideT <= 0) { g.side = Math.random() < .5 ? 1 : -1; g.sideT = 1.1; g.stuck = 0; }       // walk round whatever is in the way
          if (moving) ped.face += angleDiff(Math.atan2(mx, mz), ped.face) * Math.min(1, dt * 10);
        }
        ped.speed = moving ? g.speed : 0;
        if (!sees || dist > g.range) { g.fireT = Math.max(g.fireT, .35); continue; }
        // gun up, pointed at you
        if (!moving) ped.face += angleDiff(Math.atan2(dx, dz), ped.face) * Math.min(1, dt * 12);
        if (ped.model.visible) {
          const [R, L] = ped.model.userData.arms; ped.model.rotation.y = ped.face;
          R.rotation.x = -Math.PI / 2; R.rotation.z = .12; L.rotation.x = -1.45; L.rotation.z = -.5;
        }
        if ((g.fireT -= dt) > 0) continue;
        g.fireT = g.rate * (.7 + Math.random() * .6);
        if (Math.abs(angleDiff(Math.atan2(dx, dz), ped.face)) < .6) fire(g, dist);
      }
    },
  };
  return gunmen;
}
