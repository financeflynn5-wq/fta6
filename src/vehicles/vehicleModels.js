// Vehicle models built in Blender (sources: /mnt/project-files/models/vehicles/src). Each type loads from
// assets/vehicles/<file>.gltf.json: geometry embedded, kept as .json so any static host serves it, read
// through loadEmbeddedGltf (nothing fetched but the file). The files carry no pictures: all of them share
// one texture atlas (atlas_color / atlas_mr / atlas_emit .png, loaded once as images) through one "details"
// material: trim, lamps, badges, plates and the wheels. Body materials are swapped for the game's own:
// paint -> paint(colour), paint2 -> the white second paint, glass -> mats.carGlass, light_tail -> the car's
// brake-light material, light_red / light_blue -> the cruiser's light bar.
// Until a model has loaded (or if its file is missing) carModel.js's stand-in shows, and every car already
// on the road swaps to the real model the moment it arrives.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadEmbeddedGltf } from '../core/embeddedGltf.js';
import { mats, std, paint } from '../world/materials.js';

// game type -> model file and wheel kind. Wheel radius per kind (m): the spin rate follows it.
const MODELS = {
  car: ['sedan', 'std'], taxi: ['taxi', 'std'], police: ['police', 'std'], limo: ['limo', 'std'],
  sport: ['sport', 'sport'], van: ['van', 'std'], truck: ['truck', 'truck'], bike: ['bike', 'bike'],
};
const WHEEL_R = { std: .4, sport: .4, truck: .52, bike: .36 };
const BIKE_SEAT = { x: -.3, y: .27, z: 0 };        // character root on the saddle (seat top .98, hips .71 above the root)
const SECOND_PAINT = 0xf4f4f4;

const real = {};          // type -> { parts: [[geometry, material name]], wheels: [{ x, y, z, front }], fork }
const wheelGeos = {};     // wheel kind -> geometry (one mesh, the "details" material)
const waiting = [];       // stand-ins on the road, upgraded when their model arrives
let details = null;

// The shared atlas material. Its glow follows the headlights (dim by day, bright at night).
function detailsMaterial(base) {
  if (details) return details;
  const tl = new THREE.TextureLoader();
  const tex = (file, srgb) => { const t = tl.load(base + file); t.flipY = false; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  const mr = tex('atlas_mr.png', false);
  details = std({ map: tex('atlas_color.png', true), roughnessMap: mr, metalnessMap: mr, roughness: 1, metalness: 1, emissive: 0xffffff, emissiveMap: tex('atlas_emit.png', true) });
  Object.defineProperty(details, 'emissiveIntensity', { get: () => mats.head.emissiveIntensity * 1.5, set() {} });
  return details;
}

export function loadVehicleModels(base = 'assets/vehicles/') {
  const loader = new GLTFLoader();
  detailsMaterial(base);
  const files = {};
  for (const [type, [file]] of Object.entries(MODELS)) (files[file] ||= []).push(type);
  const jobs = Object.entries(files).map(([file, types]) => loadEmbeddedGltf(base + file + '.gltf.json', loader).then(gltf => {
    const [, kind] = MODELS[types[0]];
    let body = null, fork = null; const wheels = [];
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(node => {
      const name = node.userData.name || '';             // the node names as written in Blender
      if (name === 'body') body = node;
      else if (name === 'fork') fork = node;
      else if (name.startsWith('wheel_')) {
        const p = node.getWorldPosition(new THREE.Vector3());
        wheels.push({ x: p.x, y: p.y, z: p.z, front: p.x > 0 });
        node.traverse(o => { if (o.isMesh && !wheelGeos[kind]) wheelGeos[kind] = o.geometry; });
      }
    });
    if (!body || !wheels.length) return;
    const model = { parts: meshParts(body), wheels, kind };
    if (fork) model.fork = { parts: meshParts(fork), head: fork.getWorldPosition(new THREE.Vector3()) };
    for (const t of types) real[t] = model;
    for (let i = waiting.length - 1; i >= 0; i--) if (real[waiting[i].userData.type]) upgrade(waiting.splice(i, 1)[0]);
  }).catch(() => { /* no file yet: keep the stand-in */ }));
  return Promise.all(jobs);
}

// [geometry, material name] for every mesh under a node, baked into the node's own frame.
function meshParts(node) {
  node.updateMatrixWorld(true);
  const inv = node.matrixWorld.clone().invert(), out = [];
  node.traverse(o => {
    if (!o.isMesh) return;
    const m = inv.clone().multiply(o.matrixWorld), g = m.equals(new THREE.Matrix4()) ? o.geometry : o.geometry.clone().applyMatrix4(m);
    out.push([g, o.material.name]);
  });
  return out;
}

// What carModel.js's wheel batch draws for a wheel kind.
export const wheelParts = (kind) => [[wheelGeos[kind], details]];
export const vehicleLoaded = (type) => !!real[type];

// Called by makeCarModel with its finished stand-in: dressed now if the model is in, or as soon as it arrives.
export function dressCar(g) {
  if (real[g.userData.type]) upgrade(g); else waiting.push(g);
  return g;
}

// Swap a stand-in for the real model, in place: the same group, chassis, tail and light-bar materials,
// so a car that is already driving (or has a rider on it) just changes its look.
function upgrade(g) {
  const u = g.userData, M = real[u.type], chassis = u.chassis;
  for (const w of u.wheels) w.steer.removeFromParent();
  for (const o of [...chassis.children]) if (o.isMesh) chassis.remove(o);      // a seated rider is a group and stays
  const red = u.bar?.[0].material, blue = u.bar?.[1].material, bar = [];
  const material = (name) => {
    switch (name) {
      case 'paint': return paint(u.color);
      case 'paint2': return paint(SECOND_PAINT);
      case 'glass': return mats.carGlass;
      case 'light_tail': return u.tail;
      case 'light_red': return red || u.tail;
      case 'light_blue': return blue || details;
      default: return details;
    }
  };
  const add = (parts, parent) => {
    for (const [geo, name] of parts) {
      const m = new THREE.Mesh(geo, material(name)), lamp = name.startsWith('light_');
      m.castShadow = !lamp && name !== 'glass'; m.receiveShadow = true; parent.add(m);
      if (name === 'light_red') bar[0] = m; else if (name === 'light_blue') bar[1] = m;
    }
  };
  add(M.parts, chassis);

  const bike = !!M.fork, wheels = [];
  for (const w of M.wheels) {
    if (bike && w.front) {
      // The fork turns about the raked steering axis: a pivot at the steering head tilted onto the axis,
      // the steer group turns about the pivot's y, and the fork and wheel are drawn back in the chassis frame.
      const head = M.fork.head, axle = new THREE.Vector3(w.x, w.y, w.z), rake = Math.atan2(axle.x - head.x, head.y - axle.y);
      const pivot = new THREE.Group(); pivot.position.copy(head); pivot.rotation.z = rake; chassis.add(pivot);
      const steer = new THREE.Group(); pivot.add(steer);
      const fork = new THREE.Group(); fork.rotation.z = -rake; steer.add(fork); add(M.fork.parts, fork);
      const spin = new THREE.Group(); spin.position.copy(axle.sub(head).applyAxisAngle(new THREE.Vector3(0, 0, 1), -rake)); steer.add(spin);
      wheels.push({ steer, spin, front: true, x: w.x, z: w.z });
    } else {
      const steer = new THREE.Group(); steer.position.set(w.x, w.y, w.z); (bike ? chassis : g).add(steer);
      const spin = new THREE.Group(); steer.add(spin);
      wheels.push({ steer, spin, front: w.front, x: w.x, z: w.z });
    }
  }
  Object.assign(u, {
    wheels, rear: wheels.filter(w => !w.front), bar: bar.length === 2 ? bar : null,
    seat: bike ? { ...BIKE_SEAT } : u.seat, wheelKind: M.kind, wheelR: WHEEL_R[M.kind], model: true,
  });
}
