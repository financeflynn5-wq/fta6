// A computer driver. Two jobs:
//   cruise  - follow the road grid in the right-hand lane, obey lights, queue behind cars
//   pursue  - chase a target point through the streets (used by police.js)
import { WORLD, TRAFFIC } from '../config.js';
import { clamp, angleDiff } from '../core/utils.js';
import { lightState } from '../world/city.js';

const N = WORLD.nodes, LAST = N.length - 1, SPAN = WORLD.PITCH, LANE = WORLD.LANE, BOX = 7;

export const nearestNodeIndex = (v) => clamp(Math.round((v - N[0]) / SPAN), 0, LAST);

function pickNext(from, to) {
  const di = to.i - from.i, dj = to.j - from.j;
  const ok = (i, j) => i >= 0 && i <= LAST && j >= 0 && j <= LAST;
  const straight = { i: to.i + di, j: to.j + dj }, right = { i: to.i - dj, j: to.j + di }, left = { i: to.i + dj, j: to.j - di };
  const s = ok(straight.i, straight.j), r = ok(right.i, right.j), l = ok(left.i, left.j);
  if (s && r) return Math.random() < .68 ? straight : right;
  if (s) return (l && Math.random() < .2) ? left : straight;
  if (r) return right;
  if (l) return left;
  return from;
}

export class AIDriver {
  constructor(game, vehicle, from, to) {
    this.game = game; this.v = vehicle; vehicle.driver = this;
    this.mode = 'cruise'; this.from = from; this.to = to; this.next = pickNext(from, to);
    this.turning = false; this.stuck = 0; this.reverse = 0; this.scared = 0; this.honk = 0; this.blockedFor = 0;
    this.kind = vehicle.type === 'taxi' ? 'tess' : null;       // who gets thrown out when the car is stolen
    // pursue settings, written by police.js
    this.target = { x: 0, z: 0 }; this.ram = false; this.maxSpeed = 30; this.hold = false; this.replan = 0; this.aim = { x: 0, z: 0 }; this.nudge = 0; this.slide = false;
  }

  update(dt, t) {
    const v = this.v, c = v.controls;
    if (v.wrecked) { c.throttle = 0; c.steer = 0; c.handbrake = true; return; }
    if (this.mode === 'wait') { c.throttle = 0; c.steer = 0; c.handbrake = true; return; }   // officer is out on foot
    if (v.impact > 5 && this.mode === 'cruise') this.scared = 7;
    this.scared -= dt;
    let aimX, aimZ, want;
    if (this.mode === 'cruise') [aimX, aimZ, want] = this.cruise(dt, t);
    else[aimX, aimZ, want] = this.pursue(dt);

    // reversing out when stuck against something
    if (this.reverse > 0) {
      this.reverse -= dt; c.throttle = -1; c.handbrake = false;
      c.steer = -clamp(angleDiff(Math.atan2(aimZ - v.z, aimX - v.x), v.h) * 2, -1, 1); return;
    }
    if (want > 2 && v.speed < .7) { this.stuck += dt; if (this.stuck > (this.mode === 'pursue' ? 1.1 : 2.5)) { this.stuck = 0; this.reverse = 1.1 + Math.random() * .6; } } else this.stuck = Math.max(0, this.stuck - dt);

    const err = angleDiff(Math.atan2(aimZ - v.z, aimX - v.x), v.h);
    c.steer = clamp(err * 2.4 + (this.nudge || 0), -1, 1);
    const dv = want - v.vf;
    c.throttle = clamp(dv * (dv > 0 ? .5 : .35), -1, 1);
    c.handbrake = (want < .3 && v.speed < 1.2) || (this.mode === 'pursue' && this.slide);
    if (c.handbrake && !this.slide) c.throttle = 0;
  }

  // ---------- cruising ----------
  cruise(dt, t) {
    const v = this.v, g = this.game;
    let A = this.from, B = this.to;
    let ax = N[A.i], az = N[A.j], bx = N[B.i], bz = N[B.j];
    let dx = Math.sign(bx - ax), dz = Math.sign(bz - az), rx = -dz, rz = dx;
    let s = (v.x - ax) * dx + (v.z - az) * dz;
    const C = this.next, d2x = Math.sign(N[C.i] - bx), d2z = Math.sign(N[C.j] - bz), r2x = -d2z, r2z = d2x;
    const turn = d2x !== dx || d2z !== dz;
    const exitX = bx + d2x * (BOX + 2) + r2x * LANE, exitZ = bz + d2z * (BOX + 2) + r2z * LANE;

    // reached the end of this stretch -> move on to the next one
    const pastTurn = turn && this.turning && ((v.x - bx) * d2x + (v.z - bz) * d2z > 3.5);
    if ((!turn && s > SPAN - 1) || pastTurn) {
      this.from = B; this.to = C; this.next = pickNext(B, C); this.turning = false;
      return this.cruise(0, t);
    }
    let want = this.scared > 0 ? 19 : TRAFFIC.cruise, aimX, aimZ;
    const look = 5 + v.speed * .6;
    if (turn && s > SPAN - BOX - 2.5) this.turning = true;
    if (turn && this.turning) { aimX = exitX; aimZ = exitZ; want = Math.min(want, 5.2); }
    else {
      const u = turn ? Math.min(s + look, SPAN - BOX + 1) : s + look;
      aimX = ax + dx * u + rx * LANE; aimZ = az + dz * u + rz * LANE;
      if (turn) want = Math.min(want, 5 + Math.max(0, SPAN - BOX - s) * .4);
    }
    // red lights (every crossing runs on the same cycle, signposted or not)
    if (this.scared <= 0) {
      const st = lightState(dx ? 'x' : 'z', t), dStop = SPAN - 9.6 - s;
      if (dStop > -.5 && dStop < 30 && st !== 'g' && !(st === 'y' && dStop < 4)) want = Math.min(want, Math.sqrt(12 * Math.max(0, dStop - .3)));
    }
    // things ahead: queue behind them
    let gap = 99, who = null;
    for (const o of g.traffic.vehicles) {
      if (o === v) continue;
      const ddx = o.x - v.x, ddz = o.z - v.z; if (Math.abs(ddx) > 26 || Math.abs(ddz) > 26) continue;
      const lx = ddx * v.fx + ddz * v.fz, lz = ddx * v.rx + ddz * v.rz;
      if (lx > 0 && Math.abs(lz) < 1.9 && lx - 4.8 < gap) { gap = lx - 4.8; who = o; }
    }
    const p = g.player;
    if (p.mode === 'foot') { const [lx, lz] = v.local(p.x, p.z); if (lx > 0 && lx < 20 && Math.abs(lz) < 1.5 && lx - 3 < gap) { gap = lx - 3; who = p; } }
    if (this.scared <= 0 || who === p) want = Math.min(want, Math.sqrt(12 * Math.max(0, gap - 1.6)));
    if (gap < 3 && v.speed < .5) {
      this.blockedFor += dt;
      if ((who === p || who?.driver === 'player') && (this.honk -= dt) <= 0) { this.honk = 2.2 + Math.random() * 2; g.honk(v); }
      if (this.blockedFor > 9) { this.blockedFor = 0; this.reverse = 1.2; }   // jammed: back up and try again
    } else this.blockedFor = 0;
    this.nudge = 0;
    return [aimX, aimZ, want];
  }

  // ---------- pursuing ----------
  pursue(dt) {
    const v = this.v, g = this.game, ph = g.physics, T = this.target;
    const dist = Math.hypot(T.x - v.x, T.z - v.z);
    if ((this.replan -= dt) <= 0) {
      this.replan = .25;
      if (dist < 9 || ph.canDrive(v.x, v.z, T.x, T.z)) { this.aim.x = T.x; this.aim.z = T.z; this.direct = true; }
      else {
        // go via the street corner that is visible from here and closest to the target by road
        this.direct = false; let best = 1e9;
        const ci = nearestNodeIndex(v.x), cj = nearestNodeIndex(v.z);
        for (let i = Math.max(0, ci - 2); i <= Math.min(LAST, ci + 2); i++) for (let j = Math.max(0, cj - 2); j <= Math.min(LAST, cj + 2); j++) {
          const nx = N[i], nz = N[j], dn = Math.hypot(nx - v.x, nz - v.z);
          if (dn < 12) continue;
          const cost = dn + Math.abs(nx - T.x) + Math.abs(nz - T.z);
          if (cost < best && ph.canDrive(v.x, v.z, nx, nz)) { best = cost; this.aim.x = nx; this.aim.z = nz; }
        }
        if (best === 1e9) { this.aim.x = N[ci]; this.aim.z = N[cj]; }
      }
    }
    let want = this.maxSpeed;
    const aimDist = Math.hypot(this.aim.x - v.x, this.aim.z - v.z);
    const err = Math.abs(angleDiff(Math.atan2(this.aim.z - v.z, this.aim.x - v.x), v.h));
    if (!this.direct) want = Math.min(want, 8.5 + aimDist * .5);           // slow into corners
    want = Math.min(want, 7 + this.maxSpeed * Math.pow(Math.max(0, 1 - err / .9), 1.5));
    if (this.hold) want = dist < 7 ? 0 : Math.min(want, 4 + (dist - 7) * 1.1);   // pull up next to the target
    else if (!this.ram && this.direct) want = Math.min(want, g.player.speed + 3 + Math.max(0, dist - 9) * 1.4);

    // feel ahead along both sides of the car for walls, trees and posts, and lean away
    const reach = 7 + v.speed * .55, fx = v.fx, fz = v.fz, rx = v.rx, rz = v.rz;
    const lf = ph.probeSolid(v.x - rx * 1.05, v.z - rz * 1.05, Math.cos(v.h - .1), Math.sin(v.h - .1), reach);
    const rt = ph.probeSolid(v.x + rx * 1.05, v.z + rz * 1.05, Math.cos(v.h + .1), Math.sin(v.h + .1), reach);
    const mid = ph.probeSolid(v.x, v.z, fx, fz, reach);
    this.nudge = 0;
    if (lf < reach || rt < reach || mid < reach) {
      const near = Math.min(lf, rt, mid);
      // dead ahead: keep dodging to whichever side we already picked
      if (mid <= lf && mid <= rt && lf === rt) this.dodge = this.dodge || (Math.random() < .5 ? 1 : -1); else this.dodge = lf < rt ? 1 : -1;
      this.nudge = this.dodge * clamp(1.9 * (1 - near / reach) + .35, 0, 1.6);
      if (near < 5 + v.speed * .25) want = Math.min(want, 6 + near * 1.5);
    }
    // steer around other cars (parked, traffic, fellow officers); the one we're ramming is fair game
    const pv = g.player.vehicle, range = 6 + v.speed * .6;
    for (const o of g.traffic.vehicles) {
      if (o === v || (o === pv && (this.ram || this.hold))) continue;
      const ddx = o.x - v.x, ddz = o.z - v.z; if (Math.abs(ddx) > 40 || Math.abs(ddz) > 40) continue;
      const lx = ddx * fx + ddz * fz, lz = ddx * rx + ddz * rz;
      if (lx > -1 && lx < range && Math.abs(lz) < 2.5) {
        this.nudge += (lz > 0 ? -1 : 1) * (1 - Math.max(0, lx) / range) * 1.7;
        if (lx < 8 && Math.abs(lz) < 1.6) want = Math.min(want, Math.max(4, o.speed + 2));
      }
    }
    this.nudge = clamp(this.nudge, -1.8, 1.8);
    this.slide = !this.hold && err > .95 && v.speed > 9;      // handbrake into tight turns
    return [this.aim.x, this.aim.z, want];
  }

  // Put the car back into normal traffic from wherever it is.
  resumeCruise() {
    const v = this.v, i = nearestNodeIndex(v.x), j = nearestNodeIndex(v.z);
    // head for the nearest corner, then carry on in the direction we're facing
    const fx = Math.abs(v.fx) > Math.abs(v.fz) ? Math.sign(v.fx) : 0, fz = fx ? 0 : Math.sign(v.fz);
    const to = { i, j }, from = { i: clamp(i - fx, 0, LAST), j: clamp(j - fz, 0, LAST) };
    if (from.i === to.i && from.j === to.j) { from.i = clamp(i + fx, 0, LAST); from.j = clamp(j + fz, 0, LAST); }
    this.from = from; this.to = to; this.next = pickNext(from, to); this.turning = false; this.mode = 'cruise';
  }
}
