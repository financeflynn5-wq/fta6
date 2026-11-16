// Vehicle meshes. The sedan, taxi and cruiser are straight from the concept: one rounded body, glass
// cab, chrome wheels. The sports car, van, box truck, limo and motorbike are built the same way.
// Structure: group -> chassis (leans and dips) + wheels (steer + spin). A bike's wheels lean with it.
// These shapes are stand-ins: the Blender models (vehicleModels.js) replace them in place once loaded.
import * as THREE from 'three';
import { V, choose } from '../core/utils.js';
import { mats, std, paint, G, mesh, rbox, ctex } from '../world/materials.js';
import { plainGeometry } from '../world/batching.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { dressCar, wheelParts } from './vehicleModels.js';

const bodyShape = (() => {
  const s = new THREE.Shape(); s.moveTo(-2.15, .34); s.lineTo(2.1, .34); s.quadraticCurveTo(2.32, .36, 2.3, .62); s.lineTo(2.24, .86); s.quadraticCurveTo(1.9, .98, 1.1, 1.0);
  s.lineTo(-1.7, 1.02); s.quadraticCurveTo(-2.2, 1.0, -2.26, .8); s.lineTo(-2.28, .5); s.quadraticCurveTo(-2.28, .34, -2.15, .34); return s;
})();
const cabShape = (() => {
  const s = new THREE.Shape(); s.moveTo(-1.45, .98); s.lineTo(.95, .98); s.quadraticCurveTo(.55, 1.25, .25, 1.6); s.lineTo(-1.05, 1.62); s.quadraticCurveTo(-1.35, 1.5, -1.45, .98); return s;
})();
const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, { depth: 1.56, bevelEnabled: true, bevelThickness: .14, bevelSize: .1, bevelSegments: 4, curveSegments: 10 }); bodyGeo.translate(0, 0, -.78);
const cabGeo = new THREE.ExtrudeGeometry(cabShape, { depth: 1.26, bevelEnabled: true, bevelThickness: .1, bevelSize: .06, bevelSegments: 3, curveSegments: 8 }); cabGeo.translate(0, 0, -.63);
const roofGeo = rbox(1.25, .08, 1.42, .04), tireGeo = new THREE.CylinderGeometry(.4, .4, .32, 24), rimGeo = new THREE.CylinderGeometry(.25, .25, .34, 16);
export const carColors = [0xe8455b, 0x2f6fd6, 0xf4f1ea, 0x23272e, 0x2f8f83, 0xf2a93b, 0x9b5de5, 0x6b7a8a, 0xff7aa2, 0x2bb3c0];

// Welded shapes: fewer, bigger pieces per car.
const at = (geo, x, y, z, sx = 1, sy = 1, sz = 1) => plainGeometry(geo, new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion(), V(sx, sy, sz)));
const flat = (geo) => plainGeometry(geo, new THREE.Matrix4().makeRotationX(Math.PI / 2));
const shellGeo = mergeGeometries([plainGeometry(bodyGeo), at(roofGeo, -.45, 1.66, 0)]);                 // body + roof in one paint
const liveryGeo = mergeGeometries([at(roofGeo, -.45, 1.66, 0), at(G.box, 0, .72, 0, 2.4, .42, 1.82)]);   // police white roof + door band
const headGeo = mergeGeometries([-.58, .58].map(z => at(rbox(.1, .16, .36, .04), 2.36, .74, z)));
const tailGeo = mergeGeometries([-.58, .58].map(z => at(rbox(.1, .14, .4, .04), -2.38, .8, z)));
// tyre plus a spoke line on each face, so you can see the wheel turning
const wheelGeo = mergeGeometries([flat(tireGeo), at(G.box, 0, 0, .172, .42, .07, .01), at(G.box, 0, 0, -.172, .42, .07, .01)]);
const hubGeo = flat(rimGeo);
let taxiMat = null;

// All wheels in the city are drawn in a few calls: one batch per kind of wheel ('stand' = the stand-in
// tyre + hub, then 'std', 'sport', 'truck' and 'bike' from the models). Cars borrow four slots each in
// their kind's batch; the slot number carries the kind (kind index * capacity + slot).
export function createWheelBatch(scene, capacity = 640) {
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0), kinds = [], byName = {};
  function kind(name) {
    if (byName[name]) return byName[name];
    const parts = name === 'stand' ? [[wheelGeo, mats.tire], [hubGeo, mats.rim]] : wheelParts(name);
    const k = { index: kinds.length, ims: parts.map(([geo, mat]) => new THREE.InstancedMesh(geo, mat, capacity)), free: [], top: 0, used: 0, dirty: false };
    for (let i = capacity - 4; i >= 0; i -= 4) k.free.push(i);
    for (const im of k.ims) { im.castShadow = im.receiveShadow = true; im.frustumCulled = false; im.count = 0; for (let i = 0; i < capacity; i++) im.setMatrixAt(i, hidden); scene.add(im); }
    kinds.push(k); byName[name] = k; return k;
  }
  kind('stand');
  const of = (slot) => kinds[Math.floor(slot / capacity)];
  return {
    alloc(name = 'stand') {
      const k = kind(name), s = k.free.pop(); if (s === undefined) return -1;
      k.used++; if (s + 4 > k.top) { k.top = s + 4; for (const im of k.ims) im.count = k.top; }      // only draw the slots in use
      return k.index * capacity + s;
    },
    release(slot) {
      if (slot < 0) return; const k = of(slot), s = slot % capacity;
      for (let i = 0; i < 4; i++) for (const im of k.ims) im.setMatrixAt(s + i, hidden);
      k.free.push(s); k.dirty = true;
      if (--k.used === 0) { k.top = 0; for (const im of k.ims) im.count = 0; }         // e.g. the stand-ins, once every model is in
    },
    set(i, m) { const k = of(i); for (const im of k.ims) im.setMatrixAt(i % capacity, m); k.dirty = true; },
    commit() { for (const k of kinds) if (k.dirty) { k.dirty = false; for (const im of k.ims) im.instanceMatrix.needsUpdate = true; } },
  };
}


// ---------- the other vehicles: same recipe, different shapes ----------
// A side profile is a list of points; [x, y, cx, cy] curves to (x, y) around the corner (cx, cy).
function profile(pts) {
  const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) { if (p.length === 4) s.quadraticCurveTo(p[2], p[3], p[0], p[1]); else s.lineTo(p[0], p[1]); }
  return s;
}
const extrude = (pts, width, bevel = .14) => {
  const g = new THREE.ExtrudeGeometry(profile(pts), bevel ? { depth: width, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * .7, bevelSegments: 4, curveSegments: 10 } : { depth: width, bevelEnabled: false });
  g.translate(0, 0, -width / 2); return plainGeometry(g);
};
const tilt = (geo, x, y, z, rz) => plainGeometry(geo, new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), rz), V(1, 1, 1)));
const pair = (geo, x, y, z) => mergeGeometries([-z, z].map(k => at(geo, x, y, k)));
const dark = std({ color: 0x1b1d22, roughness: .6, metalness: .3 });

// Each entry: shell (painted), glass, trim (dark), white (second paint), head, tail, wheels [x, z, size, width], colours, seat.
const SHAPES = {
  // low wedge with a wing
  sport: () => ({
    shell: mergeGeometries([
      extrude([[-2.1, .3], [2.05, .3], [2.3, .5, 2.3, .32], [2.22, .64], [1.0, .82, 1.7, .76], [-1.55, .9], [-2.24, .72, -2.18, .9], [-2.26, .46], [-2.1, .3, -2.26, .3]], 1.62),
      at(rbox(.9, .07, 1.36, .035), -.52, 1.31, 0), at(rbox(.34, .06, 1.78, .03), -2.02, 1.18, 0), at(G.box, -2.02, 1.03, .58, .08, .26, .08), at(G.box, -2.02, 1.03, -.58, .08, .26, .08),
    ]),
    glass: extrude([[-1.5, .86], [.7, .8], [-.1, 1.26, .3, 1.02], [-.95, 1.28], [-1.5, .86, -1.35, 1.18]], 1.22, .1),
    head: pair(rbox(.1, .1, .42, .04), 2.27, .58, .6), tail: at(rbox(.08, .1, 1.5, .04), -2.32, .74, 0),
    wheels: [[1.4, .9], [1.4, -.9], [-1.38, .9], [-1.38, -.9]],
    colors: [0xff2d55, 0xffd60a, 0x34e06b, 0xf4f1ea, 0xff7a00, 0x00c2ff],
  }),
  // tall box with a sloping windscreen
  van: () => ({
    shell: extrude([[-2.4, .36], [2.3, .36], [2.54, .64, 2.55, .38], [2.5, 1.06], [2.2, 1.28, 2.44, 1.2], [1.72, 1.98], [1.4, 2.1, 1.62, 2.1], [-2.25, 2.1], [-2.5, 1.86, -2.5, 2.1], [-2.5, .56], [-2.4, .36, -2.5, .36]], 1.76, .12),
    glass: mergeGeometries([extrude([[1.0, 1.36], [2.27, 1.36], [1.87, 1.96], [1.0, 1.96]], 2.04, 0), at(G.box, -2.575, 1.62, 0, .06, .5, 1.4)]),
    trim: mergeGeometries([at(rbox(.16, .22, 2.0, .05), 2.56, .5, 0), at(rbox(.16, .22, 2.0, .05), -2.52, .5, 0)]),
    head: pair(rbox(.1, .18, .34, .04), 2.57, .86, .66), tail: pair(rbox(.08, .42, .14, .04), -2.6, 1.02, .86),
    wheels: [[1.62, .94], [1.62, -.94], [-1.55, .94], [-1.55, -.94]],
    colors: [0xf4f1ea, 0x2f6fd6, 0xe9d8a6, 0x2f8f83, 0xe8455b, 0x6b7a8a],
  }),
  // cab up front, big white box behind with a stripe in the cab colour
  truck: () => ({
    shell: mergeGeometries([
      extrude([[1.5, .7], [3.4, .7], [3.62, .95, 3.62, .72], [3.58, 1.5], [3.3, 1.68, 3.5, 1.62], [3.0, 2.5], [2.75, 2.62, 2.94, 2.62], [1.7, 2.62], [1.5, 2.42, 1.5, 2.62]], 2.1, .12),
      at(G.box, -1.15, 1.5, 0, 4.94, .34, 2.5),
    ]),
    white: at(rbox(4.9, 2.6, 2.46, .1), -1.15, 2.2, 0),
    glass: extrude([[2.3, 1.74], [3.39, 1.74], [3.12, 2.48], [2.3, 2.48]], 2.38, 0),
    trim: mergeGeometries([at(G.box, 0, .64, 0, 6.6, .3, 1.5), at(rbox(.2, .3, 2.36, .06), 3.66, .66, 0), at(rbox(.14, .22, 2.4, .05), -3.62, .7, 0)]),
    head: pair(rbox(.1, .2, .4, .04), 3.66, 1.12, .76), tail: pair(rbox(.08, .2, .3, .04), -3.64, 1.0, .95),
    wheels: [[2.6, 1.05, 1.3], [2.6, -1.05, 1.3], [-2.3, 1.05, 1.3], [-2.3, -1.05, 1.3]],
    colors: [0xe8455b, 0x2f6fd6, 0xf2a93b, 0x2f8f83, 0x23272e],
  }),
  // the sedan, pulled out in the middle
  limo: () => {
    const e = .8, st = (pts) => pts.map(p => p.map((v, i) => i % 2 ? v : v + (v < -.2 ? -e : e)));
    return {
      shell: mergeGeometries([
        extrude(st([[-2.15, .34], [2.1, .34], [2.3, .62, 2.32, .36], [2.24, .86], [1.1, 1.0, 1.9, .98], [-1.7, 1.02], [-2.26, .8, -2.2, 1.0], [-2.28, .5], [-2.15, .34, -2.28, .34]]), 1.56),
        at(rbox(1.25 + e * 2, .08, 1.42, .04), -.45, 1.66, 0), at(G.box, .62, 1.3, 0, .12, .62, 1.5), at(G.box, -.72, 1.3, 0, .12, .62, 1.5),
      ]),
      glass: extrude(st([[-1.45, .98], [.95, .98], [.25, 1.6, .55, 1.25], [-1.05, 1.62], [-1.45, .98, -1.35, 1.5]]), 1.26, .1),
      head: pair(rbox(.1, .16, .36, .04), 2.36 + e, .74, .58), tail: pair(rbox(.1, .14, .4, .04), -2.38 - e, .8, .58),
      wheels: [[1.38 + e, .86], [1.38 + e, -.86], [-1.42 - e, .86], [-1.42 - e, -.86]],
      colors: [0x15171c, 0xf4f1ea, 0xff7aa2, 0x15171c],
    };
  },
  // two wheels, a tank, a seat, and whoever is riding it
  bike: () => ({
    shell: mergeGeometries([at(rbox(.62, .3, .36, .1), .14, .86, 0), at(rbox(.52, .16, .3, .06), -.62, .88, 0), at(rbox(.5, .07, .2, .03), .8, .76, 0)]),
    trim: mergeGeometries([
      at(rbox(.56, .4, .32, .06), .02, .52, 0), at(rbox(.62, .1, .3, .04), -.34, .97, 0), at(rbox(.74, .09, .09, .03), -.5, .42, .2),
      tilt(rbox(.07, .84, .07, .02), .66, .72, .13, .37), tilt(rbox(.07, .84, .07, .02), .66, .72, -.13, .37), at(rbox(.06, .06, .72, .02), .5, 1.12, 0),
    ]),
    head: at(rbox(.12, .18, .2, .05), .72, .98, 0), tail: at(rbox(.06, .08, .2, .03), -.9, .9, 0),
    wheels: [[.8, 0, .9, .45], [-.74, 0, .9, .5]], lean: true,
    seat: { x: -.3, y: .27, z: 0 },
    colors: [0xe8455b, 0x23272e, 0x2bb3c0, 0xffd60a, 0x34e06b, 0xf4f1ea],
  }),
};
const built = {};
const shapeOf = (type) => built[type] || (built[type] = SHAPES[type]());

export function makeCarModel(type) {
  if (SHAPES[type]) return makeFromShape(type);
  const g = new THREE.Group(), chassis = new THREE.Group(); g.add(chassis);
  const col = type === 'taxi' ? 0xf6c21c : type === 'police' ? 0x1d2230 : choose(carColors);
  if (type === 'police') { mesh(bodyGeo, paint(col), null, null, chassis); mesh(liveryGeo, paint(0xf4f4f4), null, null, chassis); }
  else mesh(shellGeo, paint(col), null, null, chassis);
  mesh(cabGeo, mats.carGlass, null, null, chassis);
  const wheels = [];
  for (const [x, z] of [[1.38, .86], [1.38, -.86], [-1.42, .86], [-1.42, -.86]]) {
    const steer = new THREE.Group(); steer.position.set(x, .4, z); g.add(steer);
    const spin = new THREE.Group(); steer.add(spin);
    wheels.push({ steer, spin, front: x > 0, x, z });
  }
  const tail = std({ color: 0x550000, emissive: 0xff1a1a, emissiveIntensity: .5 });
  mesh(headGeo, mats.head, null, null, chassis, false); mesh(tailGeo, tail, null, null, chassis, false);
  let bar = null;
  if (type === 'taxi') {
    if (!taxiMat) {
      const t = ctex(128, (x, s) => { x.fillStyle = '#1b1d22'; x.fillRect(0, 0, s, s); x.fillStyle = '#ffd34d'; x.font = '900 44px Impact,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('TAXI', s / 2, s / 2); });
      taxiMat = std({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: .4 });
    }
    mesh(rbox(.3, .3, .9, .06), taxiMat, V(-.45, 1.86, 0), null, chassis);
  }
  if (type === 'police') {
    bar = [mesh(rbox(.32, .16, .5, .05), std({ color: 0x220000, emissive: 0xff2030, emissiveIntensity: 0 }), V(-.45, 1.8, .28), null, chassis),
    mesh(rbox(.32, .16, .5, .05), std({ color: 0x000022, emissive: 0x2050ff, emissiveIntensity: 0 }), V(-.45, 1.8, -.28), null, chassis)];
  }
  g.userData = { type, color: col, chassis, wheels, rear: wheels.filter(w => !w.front), bar, tail, seat: null, wheelKind: 'stand', wheelR: .4 };
  return dressCar(g);
}


function makeFromShape(type) {
  const S = shapeOf(type), g = new THREE.Group(), chassis = new THREE.Group(); g.add(chassis);
  const col = choose(S.colors);
  mesh(S.shell, paint(col), null, null, chassis);
  if (S.white) mesh(S.white, paint(0xf4f1ea), null, null, chassis);
  if (S.glass) mesh(S.glass, mats.carGlass, null, null, chassis);
  if (S.trim) mesh(S.trim, dark, null, null, chassis);
  const wheels = [];
  for (const [x, z, size = 1, width = 1] of S.wheels) {
    const steer = new THREE.Group(); steer.position.set(x, .4 * size, z); steer.scale.set(size, size, size * width); (S.lean ? chassis : g).add(steer);
    const spin = new THREE.Group(); steer.add(spin);
    wheels.push({ steer, spin, front: x > 0, x, z });
  }
  const tail = std({ color: 0x550000, emissive: 0xff1a1a, emissiveIntensity: .5 });
  mesh(S.head, mats.head, null, null, chassis, false); mesh(S.tail, tail, null, null, chassis, false);
  g.userData = { type, color: col, chassis, wheels, rear: wheels.filter(w => !w.front), bar: null, tail, seat: S.seat || null, wheelKind: 'stand', wheelR: .4 * (S.wheels[0][2] || 1) };
  return dressCar(g);
}
