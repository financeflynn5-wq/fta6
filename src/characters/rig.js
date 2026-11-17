// The body every character is built on (two legs, a torso, two arms, a head to hang things on)
// and the little helpers the cast families share. A family adds its own head and outfit.
import * as THREE from 'three';
import { V } from '../core/utils.js';
import { std, G, mesh, rbox, cap } from '../world/materials.js';

export const cache = {};
export const mat = (c, r = .7, m = 0) => cache[c + '/' + r + '/' + m] || (cache[c + '/' + r + '/' + m] = std({ color: c, roughness: r, metalness: m }));
export const glow = (c, i) => std({ color: 0x000000, emissive: c, emissiveIntensity: i });
export const eyeW = mat(0xffffff, .15), eyeB = mat(0x0d0d10, .05), gold = mat(0xffd34d, .3, 1);
export const cone = (r, h, seg = 12) => new THREE.ConeGeometry(r, h, seg);
export const M = (geo, m, p, s, parent, rot) => { const o = mesh(geo, m, p, s, parent); if (rot) o.rotation.set(...rot); return o; };

// legMat: bare legs under shorts or a skirt (pants then only dress the hips).
export function rig({ shirt, pants, shoes, skin, headY = 1.66, armMat, legMat }) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const legs = [], arms = [];
  for (const s of [-1, 1]) {
    const h = new THREE.Group(); h.position.set(s * .16, .74, 0); body.add(h);
    M(cap(.11, .42), legMat || pants, V(0, -.3, 0), null, h); M(rbox(.24, .14, .36, .06), shoes, V(0, -.66, .06), null, h); legs.push(h);
  }
  M(cap(.3, .34), shirt, V(0, 1.08, 0), V(1, 1, .88), body);
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * .36, 1.3, 0); sh.rotation.z = s * .12; body.add(sh);
    M(cap(.085, .36), armMat || shirt, V(0, -.22, 0), null, sh); M(G.sph, skin, V(0, -.47, 0), .1, sh); arms.push(sh);
  }
  const head = new THREE.Group(); head.position.set(0, headY, 0); body.add(head);
  root.userData = { legs, arms, head, body, pupils: [], phase: Math.random() * 6, lie: 0 };
  return root;
}

const glint = new THREE.SphereGeometry(1, 8, 6);       // the speck of light in each eye
// Two googly eyes. The pupils stay loose (not welded) and remember where they sit, so they can jiggle.
export function googlyEyes(head, y = .06, z = .27, s = 1, gap = .13) {
  const pupils = [];
  for (const k of [-1, 1]) {
    M(G.sph, eyeW, V(k * gap, y, z), V(.11 * s, .12 * s, .08 * s), head);
    const p = M(G.sph, eyeB, V(k * gap, y - .01, z + .07 * s), V(.055 * s, .06 * s, .03 * s), head);
    p.userData = { live: true, bx: k * gap, by: y - .01, amp: s }; pupils.push(p);
    M(glint, eyeW, V(k * gap + .02 * s, y + .02 * s, z + .1 * s), .016 * s, head);
  }
  return pupils;
}
