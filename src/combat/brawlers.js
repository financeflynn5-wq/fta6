// People who fight you on foot: the camp in the woods, the drinkers in the bar, the gangs on their corners, and any
// citizen who squares up after you punch them. Each one is an ordinary citizen as far as bullets, fists and bumpers
// are concerned (they live in the pedestrian list, so everything that hurts a citizen hurts them); what this file adds
// is what they do about you: close in, wind up, swing, take turns, give up and go home.
//   fists    walk up and punch; every swing is wound up first, so you can see it coming and block or step away
//   knife    the same, faster and worse
//   pistol   keep their distance and shoot (as the story's gunmen do)
// Whoever owns a crew (world/forest.js, world/bar.js, missions/gangs.js) decides when it turns on you: brawlers.provoke().
import * as THREE from 'three';
import { BRAWL, MELEE } from '../config.js';
import { clamp, rnd, angleDiff } from '../core/utils.js';
import { makeWeapon, dropWeapon } from './weaponModels.js';
import { maxHp } from './hits.js';

const FLOORED = { air: 1, down: 1, up: 1, dive: 1, reel: 1 };
const KNIFE_GRIP = [0, -.47, .04, Math.PI / 4];          // where a knife sits in a hand, and how far the blade tips forward

export function createBrawlers(game) {
  const list = [], muzzle = new THREE.Vector3();
  const p = game.player, peds = game.peds, ph = game.physics;
  let unanswered = 0;                 // their punches that have landed since one of yours did

  function scrapModel(ped) { game.scene.remove(ped.model); ped.model.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); }
  function disarm(f, leave = false) {
    if (!f.tool) return;
    if (leave && f.weapon === 'knife') game.pickups?.dropWeapon('knife', f.ped.x, f.ped.z);
    else if (leave) game.pickups?.drop(f.ped.x, f.ped.z);
    dropWeapon(f.tool); f.tool = null;
  }
  // Take a fighter out of the game for good (the pedestrian system never hears about it, so no replacement walks in).
  function drop(f) {
    const i = list.indexOf(f); if (i >= 0) list.splice(i, 1);
    disarm(f); f.gone = true; f.ped.fighter = null;
    if (f.citizen) return;                                   // an ordinary citizen again: the street looks after them
    if (peds.list.includes(f.ped)) peds.release(f.ped);
    scrapModel(f.ped);
  }
  const clearWay = (x, z, dx, dz, d = .75) => ph.probeDrive(x, z, dx, dz, d) >= d;

  function make(ped, o = {}) {
    const weapon = o.weapon || 'fists';
    const f = {
      ped, weapon, group: o.group || null, mood: 'calm', out: false, gone: false, tool: null, citizen: !!o.citizen,
      home: o.home || { x: ped.x, z: ped.z, face: ped.face }, idle: o.idle || 'stand',
      ...BRAWL.base, ...o.stats, ...(weapon === 'pistol' ? BRAWL.pistol : null),
      cool: rnd(.3, 1.1), windT: 0, windDur: .4, heavy: false, strikeT: 0, stun: 0, stuck: 0, side: 1, sideT: 0, circ: Math.random() < .5 ? 1 : -1,
      calmT: 0, turn: false, seed: Math.random() * 6.28, waitT: rnd(0, 4), goal: null, sip: 0,
    };
    if (weapon === 'knife') { f.damage *= BRAWL.knife.damage; f.rate = BRAWL.knife.rate; f.wind = BRAWL.knife.wind; }
    ped.fighter = f; ped.state = FLOORED[ped.state] ? ped.state : 'goon'; ped.panic = 0; ped.speed = 0;
    ped.hp = o.keepHp ? (ped.hp ?? maxHp(ped)) : f.hp; f.lastHp = ped.hp;
    if (o.outlaw) ped.outlaw = true;
    if (weapon === 'knife') { const g = makeWeapon('knife'); g.position.set(KNIFE_GRIP[0], KNIFE_GRIP[1], KNIFE_GRIP[2]); g.rotation.set(KNIFE_GRIP[3], 0, 0); ped.model.userData.hands[0].add(g); f.tool = g; }
    else if (weapon === 'pistol') { const g = makeWeapon('pistol'); g.position.set(0, -.5, .02); g.rotation.set(Math.PI / 2, 0, 0); ped.model.userData.hands[0].add(g); f.tool = g; }
    list.push(f); f.group?.list.push(f); return f;
  }

  // ---------- a pistol going off (the story's gunmen shoot the same way) ----------
  function fire(f, dist) {
    const ped = f.ped, inCar = p.mode === 'car';
    ped.model.updateMatrixWorld(true); muzzle.copy(f.tool.userData.muzzle); f.tool.localToWorld(muzzle);
    let chance = f.accuracy * (1 - clamp(dist / f.range, 0, 1) * .6) * (p.speed > 5 ? .55 : 1) * (inCar ? .8 : 1);
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
    if (inCar) { p.vehicle.damage(f.damage * .7); game.fx.spark(tx, ty, tz, 4, .5); game.audio.ting(); p.hurt(f.damage * .25); }
    else p.hurt(f.damage);
  }

  // ---------- what they do when nobody is bothering them ----------
  function idle(f, dt, t, dist, sees) {
    const ped = f.ped, u = ped.model.userData, [R, L] = u.arms, home = f.home;
    ped.speed = 0;
    if (f.mood === 'home' || (f.idle !== 'drunk' && Math.hypot(home.x - ped.x, home.z - ped.z) > .6)) {            // walking back to their spot
      const dx = home.x - ped.x, dz = home.z - ped.z, d = Math.hypot(dx, dz);
      if (d < .5) { f.mood = 'calm'; if (home.face !== undefined) ped.face = home.face; return; }
      walk(f, dx / d, dz / d, 2.2, dt); if (f.stuck > 4) { ped.x = home.x; ped.z = home.z; f.stuck = 0; }      // wedged behind something: never mind how they got back
      return;
    }
    if (f.idle === 'drunk') {
      // shuffle about the room, stop, sway, lift the bottle
      const r = home.rect;
      if (f.goal) {
        const dx = f.goal.x - ped.x, dz = f.goal.z - ped.z, d = Math.hypot(dx, dz);
        if (d < .4 || (f.goalT -= dt) < 0) { f.goal = null; f.waitT = rnd(2.5, 7); }
        else { const wob = Math.sin(t * 1.7 + f.seed) * .5, c = Math.cos(wob), s = Math.sin(wob); walk(f, (dx * c - dz * s) / d, (dx * s + dz * c) / d, .75, dt); if (f.stuck > .6) f.goal = null; }
      } else if ((f.waitT -= dt) < 0 && r) { f.goal = { x: rnd(r.x0, r.x1), z: rnd(r.z0, r.z1) }; f.goalT = 9; f.stuck = 0; }
      else if (Math.random() < dt * .12) f.sip = 1.6;
      if (!ped.model.visible) return;
      u.body.rotation.z += Math.sin(t * 1.3 + f.seed) * .1; u.body.rotation.x += Math.sin(t * .9 + f.seed * 2) * .05; u.head.rotation.z += Math.sin(t * 1.1 + f.seed) * .12;
      if (f.sip > 0) { f.sip -= dt; const k = Math.sin(Math.min(1, (1.6 - f.sip) * 2.2, f.sip * 2.2) * Math.PI / 2); L.rotation.x = -.35 - 1.05 * k; L.rotation.z = -.3 * k + .12 * (1 - k); L.userData.bend = .7 + 1.25 * k; }
      else if (!ped.speed) { L.rotation.x = -.35; L.userData.bend = .7; }
      return;
    }
    // watching you when you come near, otherwise facing the way they were put
    const look = sees && dist < 13 ? Math.atan2(p.x - ped.x, p.z - ped.z) : home.face ?? ped.face;
    ped.face += angleDiff(look, ped.face) * Math.min(1, dt * 3);
    if (!ped.model.visible) return;
    ped.model.rotation.y = ped.face;
    if (f.idle === 'sit') {              // on the ground by the fire, legs out
      u.body.position.y -= .56; u.legs[0].rotation.x = -1.5; u.legs[1].rotation.x = -1.38; u.legs[0].rotation.z = -.14; u.legs[1].rotation.z = .14;
      u.body.rotation.x = -.12 + Math.sin(t * .8 + f.seed) * .03; R.rotation.x = -.6 + Math.sin(t * 1.3 + f.seed) * .08; L.rotation.x = -.5; R.userData.bend = .7; L.userData.bend = .55;
    } else if (f.seed > 3.1) { R.rotation.x = L.rotation.x = -.42; R.rotation.z = .5; L.rotation.z = -.5; R.userData.bend = 1.5; L.userData.bend = 1.62; }       // arms folded
    else if (f.seed > 1.5) { R.rotation.x = -.15; L.rotation.x = -.55 + Math.sin(t * .7 + f.seed) * .1; L.rotation.z = -.3; R.userData.bend = .2; L.userData.bend = 1.3 + Math.sin(t * 1.9 + f.seed) * .15; }       // one hand up, talking
  }

  // One step in a direction, going round whatever is in the way. Sets ped.speed and turns them to face where they walk.
  function walk(f, mx, mz, speed, dt, faceTo = null) {
    const ped = f.ped;
    if ((f.sideT -= dt) > 0) { const sx = -mz * f.side, sz = mx * f.side; mx = mx * .2 + sx; mz = mz * .2 + sz; const l = Math.hypot(mx, mz) || 1; mx /= l; mz /= l; }
    if (clearWay(ped.x, ped.z, mx, mz)) { ped.x += mx * speed * dt; ped.z += mz * speed * dt; ped.speed = speed; f.stuck = Math.max(0, f.stuck - dt * .5); }
    else { ped.speed = 0; if ((f.stuck += dt) > .2 && f.sideT <= 0) { f.side = Math.random() < .5 ? 1 : -1; f.sideT = rnd(.7, 1.3); } }
    ped.face += angleDiff(faceTo ?? Math.atan2(mx, mz), ped.face) * Math.min(1, dt * 10);
  }

  // ---------- the fight ----------
  function fight(f, dt, t, dist, sees, live) {
    const ped = f.ped, inCar = p.mode === 'car', dx = p.x - ped.x, dz = p.z - ped.z, ux = dx / dist, uz = dz / dist;
    const reachD = inCar ? p.vehicle.distanceTo(ped.x, ped.z) : dist, toYou = Math.atan2(dx, dz);
    // had enough? (you got away, or dragged them too far from home)
    const far = Math.hypot(ped.x - f.home.x, ped.z - f.home.z);
    if (!live || p.sky || (far > f.leash && dist > 5) || ((!sees || dist > 40) && (f.calmT += dt) > BRAWL.calm)) { f.mood = 'home'; f.windT = 0; f.calmT = 0; if (f.citizen) { ped.state = 'return'; ped.panic = 0; drop(f); } return; }
    if (sees && dist <= 40) f.calmT = 0;
    if (f.stun > 0) { f.stun -= dt; ped.speed = 0; ped.face += angleDiff(toYou, ped.face) * Math.min(1, dt * 6); return; }

    if (f.weapon === 'pistol') {
      if (dist > f.hold || !sees) walk(f, ux, uz, f.speed, dt); else { ped.speed = 0; ped.face += angleDiff(toYou, ped.face) * Math.min(1, dt * 12); }
      if (!sees || dist > f.range) { f.cool = Math.max(f.cool, .35); return; }
      if (ped.model.visible) { const [R, L] = ped.model.userData.arms; ped.model.rotation.y = ped.face; R.rotation.x = -Math.PI / 2; R.rotation.z = .12; L.rotation.x = -1.45; L.rotation.z = -.5; }
      if ((f.cool -= dt) > 0) return;
      f.cool = f.rate * rnd(.7, 1.3);
      if (Math.abs(angleDiff(toYou, ped.face)) < .6) fire(f, dist);
      return;
    }

    // fists and knives: the ones whose turn it is come right in, the rest hang back and circle
    const want = f.reach * .9, ring = 3 + (f.seed % 1) * .7;
    let mx = 0, mz = 0;
    if (f.windT > 0 || f.strikeT > 0) { if (reachD > want) { mx = ux * .35; mz = uz * .35; } }      // committed to the swing: a half step at most
    else if (f.turn) { if (reachD > want) { mx = ux; mz = uz; } else if (reachD < want * .5) { mx = -ux * .5; mz = -uz * .5; } }
    else if (dist > ring + .4) { mx = ux; mz = uz; }
    else { mx = -uz * f.circ * .45; mz = ux * f.circ * .45; if (dist < ring - .5) { mx -= ux * .7; mz -= uz * .7; } if (Math.random() < dt * .25) f.circ = -f.circ; }
    const m = Math.hypot(mx, mz);
    if (m > .05) walk(f, mx / m, mz / m, f.speed * Math.min(1, m), dt, toYou); else { ped.speed = 0; ped.face += angleDiff(toYou, ped.face) * Math.min(1, dt * 10); }

    if (f.strikeT > 0) f.strikeT -= dt;
    if (f.windT > 0) {
      if ((f.windT -= dt) <= 0) {                           // the swing lands, or meets air
        f.strikeT = .24; f.cool = f.rate * rnd(.75, 1.35);
        const near = dist < 40, blade = f.weapon === 'knife';
        if (live && reachD < f.reach + .45 && Math.abs(angleDiff(toYou, ped.face)) < 1 && p.tumble <= 0 && Math.abs(p.y - ped.y) < 2) {
          if (inCar) { p.vehicle.damage(f.damage * .35); game.audio.ting(); game.fx.spark(ped.x + ux * .8, ped.y + 1.1, ped.z + uz * .8, 3, .4); }
          else if (game.combat.takeBlow(f.damage * (f.heavy ? 1.5 : 1), ux, uz, { blade, heavy: f.heavy })) unanswered = f.heavy ? 0 : unanswered + 1;
          else unanswered = 0;
        } else if (near) blade ? game.audio.slash() : game.audio.whoosh();
      }
    } else if (f.turn && (f.cool -= dt) <= 0 && reachD < f.reach + .1 && sees && live && p.tumble <= 0) {
      f.heavy = f.weapon === 'fists' && unanswered >= BRAWL.floorAt;       // you have been soaking them up: this one is the haymaker
      f.windDur = f.windT = f.wind * (f.heavy ? 1.6 : 1) * rnd(.9, 1.15);
      if (dist < 25 && Math.random() < .5) game.audio.grunt(1 - dist / 25);
    }
  }

  // how they hold themselves in a fight (runs after the walk cycle has posed the arms)
  function pose(f, t) {
    const ped = f.ped; if (!ped.model.visible) return;
    const u = ped.model.userData, [R, L] = u.arms, blade = f.weapon === 'knife';
    ped.model.rotation.y = ped.face;
    if (f.weapon === 'pistol') return;
    const bob = Math.sin(t * 6 + f.seed) * .06;
    L.rotation.x = -.8 + bob; L.rotation.z = u.big ? -.75 : -.5; L.userData.bend = 1.7;                 // the guard hand stays up
    if (f.strikeT > 0) {
      const k = 1 - f.strikeT / .24, ext = Math.sin(Math.min(1, k * 1.7) * Math.PI / 2) * (1 - Math.max(0, k - .6) * 1.6);
      if (blade) { R.rotation.x = -2.5 + ext * 1.8; R.rotation.z = .5 - ext * .5; R.userData.bend = .9 * (1 - ext) + .15; }
      else { R.rotation.x = -.6 - ext * (f.heavy ? 1.2 : 1.0); R.rotation.z = (u.big ? .5 : .3) * (1 - ext * .6); R.userData.bend = 1.6 * (1 - ext); u.body.rotation.x += ext * (f.heavy ? .22 : .1); }
    } else if (f.windT > 0) {
      const k = 1 - f.windT / f.windDur, e = Math.sin(k * Math.PI / 2);
      if (blade) { R.rotation.x = -1.2 - e * 1.3; R.rotation.z = .3 + e * .2; R.userData.bend = .6 + e * .4; }                       // the knife goes up
      else { R.rotation.x = -.8 + e * (f.heavy ? 1.5 : 1.1); R.rotation.z = .3 - e * .1; R.userData.bend = 1.7 + e * .25; u.body.rotation.x -= e * (f.heavy ? .2 : .08); }      // the fist goes back
    } else { R.rotation.x = (blade ? -.65 : -.8) - bob; R.rotation.z = u.big ? .75 : blade ? .25 : .5; R.userData.bend = blade ? 1.0 : 1.7; }
  }

  const brawlers = {
    list,
    // A crew that turns on you together. o.onProvoke(group) runs the moment it does; o.join = chance each member piles in (1 = all of them).
    group(name, o = {}) { return { name, list: [], angry: false, join: 1, ...o, get alive() { return this.list.filter(f => !f.out && !f.gone).length; }, get standing() { return this.list.filter(f => !f.out && !f.gone); } }; },
    // kind: a character kind ('possum', 'bighead'...). o: { weapon, group, idle, home, face, stats, outlaw, look (passed to the character builder) }
    add(kind, x, z, o = {}) {
      const ped = peds.spawn(kind, x, z, 0, 0, false, o.look);
      ped.state = 'goon'; ped.panic = 0; ped.face = o.face ?? Math.random() * 6.28;
      return make(ped, { ...o, home: o.home || { x, z, face: ped.face } });
    },
    fighterOf: (ped) => ped.fighter || null,
    // Start it. who: a fighter or a group. Everyone in the crew within shouting distance joins in (each with the crew's `join` chance; the one you wronged always does).
    provoke(who, quiet = false) {
      const f = who.ped ? who : null, g = f ? f.group : who;
      if (f && !f.out && f.mood !== 'angry') { f.mood = 'angry'; f.calmT = 0; }
      if (!g) return;
      const first = !g.angry; g.angry = true;
      if (first) {
        const at = f ? f.ped : g.list[0]?.ped;
        for (const o of g.list) if (!o.out && !o.gone && o !== f && o.mood !== 'angry' && (!at || Math.hypot(o.ped.x - at.x, o.ped.z - at.z) < 60) && Math.random() < g.join) { o.mood = 'angry'; o.calmT = 0; o.cool = rnd(.4, 1.6); }
        if (!quiet) g.onProvoke?.(g, f);
      }
    },
    // Your fist or blade landed on this citizen (hits.js): a fighter is rocked back and his crew knows about it; anyone else may square up.
    struck(ped) {
      unanswered = 0;
      const f = ped.fighter;
      if (f) { f.stun = Math.max(f.stun, .42); f.windT = 0; f.strikeT = 0; brawlers.provoke(f); return; }
      if (ped.cop || ped.ko || ped.hp <= 0 || ped.outlaw || game.match?.on) return;
      const u = ped.model.userData;
      if (ped.squaresUp === undefined) ped.squaresUp = Math.random() < MELEE.fightBack[u.bot ? 'bot' : u.big ? 'bighead' : 'critter'];
      if (!ped.squaresUp) return;
      const g = make(ped, { citizen: true, keepHp: true, stats: { leash: 45, speed: 3.7, damage: 6, cash: [0, 0] } }); g.mood = 'angry'; g.stun = .5;
      game.hud.toast('THEY WANT A FIGHT', 'bad');
    },
    blocked() { unanswered = 0; },
    clear(group) { for (const f of (group ? group.list.slice() : list.slice())) if (!f.gone) drop(f); if (group) { group.list.length = 0; group.angry = false; } },

    update(dt, t) {
      if (!list.length) return;
      const live = !game.over && game.state === 'playing';
      // whose turn is it? the closest few of each crew (and of the loners) come in, the rest wait
      const angry = list.filter(f => f.mood === 'angry' && !f.out && f.weapon !== 'pistol' && !FLOORED[f.ped.state]);
      for (const f of angry) f.rank = Math.hypot(f.ped.x - p.x, f.ped.z - p.z) - (f.turn ? .8 : 0);
      angry.sort((a, b) => a.rank - b.rank); let slots = angry.length ? Math.max(...angry.map(f => f.crowd)) : 0;
      for (const f of angry) f.turn = slots-- > 0;

      for (const f of list.slice()) {
        const ped = f.ped;
        if (!peds.list.includes(ped)) { drop(f); continue; }                    // carted off by the pedestrian system
        if (ped.ko || ped.state === 'ko') {
          if (!f.out) {
            f.out = true; f.mood = 'out'; disarm(f, true);
            const near = Math.hypot(ped.x - p.x, ped.z - p.z) < 40;
            if (near && f.cash[1] > 0) game.addMoney(Math.round(rnd(f.cash[0], f.cash[1]) / 5) * 5);
            f.group?.onDown?.(f.group, f);
          }
          if (f.citizen) { drop(f); continue; }
          if (ped.state === 'ko' && ped.timer < 1.2) drop(f);                    // before the street sweeper counts him as a missing citizen
          continue;
        }
        if (ped.hp < f.lastHp) { if (f.mood !== 'angry') brawlers.provoke(f); f.calmT = 0; }       // shot, run into, anything
        f.lastHp = ped.hp;
        if (FLOORED[ped.state]) {
          f.windT = 0; f.strikeT = 0;
          // knocked over is a reason to fight; so is having to jump out of the way of YOUR car
          const yours = ped.state !== 'dive' || (p.mode === 'car' && p.vehicle.speed > 5 && p.vehicle.distanceTo(ped.x, ped.z) < 9);
          if (f.mood === 'calm' && yours) brawlers.provoke(f);
          continue;
        }
        if (ped.state !== 'goon') ped.state = 'goon';                           // back on their feet
        ped.panic = 0;
        if (ped.reelT > 0) {                                                    // shoved back by your punch
          ped.reelT -= dt; const k = Math.max(0, 1 - 6 * dt); ped.vx *= k; ped.vz *= k;
          const s = Math.hypot(ped.vx, ped.vz); if (s > .1 && clearWay(ped.x, ped.z, ped.vx / s, ped.vz / s, .6)) { ped.x += ped.vx * dt; ped.z += ped.vz * dt; }
        }
        const dist = Math.hypot(p.x - ped.x, p.z - ped.z) || 1;
        const sees = live && dist < 60 && Math.abs(p.y - ped.y) < 5 && ph.canSee(ped.x, ped.z, p.x, p.z);
        if (f.mood === 'angry') {
          fight(f, dt, t, dist, sees, live); if (f.gone) continue;
          // nobody stands inside anybody else
          if (dist < .75 && p.mode === 'foot') { const k = (.75 - dist) / dist; ped.x -= (p.x - ped.x) * k; ped.z -= (p.z - ped.z) * k; }
          for (const o of angry) if (o !== f) { const ox = ped.x - o.ped.x, oz = ped.z - o.ped.z, d = Math.hypot(ox, oz); if (d < .8 && d > .01) { ped.x += ox / d * (.8 - d) * .5; ped.z += oz / d * (.8 - d) * .5; } }
          if (f.mood === 'angry') pose(f, t);
        } else idle(f, dt, t, dist, sees);
      }
      if (!angry.length) unanswered = 0;
    },
  };
  return brawlers;
}
