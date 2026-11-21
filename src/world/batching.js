// Draw-call savers. A city made of thousands of little boxes is slow to draw one by one,
// so static pieces are welded together (per city block, per material) once at load.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Plain painted pieces (one colour times at most one shared picture, no glow) differ only in colour, so the colour can ride on the
// pieces themselves and one material can draw them all. Each city chunk used to take a draw for every paint pot used in
// it, about 110 across the map; now it takes one per finish (how shiny, how metallic). Same picture, far fewer draws.
// Materials the game changes while it runs are never plain by this test (they glow or are see-through; a material that
// swaps its picture or colour at run time sets userData.live). The facades, nine colours over one plaster picture, merge the same way.
const MAPS = ['emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'lightMap', 'bumpMap', 'alphaMap', 'displacementMap', 'envMap'];
const shared = new Map();
export function plainFinish(mt, std) {
  if (!std) return null;
  if (!mt || mt.type !== 'MeshStandardMaterial' || mt.vertexColors || mt.transparent || mt.opacity !== 1 || mt.polygonOffset || mt.flatShading || mt.wireframe || mt.alphaTest || mt.userData.live) return null;
  if (MAPS.some(k => mt[k]) || mt.emissive.r || mt.emissive.g || mt.emissive.b || !mt.depthWrite || !mt.depthTest || !mt.fog || mt.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) return null;
  const key = [mt.map?.uuid, mt.roughness, mt.metalness, mt.side, mt.shadowSide, mt.toneMapped, mt.dithering].join('|');
  let m = shared.get(key);
  if (!m) shared.set(key, m = std({ vertexColors: true, map: mt.map, roughness: mt.roughness, metalness: mt.metalness, side: mt.side, shadowSide: mt.shadowSide, toneMapped: mt.toneMapped, dithering: mt.dithering }));
  return m;
}
const painted = (g, c) => { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };

// A copy of a mesh's geometry, moved by `matrix`, with just position/normal/uv so any two can be merged.
export function plainGeometry(geo, matrix) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  g.morphAttributes = {}; g.clearGroups();
  if (matrix) g.applyMatrix4(matrix);
  return g;
}

// Weld every mesh under `root` into a few big meshes and add those to `scene`.
// chunkOf(x, z) names the chunk a top-level object belongs to (keeps culling useful).
// `std` (from materials.js, passed in so this file adds no import that would change the order the seeded textures are made in)
// lets plain pieces share materials; without it every material keeps its own draws as before.
export function bakeStatic(root, scene, chunkOf, std) {
  root.updateMatrixWorld(true);
  const buckets = new Map();
  for (const top of root.children) {
    const chunk = chunkOf(top.position.x, top.position.z);
    top.traverse(o => {
      if (!o.isMesh) return;
      const finish = plainFinish(o.material, std), mt = finish || o.material;
      const key = chunk + '|' + mt.uuid + '|' + (o.castShadow ? 1 : 0);
      let b = buckets.get(key); if (!b) buckets.set(key, b = { material: mt, cast: o.castShadow, list: [] });
      const g = plainGeometry(o.geometry, o.matrixWorld);
      b.list.push(finish ? painted(g, o.material.color) : g);
    });
  }
  const made = [];
  for (const b of buckets.values()) {
    const m = new THREE.Mesh(mergeGeometries(b.list), b.material);
    m.castShadow = b.cast; m.receiveShadow = true; m.matrixAutoUpdate = false; scene.add(m);
    m.geometry.computeBoundingSphere(); made.push(m);
    b.list.forEach(g => g.dispose());
  }
  return made;      // each has a bounding sphere, so the world can skip the ones lost in the haze
}
