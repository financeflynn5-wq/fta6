// The law: wanted stars, cruisers that hunt you through the streets, officers who jump
// out to grab you on foot, and losing them by breaking line of sight.
import { POLICE, WORLD, CAR, COMBAT } from '../config.js';
import { clamp, choose, damp, angleDiff } from '../core/utils.js';
import { groundY } from '../world/city.js';
import { animateCharacter, reelCharacter, COPS } from '../characters/models.js';
import { AIDriver, nearestNodeIndex } from '../vehicles/aiDriver.js';

const N = WORLD.nodes;

export function createPolice(game) {
  const units = [];      // { car, driver, officer, deployed, search, crew, outT }   crew: officers of this car still on their feet (POLICE.crew to start with)
  const officers = [];   // cops on foot with a physics body: { ped, body, unit, state, grab, stuck, side }
  let sightTimer = 0, spawnTimer = 0, patrolTimer = 3;

  const police = {
    stars: 0, heat: 0, hidden: 0, seen: false, contact: false, peak: 0, lastKnown: { x: 0, z: 0 }, units, officers,
    owns: (car) => units.some(u => u.car === car),
    get searching() { return police.stars > 0 && police.contact && police.hidden > 1.5; },

    // Something illegal happened. amount feeds the heat meter; minStars forces at least that level.
    crime(amount, minStars = 0, label = null) {
      if (game.match?.on) return;                      // in a Cops vs Robbers match the cops are other players
      const p = game.player, before = police.stars;
      police.heat += amount;
      let s = 0; for (let i = 1; i <= 5; i++) if (police.heat >= POLICE.heat[i]) s = i;
      if (s < minStars && before < minStars) { s = minStars; police.heat = Math.max(police.heat, POLICE.heat[minStars]); }
      s = Math.max(s, before);
      police.lastKnown.x = p.x; police.lastKnown.z = p.z; police.hidden = 0;
      if (s > before) {
        police.stars = s; police.peak = Math.max(police.peak, s); spawnTimer = Math.min(spawnTimer, before === 0 ? .6 : 1.5);
        game.audio.star(); game.hud.setStars(s, true);
        if (label) game.hud.toast(label, 'bad');
      }
    },

    // Is there a cop (cruiser or on the beat) close enough to have seen something at x,z?
    witnessed(x, z, range = 42) {
      for (const v of game.traffic.vehicles) if (v.type === 'police' && v.driver instanceof AIDriver && Math.hypot(v.x - x, v.z - z) < range && game.physics.canSee(v.x, v.z, x, z)) return true;
      for (const c of game.peds.list) if (c.cop && Math.hypot(c.x - x, c.z - z) < range * .7 && game.physics.canSee(c.x, c.z, x, z)) return true;
      return false;
    },

    clear(silent = true) {
      police.stars = 0; police.heat = 0; police.hidden = 0; police.peak = 0; police.contact = false; game.hud.setStars(0);
      for (const u of units) { u.car.siren = false; u.car.temp = true; if (u.driver && !u.car.wrecked && u.car.driver === u.driver) { if (u.deployed) u.driver.mode = 'pursue'; u.driver.resumeCruise(); } }
      units.length = 0;
      for (const o of officers.slice()) retire(o);
      game.airSea?.standDown();
      if (!silent) game.audio.evade();
    },

    // The player took one of our cars.
    carStolen(car) {
      const i = units.findIndex(u => u.car === car); if (i < 0) return;
      const u = units[i]; if (u.officer) u.officer.unit = null; units.splice(i, 1); car.siren = false; holdBackup();
    },
    carWrecked(car) {
      const i = units.findIndex(u => u.car === car); if (i < 0) return;
      const u = units[i]; units.splice(i, 1); holdBackup(); if (u.officer) u.officer.unit = null;
      else if (police.stars > 0 && u.crew > 0) footOfficer(choose(COPS), car.x - car.rx * 1.9, car.z - car.rz * 1.9, null);   // crawls out and keeps coming
      car.driver = null;
    },
    // An officer on foot got hit by a car: they go flying like anyone else.
    knockOfficer(o, car) {
      if (car.speed < 4 || !officers.includes(o)) return;
      const ped = o.ped; if (o.unit) o.unit.crew--; retire(o, false);          // the car is one officer short: nobody takes their place
      game.peds.list.push(ped); game.peds.launch(ped, car.vx * .8, car.vz * .8, 2 + car.speed * .34);
      game.onPedHit(ped, car);
    },

    // Shot or punched. Returns true when the officer is knocked out.
    hurtOfficer(o, dmg, dx, dz, push = 1.5) {
      if (!officers.includes(o)) return false;
      o.hp = (o.hp ?? COMBAT.hp.officer) - dmg; o.grab = 0; o.stun = Math.max(o.stun || 0, .3 + push * .05);
      o.body.setLinvel({ x: dx * push, y: dz * push }, true); reelCharacter(o.ped.model, dx, dz, o.ped.face, push / 3);
      if (o.hp > 0) return false;
      const ped = o.ped; if (o.unit) o.unit.crew--; retire(o, false); game.peds.knockOut(ped, dx * 3, dz * 3); return true;
    },

    update(dt, t) {
      const p = game.player, peds = game.peds;
      // ----- off duty: keep a couple of cruisers on patrol -----
      if (police.stars === 0) {
        if ((patrolTimer -= dt) <= 0) {
          patrolTimer = 4;
          const cruisers = game.traffic.vehicles.filter(v => v.type === 'police' && v.driver instanceof AIDriver && !v.wrecked);
          if (cruisers.length < 2) game.traffic.spawnCruiser('police', 90);
          else if (cruisers.length > 2) {
            const far = cruisers.find(v => Math.hypot(v.x - p.x, v.z - p.z) > 110 && !game.physics.canSee(v.x, v.z, p.x, p.z));
            if (far) game.traffic.remove(far);
          }
        }
        updateOfficers(dt, t);
        return;
      }

      // ----- can anyone see the player? -----
      if ((sightTimer -= dt) <= 0) {
        sightTimer = .2; police.seen = false;
        const sees = (x, z) => { const d = Math.hypot(x - p.x, z - p.z); return d < POLICE.nearRange || (d < POLICE.sightRange && game.physics.canSee(x, z, p.x, p.z)); };
        for (const u of units) if (!u.car.wrecked && sees(u.car.x, u.car.z)) { police.seen = true; break; }
        if (!police.seen) for (const o of officers) if (sees(o.ped.x, o.ped.z)) { police.seen = true; break; }
        if (!police.seen && game.airSea?.sees()) police.seen = true;          // the helicopter overhead, a patrol boat
        if (!police.seen) for (const c of peds.list) if (c.cop && (c.state === 'walk' || c.state === 'return') && Math.hypot(c.x - p.x, c.z - p.z) < 45 && sees(c.x, c.z)) { police.seen = true; break; }
        // beat cops close by join the chase on foot
        for (const c of peds.list.slice()) {
          if (!c.cop || (c.state !== 'walk' && c.state !== 'return') || officers.length >= POLICE.footMax) continue;
          if (Math.hypot(c.x - p.x, c.z - p.z) < 30 && game.physics.canSee(c.x, c.z, p.x, p.z)) makeOfficer(peds.release(c), null);
        }
      }
      if (police.seen) {
        police.hidden = 0; police.contact = true; police.lastKnown.x = p.x; police.lastKnown.z = p.z;
        const before = police.stars; police.heat += POLICE.crime.perSecond * dt;
        if (before < 5 && police.heat >= POLICE.heat[before + 1]) police.crime(0, before + 1, 'HEAT RISING');
      } else police.hidden += dt;
      game.hud.setSearching(police.searching);
      if (police.hidden > (police.contact ? POLICE.evadeTime[police.stars] : 30)) {      // no escaping before they've even found you
        const cash = POLICE.bounty[police.peak]; police.clear(false);
        game.addMoney(cash); game.hud.toast(`COPS LOST  +$${cash}`, 'good'); return;
      }

      // ----- send more cars -----
      if ((spawnTimer -= dt) <= 0 && units.length < POLICE.pursuers[police.stars]) {
        spawnTimer = 2.6;
        // a patrol car that's already nearby answers first
        let car = game.traffic.vehicles.find(v => v.type === 'police' && v.driver instanceof AIDriver && !v.wrecked && !police.owns(v) && Math.hypot(v.x - p.x, v.z - p.z) < 150);
        if (!car) car = game.highway?.spawnCop();          // on the highway with you, when that is where you are
        if (!car) {
          let spot = null;
          // best of a few tries: out of sight, facing the player, and ideally where they're headed
          let bestScore = -1e9; const ax = p.x + p.vx * 4, az = p.z + p.vz * 4;
          for (let i = 0; i < 10; i++) {
            const s = game.traffic.findRoadSpot(POLICE.spawnMin, POLICE.spawnMax); if (!s) continue;
            const facing = (Math.cos(s.h) * (p.x - s.x) + Math.sin(s.h) * (p.z - s.z)) / (Math.hypot(p.x - s.x, p.z - s.z) + 1);
            const score = facing * 40 - Math.hypot(s.x - ax, s.z - az);
            if (score > bestScore) { bestScore = score; spot = s; }
          }
          if (spot) { car = game.traffic.add('police', spot.x, spot.z, spot.h); car.temp = true; new AIDriver(game, car, spot.from, spot.to); car.body.setLinvel({ x: Math.cos(spot.h) * 14, y: Math.sin(spot.h) * 14 }, true); }
        }
        if (car) units.push({ car, driver: car.driver, officer: null, deployed: false, search: null, flank: (units.length % 3 - 1) * 5, crew: POLICE.crew, outT: 0 });
      }

      // ----- drive each unit -----
      const inCar = p.mode === 'car', stars = police.stars, shore = game.airSea?.offRoad();      // shore: the player is afloat or in the air; the cars wait at the nearest street
      for (const u of units.slice()) {
        const car = u.car, d = u.driver; if (car.wrecked) continue;
        car.siren = true; u.outT = Math.max(0, u.outT - dt);
        const dist = Math.hypot(car.x - p.x, car.z - p.z);
        if (u.deployed) {
          const o = u.officer;
          if (!o && u.crew <= 0) { abandon(u); continue; }          // both officers are down: the car stays where it stopped, empty
          if (!o) { u.deployed = false; d.mode = 'pursue'; u.outT = POLICE.nextOut; }
          else if ((inCar && p.speed > 7) || Math.hypot(o.ped.x - p.x, o.ped.z - p.z) > 34 || police.hidden > 3) o.state = 'return';
          else o.state = 'chase';
          continue;
        }
        d.mode = 'pursue';
        d.maxSpeed = car.stats.maxSpeed * [0, .78, .86, .94, 1, 1][stars];
        d.ram = inCar && stars >= 2;
        d.hold = police.hidden < 2 && (!inCar || (p.speed < 3.5 && dist < 16));
        if (shore) { d.target.x = shore.x; d.target.z = shore.z; d.ram = false; d.hold = Math.hypot(car.x - shore.x, car.z - shore.z) < 20; u.search = null; }
        else if (police.hidden < 1.5 || !police.contact) {
          const lead = clamp(dist / 34, 0, 1.1);
          d.target.x = p.x + p.vx * lead - car.rx * 0; d.target.z = p.z + p.vz * lead; u.search = null;
          if (dist > 22 && d.ram) { d.target.x += -p.vz / (p.speed + 1) * u.flank; d.target.z += p.vx / (p.speed + 1) * u.flank; }   // come at them from different sides
        } else {
          // lost them: check the last place they were seen, then sweep nearby corners
          const goal = u.search || police.lastKnown;
          if (Math.hypot(car.x - goal.x, car.z - goal.z) < 13 || !u.search && Math.hypot(car.x - police.lastKnown.x, car.z - police.lastKnown.z) < 13) {
            const i = clamp(nearestNodeIndex(police.lastKnown.x) + choose([-1, 0, 1]), 0, WORLD.COLS - 1), j = clamp(nearestNodeIndex(police.lastKnown.z) + choose([-1, 0, 1]), 0, N.length - 1);
            u.search = { x: N[i], z: N[j] };
          }
          d.target.x = (u.search || police.lastKnown).x; d.target.z = (u.search || police.lastKnown).z; d.hold = false; d.ram = false; d.maxSpeed = 17;
        }
        // boxed in or cornered: the officer gets out
        if (d.hold && !shore && dist < 9.5 && car.speed < 2.5 && !u.officer && u.crew > 0 && u.outT <= 0 && police.seen) {
          u.deployed = true; d.mode = 'wait';
          u.officer = footOfficer(choose(COPS), car.x - car.rx * 1.8, car.z - car.rz * 1.8, u); game.audio.door();
        }
      }
      updateOfficers(dt, t);
    },

    sirenLevel() {
      const p = game.player; let best = 0;
      for (const u of units) if (u.car.siren) best = Math.max(best, clamp(1 - Math.hypot(u.car.x - p.x, u.car.z - p.z) / 110, 0, 1));
      return game.airSea ? game.airSea.sirenLevel(best) : best;
    },
  };

  // A cruiser was emptied, wrecked or stolen: its replacement takes a while to turn up.
  function holdBackup() { spawnTimer = Math.max(spawnTimer, POLICE.backup); }
  // Nobody is left in this car. It is no longer one of ours: lights off, parked where it stopped (yours to take).
  function abandon(u) {
    const i = units.indexOf(u); if (i >= 0) units.splice(i, 1);
    const car = u.car, c = car.controls; car.siren = false; car.temp = true; car.driver = null; c.throttle = 0; c.steer = 0; c.handbrake = true;
    holdBackup();
  }
  function footOfficer(kind, x, z, unit) {
    const ped = game.peds.release(game.peds.spawn(kind, x, z, 0, 0, true)); ped.extra = true;
    if (unit?.car.up) ped.y = unit.car.y;        // stepping out onto the bridge, not the street under it
    return makeOfficer(ped, unit);
  }
  function makeOfficer(ped, unit) {
    const o = { isOfficer: true, ped, unit, state: 'chase', grab: 0, stuck: 0, side: 0, sideT: 0, body: null };
    o.body = game.physics.addPerson(o, ped.x, ped.z, .36, 85); ped.state = 'officer'; ped.air = 0;
    officers.push(o); return o;
  }
  // Take an officer off the chase. rejoin: walk back to a sidewalk beat.
  function retire(o, rejoin = true) {
    const i = officers.indexOf(o); if (i >= 0) officers.splice(i, 1);
    game.physics.remove(o.body);
    if (o.unit) { o.unit.officer = null; }
    if (rejoin) game.peds.adopt(o.ped);
  }
  function boardCar(o) {
    const u = o.unit; retire(o, false); game.scene.remove(o.ped.model);
    if (u) { u.deployed = false; if (u.driver) u.driver.mode = 'pursue'; }
  }

  const vel = { x: 0, y: 0 };
  function updateOfficers(dt, t) {
    const p = game.player, inCar = p.mode === 'car';
    for (const o of officers.slice()) {
      const ped = o.ped, pos = o.body.translation(), v = o.body.linvel();
      ped.x = pos.x; ped.z = pos.y;
      if (o.stun > 0) {          // reeling from a punch or a bullet
        o.stun -= dt; vel.x = v.x * Math.max(0, 1 - 6 * dt); vel.y = v.y * Math.max(0, 1 - 6 * dt); o.body.setLinvel(vel, true);
        ped.y = damp(ped.y, groundY(ped.x, ped.z, ped.y), 16, dt); ped.model.position.set(ped.x, ped.y, ped.z);
        animateCharacter(ped.model, t, dt, 0, 'stand', police.stars > 0); continue;
      }
      let tx = p.x, tz = p.z, speed = POLICE.footSpeed + (police.stars >= 3 ? .5 : 0);
      if (police.stars === 0 || o.state === 'return') {
        if (o.unit && !o.unit.car.wrecked && o.unit.car.driver === o.unit.driver) {
          tx = o.unit.car.x - o.unit.car.rx * 1.5; tz = o.unit.car.z - o.unit.car.rz * 1.5;
          if (Math.hypot(tx - ped.x, tz - ped.z) < 1.3) { boardCar(o); continue; }
        } else if (police.stars === 0 || police.hidden > 3) { retire(o); continue; }
      }
      const dx = tx - ped.x, dz = tz - ped.z, d = Math.hypot(dx, dz) || 1;
      let mx = dx / d, mz = dz / d;
      // blocked by a wall or a car: shuffle sideways around it
      const moving = Math.hypot(v.x, v.y);
      if (moving < speed * .35 && d > 2) { o.stuck += dt; if (o.stuck > .35 && o.sideT <= 0) { o.side = Math.random() < .5 ? 1 : -1; o.sideT = .9; } } else o.stuck = 0;
      if ((o.sideT -= dt) > 0) { const sx = -mz * o.side, sz = mx * o.side; mx = mx * .25 + sx; mz = mz * .25 + sz; const l = Math.hypot(mx, mz); mx /= l; mz /= l; }
      // armed officers (set by combat) hold back at gun range while they can see you
      const stop = d < .9 || (inCar && police.stars > 0 && o.state === 'chase' && p.vehicle.distanceTo(ped.x, ped.z) < .75) || (o.hold > 0 && o.state === 'chase' && d < o.hold && game.physics.canSee(ped.x, ped.z, p.x, p.z));
      vel.x = damp(v.x, stop ? 0 : mx * speed, 12, dt); vel.y = damp(v.y, stop ? 0 : mz * speed, 12, dt); o.body.setLinvel(vel, true);
      ped.face += angleDiff(Math.atan2(mx, mz), ped.face) * Math.min(1, dt * 12); ped.speed = moving;

      // the grab
      if (police.stars > 0 && o.state === 'chase' && !game.over) {
        const reach = Math.abs(ped.y - p.y) < 2.5 && (inCar ? p.vehicle.distanceTo(ped.x, ped.z) < 1.5 && p.speed < 2.2 : d < 1.35);      // not through a bridge deck
        o.grab = reach ? o.grab + dt : Math.max(0, o.grab - dt * 2);
        if (o.grab > (inCar ? 1.5 : p.tumble > 0 ? .1 : .4)) { o.grab = 0; game.busted(); }
      }
      ped.y = damp(ped.y, groundY(ped.x, ped.z, ped.y), 16, dt);
      ped.model.visible = true; ped.model.position.set(ped.x, ped.y, ped.z); ped.model.rotation.y = ped.face;
      animateCharacter(ped.model, t, dt, moving, moving > .4 ? 'move' : 'stand', police.stars > 0);
    }
  }
  void CAR;
  return police;
}
