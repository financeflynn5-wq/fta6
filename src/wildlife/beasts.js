// The animals: the sharks out at sea and everything that lives at Sunset Zoo (lions, bears, elephants,
// giraffes, zebras, hippos, gorillas, penguins). Built from smooth lofted bodies and round shapes in the
// same chunky, googly-eyed style as the Critters, then welded so each animal is a handful of meshes.
//   makeBeast(kind, opt)                     a model, standing at its feet, facing +z
//   animateBeast(model, t, dt, speed, pose)  walks it, and plays 'idle', 'graze', 'rear', 'bite', 'ko'
// Every four-legged animal shares one rig: hind legs and tail hang off the hips, and everything in front
// (chest, front legs, neck, head) hangs off a spine that can swing up, so bears and gorillas can stand.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { std, rbox, ctex } from '../world/materials.js';
import { plainGeometry } from '../world/batching.js';
import { body as loftBody, loft } from '../vehicles/loft.js';

const PI = Math.PI, TAU = PI * 2;
const caps = {}, cap = (r, l) => caps[r + ',' + l] || (caps[r + ',' + l] = new THREE.CapsuleGeometry(r, l, 4, 12));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e3 = new THREE.Euler(), P3 = new THREE.Vector3(), S3 = new THREE.Vector3(), tc = new THREE.Color(), tc2 = new THREE.Color();

// ---------- materials: plain fur and hide share one vertex-coloured material; patterned coats bring their own ----------
const MATTE = std({ vertexColors: true, roughness: .8 });
const WET = std({ vertexColors: true, roughness: .3, metalness: .08 });                // sharks, hippos, penguins: just out of the water
const GOLD = std({ color: 0xe2b860, roughness: .28, metalness: .85 });                 // the statues at the zoo gate
let zebraSkin = null, giraffeSkin = null;
function coats() {
  if (zebraSkin) return;
  let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  zebraSkin = std({
    roughness: .8, map: ctex(256, (x, S) => {
      x.fillStyle = '#f4f1ea'; x.fillRect(0, 0, S, S); x.fillStyle = '#1d1c1f';
      for (let i = 0; i < 8; i++) {            // wobbly bands, so no two stripes are the same width
        const x0 = (i + .22) * S / 8; x.beginPath(); x.moveTo(x0 + (r() - .5) * 6, 0);
        for (let y = 0; y <= S; y += 32) x.lineTo(x0 + Math.sin(y * .05 + i) * 4 + (r() - .5) * 3, y);
        for (let y = S; y >= 0; y -= 32) x.lineTo(x0 + S / 16 + Math.sin(y * .05 + i * 2) * 4 + (r() - .5) * 3, y);
        x.closePath(); x.fill();
      }
    }),
  });
  giraffeSkin = std({
    roughness: .82, map: ctex(256, (x, S) => {
      x.fillStyle = '#f3e2b4'; x.fillRect(0, 0, S, S); x.fillStyle = '#b5672c';
      const n = 4, c = S / n, pts = [];
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) pts.push([(i + .5 + (r() - .5) * .34) * c, (j + .5 + (r() - .5) * .34) * c, r()]);
      for (const [px, py, k] of pts) for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {      // drawn nine times over, so the sheet tiles
        x.beginPath(); const sides = 6;
        for (let a = 0; a < sides; a++) { const ang = a / sides * TAU + k * 3, rad = c * (.36 + ((a * 7 + Math.floor(k * 10)) % 3) * .035); const X = px + ox + Math.cos(ang) * rad, Y = py + oy + Math.sin(ang) * rad; a ? x.lineTo(X, Y) : x.moveTo(X, Y); }
        x.closePath(); x.fill();
      }
    }),
  });
}

// ---------- putting shapes together ----------
// put(group, shape, colour, x, y, z, sx, sy, sz, rx, ry, rz). colour = a number, a function (x, y, z, colour) for
// two-tone fur, or a material of its own. Nothing is drawn until seal() welds each group's shapes.
function put(g, geo, col, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) {
  if (geo === SPH && Math.max(sx, sy, sz) < .1) geo = SPL;            // small things get a coarser ball
  const out = plainGeometry(geo, m4.compose(P3.set(x, y, z), q4.setFromEuler(e3.set(rx, ry, rz)), S3.set(sx, sy, sz)));
  if (!out.attributes.normal) out.computeVertexNormals();
  const own = col && col.isMaterial;
  if (!own) {
    const n = out.attributes.position.count, a = new Float32Array(n * 3), p = out.attributes.position;
    if (typeof col === 'function') for (let i = 0; i < n; i++) { col(p.getX(i), p.getY(i), p.getZ(i), tc); a[i * 3] = tc.r; a[i * 3 + 1] = tc.g; a[i * 3 + 2] = tc.b; }
    else { tc.set(col); for (let i = 0; i < n; i++) { a[i * 3] = tc.r; a[i * 3 + 1] = tc.g; a[i * 3 + 2] = tc.b; } }
    out.setAttribute('color', new THREE.Float32BufferAttribute(a, 3));
  }
  (g.userData.parts ||= []).push([out, own ? col : null]);
  return g;
}
const both = (g, geo, col, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => { put(g, geo, col, x, y, z, sx, sy, sz, rx, ry, rz); put(g, geo, col, -x, y, z, sx, sy, sz, rx, -ry, -rz); };
const grp = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
function seal(root, skin = MATTE, override = null) {
  const groups = []; root.traverse(o => { if (o.userData.parts) groups.push(o); });
  for (const g of groups) {
    const buckets = new Map();
    for (const [geo, own] of g.userData.parts) {
      const mat = override || own || skin; if (override) geo.deleteAttribute('color');
      if (!buckets.has(mat)) buckets.set(mat, []); buckets.get(mat).push(geo);
    }
    for (const [mat, list] of buckets) { const m = new THREE.Mesh(list.length > 1 ? mergeGeometries(list) : list[0], mat); m.castShadow = m.receiveShadow = true; g.add(m); if (list.length > 1) list.forEach(x => x.dispose()); }
    delete g.userData.parts;
  }
  return root;
}
// A copy of a shape with its texture turned or stretched (stripes that should run round a leg, not down it).
const uvCache = new Map();
function uv(geo, swap, su = 1, sv = 1) {
  const k = geo.uuid + swap + su + ',' + sv; if (uvCache.has(k)) return uvCache.get(k);
  const g = geo.clone(), a = g.attributes.uv;
  for (let i = 0; i < a.count; i++) { const u = a.getX(i), v = a.getY(i); a.setXY(i, (swap ? v : u) * su, (swap ? u : v) * sv); }
  uvCache.set(k, g); return g;
}
// A capsule whose texture runs in even rings along its length (`per` copies per metre) and `around` copies round it.
function ring(geo, per, around = 1) {
  const k = geo.uuid + 'r' + per + ',' + around; if (uvCache.has(k)) return uvCache.get(k);
  const g = geo.clone(), a = g.attributes.uv, p = g.attributes.position;
  for (let i = 0; i < a.count; i++) a.setXY(i, p.getY(i) * per, a.getX(i) * around);
  uvCache.set(k, g); return g;
}
const SPH = new THREE.SphereGeometry(1, 18, 12), SPL = new THREE.SphereGeometry(1, 10, 7), CYL = new THREE.CylinderGeometry(1, 1, 1, 14), cone = (seg = 10) => coneCache[seg] || (coneCache[seg] = new THREE.ConeGeometry(1, 1, seg)), coneCache = {};
const two = (top, low, y0, soft = .07) => { const a = new THREE.Color(top), b = new THREE.Color(low); return (x, y, z, c) => c.copy(b).lerp(a, smooth(y0 - soft, y0 + soft, y)); };
// A lofted torso from stations [z forward, y of its middle, half width, reach above, reach below, squareness].
function torso(stations, seg = 18, step = .11) { const g = loft(loftBody(stations), { seg, step }); g.rotateY(-PI / 2); return g; }
// Two eyes: a white ball, a dark pupil and a speck of light, looking the way the head faces.
function eyes(head, x, y, z, s = 1, out = .25) {
  for (const k of [-1, 1]) {
    put(head, SPH, 0xffffff, k * x, y, z, .07 * s, .078 * s, .055 * s, 0, k * out, 0);
    put(head, SPH, 0x0d0d10, k * (x + .012 * s * out * 4), y - .004 * s, z + .034 * s, .038 * s, .042 * s, .028 * s, 0, k * out, 0);
    put(head, SPH, 0xffffff, k * (x + .02 * s) + .012 * s, y + .018 * s, z + .056 * s, .011 * s);
  }
}
// One leg: an upper part on the hip and a lower part on the knee, ending in whatever foot() adds.
function leg(parent, x, y, z, up, low, r1, r2, col, foot, lowCol = col, deep = 1.15) {
  const hip = grp(parent, x, y, z), knee = grp(hip, 0, -up, 0);
  put(hip, col.isMaterial ? ring(cap(r1, Math.max(.02, up - r1 * .6)), col.userData.per, col.userData.round) : cap(r1, Math.max(.02, up - r1 * .6)), col, 0, -up / 2 + r1 * .2, 0, 1, 1, deep);
  put(knee, lowCol.isMaterial ? ring(cap(r2, Math.max(.02, low - r2)), lowCol.userData.per, lowCol.userData.round) : cap(r2, Math.max(.02, low - r2)), lowCol, 0, -low / 2 + r2 * .1, 0);
  foot(knee, low);
  hip.userData.knee = knee; hip.userData.len = up + low; return hip;
}
// A tail of a few joints that can swish: returns the joints. Hangs from (x, y, z), each joint `len` long.
function tail(parent, y, z, n, len, r, col, droop = .9, tip = null) {
  const segs = []; let at = grp(parent, 0, y, z); at.rotation.x = -PI / 2 - droop;       // pointing back and down
  for (let i = 0; i < n; i++) {
    put(at, cap(r * (1 - i * .12), len), col, 0, len / 2, 0); segs.push(at);
    if (i === n - 1 && tip) tip(at, len); else if (i < n - 1) { at = grp(at, 0, len, 0); at.rotation.x = .22; }
  }
  return segs;
}

// The rig every four-legged animal stands on. Returns the groups to hang things from.
function quad(kind, hipY, hipZ, o = {}) {
  const root = new THREE.Group(), body = grp(root), spine = grp(body, 0, hipY, hipZ);
  root.userData = { kind, rig: 'quad', body, spine, legs: [], tail: [], ears: [], trunk: [], phase: Math.random() * 6, rear: 0, graze: 0, bite: 0, lie: 0, look: 0, hipY, hipZ, ...o };
  // things in front of the hips are placed in the animal's own frame, then moved onto the spine
  const S = (x, y, z) => grp(spine, x, y - hipY, z - hipZ);
  return { root, body, spine, u: root.userData, S };
}

// ---------------------------------------------------------------------------------------------------------
function lion(male) {
  const fur = 0xd6a24c, pale = 0xf0dcae, dark = 0x6e4420, R = quad(male ? 'lion' : 'lioness', .74, -.5, { stride: .95, halfW: .3, r: .62, h: 1.25, eye: 1.05, rearMax: .5 }), { u, S } = R;
  const chest = S(0, 0, 0);
  put(chest, torso([[-.84, .8, .04, .04, .04], [-.68, .8, .21, .2, .2], [-.35, .78, .245, .22, .24], [.1, .77, .25, .23, .26], [.46, .8, .275, .27, .3], [.7, .86, .2, .22, .24], [.84, .9, .07, .1, .1]]), two(fur, pale, .64), 0, 0, 0);
  const paw = (c) => (k, low) => { put(k, SPH, c, 0, -low + .05, .05, .105, .07, .14); };
  u.legs.push(leg(S(0, 0, 0), .2, .74, .5, .37, .37, .1, .075, fur, paw(pale)), leg(S(0, 0, 0), -.2, .74, .5, .37, .37, .1, .075, fur, paw(pale)));
  u.legs.push(leg(R.body, .19, .76, -.5, .4, .36, .115, .075, fur, paw(pale)), leg(R.body, -.19, .76, -.5, .4, .36, .115, .075, fur, paw(pale)));
  u.tail = tail(R.body, .86, -.8, 3, .27, .034, fur, .75, (t, l) => put(t, SPH, dark, 0, l + .06, 0, .07, .11, .07));
  const neck = S(0, .9, .7); neck.rotation.x = .75; u.neck = neck; u.neckRest = .75;
  put(neck, cap(.17, .2), fur, 0, .13, 0);
  const head = grp(neck, 0, .32, 0); head.rotation.x = -.75; u.head = head; u.headRest = -.75;
  put(head, SPH, fur, 0, 0, .02, .235, .22, .24); put(head, SPH, pale, 0, -.075, .2, .15, .115, .15);
  put(head, SPH, 0x3a2a22, 0, -.03, .345, .055, .04, .04); put(head, SPH, pale, 0, -.02, .12, .12, .16, .16);
  both(head, SPH, male ? dark : fur, .17, .2, -.02, .08, .085, .045); both(head, SPH, 0x5b3a28, .17, .2, .0, .045, .05, .03);
  eyes(head, .105, .07, .185, 1.05);
  const jaw = grp(head, 0, -.13, .08); u.jaw = jaw; u.jawMax = .7;
  put(jaw, SPH, pale, 0, -.02, .12, .12, .05, .14); put(jaw, SPH, 0xb8434f, 0, .012, .12, .095, .02, .115);
  for (const s of [-1, 1]) { put(jaw, cone(6), 0xffffff, s * .075, .05, .215, .018, .06, .018); put(head, cone(6), 0xffffff, s * .085, -.15, .3, .02, .075, .02, PI); }
  if (male) {          // the mane: a ruff of dark tufts round the face and down the chest
    for (let i = 0; i < 11; i++) { const a = i / 11 * TAU + .28, big = .15 + (i % 3) * .018; put(head, SPH, i % 2 ? dark : 0x8a5a2c, Math.cos(a) * .25, Math.sin(a) * .25 + .01, -.07 - (i % 2) * .04, big, big, .16); }
    put(head, SPH, dark, 0, .06, -.2, .3, .3, .2); put(neck, SPH, dark, 0, .08, .06, .26, .22, .25); put(neck, SPH, 0x8a5a2c, 0, -.03, .16, .2, .2, .16);
  }
  return seal(R.root);
}

function bear() {
  const fur = 0x7a5133, pale = 0xcaa67a, dark = 0x4a2f1e, R = quad('bear', .76, -.56, { stride: 1, halfW: .38, r: .78, h: 1.5, eye: 1.2, rearMax: 1.12 }), { u, S } = R;
  const chest = S(0, 0, 0);
  put(chest, torso([[-.92, .86, .05, .05, .05], [-.74, .87, .31, .3, .3], [-.3, .86, .37, .36, .36], [.25, .89, .37, .39, .37], [.62, .92, .31, .33, .33], [.88, .94, .1, .12, .12]]), two(fur, 0x8a6040, .62), 0, 0, 0);
  put(chest, SPH, fur, 0, 1.2, .32, .27, .17, .3);                                        // the grizzly's hump
  const paw = (k, low) => { put(k, SPH, dark, 0, -low + .06, .06, .16, .085, .2); for (const s of [-1, 0, 1]) put(k, cone(5), 0xe9e1d3, s * .08, -low + .04, .25, .022, .08, .022, PI / 2); };
  u.legs.push(leg(S(0, 0, 0), .26, .76, .5, .38, .38, .155, .13, fur, paw), leg(S(0, 0, 0), -.26, .76, .5, .38, .38, .155, .13, fur, paw));
  u.legs.push(leg(R.body, .25, .78, -.56, .4, .38, .17, .13, fur, paw), leg(R.body, -.25, .78, -.56, .4, .38, .17, .13, fur, paw));
  put(R.body, SPH, fur, 0, .92, -.92, .09, .08, .09);
  const neck = S(0, .96, .78); neck.rotation.x = .95; u.neck = neck; u.neckRest = .95; put(neck, cap(.22, .14), fur, 0, .1, 0);
  const head = grp(neck, 0, .3, 0); head.rotation.x = -.95; u.head = head; u.headRest = -.95;
  put(head, SPH, fur, 0, 0, 0, .27, .25, .26); put(head, SPH, pale, 0, -.065, .22, .135, .115, .17); put(head, SPH, 0x1d1714, 0, -.03, .38, .06, .045, .04);
  both(head, SPH, fur, .2, .21, -.03, .095, .095, .05); both(head, SPH, dark, .2, .21, -.005, .055, .055, .03);
  eyes(head, .115, .07, .2, .95);
  const jaw = grp(head, 0, -.12, .1); u.jaw = jaw; u.jawMax = .65;
  put(jaw, SPH, pale, 0, -.02, .13, .115, .05, .15); put(jaw, SPH, 0xb8434f, 0, .012, .13, .09, .02, .12);
  for (const s of [-1, 1]) { put(jaw, cone(6), 0xffffff, s * .07, .05, .23, .018, .06, .018); put(head, cone(6), 0xffffff, s * .08, -.14, .33, .02, .07, .02, PI); }
  return seal(R.root);
}

function elephant() {
  const hide = 0x8d9198, pale = 0xa9adb3, nail = 0xe9e1d3, R = quad('elephant', 1.42, -.95, { stride: 2.1, halfW: .78, r: 1.55, h: 3, eye: 2.3, rearMax: .42 }), { u, S } = R;
  const chest = S(0, 0, 0);
  put(chest, torso([[-1.52, 1.78, .1, .1, .1], [-1.27, 1.8, .63, .62, .6], [-.5, 1.82, .75, .72, .72], [.4, 1.84, .75, .76, .74], [1.05, 1.88, .62, .68, .64], [1.42, 1.94, .2, .26, .26]], 20, .16), two(hide, pale, 1.3, .2), 0, 0, 0);
  const foot = (k, low) => { put(k, CYL, hide, 0, -low + .12, .02, .285, .24, .3); for (const s of [-1, 0, 1]) put(k, SPH, nail, s * .14, -low + .07, .27 - Math.abs(s) * .05, .06, .07, .04); };
  u.legs.push(leg(S(0, 0, 0), .42, 1.4, .85, .72, .68, .27, .245, hide, foot, hide, 1.05), leg(S(0, 0, 0), -.42, 1.4, .85, .72, .68, .27, .245, hide, foot, hide, 1.05));
  u.legs.push(leg(R.body, .42, 1.42, -.95, .74, .68, .29, .25, hide, foot, hide, 1.05), leg(R.body, -.42, 1.42, -.95, .74, .68, .29, .25, hide, foot, hide, 1.05));
  u.tail = tail(R.body, 2.1, -1.5, 3, .32, .04, hide, 1.45, (t, l) => put(t, SPH, 0x3b3d42, 0, l + .05, 0, .06, .12, .06));
  const neck = S(0, 2.02, 1.3); u.neck = neck; u.neckRest = 0;
  const head = grp(neck, 0, .08, .32); u.head = head; u.headRest = 0;
  put(head, SPH, hide, 0, 0, 0, .6, .64, .58); both(head, SPH, hide, .2, .5, -.08, .27, .2, .26); put(head, SPH, pale, 0, -.3, .3, .34, .3, .3);
  eyes(head, .4, .1, .36, 1.25, .7);
  // ears: big flat sails that flap
  for (const s of [-1, 1]) { const ear = grp(head, s * .5, .12, -.12); put(ear, SPH, hide, s * .5, -.12, 0, .56, .72, .07); put(ear, SPH, 0xb7a3a6, s * .5, -.14, .04, .42, .56, .04); ear.rotation.y = s * .5; ear.userData.side = s; u.ears.push(ear); }
  both(head, cone(10), 0xfaf6ea, .27, -.5, .5, .075, .78, .075, 2.25, 0, 0);                // tusks
  let at = grp(head, 0, -.3, .48); at.rotation.x = 2.8;                                      // the trunk: eight joints, thick at the face
  for (let i = 0; i < 8; i++) { const r = .2 - i * .014; put(at, cap(r, .16), hide, 0, .11, 0); u.trunk.push(at); if (i < 7) { at = grp(at, 0, .21, 0); at.rotation.x = i < 4 ? .04 : -.3; } else put(at, SPH, pale, 0, .25, 0, .09, .05, .09); }
  return seal(R.root);
}

function giraffe() {
  coats();
  const base = 0xf3e2b4, hoof = 0x4a3a2c, horn = 0x6b4a2c, skin = giraffeSkin, R = quad('giraffe', 1.82, -.72, { stride: 2.3, halfW: .4, r: 1.05, h: 4.6, eye: 4.3, rearMax: .3 }), { u, S } = R;
  const chest = S(0, 0, 0);
  put(chest, uv(torso([[-1.02, 1.97, .05, .05, .05], [-.84, 2, .3, .3, .3], [-.3, 2.07, .36, .36, .38], [.4, 2.22, .38, .42, .42], [.8, 2.32, .31, .37, .37], [1.02, 2.4, .12, .16, .16]]), false, 3, 3), skin, 0, 0, 0);
  const foot = (k, low) => { put(k, CYL, hoof, 0, -low + .07, .02, .1, .14, .115); put(k, SPH, base, 0, 0, 0, .105, .11, .105); };
  skin.userData.per = 1.9; skin.userData.round = 1;
  u.legs.push(leg(S(0, 0, 0), .2, 1.9, .72, .98, .92, .12, .07, skin, foot, base), leg(S(0, 0, 0), -.2, 1.9, .72, .98, .92, .12, .07, skin, foot, base));
  u.legs.push(leg(R.body, .2, 1.82, -.72, .94, .88, .135, .07, skin, foot, base), leg(R.body, -.2, 1.82, -.72, .94, .88, .135, .07, skin, foot, base));
  u.tail = tail(R.body, 2.06, -.98, 3, .34, .03, base, 1.4, (t, l) => put(t, SPH, horn, 0, l + .1, 0, .055, .2, .055));
  const neck = S(0, 2.42, .86); neck.rotation.x = .42; u.neck = neck; u.neckRest = .42;
  put(neck, ring(cap(.21, 2), 1.5, 2), skin, 0, .92, 0, 1, 1, 1.15); put(neck, SPH, skin, 0, .08, -.02, .3, .34, .34);
  for (let i = 0; i < 9; i++) put(neck, rbox(.05, .2, .09, .02), horn, 0, .3 + i * .2, -.235);                  // the short mane down the back of the neck
  const head = grp(neck, 0, 2.02, 0); head.rotation.x = -.42 + .25; u.head = head; u.headRest = -.17;
  put(head, SPH, base, 0, .03, .05, .17, .175, .25); put(head, SPH, base, 0, -.03, .33, .125, .11, .19); put(head, SPH, 0x8a5a3a, 0, -.035, .47, .1, .085, .07);
  both(head, CYL, base, .07, .24, -.02, .028, .16, .028); both(head, SPH, horn, .07, .33, -.02, .045, .04, .045);
  both(head, SPH, base, .2, .12, -.08, .11, .05, .07, 0, 0, -.5); eyes(head, .15, .06, .16, 1.1, .8);
  for (const s of [-1, 1]) put(head, rbox(.07, .014, .03, .005), 0x1a1410, s * .175, .125, .19, 1, 1, 1, 0, s * .8, s * -.25);      // eyelashes
  return seal(R.root);
}

function zebra() {
  coats();
  const white = 0xf4f1ea, black = 0x1d1c1f, skin = zebraSkin, R = quad('zebra', 1, -.6, { stride: 1.35, halfW: .3, r: .7, h: 1.75, eye: 1.6, rearMax: .7 }), { u, S } = R;
  skin.userData.per = 1.35; skin.userData.round = 1;
  const chest = S(0, 0, 0);
  put(chest, torso([[-.87, 1.1, .05, .05, .05], [-.7, 1.12, .265, .27, .27], [-.2, 1.08, .29, .27, .31], [.35, 1.1, .285, .29, .31], [.68, 1.16, .225, .26, .26], [.87, 1.22, .08, .12, .12]]), skin, 0, 0, 0);
  const foot = (k, low) => { put(k, CYL, black, 0, -low + .06, .015, .075, .12, .085); };
  u.legs.push(leg(S(0, 0, 0), .17, 1, .55, .52, .5, .09, .058, skin, foot, skin), leg(S(0, 0, 0), -.17, 1, .55, .52, .5, .09, .058, skin, foot, skin));
  u.legs.push(leg(R.body, .17, 1, -.6, .52, .5, .105, .058, skin, foot, skin), leg(R.body, -.17, 1, -.6, .52, .5, .105, .058, skin, foot, skin));
  u.tail = tail(R.body, 1.2, -.84, 2, .26, .03, white, 1.35, (t, l) => put(t, SPH, black, 0, l + .14, 0, .05, .2, .05));
  const neck = S(0, 1.24, .72); neck.rotation.x = .7; u.neck = neck; u.neckRest = .7;
  put(neck, ring(cap(.165, .52), 1.1, 1), skin, 0, .3, 0, 1, 1, 1.25);
  for (let i = 0; i < 7; i++) put(neck, rbox(.05, .13, .1, .02), i % 2 ? white : black, 0, .1 + i * .095, -.2);                  // the stiff mane
  const head = grp(neck, 0, .66, 0); head.rotation.x = -.7 + .5; u.head = head; u.headRest = -.2;
  put(head, uv(SPH, false, 1, 1), skin, 0, .02, .03, .15, .16, .2, PI / 2); put(head, SPH, white, 0, -.07, .25, .115, .11, .19); put(head, SPH, 0x2b2a2e, 0, -.09, .4, .1, .09, .085);
  both(head, cone(8), white, .1, .23, -.06, .05, .16, .035, 0, 0, -.2); both(head, cone(8), black, .1, .25, -.045, .028, .1, .02, 0, 0, -.2);
  put(head, rbox(.05, .1, .12, .02), black, 0, .19, -.03); eyes(head, .125, .05, .13, 1.05, .8);
  return seal(R.root);
}

function hippo() {
  const hide = 0x8b7f92, pink = 0xdaa6a6, mouth = 0xe27a8c, R = quad('hippo', .62, -.85, { stride: 1.2, halfW: .6, r: 1.15, h: 1.55, eye: 1.2, rearMax: .15, skin: WET }), { u, S } = R;
  const chest = S(0, 0, 0);
  put(chest, torso([[-1.22, .9, .1, .1, .1], [-1.02, .9, .5, .48, .45], [-.3, .88, .61, .53, .53], [.5, .89, .59, .53, .53], [1, .92, .47, .45, .43], [1.26, .94, .16, .2, .2]], 20, .13), two(hide, pink, .56, .16), 0, 0, 0);
  const foot = (k, low) => { put(k, CYL, hide, 0, -low + .08, .02, .21, .16, .23); for (const s of [-1, 0, 1]) put(k, SPH, 0xe9e1d3, s * .1, -low + .05, .2, .045, .05, .03); };
  u.legs.push(leg(S(0, 0, 0), .36, .6, .8, .3, .3, .2, .185, hide, foot, hide, 1.05), leg(S(0, 0, 0), -.36, .6, .8, .3, .3, .2, .185, hide, foot, hide, 1.05));
  u.legs.push(leg(R.body, .36, .62, -.85, .32, .3, .215, .19, hide, foot, hide, 1.05), leg(R.body, -.36, .62, -.85, .32, .3, .215, .19, hide, foot, hide, 1.05));
  u.tail = tail(R.body, 1.05, -1.2, 1, .2, .04, hide, 1.3);
  const neck = S(0, 1, 1.18); u.neck = neck; u.neckRest = 0;
  const head = grp(neck, 0, 0, .2); u.head = head; u.headRest = 0;
  put(head, SPH, hide, 0, 0, 0, .37, .34, .38); put(head, SPH, hide, 0, -.02, .5, .43, .25, .42); put(head, SPH, pink, 0, -.1, .52, .4, .17, .4);
  both(head, SPH, hide, .17, .2, .78, .075, .06, .075); both(head, SPH, 0x3a3038, .17, .225, .8, .03, .025, .035);                 // nostrils
  both(head, SPH, hide, .23, .3, .0, .095, .1, .095); both(head, SPH, hide, .3, .34, -.22, .06, .075, .04); both(head, SPH, pink, .3, .34, -.2, .035, .045, .025);
  eyes(head, .23, .34, .055, .95, .5);
  const jaw = grp(head, 0, -.14, .12); u.jaw = jaw; u.jawMax = 1.05;
  put(jaw, SPH, pink, 0, -.1, .4, .41, .15, .44); put(jaw, SPH, mouth, 0, -.02, .4, .36, .05, .39); put(head, SPH, mouth, 0, -.17, .5, .37, .05, .38);
  for (const s of [-1, 1]) { put(jaw, cone(8), 0xfff8e8, s * .24, .1, .7, .05, .24, .05); put(jaw, cone(6), 0xfff8e8, s * .1, .04, .78, .03, .1, .03); put(head, cone(6), 0xfff8e8, s * .27, -.24, .68, .035, .12, .035, PI); }
  return seal(R.root, WET);
}

function gorilla() {
  const fur = 0x2a2c31, skin = 0x494b53, silver = 0xa2a8b0, R = quad('gorilla', .64, -.4, { stride: .95, halfW: .45, r: .7, h: 1.6, eye: 1.4, rearMax: 1.05, knuckle: true }), { u, S } = R;
  const chest = S(0, 0, 0);
  put(chest, torso([[-.56, .76, .08, .08, .08], [-.43, .79, .3, .27, .28], [0, .93, .37, .32, .34], [.38, 1.1, .45, .36, .38], [.6, 1.2, .35, .3, .32], [.73, 1.24, .1, .12, .12]]), fur, 0, 0, 0);
  put(chest, SPH, silver, 0, 1.2, -.06, .3, .1, .36, -.42); put(chest, SPH, skin, 0, .94, .62, .3, .22, .1, .5);      // the silver saddle, and a bare chest to beat
  const fist = (k, low) => { put(k, SPH, skin, 0, -low + .1, .04, .15, .13, .17); };
  const footF = (k, low) => { put(k, SPH, skin, 0, -low + .06, .08, .13, .075, .2); };
  u.legs.push(leg(S(0, 0, 0), .43, 1.14, .44, .58, .56, .15, .135, fur, fist), leg(S(0, 0, 0), -.43, 1.14, .44, .58, .56, .15, .135, fur, fist));
  u.legs.push(leg(R.body, .25, .64, -.4, .33, .31, .15, .115, fur, footF), leg(R.body, -.25, .64, -.4, .33, .31, .15, .115, fur, footF));
  const neck = S(0, 1.28, .56); neck.rotation.x = .5; u.neck = neck; u.neckRest = .5; put(neck, cap(.22, .06), fur, 0, .04, 0);
  const head = grp(neck, 0, .2, 0); head.rotation.x = -.5; u.head = head; u.headRest = -.5;
  put(head, SPH, fur, 0, .02, 0, .25, .27, .25); put(head, SPH, fur, 0, .22, -.06, .17, .17, .2); put(head, SPH, skin, 0, -.03, .17, .19, .2, .1);
  put(head, rbox(.37, .075, .1, .03), fur, 0, .085, .21); put(head, SPH, skin, 0, -.13, .2, .15, .12, .12);
  both(head, SPH, 0x1a1b1f, .035, -.09, .315, .02, .016, .012); both(head, SPH, skin, .255, 0, .0, .05, .07, .03);
  eyes(head, .085, .015, .235, .72);
  const jaw = grp(head, 0, -.17, .1); u.jaw = jaw; u.jawMax = .6;
  put(jaw, SPH, skin, 0, -.02, .1, .13, .055, .12); put(jaw, SPH, 0xb8434f, 0, .015, .1, .1, .02, .09);
  for (const s of [-1, 1]) put(jaw, cone(6), 0xffffff, s * .075, .05, .17, .016, .055, .016);
  return seal(R.root);
}

function penguin() {
  const black = 0x23262d, white = 0xf6f6f2, orange = 0xf2963a, root = new THREE.Group(), body = grp(root);
  root.userData = { kind: 'penguin', rig: 'penguin', body, legs: [], flippers: [], phase: Math.random() * 6, lie: 0, bite: 0, rear: 0, graze: 0, stride: .22, halfW: .2, r: .3, h: .95, eye: .85, skin: WET };
  const u = root.userData;
  put(body, SPH, black, 0, .44, 0, .25, .38, .23); put(body, SPH, white, 0, .41, .1, .19, .32, .16); put(body, SPH, 0xffd98a, 0, .66, .12, .13, .08, .07);
  put(body, cone(8), black, 0, .16, -.2, .08, .16, .05, -2.2);
  const head = grp(body, 0, .86, 0); u.head = head;
  put(head, SPH, black, 0, 0, 0, .165, .16, .165); both(head, SPH, white, .07, -.01, .1, .07, .08, .06); both(head, SPH, 0xffb53d, .135, -.03, .02, .04, .075, .06);
  put(head, cone(8), orange, 0, -.03, .22, .045, .17, .04, PI / 2); eyes(head, .07, .03, .125, .62, .35);
  for (const s of [-1, 1]) {
    const f = grp(body, s * .23, .64, 0); put(f, SPH, black, s * .02, -.2, 0, .035, .23, .09); f.rotation.z = s * .22; f.userData.side = s; u.flippers.push(f);
    const foot = grp(body, s * .09, .05, .03); put(foot, SPH, orange, 0, -.02, .05, .085, .03, .13); u.legs.push(foot);
  }
  return seal(root, WET);
}

// ---------- the shark ----------
// A great white, 4.6 m long. Origin: the middle of its body, nose toward +z. The skin is one mesh whose
// points are slid sideways every frame so the body and tail really bend as it swims; the fins ride on it.
const finGeo = {};
function fin(name, pts, thick) {
  if (finGeo[name]) return finGeo[name];
  const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) { const p = pts[i]; if (p.length === 4) s.quadraticCurveTo(p[0], p[1], p[2], p[3]); else s.lineTo(p[0], p[1]); }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelSize: thick * .45, bevelThickness: thick * .45, bevelSegments: 2, curveSegments: 10 });
  g.translate(0, 0, -thick / 2); g.rotateY(-PI / 2);       // the outline's x becomes "forward" (+z), its thickness runs side to side
  return finGeo[name] = g;
}
const SHARK_ST = [[-2.1, 0, .035, .06, .06], [-1.7, 0, .1, .15, .13], [-1, 0, .23, .27, .25], [-.2, 0, .37, .41, .37], [.6, 0, .41, .43, .39], [1.3, 0, .34, .34, .31], [1.85, -.03, .21, .19, .2], [2.16, -.06, .06, .06, .06]];
function shark() {
  const top = 0x586b7b, belly = 0xf3f5f4, root = new THREE.Group(), body = grp(root);
  const g = loft(loftBody(SHARK_ST), { seg: 20, step: .13 }); g.rotateY(-PI / 2);
  const p = g.attributes.position, col = new Float32Array(p.count * 3), a = new THREE.Color(top), b = new THREE.Color(belly);
  for (let i = 0; i < p.count; i++) { tc.copy(b).lerp(a, smooth(-.16, -.02, p.getY(i) + Math.sin(p.getZ(i) * 5) * .015)); col[i * 3] = tc.r; col[i * 3 + 1] = tc.g; col[i * 3 + 2] = tc.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const skin = new THREE.Mesh(g, WET); skin.castShadow = true; skin.receiveShadow = true; skin.frustumCulled = false; body.add(skin);
  const u = root.userData = { kind: 'shark', rig: 'shark', body, skin, base: p.array.slice(), phase: Math.random() * 6, bite: 0, lie: 0, riders: [], r: 1.1, h: .9, len: 4.3 };
  const ride = (z, y = 0) => { const k = grp(body, 0, y, z); k.userData.z = z; u.riders.push(k); return k; };
  const dorsal = ride(.12, .36); put(dorsal, fin('dorsal', [[.42, 0], [.3, .34, -.3, .8], [-.36, .5, -.34, .12], [-.3, 0]], .05), top, 0, 0, 0);
  const second = ride(-1.25, .2); put(second, fin('second', [[.16, 0], [-.1, .2], [-.12, 0]], .03), top, 0, 0, 0);
  const pecs = ride(.78, -.2);
  for (const s of [-1, 1]) put(pecs, fin('pec', [[.3, 0], [.1, .3, -.48, .78], [-.34, .42, -.2, 0]], .045), two(top, belly, -.33, .05), s * .3, 0, 0, 1, 1, 1, 0, 0, s * -1.95);
  const anal = ride(-1.1, -.2); for (const s of [-1, 1]) put(anal, fin('pelvic', [[.14, 0], [-.16, .26], [-.14, 0]], .03), belly, s * .12, 0, 0, 1, 1, 1, 0, 0, s * -2.3);
  const tailFin = ride(-2.02, 0); u.tailFin = tailFin;
  put(tailFin, fin('tail', [[.2, 0], [-.05, .4, -.62, .92], [-.36, .38, -.3, 0], [-.3, -.28, -.5, -.62], [-.05, -.3, .2, 0]], .05), top, 0, 0, 0);
  const head = ride(1.45, 0); u.head = head;
  both(head, SPH, 0x0b0c10, .285, .06, .15, .042, .042, .03); both(head, SPH, 0xffffff, .3, .075, .165, .012);
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) put(head, rbox(.012, .2 - i * .012, .025, .005), 0x33414d, s * (.395 - i * .012), -.03, -.42 + i * .1, 1, 1, 1, 0, 0, s * .12);       // gill slits
  put(head, SPH, 0x8c2531, 0, -.2, .1, .24, .05, .33);                                     // the roof of the mouth
  for (let i = 0; i < 9; i++) { const k = (i - 4) / 4; put(head, cone(5), 0xffffff, k * .2, -.25, .38 - Math.abs(k) * .26, .022, .075, .022, PI); }
  const jaw = grp(head, 0, -.2, -.16); u.jaw = jaw; u.jawMax = .75;
  put(jaw, SPH, belly, 0, -.07, .26, .235, .1, .3); put(jaw, SPH, 0x8c2531, 0, -.015, .26, .2, .04, .26);
  for (let i = 0; i < 9; i++) { const k = (i - 4) / 4; put(jaw, cone(5), 0xffffff, k * .185, .05, .5 - Math.abs(k) * .25, .02, .07, .02); }
  return seal(root, WET);
}

const MAKERS = { lion: () => lion(true), lioness: () => lion(false), bear, elephant, giraffe, zebra, hippo, gorilla, penguin, shark };
export const BEAST_KINDS = Object.keys(MAKERS);
// opt.statue: cast in gold and frozen (the pair at the zoo gate). opt.scale: bigger or smaller than usual.
export function makeBeast(kind, opt = {}) {
  const m = MAKERS[kind]();
  if (opt.statue) m.traverse(o => { if (o.isMesh) o.material = GOLD; });
  if (opt.scale) { m.scale.setScalar(opt.scale); m.userData.scale = opt.scale; }
  return m;
}

// ---------- movement ----------
const ease = (u, key, to, rate, dt) => { u[key] += (to - u[key]) * Math.min(1, dt * rate); return u[key]; };
// pose: 'idle' | 'graze' (head down) | 'rear' (up on the hind legs) | 'bite' (lunge, jaws open) | 'ko' (flat on its side)
// look: which way the head is turned (radians, + = to its left). speed in m/s drives the legs.
export function animateBeast(m, t, dt, speed = 0, pose = 'idle', look = 0) {
  const u = m.userData;
  if (u.rig === 'shark') return swim(m, t, dt, speed, pose);
  const lie = ease(u, 'lie', pose === 'ko' ? 1 : 0, pose === 'ko' ? 9 : 4, dt), rear = ease(u, 'rear', pose === 'rear' ? 1 : 0, 5, dt);
  const bite = ease(u, 'bite', pose === 'bite' ? 1 : 0, pose === 'bite' ? 16 : 6, dt), graze = ease(u, 'graze', pose === 'graze' ? 1 : 0, 2.5, dt);
  const moving = speed > .15 && pose !== 'ko';
  if (u.rig === 'penguin') {
    if (moving) u.phase += dt * (5 + speed * 7);
    const s = Math.sin(u.phase), amp = moving ? 1 : 0;
    u.body.rotation.z = s * .2 * amp + lie * 1.5; u.body.position.y = Math.abs(s) * .025 * amp + lie * .2; u.body.rotation.x = rear * -.2;
    u.legs[0].position.z = .03 + s * .07 * amp; u.legs[1].position.z = .03 - s * .07 * amp;
    const flap = rear > .05 || speed > 1.6 ? Math.sin(t * 22) * .5 + .8 : Math.sin(t * 1.7 + u.phase) * .06;
    for (const f of u.flippers) f.rotation.z = f.userData.side * (.22 + flap);
    u.head.rotation.y = look + (moving ? 0 : Math.sin(t * .7 + u.phase) * .5); u.head.rotation.x = -rear * .5;
    return;
  }
  // legs: each one plants, pushes back, then swings forward with the knee bent
  const amp = moving ? clamp(.24 + speed * .055, 0, .78) : 0, legLen = u.legs[0].userData.len;
  if (moving) u.phase += dt * speed / (u.stride * (.55 + amp)) * TAU / 2.6;
  const run = speed > 5 ? 1 : 0, offs = run ? [0, .12, .55, .45] : [0, .5, .75, .25];        // a walk plants one foot at a time; a run goes in bounds
  for (let i = 0; i < 4; i++) {
    const L = u.legs[i], ph = ((u.phase / TAU + offs[i]) % 1 + 1) % 1, front = i < 2;
    let a, bend;
    if (ph < .62) { a = -amp + ph / .62 * 2 * amp; bend = 0; } else { const k = (ph - .62) / .38; a = amp - k * 2 * amp; bend = Math.sin(k * PI); }
    let hip = a, knee = bend * amp * 1.5;
    if (front && rear > .01) { hip = hip * (1 - rear) + rear * (u.knuckle ? -1.7 + Math.sin(t * 15 + i * PI) * .5 : -1 + Math.sin(t * 5 + i * 2.4) * .35); knee = knee * (1 - rear) + rear * (u.knuckle ? 1.9 : .55); }
    if (front && bite > .01) { hip -= bite * .5; }
    if (lie > .01) { hip = hip * (1 - lie) + lie * (front ? -.35 : .3); knee *= 1 - lie; }
    L.rotation.x = hip; L.userData.knee.rotation.x = front ? knee : knee * 1.1;
  }
  u.body.position.y = (moving ? Math.abs(Math.sin(u.phase * (run ? 1 : 2))) * (.012 + amp * (run ? .1 : .035)) * legLen : Math.sin(t * 1.6 + u.phase) * .006 * legLen) + lie * u.halfW;
  u.body.rotation.z = lie * 1.5; u.body.rotation.x = run && moving ? Math.sin(u.phase) * .06 : 0;
  u.spine.rotation.x = -rear * u.rearMax - bite * .12;
  const nod = moving ? Math.sin(u.phase * 2) * .04 * (1 + amp) : Math.sin(t * .9 + u.phase) * .03;
  if (u.neck) { u.neck.rotation.x = u.neckRest + nod + graze * (u.kind === 'giraffe' ? 1.15 : u.kind === 'elephant' ? .1 : .85) + rear * .35 * (u.kind === 'elephant' ? -1 : 1) + bite * .25; u.neck.rotation.y = look * .7; }
  if (u.head) { u.head.rotation.x = u.headRest - graze * (u.kind === 'giraffe' ? .3 : -.15) - bite * .3; u.head.rotation.z = lie ? 0 : Math.sin(t * .6 + u.phase * 2) * .03; }
  if (u.jaw) u.jaw.rotation.x = (bite + (pose === 'rear' && u.kind !== 'gorilla' ? rear * .8 : 0)) * u.jawMax * (.75 + .25 * Math.sin(t * 20)) + (pose === 'graze' ? Math.max(0, Math.sin(t * 6)) * .12 : 0);
  for (let i = 0; i < u.tail.length; i++) u.tail[i].rotation.z = Math.sin(t * (moving ? 5 : 2.2) + u.phase + i * .8) * (i ? .32 : .2) * (1 - lie);
  for (const e of u.ears) e.rotation.y = e.userData.side * (.42 + Math.sin(t * 1.3 + u.phase) * .2 + Math.max(0, Math.sin(t * .37 + u.phase)) * .3 + rear * .5);
  for (let i = 0; i < u.trunk.length; i++) {            // hangs with a lazy sway; curls up over the head to trumpet, down to the ground to feed
    const J = u.trunk[i], restA = i === 0 ? 2.8 : i < 5 ? .04 : -.3, upA = i === 0 ? 1.5 : -.4, feed = i === 0 ? 2.9 : i < 5 ? .0 : .2;
    J.rotation.x = restA + (upA - restA) * Math.max(rear, bite) + (feed - restA) * graze + (i ? Math.sin(t * 1.1 + i * .6 + u.phase) * .05 : 0);
    J.rotation.z = i ? Math.sin(t * .8 + i * .5 + u.phase) * .04 * (1 + amp * 2) : 0;
  }
}
// Swimming: a wave runs down the body, bigger toward the tail; the fins are carried along with it.
function swim(m, t, dt, speed, pose) {
  const u = m.userData, bite = ease(u, 'bite', pose === 'bite' ? 1 : 0, pose === 'bite' ? 14 : 5, dt), lie = ease(u, 'lie', pose === 'ko' ? 1 : 0, 2.2, dt);
  u.phase += dt * (2.2 + speed * .95) * (1 - lie);
  const amp = (.1 + Math.min(.2, speed * .022)) * (1 - lie * .85), ph = u.phase;
  const off = (z) => { const k = clamp((1.15 - z) / 3.3, 0, 1); return amp * k * k * Math.sin(ph + z * 1.15) + amp * .12 * Math.sin(ph + 1.2) * clamp((z + .4) / 2.6, 0, 1); };
  const p = u.skin.geometry.attributes.position, a = p.array, b = u.base;
  for (let i = 0; i < a.length; i += 3) a[i] = b[i] + off(b[i + 2]);
  p.needsUpdate = true;
  for (const r of u.riders) { const z = r.userData.z; r.position.x = off(z); r.rotation.y = Math.atan2(off(z + .12) - off(z - .12), .24); }
  u.jaw.rotation.x = bite * u.jawMax * (.8 + .2 * Math.sin(t * 24));
  u.body.rotation.z = lie * PI + Math.sin(ph * .5) * .04 * (1 - lie);          // a dead shark floats belly up
}
