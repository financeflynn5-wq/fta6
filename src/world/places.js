// What the northern districts do once the game is running:
//   - things a car can smash: the mall's glass, its tables, kiosks and planters, picket and farm fences,
//     hay bales, crates, cones, the barrier at the base gate. Each is solid until something hits it hard
//     enough, then it bursts and you drive on through. Glass that is `through` needs real speed; shop
//     windows only shatter (the wall behind stops you). Bullets and fists break glass too.
//     Everything is put back once you are far away.
//   - the camera stays under the mall's roof
//   - Fort Pelican is a restricted area: hang around inside the fence and you are wanted
// The pieces themselves are listed by the district builders (K.breakable in world/north.js).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SMASH, BASE } from '../config.js';
import { std, ctex } from './materials.js';
import { plainGeometry } from './batching.js';
import { clamp } from '../core/utils.js';

const CELL = 16, key = (x, z) => Math.floor(x / CELL) * 4096 + Math.floor(z / CELL);
const BOX = new THREE.BoxGeometry(1, 1, 1), CYL = new THREE.CylinderGeometry(1, 1, 1, 12), BLOB = new THREE.IcosahedronGeometry(1, 1);

// one fence panel 2.6 m long, standing on y = 0, centred on x
function panelGeo(kind) {
  const parts = [], bx = (w, h, d, x, y, z = 0) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); parts.push(g); };
  if (kind === 'picket') { bx(2.6, .07, .04, 0, .34, 0); bx(2.6, .07, .04, 0, .78, 0); for (let i = 0; i < 10; i++) bx(.11, 1, .03, -1.17 + i * .26, .5, .03); for (const s of [-1.3, 1.3]) bx(.1, 1.14, .1, s, .57, 0); }
  else { for (const s of [-1.3, 1.3]) bx(.15, 1.3, .15, s, .65, 0); for (const y of [.36, .72, 1.08]) bx(2.6, .1, .05, 0, y, 0); }
  return mergeGeometries(parts);
}
// A prop made of plain shapes, each with its own colour: [shape, colour, x, y, z, sx, sy, sz, rx = 0, rz = 0]
function propGeo(parts) {
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color(), list = [];
  for (const [geo, color, x, y, z, sx, sy, sz, rx = 0, rz = 0] of parts) {
    const g = plainGeometry(geo, m.compose(new THREE.Vector3(x, y, z), q.setFromEuler(e.set(rx, 0, rz)), new THREE.Vector3(sx, sy, sz))), n = g.attributes.position.count, col = new Float32Array(n * 3);
    c.set(color); for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); list.push(g);
  }
  return mergeGeometries(list);
}
const PROPS = {
  // a cafe table and two chairs
  table: () => propGeo([[CYL, 0xf6f3ec, 0, .74, 0, .5, .05, .5], [CYL, 0x2b2f35, 0, .37, 0, .05, .74, .05], [CYL, 0x2b2f35, 0, .02, 0, .3, .04, .3],
    ...[-1, 1].flatMap(s => [[BOX, 0x2f9c8f, s * .85, .45, 0, .42, .05, .42], [BOX, 0x2f9c8f, s * 1.04, .72, 0, .05, .5, .42], [BOX, 0x2b2f35, s * .85, .22, 0, .3, .44, .3]])]),
  // a stall in the middle of the mall: counter, posts and a roof
  kiosk: () => propGeo([[BOX, 0xf2937a, 0, .55, 0, 2.4, 1.1, 1.6], [BOX, 0xf6f3ec, 0, 1.13, 0, 2.6, .07, 1.8], [BOX, 0x2f9c8f, 0, 2.5, 0, 2.9, .22, 2.1], [BOX, 0xfff4e6, 0, 2.32, 0, 2.7, .14, 1.9],
    ...[[-1.2, -.8], [1.2, -.8], [-1.2, .8], [1.2, .8]].map(([x, z]) => [BOX, 0x2b2f35, x, 1.75, z, .07, 1.3, .07]),
    [BOX, 0xffd34d, -.6, 1.3, 0, .3, .28, .3], [BOX, 0x3de0ff, 0, 1.33, .2, .3, .34, .3], [BOX, 0xff4d6d, .6, 1.3, -.1, .3, .28, .3]]),
  // a rail of clothes
  rack: () => propGeo([[BOX, 0x2b2f35, 0, 1.55, 0, 2.1, .05, .05], [BOX, 0x2b2f35, -1.02, .78, 0, .05, 1.56, .5], [BOX, 0x2b2f35, 1.02, .78, 0, .05, 1.56, .5],
    ...[0xff4d6d, 0xffd34d, 0x3de0ff, 0xf6f3ec, 0xc77dff, 0x7dff8a, 0xff8a3d].map((c, i) => [BOX, c, -.84 + i * .28, 1.12, 0, .2, .78, .46])]),
  // a planter with a bush in it
  planter: () => propGeo([[BOX, 0xe9e1d3, 0, .32, 0, 1.5, .64, 1.5], [BOX, 0x6b4a32, 0, .62, 0, 1.3, .08, 1.3], [BLOB, 0x5fa64a, 0, 1.15, 0, .82, .62, .82], [BLOB, 0x7ab655, .3, 1.5, .1, .5, .42, .5]]),
  // a round hay bale on its side
  bale: () => propGeo([[CYL, 0xdcb85c, 0, .7, 0, .7, 1.4, .7, Math.PI / 2], [CYL, 0xb8923c, 0, .7, .45, .715, .08, .715, Math.PI / 2], [CYL, 0xb8923c, 0, .7, -.45, .715, .08, .715, Math.PI / 2]]),
  crate: () => propGeo([[BOX, 0xc79a5e, 0, .5, 0, 1, 1, 1], [BOX, 0x9a744c, 0, .5, 0, 1.04, .12, 1.04], [BOX, 0x9a744c, 0, .92, 0, 1.04, .1, 1.04], [BOX, 0x9a744c, 0, .08, 0, 1.04, .1, 1.04]]),
  cone: () => propGeo([[new THREE.ConeGeometry(1, 1, 10), 0xff7a2a, 0, .36, 0, .17, .6, .17], [BOX, 0xff7a2a, 0, .03, 0, .42, .06, .42], [CYL, 0xf6f3ec, 0, .34, 0, .1, .1, .1]]),
};

export function createPlaces(game) {
  const D = game.city.districts, list = D.breakables || [], zones = D.zones || {}, p = game.player, ph = game.physics;
  const grid = new Map(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), hidden = new THREE.Matrix4().makeScale(0, 0, 0);

  // ---------- one instanced mesh per kind of thing ----------
  // foot: half length and half depth of what you bump into; tall: how high it stands; hard: needs real speed to break
  const boomTex = ctex(128, (x, s) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#f4f4f0' : '#e8203a'; x.fillRect(i * s / 8, 0, s / 8, s); } });
  const wood = std({ color: 0xffffff, vertexColors: true, roughness: .75 });
  const KINDS = {
    glass: { geo: BOX, mat: std({ color: 0xbfe6f0, roughness: .04, metalness: .35, transparent: true, opacity: .32, depthWrite: false }), shard: 0xd8f1f6, size: .2, sound: 'glass', cast: false },
    picket: { geo: panelGeo('picket'), mat: std({ color: 0xf6f3ec, roughness: .6 }), shard: 0xf6f3ec, size: .22, sound: 'wood', cast: true, tall: 1.1 },
    rail: { geo: panelGeo('rail'), mat: std({ color: 0x9a744c, roughness: .9 }), shard: 0x9a744c, size: .26, sound: 'wood', cast: true, tall: 1.3 },
    boom: { geo: BOX, mat: std({ map: boomTex, roughness: .5 }), shard: 0xe8203a, size: .24, sound: 'wood', cast: true, hard: true },
    table: { foot: [1.15, .5], tall: 1, shard: 0xf6f3ec, size: .2 }, kiosk: { foot: [1.35, .95], tall: 2.7, shard: 0xf2937a, size: .32 },
    rack: { foot: [1.05, .3], tall: 1.6, shard: 0xff4d6d, size: .22 }, planter: { foot: [.78, .78], tall: 1.6, shard: 0x5fa64a, size: .3 },
    bale: { foot: [.72, .72], tall: 1.4, shard: 0xdcb85c, size: .28 }, crate: { foot: [.52, .52], tall: 1, shard: 0xc79a5e, size: .26 }, cone: { foot: [.2, .2], tall: .6, shard: 0xff7a2a, size: .14, soft: true },
  };
  for (const k in PROPS) Object.assign(KINDS[k], { geo: PROPS[k](), mat: wood, sound: 'wood', cast: true, prop: true });
  const place = (b) => {
    const k = KINDS[b.kind];
    if (b.kind === 'glass') { pos.set(b.x, b.y + b.h / 2, b.z); scl.set(b.w, b.h, .05); }
    else if (b.kind === 'boom') { pos.set(b.x, b.y + b.h, b.z); scl.set(b.w, .16, .12); }
    else if (k.prop) { pos.set(b.x, b.y, b.z); scl.set(1, 1, 1); }
    else { pos.set(b.x, b.y, b.z); scl.set(b.w / 2.6, 1, 1); }
    k.im.setMatrixAt(b.i, m4.compose(pos, q.setFromAxisAngle(up, -b.rot), scl)); k.im.instanceMatrix.needsUpdate = true;
  };
  // what you bump into until it breaks (a shop window has none: the wall behind it is what stops you)
  const wall = (b) => {
    const k = KINDS[b.kind]; if (!b.solid) return;
    b.col = k.prop ? ph.addWall(b.x, b.z, k.foot[0], k.foot[1], b.rot, k.tall > 1.7 ? 'solid' : 'low', b.y + k.tall)
      : ph.addWall(b.x, b.z, b.w / 2, .09, b.rot, b.hard ? 'solid' : 'low', b.y + (k.tall || b.h));
  };
  for (const k in KINDS) {
    const mine = list.filter(b => b.kind === k), K = KINDS[k]; if (!mine.length) continue;
    K.im = new THREE.InstancedMesh(K.geo, K.mat, mine.length); K.im.castShadow = K.cast; K.im.receiveShadow = k !== 'glass'; K.im.frustumCulled = false; game.scene.add(K.im);
    mine.forEach((b, i) => {
      b.i = i; b.alive = true; b.cos = Math.cos(b.rot); b.sin = Math.sin(b.rot);
      b.hard = !!K.hard || (k === 'glass' && !!b.through); b.solid = k !== 'glass' || b.hard; b.deep = K.prop ? K.foot[1] : 0; if (K.prop) b.w = K.foot[0] * 2;
      place(b); wall(b);
      const c = key(b.x, b.z); let l = grid.get(c); if (!l) grid.set(c, l = []); l.push(b);
    });
  }
  let broken = [];

  function smash(b, dx, dz, vx = 0, vz = 0, power = 1) {
    if (!b.alive) return;
    const K = KINDS[b.kind]; b.alive = false; K.im.setMatrixAt(b.i, hidden); K.im.instanceMatrix.needsUpdate = true; broken.push(b);
    game.onSmash?.(b);                           // the smash spree counts these
    if (b.col) { ph.world.removeCollider(b.col, true); b.col = null; }
    const far = Math.hypot(b.x - p.x, b.z - p.z); if (far > 90) return;
    const n = b.kind === 'glass' ? Math.round(6 + b.w * b.h * 1.6) : K.prop ? 12 : 9, h = b.kind === 'glass' ? b.h : K.tall || 1;
    for (const t of [-.3, 0, .3]) game.debris.burst(b.x + b.cos * b.w * t, b.y + h * (.35 + Math.random() * .4), b.z + b.sin * b.w * t, dx, dz, Math.ceil(n / 3), K.shard, K.size, 3 + power * 4, vx, vz);
    const vol = clamp(1 - far / 80, 0, 1);
    if (K.sound === 'glass') game.audio.glass(vol); else game.audio.crash(.12 * vol);
  }

  // A moving car against everything breakable near it.
  function carCheck(v) {
    const thr = v.driver ? v.controls.throttle : 0, shove = Math.abs(thr) > .5 && v.speed < SMASH.touch;      // leaning on something from a standstill
    const cx = Math.floor(v.x / CELL), cz = Math.floor(v.z / CELL), fwd = (shove ? thr : v.vf) >= 0 ? 1 : -1, look = clamp(Math.abs(v.vf) * .1, 0, 4);
    for (let a = cx - 1; a <= cx + 1; a++) for (let c = cz - 1; c <= cz + 1; c++) {
      const l = grid.get(a * 4096 + c); if (!l) continue;
      for (const b of l) {
        if (!b.alive || Math.abs(b.y - v.y) > 3) continue;
        const reach = b.solid ? look : .25, pad = b.deep;
        let hit = false, nose = false;
        for (const t of [-.5, 0, .5]) {
          const [lx, lz] = v.local(b.x + b.cos * b.w * t, b.z + b.sin * b.w * t), ahead = lx * fwd;
          if (Math.abs(lz) < v.halfWid + .3 + pad && ahead > -v.halfLen - .3 - pad && ahead < v.halfLen + .35 + reach + pad) { hit = true; if (ahead > v.halfLen - .6 && Math.abs(lz) < v.halfWid) nose = true; }
        }
        if (!hit) continue;
        const closing = Math.abs(-v.vx * b.sin + v.vz * b.cos);        // speed straight at the panel
        if (b.hard ? closing < SMASH.through : v.speed < SMASH.touch && !(shove && nose)) continue;
        const sp = v.speed || 1; smash(b, v.vx / sp, v.vz / sp, v.vx, v.vz, clamp(v.speed / 20, .3, 1.5));
        if (v.driver === 'player') game.match?.smashed(b);
        if (b.hard || KINDS[b.kind].prop && !KINDS[b.kind].soft) {       // bursting through costs a little speed and paint
          const keep = b.hard ? SMASH.keep : SMASH.keepProp, lv = v.body.linvel(); v.body.setLinvel({ x: lv.x * keep, y: lv.y * keep }, true); v._set.x *= keep; v._set.y *= keep;
          v.damage(b.hard ? SMASH.damage : SMASH.damage * .4); if (v.driver === 'player') game.cam.shake(b.hard ? .3 : .15);
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
    // Put everything broken inside a box back at once (the smash spree starts with a whole mall).
    mend(x0, x1, z0, z1) { broken = broken.filter(b => { if (b.x < x0 || b.x > x1 || b.z < z0 || b.z > z1) return true; b.alive = true; place(b); wall(b); return false; }); },
    update(dt, t) {
      const north = p.z > 330;
      for (const k in KINDS) if (KINDS[k].im) KINDS[k].im.visible = north;
      if (north) for (const v of game.traffic.vehicles) if ((v.speed > 1.5 || v.driver === 'player') && v.z > 400 && Math.abs(v.x - p.x) < 160 && Math.abs(v.z - p.z) < 160) carCheck(v);
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
