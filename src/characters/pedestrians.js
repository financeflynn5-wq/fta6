// Citizens on the sidewalks. They stroll around their block, dive out of the way of
// cars, panic, and go flying (harmlessly) when a car does hit them.
import { WORLD, TRAFFIC } from '../config.js';
import { choose, clamp, rnd } from '../core/utils.js';
import { groundY } from '../world/city.js';
import { makeCharacter, animateCharacter, setCharacterShadow, CIVILIANS, COPS } from './models.js';

const { PITCH } = WORLD;

// Position on the square path around a block: s is distance walked along it.
function rectPoint(lane, s) {
  const side = lane * 2, p = ((s % (side * 4)) + side * 4) % (side * 4), k = Math.floor(p / side), f = p - k * side - lane;
  return [[f, -lane, 1, 0], [lane, f, 0, 1], [-f, lane, -1, 0], [-lane, -f, 0, -1]][k];
}
// The reverse: closest point on that path to a position (relative to block centre).
function rectParam(lane, x, z) {
  const d = [Math.abs(z + lane), Math.abs(x - lane), Math.abs(z - lane), Math.abs(x + lane)];
  let k = 0; for (let i = 1; i < 4; i++) if (d[i] < d[k]) k = i;
  const f = clamp([x, z, -x, -z][k], -lane, lane);
  return k * lane * 2 + f + lane;
}
const blockCentre = (v) => 27 + PITCH * clamp(Math.round((v - 27) / PITCH), -3, 2);

export function createPedestrians(game) {
  const list = [];

  function add(kind, x, z, cop = false) {
    const model = makeCharacter(kind); game.scene.add(model);
    const ped = {
      isPed: true, kind, cop, model, x, z, y: groundY(x, z), vx: 0, vz: 0, vy: 0, air: 0,
      cx: blockCentre(x), cz: blockCentre(z), lane: rnd(17.6, 19), s: 0, pace: rnd(1.1, 1.7) * (Math.random() < .5 ? 1 : -1),
      state: 'walk', timer: 0, face: 0, speed: 0, panic: 0,
    };
    ped.s = rectParam(ped.lane, x - ped.cx, z - ped.cz);
    list.push(ped); return ped;
  }

  const peds = {
    list,
    init() {
      for (const bi of WORLD.blocksIdx) for (const bj of WORLD.blocksIdx) {
        const cx = 27 + PITCH * bi, cz = 27 + PITCH * bj, near = Math.abs(cx) < 60 && Math.abs(cz) < 60;
        for (let i = 0; i < (near ? TRAFFIC.pedCountNear : TRAFFIC.pedCountFar); i++) {
          const p = add(choose(CIVILIANS), cx, cz); p.s = Math.random() * 150;
        }
      }
      // beat cops on foot
      for (let i = 0; i < 7; i++) {
        const cx = 27 + PITCH * choose([-2, -1, 0, 1]), cz = 27 + PITCH * choose([-2, -1, 0, 1]);
        const p = add(COPS[i % 2], cx, cz, true); p.s = Math.random() * 150;
      }
    },
    // A driver thrown out of their car, or anyone else who needs to rejoin the sidewalk.
    spawn(kind, x, z, throwX = 0, throwZ = 0, cop = false) {
      const p = add(kind, x, z, cop);
      if (throwX || throwZ) { p.state = 'air'; p.vx = throwX; p.vz = throwZ; p.vy = 3.2; p.air = .01; }
      else p.state = 'return';
      p.panic = 8; game.env.touch(); return p;
    },
    // Hand a pedestrian over to another system (police take their beat cops back).
    release(ped) { const i = list.indexOf(ped); if (i >= 0) list.splice(i, 1); return ped; },
    adopt(ped) { ped.cx = blockCentre(ped.x); ped.cz = blockCentre(ped.z); ped.state = 'return'; ped.panic = 0; list.push(ped); },

    scare(x, z, radius, time = 6) { for (const p of list) if (!p.cop && Math.hypot(p.x - x, p.z - z) < radius) p.panic = Math.max(p.panic, time); },

    update(dt, t) {
      const cam = game.player, vehicles = game.traffic.vehicles;
      for (const p of list) {
        const far = Math.hypot(p.x - cam.x, p.z - cam.z);
        const visible = far < 130; p.model.visible = visible;
        p.panic -= dt;
        let pose = 'move';

        if (p.state === 'walk') {
          const run = p.panic > 0 ? 3.4 : 1;
          p.s += p.pace * run * dt; p.speed = Math.abs(p.pace) * run;
          const [x, z, dx, dz] = rectPoint(p.lane, p.s), sg = Math.sign(p.pace);
          p.x = p.cx + x; p.z = p.cz + z; p.face = Math.atan2(dx * sg, dz * sg);
          if (p.panic > 0) pose = 'flail';
        } else if (p.state === 'dive') {
          p.x += p.vx * dt; p.z += p.vz * dt; p.speed = 6; pose = 'flail';
          if ((p.timer -= dt) <= 0) { p.state = 'return'; p.panic = 4; }
        } else if (p.state === 'air') {
          p.x += p.vx * dt; p.z += p.vz * dt; p.air += p.vy * dt; p.vy -= 22 * dt; p.face += 9 * dt; pose = 'down';
          if (p.air <= 0) { p.air = 0; p.state = 'down'; p.timer = rnd(2.4, 4); if (p.model.userData.bot) game.audio.clank(); }
        } else if (p.state === 'down') {
          p.vx *= Math.max(0, 1 - 5 * dt); p.vz *= Math.max(0, 1 - 5 * dt); p.x += p.vx * dt; p.z += p.vz * dt; pose = 'down'; p.speed = 0;
          if ((p.timer -= dt) <= 0) { p.state = 'return'; p.panic = 7; }
        } else if (p.state === 'return') {
          const s = rectParam(p.lane, p.x - p.cx, p.z - p.cz), [x, z] = rectPoint(p.lane, s);
          const dx = p.cx + x - p.x, dz = p.cz + z - p.z, d = Math.hypot(dx, dz);
          p.speed = p.panic > 0 ? 5.5 : 2.2;
          if (d < .3) { p.state = 'walk'; p.s = s; }
          else { p.x += dx / d * p.speed * dt; p.z += dz / d * p.speed * dt; p.face = Math.atan2(dx, dz); }
          if (p.panic > 0) pose = 'flail';
        }
        const L = WORLD.LIMIT - 1; p.x = clamp(p.x, -L, L); p.z = clamp(p.z, -L, L);

        if (visible && p.state !== 'air' && p.state !== 'down') {
          for (const v of vehicles) {
            if (v.speed < 2.4) continue;
            const ddx = p.x - v.x, ddz = p.z - v.z; if (Math.abs(ddx) > 16 || Math.abs(ddz) > 16) continue;
            const lx = ddx * v.fx + ddz * v.fz, lz = ddx * v.rx + ddz * v.rz;
            if (Math.abs(lx) < 2.55 && Math.abs(lz) < 1.25) {            // bonk
              p.state = 'air'; p.air = .01; p.vy = 3.5 + v.speed * .2;
              const side = (lz >= 0 ? 1 : -1) * rnd(1, 3);
              p.vx = v.vx * .8 + v.rx * side; p.vz = v.vz * .8 + v.rz * side;
              game.onPedHit(p, v); break;
            }
            // about to be run over: jump clear, away from the car's line
            const ahead = v.vf > 0 ? lx : -lx;
            if (p.state !== 'dive' && v.speed > 5 && ahead > 0 && ahead < 3 + v.speed * .55 && Math.abs(lz) < 1.9) {
              const sg = lz >= 0 ? 1 : -1; p.state = 'dive'; p.timer = .45; p.vx = v.rx * sg * 6; p.vz = v.rz * sg * 6; p.face = Math.atan2(p.vx, p.vz);
            }
          }
        }
        if (!visible) continue;
        p.y = groundY(p.x, p.z) + p.air;
        p.model.position.set(p.x, p.y, p.z); p.model.rotation.y = p.face;
        setCharacterShadow(p.model, far < 60);
        if (far < 90) animateCharacter(p.model, t, dt, p.speed, pose);
      }
    },
  };
  return peds;
}
