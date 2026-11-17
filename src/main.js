// FTA 6 entry point: builds every system, runs the game loop, and holds the handful of
// rules that connect systems together (what counts as a crime, what happens when you crash).
import { clamp } from './core/utils.js';
import { POLICE } from './config.js';
import { createEngine } from './core/engine.js';
import { createPhysics } from './core/physics.js';
import { createInput } from './core/input.js';
import { createAudio } from './core/audio.js';
import { buildCity } from './world/city.js';
import { paintHighway } from './world/highway.js';
import { createSky } from './world/sky.js';
import { createEffects } from './fx/effects.js';
import { createCarLights } from './fx/carLights.js';
import { createDebris } from './fx/debris.js';
import { createDamage } from './vehicles/damage.js';
import { createTraffic } from './vehicles/traffic.js';
import { AIDriver } from './vehicles/aiDriver.js';
import { createWheelBatch } from './vehicles/carModel.js';
import { createPedestrians } from './characters/pedestrians.js';
import { CIVILIANS } from './characters/models.js';
import { createPlayer } from './player/player.js';
import { createCamera } from './player/camera.js';
import { createPolice } from './police/police.js';
import { createHud } from './ui/hud.js';
import { createMinimap } from './ui/minimap.js';
import { createWeaponHud } from './ui/weaponHud.js';
import { createLandmarks } from './world/landmarks.js';
import { createWorld } from './world/world.js';
import { createActivities } from './activities/activities.js';
import { loadWeaponModels } from './combat/weaponModels.js';
import { loadVehicleModels } from './vehicles/vehicleModels.js';
import { createCombat } from './combat/combat.js';
import { createCopGuns } from './combat/copGuns.js';
import { createPickups } from './combat/pickups.js';
import { createJobs } from './missions/jobs.js';
import { createHighwayTraffic } from './vehicles/highwayTraffic.js';
import { createInteriors } from './world/interiors.js';
import { createPlaces } from './world/places.js';

const STEP = 1 / 60;
const $ = (id) => document.getElementById(id);

async function boot() {
  const canvas = $('cv');
  const engine = createEngine(canvas);
  const game = {
    engine, scene: engine.scene, camera: engine.camera, state: 'title', over: false, money: 0, time: 0,
    hints: { exit: 900 }, firstTheft: false,
  };
  window.__fta = game;
  game.physics = await createPhysics();
  game.input = createInput(canvas);
  game.audio = createAudio();
  game.city = buildCity(engine.scene);
  for (const b of game.city.solids.boxes) if (!b.hollow) game.physics.addStaticBox(b.x, b.z, b.hw, b.hd, b.low, b.h);       // hollow: you can walk in (its walls are in solids.walls)
  for (const p of game.city.solids.posts) game.physics.addStaticPost(p.x, p.z, p.r, p.h);
  for (const w of game.city.solids.walls) game.physics.addWall(w.x, w.z, w.hl, w.ht, w.rot, w.kind, w.h);
  game.env = createSky(engine, game.city);
  game.fx = createEffects(engine.scene);
  game.world = createWorld(game);               // the land: hills, air time, water (also sets game.ride)
  game.wheels = createWheelBatch(engine.scene);
  game.traffic = createTraffic(game);
  game.peds = createPedestrians(game);
  game.player = createPlayer(game);
  game.cam = createCamera(game);
  game.police = createPolice(game);
  game.hud = createHud(game);
  game.minimap = createMinimap(game);
  game.minimap.setBuildings(game.city.solids.boxes);
  paintHighway(game.minimap.plan.getContext('2d'), game.minimap.half, game.city.highway);
  game.carLights = createCarLights(game);
  game.landmarks = createLandmarks(game);
  game.combat = createCombat(game);
  game.copGuns = createCopGuns(game);
  game.pickups = createPickups(game);
  game.weaponHud = createWeaponHud(game);
  game.weaponsReady = loadWeaponModels();       // Flynn's guns stream in; stand-ins until then
  game.vehiclesReady = loadVehicleModels();     // the Blender vehicles too
  game.debris = createDebris(engine.scene);     // shards and torn-off parts
  game.damage = createDamage(game);             // dents, scuffs, broken glass and lamps
  game.highway = createHighwayTraffic(game); game.traffic.init(); game.highway.init();
  game.peds.init();
  game.jobs = createJobs(game);
  game.activities = createActivities(game);     // races, stunt jumps, collectibles and the rest
  game.indoors = createInteriors(game);         // shops and lobbies you can walk into
  game.places = createPlaces(game);             // the valley: glass and fences that break, the mall roof, the base
  game.env.touch();
  engine.resize();

  // ---------- rules that tie systems together ----------
  const { police, player, hud, audio, fx, peds, cam } = game;
  let crashSound = 0;

  game.addMoney = (n) => { game.money = Math.max(0, game.money + n); if (n > 0) { audio.cash(); hud.moneyPop(); } };
  game.honk = (v) => { if (Math.hypot(v.x - player.x, v.z - player.z) < 40) audio.horn(); };

  game.onCarTaken = (car, old, speed) => {
    audio.door(); cam.shake(.12);
    if (car.type === 'police') { police.carStolen(car); police.crime(POLICE.crime.copCarTheft, 2, 'STOLE A COP CAR!'); }
    else if (old instanceof AIDriver) { police.crime(POLICE.crime.carjack, 1, 'CARJACKED!'); peds.scare(car.x, car.z, 16); }
    else if (!car.stolen) {
      if (!game.firstTheft || Math.random() < .35 || police.witnessed(car.x, car.z)) { audio.alarm(); police.crime(POLICE.crime.alarm, 1, 'CAR ALARM!'); }
      else hud.toast('NICE AND QUIET', 'good');
    }
    car.stolen = true; car.temp = true; game.firstTheft = true;
    game.jobs.onCarTaken(car);
  };
  game.onCarLeft = () => { };

  game.onCrash = (v, impact) => {
    const power = clamp((impact - 2) / 14, 0, 1), mine = v.driver === 'player';
    const d = Math.hypot(v.x - player.x, v.z - player.z);
    if (mine) { cam.shake(.2 + power * .6); game.jobs.onCrash(v, impact); if (v.stats.rider && impact > v.stats.throwAt) player.thrown(impact); }
    if (d < 50 && game.time - crashSound > .07) { crashSound = game.time; audio.crash(mine ? power : power * (1 - d / 50) * .7); }
    const hit = game.damage.crash(v, impact);          // dents the body where it was hit; says where that was
    if (d < 70) { if (hit) fx.spark(hit.x, hit.y, hit.z, 3 + Math.round(power * 10), .6 + power); else fx.spark(v.x + v.fx * 1.6 * Math.sign(v.vf || 1), v.y + .6, v.z + v.fz * 1.6 * Math.sign(v.vf || 1), 3 + Math.round(power * 10), .6 + power); }
  };

  game.onWrecked = (v) => {
    if (v.driver === 'player') { hud.toast('TOTALED!  BAIL OUT', 'bad'); return; }
    const near = Math.hypot(v.x - player.x, v.z - player.z) < 30;
    if (police.owns(v)) {
      police.carWrecked(v);
      if (near) { game.addMoney(250); hud.toast('CRUISER WRECKED  +$250', 'good'); police.crime(25, 0); }
    } else if (v.driver instanceof AIDriver) {
      v.dropRider();
      peds.spawn(v.driver.kind || CIVILIANS[Math.floor(Math.random() * CIVILIANS.length)], v.x - v.rx * (v.halfWid + .95), v.z - v.rz * (v.halfWid + .95));
      v.driver = null;
    }
  };

  game.onPedHit = (ped, v) => {
    const d = Math.hypot(ped.x - player.x, ped.z - player.z);
    if (d < 45) { if (ped.model.userData.bot) { audio.clank(); fx.spark(ped.x, ped.y + 1, ped.z, 8); } else audio.bonk(); }
    peds.scare(ped.x, ped.z, 20);
    if (v.driver === 'player') {
      cam.shake(.18);
      if (ped.cop) police.crime(POLICE.crime.copPedHit, 2, 'FLATTENED AN OFFICER!'); else police.crime(POLICE.crime.pedHit, 1, 'HIT AND RUN!');
    }
  };

  function onContact(a, b) {
    if (a?.isVehicle && b?.isVehicle) {
      const mine = a.driver === 'player' ? a : b.driver === 'player' ? b : null; if (!mine) return;
      const other = mine === a ? b : a, rel = Math.hypot(a.vx - b.vx, a.vz - b.vz);
      if (other.type === 'police' && other.driver instanceof AIDriver) { if (rel > 5) police.crime(POLICE.crime.copRam, rel > 11 ? 2 : 1, 'RAMMED A COP!'); }
      else if (other.driver instanceof AIDriver && rel > 7) { if (police.stars > 0) police.crime(4); else if (police.witnessed(mine.x, mine.z)) police.crime(8, 1, 'RECKLESS DRIVING!'); }
      return;
    }
    const car = a?.isVehicle ? a : b?.isVehicle ? b : null, who = car === a ? b : a;
    if (!car || !who) return;
    if (who.isPlayer) player.knock(car);
    else if (who.isOfficer) police.knockOfficer(who, car);
  }

  // Wasted: wake up outside Sunset General, keep your guns. Nabbed: walk out of Sunset PD, guns confiscated.
  function setback(title, line, fineRate, where) {
    if (game.over) return;
    game.over = true; player.frozen = true; where === 'hospital' ? audio.wasted() : audio.busted();
    if (where === 'hospital' && player.mode === 'foot') player.tumble = 5;      // down he goes
    const fine = Math.min(game.money, Math.max(100, Math.round(game.money * fineRate)));
    const lost = where === 'station' && game.combat.owned.size > 1 ? ' They kept your guns too.' : '';
    $('bustText').textContent = title; $('bustSub').textContent = (fine > 0 ? line.replace('$X', '$' + fine.toLocaleString('en-US')) : 'You had nothing worth taking.') + lost;
    $('busted').hidden = false;
    game.afterSetback = { in: 3, fine, where };
  }
  function finishSetback() {
    const { fine, where } = game.afterSetback, spot = game.landmarks[where];
    game.money -= fine; game.afterSetback = null;
    police.clear(); game.combat.reset(where === 'station'); player.respawn(spot); player.frozen = false; game.over = false; $('busted').hidden = true;
    cam.yaw = spot ? Math.atan2(Math.cos(spot.face), Math.sin(spot.face)) : -Math.PI / 2;
    if (spot) hud.toast(spot.name, 'info');
  }
  game.busted = () => setback('NABBED!', 'The cops kept $X for the donut fund.', .25, 'station');
  game.knockedOut = () => setback('WASTED', 'Sunset General billed you $X.', .15, 'hospital');

  // ---------- menus ----------
  const setState = (s) => {
    game.state = s; game.input.enabled = s === 'playing';
    $('title').hidden = s !== 'title'; $('pause').hidden = s !== 'paused'; hud.show(s !== 'title');
    if (s === 'playing') { audio.start(); audio.resume(); } else if (s === 'paused') audio.suspend();
  };
  const play = () => { setState('playing'); game.input.lock(); };
  $('playBtn').textContent = 'Hit the streets'; $('playBtn').disabled = false;
  $('playBtn').addEventListener('click', () => { cam.yaw = -Math.PI / 2; play(); hud.toast('FIND A RIDE', 'info'); });
  $('resumeBtn').addEventListener('click', play);
  // Full screen: F11 or the menu buttons. Going full screen from a menu also starts / resumes play.
  const fullscreen = () => {
    const on = !!document.fullscreenElement;
    const req = on ? document.exitFullscreen?.() : document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
    Promise.resolve(req).catch(() => hud.toast('FULL SCREEN BLOCKED HERE: OPEN THE GAME IN ITS OWN TAB', 'info'));
    if (!on && game.state !== 'playing') { if (game.state === 'title') $('playBtn').click(); else play(); }
    else if (!on) game.input.lock();
  };
  document.querySelectorAll('.fsBtn').forEach(b => b.addEventListener('click', fullscreen));
  window.addEventListener('keydown', (e) => { if (e.code === 'F11') { e.preventDefault(); if (!e.repeat) fullscreen(); } });
  document.addEventListener('fullscreenchange', () => { engine.resize(); if (document.fullscreenElement && game.state === 'playing') game.input.lock(); });
  let lockedOnce = false;
  document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement) lockedOnce = true; else if (lockedOnce && game.state === 'playing') setState('paused'); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && game.state === 'playing') setState('paused'); });
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'Escape' || e.code === 'KeyP') { if (game.state === 'playing') setState('paused'); else if (game.state === 'paused') play(); }
    if (e.code === 'Enter' && game.state === 'title') $('playBtn').click();
    if (game.state !== 'playing') return;
    if (e.code === 'KeyT') game.env.skip();
    if (e.code === 'KeyM') hud.toast(audio.toggleMute() ? 'SOUND OFF' : 'SOUND ON');
    if (e.code === 'KeyQ') { engine.setQuality(engine.quality === 'high' ? 'fast' : 'high'); autoQuality = false; hud.toast(engine.quality === 'high' ? 'HIGH GRAPHICS' : 'FAST GRAPHICS'); }
  });

  // ---------- the loop ----------
  function step(dt) {
    game.time += dt;
    player.preStep(dt);
    game.combat.preStep(dt);
    game.traffic.preStep(dt, game.time);
    game.world.preStep(dt);
    game.physics.step(onContact);
    game.traffic.postStep(dt);
    player.postStep();
    game.world.postStep(dt);
    game.input.endStep();
  }
  let last = performance.now(), acc = 0, maintainT = 0, slowFor = 0, autoQuality = true, fpsAvg = 60, titleYaw = .75;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (game.state === 'paused') return;
    advance(dt);
  }
  function advance(dt) {
    if (game.afterSetback && (game.afterSetback.in -= dt) <= 0) finishSetback();
    acc += dt; let n = 0; while (acc >= STEP && n < 3) { step(STEP); acc -= STEP; n++; } if (n === 3) acc = 0;
    game.alpha = acc / STEP;      // how far this frame sits between the last two physics steps (for smooth drawing)
    const t = game.time;
    game.traffic.syncVisual(dt, t); game.wheels.commit();
    peds.update(dt, t);
    player.update(dt, t);
    game.combat.update(dt, t);
    police.update(dt, t);
    game.copGuns.update(dt, t);
    game.pickups.update(dt, t);
    game.jobs.update(dt, t);
    game.damage.update(dt); game.debris.update(dt);
    fx.update(dt);
    game.city.updateLights(t);
    if ((maintainT -= dt) <= 0) { maintainT = 2; game.traffic.maintain(); }
    if (game.state === 'title') {          // slow fly-around behind the menu
      titleYaw += dt * .05; engine.camera.position.set(Math.sin(titleYaw) * 150, 128, Math.cos(titleYaw) * 150); engine.camera.lookAt(0, 44, 0);     // clear of the towers
      cam.lookAt.set(0, 0, 0);
    } else cam.update(dt, t);
    game.world.update(dt, t); game.activities.update(dt, t); game.highway.update(dt); game.indoors.update(dt, t); game.places.update(dt, t);
    game.env.update(dt, engine.camera.position, cam.lookAt);
    game.carLights.update(t);
    hud.update(dt, t); game.weaponHud.update(dt, t); game.minimap.update(t);
    const car = player.vehicle;
    audio.engine(!!car && !car.wrecked && game.state === 'playing', car ? car.rpm : 0, car ? Math.abs(car.controls.throttle) : 0, car ? car.stats.pitch ?? 1 : 1);
    audio.skid(car && car.sliding ? clamp(.35 + car.slip / 9, 0, 1) : 0);
    audio.siren(game.state === 'playing' ? police.sirenLevel() : 0);
    if (!game.noRender) engine.render();

    // drop to fast graphics by itself on machines that struggle
    fpsAvg += (1 / Math.max(dt, .001) - fpsAvg) * .05;
    if (autoQuality && engine.quality === 'high' && game.state === 'playing') {
      slowFor = fpsAvg < 27 ? slowFor + dt : 0;
      if (slowFor > 4) { autoQuality = false; engine.setQuality('fast'); hud.toast('SWITCHED TO FAST GRAPHICS', 'info'); }
    }
  }
  // let traffic spread out before anyone looks
  for (let i = 0; i < 240; i++) step(STEP);
  // ?test: no free-running loop; a test script drives frames by hand through game.advance
  game.advance = advance; game.setState = setState;
  if (new URLSearchParams(location.search).has('test')) { autoQuality = false; engine.setQuality('fast'); advance(STEP); }
  else requestAnimationFrame(frame);
}

boot().catch((e) => { console.error(e); const b = document.getElementById('playBtn'); if (b) b.textContent = 'Could not start: ' + e.message; });
