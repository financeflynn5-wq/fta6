// One drivable car: arcade handling on top of a Rapier body.
// Anyone can drive it by writing to `controls` (the player, traffic AI or a cop).
import { CAR } from '../config.js';
import { clamp, lerp, damp } from '../core/utils.js';
import { groundY } from '../world/city.js';
import { makeCarModel } from './carModel.js';

const GEARS = [0, 9, 17, 25, 32, 42];

export class Vehicle {
  constructor(game, type, x, z, heading) {
    this.game = game; this.type = type; this.stats = CAR.types[type];
    this.isVehicle = true;
    this.mesh = makeCarModel(type); game.scene.add(this.mesh);
    this.body = game.physics.addCar(this, x, z, heading, CAR.halfLen, CAR.halfWid, this.stats.mass);
    this.controls = { throttle: 0, steer: 0, handbrake: false };
    this.driver = null;            // null | 'player' | AI driver object
    this.health = this.stats.health; this.wrecked = false;
    this.x = x; this.z = z; this.h = heading; this.vx = 0; this.vz = 0;
    this.vf = 0; this.vl = 0; this.speed = 0; this.omega = 0;
    this.steer = 0; this.slip = 0; this.sliding = false; this.braking = false;
    this.impact = 0; this.siren = false; this.rpm = 0;
    this.roll = 0; this.pitch = 0; this.y = groundY(x, z); this.accelLong = 0;
    this.smokeT = 0; this.skidPrev = [null, null]; this.spin = 0; this.idleTime = 0;
    this._set = { x: 0, y: 0 };
    this.wheelSlot = game.wheels.alloc(); this.wheelsDirty = true;
    this.syncVisual(0, 0);
  }

  get fx() { return Math.cos(this.h); } get fz() { return Math.sin(this.h); }   // forward
  get rx() { return -Math.sin(this.h); } get rz() { return Math.cos(this.h); }  // right

  // --- before the physics step: turn controls into velocities ---
  preStep(dt) {
    const b = this.body;
    if (!this.driver && b.isSleeping()) { this.speed = this.vf = this.vl = 0; this.sliding = false; return; }
    const v = b.linvel(); this.h = b.rotation();
    const fx = this.fx, fz = this.fz, rx = this.rx, rz = this.rz, S = this.stats;
    let vf = v.x * fx + v.y * fz, vl = v.x * rx + v.y * rz, w = b.angvel();
    const driven = this.driver && !this.wrecked;
    const c = this.controls, thr = driven ? clamp(c.throttle, -1, 1) : 0, hb = driven ? c.handbrake : true;
    const dmg = this.health < 30 ? .8 : 1;

    // forward / back
    let a = 0; this.braking = false;
    if (thr > 0) { if (vf > -.5) { const x = vf / (S.maxSpeed * dmg); a = S.accel * thr * Math.max(0, 1 - x * x) * (vf < 8 ? 1.25 : 1); } else { a = CAR.brake * thr; this.braking = true; } }
    else if (thr < 0) { if (vf > 1) { a = CAR.brake * thr; this.braking = true; } else a = CAR.reverseAccel * thr * Math.max(0, 1 + vf / CAR.maxReverse); }
    const before = vf;
    vf += a * dt;
    let resist = CAR.drag * vf * Math.abs(vf) + (thr === 0 ? CAR.engineBrake * Math.sign(vf) : 0);
    if (hb) { resist += CAR.handbrakeDecel * Math.sign(vf); this.braking = true; }
    if (!driven) resist += 3 * Math.sign(vf);
    const nv = vf - resist * dt; vf = (Math.sign(nv) !== Math.sign(vf) && thr === 0) ? 0 : nv;
    if (this.braking && before * vf < 0) vf = 0;

    // sideways: tyres cancel the slide, up to their grip limit
    const grip = (hb ? CAR.gripHandbrake : CAR.grip) * (driven ? 1 : .7);
    const want = -vl / dt, got = clamp(want, -grip, grip);
    vl += got * dt;
    this.slip = Math.abs(vl);
    const burnout = driven && thr > .9 && Math.abs(vf) < 7 && Math.abs(before) < 6;
    this.sliding = this.slip > 2.4 || (hb && driven && Math.abs(vf) > 5) || burnout;
    if (this.slip > 1) vf -= vf * Math.min(.5, this.slip * .012) * dt;       // sliding scrubs a little speed

    // steering: yaw follows the front wheels, less so while sliding
    const sp = clamp(Math.abs(vf) / S.maxSpeed, 0, 1);
    const target = driven ? clamp(c.steer, -1, 1) : 0;
    this.steer = damp(this.steer, target, Math.abs(target) > Math.abs(this.steer) ? CAR.steerIn : CAR.steerOut, dt);
    const lock = lerp(CAR.steerLow, CAR.steerHigh, Math.pow(sp, .6));
    let wT = vf * Math.tan(this.steer * lock) / CAR.wheelbase;
    if (hb && driven && Math.abs(vf) > 4) wT *= 1.65;
    if (driven) w = damp(w, wT, this.slip > 3 ? CAR.yawSlide : CAR.yawGrip, dt);
    else w *= Math.max(0, 1 - 2.5 * dt);

    this.accelLong = damp(this.accelLong, (vf - before) / dt, 10, dt);
    this.vf = vf; this.vl = vl; this.omega = w;
    this._set.x = fx * vf + rx * vl; this._set.y = fz * vf + rz * vl;
    const moving = driven || Math.abs(vf) > .05 || Math.abs(vl) > .05 || Math.abs(w) > .02;
    if (moving) { b.setLinvel(this._set, true); b.setAngvel(w, true); }
    else { this._set.x = this._set.y = 0; b.setLinvel(this._set, false); b.setAngvel(0, false); }
  }

  // --- after the physics step: read the result, anything unexpected was a crash ---
  postStep(dt) {
    const b = this.body, p = b.translation(), v = b.linvel();
    this.impact = Math.hypot(v.x - this._set.x, v.y - this._set.y);
    if (b.isSleeping()) this.impact = 0;
    this.x = p.x; this.z = p.y; this.h = b.rotation(); this.vx = v.x; this.vz = v.y; this.speed = Math.hypot(v.x, v.y);
    if (this.impact > CAR.damageMin) {
      this.damage((this.impact - CAR.damageMin) * CAR.damageScale * (this.driver === 'player' ? .75 : 1));
      this.game.onCrash(this, this.impact);
    }
    this.idleTime = this.driver ? 0 : this.idleTime + dt;
  }

  damage(d) {
    if (this.wrecked) return;
    this.health -= d;
    if (this.health <= 0) { this.health = 0; this.wrecked = true; this.siren = false; this.game.onWrecked(this); }
  }

  // --- once per rendered frame ---
  syncVisual(dt, t) {
    const m = this.mesh, u = m.userData, g = this.game;
    const yf = groundY(this.x + this.fx * 1.4, this.z + this.fz * 1.4), yr = groundY(this.x - this.fx * 1.4, this.z - this.fz * 1.4);
    this.y = dt ? damp(this.y, (yf + yr) / 2, 18, dt) : (yf + yr) / 2;
    m.position.set(this.x, this.y, this.z); m.rotation.y = -this.h;
    if (!dt) { this.pushWheels(); return; }
    const curb = Math.atan2(yf - yr, 2.8);
    this.roll = damp(this.roll, clamp(-this.vf * this.omega * .0042, -.085, .085), 8, dt);
    this.pitch = damp(this.pitch, clamp(this.accelLong * .0035, -.06, .05) + curb, 9, dt);
    u.chassis.rotation.x = this.roll; u.chassis.rotation.z = this.pitch;
    u.chassis.position.y = Math.abs(this.roll) * .5 + (this.driver && !this.wrecked ? Math.sin(t * 38 + this.x) * .004 : 0);
    this.spin -= this.vf * dt / .4;
    const burn = this.driver && this.controls.throttle > .9 && Math.abs(this.vf) < 7;
    for (const w of u.wheels) {
      w.spin.rotation.z = w.front || !burn ? this.spin : this.spin * 3;
      if (w.front) w.steer.rotation.y = -this.steer * .5;
    }
    if (this.driver || this.speed > .02 || this.wheelsDirty) this.pushWheels();
    u.tail.emissiveIntensity = g.env.tailBase * (this.braking && this.driver ? 5 : 1);
    if (u.bar) { const on = this.siren ? Math.floor(t * 7) % 2 : -1; u.bar[0].material.emissiveIntensity = on === 1 ? 5 : 0; u.bar[1].material.emissiveIntensity = on === 0 ? 5 : 0; }

    // tyre marks and smoke
    const fxs = g.fx;
    if (this.sliding && this.speed > 1.5 || (burn && this.sliding)) {
      for (let i = 0; i < 2; i++) {
        const side = i ? .86 : -.86, wx = this.x - this.fx * 1.42 + this.rx * side, wz = this.z - this.fz * 1.42 + this.rz * side;
        const prev = this.skidPrev[i];
        if (prev) { if (Math.hypot(wx - prev.x, wz - prev.z) > .45) { fxs.skid(prev.x, prev.z, wx, wz, groundY(wx, wz)); prev.x = wx; prev.z = wz; } }
        else this.skidPrev[i] = { x: wx, z: wz };
        if (Math.random() < dt * 14) fxs.smoke(wx, this.y + .2, wz, .7, .85, .5);
      }
    } else this.skidPrev[0] = this.skidPrev[1] = null;
    // damage smoke from the hood
    if (this.health < this.stats.health * .45 && (this.smokeT -= dt) <= 0) {
      const bad = 1 - this.health / (this.stats.health * .45);
      this.smokeT = lerp(.16, .04, bad);
      fxs.smoke(this.x + this.fx * 1.7, this.y + 1.05, this.z + this.fz * 1.7, lerp(.6, .12, bad), .9 + bad, 1.1 + bad * .8, this.vx * .5, this.vz * .5);
      if (this.wrecked && Math.random() < .5) fxs.spark(this.x + this.fx * 1.7, this.y + 1.1, this.z + this.fz * 1.7, 1);
    }
    // fake gearbox for the engine note
    const s = Math.abs(this.vf); let gi = 1; while (gi < 5 && s > GEARS[gi]) gi++;
    this.rpm = damp(this.rpm, clamp(.22 + .78 * (s - GEARS[gi - 1]) / (GEARS[gi] - GEARS[gi - 1]), 0, 1) * (burn ? 1.3 : 1), 12, dt);
  }

  // Copy the wheel positions into the shared wheel batch.
  pushWheels() {
    if (this.wheelSlot < 0) return;
    const ws = this.mesh.userData.wheels; this.mesh.updateMatrixWorld(true);
    for (let i = 0; i < 4; i++) this.game.wheels.set(this.wheelSlot + i, ws[i].spin.matrixWorld);
    this.wheelsDirty = this.speed > .02;
  }

  // Signed position of a world point in the car's own frame (x forward, z right).
  local(px, pz) { const dx = px - this.x, dz = pz - this.z; return [dx * this.fx + dz * this.fz, dx * this.rx + dz * this.rz]; }
  // Distance from a point to the car's body outline.
  distanceTo(px, pz) { const [lx, lz] = this.local(px, pz); return Math.hypot(Math.max(0, Math.abs(lx) - CAR.halfLen), Math.max(0, Math.abs(lz) - CAR.halfWid)); }

  teleport(x, z, h) {
    this.body.setTranslation({ x, y: z }, true); this.body.setRotation(h, true); this.body.setLinvel({ x: 0, y: 0 }, true); this.body.setAngvel(0, true);
    this.x = x; this.z = z; this.h = h; this.syncVisual(0, 0);
  }
  dispose() { this.game.wheels.release(this.wheelSlot); this.game.scene.remove(this.mesh); this.game.physics.remove(this.body); this.gone = true; }
}
