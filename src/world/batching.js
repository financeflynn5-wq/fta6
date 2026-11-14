// Draw-call savers. A city made of thousands of little boxes is slow to draw one by one,
// so static pieces are welded together (per city block, per material) once at load.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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
export function bakeStatic(root, scene, chunkOf) {
  root.updateMatrixWorld(true);
  const buckets = new Map();
  for (const top of root.children) {
    const chunk = chunkOf(top.position.x, top.position.z);
    top.traverse(o => {
      if (!o.isMesh) return;
      const key = chunk + '|' + o.material.uuid + '|' + (o.castShadow ? 1 : 0);
      let b = buckets.get(key); if (!b) buckets.set(key, b = { material: o.material, cast: o.castShadow, list: [] });
      b.list.push(plainGeometry(o.geometry, o.matrixWorld));
    });
  }
  for (const b of buckets.values()) {
    const m = new THREE.Mesh(mergeGeometries(b.list), b.material);
    m.castShadow = b.cast; m.receiveShadow = true; m.matrixAutoUpdate = false; scene.add(m);
    b.list.forEach(g => g.dispose());
  }
}
