// The animals of Sunset Zoo. world/zoo.js built the enclosures and left the plan in districts.zones.zoo;
// this file puts the animals in them and decides what each one does.
//   At home they wander, graze, wallow and call, and the lions come to the bars to look at you.
//   An enclosure is open as soon as any piece of its fence is gone: rammed by a car, shot out (the penguins'
//   glass), pushed over by an angry elephant, or because you opened the keeper's yellow gate with E.
//   Once out, each kind does what its temper says (ZOO.kinds in config.js): lions, lionesses and bears hunt
//   whoever is on foot, gorillas and hippos go for anyone who comes too close, elephants only mind if you hurt
//   them, zebras and giraffes run, and the penguins and hippos head for the sea behind the zoo.
//   A car bowls the smaller ones over; an elephant or a hippo is like hitting a rock. All of them can be shot,
//   punched or run down, and whoever you hurt holds a grudge. Go far enough away and everyone is home again.
// They are moved by hand like the citizens are (no physics bodies), except that the two heavy kinds carry a
// round collider about with them so cars and people cannot pass through.
import { ZOO } from '../config.js';
import { clamp, rnd, angleDiff } from '../core/utils.js';
import { groundY } from '../world/terrain.js';
import { WATER } from '../world/map.js';
import { makeBeast, animateBeast } from './beasts.js';
import { raySphere } from './ray.js';

// where a shot can land on each kind: [metres ahead of its middle, metres up, radius]
const HITS = {
  lion: [[.75, 1, .5], [0, .95, .5], [-.55, .9, .45]], lioness: [[.75, .95, .45], [0, .9, .48], [-.55, .88, .44]], bear: [[.9, .95, .5], [.2, .95, .62], [-.5, .9, .6]],
  elephant: [[2.1, 2.1, .75], [.9, 1.9, 1.05], [-.6, 1.8, 1.1]], giraffe: [[1.9, 4.2, .4], [1.4, 3.2, .42], [.8, 2.3, .5], [-.3, 1.9, .62], [0, .9, .45]],
  zebra: [[1.3, 1.6, .4], [.5, 1.2, .5], [-.5, 1.15, .5]], hippo: [[1.7, .9, .6], [.6, .85, .75], [-.6, .85, .75]], gorilla: [[.5, 1.3, .45], [.1, .95, .65]], penguin: [[0, .5, .4]],
};
const GRAZES = { zebra: .6, giraffe: .25, elephant: .4, hippo: .3, bear: .25 }, hyp = Math.hypot;

export function createZooLife(game, calls) {
  const plan = game.city.districts.zones?.zoo;
  if (!plan) return { list: [], prompt: '', cast() { }, hurt() { return false; }, update() { } };
  const C = ZOO, p = game.player, ph = game.physics, CX = plan.cx, CZ = plan.cz, GATE = plan.gate, BACK = plan.back, list = [];
  const inZoo = (x, z, m = 0) => x > plan.x0 - m && x < plan.x1 + m && z > plan.z0 - m && z < plan.z1 + m;
  const inPen = (pen, x, z, m = 0) => x > pen.x0 - m && x < pen.x1 + m && z > pen.z0 - m && z < pen.z1 + m;
  const alive = () => game.state === 'playing' && !game.over && !p.sky && p.health > 0 && !game.indoors?.room;
  const fromZoo = (a) => hyp(a.x - CX, a.z - CZ);

  // somewhere to stand in an enclosure: now and then in the pool, or (the lion) up on the rock
  function spotIn(a) {
    const pen = a.pen, K = a.K, m = K.r + .8;
    for (let n = 0; n < 24; n++) {
      let x, z;
      if (pen.pool && Math.random() < (a.kind === 'hippo' ? .6 : a.kind === 'penguin' ? .45 : .12)) { const q = rnd(0, 6.28), d = rnd(0, pen.pool[2] * .7); x = pen.pool[0] + Math.cos(q) * d; z = pen.pool[1] + Math.sin(q) * d; }
      else if (pen.perch && a.kind === 'lion' && Math.random() < .5) { x = pen.perch[0] + rnd(-1.5, 1.5); z = pen.perch[1] + rnd(-1.5, 1.5); }
      else { x = rnd(pen.x0 + m, pen.x1 - m); z = rnd(pen.z0 + m, pen.z1 - m); }
      if (!pen.obst.some(o => hyp(x - o.x, z - o.z) < o.r + K.r + .2)) return [x, z];
    }
    return [pen.cx, pen.cz];
  }
  const idle = (a, t = rnd(2, 7)) => { a.act = 'idle'; a.t = t; a.graze = Math.random() < (GRAZES[a.kind] || 0); };

  const zoo = { list, prompt: '', cast, hurt, update };
  for (const pen of plan.pens) pen.who.forEach((kind) => {
    const K = C.kinds[kind], model = makeBeast(kind); model.visible = false; game.scene.add(model);
    const a = {
      owner: zoo, kind, K, pen, model, x: 0, z: 0, y: 0, h: rnd(0, 6.28), speed: 0, hp: K.hp, state: 'home', act: 'idle', t: rnd(0, 6), tx: 0, tz: 0,
      target: null, loose: false, angry: 0, scared: 0, cool: 0, hitT: 0, think: rnd(0, .3), said: -9, yell: 0, side: 0, graze: false, vx: 0, vz: 0, tilt: 0, push: 0, stuck: 0, px: 0, pz: 0,
    };
    [a.x, a.z] = spotIn(a); a.home = [a.x, a.z]; a.px = a.x; a.pz = a.z; a.y = groundY(a.x, a.z);
    if (K.heavy) a.col = ph.addStaticPost(a.x, a.z, K.r * .88, -1e9);                       // no height: nothing looks or shoots into it (cast() below answers for shots)
    if (K.temper !== 'shy') game.markers.push(a.marker = { x: a.x, z: a.z, color: '#ff3b30', size: 4, visible: () => a.loose && a.state !== 'ko' });
    list.push(a);
  });
  game.markers.push({ x: GATE.x - 3, z: CZ, color: '#ffd34d', glyph: 'Z', ink: '#3a2a00', size: 6, visible: () => !game.match?.on });

  const voice = (a, k = 1) => { if (!a.K.call || game.time - a.said < 2.5) return; a.said = game.time; calls[a.K.call](k * calls.near(a.x, a.z, 75)); a.yell = .7; };

  // ---------- finding the way ----------
  // The zoo is a cross of two paths inside a wall: wherever something is, this gives the next point to walk to.
  const lane = (x, z) => !inZoo(x, z) ? 'out' : Math.abs(z - CZ) < 5.5 ? 'arm' : Math.abs(x - CX) < 5.2 ? 'spine' : 'pen';
  function next(a, tx, tz) {
    const la = lane(a.x, a.z), lt = lane(tx, tz), mid = CX + clamp(a.x - CX, -2.5, 2.5);
    if (la === 'out') {
      if (lt === 'out') return [tx, tz];
      const g = hyp(a.x - GATE.x, a.z - GATE.z) < hyp(a.x - BACK.x, a.z - BACK.z) ? GATE : BACK, s = g === GATE ? -1 : 1;
      return Math.abs(a.z - g.z) > g.hw - 1 ? [g.x + s * 4, g.z] : [g.x - s * 4, g.z];
    }
    if (la === 'pen') return lt === 'pen' && hyp(tx - a.x, tz - a.z) < 14 ? [tx, tz] : [CX + Math.sign(a.x - CX) * 2, a.z];
    if (la === 'spine') return lt === 'spine' || lt === 'pen' && Math.abs(tz - a.z) < 4 ? [tx, tz] : lt === 'pen' ? [mid, tz] : [mid, CZ + Math.sign(a.z - CZ) * 3];
    if (lt === 'arm') return [tx, tz];
    if (lt === 'out') { const g = tx < CX ? GATE : BACK, s = g === GATE ? -1 : 1; return [g.x + s * 5, g.z + clamp(a.z - g.z, -1.5, 1.5)]; }
    return Math.abs(a.x - CX) > 3.2 ? [mid, a.z] : [mid, tz];
  }
  // how far it is clear in one direction (the sea counts as a wall for those that don't swim)
  function open(a, h, len) {
    const sx = Math.sin(h), sz = Math.cos(h), r = a.K.r;
    if (!a.K.swim && groundY(a.x + sx * (r + len), a.z + sz * (r + len), a.y) < WATER + .3) return 0;
    return ph.probeDrive(a.x + sx * (r + .12), a.z + sz * (r + .12), sx, sz, len);
  }
  function steer(a, want, top) {
    const len = 1.5 + top * .3; if (open(a, want, len) >= len) { a.side = 0; return want; }
    let best = want + Math.PI, score = -1;
    for (const k of a.side ? [a.side * .75, a.side * 1.5, -a.side * .75, -a.side * 1.5] : [.75, -.75, 1.5, -1.5]) { const f = open(a, want + k, len); if (f >= len) { a.side = Math.sign(k); return want + k; } if (f > score) { score = f; best = want + k; } }
    return best;
  }
  // Turn toward a point and walk at it. Returns how far away it still is.
  function go(a, tx, tz, top, dt, feel = a.loose) {
    const dx = tx - a.x, dz = tz - a.z, d = hyp(dx, dz); if (d < .05) { a.speed = 0; return d; }
    const want = feel ? steer(a, Math.atan2(dx, dz), top) : Math.atan2(dx, dz), diff = angleDiff(want, a.h);
    a.h += clamp(diff, -a.K.turn * dt, a.K.turn * dt);
    a.speed += (top * clamp(Math.cos(diff) * 1.3, .12, 1) - a.speed) * Math.min(1, dt * 5);
    a.x += Math.sin(a.h) * a.speed * dt; a.z += Math.cos(a.h) * a.speed * dt; return d;
  }
  const face = (a, x, z, dt) => { a.h += clamp(angleDiff(Math.atan2(x - a.x, z - a.z), a.h), -a.K.turn * dt, a.K.turn * dt); };
  // where a loose one wanders when it has nobody to chase
  function roam(a) {
    const K = a.K;
    if (K.swim) return [plan.x1 + rnd(7, 14), CZ + rnd(-14, 14)];                             // the sea, out of the back gate
    if (fromZoo(a) > C.leash * .8) return [GATE.x - rnd(4, 14), CZ + rnd(-8, 8)];             // far enough: back toward the gate
    if (K.temper === 'hunter' && alive() && hyp(p.x - CX, p.z - CZ) < C.leash) { const k = rnd(.25, .7); return [a.x + (p.x - a.x) * k + rnd(-12, 12), a.z + (p.z - a.z) * k + rnd(-12, 12)]; }      // prowling, and drifting your way
    if (Math.random() < .3) return [CX + rnd(-2.5, 2.5), rnd(plan.z0 + 6, plan.z1 - 6)];
    return [rnd(plan.x0 - 24, plan.x0 - 5), CZ + rnd(-45, 45)];                              // out of the gate and onto the coast road
  }

  // ---------- who they go for ----------
  function prey(a) {
    if (fromZoo(a) > C.leash) return null;
    let best = null, bd = 1e9; const d = hyp(p.x - a.x, p.z - a.z);
    if (alive() && Math.abs(p.y - a.y) < 4 && (p.mode === 'foot' ? d < (a.angry > 0 ? C.lose : C.sense) : d < (a.angry > 0 ? C.sense : 16) && (p.vehicle?.speed ?? 0) < 7)) { best = p; bd = d - 6; }
    if (d < 130) for (const q of game.peds.list) {
      if (q.state === 'ko' || q.state === 'air') continue;
      const e = hyp(q.x - a.x, q.z - a.z); if (e < 30 && e < bd && Math.abs(q.y - a.y) < 3) { best = q; bd = e; }
    }
    return best;
  }
  function decide(a) {
    const K = a.K, d = hyp(p.x - a.x, p.z - a.z), mine = !a.loose && inPen(a.pen, p.x, p.z, .3);
    if (a.act === 'attack' || a.act === 'out' || a.act === 'warn' || a.act === 'down' || a.act === 'eat') return;
    if (!a.loose && a.pen.open && !mine) { a.act = 'out'; a.leg = 0; a.gap = a.pen.open; a.wait = rnd(0, 2.2); a.t = 30; a.target = null; return; }       // the way is open
    if (K.temper === 'shy') {
      const scared = a.scared > 0 || alive() && Math.abs(p.y - a.y) < 4 && d < K.shy + (p.mode === 'foot' ? p.speed * .5 : 5) && (a.loose || inPen(a.pen, p.x, p.z, 3));
      if (scared) { if (a.act !== 'flee') { a.act = 'flee'; voice(a, .7); } a.t = rnd(1.5, 3); } else if (a.act === 'flee' && a.t <= 0) idle(a);
      return;
    }
    let T = null; const near = alive() && Math.abs(p.y - a.y) < 4.5;
    if (K.temper === 'hunter') T = a.loose ? prey(a) : near && (mine && p.mode === 'foot' || a.angry > 0 && d < 40) ? p : null;
    else if (K.temper === 'guard') T = near && (a.angry > 0 && d < C.sense || d < K.guard && p.mode === 'foot' && (a.loose || mine)) ? p : null;
    else T = near && a.angry > 0 && d < C.lose ? p : null;
    if (T) {
      const fresh = a.target !== T; a.target = T;
      if (fresh && T === p && K.temper === 'guard' && a.angry <= 0) { a.act = 'warn'; a.t = 1.3; voice(a); return; }
      if (fresh && T === p) voice(a);
      a.act = 'chase';
    } else if (a.act === 'chase') { a.target = null; idle(a, rnd(.5, 2)); }
    else if (!a.loose && a.act === 'idle' && near && p.mode === 'foot' && K.temper === 'hunter' && Math.random() < .3 && inPen(a.pen, p.x, p.z, 9)) {       // someone at the bars: go and look
      const m = K.r + .9; a.tx = clamp(p.x, a.pen.x0 + m, a.pen.x1 - m); a.tz = clamp(p.z, a.pen.z0 + m, a.pen.z1 - m); a.act = 'walk'; a.t = 12;
    }
  }

  // ---------- teeth, fists and tusks ----------
  let told = -9, mercy = 0;             // mercy: nothing else lands on you until then, however many of them there are
  function strike(a, T) {
    const K = a.K, sx = Math.sin(a.h), sz = Math.cos(a.h), vol = calls.near(a.x, a.z, 60);
    if (K.temper === 'hunter' || a.kind === 'hippo') calls.chomp(vol); else calls.thump(vol);
    if (T !== p) {                                   // a citizen
      game.peds.knockOut(T, sx * K.knock * .6, sz * K.knock * .6); game.peds.scare(a.x, a.z, 32, 10);
      if (K.temper === 'hunter') { a.eat = rnd(2.5, 4.5); a.target = null; }
      return;
    }
    mercy = game.time + C.mercy;
    if (p.mode === 'foot') {
      p.hurt(K.hit); p.tumble = Math.max(p.tumble, .9); p.body.setLinvel({ x: sx * K.knock, y: sz * K.knock }, true); game.cam.shake(.65);
      if (game.time - told > 5) { told = game.time; game.hud.toast(K.verb, 'bad'); }
      return;
    }
    const v = p.vehicle; if (!v) return;             // sitting in something
    if (v.stats.rider) { p.thrown(K.hit / 3); if (game.time - told > 5) { told = game.time; game.hud.toast(K.verb, 'bad'); } return; }
    const k = K.heavy ? .55 : .18, lv = v.body.linvel(); v.body.setLinvel({ x: lv.x + sx * K.knock * k, y: lv.y + sz * K.knock * k }, true); v._set.x += sx * K.knock * k; v._set.y += sz * K.knock * k;      // a shove, not a crash
    v.damage(K.hit * (K.heavy ? C.ram : C.claw)); game.cam.shake(K.heavy ? .6 : .3); game.audio.crash?.(K.heavy ? .3 : .12);
  }

  // ---------- being shot, punched or run down ----------
  function cast(ox, oy, oz, dx, dy, dz, tmin, range, consider) {
    for (const a of list) {
      if (!a.model.visible || Math.abs(a.x - ox) > range + 4 || Math.abs(a.z - oz) > range + 4) continue;
      const sx = Math.sin(a.h), sz = Math.cos(a.h), flat = a.state === 'ko' ? .4 : 1;
      for (const [f, u, r] of HITS[a.kind]) consider(raySphere(ox, oy, oz, dx, dy, dz, a.x + sx * f, a.y + u * flat, a.z + sz * f, r, tmin, range), 'beast', a);
    }
  }
  function hurt(a, h, damage, dx = 0, dz = 0, { byPlayer = true, car = false } = {}) {
    if (a.state === 'ko') return false;
    const K = a.K, harmless = K.temper === 'shy' || !a.loose && a.angry <= 0;
    a.hp -= damage; game.debris?.burst(h.x ?? a.x, h.y ?? a.y + 1, h.z ?? a.z, dx, dz, 3, 0xb3261e, .1, 3);
    calls.thump(.45 * calls.near(a.x, a.z, 60)); if (byPlayer && !car) game.combat?.hitMarker(a.hp <= 0);
    if (a.hp <= 0) {
      a.state = 'ko'; a.act = 'ko'; a.target = null; a.speed = 0;
      if (byPlayer && harmless && C.cruelty > 0 && game.state === 'playing') game.police.crime(2, C.cruelty, 'ANIMAL CRUELTY!');
      return true;
    }
    if (K.temper === 'shy' || !byPlayer) { a.scared = 8; return false; }
    a.angry = C.grudge; voice(a);
    if (K.temper === 'hunter') for (const m of list) if (m.pen === a.pen && m.state !== 'ko') m.angry = Math.max(m.angry, C.grudge * .6);      // the pride takes it personally
    return false;
  }
  // a car driving into one of the lighter animals
  function bowl(a, v) {
    const sp = v.speed, byPlayer = v.driver === 'player', keep = a.kind === 'penguin' ? .98 : .8, lv = v.body.linvel();
    v.body.setLinvel({ x: lv.x * keep, y: lv.y * keep }, true); v._set.x *= keep; v._set.y *= keep;
    if (a.kind !== 'penguin') { v.damage(sp * C.carCost); if (byPlayer) game.cam.shake(.35); }
    game.audio.bonk?.(); a.hitT = 1.2; a.vx = v.vx * .75; a.vz = v.vz * .75; a.target = null;
    if (!hurt(a, { x: a.x, y: a.y + .8, z: a.z }, (sp - 2) * C.carHurt, v.vx / sp, v.vz / sp, { byPlayer, car: true })) { a.act = 'down'; a.t = rnd(1.4, 2.4); }
  }

  // ---------- enclosures that are no longer shut ----------
  function checkPens() {
    for (const pen of plan.pens) {
      const gap = pen.panels.find(b => b.alive === false);
      if (!gap) { pen.open = null; continue; }
      if (pen.open) continue;
      pen.open = gap;
      if (game.state !== 'playing' || hyp(p.x - gap.x, p.z - gap.z) > 90 || !list.some(a => a.pen === pen && !a.loose && a.state !== 'ko')) continue;
      const danger = C.kinds[pen.who[0]].temper !== 'shy';
      game.hud.toast(`THE ${pen.name} ARE OUT!`, danger ? 'bad' : 'info'); game.peds.scare(CX, CZ, 75, danger ? 16 : 8);
      game.police.crime(C.heat, danger ? C.stars : Math.max(0, C.stars - 1), 'LETTING THE ANIMALS OUT!');
    }
  }
  function sendHome(a) {
    [a.x, a.z] = a.home; a.loose = false; a.state = 'home'; a.hp = a.K.hp; a.angry = a.scared = 0; a.target = null; a.gap = null; a.y = groundY(a.x, a.z); a.vx = a.vz = 0; idle(a);
  }

  let pensT = 0, homeT = 0, chatter = 4, hoofT = 0, pressed = false;
  window.addEventListener('keydown', (e) => { if (e.code === 'KeyE' && !e.repeat) pressed = true; });
  function update(dt, t) {
    const away = hyp(p.x - CX, p.z - CZ), anyOut = list.some(a => a.loose);
    // the keepers' gates
    let gate = null;
    if (p.mode === 'foot' && !p.nearCar && alive() && inZoo(p.x, p.z, 3)) for (const pen of plan.pens) { const b = pen.gate; if (b && b.alive && hyp(b.x - p.x, b.z - p.z) < 2.2 && Math.abs(b.y - p.y) < 2) { gate = pen; break; } }
    zoo.prompt = gate ? `<kbd>E</kbd> Open the ${gate.name.toLowerCase().replace(/s$/, '')} gate` : '';
    if (gate && pressed) { game.places.smash(gate.gate, 0, 0, 0, 0, 1, true); calls.gate(); pensT = 0; }
    pressed = false;
    if ((pensT -= dt) <= 0) { pensT = .4; checkPens(); }
    if ((homeT -= dt) <= 0) { homeT = 1; if (away > C.reset) for (const a of list) if ((a.loose || a.state === 'ko' || a.act === 'out') && hyp(a.x - p.x, a.z - p.z) > 150) sendHome(a); }
    if (away > 330 && !anyOut) { for (const a of list) a.model.visible = false; return; }
    // the noise of the place
    if ((chatter -= dt) <= 0) { chatter = rnd(3.5, 9); if (away < 90) { const a = list[Math.floor(Math.random() * list.length)]; if (a.state !== 'ko' && a.act !== 'chase') voice(a, .55); } }
    hoofT -= dt;

    const vehicles = game.traffic.vehicles;
    for (const a of list) {
      const K = a.K, far = hyp(a.x - p.x, a.z - p.z), m = a.model;
      a.t -= dt; a.cool -= dt; a.hitT -= dt; a.angry -= dt; a.scared -= dt; a.yell -= dt;
      if (a.marker) { a.marker.x = a.x; a.marker.z = a.z; }
      let pose = 'idle', look = 0, swimY = null;

      if (a.state === 'ko') pose = 'ko';
      else {
        if ((a.think -= dt) <= 0) { a.think = .25; decide(a); }
        switch (a.act) {
          case 'idle':
            a.speed += (0 - a.speed) * Math.min(1, dt * 6); pose = a.graze ? 'graze' : 'idle';
            if (far < 11 && alive() && !a.graze) look = clamp(angleDiff(Math.atan2(p.x - a.x, p.z - a.z), a.h), -1.1, 1.1);
            if (a.eat > 0) { a.eat -= dt; pose = 'graze'; break; }
            if (a.t <= 0) { [a.tx, a.tz] = a.loose ? roam(a) : spotIn(a); a.act = 'walk'; a.t = a.loose ? 40 : 22; }
            break;
          case 'walk': {
            const [x, z] = a.loose ? next(a, a.tx, a.tz) : [a.tx, a.tz];
            go(a, x, z, !a.loose ? K.walk : K.swim ? K.run : K.temper !== 'shy' ? K.walk * 1.3 : K.walk, dt);      // out, the swimmers hurry for the sea
            if (hyp(a.tx - a.x, a.tz - a.z) < K.r + .6 || a.t <= 0) idle(a);
            break;
          }
          case 'flee': {
            if (a.loose) { const ax = a.x - p.x, az = a.z - p.z, d = hyp(ax, az) || 1; go(a, a.x + ax / d * 14, a.z + az / d * 14, K.run, dt); }
            else {                                   // the corner of the enclosure furthest from you
              const pen = a.pen, mm = K.r + 1, x = Math.abs(p.x - (pen.x0 + mm)) > Math.abs(p.x - (pen.x1 - mm)) ? pen.x0 + mm : pen.x1 - mm, z = Math.abs(p.z - (pen.z0 + mm)) > Math.abs(p.z - (pen.z1 - mm)) ? pen.z0 + mm : pen.z1 - mm;
              if (hyp(x - a.x, z - a.z) > 1.2) go(a, x, z, K.run, dt); else { a.speed *= .8; face(a, p.x, p.z, dt); }
            }
            if (a.kind === 'zebra' && a.speed > 4 && hoofT <= 0 && far < 40) { hoofT = .34; calls.hooves(.6 * calls.near(a.x, a.z, 40)); }
            break;
          }
          case 'warn': a.speed *= .8; face(a, p.x, p.z, dt); pose = 'rear'; if (a.t <= 0) a.act = 'chase'; break;
          case 'chase': {
            const T = a.target; if (!T || T !== p && (T.state === 'ko' || T.state === 'air')) { a.target = null; idle(a, rnd(.4, 1.2)); break; }
            const d = hyp(T.x - a.x, T.z - a.z), inCar = T === p && p.mode !== 'foot', reach = K.reach + (inCar ? 1.4 : 0);
            if (d > C.lose) { a.target = null; idle(a, 1); break; }
            const [x, z] = a.loose ? next(a, T.x, T.z) : [T.x, T.z];
            if (d > reach * .7) go(a, x, z, K.run, dt); else { a.speed *= .7; face(a, T.x, T.z, dt); }
            if (d < reach && a.cool <= 0 && (T !== p || game.time > mercy - .3)) { a.act = 'attack'; a.t = .42; a.struck = false; }
            if (a.kind === 'zebra' && hoofT <= 0 && far < 40) { hoofT = .34; calls.hooves(.6 * calls.near(a.x, a.z, 40)); }
            break;
          }
          case 'attack': {
            const T = a.target; pose = a.kind === 'gorilla' || a.kind === 'elephant' ? 'rear' : 'bite'; a.speed *= .85;
            if (T) face(a, T.x, T.z, dt);
            if (!a.struck && a.t <= .2) { a.struck = true; if (T && (T !== p || game.time > mercy) && hyp(T.x - a.x, T.z - a.z) < K.reach + (T === p && p.mode !== 'foot' ? 2.2 : .9)) strike(a, T); }
            if (a.t <= 0) { a.cool = K.cool; if (a.target) a.act = 'chase'; else idle(a, .2); }
            break;
          }
          case 'out': {                              // through the gap in the fence
            if ((a.wait -= dt) > 0) { a.speed *= .8; break; }
            const b = a.gap, mm = K.r + 1.2, x = b.x + b.nx * (a.leg ? mm + 1.2 : -mm), z = b.z + b.nz * (a.leg ? mm + 1.2 : -mm);
            if (go(a, x, z, a.leg ? K.run * .7 : K.walk * 1.8, dt, false) < .8 || a.t <= 0) {
              if (a.leg++ || a.t <= 0) { a.loose = true; a.gap = null; idle(a, .2); if (K.temper !== 'shy') voice(a); }
              else if (K.heavy) for (const q of a.pen.panels) if (q.alive && hyp(q.x - b.x, q.z - b.z) < 3.2) game.places.smash(q, b.nx, b.nz, 0, 0, .8);      // too wide for the gap: it makes its own
            }
            break;
          }
          case 'down':                               // bowled over by a car
            a.x += a.vx * dt; a.z += a.vz * dt; a.vx *= Math.max(0, 1 - 3 * dt); a.vz *= Math.max(0, 1 - 3 * dt); a.speed = 0; pose = 'ko';
            if (a.t <= 0) { if (!a.loose && !inPen(a.pen, a.x, a.z, -.3)) a.loose = true; idle(a, .3); }
            break;
        }
        if (a.yell > 0 && pose === 'idle' && (K.temper === 'hunter' || a.kind === 'hippo')) pose = 'bite';

        // home: stay inside the fence and off the rocks. An angry heavyweight leaning on the fence pushes it over.
        if (!a.loose && a.act !== 'out' && a.act !== 'down') {
          const pen = a.pen, mm = K.r + .45, x = clamp(a.x, pen.x0 + mm, pen.x1 - mm), z = clamp(a.z, pen.z0 + mm, pen.z1 - mm), held = x !== a.x || z !== a.z;
          a.x = x; a.z = z;
          for (const o of pen.obst) { const dx = a.x - o.x, dz = a.z - o.z, d = hyp(dx, dz), need = o.r + K.r * .8; if (d < need && d > .01) { a.x += dx / d * (need - d); a.z += dz / d * (need - d); } }
          if (K.heavy && held && a.act === 'chase' && a.angry > 0) {
            if ((a.push += dt) > 1.1) { a.push = 0; const b = pen.panels.filter(q => q.alive).sort((q, r) => hyp(q.x - a.x, q.z - a.z) - hyp(r.x - a.x, r.z - a.z))[0]; if (b && hyp(b.x - a.x, b.z - a.z) < K.r + 2.6) { game.places.smash(b, b.nx, b.nz, 0, 0, 1); pensT = 0; } }
          } else a.push = 0;
        } else if (a.loose && (a.act === 'walk' || a.act === 'chase') && (a.stuck += dt) > 1.6) {      // going nowhere? try the other way round
          if (hyp(a.x - a.px, a.z - a.pz) < .5) { a.side = a.side ? -a.side : 1; a.h += 1.8 * a.side; if (a.act === 'walk') a.t = Math.min(a.t, 3); }
          a.stuck = 0; a.px = a.x; a.pz = a.z;
        }
        // cars
        if (far < 190 && a.hitT <= 0) for (const v of vehicles) {
          const dx = a.x - v.x, dz = a.z - v.z; if (Math.abs(dx) > 9 || Math.abs(dz) > 9 || Math.abs(v.y - a.y) > 3) continue;
          const lx = dx * v.fx + dz * v.fz, lz = dx * v.rx + dz * v.rz, pad = K.heavy ? K.r + .5 : K.r * .7;
          if (Math.abs(lx) > v.halfLen + pad || Math.abs(lz) > v.halfWid + pad) continue;
          if (K.heavy) { if (v.impact > 2.5) { a.hitT = .8; hurt(a, { x: a.x, y: a.y + 1.2, z: a.z }, v.impact * C.carHurt, v.vx, v.vz, { byPlayer: v.driver === 'player', car: true }); } }
          else if (v.speed > C.carKnock && a.act !== 'down') bowl(a, v);
          break;
        }
      }
      // one loose animal does not walk through another
      if (a.loose && a.state !== 'ko') for (const b of list) {
        if (b === a || !b.loose) continue; const dx = a.x - b.x, dz = a.z - b.z, d = hyp(dx, dz), need = (K.r + b.K.r) * .85;
        if (d < need && d > .01) { const k = (need - d) * (b.K.heavy && !K.heavy ? 1 : .5) / d; a.x += dx * k; a.z += dz * k; }
      }

      // where it stands: on the ground, or afloat
      const gy = groundY(a.x, a.z, a.y), pool = !a.loose && a.pen.water !== undefined ? a.pen.water : WATER;
      if (K.swim && gy < pool - (a.kind === 'penguin' ? .32 : 1.05)) swimY = pool - (a.kind === 'penguin' ? .3 : 1);
      const wantY = swimY ?? gy; a.y += (wantY - a.y) * Math.min(1, dt * 12);
      if (a.col) a.col.setTranslation({ x: a.x, y: a.z });
      m.visible = far < 175; if (!m.visible) continue;
      const tilt = swimY !== null && a.kind === 'penguin' && a.state !== 'ko' ? 1.2 : 0; a.tilt += (tilt - a.tilt) * Math.min(1, dt * 6);
      m.position.set(a.x, a.y + a.tilt * .12, a.z); m.rotation.set(a.tilt, a.h, 0, 'YXZ');
      animateBeast(m, t, dt, a.speed, pose, look);
    }
  }
  return zoo;
}
