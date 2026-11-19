// Shape tools for things with smooth, curved bodies (helicopters, boats): no boxes stuck together.
//   body()   a rounded body described by a few cross-sections along its length
//   loft()   the skin of such a body
//   patch()  a piece of that skin lifted a hair off the surface: a window, a stripe, a decal
//   kit()    collects pieces by material and welds each material into one mesh
// Frame: x forward, y up, z to the right (the same as the cars).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
const spow = (v, e) => Math.sign(v) * Math.abs(v) ** e;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// stations: [x, y, w, top, bot, e] = where along the body, the height of its middle, half its width, how far it
// reaches above and below the middle, and how square the section is (2 = an ellipse, 5 = nearly a box).
// Returns f(x, a, grow): the point on the skin at x, `a` radians round it (0 = right side, 90 deg = top).
export function body(stations) {
  const S = stations.map(s => ({ x: s[0], y: s[1], w: s[2], top: s[3], bot: s[4] ?? s[3], e: s[5] ?? 2.4 })).sort((a, b) => a.x - b.x);
  const keys = ['y', 'w', 'top', 'bot', 'e'];
  const tan = (i, k) => { const a = S[Math.max(0, i - 1)], b = S[Math.min(S.length - 1, i + 1)]; return (b[k] - a[k]) / (b.x - a.x); };
  const at = (x, o = {}) => {
    let i = 0; while (i < S.length - 2 && x > S[i + 1].x) i++;
    const a = S[i], b = S[i + 1], d = b.x - a.x, t = clamp((x - a.x) / d, 0, 1), t2 = t * t, t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
    for (const k of keys) o[k] = h00 * a[k] + h10 * d * tan(i, k) + h01 * b[k] + h11 * d * tan(i + 1, k);
    // never fatter than the fatter of the two sections it runs between (the curve may not bulge past them)
    o.w = clamp(o.w, 0, Math.max(a.w, b.w) * 1.04); o.top = clamp(o.top, 0, Math.max(a.top, b.top) * 1.04); o.bot = clamp(o.bot, 0, Math.max(a.bot, b.bot) * 1.04);
    return o;
  };
  const tmp = {};
  const f = (x, a, grow = 0, out = []) => {
    const s = at(x, tmp), c = Math.cos(a), sn = Math.sin(a), ex = 2 / Math.max(1.2, s.e);
    out[0] = x; out[1] = s.y + Math.max(0, (sn >= 0 ? s.top : s.bot) + grow) * spow(sn, ex); out[2] = Math.max(0, s.w + grow) * spow(c, ex);
    return out;
  };
  f.x0 = S[0].x; f.x1 = S[S.length - 1].x; f.S = S; f.at = at;
  return f;
}

function finish(pos, idx, uv, centre) {
  // make every triangle face away from the middle of the shape
  const a = idx[0] * 3, b = idx[1] * 3, c = idx[2] * 3;
  let flip = false;
  for (let t = 0; t < idx.length; t += 3) {
    const i = idx[t] * 3, j = idx[t + 1] * 3, k = idx[t + 2] * 3;
    const ux = pos[j] - pos[i], uy = pos[j + 1] - pos[i + 1], uz = pos[j + 2] - pos[i + 2], vx = pos[k] - pos[i], vy = pos[k + 1] - pos[i + 1], vz = pos[k + 2] - pos[i + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz);
    if (l < 1e-7) continue;
    const m = centre((pos[i] + pos[j] + pos[k]) / 3), ox = 0, oy = (pos[i + 1] + pos[j + 1] + pos[k + 1]) / 3 - m[1], oz = (pos[i + 2] + pos[j + 2] + pos[k + 2]) / 3 - m[2];
    if (Math.hypot(oy, oz) < 1e-4) continue;
    flip = nx * ox + ny * oy + nz * oz < 0; break;
  }
  void a; void b; void c;
  if (flip) for (let t = 0; t < idx.length; t += 3) { const k = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = k; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// The whole skin of a body (or the part between x0 and x1, or only the arc a0..a1 round it).
export function loft(f, { seg = 28, step = .14, x0 = f.x0, x1 = f.x1, a0 = 0, a1 = TAU, grow = 0, caps = true } = {}) {
  const xs = [], S = f.S, full = Math.abs(a1 - a0 - TAU) < 1e-6;
  const cuts = [x0, ...S.map(s => s.x).filter(x => x > x0 + 1e-6 && x < x1 - 1e-6), x1];
  for (let i = 0; i < cuts.length - 1; i++) { const n = Math.max(2, Math.ceil((cuts[i + 1] - cuts[i]) / step)); for (let k = 0; k < n; k++) xs.push(cuts[i] + (cuts[i + 1] - cuts[i]) * k / n); }
  xs.push(x1);
  const cols = full ? seg : seg + 1, pos = [], uv = [], idx = [], p = [];
  for (let r = 0; r < xs.length; r++) for (let j = 0; j < cols; j++) {
    f(xs[r], a0 + (a1 - a0) * j / seg, grow, p); pos.push(p[0], p[1], p[2]); uv.push(r / (xs.length - 1), j / seg);
  }
  for (let r = 0; r < xs.length - 1; r++) for (let j = 0; j < seg; j++) {
    const j2 = full ? (j + 1) % seg : j + 1, A = r * cols + j, B = r * cols + j2, C = (r + 1) * cols + j, D = (r + 1) * cols + j2;
    idx.push(A, B, C, B, D, C);
  }
  const mid = (x) => { const s = f.at(x); return [x, s.y + (s.top - s.bot) / 2, 0]; };
  if (full && caps) for (const [r, sign] of [[0, -1], [xs.length - 1, 1]]) {
    const m = mid(xs[r]), c = pos.length / 3; pos.push(xs[r] + sign * 1e-4, m[1], 0); uv.push(r ? 1 : 0, .5);
    for (let j = 0; j < seg; j++) idx.push(c, r * cols + j, r * cols + (j + 1) % seg);
  }
  // the end fans may be wound either way: fix each triangle on its own against the body's middle line
  const g = finish(pos, idx, uv, mid);
  if (full && caps) {
    const ix = g.index.array, P = g.attributes.position.array, n = seg * 2 * 3;
    for (let t = ix.length - n; t < ix.length; t += 3) {
      const i = ix[t] * 3, j = ix[t + 1] * 3, k = ix[t + 2] * 3;
      const ny = (P[j + 2] - P[i + 2]) * (P[k] - P[i]) - (P[j] - P[i]) * (P[k + 2] - P[i + 2]), nz = (P[j] - P[i]) * (P[k + 1] - P[i + 1]) - (P[j + 1] - P[i + 1]) * (P[k] - P[i]);
      const nx = (P[j + 1] - P[i + 1]) * (P[k + 2] - P[i + 2]) - (P[j + 2] - P[i + 2]) * (P[k + 1] - P[i + 1]);
      void ny; void nz;
      const out = P[i] > (x0 + x1) / 2 ? 1 : -1;
      if (nx * out < 0) { const s = ix[t + 1]; ix[t + 1] = ix[t + 2]; ix[t + 2] = s; }
    }
    g.computeVertexNormals();
  }
  return g;
}

// A piece of a body's skin. map(u, v) -> [x, a] says which part (u, v run 0..1 across the piece and become its
// texture coordinates); grow lifts it off the surface so it sits on top of the paint.
export function patch(f, map, nu = 10, nv = 8, grow = .012) {
  const pos = [], uv = [], idx = [], p = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const [x, a] = map(i / nu, j / nv); f(x, a, grow, p); pos.push(p[0], p[1], p[2]); uv.push(i / nu, j / nv);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const A = j * (nu + 1) + i, B = A + 1, C = A + nu + 1, D = C + 1; idx.push(A, B, C, B, D, C); }
  return finish(pos, idx, uv, (x) => { const s = f.at(clamp(x, f.x0, f.x1)); return [x, s.y + (s.top - s.bot) / 2, 0]; });
}

// A free-form sheet from a grid of points: pt(u, v) -> [x, y, z]. `out` is any point the front of the sheet faces away from.
export function sheet(pt, nu, nv, inside = [0, 0, 0], two = false) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const p = pt(i / nu, j / nv); pos.push(p[0], p[1], p[2]); uv.push(i / nu, j / nv); }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const A = j * (nu + 1) + i, B = A + 1, C = A + nu + 1, D = C + 1; idx.push(A, B, C, B, D, C); if (two) idx.push(A, C, B, B, C, D); }
  // face away from `inside`
  let flip = false;
  for (let t = 0; t < idx.length && !two; t += 3) {
    const i = idx[t] * 3, j = idx[t + 1] * 3, k = idx[t + 2] * 3;
    const ux = pos[j] - pos[i], uy = pos[j + 1] - pos[i + 1], uz = pos[j + 2] - pos[i + 2], vx = pos[k] - pos[i], vy = pos[k + 1] - pos[i + 1], vz = pos[k + 2] - pos[i + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; if (Math.hypot(nx, ny, nz) < 1e-7) continue;
    flip = nx * ((pos[i] + pos[j] + pos[k]) / 3 - inside[0]) + ny * ((pos[i + 1] + pos[j + 1] + pos[k + 1]) / 3 - inside[1]) + nz * ((pos[i + 2] + pos[j + 2] + pos[k + 2]) / 3 - inside[2]) < 0; break;
  }
  if (flip) for (let t = 0; t < idx.length; t += 3) { const k = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = k; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// A bent tube through a list of [x, y, z] points.
export function tube(points, r, radial = 8, per = 6, closed = false) {
  const c = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p[0], p[1], p[2])), closed, 'catmullrom', .5);
  return new THREE.TubeGeometry(c, Math.max(4, (points.length - 1) * per), r, radial, closed);
}

// Collects shapes by material name; build() welds each material's shapes into one mesh under `parent`.
export function kit() {
  const parts = {}, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), P = new THREE.Vector3(), Sc = new THREE.Vector3();
  const plain = (geo) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    g.morphAttributes = {}; g.clearGroups(); return g;
  };
  const rewind = (g) => { for (const a of Object.values(g.attributes)) { const d = a.array, n = a.itemSize; for (let t = 0; t < a.count; t += 3) for (let c = 0; c < n; c++) { const i = (t + 1) * n + c, j = (t + 2) * n + c, s = d[i]; d[i] = d[j]; d[j] = s; } } };
  const K = {
    // put a shape in: at (x, y, z), scaled (sx, sy, sz), turned (rx, ry, rz). A negative scale mirrors it.
    add(key, geo, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
      const g = plain(geo); g.applyMatrix4(m4.compose(P.set(x, y, z), q.setFromEuler(e.set(rx, ry, rz)), Sc.set(sx, sy, sz)));
      if (sx * sy * sz < 0) rewind(g);
      (parts[key] ||= []).push(g); return K;
    },
    // the same shape on both sides of the craft (mirrored across its centre line)
    both(key, geo, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) { K.add(key, geo, x, y, z, sx, sy, sz, rx, ry, rz); const g = plain(geo); g.applyMatrix4(m4.compose(P.set(x, y, z), q.setFromEuler(e.set(rx, ry, rz)), Sc.set(sx, sy, sz))); if (sx * sy * sz < 0) rewind(g); g.applyMatrix4(m4.makeScale(1, 1, -1)); rewind(g); (parts[key] ||= []).push(g); return K; },
    has: (key) => !!parts[key],
    // every material's shapes welded: { name: geometry }
    all() { const out = {}; for (const key of Object.keys(parts)) out[key] = K.geo(key); return out; },
    geo(key) { const g = mergeGeometries(parts[key]); parts[key].forEach(x => x.dispose()); delete parts[key]; return g; },
    // material(key) -> the material for a name; noShadow: names that cast no shadow
    build(parent, material, noShadow = []) {
      const made = {};
      for (const key of Object.keys(parts)) {
        const m = new THREE.Mesh(K.geo(key), material(key)); m.name = key;
        m.castShadow = !noShadow.includes(key); m.receiveShadow = true; parent.add(m); made[key] = m;
      }
      return made;
    },
  };
  return K;
}
