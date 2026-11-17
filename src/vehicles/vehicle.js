// One drivable car: arcade handling on top of a Rapier body.
// Anyone can drive it by writing to `controls` (the player, traffic AI or a cop).
import { CAR, FX } from '../config.js';
import { clamp, lerp, damp, angleDiff } from '../core/utils.js';
import { groundY } from '../world/city.js';
import { makeCarModel } from './carModel.js';

const GEARS = [0, 9, 17, 25, 32, 42];

export class Vehicle {
  constructor(game, type, x, z, heading) {
    this.game = game; this.type = type; this.stats = CAR.types[type];
    this.isVehicle = true;
    this.mesh = makeCarModel(type); game.scene.add(this.mesh);
    // Every handling number is read through `tune`: the shared CAR numbers, with this type's own on top.
    this.tune = { ...CAR, ...CAR.types[type] }; this.halfLen = this.tune.halfLen; this.halfWid = this.tune.halfWid;
    this.body = game.physics.addCar(this, x, z, heading, this.halfLen, this.halfWid, this.stats.mass);
    this.controls = { throttle: 0, steer: 0, handbrake: false };
    this.driver = null;            // null | 'player' | AI driver object
    this.health = this.stats.health; this.wrecked = false;
    this.x = x; this.z = z; this.h = heading; this.vx = 0; this.vz = 0;
    this.vf = 0; this.vl = 0; this.speed = 0; this.omega = 0;
    this.steer = 0; this.slip = 0; this.sliding = false; this.braking = false;
    this.loose = 0;                // 0 = rear tyres biting, 1 = sliding on the handbrake
    this.px = x; this.pz = z; this.ph = heading;   // where the car was one physics step ago
    this.ix = x; this.iz = z; this.ih = heading;   // where to draw it this frame (between the two steps)
    this.impact = 0; this.siren = false; this.rpm = 0;
    this.roll = 0; this.pitch = 0; this.y = groundY(x, z); this.accelLong = 0;
    this.smokeT = 0; this.skidPrev = [null, null]; this.spin = 0; this.idleTime = 0;
    this._set = { x: 0, y: 0 };
    this.wheelSlot = -1; this.wheelKind = null; this.wheelsDirty = true;      // slot taken in pushWheels, in the batch for this model's wheels
    this.syncVisual(0, 0);
  }

  get fx() { return Math.cos(this.h); } get fz() { return Math.sin(this.h); }   // forward
  get rx() { return -Math.sin(this.h); } get rz() { return Math.cos(this.h); }  // right

  // --- before the physics step: turn controls into velocities ---
  preStep(dt) {
    const b = this.body;
    this.px = this.x; this.pz = this.z; this.ph = this.h;
    if (!this.driver && b.isSleeping()) { this.speed = this.vf = this.vl = 0; this.sliding = false; this.loose = 0; return; }
    if (this.game.ride?.preStep(this, dt)) return;      // terrain: slopes and flight (world/ride.js)
    const v = b.linvel(); this.h = b.rotation();
    const fx = this.fx, fz = this.fz, rx = this.rx, rz = this.rz, S = this.stats, H = this.tune;
    let vf = v.x * fx + v.y * fz, vl = v.x * rx + v.y * rz, w = b.angvel();
    const driven = this.driver && !this.wrecked;
    const c = this.controls, thr = driven ? clamp(c.throttle, -1, 1) : 0, hb = driven ? c.handbrake : true;
    const dmg = this.health < 30 ? .8 : 1;

    // forward / back
    let a = 0; this.braking = false;
    if (thr > 0) { if (vf > -.5) { const x = vf / (S.maxSpeed * dmg); a = S.accel * thr * Math.max(0, 1 - x * x) * (vf < 8 ? 1.25 : 1); } else { a = H.brake * thr; this.braking = true; } }
    else if (thr < 0) { if (vf > 1) { a = H.brake * thr; this.braking = true; } else a = H.reverseAccel * thr * Math.max(0, 1 + vf / H.maxReverse); }
    const before = vf;
    vf += a * dt;
    let resist = H.drag * vf * Math.abs(vf) + (thr === 0 ? H.engineBrake * Math.sign(vf) : 0);
    if (hb) { resist += H.handbrakeDecel * Math.sign(vf); this.braking = true; }
    if (!driven) resist += 3 * Math.sign(vf);
    const nv = vf - resist * dt; vf = (Math.sign(nv) !== Math.sign(vf) && thr === 0) ? 0 : nv;
    if (this.braking && before * vf < 0) vf = 0;

    // The rear tyres only let go on the handbrake, and bite again over a moment instead of snapping.
    const drifting = hb && driven && Math.abs(vf) > H.driftMinSpeed;
    this.loose = drifting ? Math.min(1, this.loose + H.looseIn * dt) : Math.max(0, this.loose - H.looseOut * dt);
    const grip = driven ? lerp(H.grip, H.gripHandbrake, this.loose) : H.gripHandbrake * .7;

    // sideways: tyres cancel the slide, up to their grip limit
    const vl0 = vl, got = clamp(-vl / dt, -grip, grip);
    vl += got * dt;
    // ...and what they cancel pushes the car forward again, so coming out of a drift keeps its speed
    if (driven && !hb) vf = Math.sign(vf || 1) * Math.sqrt(vf * vf + H.slideKeep * (thr > 0 ? 1 : .5) * clamp((Math.abs(vf) - 3) / 6, 0, 1) * Math.max(0, vl0 * vl0 - vl * vl));
    this.slip = Math.abs(vl);
    const burnout = driven && thr > .9 && Math.abs(vf) < 7 && Math.abs(before) < 6;
    this.sliding = this.slip > 2.2 || drifting || burnout;
    if (this.slip > 1) vf -= vf * Math.min(.5, this.slip * .012) * dt;       // sliding scrubs a little speed

    // steering wheel: moves at a steady rate, a touch slower at speed so a tap is a lane change, not a lurch
    const av = Math.abs(vf), sp = clamp(av / S.maxSpeed, 0, 1);
    const target = driven ? clamp(c.steer, -1, 1) : 0;
    const rate = target === 0 ? H.steerOut : target * this.steer < 0 ? H.steerFlip : lerp(H.steerIn, H.steerInFast, sp);
    this.steer += clamp(target - this.steer, -rate * dt, rate * dt);
    // Full lock asks for the tightest turn the tyres can hold at this speed and no more, so the car goes
    // where it is pointed. On the handbrake the tail is free to swing round faster than that.
    const most = lerp(H.gripUse * H.grip / Math.max(av, 1), H.driftYaw, this.loose);
    let wT = this.steer * clamp(vf * Math.tan(H.steerLock) / H.wheelbase, -most, most);
    if (this.loose > 0 && wT * vl < 0) {       // swinging deeper into the slide: ease off before it becomes a spin
      const ang = Math.atan2(this.slip, av);
      wT *= lerp(1, clamp(1 - (ang - H.driftAngle) / .35, .12, 1), this.loose);
    }
    if (driven) w = damp(w, wT, lerp(H.yawGrip, H.yawSlide, this.loose), dt);
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
    if (Math.abs(this.x - this.px) + Math.abs(this.z - this.pz) > 4) { this.px = this.x; this.pz = this.z; this.ph = this.h; }   // moved by hand, not driven
    if (this.impact > this.tune.damageMin) {
      this.damage((this.impact - this.tune.damageMin) * this.tune.damageScale * (this.driver === 'player' ? .75 : 1) * (this.soak ?? 1));      // soak: set for one step by a ram that is meant to hurt the other car more (missions/outlaws.js)
      this.game.onCrash(this, this.impact);
    }
    this.soak = 1;
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
    // Physics runs at a fixed 60 steps a second; draw the car between the last two steps so it
    // moves smoothly at any frame rate.
    const k = dt ? g.alpha ?? 1 : 1;
    const x = this.ix = lerp(this.px, this.x, k), z = this.iz = lerp(this.pz, this.z, k), h = this.ih = this.ph + angleDiff(this.h, this.ph) * k;
    let curb;
    if (g.ride) curb = g.ride.place(this, dt);          // terrain: sits the car on slopes and flies it (world/ride.js)
    else {
      const cx = Math.cos(h) * 1.4, cz = Math.sin(h) * 1.4, yf = groundY(x + cx, z + cz), yr = groundY(x - cx, z - cz);
      this.y = dt ? damp(this.y, (yf + yr) / 2, 18, dt) : (yf + yr) / 2;
      m.position.set(x, this.y, z); m.rotation.y = -h;
      curb = Math.atan2(yf - yr, 2.8);
    }
    if (!dt) { this.pushWheels(); return; }
    const lean = this.tune.lean ?? 1, leanMax = this.tune.leanMax ?? .085;      // cars roll out of a turn; bikes (negative lean) tip into it
    this.roll = damp(this.roll, clamp(-this.vf * this.omega * .0042 * lean, -leanMax, leanMax), 8, dt);
    this.pitch = damp(this.pitch, clamp(this.accelLong * .0035, -.06, .05) + curb, 9, dt);
    u.chassis.rotation.x = this.roll; u.chassis.rotation.z = this.pitch;
    u.chassis.position.y = (lean < 0 ? 0 : Math.abs(this.roll) * .5) + (this.driver && !this.wrecked ? Math.sin(t * 38 + this.x) * .004 : 0);
    this.spin -= this.vf * dt / (u.wheelR || .4);
    const burn = this.driver && this.controls.throttle > .9 && Math.abs(this.vf) < 7;
    for (const w of u.wheels) {
      w.spin.rotation.z = w.front || !burn ? this.spin : this.spin * 3;
      if (w.front) w.steer.rotation.y = -this.steer * lerp(.55, .2, Math.min(1, Math.abs(this.vf) / 30));
    }
    if (this.driver || this.speed > .02 || this.wheelsDirty || this.wheelKind !== u.wheelKind) this.pushWheels();
    u.tail.emissiveIntensity = g.env.tailBase * (this.braking && this.driver ? 5 : 1);
    if (u.bar) { const on = this.siren ? Math.floor(t * 7) % 2 : -1; u.bar[0].material.emissiveIntensity = on === 1 ? 5 : 0; u.bar[1].material.emissiveIntensity = on === 0 ? 5 : 0; }

    // tyre marks and smoke
    const fxs = g.fx;
    if (this.sliding && this.speed > 1.5 || (burn && this.sliding)) {
      for (let i = 0; i < u.rear.length; i++) {
        const rw = u.rear[i], ch = Math.cos(this.ih), sh = Math.sin(this.ih), wx = this.ix + ch * rw.x - sh * rw.z, wz = this.iz + sh * rw.x + ch * rw.z;
        const prev = this.skidPrev[i];
        if (prev) { if (Math.hypot(wx - prev.x, wz - prev.z) > .45) { fxs.skid(prev.x, prev.z, wx, wz, groundY(wx, wz)); prev.x = wx; prev.z = wz; } }
        else this.skidPrev[i] = { x: wx, z: wz };
        if (Math.random() < dt * 14) fxs.smoke(wx, this.y + .2, wz, .7, .85, .5);
      }
    } else this.skidPrev[0] = this.skidPrev[1] = null;
    // damage smoke from the bonnet: thin grey wisps at first, thicker and blacker as the engine dies.
    // A wreck burns for a while under a tall black column, then just smoulders.
    if (this.health < this.stats.health * FX.smokeAt && (this.smokeT -= dt) <= 0) {
      const bad = clamp(1 - this.health / (this.stats.health * FX.smokeAt), 0, 1), nose = this.halfLen * .74;
      const hx = this.ix + Math.cos(this.ih) * nose, hz = this.iz + Math.sin(this.ih) * nose, hy = this.y + 1;
      if (this.wrecked) {
        this.burn ??= 18 + Math.random() * 14; this.burn -= .085; this.smokeT = .085;
        const lit = this.burn > 0;
        fxs.smoke(hx, hy + .2, hz, lit ? .04 : .2, FX.wreckSize * (lit ? 1 : .7), FX.wreckLife * (lit ? 1 : .7), this.vx * .5, this.vz * .5, { rise: lit ? 2.4 : 1.5, grow: 1.5, floor: hy - .25, alpha: lit ? .9 : .6 });
        if (lit && FX.flames) {
          const w = this.halfWid * .7;
          for (let i = 0; i < 2; i++) { const o = (Math.random() - .5) * 2 * w; fxs.fire(hx - Math.sin(this.ih) * o, hy - .05, hz + Math.cos(this.ih) * o, .75, this.vx * .5, this.vz * .5); }
          if (Math.random() < .25) fxs.spark(hx, hy + .15, hz, 1, .5);
        }
      } else {
        this.smokeT = lerp(.15, .06, bad);
        const thin = 1 - .45 * Math.min(1, this.speed / 30);      // at speed it streams out behind and thins
        fxs.smoke(hx, hy, hz, lerp(.92, .13, Math.pow(bad, 1.4)), .5 + bad * .6, 1.2 + bad * 1.3, this.vx * .5, this.vz * .5, { alpha: (.38 + bad * .36) * thin, floor: hy - .25 });
      }
    }
    // fake gearbox for the engine note
    const s = Math.abs(this.vf); let gi = 1; while (gi < 5 && s > GEARS[gi]) gi++; this.gear = gi;
    this.rpm = damp(this.rpm, clamp(.22 + .78 * (s - GEARS[gi - 1]) / (GEARS[gi] - GEARS[gi - 1]), 0, 1) * (burn ? 1.3 : 1), 12, dt);
  }

  // Copy the wheel positions into the shared wheel batch.
  pushWheels() {
    const u = this.mesh.userData, w = this.game.wheels;
    if (this.wheelKind !== u.wheelKind) {          // first time, or the stand-in just became the real model
      w.release(this.wheelSlot); this.wheelKind = u.wheelKind; this.wheelSlot = w.alloc(u.wheelKind);
    }
    if (this.wheelSlot < 0) return;
    const ws = u.wheels; this.mesh.updateMatrixWorld(true);
    for (let i = 0; i < ws.length; i++) this.game.wheels.set(this.wheelSlot + i, ws[i].spin.matrixWorld);     // bikes use two of their four slots
    this.wheelsDirty = this.speed > .02;
  }

  // Signed position of a world point in the car's own frame (x forward, z right).
  local(px, pz) { const dx = px - this.x, dz = pz - this.z; return [dx * this.fx + dz * this.fz, dx * this.rx + dz * this.rz]; }
  // Distance from a point to the car's body outline.
  distanceTo(px, pz) { const [lx, lz] = this.local(px, pz); return Math.hypot(Math.max(0, Math.abs(lx) - this.halfLen), Math.max(0, Math.abs(lz) - this.halfWid)); }

  teleport(x, z, h) {
    this.body.setTranslation({ x, y: z }, true); this.body.setRotation(h, true); this.body.setLinvel({ x: 0, y: 0 }, true); this.body.setAngvel(0, true);
    this.x = this.px = x; this.z = this.pz = z; this.h = this.ph = h; this.loose = 0; this.syncVisual(0, 0);
  }
  // A rider you can see (motorbikes): the character sits on the seat and leans with the bike.
  seat(model) {
    const s = this.mesh.userData.seat; if (!s) return false;
    this.dropRider(); this.rider = model; this.mesh.userData.chassis.add(model);
    model.position.set(s.x, s.y, s.z); model.rotation.set(0, Math.PI / 2, 0); model.visible = true;
    const u = model.userData; u.lie = 0; u.body.position.set(0, 0, 0); u.body.rotation.set(.3, 0, 0);
    u.legs.forEach((l, i) => l.rotation.set(-.95, 0, i ? .28 : -.28)); u.arms.forEach(a => { a.rotation.x = -1.2; });
    return true;
  }
  // Take the rider off and stand them up straight again. The caller decides where the model goes next.
  unseat() {
    const m = this.rider; if (!m) return null;
    this.rider = null; m.removeFromParent(); m.rotation.set(0, 0, 0);
    const u = m.userData; u.body.rotation.set(0, 0, 0); u.legs.forEach(l => l.rotation.set(0, 0, 0)); u.arms.forEach(a => { a.rotation.x = 0; });
    return m;
  }
  // The rider is gone for good (thrown off as a pedestrian, or the bike was cleared away). Never the player's own model.
  dropRider() { const m = this.rider; if (!m || m === this.game.player.model) return; this.unseat(); m.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); }

  dispose() { this.game.damage?.release(this); this.dropRider(); this.game.wheels.release(this.wheelSlot); this.wheelSlot = -1; this.game.scene.remove(this.mesh); this.game.physics.remove(this.body); this.gone = true; }
}
