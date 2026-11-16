// Building blocks for the districts outside downtown: trees, rocks, cacti, beach umbrellas,
// lamp posts, shipping containers, ramps and signs. Everything static is added to the holding
// group that city.js welds into a few meshes, so a thousand props cost a handful of draw calls.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { V } from '../core/utils.js';
import { mats, std, G, mesh, rbox, ctex, awnings } from './materials.js';
import { groundY, addDeck } from './terrain.js';

const blob = (detail, wobble, seed) => {
  let g = new THREE.IcosahedronGeometry(1, detail); g.deleteAttribute('uv'); g.deleteAttribute('normal'); g = mergeVertices(g);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = 1 + (Math.sin(i * 12.9898 + seed) * 43758.5453 % 1) * wobble; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); }
  g.computeVertexNormals(); return g;
};
// A wedge: `len` long (rising toward +x), `wid` wide, `h` tall at the high end.
function wedgeGeo(len, wid, h) {
  const a = len / 2, w = wid / 2;
  const P = [[-a, 0, -w], [-a, 0, w], [a, 0, -w], [a, 0, w], [a, h, -w], [a, h, w]];
  const faces = [[0, 1, 5, 4], [2, 4, 5, 3], [0, 4, 2], [1, 3, 5]], pos = [], uv = [];
  const UV = [[0, 0], [0, 1], [1, 1], [1, 0]];     // u runs up the ramp, so the arrows point at the lip
  for (const f of faces) { const tri = f.length === 4 ? [0, 1, 2, 0, 2, 3] : [0, 1, 2]; for (const k of tri) { pos.push(...P[f[k]]); uv.push(...UV[k]); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g;
}
// A roof: triangular prism `w` wide (across x), `h` tall, `len` long (along z).
export function roofGeo(w, h, len) {
  const a = w / 2, l = len / 2, P = [[-a, 0, -l], [a, 0, -l], [0, h, -l], [-a, 0, l], [a, 0, l], [0, h, l]];
  const tris = [[0, 3, 5], [0, 5, 2], [1, 2, 5], [1, 5, 4], [0, 2, 1], [3, 4, 5]], pos = [];
  for (const t of tris) for (const k of t) pos.push(...P[k]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
}

export function makeProps(api, R) {
  const { scene, solids, lampPts, IB, mat4 } = api;
  const rr = (a, b) => a + R() * (b - a), one = (a) => a[Math.floor(R() * a.length)];
  const top = (x, y, z, ry = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; scene.add(g); return g; };

  // ---------- materials (a small palette, so welded meshes stay few) ----------
  const stripes = (bg, line, n, across) => ctex(128, (x, s) => { x.fillStyle = bg; x.fillRect(0, 0, s, s); x.fillStyle = line; for (let i = 0; i < n; i++) across ? x.fillRect(0, i * s / n, s, 2.5) : x.fillRect(i * s / n, 0, 2.5, s); });
  const ribs = stripes('#ffffff', 'rgba(0,0,0,.2)', 16, false);
  const M = {
    canopy: [std({ color: 0x5fa64a, roughness: .9 }), std({ color: 0x7ab655, roughness: .9 })],
    rock: std({ color: 0xa8917e, roughness: 1 }),
    cactus: std({ color: 0x57a060, roughness: .8 }),
    wood: std({ map: stripes('#ffffff', 'rgba(70,45,20,.35)', 8, true), color: 0xd2ab78, roughness: .85 }),
    box: [0xd9534a, 0x3d7ab8, 0x2f9c8f, 0xe8a23a, 0xf0ece2].map(c => std({ map: ribs, color: c, roughness: .6, metalness: .2 })),
    ramp: std({
      map: ctex(256, (x, s) => {
        x.fillStyle = '#ff8a3d'; x.fillRect(0, 0, s, s); x.strokeStyle = '#fff4e6'; x.lineWidth = 26; x.lineJoin = 'miter';
        for (let i = -1; i < 4; i++) { x.beginPath(); x.moveTo(i * 80, 0); x.lineTo(i * 80 + 70, s / 2); x.lineTo(i * 80, s); x.stroke(); }
      }), roughness: .7,
    }),
    crane: std({ color: 0xe2553a, roughness: .5, metalness: .3 }),
    hull: std({ color: 0x8f2f33, roughness: .6 }),
    white: std({ color: 0xf6f3ec, roughness: .6 }),
    red: std({ color: 0xe8455b, roughness: .6 }),
    tire: mats.tire,
  };
  M.ramp.map.repeat.set(1, 1);
  const G2 = {
    blob: blob(1, 0, 0), rock: blob(1, .28, 3), trunk: new THREE.CylinderGeometry(.16, .26, 1, 7), stem: new THREE.CapsuleGeometry(1, 1, 2, 6),
    cone: new THREE.ConeGeometry(1, 1, 10), cyl8: new THREE.CylinderGeometry(1, 1, 1, 8), torus: new THREE.TorusGeometry(.42, .2, 6, 12),
  };

  const P = {
    M, G2, top, rr, one,
    tree(x, z, s = 1) {
      const g = top(x, groundY(x, z) - .1, z, R() * 6.28), c = one(M.canopy); g.scale.setScalar(s * rr(.85, 1.2));
      mesh(G2.trunk, mats.trunk, V(0, 1.4, 0), V(1, 2.9, 1), g);
      mesh(G2.blob, c, V(0, 3.7, 0), V(1.9, 1.6, 1.9), g); mesh(G2.blob, c, V(1, 3, .3), V(1.2, 1.05, 1.2), g); mesh(G2.blob, c, V(-.8, 3.1, -.5), V(1.3, 1.1, 1.3), g);
      solids.posts.push({ x, z, r: .3 });
    },
    bush(x, z, s = 1) { const c = one(M.canopy); mesh(G2.blob, c, V(x, groundY(x, z) + .35 * s, z), V(s * rr(.9, 1.4), s * .7, s * rr(.9, 1.4)), scene); },
    rock(x, z, s = 1) {
      const m = mesh(G2.rock, M.rock, V(x, groundY(x, z) + s * .15, z), V(s * rr(.9, 1.5), s * rr(.6, 1), s * rr(.9, 1.5)), scene); m.rotation.y = R() * 6.28;
      if (s > .9) solids.posts.push({ x, z, r: s * .85 });
    },
    cactus(x, z, s = 1) {
      const g = top(x, groundY(x, z), z, R() * 6.28); g.scale.setScalar(s);
      mesh(G2.stem, M.cactus, V(0, 1.5, 0), V(.32, 1.25, .32), g);
      for (const side of R() < .7 ? [-1, 1] : [1]) {
        const h = rr(.9, 1.6);
        mesh(G2.stem, M.cactus, V(side * .45, h, 0), V(.2, .32, .2), g).rotation.z = Math.PI / 2;
        mesh(G2.stem, M.cactus, V(side * .78, h + .45, 0), V(.2, .5, .2), g);
      }
      solids.posts.push({ x, z, r: .32 * s });
    },
    palm(x, z, s = 1) { api.palm(x, z, s, groundY(x, z)); },
    umbrella(x, z) {
      const g = top(x, groundY(x, z), z, R() * 6.28), a = one(awnings);
      mesh(G.cyl, mats.trim, V(0, 1.2, 0), V(.045, 2.4, .045), g);
      const c = mesh(G2.cone, a, V(0, 2.35, 0), V(1.7, .55, 1.7), g); c.rotation.z = rr(-.12, .12);
      mesh(G.box, one(awnings), V(1.1, .06, .2), V(.9, .05, 1.9), g, false);       // towel
    },
    // lamp post leaning its arm toward (dx, dz); lights up at night like downtown's
    lamp(x, z, dx, dz) {
      const y = groundY(x, z);
      IB.pole.add(mat4(V(x, y + 3, z), V(.11, 6, .11)));
      IB.arm.add(mat4(V(x + dx * .9, y + 5.95, z + dz * .9), dx ? V(1.9, .12, .12) : V(.12, .12, 1.9)));
      IB.lamp.add(mat4(V(x + dx * 1.8, y + 5.8, z + dz * 1.8), V(.7, .22, .42), dx ? 0 : Math.PI / 2));
      lampPts.push(V(x + dx * 1.8, y + 5.5, z + dz * 1.8)); solids.posts.push({ x, z, r: .16 });
    },
    // 6 x 2.6 x 2.5 m shipping container; `along` = 'x' or 'z'; level 0 is on the ground
    container(x, z, along = 'x', level = 0, y = null) {
      const base = (y ?? groundY(x, z)) + level * 2.6, m = mesh(G.box, one(M.box), V(x, base + 1.3, z), along === 'x' ? V(6, 2.6, 2.5) : V(2.5, 2.6, 6), scene);
      if (level === 0) solids.boxes.push({ x, z, hw: along === 'x' ? 3 : 1.25, hd: along === 'x' ? 1.25 : 3, low: true });
      return m;
    },
    tires(x, z) {
      const y = groundY(x, z); for (let i = 0; i < 3; i++) { const t = mesh(G2.torus, M.tire, V(x, y + .2 + i * .38, z), null, scene); t.rotation.x = Math.PI / 2; }
      solids.posts.push({ x, z, r: .6 });
    },
    // A drive-up ramp. rot = direction it launches you (same angle convention as cars). Returns its data for the stunt list.
    ramp(x, z, rot, len = 10, wid = 6, h = 2.6, base = null) {
      const c = Math.cos(rot), s = Math.sin(rot), y0 = base ?? groundY(x - c * len / 2, z - s * len / 2);
      addDeck({ x, z, hl: len / 2, hw: wid / 2, rot, y0, y1: y0 + h });
      const g = top(x, y0, z, -rot);
      mesh(wedgeGeo(len, wid, h), M.ramp, null, null, g);
      for (const side of [-1, 1]) {      // side rails and the legs under the lip
        mesh(G.box, mats.darkMetal, V(len / 2 - .15, h / 2 - 2, side * (wid / 2 - .15)), V(.3, h + 4, .3), g);
        const rail = mesh(G.box, mats.yellowPaint, V(0, h / 2 + .25, side * (wid / 2 + .06)), V(Math.hypot(len, h), .16, .12), g); rail.rotation.z = Math.atan2(h, len);
      }
      return { x, z, rot, len, wid, h, lipX: x + c * len / 2, lipZ: z + s * len / 2, y: y0 + h };
    },
    // An unlit sign board that glows a little at night. Faces direction `ry` (0 = toward +z); both = readable from behind too.
    sign(text, x, y, z, ry, w, h, bg = 'rgba(15,16,22,.92)', fg = '#ffd34d', font = 150, both = false) {
      const t = ctex(1024, (c, s) => {
        const hh = s * h / w, y0 = (s - hh) / 2; c.clearRect(0, 0, s, s);
        if (bg) { c.fillStyle = bg; c.beginPath(); c.roundRect(6, y0 + 6, s - 12, hh - 12, 26); c.fill(); }
        c.font = `900 ${font}px "Archivo Black",Impact,sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
        const tw = c.measureText(text).width; if (tw > s - 70) c.font = `900 ${Math.floor(font * (s - 70) / tw)}px "Archivo Black",Impact,sans-serif`;
        c.lineWidth = 10; c.strokeStyle = 'rgba(0,0,0,.55)'; if (!bg) c.strokeText(text, s / 2, s / 2 + 4);
        c.fillStyle = fg; c.fillText(text, s / 2, s / 2 + 4);
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w), new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: .08 }));
      m.position.set(x, y, z); m.rotation.y = ry; api.realScene.add(m); api.signMats.push(m.material);
      if (both) { const b = new THREE.Mesh(m.geometry, m.material); b.position.copy(m.position); b.rotation.y = ry + Math.PI; api.realScene.add(b); }
      return m;
    },
  };
  return P;
}
