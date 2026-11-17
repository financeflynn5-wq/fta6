// Cars driven by crooks: runaways you have to run down (story missions, bounty hunts) and hunters that come
// after you (the derby). A runaway is an ordinary traffic car whose driver never stops being scared: it keeps to
// the roads but floors it, runs the lights and swings out round traffic. A hunter uses the AI's "pursue" mode,
// pointed at you. Ramming either is not a crime (vehicle.outlaw, see main.js).
import { STORY } from '../config.js';
import { AIDriver } from '../vehicles/aiDriver.js';
import { nearestRoadLeg } from '../world/roads.js';

export function createOutlaws(game) {
  const p = game.player, traffic = game.traffic;

  // The driver gives up: out of the car and off down the street.
  function bail(r) {
    const v = r.car, d = v.driver;
    if (d instanceof AIDriver) {
      v.dropRider();
      const ped = game.peds.spawn(r.crook || d.kind || 'possum', v.x - v.rx * (v.halfWid + .95), v.z - v.rz * (v.halfWid + .95)); ped.panic = 12;
      v.driver = null;
    }
    v.controls.throttle = 0; v.controls.steer = 0; v.controls.handbrake = true; v.temp = true; v.outlaw = false;
  }

  return {
    // A crook's car that appears on a road between minDist and maxDist from you and runs for it.
    // o: speed (top speed), giveUp (share of health at which the driver stops), lost (metres), crook (who climbs out).
    // Returns null if no road spot was free; try again next frame.
    runaway(type, minDist, maxDist, o = {}) {
      const v = traffic.spawnCruiser(type, minDist, maxDist); if (!v) return null;
      const d = v.driver; v.outlaw = true; v.temp = false; d.flee = o.speed ?? 24; d.scared = 9;
      return { car: v, driver: d, state: 'run', lostT: 0, hp: v.health, speed: d.flee, giveUp: o.giveUp ?? .45, lost: o.lost ?? STORY.lost, crook: o.crook };
    },
    // Call every frame. r.state: 'run', 'stopped' (you got them: the car is theirs no more) or 'gone' (they got away).
    update(r, dt) {
      if (r.state !== 'run') return r.state;
      const v = r.car, d = r.driver;
      if (!traffic.vehicles.includes(v)) return r.state = 'gone';
      v.temp = false; d.scared = 9;                        // floors it, runs the lights, never calms down
      // Only what you do to the car counts for much: most of the damage from its own bad driving is handed back.
      const lost = r.hp - v.health;
      if (lost > 0 && !v.wrecked) {
        const you = p.mode === 'car' ? p.vehicle.distanceTo(v.x, v.z) < v.halfLen + 1.6 : game.time - (game.combat?.lastShot ?? -9) < .25;
        if (!you) v.health += lost * .85;
      }
      r.hp = v.health;
      if (v.wrecked || v.health <= r.giveUp * v.stats.health) { bail(r); return r.state = 'stopped'; }
      const far = Math.hypot(v.x - p.x, v.z - p.z);
      d.flee = far > STORY.ease ? r.speed * .65 : r.speed;       // with nobody on their tail they ease off, so a slow start is not a lost chase
      r.lostT = far > r.lost ? r.lostT + dt : 0;
      if (r.lostT > 3) { v.temp = true; v.outlaw = false; d.flee = 0; d.scared = 0; return r.state = 'gone'; }
      return 'run';
    },
    // Let a runaway go (the mission ended some other way): it becomes ordinary traffic.
    release(r) { if (r.state !== 'run') return; const v = r.car; r.state = 'gone'; v.temp = true; v.outlaw = false; r.driver.flee = 0; r.driver.scared = 0; },

    // You and one of them touched (main.js, on contact). If you drove into them their car takes extra, on top of the ordinary
    // crash damage, and either way yours shrugs off part of the knock, so running someone off the road does not wreck you first.
    rammed(v, mine, rel) {
      mine.soak = STORY.ramSoak;
      // the extra is for driving into them, not for being driven into
      const dx = v.x - mine.x, dz = v.z - mine.z, at = (mine.vx * dx + mine.vz * dz) / (Math.hypot(dx, dz) || 1);
      if (rel < 4 || at < 3 || game.time - (v.ramT ?? -9) < .5 || v.wrecked) return;
      v.ramT = game.time; v.damage(rel * STORY.ram); game.audio.crash(.5); game.cam.shake(.25);
    },

    // A car that comes after you and rams you. Keep it pointed at you with aim().
    hunter(type, x, z, h, speed = 20) {
      const v = traffic.add(type, x, z, h), leg = nearestRoadLeg(x, z, Math.cos(h), Math.sin(h));
      const d = new AIDriver(game, v, leg.from, leg.to); d.mode = 'pursue'; d.ram = true; d.maxSpeed = speed; v.outlaw = true; v.temp = false;
      d.target.x = p.x; d.target.z = p.z; return v;
    },
    aim(v, x = p.x, z = p.z) { if (v.driver instanceof AIDriver) { v.driver.target.x = x; v.driver.target.z = z; } },
    // Send a hunter back to being traffic.
    dismiss(v) { v.outlaw = false; v.temp = true; if (!v.wrecked && v.driver instanceof AIDriver && traffic.vehicles.includes(v)) v.driver.resumeCruise(); },
  };
}
