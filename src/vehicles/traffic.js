// Owns every car in the city: parked cars, cruising traffic, and keeping the streets stocked.
import { WORLD, TRAFFIC, PLAYER } from '../config.js';
import { rand, choose } from '../core/utils.js';
import { Vehicle } from './vehicle.js';
import { AIDriver } from './aiDriver.js';

const N = WORLD.nodes, LAST = N.length - 1;

export function createTraffic(game) {
  const vehicles = [];
  const traffic = {
    vehicles,
    add(type, x, z, h) { const v = new Vehicle(game, type, x, z, h); vehicles.push(v); return v; },
    remove(v) { const i = vehicles.indexOf(v); if (i >= 0) vehicles.splice(i, 1); v.dispose(); },

    // A free stretch of road, optionally far from (and hidden from) the player.
    findRoadSpot(minDist = 0, maxDist = 1e9) {
      const p = game.player;
      for (let tries = 0; tries < 40; tries++) {
        const i = Math.floor(Math.random() * (LAST + 1)), j = Math.floor(Math.random() * (LAST + 1));
        const [di, dj] = choose([[1, 0], [-1, 0], [0, 1], [0, -1]]);
        if (i + di < 0 || i + di > LAST || j + dj < 0 || j + dj > LAST) continue;
        const s = 12 + Math.random() * 28, x = N[i] + di * s - dj * WORLD.LANE, z = N[j] + dj * s + di * WORLD.LANE;
        const d = p ? Math.hypot(x - p.x, z - p.z) : 999;
        if (d < minDist || d > maxDist) continue;
        if (minDist > 0 && d < 110 && game.physics.canSee(x, z, p.x, p.z)) continue;
        if (vehicles.some(v => Math.abs(v.x - x) < 13 && Math.abs(v.z - z) < 13)) continue;
        return { x, z, h: Math.atan2(dj, di), from: { i, j }, to: { i: i + di, j: j + dj } };
      }
      return null;
    },
    spawnCruiser(type, minDist = 0) {
      const s = traffic.findRoadSpot(minDist); if (!s) return null;
      const v = traffic.add(type, s.x, s.z, s.h); v.temp = true;
      new AIDriver(game, v, s.from, s.to); return v;
    },

    init() {
      // parked cars along the three main streets, as in the concept
      for (const r of [-54, 0, 54]) for (const axis of ['x', 'z']) for (let t = -140; t < 140; t += 11) {
        if (WORLD.roadsAt.some(q => Math.abs(t - q) < 14) || rand() < .45) continue;
        const side = rand() < .5 ? 1 : -1, type = rand() < .1 ? 'taxi' : 'car';
        if (axis === 'x') traffic.add(type, t, r + side * 5.6, side > 0 ? 0 : Math.PI);
        else traffic.add(type, r + side * 5.6, t, side > 0 ? -Math.PI / 2 : Math.PI / 2);
      }
      // one guaranteed ride right next to where Rocco starts
      const sx = -48.4, sz = PLAYER.spawn.z - 7;
      for (const v of vehicles.slice()) if (Math.abs(v.x - sx) < 3 && Math.abs(v.z - sz) < 7) traffic.remove(v);
      traffic.add('car', sx, sz, -Math.PI / 2);
      for (let i = 0; i < TRAFFIC.count; i++) traffic.spawnCruiser(Math.random() < .16 ? 'taxi' : 'car');
    },

    preStep(dt, t) {
      for (const v of vehicles) { if (v.driver instanceof AIDriver) v.driver.update(dt, t); v.preStep(dt); }
    },
    postStep(dt) { for (const v of vehicles) v.postStep(dt); },
    syncVisual(dt, t) { for (const v of vehicles) v.syncVisual(dt, t); },

    // Every couple of seconds: clear junk far from the player and top traffic back up.
    maintain() {
      const p = game.player; let cruising = 0;
      for (const v of vehicles.slice()) {
        const far = Math.hypot(v.x - p.x, v.z - p.z);
        if (v.driver instanceof AIDriver && v.type !== 'police' && !v.wrecked) cruising++;
        if (v.driver === 'player' || game.police.owns(v)) continue;
        const abandoned = !v.driver && (v.temp || v.wrecked) && v.idleTime > 12;
        if (abandoned && far > 115 && !game.physics.canSee(v.x, v.z, p.x, p.z)) traffic.remove(v);
        else if (v.wrecked && v.idleTime > 90 && far > 60) traffic.remove(v);
      }
      if (cruising < TRAFFIC.count) traffic.spawnCruiser(Math.random() < .16 ? 'taxi' : 'car', 95);
    },
  };
  return traffic;
}
