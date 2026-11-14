// Car meshes, straight from the concept: one rounded body, glass cab, chrome wheels.
// Structure: group -> chassis (leans and dips) + 4 wheels (steer + spin).
import * as THREE from 'three';
import { V, choose } from '../core/utils.js';
import { mats, std, paint, G, mesh, rbox, ctex } from '../world/materials.js';
import { plainGeometry } from '../world/batching.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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

// All wheels in the city are drawn in two calls. Cars borrow four slots each.
export function createWheelBatch(scene, capacity = 640) {
  const tires = new THREE.InstancedMesh(wheelGeo, mats.tire, capacity), hubs = new THREE.InstancedMesh(hubGeo, mats.rim, capacity);
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0), free = [];
  for (let i = capacity - 4; i >= 0; i -= 4) free.push(i);
  for (const im of [tires, hubs]) { im.castShadow = im.receiveShadow = true; im.frustumCulled = false; for (let i = 0; i < capacity; i++) im.setMatrixAt(i, hidden); scene.add(im); }
  return {
    alloc: () => free.pop() ?? -1,
    release(slot) { if (slot < 0) return; for (let i = 0; i < 4; i++) { tires.setMatrixAt(slot + i, hidden); hubs.setMatrixAt(slot + i, hidden); } free.push(slot); },
    set(i, m) { tires.setMatrixAt(i, m); hubs.setMatrixAt(i, m); },
    commit() { tires.instanceMatrix.needsUpdate = true; hubs.instanceMatrix.needsUpdate = true; },
  };
}

export function makeCarModel(type) {
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
  g.userData = { chassis, wheels, bar, tail };
  return g;
}
