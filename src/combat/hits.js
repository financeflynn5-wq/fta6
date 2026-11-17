// What a bullet (or a fist) hits, and what that does: hurting citizens, cops and cars,
// knocking people out, and telling the police about it.
import { rayGround } from '../world/terrain.js';
import { COMBAT, CAR } from '../config.js';

const BODY_R = .42, BODY_H = 2.0, HEAD_Y = 1.45;

export const maxHp = (ped) => ped.model.userData.bot ? COMBAT.hp.bot : ped.cop ? COMBAT.hp.officer : COMBAT.hp.critter;

export function createHits(game) {
  const hit = { t: 0, x: 0, y: 0, z: 0, kind: null, obj: null, head: false };

  // Vertical body cylinder at (cx, cz) from y0 to y1. Returns entry distance along the ray or -1.
  function cylinder(ox, oy, oz, dx, dy, dz, cx, cz, r, y0, y1, tmin, tmax) {
    const px = ox - cx, pz = oz - cz, a = dx * dx + dz * dz; if (a < 1e-6) return -1;
    const b = 2 * (px * dx + pz * dz), c = px * px + pz * pz - r * r, disc = b * b - 4 * a * c; if (disc < 0) return -1;
    const s = Math.sqrt(disc), t1 = (-b - s) / (2 * a), t2 = (-b + s) / (2 * a);
    if (t2 < tmin || t1 > tmax) return -1;
    const ta = Math.max(t1, tmin), ya = oy + dy * ta, yb = oy + dy * t2;
    if (ya >= y0 && ya <= y1) return ta;
    // came in through the top or bottom of the cylinder
    if (ya > y1 && yb <= y1) return (y1 - oy) / dy;
    if (ya < y0 && yb >= y0) return (y0 - oy) / dy;
    return -1;
  }
  // A car as a box on the ground. Returns entry distance or -1.
  function carBox(ox, oy, oz, dx, dy, dz, v, tmin, tmax) {
    const fx = v.fx, fz = v.fz, rx = v.rx, rz = v.rz, px = ox - v.x, pz = oz - v.z;
    const lo = [px * fx + pz * fz, px * rx + pz * rz], ld = [dx * fx + dz * fz, dx * rx + dz * rz], half = [v.halfLen, v.halfWid];
    let t0 = tmin, t1 = tmax;
    for (let i = 0; i < 2; i++) {
      if (Math.abs(ld[i]) < 1e-6) { if (Math.abs(lo[i]) > half[i]) return -1; continue; }
      let a = (-half[i] - lo[i]) / ld[i], b = (half[i] - lo[i]) / ld[i]; if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) return -1;
    }
    const y = oy + dy * t0; return y >= v.y && y <= v.y + 1.55 ? t0 : -1;
  }
  const pose = (p) => p.state === 'air' || p.state === 'down' || p.state === 'ko';

  const hits = {
    // Cast a shot. assist widens bodies a little with distance (aim assist). Returns the shared hit record.
    cast(ox, oy, oz, dx, dy, dz, range, tmin = 0, assist = 0, skipCar = null) {
      let best = range, kind = null, obj = null;
      const consider = (t, k, o) => { if (t >= 0 && t < best) { best = t; kind = k; obj = o; } };
      const body = (p, k, o) => {
        if (Math.abs(p.x - ox) > range + 2 && Math.abs(p.z - oz) > range + 2) return;
        const lying = pose(p), r = (lying ? .75 : BODY_R) + assist * Math.hypot(p.x - ox, p.z - oz);
        consider(cylinder(ox, oy, oz, dx, dy, dz, p.x, p.z, r, p.y, p.y + (lying ? .7 : BODY_H), tmin, best), k, o);
      };
      for (const p of game.peds.list) if (p.state !== 'ko' && p.model.visible) body(p, 'ped', p);
      for (const o of game.police.officers) body(o.ped, 'officer', o);
      for (const v of game.traffic.vehicles) if (v !== skipCar && Math.abs(v.x - ox) < range + 3 && Math.abs(v.z - oz) < range + 3) consider(carBox(ox, oy, oz, dx, dy, dz, v, tmin, best), 'car', v);
      // buildings, posts and trees
      const h = Math.hypot(dx, dz);
      if (h > 1e-4) { const free = game.physics.probeSolid(ox, oz, dx / h, dz / h, best * h); if (free < best * h) { best = free / h; kind = 'wall'; obj = null; } }
      { const tg = rayGround(ox, oy, oz, dx, dy, dz, best); if (tg >= 0 && tg < best) { best = tg; kind = 'ground'; obj = null; } }
      hit.t = best; hit.x = ox + dx * best; hit.y = oy + dy * best; hit.z = oz + dz * best; hit.kind = kind; hit.obj = obj;
      hit.head = (kind === 'ped' || kind === 'officer') && !pose(kind === 'ped' ? obj : obj.ped) && hit.y - (kind === 'ped' ? obj.y : obj.ped.y) > HEAD_Y;
      return hit;
    },

    // Deal damage from the player (byPlayer) or a cop. dx, dz: direction the hit travels.
    apply(h, damage, dx, dz, { byPlayer = true, melee = false, knock = 0 } = {}) {
      const { fx, audio, peds, police } = game, p = game.player;
      const near = Math.hypot(h.x - p.x, h.z - p.z) < 60;
      if (h.kind === 'ped') {
        const ped = h.obj, bot = ped.model.userData.bot;
        if (near) { if (bot) { fx.spark(h.x, h.y, h.z, 7, .7); audio.clank(); } else { fx.smoke(h.x, h.y, h.z, .95, .35, .45, dx * 2, dz * 2); audio.oof(); } }
        ped.hp = (ped.hp ?? maxHp(ped)) - damage * (h.head ? COMBAT.headshot : 1);
        const out = ped.hp <= 0;
        if (out) peds.knockOut(ped, dx * (3 + knock * .4), dz * (3 + knock * .4));
        else if (melee) peds.knockDown(ped, dx * knock, dz * knock);
        else ped.panic = 9;
        peds.scare(ped.x, ped.z, 25);
        if (byPlayer) {
          if (ped.cop) report(out ? COMBAT.crime.copKo : COMBAT.crime.copAssault, out ? 'OFFICER DOWN!' : 'ASSAULTED AN OFFICER!');
          else if (out) report(COMBAT.crime.ko, null);
          else if (police.witnessed(ped.x, ped.z)) report(COMBAT.crime.assault, 'ASSAULT!');
          game.combat?.hitMarker(out);
        }
        return out;
      }
      if (h.kind === 'officer') {
        const o = h.obj; if (near) { if (o.ped.model.userData.bot) { fx.spark(h.x, h.y, h.z, 7, .7); audio.clank(); } else { fx.smoke(h.x, h.y, h.z, .95, .35, .45, dx * 2, dz * 2); audio.oof(); } }
        const out = police.hurtOfficer(o, damage * (h.head ? COMBAT.headshot : 1), dx, dz, melee ? knock : 1.5);
        if (byPlayer) { report(out ? COMBAT.crime.copKo : COMBAT.crime.copAssault, out ? 'OFFICER DOWN!' : 'ASSAULTED AN OFFICER!'); game.combat?.hitMarker(out); }
        if (out) game.pickups?.drop(o.ped.x, o.ped.z);
        return out;
      }
      if (h.kind === 'car') {
        const v = h.obj; if (near) { fx.spark(h.x, h.y, h.z, 5, .6); audio.ting(); }
        v.damage(damage * .55);
        if (byPlayer) {
          if (v.type === 'police' && police.owns(v)) report(COMBAT.crime.copAssault, null);
          else if (v.driver && v.driver !== 'player' && police.witnessed(v.x, v.z)) report(COMBAT.crime.carShot, null);
        }
        return false;
      }
      if (h.kind === 'wall') game.places?.shot(h.x, h.y, h.z, dx, dz);      // mall and shop glass breaks
      if (near && (h.kind === 'wall' || h.kind === 'ground')) { fx.spark(h.x, h.y, h.z, 3, .4); fx.smoke(h.x, h.y, h.z, .55, .25, .4); }
      return false;
    },
  };
  function report([heat, stars], label) { game.police.crime(heat, stars, label); }
  return hits;
}
