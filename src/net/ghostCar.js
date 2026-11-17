// A car that another player owns, as it appears on this screen. Its owner's game drives it; here it is
// moved along the path they report and everything else about it (the model, wheels, lights, smoke, tyre marks,
// engine sound, the radar blip) comes from Vehicle unchanged. Our own cars still crash into it: to physics it
// is a solid thing that moves by itself.
import { Vehicle } from '../vehicles/vehicle.js';
import { angleDiff } from '../core/utils.js';

// what the owner packs into one number
export const FLAG = { driven: 1, braking: 2, sliding: 4, siren: 8, wrecked: 16, air: 32, flying: 64, up: 128, handbrake: 256 };
const r2 = (n) => Math.round(n * 100) / 100, r1 = (n) => Math.round(n * 10) / 10;
const DRIVER = { remote: true };        // stands in `driver` while its player is at the wheel

// One of our own cars, as told to the others.
export function packCar(v) {
  let f = 0;
  if (v.driver) f |= FLAG.driven; if (v.braking) f |= FLAG.braking; if (v.sliding) f |= FLAG.sliding; if (v.siren) f |= FLAG.siren;
  if (v.wrecked) f |= FLAG.wrecked; if (v.air > 0) f |= FLAG.air; if (v.flying) f |= FLAG.flying; if (v.up) f |= FLAG.up; if (v.controls.handbrake) f |= FLAG.handbrake;
  const s = { id: v.netId, ty: v.type, col: v.color, x: r2(v.x), z: r2(v.z), h: r2(v.h), y: r2(v.y), vx: r1(v.vx), vz: r1(v.vz), vf: r1(v.vf), se: r2(v.steer), th: r1(v.controls.throttle), f, hp: Math.round(v.health) };
  if (v.sid !== undefined) s.sid = v.sid;
  if (v.air > 0) s.vy = r1(v.vy || 0);
  return s;
}

export class GhostVehicle extends Vehicle {
  constructor(game, s, owner) {
    super(game, s.ty, s.x, s.z, s.h, s.col);
    this.ghost = true; this.netId = s.id; this.owner = owner; this.sid = s.sid; this.temp = true;
    this.body.setBodyType(game.physics.RAPIER.RigidBodyType.KinematicPositionBased, true);
    this.y = s.y; this.rideReady = false;
    this.buf = []; this.to = { x: s.x, z: s.z, h: s.h }; this._to = { x: s.x, y: s.z };
    this.mode = -1; this.netY = s.y; this.netVy = 0; this.netAir = false;
    this.take(s, 0);
  }

  // The owner's newest word about this car. at: when it happened, on our clock.
  take(s, at) {
    const b = this.buf, last = b[b.length - 1];
    if (last && at <= last.at) b.length = 0;                 // their clock restarted
    b.push({ at, x: s.x, z: s.z, h: s.h, y: s.y }); if (b.length > 12) b.shift();
    const f = s.f;
    this.driver = f & FLAG.driven ? DRIVER : null;
    this.braking = !!(f & FLAG.braking); this.sliding = !!(f & FLAG.sliding); this.siren = !!(f & FLAG.siren);
    this.controls.throttle = s.th; this.controls.handbrake = !!(f & FLAG.handbrake); this.steer = s.se; this.vf = s.vf; this.vx = s.vx; this.vz = s.vz;
    this.health = s.hp; this.wrecked = !!(f & FLAG.wrecked);
    this.netAir = !!(f & FLAG.air); this.netY = s.y; this.netVy = s.vy || 0;
    const mode = f & FLAG.flying ? 1 : f & FLAG.up ? 2 : 0;
    if (mode !== this.mode) { this.mode = mode; this.flying = mode === 1; this.up = mode === 2; this.game.physics.setCarMode(this.body, mode); }
  }

  // Where the car is at time T on our clock: between the two reports either side of it, or a little past the last one.
  aim(T) {
    const b = this.buf; while (b.length > 2 && b[1].at <= T) b.shift();
    const a = b[0], c = b[1] || a, span = c.at - a.at;
    let k = span > 1e-4 ? (T - a.at) / span : 1;
    k = Math.max(0, Math.min(k, 1 + (span > 1e-4 ? .25 / span : 0)));           // run on for a quarter second at most when reports are late
    if (Math.abs(c.x - a.x) + Math.abs(c.z - a.z) > 30) k = k < 1 ? 0 : 1;       // put somewhere new (a respawn): no sliding across town
    this.to.x = a.x + (c.x - a.x) * k; this.to.z = a.z + (c.z - a.z) * k; this.to.h = a.h + angleDiff(c.h, a.h) * k; this.to.y = a.y + (c.y - a.y) * Math.min(k, 1);
  }

  preStep() {
    this.px = this.x; this.pz = this.z; this.ph = this.h;
    this._to.x = this.to.x; this._to.y = this.to.z;
    this.body.setNextKinematicTranslation(this._to); this.body.setNextKinematicRotation(this.to.h);
  }

  postStep() {
    const p = this.body.translation();
    this.x = p.x; this.z = p.y; this.h = this.body.rotation(); this.speed = Math.hypot(this.vx, this.vz); this.impact = 0; this.idleTime = 0;
    this.omega = angleDiff(this.h, this.ph) * 60;                // how fast it is turning, for the body roll
    if (Math.abs(this.x - this.px) + Math.abs(this.z - this.pz) > 4) { this.px = this.x; this.pz = this.z; this.ph = this.h; }
  }

  // Shot or rammed here: its owner's game keeps the score.
  damage(d) { if (!this.wrecked && d > 0) this.game.net.carHit(this, d); }

  syncVisual(dt, t) {
    // in the air it is wherever its owner says; on the ground it sits on our own land, on the level they are on
    if (this.netAir) { this.air = 1; this.y = this.rideReady ? this.to.y ?? this.netY : this.netY; this.vy = this.netVy; }
    else { if (this.air) this.air = 0; if (Math.abs(this.y - this.netY) > 1.5) this.y = this.netY; }
    super.syncVisual(dt, t);
  }
}
