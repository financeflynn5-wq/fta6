// Weapon meshes. Flynn's guns load from assets/weapons/<id>.gltf.json: self-contained glTF (barrel
// along +Z, grip down -Y), kept as .json so any static host, artifacts included, serves them.
// Until a file has loaded (or if it is missing) a plain stand-in is shown, and every gun already
// handed out swaps to the real model the moment it arrives.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadEmbeddedGltf } from '../core/embeddedGltf.js';
import { WEAPONS } from '../config.js';
import { litMaterials, std } from '../world/materials.js';

// Where the hand holds each gun, as fractions of its bounding box from the centre: [y, z].
const GRIP = { pistol: [-.22, -.22], smg: [-.18, -.02], shotgun: [-.12, -.12], burst: [-.18, -.02], sniper: [-.15, -.12] };
const real = {};          // id -> { scene, grip: Vector3, muzzle: Vector3 } once loaded
const holders = [];       // every gun handed out, so it can be upgraded when its model arrives
const standInMat = std({ color: 0x1d1f24, roughness: .45, metalness: .7 });

export function loadWeaponModels(base = 'assets/weapons/') {
  const loader = new GLTFLoader();
  const jobs = Object.keys(WEAPONS).filter(id => !WEAPONS[id].melee).map(id => loadEmbeddedGltf(base + id + '.gltf.json', loader).then(gltf => {
    const scene = gltf.scene, L = WEAPONS[id].length;
    const box = new THREE.Box3().setFromObject(scene), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const k = L / size.z; scene.scale.setScalar(k);
    scene.traverse(o => {
      if (!o.isMesh) return; o.castShadow = true; o.receiveShadow = false;
      if (!litMaterials.includes(o.material)) { o.material.envMapIntensity = .7; litMaterials.push(o.material); }
    });
    const [gy, gz] = GRIP[id] || [-.2, -.1];
    const grip = new THREE.Vector3(c.x, c.y + gy * size.y, c.z + gz * size.z).multiplyScalar(k);
    const muzzle = new THREE.Vector3(c.x, c.y + .12 * size.y, c.z + size.z / 2).multiplyScalar(k).sub(grip);
    real[id] = { scene, grip, muzzle };
    for (const h of holders) if (h.userData.id === id) fill(h);
  }).catch((e) => { console.warn('FTA 6: could not load the ' + id + ' model, showing a stand-in.', e); }));
  return Promise.all(jobs);
}

function fill(holder) {
  const id = holder.userData.id, r = real[id];
  holder.clear();
  if (r) {
    const m = r.scene.clone(); m.position.sub(r.grip); holder.add(m); holder.userData.muzzle.copy(r.muzzle);
  } else {
    const L = WEAPONS[id].length, body = new THREE.Mesh(new THREE.BoxGeometry(.07, .11, L), standInMat);
    body.position.set(0, .06, L * .3); body.castShadow = true; holder.add(body);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(.06, .16, .08), standInMat); grip.position.set(0, -.04, 0); grip.rotation.x = .25; holder.add(grip);
    holder.userData.muzzle.set(0, .08, L * .8);
  }
}

// A gun, posed so (0,0,0) is the grip and +Z is down the barrel. userData.muzzle is the barrel tip.
export function makeWeapon(id) {
  const holder = new THREE.Group(); holder.userData = { id, muzzle: new THREE.Vector3() };
  fill(holder); holders.push(holder); return holder;
}
export function dropWeapon(holder) { const i = holders.indexOf(holder); if (i >= 0) holders.splice(i, 1); holder.removeFromParent(); }
export const weaponLoaded = (id) => !!real[id];
