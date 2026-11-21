// A character is a hundred little shapes hung on twenty joints. Drawn one by one that is far too many
// draw calls for a street full of citizens, so each character is welded into a few skinned meshes:
// one per material, every shape following the joint (group) it was built on. Plain cloth and fur
// share one vertex-coloured material and plain metal another, so most of a character is two draws.
import * as THREE from 'three';
import { std } from '../world/materials.js';

const matteShared = std({ vertexColors: true, roughness: .82 }), metalShared = std({ vertexColors: true, roughness: .4, metalness: .85 });
const _m = new THREE.Matrix4(), _n = new THREE.Matrix3(), _v = new THREE.Vector3(), IDENTITY = new THREE.Matrix4();
const BOUNDS = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 3.2);       // roomy enough for a character lying down or mid-tumble

export function weld(root) {
  root.updateMatrixWorld(true);
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const parts = []; root.traverse(o => { if (o.isMesh) parts.push(o); });
  const bones = [], boneId = new Map(), buckets = new Map();
  const boneOf = (g) => { let i = boneId.get(g); if (i === undefined) { boneId.set(g, i = bones.length); bones.push(g); } return i; };
  for (const m of parts) {
    const mt = m.material, plain = !mt.map && !mt.transparent && mt.emissive.getHex() === 0;
    const target = plain && mt.metalness >= .5 ? metalShared : plain && mt.metalness === 0 && mt.roughness >= .4 ? matteShared : mt;
    let b = buckets.get(target); if (!b) buckets.set(target, b = { list: [], verts: 0, idx: 0 });
    const g = m.geometry;
    b.list.push({ g, matrix: new THREE.Matrix4().multiplyMatrices(toRoot, m.matrixWorld), bone: boneOf(m.parent), color: target !== mt ? mt.color : null });
    b.verts += g.attributes.position.count; b.idx += g.index ? g.index.count : g.attributes.position.count;
    m.parent.remove(m);
  }
  if (bones.length > 255) throw new Error('character has too many joints');
  const skeleton = new THREE.Skeleton(bones);
  const made = [];
  for (const [mt, b] of buckets) {
    const pos = new Float32Array(b.verts * 3), nor = new Float32Array(b.verts * 3), uv = mt.map ? new Float32Array(b.verts * 2) : null;
    const col = mt.vertexColors ? new Uint16Array(b.verts * 3) : null, si = new Uint8Array(b.verts * 4), sw = new Uint8Array(b.verts * 4);
    const idx = b.verts > 65535 ? new Uint32Array(b.idx) : new Uint16Array(b.idx);
    let v0 = 0, i0 = 0;
    for (const p of b.list) {
      const gp = p.g.attributes.position, gn = p.g.attributes.normal, gu = p.g.attributes.uv, n = gp.count;
      _n.getNormalMatrix(p.matrix);
      for (let i = 0; i < n; i++) {
        const k = (v0 + i) * 3;
        _v.fromBufferAttribute(gp, i).applyMatrix4(p.matrix); pos[k] = _v.x; pos[k + 1] = _v.y; pos[k + 2] = _v.z;
        _v.fromBufferAttribute(gn, i).applyMatrix3(_n).normalize(); nor[k] = _v.x; nor[k + 1] = _v.y; nor[k + 2] = _v.z;
        if (uv && gu) { uv[(v0 + i) * 2] = gu.getX(i); uv[(v0 + i) * 2 + 1] = gu.getY(i); }
        if (col) { col[k] = Math.round(p.color.r * 65535); col[k + 1] = Math.round(p.color.g * 65535); col[k + 2] = Math.round(p.color.b * 65535); }
        si[(v0 + i) * 4] = p.bone; sw[(v0 + i) * 4] = 255;
      }
      if (p.g.index) { const gi = p.g.index; for (let i = 0; i < gi.count; i++) idx[i0 + i] = gi.getX(i) + v0; i0 += gi.count; }
      else { for (let i = 0; i < n; i++) idx[i0 + i] = v0 + i; i0 += n; }
      v0 += n;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    if (uv) geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    if (col) geo.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4, true));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.boundingSphere = BOUNDS.clone();
    const sk = new THREE.SkinnedMesh(geo, mt); sk.castShadow = sk.receiveShadow = true;
    root.add(sk); sk.bind(skeleton, IDENTITY); sk.boundingSphere = BOUNDS.clone();
    made.push(sk);
  }
  // callers free a character by disposing its meshes' geometry: the skeleton's little texture goes with the first of them
  if (made[0]) made[0].geometry.addEventListener('dispose', () => skeleton.dispose());
  root.userData.skeleton = skeleton;
  return root;
}
