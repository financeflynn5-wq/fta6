// Another player, as they appear on this screen: their body (walking, lying flat, riding a bike), the gun in
// their hand, a name over their head, a blip on the radar, and the cars they own (ghostCar.js).
// Their own game decides where they are and how hurt they are; this only plays it back a moment later.
import * as THREE from 'three';
import { PLAYER, WEAPONS } from '../config.js';
import { angleDiff } from '../core/utils.js';
import { makeCharacter, animateCharacter, PLAYABLE } from '../characters/models.js';
import { makeWeapon, dropWeapon } from '../combat/weaponModels.js';
import { holdPose } from '../combat/combat.js';
import { GhostVehicle } from './ghostCar.js';
import { makeCanopy, setCanopy, headRoom } from '../player/skydive.js';

const COLORS = ['#4de3ff', '#ff8ae6', '#9dff6a', '#ffb347', '#c9a2ff', '#ff6b6b', '#6bffd9', '#ffe66b'];
const HALF_PI = Math.PI / 2;

function nameTag(text, color) {
  const c = document.createElement('canvas'); c.width = 384; c.height = 96;
  const x = c.getContext('2d'); x.font = '900 52px "Archivo Black",Impact,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 12; x.lineJoin = 'round'; x.strokeStyle = 'rgba(10,12,20,.85)'; x.strokeText(text, 192, 50, 360); x.fillStyle = '#fff'; x.fillText(text, 192, 50, 360);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, depthWrite: false, toneMapped: false, fog: false }));
  s.renderOrder = 20; s.userData.base = [2.4, .6];
  return s;
}

export function createRemote(game, id, index) {
  const color = COLORS[index % COLORS.length];
  const body = game.physics.addPerson(null, PLAYER.spawn.x, PLAYER.spawn.z, PLAYER.radius);
  body.setBodyType(game.physics.RAPIER.RigidBodyType.KinematicPositionBased, true);
  const to = { x: 0, y: 0 }, guns = {};
  let model = null, tag = null, shownName = null, lookKey = null, riding = null, bodyOn = true, canopy = null, canopyOpen = 0;

  const r = {
    id, color, name: 'Player', who: null, model: null, x: PLAYER.spawn.x, y: 0, z: PLAYER.spawn.z, face: 0, speed: 0,
    state: 'stand',                 // 'stand' | 'move' | 'down' (hits.js reads this to know they are lying flat)
    inCar: false, weapon: 'fists', ready: false, hp: PLAYER.health, up: false, away: false,
    aimPitch: 0, swingT: 0, swingSide: 0, reloading: 0, kick: 0,          // what holdPose reads
    team: -1, carried: 0, hot: false, show: true,           // set by a match (match.js): which side, what they carry, whether we may see them
    buf: [], off: null, heard: 0, lastT: -1, cars: new Map(), carId: null, visible: false,
    marker: { x: 0, z: 0, color, glyph: 'P', pin: true, size: 7, visible: () => r.visible },
    // The colour of their name and blip (a match paints teams).
    tint(c) { if (c === r.marker.color) return; r.marker.color = c; tag?.material.color.set(c); },

    // Who they are and what they look like (rebuilt only when it changes).
    dress(who, look, name) {
      if (!PLAYABLE.some(([k]) => k === who)) who = 'rocco';
      const key = who + '|' + (look ? JSON.stringify(look) : '');
      if (key !== lookKey) {
        lookKey = key; r.who = who;
        const old = model;
        if (old && riding?.rider === old) riding.unseat();
        model = r.model = makeCharacter(who, { props: false, look: who === 'bighead' ? look : undefined });
        for (const g of Object.values(guns)) model.userData.hands[0].add(g);
        if (old) { old.removeFromParent(); old.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); }
        game.scene.add(model); model.visible = false; riding = null;
        game.env?.touch();
      }
      name = String(name || 'Player').slice(0, 14);
      if (name !== shownName) {
        shownName = r.name = name; r.marker.glyph = name[0].toUpperCase();
        if (tag) { tag.material.map.dispose(); tag.material.dispose(); tag.removeFromParent(); }
        tag = nameTag(name, r.marker.color); game.scene.add(tag);
      }
    },

    // Their newest snapshot. at: when it happened, on our clock.
    take(s, at) {
      const b = r.buf, last = b[b.length - 1];
      if (last && at <= last.at) b.length = 0;
      b.push({ at, x: s.x, y: s.y, z: s.z, f: s.f }); if (b.length > 12) b.shift();
      r.inCar = s.m === 1; r.speed = s.sp; r.state = s.st === 5 ? 'chute' : s.st === 4 ? 'dive' : s.st === 3 ? 'sky' : s.st === 2 ? 'down' : s.st === 1 ? 'move' : 'stand';
      r.weapon = WEAPONS[s.w] ? s.w : 'fists'; r.ready = !!s.r; r.aimPitch = s.ap || 0; r.reloading = s.rl ? 1 : 0; r.hp = s.hp; r.away = !!s.aw;
      if (!!s.up !== r.up) { r.up = !!s.up; game.physics.setPersonUp(body, r.up); }
      r.carId = s.m === 1 && s.c?.length ? s.c[0].id : null;
    },

    // Once per physics step: where their body is at time T.
    preStep(T) {
      const b = r.buf; if (!b.length) return;
      while (b.length > 2 && b[1].at <= T) b.shift();
      const a = b[0], c = b[1] || a, span = c.at - a.at;
      let k = span > 1e-4 ? (T - a.at) / span : 1;
      k = Math.max(0, Math.min(k, 1 + (span > 1e-4 ? .25 / span : 0)));
      if (Math.abs(c.x - a.x) + Math.abs(c.z - a.z) > 12) k = k < 1 ? 0 : 1;      // respawned: appear there
      r.x = a.x + (c.x - a.x) * k; r.z = a.z + (c.z - a.z) * k; r.y = a.y + (c.y - a.y) * Math.min(k, 1); r.face = a.f + angleDiff(c.f, a.f) * Math.min(k, 1);
      const on = !r.inCar; if (on !== bodyOn) { bodyOn = on; body.setEnabled(on); }
      if (on) { to.x = r.x; to.y = r.z; body.setNextKinematicTranslation(to); }
      for (const car of r.cars.values()) car.aim(T);
    },

    // Once per drawn frame.
    update(dt, t, camPos) {
      if (!model) return;
      const car = r.inCar ? r.cars.get(r.carId) : null;
      r.swingT = Math.max(0, r.swingT - dt); r.kick *= Math.max(0, 1 - 14 * dt);
      if (riding && riding !== car) { if (riding.rider === model) { riding.unseat(); game.scene.add(model); } riding = null; }
      let tx = r.x, ty = r.y + (model.userData.big ? model.userData.big.top + .35 : 2.25), tz = r.z;
      if (car) {
        r.x = car.ix; r.z = car.iz; r.y = car.y;                    // they are wherever their car is
        if (car.mesh.userData.seat) { if (riding !== car && car.seat(model)) riding = car; } else model.visible = false;      // bikes, boats: you can see who is on them
        tx = car.ix; tz = car.iz; ty = car.y + (car.stats.rider ? 2.3 : 2.5);
      } else if (r.inCar) model.visible = false;                    // their car has not reached us yet
      else {
        model.visible = true; model.position.set(r.x, r.y, r.z); model.rotation.y = r.face + (r.state === 'down' ? t * 0 : 0);
        animateCharacter(model, t, dt, r.speed, r.state);
        // the gun in their hand
        const w = WEAPONS[r.weapon];
        if (!w.melee && !guns[r.weapon]) { const g = makeWeapon(r.weapon); g.position.set(0, -.5, .02); g.rotation.set(HALF_PI, 0, 0); model.userData.hands[0].add(g); guns[r.weapon] = g; }
        for (const k in guns) guns[k].visible = k === r.weapon;
        const air = r.state === 'sky' || r.state === 'dive' || r.state === 'chute';
        if (air) for (const k in guns) guns[k].visible = false;
        else if (r.state !== 'down') holdPose(model.userData.arms, w, r, t, r.ready);
      }
      // their parachute
      const hung = !car && !r.inCar && r.state === 'chute';
      if (hung && !canopy) { canopy = makeCanopy(); game.scene.add(canopy); game.env?.touch(); }
      if (canopy) { canopyOpen = hung ? Math.min(1, canopyOpen + dt / .8) : Math.max(0, canopyOpen - dt / .5); setCanopy(canopy, r.x, r.y + headRoom(model), r.z, r.face, canopyOpen, 0, t); }
      r.visible = !r.away && r.show; r.marker.x = tx; r.marker.z = tz;
      if (tag) {
        const d = Math.hypot(tx - camPos.x, ty - camPos.y, tz - camPos.z), k = Math.max(1, Math.min(7, d / 13));
        tag.visible = d < 160 && r.visible; tag.position.set(tx, ty + (k - 1) * .12, tz); tag.scale.set(tag.userData.base[0] * k, tag.userData.base[1] * k, 1);
      }
    },

    // One of their cars, from their snapshot. Returns the ghost (made on first sight).
    car(s, at) {
      let g = r.cars.get(s.id);
      if (!g) { g = new GhostVehicle(game, s, r); game.traffic.adopt(g); r.cars.set(s.id, g); g.buf[0].at = at; game.env?.touch(); }
      else g.take(s, at);
      return g;
    },
    dropCar(netId) {
      const g = r.cars.get(netId); if (!g) return;
      if (riding === g) { if (g.rider === model) { g.unseat(); game.scene.add(model); model.visible = false; } riding = null; }
      r.cars.delete(netId); game.traffic.remove(g);
    },

    dispose() {
      canopy?.removeFromParent();
      for (const idc of [...r.cars.keys()]) r.dropCar(idc);
      for (const g of Object.values(guns)) dropWeapon(g);
      if (model) { model.removeFromParent(); model.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); }
      if (tag) { tag.material.map.dispose(); tag.material.dispose(); tag.removeFromParent(); }
      game.physics.remove(body);
      const i = game.markers.indexOf(r.marker); if (i >= 0) game.markers.splice(i, 1);
    },
  };
  game.physics.owners.set(body.collider(0).handle, r);
  game.markers.push(r.marker);
  return r;
}
