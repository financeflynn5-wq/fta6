// The second chapter of the story: four more jobs, after the Sunset Tower job (and playable on their own from the
// pause menu). Same shape as missions.js: who gives it, what they say, a list of steps. What is new here is done with
// `until` steps that run a little scene of their own:
//   CATCH OF THE DAY       spear three golden marlin from a boat (story/sea.js has the fish and the spears)
//   THE MARLIN BAY CUP     a boat race up the coast, beach to marina
//   DEAD POSSUM'S CHEST    dig for treasure on Golden Acres, win the shootout when the Posse rolls up, lose them on the
//                          road to Marlin Bay, sink their boats with the bow gun, fly the chest out by helicopter
//   THE POSSUM GRAND       fight up the hotel they are building (world/siteTower.js) a floor at a time, crack the safe on
//                          the roof against the clock, then jump off with a parachute
// Extra step kinds used here (story.js): { cp: [x, z, face, y?], again(run) } a checkpoint; `car` steps take adopt, color, made.
// Numbers: STORY2 in config.js.
import * as THREE from 'three';
import { STORY2 as C, COMBAT } from '../config.js';
import { clamp, rnd, choose } from '../core/utils.js';
import { groundY } from '../world/terrain.js';
import { WATER } from '../world/map.js';
import { std } from '../world/materials.js';

const HALF = Math.PI / 2, GOLD = 0xffd34d, GREEN = 0x6dff8a;
const nth = (n) => ['', '1ST', '2ND', '3RD', '4TH', '5TH'][n] || n + 'TH';

export function buildMissions2(game, tools) {
  const p = game.player, hud = game.hud, traffic = game.traffic, outlaws = game.outlaws, audio = game.audio, fx = game.fx, sea = game.sea, site = game.site, ph = game.physics;
  const kit = game.activities.kit, gunmen = () => tools.gunmen;
  const dist = (o, x = p.x, z = p.z) => Math.hypot(o.x - x, o.z - z);

  // ---------- bits the missions share ----------
  const kitUp = (id) => { game.combat.give(id); p.armor = COMBAT.armor; if (p.chutes < 1) game.skydive.give(); };
  const arm = (id, words) => ({ run: () => { kitUp(id); hud.toast(words, 'good'); } });
  // put Rocco somewhere on foot (out of whatever he is driving)
  const stand = (x, z, y = groundY(x, z)) => { if (p.mode === 'car') p.exit(); p.body.setTranslation({ x, y: z }, true); p.body.setLinvel({ x: 0, y: 0 }, true); p.x = p.px = x; p.z = p.pz = z; p.y = y; };
  // step ashore: out of the boat, and onto (x, z) if that left him in the water
  const ashore = (x, z) => ({ run: () => { if (p.mode === 'car') p.exit(); if (groundY(p.x, p.z) < WATER + .4) stand(x, z); } });
  // a dot on the radar that follows something
  const dot = (o, color = '#ff3048', size = 4.2, seen = () => true, more = {}) => tools.blip({ get x() { return o.x; }, get z() { return o.z; }, color, glyph: '', pin: true, size, visible: seen, ...more });
  // a gunman who already knows you are there
  const gunman = (run, x, z, o = {}) => { const g = gunmen().add('possum', x, z, { wake: 90, ...o }); g.alert = true; run.goons.push(g); dot(g.ped, '#ff3048', 4.2, () => !g.out); return g; };
  // shots from a moving car or boat at whatever the player is driving
  function potshot(v, dmg, chance) {
    const tv = p.mode === 'car' ? p.vehicle : null, sy = v.y + 1.2, ty = tv ? tv.y + .8 : p.y + 1.1, hit = Math.random() < chance;
    const ex = p.x + (hit ? 0 : rnd(-3, 3)), ez = p.z + (hit ? 0 : rnd(-3, 3));
    game.combat.gfx.tracer(v.x, sy, v.z, ex, ty, ez, .02); game.combat.gfx.flash(v.x, sy, v.z, .5); audio.shot(1, clamp(1 - dist(v) / 70, .15, .7));
    if (!hit) return;
    if (tv) { tv.damage(dmg); fx.spark(ex, ty, ez, 4, .5); audio.ting(); } else p.hurt(dmg * 1.5);
  }

  // =====================================================================================
  // CATCH OF THE DAY
  // =====================================================================================
  const PIER = [7.1, -306, -HALF];               // a boat tied up at the end of the Sunset Beach pier (the water is deep enough there)
  const SHOAL = { x: -175, z: -430, r: 80 };      // where the marlin are running
  const ON_PIER = [3.4, -300, Math.PI, 1.05];     // a second try at either boat job starts out here, on the pier beside the boat
  function fishing(run) {
    if (!run.fishDots) {
      run.fishDots = sea.fish.filter(f => f.rare).map(f => dot(f, '#ffd34d', 4.6, () => !f.out && f.under <= 0, { pin: false }));
      tools.blip({ x: SHOAL.x, z: SHOAL.z, color: '#ffd34d', glyph: '', pin: true, hot: true, size: 7, visible: () => Math.hypot(p.x - SHOAL.x, p.z - SHOAL.z) > SHOAL.r + 30 });
    }
    run.count = `${Math.min(3, run.caught)}/3`;
    return run.caught >= 3;
  }

  // =====================================================================================
  // THE MARLIN BAY CUP
  // =====================================================================================
  const CUP = {
    name: 'THE MARLIN BAY CUP',
    grid: [[46, -352, 0], [46, -362, 0], [46, -372, 0], [46, -382, 0]],
    gates: [[150, -372], [270, -400], [385, -345], [432, -225], [470, -100], [412, 20], [470, 140], [412, 260], [470, 380], [420, 500], [388, 600]],
  };
  const lineUp = (run) => { run.race = sea.race({ name: CUP.name, gates: CUP.gates, grid: CUP.grid, rivals: 3, hold: true }); };
  function racing(run) {
    const R = run.race; if (!R) return false;
    run.count = R.count > 0 ? '' : `${nth(R.place)} · GATE ${Math.min(R.i + 1, R.gates.length)}/${R.gates.length}`;
    if (!R.over) return false;
    if (!R.won) { tools.fail(R.place <= 2 ? 'SECOND PLACE. SO CLOSE' : `YOU CAME IN ${nth(Math.max(2, R.place))}`); return false; }
    return true;
  }

  // =====================================================================================
  // DEAD POSSUM'S CHEST
  // =====================================================================================
  const DIGS = [[-40, 743.5], [-246.5, 868], [-28, 893]];      // by the scarecrow, under the lone oak, the end of the airstrip
  const QUAY = [292, 585], BERTH = [358.2, 604, HALF];         // Marlin Bay: where the road ends, and the boat at the head of pier three
  const PORT = [356.5, -180], PAD = [341.5, -186, Math.PI];    // Port Sunset: the quay wall, and the helicopter on its pad
  const ROCK = [-285, 175];                                    // Rocco's Rock, out in the Dustlands
  const xMat = new THREE.MeshBasicMaterial({ color: 0xd9412f, toneMapped: false }), chestMat = [std({ color: 0x6b4426, roughness: .8 }), std({ color: 0xe2b860, roughness: .3, metalness: .85, emissive: 0xe2b860, emissiveIntensity: .25 })];
  const dirt = std({ color: 0x5a4028, roughness: 1 });
  function cross(x, z) {
    const g = new THREE.Group(), y = groundY(x, z);
    for (const a of [.785, -.785]) { const m = new THREE.Mesh(new THREE.BoxGeometry(2.6, .05, .42), xMat); m.rotation.y = a; g.add(m); }
    g.position.set(x, y + .06, z); game.scene.add(g); return g;
  }
  function chest(x, z) {
    const g = new THREE.Group(), add = (m, sx, sy, sz, px, py, pz) => { const o = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); o.position.set(px, py, pz); o.castShadow = true; g.add(o); return o; };
    { const m = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.6, .22, 14), dirt); m.position.y = .06; m.receiveShadow = true; g.add(m); } add(chestMat[0], .9, .5, .56, 0, .42, 0); add(chestMat[0], .92, .16, .58, 0, .74, 0);
    for (const s of [-.3, .3]) add(chestMat[1], .08, .7, .6, s, .5, 0); add(chestMat[1], .14, .16, .06, 0, .56, .3);
    g.position.set(x, groundY(x, z), z); g.rotation.y = rnd(0, 6); game.scene.add(g); return g;
  }
  let found = [DIGS[2][0], DIGS[2][1], 0];                     // where the chest came out of the ground (a retry of the shootout starts there)
  function digging(run, dt, t) {
    if (!run.dig) {
      const D = run.dig = { left: DIGS.length, puff: 0, spots: DIGS.map(([x, z]) => ({ x, z, t: 0, done: false, mark: cross(x, z), ring: tools.ring(GOLD, 2.3, true).place(x, z) })) };
      for (const d of D.spots) tools.blip({ x: d.x, z: d.z, color: '#ffd34d', glyph: '✕', ink: '#7a1c10', pin: true, size: 6.5, visible: () => !d.done });
      run.undo.push(() => { for (const d of D.spots) game.scene.remove(d.mark); if (D.chest) game.scene.remove(D.chest); });
    }
    const D = run.dig; run.count = `${DIGS.length - D.left}/${DIGS.length}`;
    for (const d of D.spots) {
      if (d.done) continue;
      d.ring.tick(t, p, 600);
      if (!d.ring.inside(p)) { d.t = Math.max(0, d.t - dt); continue; }
      if (p.mode !== 'foot') { tools.tip('Get out and dig'); continue; }
      if (p.speed > 1.2) { tools.tip('Stand still on the X to dig'); continue; }
      d.t += dt; tools.tip(`Digging${'.'.repeat(1 + Math.floor(d.t * 3) % 3)}`);
      if ((D.puff -= dt) <= 0) { D.puff = .16; fx.smoke(d.x + rnd(-.7, .7), groundY(d.x, d.z) + .25, d.z + rnd(-.7, .7), .32, .55, .6, rnd(-1.6, 1.6), rnd(-1.6, 1.6), { rise: 2.2, alpha: .7 }); audio.step(); }
      if (d.t < C.dig) continue;
      d.done = true; d.ring.hide(); d.mark.visible = false; D.left--;
      if (D.left > 0) { hud.toast(choose(['NOTHING BUT WORMS', 'AN OLD BOOT', 'A RUSTY HORSESHOE', 'SOMEBODY\'S LUNCH, 1987']), 'info'); audio.bonk(); continue; }
      D.chest = chest(d.x, d.z); found = [d.x + 1.6, d.z + 1.6, 0]; audio.pickup(); audio.evade(); hud.toast('DEAD POSSUM\'S CHEST!', 'good'); run.count = '';
      return true;
    }
    return false;
  }
  // two cars come over the fields, stop short and everyone piles out
  function ambush(run, dt) {
    if (!run.amb) {
      const A = run.amb = { cars: [], goons: [], t: 0, total: C.cars * 3 }, base = Math.random() * 6.28;
      kit.ui.banner('AMBUSH!', 'The Possum Posse wants that chest', 'bad', 3); audio.alarm();
      for (let k = 0; k < C.cars; k++) {
        let x = p.x + 70, z = p.z;
        for (let i = 0; i < 40; i++) { const a = base + k * 2.1 + i * .41, d = rnd(62, 82); x = p.x + Math.cos(a) * d; z = p.z + Math.sin(a) * d; if (groundY(x, z) > WATER + .5 && ph.canDrive(x, z, p.x, p.z) && ph.blocked(x, z, x + 1, z + 1) < 0) break; }
        const v = outlaws.hunter(k % 2 ? 'van' : 'car', x, z, Math.atan2(p.z - z, p.x - x), 21); v.stolen = true;
        A.cars.push({ v, out: false }); dot(v, '#ff3048', 6, () => !A.cars[k].out, { glyph: '!', ink: '#fff', hot: true });
      }
      run.undo.push(() => { for (const c of A.cars) if (!c.v.gone) { if (c.out) { c.v.outlaw = false; c.v.temp = true; } else outlaws.dismiss(c.v); } });
    }
    const A = run.amb; A.t += dt;
    for (const c of A.cars) {
      if (c.out) continue;
      const v = c.v, d = dist(v); outlaws.aim(v);
      if (d > 19 && A.t < 9 && !v.wrecked && !v.gone) continue;
      // they stop and pile out (or, if the car never made it, come running from that side)
      c.out = true; if (!v.gone) { v.driver = null; v.controls.throttle = 0; v.controls.steer = 0; v.controls.handbrake = true; }
      const far = d > 45, ax = far ? p.x + (v.x - p.x) / d * 30 : v.x, az = far ? p.z + (v.z - p.z) / d * 30 : v.z;
      for (let i = 0; i < 3; i++) {
        const s = i === 1 ? -1 : 1, gx = far ? ax + rnd(-3, 3) : ax + v.rx * s * (v.halfWid + 1.2) + v.fx * (i - 1) * 1.5, gz = far ? az + rnd(-3, 3) : az + v.rz * s * (v.halfWid + 1.2) + v.fz * (i - 1) * 1.5;
        A.goons.push(gunman(run, gx, gz, { face: Math.atan2(p.x - gx, p.z - gz), gun: i === 0 ? 'smg' : 'pistol' }));
      }
      audio.door();
    }
    const left = A.goons.filter(g => !g.out).length, all = A.cars.every(c => c.out);
    run.count = `${A.goons.length - left}/${A.total}`; A.all = all;
    if (!all || left > 0) return false;
    run.count = ''; return true;
  }
  // the road to Marlin Bay, with two of their cars on your tail the whole way
  function chase(run, dt, t) {
    if (!run.hunt) {
      const H = run.hunt = { cars: [], wait: 1.5, ring: tools.ring(GREEN, 8, true).place(QUAY[0], QUAY[1]) };
      tools.blip({ x: QUAY[0], z: QUAY[1], color: '#6dff8a', glyph: '', pin: true, hot: true, size: 7 });
      run.undo.push(() => { for (const h of H.cars) if (!h.v.gone) outlaws.dismiss(h.v); H.cars.length = 0; });
    }
    const H = run.hunt; H.ring.tick(t, p, 900);
    for (const h of H.cars.slice()) {
      const v = h.v, d = dist(v);
      if (v.gone || v.wrecked || d > 280 || !v.driver) { if (!v.gone) outlaws.dismiss(v); H.cars.splice(H.cars.indexOf(h), 1); continue; }
      outlaws.aim(v);
      if (d < 38 && (h.fire -= dt) <= 0) { h.fire = rnd(.9, 1.7); if (ph.canSee(v.x, v.z, p.x, p.z)) potshot(v, 3, .3); }
    }
    if (H.cars.length < 2 && (H.wait -= dt) <= 0 && dist({ x: QUAY[0], z: QUAY[1] }) > 120) {
      H.wait = 3.5; const s = traffic.findRoadSpot(60, 125);
      if (s) { const v = outlaws.hunter(choose(['car', 'van', 'sport', 'car']), s.x, s.z, s.h, 28); v.stolen = true; const h = { v, fire: 2 }; H.cars.push(h); dot(v, '#ff3048', 5.5, () => H.cars.includes(h), { glyph: '!', ink: '#fff' }); }
    }
    return H.ring.inside(p);
  }
  // out on the water: two of their boats behind you, then three more ahead; all of them have to go down
  function battle(run, dt) {
    const v = run.cars.boat; if (!v) return false;
    if (!run.fleet) run.fleet = { wave: 0, wait: 0, waves: C.boats.slice() };
    const F = run.fleet, total = F.waves.reduce((a, b) => a + b, 0);
    run.count = `${Math.min(sea.sunk, total)}/${total}`;
    const clear = dist({ x: BERTH[0], z: BERTH[1] }) > 75 && p.vehicle === v;
    if (F.wave < F.waves.length && sea.afloat() === 0 && clear && (F.wait -= dt) <= 0) {
      // the first lot from behind you, the rest from ahead
      const n = F.waves[F.wave], toward = v.h + (F.wave === 0 ? Math.PI : 0); let made = 0;
      for (let i = 0; i < n; i++) { const s = sea.openWater(p.x, p.z, 95, 135, toward, .9) || sea.openWater(p.x, p.z, 80, 150); if (s) { const r = sea.raider(s.x, s.z, s.h, { flank: (i - (n - 1) / 2) * 12 }); dot(r.v, '#ff3048', 5.5, () => !r.out, { glyph: '!', ink: '#fff' }); made++; } }
      if (made) { F.waves[F.wave] = made; F.wave++; F.wait = 2.5; kit.ui.banner(F.wave === 1 ? 'BOATS BEHIND YOU!' : 'MORE OF THEM AHEAD!', 'Hold left mouse to fire the bow gun', 'bad', 2.6); audio.alarm(); }
    }
    // one left far behind comes round in front again
    for (const r of sea.raiders) if (!r.out && dist(r.v) > 230) { const s = sea.openWater(p.x, p.z, 100, 140, v.h, 1); if (s) sea.move(r, s.x, s.z, s.h); }
    if (F.wave < F.waves.length || sea.afloat() > 0) return false;
    run.count = ''; return true;
  }
  function landed(run, dt, t) {
    const v = run.cars.heli;
    if (!run.drop) { run.drop = tools.ring(GREEN, 11, true).place(ROCK[0], ROCK[1]); tools.blip({ x: ROCK[0], z: ROCK[1], color: '#6dff8a', glyph: '$', pin: true, hot: true, size: 8 }); }
    run.drop.tick(t, p, 1400);
    if (!run.drop.inside(p)) return false;
    if (p.mode === 'car' && p.vehicle.air > 0) { tools.tip('Set it down in the ring (Shift sinks)'); return false; }
    if (v && p.vehicle === v) delete run.cars.heli;
    return Math.abs(p.y - groundY(ROCK[0], ROCK[1])) < 4;
  }

  // =====================================================================================
  // THE POSSUM GRAND
  // =====================================================================================
  // who stands where on each floor: [along the building, across it] from its middle (clear of the columns and the stacks)
  const POSTS = [
    null,
    [[8, 3], [-2, 1], [-12, 2]],
    [[12, 10], [3, 4], [-7, 9]],
    [[13, -4], [6, -5], [-6, -5], [-13, 8]],
    [[8, 3], [-2, 1], [-7, 9], [-12, 2]],
    [[12, 10], [3, 4], [-6, -5], [-13, 8]],
    [[8, 2], [-8, 0], [-12, 6], [12, 10]],
  ];
  const guards = (k) => () => POSTS[k].map(([u, w]) => { const [x, z, y] = site.at(k, u, w); return [x, z, { y, box: site.box, face: Math.atan2(site.x + site.hw - x, site.z - site.hd - z), range: 30, wake: 36, hold: 8, gun: (u + k) % 3 === 0 ? 'smg' : 'pistol' }]; });
  const floorText = (k) => () => p.y < site.yOf(k) - 2 ? `Take the ramp up to ${k === site.decks ? 'the roof' : 'floor ' + k}` : k === site.decks ? 'The roof: take out the last of the guards' : `Floor ${k} of ${site.decks - 1}: take out the guards`;
  const foot = site.rampFoot(0), roofIn = site.at(site.decks, site.hw - 2.5, -site.hd + 5), midIn = site.at(3, -site.hw + 2.5, -site.hd + 5);
  // the dial on the safe
  const dial = document.createElement('div'); dial.className = 'safeDial'; dial.hidden = true;
  dial.innerHTML = '<b>CRACK THE SAFE</b><div class="track"><i class="zone"></i><i class="needle"></i></div><span></span>';
  document.getElementById('hud').appendChild(dial);
  const zoneEl = dial.querySelector('.zone'), needleEl = dial.querySelector('.needle'), dialNote = dial.querySelector('span');
  function cracking(run, dt, t) {
    if (!run.safe) {
      const S = run.safe = { pin: 0, pos: 0, dir: 1, zone: .5, held: true, ring: tools.ring(GOLD, 1.7, false).place(site.safe.x, site.safe.z - 1.5, site.top + .05) };
      const next = () => { S.zone = rnd(.14, .86); zoneEl.style.left = (S.zone - C.safe.zone / 2) * 100 + '%'; zoneEl.style.width = C.safe.zone * 100 + '%'; dialNote.innerHTML = `Press <kbd>E</kbd> when the needle is in the green · tumbler ${S.pin + 1} of ${C.safe.pins}`; };
      S.next = next; next(); tools.blip({ x: site.safe.x, z: site.safe.z, color: '#ffd34d', glyph: '$', pin: true, hot: true, size: 7 });
      run.undo.push(() => { dial.hidden = true; });
    }
    const S = run.safe; S.ring.tick(t, p, 600);
    const at = p.mode === 'foot' && S.ring.inside(p) && Math.abs(p.y - site.top) < 2.5;
    dial.hidden = !at;
    const down = game.input.down('KeyE');
    if (!at) { S.held = true; return false; }
    if (run.timer == null) { run.timer = C.safe.time; hud.toast(`THE ALARM TRIPS IN ${C.safe.time} SECONDS`, 'bad'); audio.click(); }
    S.pos += S.dir * C.safe.sweep * (1 + S.pin * .2) * dt;
    if (S.pos > 1) { S.pos = 2 - S.pos; S.dir = -1; } else if (S.pos < 0) { S.pos = -S.pos; S.dir = 1; }
    needleEl.style.left = S.pos * 100 + '%';
    if (down && !S.held) {
      if (Math.abs(S.pos - S.zone) <= C.safe.zone / 2 + .012) {
        S.pin++; audio.click(); audio.pickup(); dial.classList.remove('hit'); void dial.offsetWidth; dial.classList.add('hit');
        if (S.pin >= C.safe.pins) {
          dial.hidden = true; run.timer = null; audio.evade(); hud.toast('THE POSSE\'S WAR CHEST IS YOURS', 'good');
          for (let i = 0; i < 5; i++) fx.spark(site.safe.x + rnd(-.5, .5), site.top + rnd(.4, 1.2), site.safe.z - .6, 8, 1);
          return true;
        }
        S.next();
      } else { run.timer -= C.safe.miss; audio.bonk(); game.cam.shake(.12); hud.toast(`WRONG! -${C.safe.miss} SECONDS`, 'bad'); }
    }
    S.held = down;
    return false;
  }
  // trapped: more of them up the last ramp for as long as you stay, and one way down
  function trapped(run, dt, t) {
    if (!run.trap) {
      const j = site.jump; run.trap = { t: .6, goons: [], ring: tools.ring(GREEN, 1.7, true).place(j.x, j.z, site.top + .05) };
      tools.blip({ x: j.x, z: j.z, color: '#6dff8a', glyph: '', pin: true, hot: true, size: 7 });
      kit.ui.banner('TRAPPED!', 'Run off the plank on the east side and jump', 'bad', 3.4); audio.alarm();
    }
    const T = run.trap, j = site.jump; T.ring.tick(t, p, 600);
    if ((T.t -= dt) <= 0 && T.goons.filter(g => !g.out).length < C.trap.most) {
      T.t = C.trap.every; const h = site.rampHead(site.decks - 1);
      T.goons.push(gunman(run, h.x + rnd(-1, 1), h.z + rnd(-1, 1), { y: site.top, box: site.box, range: 34, hold: 9 }));
    }
    if (p.mode !== 'foot' || p.sky || !T.ring.inside(p) || Math.abs(p.y - site.top) > 2) return false;
    // over the edge
    if (p.chutes < 1) game.skydive.give();
    stand(j.x + j.dx * 3.6, j.z + j.dz * 3.6, site.top + .5);
    game.skydive.begin('fall', site.top + .5, j.dx * 9, j.dz * 9, 4); p.face = Math.atan2(j.dx, j.dz);
    audio.whoosh(); hud.toast('SPACE: OPEN THE PARACHUTE!', 'info');
    return true;
  }

  return [
    // ------------------------------------------------------------------ 9
    {
      id: 'fish', title: 'CATCH OF THE DAY', giver: 'sal', brief: 'Spear three golden marlin off Sunset Beach',
      intro: [
        ['sal', 'Rocco! The tower money bought me a restaurant. Big Sal\'s Sea Shack. Candles. Napkins. Very classy.'],
        ['rocco', 'Let me guess. No customers.'],
        ['sal', 'No FISH. The golden marlin are running off Sunset Beach, and the food critic comes tonight.'],
        ['sal', 'My boat is tied up at the pier. No nets, no rods: there are spears in the locker. Three marlin, kid. The gold ones, not the snapper.'],
      ],
      steps: [
        { cp: ON_PIER, quiet: true },
        { car: 'speedboat', as: 'boat', own: true, at: PIER, color: 0xf2c230, text: 'Take Big Sal\'s boat from the end of the Sunset Beach pier, south of downtown' },
        { run: (run) => { run.caught = 0; sea.school(SHOAL.x, SHOAL.z, SHOAL.r, { onCatch: (n) => { run.caught = n; hud.toast(n <= 3 ? `GOLDEN MARLIN  ${n}/3` : 'ONE FOR THE FREEZER', 'good'); } }); } },
        { until: fishing, text: () => Math.hypot(p.x - SHOAL.x, p.z - SHOAL.z) > SHOAL.r + 30 ? 'Head out to the marlin, south-west of the pier (the gold dots on the radar)' : 'Spear three golden marlin: ease up close, look at one and left-click to throw' },
        { run: (run) => { run.count = ''; } },
        { bring: 'boat', to: [11, -304], r: 8, y: WATER, text: 'Take the catch back to the end of the pier' },
        ashore(3.4, -304),
      ],
      outro: [
        ['sal', 'Look at the size of these! The critic is gonna weep into his napkin.'],
        ['sal', 'Here, your cut. And Tiff wants you: something about a boat race and a bet she already made with my money.'],
      ],
    },
    // ------------------------------------------------------------------ 10
    {
      id: 'cup', title: 'THE MARLIN BAY CUP', giver: 'tiff', brief: 'Win the boat race from Sunset Beach to Marlin Bay',
      intro: [
        ['tiff', 'Rocco! Perfect timing. I entered us in the Marlin Bay Cup. Boats. Buoys. Glory.'],
        ['rocco', 'Us?'],
        ['tiff', 'I do the entering, you do the driving. I also bet Sal\'s restaurant on it, so, like, win.'],
        ['tiff', 'The red boat at the Sunset Beach pier is ours. Start line is just off the beach. Through every pair of buoys, up the coast, first into Marlin Bay.'],
      ],
      steps: [
        { run: lineUp },
        { cp: ON_PIER, quiet: true, again: lineUp },
        { car: 'speedboat', as: 'boat', own: true, at: PIER, color: 0xe8455b, text: 'Take the red race boat from the end of the Sunset Beach pier, south of downtown' },
        { bring: 'boat', to: [CUP.grid[0][0], CUP.grid[0][1]], r: 7, y: WATER, text: 'Line up with the others on the start line, just off the beach' },
        { run: (run) => { run.cars.boat = run.refs.boat; run.race.start(); } },
        { until: racing, text: 'Win the Marlin Bay Cup: through every pair of buoys, first across the line' },
        { run: (run) => { run.count = ''; delete run.cars.boat; } },
      ],
      outro: [
        ['tiff', 'FIRST! We are FIRST! I mean, I knew that. With math.'],
        ['tiff', 'Sal keeps his restaurant, I keep my winnings, you get a cut. Oh, and Dale was asking for you. He said, and I quote, "bring a shovel".'],
      ],
    },
    // ------------------------------------------------------------------ 11
    {
      id: 'treasure', title: 'DEAD POSSUM\'S CHEST', giver: 'dale', brief: 'Dig up the Posse\'s buried loot on Golden Acres',
      intro: [
        ['dale', 'Rocco. Close the door. I found something in the evidence locker. Under the donuts.'],
        ['dale', 'A map. One-Eyed Pete, the possum who started the Posse, buried the gang\'s first score out on Golden Acres. Three X\'s. Two of \'em are lies.'],
        ['rocco', 'And you want me to dig.'],
        ['dale', 'I got a bad back. The Posse wants that chest too, so take this and keep your eyes open. My cousin will pay cash for it at Rocco\'s Rock. Funny name, huh?'],
      ],
      steps: [
        arm('smg', 'SMG, BODY ARMOR AND A SHOVEL'),
        { until: digging, text: 'Dig at the three X\'s on Golden Acres, in the far north-west: the scarecrow, the lone oak and the end of the airstrip' },
        { cp: () => found, quiet: true, again: () => kitUp('smg') },
        { until: ambush, text: (run) => run.amb?.all ? 'Win the shootout' : 'The Posse is coming for the chest! Get ready' },
        { until: () => p.mode === 'car' && !p.vehicle.stats.craft, text: 'Grab a car and get out of here. One of theirs will do' },
        { until: chase, text: 'More of them! Lose them on the way to the quay at Marlin Bay, east along the valley' },
        { cp: [QUAY[0], QUAY[1], HALF], again: () => kitUp('smg') },
        { car: 'speedboat', as: 'boat', own: true, at: BERTH, color: 0xf4f1ea, text: 'Run for the white speedboat at the far end of the third pier' },
        { run: (run) => { sea.arm(run.cars.boat); for (const h of run.hunt?.cars || []) outlaws.dismiss(h.v); if (run.hunt) run.hunt.cars.length = 0; hud.toast('BOW GUN: HOLD LEFT MOUSE', 'info'); } },
        { until: battle, text: (run) => sea.afloat() ? 'Blow the Posse\'s boats out of the water: look at one and hold left mouse' : 'Outrun them: head south down the coast for Port Sunset' },
        { bring: 'boat', to: PORT, r: 9, y: WATER, text: 'Get to the helicopter on the quay at Port Sunset, south down the coast' },
        ashore(348.5, -181),
        { run: (run) => { sea.disarm(); for (const [x, z] of [[322, -150], [318, -158], [326, -144]]) gunman(run, x, z, { hold: 14 }); } },
        { cp: [348.5, -181, -HALF], again: () => kitUp('smg') },
        { car: 'heli', as: 'heli', own: true, adopt: true, at: PAD, text: 'They are on the quay too! Run to the helicopter' },
        { until: landed, text: 'Fly the chest to Rocco\'s Rock, out west in the Dustlands, and land in the ring (Space climbs, Shift sinks)' },
      ],
      outro: [
        ['dale', 'That\'s my cousin\'s rock, and that\'s my cousin\'s cash. He says hi. He says it from very far away.'],
        ['dale', 'Forty grand, kid. I took a small finder\'s fee. For the donuts.'],
        ['dale', 'One more thing. The Posse is building a hotel in Port Sunset with whatever they got left. Sal has been staring at it all week.'],
      ],
    },
    // ------------------------------------------------------------------ 12
    {
      id: 'grand', title: 'THE POSSUM GRAND', giver: 'sal', brief: 'Fight to the top of the Posse\'s hotel and crack the safe',
      intro: [
        ['sal', 'You seen it, kid? The Possum Grand. Six floors of concrete in Port Sunset, and every brick paid for with MY money.'],
        ['tiff', 'It isn\'t finished. No walls, no lifts, just ramps. And the Posse\'s whole war chest is in a safe on the top floor.'],
        ['scrap', 'Scrap packed a parachute. Scrap does not explain why. BZZT.'],
        ['sal', 'Go up floor by floor, crack that safe, and the Posse is finished for good. Here. Something with a little more kick.'],
      ],
      steps: [
        arm('burst', 'BURST RIFLE, BODY ARMOR AND A PARACHUTE'),
        { go: [foot.x - 2.5, foot.z], r: 3, text: 'Get to the Possum Grand building site in Port Sunset, east of downtown: the ramp is on its south side' },
        { goons: guards(1), text: floorText(1) },
        { goons: guards(2), text: floorText(2) },
        { goons: guards(3), text: floorText(3) },
        { cp: [midIn[0], midIn[1], 0, midIn[2]], again: () => kitUp('burst') },
        { goons: guards(4), text: floorText(4) },
        { goons: guards(5), text: floorText(5) },
        { goons: guards(6), text: floorText(6) },
        { cp: [roofIn[0], roofIn[1], 0, roofIn[2]], again: () => kitUp('burst') },
        { until: cracking, text: 'Crack the safe on the roof: stand at it and press E when the needle is in the green' },
        { say: [['tiff', 'Rocco. Bad news. Three trucks of Posse just pulled up, and they are all coming up the ramps.'], ['rocco', 'How many is all?'], ['tiff', 'Jump. I\'m serious. There\'s a plank off the east side. Scrap\'s parachute, remember? JUMP!']] },
        { until: trapped, text: 'Trapped! Run off the plank on the east side of the roof and jump' },
        { until: () => !p.sky && p.y < site.top - 4, text: 'SPACE opens the parachute. Get down in one piece' },
        { run: (run) => { gunmen().clear(run.goons); run.goons.length = 0; } },
      ],
      outro: [
        ['sal', 'HA! I watched the whole thing from the limo. You fell off a building, kid. On purpose. With my money in your pockets.'],
        ['tiff', 'The Posse just listed the hotel for sale. One careful owner.'],
        ['scrap', 'Scrap wants the parachute back. Scrap is sentimental. BZZT.'],
        ['sal', 'Sunset Coast is ours. Top to bottom. Go buy yourself something stupid, Rocco. You earned it.'],
      ],
    },
  ];
}
