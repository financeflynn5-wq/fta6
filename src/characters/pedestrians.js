// Citizens on the sidewalks. They stroll around their block, dive out of the way of cars, panic, stagger when
// punched, go head over heels when a car hits them, lie where they land and pick themselves up again.
import { WORLD, TRAFFIC, COMBAT } from '../config.js';
import { choose, clamp, rnd } from '../core/utils.js';
import { groundY } from '../world/city.js';
import { makeCharacter, animateCharacter, setCharacterShadow, reelCharacter, tumblePlan, tumbleEase, CIVILIANS, COPS } from './models.js';
import { maxHp } from '../combat/hits.js';

const { PITCH } = WORLD;
const GET_UP = .95;       // seconds to get back on their feet

// Position on the rectangular path a citizen walks (half-sizes hx, hz around a centre): s is distance walked along it.
function rectPoint(hx, hz, s) {
  const per = (hx + hz) * 4; let p = ((s % per) + per) % per;
  if (p < hx * 2) return [p - hx, -hz, 1, 0];
  if ((p -= hx * 2) < hz * 2) return [hx, p - hz, 0, 1];
  if ((p -= hz * 2) < hx * 2) return [hx - p, hz, -1, 0];
  return [-hx, hz - (p - hx * 2), 0, -1];
}
// The reverse: closest point on that path to a position (relative to the centre).
function rectParam(hx, hz, x, z) {
  const d = [Math.abs(z + hz), Math.abs(x - hx), Math.abs(z - hz), Math.abs(x + hx)];
  let k = 0; for (let i = 1; i < 4; i++) if (d[i] < d[k]) k = i;
  const fx = clamp(x, -hx, hx), fz = clamp(z, -hz, hz);
  return [fx + hx, hx * 2 + fz + hz, hx * 2 + hz * 2 + hx - fx, hx * 4 + hz * 2 + hz - fz][k];
}
const blockCentre = (v) => 27 + PITCH * clamp(Math.round((v - 27) / PITCH), -3, 2);

export function createPedestrians(game) {
  const list = [];
  const refill = [];      // citizens knocked out for good: replacements walk in somewhere out of sight
  let refillT = 0;

  function add(kind, x, z, cop = false, look) {
    const model = makeCharacter(kind, look); game.scene.add(model);
    const ped = {
      isPed: true, kind, cop, model, x, z, y: groundY(x, z), vx: 0, vz: 0, vy: 0, air: 0,
      cx: blockCentre(x), cz: blockCentre(z), lane: rnd(17.6, 19), laneZ: 0, s: 0, pace: rnd(1.1, 1.7) * (Math.random() < .5 ? 1 : -1),
      state: 'walk', timer: 0, face: 0, speed: 0, panic: 0,
    };
    ped.laneZ = ped.lane; ped.s = rectParam(ped.lane, ped.laneZ, x - ped.cx, z - ped.cz);
    list.push(ped); return ped;
  }

  const gone = [];
  function remove(p) {
    const i = list.indexOf(p); if (i >= 0) list.splice(i, 1);
    game.scene.remove(p.model); p.model.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
    refill.push({ cop: p.cop });
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
        const p = add(COPS[i % COPS.length], cx, cz, true); p.s = Math.random() * 150;
      }
    },
    // A driver thrown out of their car, or anyone else who needs to rejoin the sidewalk.
    // look: options for the character builder (a gang's colours, a camper's beanie).
    spawn(kind, x, z, throwX = 0, throwZ = 0, cop = false, look) {
      const p = add(kind, x, z, cop, look);
      if (throwX || throwZ) { p.face = Math.atan2(-throwX, -throwZ); peds.launch(p, throwX, throwZ, 3.2); }
      else p.state = 'return';
      p.panic = 8; game.env.touch(); return p;
    },
    // Someone who strolls a loop of their own outside downtown (a boardwalk, a pier, a hill street): half-sizes hx, hz around (cx, cz).
    addWalker(kind, cx, cz, hx, hz) {
      const p = add(kind, cx, cz); p.cx = cx; p.cz = cz; p.lane = hx; p.laneZ = hz; p.s = Math.random() * (hx + hz) * 4;
      const [x, z] = rectPoint(hx, hz, p.s); p.x = cx + x; p.z = cz + z; return p;
    },
    // Hand a pedestrian over to another system (police take their beat cops back).
    release(ped) { const i = list.indexOf(ped); if (i >= 0) list.splice(i, 1); return ped; },
    adopt(ped) { ped.cx = blockCentre(ped.x); ped.cz = blockCentre(ped.z); ped.state = 'return'; ped.panic = 0; list.push(ped); },

    // Shot or punched hard enough: they go down and stay down, then get carted off.
    knockOut(p, vx = 0, vz = 0) {
      if (!list.includes(p)) { list.push(p); p.cx = blockCentre(p.x); p.cz = blockCentre(p.z); }
      p.ko = true; p.hp = 0; if (p.state === 'down' || p.state === 'ko') { p.state = 'ko'; p.timer = COMBAT.koTime; return; }      // already on the floor: they stay there
      peds.launch(p, vx, vz, 2.6);
    },
    // Hit hard enough to take them off their feet: they land on their back (or their front), lie there a moment and get up.
    knockDown(p, vx, vz) { if (p.state === 'air' || p.state === 'ko' || p.state === 'down') return; peds.launch(p, vx, vz, 2.2); },
    // Sent flying along (vx, vz), going up at vy: they go over the way the blow takes them instead of spinning on the spot.
    // A hard launch (a fast car) turns them right over once in the air.
    launch(p, vx, vz, vy = 3.2) {
      const plan = tumblePlan(p.face, vx, vz, vy > 5.6 ? 1 : 0);
      p.state = 'air'; p.air = Math.max(p.air || 0, .01); p.vy = vy; p.vx = vx; p.vz = vz;
      p.face = plan.face; p.prone = plan.prone; p.flipTo = plan.to; p.flipT = 0; p.flipDur = Math.max(.3, vy / 11 * .92);
      p.model.userData.prone = plan.prone;
    },
    // A blow that does not floor them: they stumble back a step or two, arms out.
    stagger(p, vx, vz, time = .5) {
      if (p.state === 'air' || p.state === 'ko' || p.state === 'down') return;
      reelCharacter(p.model, vx, vz, p.face, 1);
      if (p.state === 'goon') { p.reelT = time; p.vx = vx; p.vz = vz; return; }          // fighters keep their own state and take the shove
      p.state = 'reel'; p.timer = time; p.vx = vx; p.vz = vz;
    },

    scare(x, z, radius, time = 6) { for (const p of list) if (!p.cop && Math.hypot(p.x - x, p.z - z) < radius) p.panic = Math.max(p.panic, time); },

    update(dt, t) {
      const cam = game.player, vehicles = game.traffic.vehicles;
      gone.length = 0;
      for (const p of list) {
        const far = Math.hypot(p.x - cam.x, p.z - cam.z);
        const visible = far < 130; p.model.visible = visible;
        p.panic -= dt;
        let pose = 'move';

        if (p.state === 'walk') {
          const run = p.panic > 0 ? 3.4 : 1;
          p.s += p.pace * run * dt; p.speed = Math.abs(p.pace) * run;
          const [x, z, dx, dz] = rectPoint(p.lane, p.laneZ, p.s), sg = Math.sign(p.pace);
          p.x = p.cx + x; p.z = p.cz + z; p.face = Math.atan2(dx * sg, dz * sg);
          if (p.panic > 0) pose = 'flail';
        } else if (p.state === 'dive') {
          p.x += p.vx * dt; p.z += p.vz * dt; p.speed = 6; pose = 'flail';
          if ((p.timer -= dt) <= 0) { p.state = 'return'; p.panic = 4; }
        } else if (p.state === 'air') {
          p.x += p.vx * dt; p.z += p.vz * dt; p.air += p.vy * dt; p.vy -= 22 * dt; pose = 'fly';
          p.flipT += dt; p.model.userData.flip = (p.flipTo || 0) * tumbleEase(Math.min(1, p.flipT / (p.flipDur || .4)));
          if (p.air <= 0) {
            p.air = 0; p.state = p.ko ? 'ko' : 'down'; p.timer = p.ko ? COMBAT.koTime : rnd(1.5, 2.8); p.model.userData.flip = p.flipTo || 0;
            if (far < 40) { if (p.model.userData.bot) game.audio.clank(); else game.audio.thud?.(1 - far / 40); }
          }
        } else if (p.state === 'down') {
          p.vx *= Math.max(0, 1 - 5 * dt); p.vz *= Math.max(0, 1 - 5 * dt); p.x += p.vx * dt; p.z += p.vz * dt; pose = 'down'; p.speed = 0;
          if ((p.timer -= dt) <= 0) { p.state = 'up'; p.timer = GET_UP; }
        } else if (p.state === 'up') {             // picking themselves up
          pose = 'up'; p.speed = 0; p.model.userData.rise = 1 - (p.timer -= dt) / GET_UP;
          if (p.timer <= 0) { p.state = 'return'; p.panic = 7; }
        } else if (p.state === 'reel') {           // stumbling back from a punch
          p.vx *= Math.max(0, 1 - 6 * dt); p.vz *= Math.max(0, 1 - 6 * dt); p.x += p.vx * dt; p.z += p.vz * dt; pose = 'stand'; p.speed = 0;
          if ((p.timer -= dt) <= 0) { p.state = 'return'; p.panic = 8; }
        } else if (p.state === 'ko') {
          p.vx *= Math.max(0, 1 - 5 * dt); p.vz *= Math.max(0, 1 - 5 * dt); p.x += p.vx * dt; p.z += p.vz * dt; pose = 'down'; p.speed = 0; p.panic = 0;
          if ((p.timer -= dt) <= 0 || far > 140) { gone.push(p); continue; }
        } else if (p.state === 'return') {
          const s = rectParam(p.lane, p.laneZ, p.x - p.cx, p.z - p.cz), [x, z] = rectPoint(p.lane, p.laneZ, s);
          const dx = p.cx + x - p.x, dz = p.cz + z - p.z, d = Math.hypot(dx, dz);
          p.speed = p.panic > 0 ? 5.5 : 2.2;
          if (d < .3) { p.state = 'walk'; p.s = s; }
          else { p.x += dx / d * p.speed * dt; p.z += dz / d * p.speed * dt; p.face = Math.atan2(dx, dz); }
          if (p.panic > 0) pose = 'flail';
        }
        const L = WORLD.LIMIT - 1; p.x = clamp(p.x, -L, L); p.z = clamp(p.z, -L, WORLD.LIMIT_N - 1);

        if (visible && p.state !== 'air' && p.state !== 'down' && p.state !== 'ko' && !(p.state === 'up' && p.timer > .4)) {
          for (const v of vehicles) {
            if (v.speed < 2.4 || v.y - p.y > 3 || p.y - v.y > 4) continue;                 // cars on a bridge overhead can't hit anyone down here, nor cars on the street someone up on a deck
            const ddx = p.x - v.x, ddz = p.z - v.z; if (Math.abs(ddx) > 16 || Math.abs(ddz) > 16) continue;
            const lx = ddx * v.fx + ddz * v.fz, lz = ddx * v.rx + ddz * v.rz;
            if (Math.abs(lx) < v.halfLen + .25 && Math.abs(lz) < v.halfWid + .3) {            // bonk
              // a nudge sits them down; a real hit throws them up the road and over
              const side = (lz >= 0 ? 1 : -1) * rnd(.6, 2.2);
              peds.launch(p, v.vx * .8 + v.rx * side, v.vz * .8 + v.rz * side, 2 + v.speed * .34);
              p.hp = (p.hp ?? maxHp(p)) - v.speed * 2.6; if (p.hp <= 0) p.ko = true;
              game.onPedHit(p, v); break;
            }
            // about to be run over: jump clear, away from the car's line
            const ahead = v.vf > 0 ? lx : -lx;
            if (p.state !== 'dive' && v.speed > 5 && ahead > 0 && ahead < v.halfLen + .7 + v.speed * .55 && Math.abs(lz) < v.halfWid + .95) {
              const sg = lz >= 0 ? 1 : -1; p.state = 'dive'; p.timer = .45; p.vx = v.rx * sg * 6; p.vz = v.rz * sg * 6; p.face = Math.atan2(p.vx, p.vz);
            }
          }
        }
        if (!visible) continue;
        // ref: someone up on a bridge or a deck (a mission's guards) stands on it, not on the ground underneath
        p.y = (p.ref === undefined ? groundY(p.x, p.z) : (p.ref = groundY(p.x, p.z, p.ref + .3))) + p.air;
        p.model.position.set(p.x, p.y, p.z); p.model.rotation.y = p.face;
        setCharacterShadow(p.model, far < 60);
        if (far < 90) animateCharacter(p.model, t, dt, p.speed, pose);
      }
      for (const p of gone) remove(p);
      if (refill.length && (refillT -= dt) <= 0) {
        refillT = 4;
        // a block well away from the player, so nobody pops in on screen
        for (let i = 0; i < 8; i++) {
          const cx = 27 + PITCH * choose(WORLD.blocksIdx), cz = 27 + PITCH * choose(WORLD.blocksIdx);
          if (Math.hypot(cx - cam.x, cz - cam.z) < 95) continue;
          const r = refill.shift(), np = add(r.cop ? choose(COPS) : choose(CIVILIANS), cx, cz, r.cop); np.s = Math.random() * 150; break;
        }
      }
    },
  };
  return peds;
}
