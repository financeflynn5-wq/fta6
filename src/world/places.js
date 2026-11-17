// What the northern districts do once the game is running:
//   - things a car can smash: the mall's glass, picket and farm fences, the barrier at the base gate.
//     Glass that is `through` is a real wall until something hits it fast enough, then it bursts and you
//     drive on through; shop windows only shatter (the wall behind stops you). Bullets and fists break glass too.
//     Everything is put back once you are far away.
//   - the camera stays under the mall's roof
//   - Fort Pelican is a restricted area: hang around inside the fence and you are wanted
// The pieces themselves are listed by the district builders (K.breakable in world/north.js).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SMASH, BASE } from '../config.js';
import { std, ctex } from './materials.js';
import { clamp } from '../core/utils.js';

const CELL = 16, key = (x, z) => Math.floor(x / CELL) * 4096 + Math.floor(z / CELL);

// one fence panel 2.6 m long, standing on y = 0, centred on x
function panelGeo(kind) {
  const parts = [], bx = (w, h, d, x, y, z = 0) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); parts.push(g); };
  if (kind === 'picket') { bx(2.6, .07, .04, 0, .34, 0); bx(2.6, .07, .04, 0, .78, 0); for (let i = 0; i < 10; i++) bx(.11, 1, .03, -1.17 + i * .26, .5, .03); for (const s of [-1.3, 1.3]) bx(.1, 1.14, .1, s, .57, 0); }
  else { for (const s of [-1.3, 1.3]) bx(.15, 1.3, .15, s, .65, 0); for (const y of [.36, .72, 1.08]) bx(2.6, .1, .05, 0, y, 0); }
  return mergeGeometries(parts);
}

export function createPlaces(game) {
  const D = game.city.districts, list = D.breakables || [], zones = D.zones || {}, p = game.player, ph = game.physics;
  const grid = new Map(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), hidden = new THREE.Matrix4().makeScale(0, 0, 0);

  // ---------- one instanced mesh per kind of thing ----------
  const boomTex = ctex(128, (x, s) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#f4f4f0' : '#e8203a'; x.fillRect(i * s / 8, 0, s / 8, s); } });
  const KINDS = {
    glass: { geo: new THREE.BoxGeometry(1, 1, 1), mat: std({ color: 0xbfe6f0, roughness: .04, metalness: .35, transparent: true, opacity: .3, depthWrite: false }), shard: 0xd8f1f6, size: .2, sound: 'glass', cast: false },
    picket: { geo: panelGeo('picket'), mat: std({ color: 0xf6f3ec, roughness: .6 }), shard: 0xf6f3ec, size: .22, sound: 'wood', cast: true },
    rail: { geo: panelGeo('rail'), mat: std({ color: 0x9a744c, roughness: .9 }), shard: 0x9a744c, size: .26, sound: 'wood', cast: true },
    boom: { geo: new THREE.BoxGeometry(1, 1, 1), mat: std({ map: boomTex, roughness: .5 }), shard: 0xe8203a, size: .24, sound: 'wood', cast: true },
  };
  const place = (b) => {
    const k = KINDS[b.kind];
    if (b.kind === 'glass') { pos.set(b.x, b.y + b.h / 2, b.z); scl.set(b.w, b.h, .05); }
    else if (b.kind === 'boom') { pos.set(b.x, b.y + b.h, b.z); scl.set(b.w, .16, .12); }
    else { pos.set(b.x, b.y, b.z); scl.set(b.w / 2.6, 1, 1); }
    k.im.setMatrixAt(b.i, m4.compose(pos, q.setFromAxisAngle(up, -b.rot), scl)); k.im.instanceMatrix.needsUpdate = true;
  };
  const wall = (b) => { if (b.solid) b.col = ph.addWall(b.x, b.z, b.w / 2, .1, b.rot, 'solid', b.y + b.h); };
  for (const k in KINDS) {
    const mine = list.filter(b => b.kind === k), K = KINDS[k]; if (!mine.length) continue;
    K.im = new THREE.InstancedMesh(K.geo, K.mat, mine.length); K.im.castShadow = K.cast; K.im.receiveShadow = k !== 'glass'; K.im.frustumCulled = false; game.scene.add(K.im);
    mine.forEach((b, i) => {
      b.i = i; b.alive = true; b.cos = Math.cos(b.rot); b.sin = Math.sin(b.rot); b.solid = b.kind === 'boom' || (b.kind === 'glass' && !!b.through);
      place(b); wall(b);
      const c = key(b.x, b.z); let l = grid.get(c); if (!l) grid.set(c, l = []); l.push(b);
    });
  }
  let broken = [];

  function smash(b, dx, dz, vx = 0, vz = 0, power = 1) {
    if (!b.alive) return;
    const K = KINDS[b.kind]; b.alive = false; K.im.setMatrixAt(b.i, hidden); K.im.instanceMatrix.needsUpdate = true; broken.push(b);
    if (b.col) { ph.world.removeCollider(b.col, true); b.col = null; }
    const far = Math.hypot(b.x - p.x, b.z - p.z); if (far > 90) return;
    const n = b.kind === 'glass' ? Math.round(6 + b.w * b.h * 1.6) : 9, h = b.kind === 'glass' ? b.h : 1;
    for (const t of [-.3, 0, .3]) game.debris.burst(b.x + b.cos * b.w * t, b.y + h * (.35 + Math.random() * .4), b.z + b.sin * b.w * t, dx, dz, Math.ceil(n / 3), K.shard, K.size, 3 + power * 4, vx, vz);
    const vol = clamp(1 - far / 80, 0, 1);
    if (K.sound === 'glass') game.audio.glass(vol); else game.audio.crash(.12 * vol);
  }

  // A moving car against everything breakable near it.
  function carCheck(v) {
    const cx = Math.floor(v.x / CELL), cz = Math.floor(v.z / CELL), fwd = v.vf >= 0 ? 1 : -1, look = clamp(Math.abs(v.vf) * .1, 0, 4);
    for (let a = cx - 1; a <= cx + 1; a++) for (let c = cz - 1; c <= cz + 1; c++) {
      const l = grid.get(a * 4096 + c); if (!l) continue;
      for (const b of l) {
        if (!b.alive || Math.abs(b.y - v.y) > 3) continue;
        const reach = b.solid ? look : .25;
        let hit = false;
        for (const t of [-.5, 0, .5]) {
          const [lx, lz] = v.local(b.x + b.cos * b.w * t, b.z + b.sin * b.w * t), ahead = lx * fwd;
          if (Math.abs(lz) < v.halfWid + .3 && ahead > -v.halfLen - .3 && ahead < v.halfLen + .35 + reach) { hit = true; break; }
        }
        if (!hit) continue;
        const closing = Math.abs(-v.vx * b.sin + v.vz * b.cos);        // speed straight at the panel
        if (b.solid ? closing < SMASH.through : v.speed < SMASH.touch) continue;
        const sp = v.speed || 1; smash(b, v.vx / sp, v.vz / sp, v.vx, v.vz, clamp(v.speed / 20, .3, 1.5));
        if (b.solid) {                       // bursting through costs a little speed and paint
          const lv = v.body.linvel(); v.body.setLinvel({ x: lv.x * SMASH.keep, y: lv.y * SMASH.keep }, true); v._set.x *= SMASH.keep; v._set.y *= SMASH.keep;
          v.damage(SMASH.damage); if (v.driver === 'player') game.cam.shake(.3);
        }
      }
    }
  }

  let tidy = 0, inBase = 0, warned = false, pinged = 0;
  const places = {
    list, zones,
    // A bullet or a fist landed here: break the glass it hit.
    shot(x, y, z, dx = 0, dz = 0) {
      const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
      for (let a = cx - 1; a <= cx + 1; a++) for (let c = cz - 1; c <= cz + 1; c++) {
        const l = grid.get(a * 4096 + c); if (!l) continue;
        for (const b of l) {
          if (!b.alive || b.kind !== 'glass' || y < b.y - .2 || y > b.y + b.h + .2) continue;
          const ox = x - b.x, oz = z - b.z;
          if (Math.abs(ox * b.cos + oz * b.sin) < b.w / 2 + .1 && Math.abs(-ox * b.sin + oz * b.cos) < .7) { smash(b, dx, dz); return true; }
        }
      }
      return false;
    },
    update(dt, t) {
      const north = p.z > 330;
      for (const k in KINDS) if (KINDS[k].im) KINDS[k].im.visible = north;
      if (north) for (const v of game.traffic.vehicles) if (v.speed > 1.5 && v.z > 400 && Math.abs(v.x - p.x) < 160 && Math.abs(v.z - p.z) < 160) carCheck(v);
      // put things back once nobody is near enough to see it happen
      if (broken.length && (tidy -= dt) <= 0) {
        tidy = 3;
        broken = broken.filter(b => { if (Math.hypot(b.x - p.x, b.z - p.z) < SMASH.mend) return true; b.alive = true; place(b); wall(b); return false; });
      }
      // under a roof the camera stays under it
      const cam = game.camera;
      if (!game.combat?.aiming) for (const r of zones.roofs || []) {
        if (cam.position.x > r.x0 && cam.position.x < r.x1 && cam.position.z > r.z0 && cam.position.z < r.z1 && cam.position.y > r.y - .7 && p.y < r.y - 1.5) { cam.position.y = r.y - .7; cam.lookAt(game.cam.lookAt); }
      }
      // Fort Pelican
      const b = zones.base;
      if (b && game.state === 'playing' && !game.over && p.x > b.x0 && p.x < b.x1 && p.z > b.z0 && p.z < b.z1) {
        if (!warned) { warned = true; game.hud.toast('RESTRICTED AREA: FORT PELICAN', 'bad'); }
        inBase += dt;
        if (BASE.stars > 0 && inBase > BASE.grace && (pinged -= dt) <= 0) { pinged = 4; game.police.crime(game.police.stars < BASE.stars ? BASE.heat : 2, BASE.stars, 'TRESPASSING ON A MILITARY BASE!'); }
      } else { if (inBase > 0 && !(b && p.x > b.x0 - 30 && p.x < b.x1 + 30 && p.z > b.z0 - 30 && p.z < b.z1 + 30)) warned = false; inBase = 0; pinged = 0; }
    },
  };
  return places;
}
