// Crash damage you can see. Where a vehicle is hit, its body is pressed in: the harder the knock, the
// deeper and wider the dent. On top of that: paint scraped to primer and bare metal, cracked and
// smashed-out glass, lamps that go dark, bumpers torn off, bits flying, and a steaming radiator.
//
// How it works. A vehicle shares its body geometry with every other car of its type until its first
// knock. Then each body mesh gets its own copy, cut into small triangles (once per model, cached) so
// even a flat door has enough points to bend, and a copy of its material that can draw the wear
// (the untouched cars keep the exact approved materials). A dent is one field over the whole body:
// every point is moved by where it is, never by which mesh it belongs to, so decals, lamps and trim
// stay glued to the panel under them. Numbers: DAMAGE in config.js.
import * as THREE from 'three';
import { DAMAGE as D } from '../config.js';
import { clamp } from '../core/utils.js';
import { mats } from '../world/materials.js';

const PAINT = 0, GLASS = 1, TRIM = 2, LIGHT = 3;

// ---------- smooth noise: the same answer for the same spot, so wrinkles never crawl ----------
const h3 = (x, y, z) => { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1440662683); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), fx = x - xi, fy = y - yi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const a = h3(xi, yi, zi), b = h3(xi + 1, yi, zi), c = h3(xi, yi + 1, zi), d = h3(xi + 1, yi + 1, zi);
  const e = h3(xi, yi, zi + 1), f = h3(xi + 1, yi, zi + 1), g = h3(xi, yi + 1, zi + 1), k = h3(xi + 1, yi + 1, zi + 1);
  const p = a + (b - a) * u, q = c + (d - c) * u, r = e + (f - e) * u, s = g + (k - g) * u, m = p + (q - p) * v, n = r + (s - r) * v;
  return m + (n - m) * w;
}

// ---------- bendable copies of a geometry ----------
// Cut every triangle edge longer than maxEdge in half, again and again. The choice depends only on
// the edge, so two triangles sharing one always agree and no cracks open (the same holds across a
// seam, where the two sides use different points at the same place: both get the same new midpoint).
// A: [{ size, data }] per-point attributes, A[0] = position. Returns the new triangle list.
function tessellate(A, index, maxEdge) {
  const L2 = maxEdge * maxEdge, P = A[0].data;
  for (let pass = 0; pass < 7; pass++) {
    const mids = new Map(), out = []; let any = false;
    const long = (a, b) => { const x = P[a * 3] - P[b * 3], y = P[a * 3 + 1] - P[b * 3 + 1], z = P[a * 3 + 2] - P[b * 3 + 2]; return x * x + y * y + z * z > L2; };
    const mid = (a, b) => {
      const key = a < b ? a * 4194304 + b : b * 4194304 + a; let m = mids.get(key);
      if (m === undefined) { m = P.length / 3; mids.set(key, m); for (const at of A) { const s = at.size, d = at.data; for (let c = 0; c < s; c++) d.push((d[a * s + c] + d[b * s + c]) * .5); } }
      return m;
    };
    for (let t = 0; t < index.length; t += 3) {
      const a = index[t], b = index[t + 1], c = index[t + 2], ab = long(a, b), bc = long(b, c), ca = long(c, a), n = ab + bc + ca;
      if (n === 0) { out.push(a, b, c); continue; }
      any = true;
      const mab = ab ? mid(a, b) : -1, mbc = bc ? mid(b, c) : -1, mca = ca ? mid(c, a) : -1;
      if (n === 3) out.push(a, mab, mca, mab, b, mbc, mca, mbc, c, mab, mbc, mca);
      else if (n === 1) { if (ab) out.push(a, mab, c, mab, b, c); else if (bc) out.push(a, b, mbc, a, mbc, c); else out.push(a, b, mca, mca, b, c); }
      else if (!ca) out.push(mab, b, mbc, a, mab, mbc, a, mbc, c);
      else if (!ab) out.push(mca, mbc, c, a, b, mbc, a, mbc, mca);
      else out.push(a, mab, mca, mab, b, c, mab, c, mca);
    }
    index = out;
    if (!any) break;
  }
  return index;
}

// Area-weighted normals of an indexed triangle list, normalised, into `out`.
function faceNormals(pos, index, out) {
  out.fill(0);
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t] * 3, b = index[t + 1] * 3, c = index[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    out[a] += nx; out[a + 1] += ny; out[a + 2] += nz; out[b] += nx; out[b + 1] += ny; out[b + 2] += nz; out[c] += nx; out[c + 1] += ny; out[c + 2] += nz;
  }
  for (let i = 0; i < out.length; i += 3) { const l = Math.hypot(out[i], out[i + 1], out[i + 2]) || 1; out[i] /= l; out[i + 1] /= l; out[i + 2] /= l; }
}

const templates = new Map();       // source geometry uuid -> the cut-up version every damaged copy starts from
function templateOf(geo, edge = D.edge) {
  let T = templates.get(geo.uuid); if (T) return T;
  const src = geo.attributes, idx = geo.index, n = idx ? idx.count : src.position.count, total = src.position.count;
  const names = ['position', 'normal', 'uv', 'uv1', 'color'].filter(k => k === 'normal' || src[k]);
  let flat = null;
  if (!src.normal) {            // no normals supplied: flat ones, per triangle corner
    const P = new Float32Array(n * 3), ix = new Uint32Array(n); for (let i = 0; i < n; i++) { const j = idx ? idx.getX(i) : i; P[i * 3] = src.position.getX(j); P[i * 3 + 1] = src.position.getY(j); P[i * 3 + 2] = src.position.getZ(j); ix[i] = i; }
    flat = new Float32Array(n * 3); faceNormals(P, ix, flat);
  }
  // weld: points that agree on every attribute become one, so smooth panels stay smooth and creases stay creased
  const A = names.map(name => ({ name, size: name === 'normal' ? 3 : src[name].itemSize, q: name === 'position' ? 1e4 : name === 'normal' ? 127 : 8192, data: [] }));
  const seen = new Map(), val = []; let index = [];
  for (let i = 0; i < n; i++) {
    const j = idx ? idx.getX(i) : i; let key = ''; val.length = 0;
    for (const a of A) {
      const s = src[a.name];
      for (let c = 0; c < a.size; c++) { const x = s ? (c === 0 ? s.getX(j) : c === 1 ? s.getY(j) : c === 2 ? s.getZ(j) : s.getW(j)) : flat[i * 3 + c]; val.push(x); key += Math.round(x * a.q) + ','; }
    }
    let k = seen.get(key);
    if (k === undefined) { k = seen.size; seen.set(key, k); let o = 0; for (const a of A) for (let c = 0; c < a.size; c++) a.data.push(val[o++]); }
    index.push(k);
  }
  index = tessellate(A, index, edge);
  const position = new Float32Array(A[0].data), normal = new Float32Array(A[1].data), count = position.length / 3, nc0 = new Float32Array(count * 3);
  for (let i = 0; i < normal.length; i += 3) { const l = Math.hypot(normal[i], normal[i + 1], normal[i + 2]) || 1; normal[i] /= l; normal[i + 1] /= l; normal[i + 2] /= l; }
  const ix = count > 65535 ? new Uint32Array(index) : new Uint16Array(index);
  faceNormals(position, ix, nc0);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(position, 3)); g.computeBoundingSphere();
  T = { count, index: ix, position, normal, nc0, sphere: g.boundingSphere, extra: A.slice(2).map(a => ({ name: a.name, size: a.size, array: new Float32Array(a.data) })), from: total };
  templates.set(geo.uuid, T); return T;
}

// ---------- materials that can show wear ----------
const FRAG_HEAD = /* glsl */`
varying vec4 vDmg; varying vec3 vDmgPos;
float dmgHash(vec3 p) { p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float dmgNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
  return mix(mix(mix(dmgHash(i), dmgHash(i + vec3(1, 0, 0)), f.x), mix(dmgHash(i + vec3(0, 1, 0)), dmgHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(dmgHash(i + vec3(0, 0, 1)), dmgHash(i + vec3(1, 0, 1)), f.x), mix(dmgHash(i + vec3(0, 1, 1)), dmgHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}`;
// vDmg.x: wear (paint scraped / glass cracked)   y: lamp dead   z: torn away or smashed out   w: how far the panel has been pushed in
const FRAG_COLOR = /* glsl */`
float dmgS = 0., dmgRough = .85, dmgMetal = .05;
{
  float dA = clamp(vDmg.x, 0., 1.), dGone = clamp(vDmg.z, 0., 1.);
  vec3 dFace = abs(normalize(cross(dFdx(vDmgPos), dFdy(vDmgPos))));       // which way this bit of body faces, in the car's frame
#if DMG_ROLE == 1
  // glass: a web of cracks that thickens, then crazes white, then panes drop out and show the dark inside
  vec2 gq = (dFace.x > dFace.y && dFace.x > dFace.z ? vDmgPos.zy : dFace.y > dFace.z ? vDmgPos.xz : vDmgPos.xy) * 8.;
  vec2 gi = floor(gq), gf = fract(gq); float f1 = 9., f2 = 9.; vec2 cell = gi;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j)), o = vec2(dmgHash(vec3(gi + g, 1.)), dmgHash(vec3(gi + g, 7.)));
    float d = length(g + o - gf);
    if (d < f1) { f2 = f1; f1 = d; cell = gi + g; } else if (d < f2) f2 = d;
  }
  float line = (1. - smoothstep(0., .035 + .1 * dA, f2 - f1)) * step(dmgHash(vec3(cell, 5.)), dA * 1.6 - .08);
  float craze = smoothstep(.55, 1., dA) * (.4 + .6 * dmgNoise(vDmgPos * 46.));
  dmgS = clamp(line + craze * .8, 0., 1.);
  dmgRough = .55; dmgMetal = 0.;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.7, .77, .8), dmgS);
  dGone = step(dmgHash(vec3(cell, 3.)), dGone * 1.15 - .1);
#else
  float blot = dmgNoise(vDmgPos * 6.) * .55 + dmgNoise(vDmgPos * 21.) * .45;
  // scratches run along the car on its sides and top, and across it on the nose and tail
  float streak = dmgNoise(dFace.x > .7 ? vec3(vDmgPos.x * 50., vDmgPos.y * 34., vDmgPos.z * 2.4) : vec3(vDmgPos.x * 2.4, vDmgPos.y * 34., vDmgPos.z * 50.));
  float m = dA * 1.25 - mix(blot, streak, .72);
  dmgS = smoothstep(0., .12, m);
  float bare = smoothstep(.25, .6, m);
#if DMG_ROLE == 0
  // paint: the shine goes first (dull, darker scuffs), then it is down to bright bare metal
  dmgRough = mix(.8, .36, bare); dmgMetal = mix(.1, .95, bare);
  diffuseColor.rgb = mix(diffuseColor.rgb, mix(diffuseColor.rgb * .5 + .07, vec3(.7, .71, .73), bare), dmgS * .95);
#else
  // trim, lamps, decals: scratched dull and pale
  dmgRough = .9; dmgMetal = .15;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(.33)) * .6 + .16), dmgS * .75);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * .3 + .03, clamp(vDmg.y, 0., 1.) * float(DMG_ROLE == 3));
#endif
  diffuseColor.rgb *= 1. - .22 * dA - .12 * clamp(vDmg.w, 0., 1.);       // a dent is darker inside
#endif
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.02), dGone * .94);
  dmgS = max(dmgS, dGone); dmgRough = mix(dmgRough, 1., dGone); dmgMetal = mix(dmgMetal, 0., dGone);
}`;
function patch(shader) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute vec4 aDmg;\nvarying vec4 vDmg; varying vec3 vDmgPos;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDmg = aDmg; vDmgPos = position;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\n' + FRAG_HEAD)
    .replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG_COLOR)
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, dmgRough, dmgS);')
    .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, dmgMetal, dmgS);')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= 1. - clamp(max(vDmg.y, vDmg.z), 0., 1.);')
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{ float dW = clamp(vDmg.w, 0., 1.); if (dW > .01) { vec3 wp = vDmgPos * 13.; normal = normalize(normal + dW * .5 * (vec3(dmgNoise(wp), dmgNoise(wp + 31.7), dmgNoise(wp + 67.3)) - .5)); } }`)
    .replace('#include <clearcoat_normal_fragment_maps>', `#include <clearcoat_normal_fragment_maps>
#ifdef USE_CLEARCOAT
{ float dW = clamp(vDmg.w, 0., 1.); if (dW > .01) { vec3 wp = vDmgPos * 13.; clearcoatNormal = normalize(clearcoatNormal + dW * .5 * (vec3(dmgNoise(wp), dmgNoise(wp + 31.7), dmgNoise(wp + 67.3)) - .5)); } }
#endif`)
    .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat *= 1. - dmgS;\n#endif');
}

// One worn twin per material (a second, two-sided one for loose parts), shared by every damaged car that
// uses that material and thrown away when the last of them is gone.
const twins = new Map();           // source material -> { src, role, one, two, refs, env, emis }
function twinOf(src, role, twoSided = false) {
  let t = twins.get(src);
  if (!t) twins.set(src, t = { src, role, one: null, two: null, refs: 0, env: NaN, emis: NaN });
  const key = twoSided ? 'two' : 'one';
  if (!t[key]) {
    const m = t[key] = src.clone();
    m.defines = { ...(m.defines || {}), DMG_ROLE: role }; m.onBeforeCompile = patch; m.customProgramCacheKey = () => 'dmg';
    if (twoSided) m.side = THREE.DoubleSide;
    if (src.emissiveMap && role === TRIM) { m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -2; }   // decals stay on top of a bent panel
    m.userData.dmgTwin = true;
  }
  t.refs++; return t[key];
}
function untwin(src) {
  const t = twins.get(src); if (!t || --t.refs > 0) return;
  t.one?.dispose(); t.two?.dispose(); twins.delete(src);
}
// Twins follow their source through the day (reflections, lamps coming on), except where the game now
// writes to the twin itself (a car's own brake lights).
function syncTwins() {
  for (const t of twins.values()) {
    const s = t.src, env = s.envMapIntensity, emis = s.emissiveIntensity;
    if (env !== t.env) { t.env = env; if (t.one) t.one.envMapIntensity = env; if (t.two) t.two.envMapIntensity = env; }
    if (emis !== t.emis) { t.emis = emis; if (t.one) t.one.emissiveIntensity = emis; if (t.two) t.two.emissiveIntensity = emis; }
  }
}

function roleOf(mesh, m) {
  const r = m.userData?.role, n = (mesh.name || m.name || '').toLowerCase();
  if (r === 'glass' || m === mats.carGlass || n.includes('glass')) return GLASS;
  if (r === 'light' || n.startsWith('light') || (!m.emissiveMap && m.emissive && m.emissive.r + m.emissive.g + m.emissive.b > .5)) return LIGHT;
  if (r === 'paint' || n.startsWith('paint') || (m.isMeshPhysicalMaterial && m.clearcoat > 0)) return PAINT;
  return TRIM;
}

const edgeFor = (v) => D.edge * Math.max(1, v.halfLen / 2.3);      // long vehicles are cut a little coarser
const IDENT = new THREE.Matrix4(), isIdentity = (m) => m.elements.every((v, i) => Math.abs(v - IDENT.elements[i]) < 1e-9);
let scratch = new Float32Array(0);

export function createDamage(game) {
  const live = new Set();            // damage states of every dented vehicle
  const hitInfo = {}, world = new THREE.Vector3(), col = new THREE.Color();
  const warm = [];                   // geometries waiting to be cut up
  let ready = !game.vehiclesReady, warmI = 0;
  game.vehiclesReady?.then(() => { ready = true; });      // no dents while stand-ins are still being swapped for the real models

  // ---------- a vehicle's first knock: give it a body of its own ----------
  function begin(v) {
    const g = v.mesh, u = g.userData, skip = new Set(u.wheels.map(w => w.steer)); if (v.rider) skip.add(v.rider); for (const o of u.noDent || []) skip.add(o);      // noDent: rotors
    const st = { v, parts: [], dirty: false, front: 0, rear: 0, tornF: false, tornR: false, head: [1, 1], steamT: 0, tail: null, glassOut: false };
    (function walk(o, M) {
      if (skip.has(o)) return;
      let mine = M;
      if (o !== g && o !== u.chassis) { o.updateMatrix(); if (!isIdentity(o.matrix)) mine = M ? M.clone().multiply(o.matrix) : o.matrix.clone(); }
      if (o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh && !Array.isArray(o.material) && o.geometry?.attributes?.position) st.parts.push(makePart(v, o, mine));
      for (const c of o.children) walk(c, mine);
    })(g, null);
    // the body's box, in the car's own frame (x forward, y up)
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (const p of st.parts) {
      const P = p.tpl.position, e = p.M?.elements;
      for (let i = 0; i < P.length; i += 3) {
        const x = e ? e[0] * P[i] + e[4] * P[i + 1] + e[8] * P[i + 2] + e[12] : P[i], y = e ? e[1] * P[i] + e[5] * P[i + 1] + e[9] * P[i + 2] + e[13] : P[i + 1];
        if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
    st.minX = minX; st.maxX = maxX; st.floor = minY; st.top = maxY;
    st.size = clamp(v.halfWid / .95, .35, 1.25);
    st.color = u.color ?? st.parts.find(p => p.role === PAINT)?.srcMat.color.getHex() ?? 0x888888;
    for (const p of st.parts) if (u.tail === p.srcMat) { st.tail = p.srcMat; u.tail = p.mesh.material; }      // the game dims the brake lights through this
    v.dmg = st; live.add(st); return st;
  }
  function makePart(v, mesh, M) {
    const T = templateOf(mesh.geometry, edgeFor(v)), src = mesh.material, role = roleOf(mesh, src), geo = new THREE.BufferGeometry();
    const pos = new Float32Array(T.position), nrm = new Float32Array(T.normal), dmg = new Float32Array(T.count * 4);
    geo.setIndex(new THREE.BufferAttribute(T.index, 1));
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); geo.setAttribute('aDmg', new THREE.BufferAttribute(dmg, 4));
    for (const a of T.extra) geo.setAttribute(a.name, new THREE.BufferAttribute(a.array, a.size));
    geo.boundingSphere = T.sphere.clone();
    const part = { mesh, srcGeo: mesh.geometry, srcMat: src, geo, pos, nrm, dmg, tpl: T, role, M, Mi: M ? M.clone().invert() : null, acc: role === GLASS ? new Float32Array(T.count) : null };
    mesh.geometry = geo; mesh.material = twinOf(src, role);
    return part;
  }
  // Give the vehicle back its shared, undamaged body (repair, or the car is being removed).
  function release(v) {
    const st = v.dmg; if (!st) return;
    for (const p of st.parts) { if (p.mesh.geometry === p.geo) p.mesh.geometry = p.srcGeo; if (p.mesh.material?.userData.dmgTwin) p.mesh.material = p.srcMat; p.geo.dispose(); untwin(p.srcMat); }
    if (st.tail) v.mesh.userData.tail = st.tail;
    live.delete(st); v.dmg = null;
  }

  // ---------- press a dent in ----------
  // S (all in the car's frame): the obstacle touched along a..b, n points into the car, d = depth,
  // rh = half-width beyond a..b, cy / rv = height of the middle of the hit and its reach up and down.
  function stamp(st, S) {
    const tx = -S.nz, tz = S.nx, sb = (S.bx - S.ax) * tx + (S.bz - S.az) * tz, s0 = Math.min(0, sb), s1 = Math.max(0, sb);
    const L = D.crumple * st.size + D.crumplePer * S.d, Ls = .3 + S.d, maxDent = D.maxDent * st.size;
    const glassR = D.glassReach + S.sev * D.glassReachPer, glassAdd = S.sev * D.glassPer, scuff = D.scuff + S.sev * D.scuffPer, kill = S.sev * D.lightPer;
    const out = { glass: false, lamp: null };
    for (const part of st.parts) {
      const { pos, dmg, role, acc } = part, rest = part.tpl.position, n0 = part.tpl.normal, e = part.M?.elements, ei = part.Mi?.elements;
      let touched = false;
      for (let i = 0, j = 0, j4 = 0; i < pos.length; i += 3, j++, j4 += 4) {
        let x = pos[i], y = pos[i + 1], z = pos[i + 2], qx = rest[i], qy = rest[i + 1], qz = rest[i + 2];
        if (e) {
          const a = x, b = y, c = z; x = e[0] * a + e[4] * b + e[8] * c + e[12]; y = e[1] * a + e[5] * b + e[9] * c + e[13]; z = e[2] * a + e[6] * b + e[10] * c + e[14];
          const k = qx, l = qy, m = qz; qx = e[0] * k + e[4] * l + e[8] * m + e[12]; qy = e[1] * k + e[5] * l + e[9] * m + e[13]; qz = e[2] * k + e[6] * l + e[10] * m + e[14];
        }
        const px = x - S.ax, pz = z - S.az, s = px * tx + pz * tz, t = px * S.nx + pz * S.nz;
        const lat = s < s0 ? s0 - s : s > s1 ? s - s1 : 0, tc = t > 0 ? t : 0;
        if (acc) {                                           // glass cracks well beyond the dent itself
          const far = Math.hypot(lat, tc);
          if (far < glassR) {
            const k = 1 - far / glassR, was = acc[j], now = acc[j] = Math.min(2.2, was + glassAdd * k * k);
            if (was < 1 && now >= 1) out.glass = true;
            dmg[j4] = Math.min(1, now); dmg[j4 + 2] = clamp((now - D.glassOut) / .6, 0, .95); touched = true;
          }
        }
        if (lat >= S.rh || t >= L) continue;
        const dy = Math.abs(y - S.cy); if (dy >= S.rv) continue;
        let w = 1 - (lat / S.rh) * (lat / S.rh), wv = 1 - (dy / S.rv) * (dy / S.rv); w *= w * wv * wv;
        const f = 1 - tc / L, nA = noise3(qx * 2.6, qy * 2.6, qz * 2.6), nB = noise3(qx * 8.5 + 17, qy * 8.5, qz * 8.5);
        const push = w * (S.d * f * f + Math.min(.25, t < 0 ? -t : 0) * .9) * (.6 + .8 * nA);
        touched = true;
        // wear
        const fs = Math.max(0, 1 - tc / Ls);
        if (!acc) dmg[j4] = Math.min(1, dmg[j4] + w * fs * scuff + push * .3);
        const dead = dmg[j4 + 1], deadNow = dmg[j4 + 1] = Math.min(1, dead + w * fs * kill);
        if (role === LIGHT && dead < .5 && deadNow >= .5 && !out.lamp) out.lamp = [x, y, z];
        if (push < .0005) continue;
        // movement: straight in, a little ragged, and flat panels on top tent upwards
        const jag = (nB - .5) * D.wrinkle * push;
        let nx = x + S.nx * push + tx * jag, nz = z + S.nz * push + tz * jag, ny = y + (nA - .5) * .3 * push;
        if (n0[i + 1] > .55 && qy < st.top - .2) ny += push * D.buckle * Math.min(1, (st.top - .2 - qy) / .3) * Math.sin(Math.PI * Math.min(1, tc / (L * .8))) * (.4 + 1.2 * nB);      // bonnets and boots, not the roof
        let ex = nx - qx, ey = ny - qy, ez = nz - qz; const len = Math.hypot(ex, ey, ez);
        if (len > maxDent) { const k = maxDent / len; ex *= k; ey *= k; ez *= k; }
        dmg[j4 + 3] = Math.min(1, len / (maxDent * .5));
        nx = qx + ex; ny = Math.max(st.floor, qy + ey); nz = qz + ez;
        if (ei) { const a = nx, b = ny, c = nz; nx = ei[0] * a + ei[4] * b + ei[8] * c + ei[12]; ny = ei[1] * a + ei[5] * b + ei[9] * c + ei[13]; nz = ei[2] * a + ei[6] * b + ei[10] * c + ei[14]; }
        pos[i] = nx; pos[i + 1] = ny; pos[i + 2] = nz;
      }
      if (touched) part.dirty = true;
    }
    // the two headlights (the real beam in fx/carLights.js dims with them)
    for (let k = 0; k < 2; k++) {
      const px = st.maxX - .12 - S.ax, pz = (k ? .68 : -.68) * st.v.halfWid - S.az, s = px * tx + pz * tz, t = Math.max(0, px * S.nx + pz * S.nz);
      const lat = s < s0 ? s0 - s : s > s1 ? s - s1 : 0; if (lat >= S.rh || Math.abs(.7 - S.cy) >= S.rv) continue;
      let w = 1 - (lat / S.rh) * (lat / S.rh); w *= w;
      st.head[k] = Math.max(0, st.head[k] - w * Math.max(0, 1 - t / Ls) * kill);
    }
    st.dirty = true; return out;
  }

  // Send the bent shapes to the graphics card: once per frame at most, however many knocks landed.
  function flush(st) {
    st.dirty = false;
    for (const p of st.parts) {
      if (!p.dirty) continue; p.dirty = false;
      const T = p.tpl, n = T.count * 3; if (scratch.length < n) scratch = new Float32Array(n);
      const nc = scratch.subarray(0, n), out = p.nrm, n0 = T.normal, c0 = T.nc0;
      faceNormals(p.pos, T.index, nc);
      // the authored normal, turned by however much the surface under it turned: untouched panels stay exactly as modelled
      for (let i = 0; i < n; i += 3) {
        const x = n0[i] + nc[i] - c0[i], y = n0[i + 1] + nc[i + 1] - c0[i + 1], z = n0[i + 2] + nc[i + 2] - c0[i + 2], l = Math.hypot(x, y, z) || 1;
        out[i] = x / l; out[i + 1] = y / l; out[i + 2] = z / l;
      }
      const a = p.geo.attributes; a.position.needsUpdate = true; a.normal.needsUpdate = true; a.aDmg.needsUpdate = true;
    }
  }

  // ---------- a bumper comes off ----------
  // Every triangle of the lowest slice of the nose (or tail) is copied into a loose part that flies off;
  // what is left behind is pushed in and drawn as dark, bare structure.
  function tear(st, front, sev) {
    const v = st.v, sign = front ? 1 : -1, edge = front ? st.maxX : st.minX, deep = .36 * st.size;
    const inSlab = (x) => (edge - x) * sign < deep;
    let low = 1e9;
    for (const p of st.parts) { const P = p.tpl.position, e = p.M?.elements; if (e) continue; for (let i = 0; i < P.length; i += 3) if (inSlab(P[i]) && P[i + 1] < low) low = P[i + 1]; }
    const top = low + .4 * st.size, group = new THREE.Group(), centre = new THREE.Vector3(); let total = 0;
    const cut = [];
    for (const p of st.parts) {
      if (p.M || p.role === GLASS) continue;
      const P = p.tpl.position, ix = p.tpl.index, inZone = (k) => inSlab(P[k * 3]) && P[k * 3 + 1] < top, tris = [];
      for (let t = 0; t < ix.length; t += 3) if (inZone(ix[t]) && inZone(ix[t + 1]) && inZone(ix[t + 2])) tris.push(ix[t], ix[t + 1], ix[t + 2]);
      if (!tris.length) continue;
      cut.push([p, tris]);
      for (const k of tris) { centre.x += p.pos[k * 3]; centre.y += p.pos[k * 3 + 1]; centre.z += p.pos[k * 3 + 2]; total++; }
    }
    if (total < 12) return false;
    centre.divideScalar(total);
    for (const [p, tris] of cut) {
      const n = tris.length, pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), dm = new Float32Array(n * 4), geo = new THREE.BufferGeometry();
      const extra = p.tpl.extra.map(a => ({ a, out: new Float32Array(n * a.size) }));
      for (let i = 0; i < n; i++) {
        const k = tris[i];
        pos[i * 3] = p.pos[k * 3] - centre.x; pos[i * 3 + 1] = p.pos[k * 3 + 1] - centre.y; pos[i * 3 + 2] = p.pos[k * 3 + 2] - centre.z;
        nrm[i * 3] = p.nrm[k * 3]; nrm[i * 3 + 1] = p.nrm[k * 3 + 1]; nrm[i * 3 + 2] = p.nrm[k * 3 + 2];
        dm[i * 4] = Math.max(p.dmg[k * 4], .3); dm[i * 4 + 1] = 1; dm[i * 4 + 3] = Math.max(p.dmg[k * 4 + 3], .5);
        for (const x of extra) for (let c = 0; c < x.a.size; c++) x.out[i * x.a.size + c] = x.a.array[k * x.a.size + c];
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); geo.setAttribute('aDmg', new THREE.BufferAttribute(dm, 4));
      for (const x of extra) geo.setAttribute(x.a.name, new THREE.BufferAttribute(x.out, x.a.size));
      const m = new THREE.Mesh(geo, twinOf(p.srcMat, p.role, true)); m.castShadow = true; m.receiveShadow = true; group.add(m);
      twins.get(p.srcMat).refs += 1e6;      // loose parts outlive their car: keep their material for good
    }
    // what stays on the car
    for (const p of st.parts) {
      if (p.M || p.role === GLASS) continue;
      const P = p.tpl.position; let any = false;
      for (let i = 0, j4 = 0; i < P.length; i += 3, j4 += 4) if (inSlab(P[i]) && P[i + 1] < top) { p.pos[i] -= sign * .09 * st.size; p.dmg[j4 + 2] = 1; p.dmg[j4 + 1] = 1; any = true; }
      if (any) p.dirty = true;
    }
    st.dirty = true;
    v.mesh.updateMatrixWorld(true);
    group.position.copy(centre).applyMatrix4(v.mesh.matrixWorld); group.quaternion.copy(v.mesh.quaternion);
    const out = sign * (2 + Math.random() * 2);
    game.debris.addPart(group, v.vx * .55 + v.fx * out + (Math.random() - .5) * 3, 2.2 + Math.random() * 1.5, v.vz * .55 + v.fz * out + (Math.random() - .5) * 3, .16 * st.size);
    return true;
  }

  const damage = {
    live,
    // The game's crash hook: v took a knock of `impact` m/s. Finds where from the physics contacts.
    // Returns the spot in the world (for sparks and sound), or null when nothing was dented.
    crash(v, impact) {
      if (!ready || v.gone) return null;
      const p = game.player; if (Math.hypot(v.x - p.x, v.z - p.z) > D.range) return null;
      const c = v.body ? game.physics.contactOf(v.body, hitInfo) : null;
      if (c) {
        const o = c.owner;
        if (o && !o.isVehicle) return null;                     // a person: no dent
        return damage.hit(v, { ax: c.ax, az: c.az, bx: c.bx, bz: c.bz, nx: c.nx, nz: c.nz, sev: impact, kind: o ? 'car' : c.round ? 'post' : c.low ? 'ledge' : 'wall', r: c.r, tall: !!o && o.halfWid > 1, other: o });
      }
      // nothing touching (a ledge, the edge of a ramp): whichever end is leading took it
      const s = v.vf < 0 ? 1 : -1, w = v.halfWid * .7;             // the knock has already thrown the car back
      return damage.hit(v, { ax: s * v.halfLen, az: -w, bx: s * v.halfLen, bz: w, nx: -s, nz: 0, sev: impact, kind: 'ledge' });
    },

    // Dent a vehicle directly. Everything is in the car's own frame: x forward, z to its right.
    hit(v, { ax, az, bx = ax, bz = az, nx, nz, sev, kind = 'wall', r = .3, tall = false }) {
      let st = v.dmg;
      if (st && st.parts.length && !st.parts[0].mesh.parent) { release(v); st = null; }       // its model was swapped under us
      if (!st) st = begin(v);
      if (!st.parts.length) return null;
      const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
      const heavy = kind === 'car' ? clamp(Math.sqrt((v.stats?.mass || 1200) / 1200), .6, 1.6) : 1;      // a truck barely slows when it hits a car, but it still bends
      const k = sev * heavy, d = clamp(.03 + (k - D.knockMin) * D.depthPer, 0, D.maxDepth) * st.size;
      const S = { ax, az, bx, bz, nx, nz, d, sev: k, rh: ((kind === 'post' ? r : 0) + D.wide[kind] + d * (kind === 'post' ? .6 : 1)) * Math.max(.5, st.size), cy: 1, rv: 6 };
      if (kind === 'car') { S.cy = tall ? .9 : .58; S.rv = (tall ? 1.2 : .62) + d; }
      else if (kind === 'ledge') { S.cy = .3; S.rv = .55 + d; }
      const res = stamp(st, S);
      const mx = (ax + bx) / 2, mz = (az + bz) / 2, end = mx > v.halfLen * .55 ? 1 : mx < -v.halfLen * .55 ? -1 : 0;
      if (end > 0) st.front += d; else if (end < 0) st.rear += d;

      // where that is in the world
      const wx = v.x + v.fx * mx + v.rx * mz, wz = v.z + v.fz * mx + v.rz * mz, wy = (v.y || 0) + Math.min(S.cy, 1) * .8;
      const ox = -(v.fx * nx + v.rx * nz), oz = -(v.fz * nx + v.rz * nz);          // pointing out of the car
      const near = Math.hypot(wx - game.player.x, wz - game.player.z);
      if (near < 90) {
        const bits = clamp(Math.round((k - 4) * .8), 0, 12);
        if (bits) game.debris.burst(wx, wy, wz, ox, oz, bits, col.set(st.color).getHex(), .13, 3 + k * .3, v.vx, v.vz);
        if (res.glass) { game.debris.burst(wx - ox * .6, (v.y || 0) + 1.25, wz - oz * .6, ox, oz, 14, 0xcfe6ee, .07, 4, v.vx, v.vz); game.audio.glass?.(clamp(1 - near / 90, 0, 1)); }
        if (res.lamp) {
          const [lx, ly, lz] = res.lamp;
          game.debris.burst(v.x + v.fx * lx + v.rx * lz, (v.y || 0) + ly, v.z + v.fz * lx + v.rz * lz, ox, oz, 6, lx > 0 ? 0xfff6e0 : 0xff3030, .06, 3.5, v.vx, v.vz);
          game.audio.glass?.(clamp(.7 - near / 90, 0, 1));
        }
      }
      if (v.halfWid > .5 && d >= D.tearHit * st.size) {
        if (end > 0 && !st.tornF && st.front >= D.tearAt * st.size) st.tornF = tear(st, true, k) || 'none';
        if (end < 0 && !st.tornR && st.rear >= D.tearAt * st.size) st.tornR = tear(st, false, k) || 'none';
      }
      return world.set(wx, wy, wz);
    },

    // Good as new (for a repair shop). Health is the caller's business.
    repair(v) { release(v); },
    release,

    update(dt) {
      // get the models ready for bending a little at a time (one mesh per frame), so the first crash never stutters
      const all = game.traffic?.vehicles;
      if (ready && all?.length) {
        if (warm.length) { const [geo, edge] = warm.pop(); templateOf(geo, edge); }
        else {
          const v = all[warmI++ % all.length], u = v.mesh.userData;
          if (!v.dmg && v.dmgWarm !== u.model) { v.dmgWarm = u.model; u.chassis.traverse(o => { if (o.isMesh && !o.isInstancedMesh && o.geometry?.attributes?.position && !templates.has(o.geometry.uuid) && !v.rider?.getObjectById(o.id) && !warm.some(w => w[0] === o.geometry)) warm.push([o.geometry, edgeFor(v)]); }); }
        }
      }
      syncTwins();
      const p = game.player;
      for (const st of live) {
        if (st.dirty) flush(st);
        const v = st.v;
        if (st.front >= D.steamAt * st.size && !v.wrecked && v.halfWid > .5 && (st.steamT -= dt) <= 0) {
          st.steamT = .09 + Math.random() * .16;
          if (Math.hypot(v.x - p.x, v.z - p.z) < 70) { const nose = v.halfLen * .8; game.fx.smoke(v.x + v.fx * nose, (v.y || 0) + .95, v.z + v.fz * nose, .92, .42, .75, v.vx * .6, v.vz * .6); }
        }
      }
    },
  };
  return damage;
}
