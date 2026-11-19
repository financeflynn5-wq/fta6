// Helicopters and boats. Built here in code from smooth lofted bodies (loft.js), dressed like the cars:
// clearcoat paint in two tones, dark glass, chrome and trim, lamps that glow at night.
// The same contract as carModel.js: group -> chassis (tilts and rocks) with everything on it, and
// userData the rest of the game reads. Craft have no road wheels (wheels: []), and add:
//   craft: 'heli' | 'boat'    rotor, tailRotor, disc, tailDisc, blades: the spinning parts of a helicopter
//   engines: outboard motors that turn with the helm    seat: where a rider you can see sits or stands
//   noDent: parts crash damage must leave alone (rotors)
import * as THREE from 'three';
import { choose } from '../core/utils.js';
import { mats, std, phys, paint, G, rbox, ctex } from '../world/materials.js';
import { body, loft, patch, sheet, tube, kit } from './loft.js';

const PI = Math.PI, TAU = PI * 2;
const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), smooth = (t) => t * t * (3 - 2 * t);

// ---------- materials ----------
const dark = std({ color: 0x1b1d22, roughness: .55, metalness: .35 });
const rubber = std({ color: 0x17181b, roughness: .85 });
const blade = std({ color: 0x2a2d33, roughness: .5, metalness: .4 });
const vinyl = std({ color: 0xf3e9d6, roughness: .7 });
const seatDark = std({ color: 0x24262c, roughness: .65 });
const deckGrey = std({ color: 0x8b9199, roughness: .9 });
const gel = std({ color: 0xf2efe8, roughness: .45 });                     // the inside of a hull: plain white gelcoat
const clearGlass = phys({ color: 0x9fd6e6, roughness: .04, metalness: 0, transparent: true, opacity: .34, depthWrite: false, side: THREE.DoubleSide, clearcoat: 1 });
clearGlass.userData.role = 'glass';
const armyPaint = std({ color: 0x5c6444, roughness: .72, metalness: .12 }), armyPaint2 = std({ color: 0x3f4632, roughness: .75, metalness: .1 });
armyPaint.userData.role = armyPaint2.userData.role = 'paint';
const lamp = (c, i = 2.4) => std({ color: 0x111111, emissive: c, emissiveIntensity: i });
const navRed = lamp(0xff2a2a), navGreen = lamp(0x22ff66), navWhite = lamp(0xffffff, 2);
let rnd = 7; const rr = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;       // own dice: the city's seeded sequence is left alone
const teak = std({
  roughness: .62, map: ctex(256, (x, s) => {
    x.fillStyle = '#b5814f'; x.fillRect(0, 0, s, s);
    for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(${rr() < .5 ? '70,40,15' : '235,190,130'},${.05 + rr() * .1})`; x.fillRect(rr() * s, rr() * s, 30 + rr() * 90, 1 + rr() * 2); }
    x.fillStyle = '#f0e2c4'; for (let i = 0; i < 8; i++) x.fillRect(0, i * s / 8, s, 3);
  }),
});
const collars = {};
const collar = (c) => collars[c] || (collars[c] = Object.assign(std({ color: c, roughness: .58 }), { userData: { role: 'paint' } }));
const decals = {};
// Lettering: 'decal:TEXT:#colour' -> a see-through label that sits on the paint.
function decal(key) {
  if (decals[key]) return decals[key];
  const [, text, color = '#111111'] = key.split(':');
  const c = document.createElement('canvas'); c.width = 1024; c.height = 160;
  const x = c.getContext('2d'); x.fillStyle = color; x.font = 'italic 900 132px "Archivo Black",Impact,"Arial Black",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const w = x.measureText(text).width; if (w > 980) x.setTransform(980 / w, 0, 0, 1, 512 * (1 - 980 / w), 0);
  x.fillText(text, 512, 86);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return decals[key] = std({ map: t, alphaTest: .45, roughness: .5 });
}
// What a spinning rotor looks like: a faint streaked disc.
const discTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  for (let i = 0; i < 150; i++) {
    const a = rr() * TAU, w = .1 + rr() * .5;
    x.strokeStyle = `rgba(255,255,255,${.05 + rr() * .1})`; x.lineWidth = 2 + rr() * 5;
    x.beginPath(); x.arc(128, 128, 14 + rr() * 110, a, a + w); x.stroke();
  }
  const g = x.createRadialGradient(128, 128, 8, 128, 128, 127); g.addColorStop(0, 'rgba(255,255,255,.0)'); g.addColorStop(.25, 'rgba(255,255,255,.16)'); g.addColorStop(.93, 'rgba(255,255,255,.3)'); g.addColorStop(.97, 'rgba(255,255,255,.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.beginPath(); x.arc(128, 128, 127, 0, TAU); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const discMat = () => { const m = new THREE.MeshBasicMaterial({ map: discTex, color: 0x30343b, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }); m.userData.noAO = true; return m; };

// ---------- shape helpers ----------
// squeeze the corners of a square (u, v in 0..1) so a window or a door has rounded corners
function round(u, v, k = .55) { const p = 2 * u - 1, q = 2 * v - 1; return [(lerp(p, p * Math.sqrt(1 - q * q / 2), k) + 1) / 2, (lerp(q, q * Math.sqrt(1 - p * p / 2), k) + 1) / 2]; }
// a rounded panel on a body's skin, between x0..x1 along it and the angles a0..a1 round it
const win = (f, x0, x1, a0, a1, k = .55, grow = .014) => patch(f, (u, v) => { const [p, q] = round(u, v, k); return [lerp(x0, x1, p), lerp(a0, a1, q)]; }, 14, 10, grow);
// a thin dark line on the skin (a door's edge)
function seam(f, x0, x1, a0, a1, r = .011) {
  const pts = [], n = 36, o = [];
  for (let i = 0; i < n; i++) {
    const t = i / n * 4, s = Math.floor(t), e = t - s, [u, v] = s === 0 ? [e, 0] : s === 1 ? [1, e] : s === 2 ? [1 - e, 1] : [0, 1 - e], [p, q] = round(u, v, .5);
    f(lerp(x0, x1, p), lerp(a0, a1, q), .002, o); pts.push([o[0], o[1], o[2]]);
  }
  return tube(pts, r, 5, 3, true);
}
// stations that close a body with a rounded end: from the full section at xb to a tip at xt
function dome(xb, xt, y, w, top, bot, e, yt = y, n = 6) {
  const out = [];
  for (let i = 1; i <= n; i++) { const a = i / n * PI / 2, t = Math.sin(a), k = Math.max(.015, Math.cos(a)); out.push([lerp(xb, xt, t), lerp(y, yt, t * t), w * k, top * k, bot * k, lerp(e, 2, t)]); }
  return out;
}
// a flat plate cut to a side profile ([x, y] or [x, y, cx, cy] to curve round a corner), with soft edges
function slab(pts, thick, bevel = .018) {
  const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) { if (p.length === 4) s.quadraticCurveTo(p[2], p[3], p[0], p[1]); else s.lineTo(p[0], p[1]); }
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 8 });
  g.translate(0, 0, -thick / 2); return g;
}
const torus = (R, r) => new THREE.TorusGeometry(R, r, 8, 24);

// ============================================================ helicopters ============================================================
const HELIS = {
  // a five-seat runabout: glass nose, slim boom, four blades
  heli: {
    body: [...dome(2.0, 3.05, 1.30, .76, .66, .54, 2.3, 1.2), [2.0, 1.30, .76, .66, .54, 2.3], [1.2, 1.38, .93, .88, .67, 2.5], [.4, 1.42, 1.0, .95, .74, 2.7], [-.6, 1.44, 1.0, .95, .74, 2.7],
      [-1.5, 1.5, .85, .84, .62, 2.5], [-2.3, 1.63, .56, .57, .42, 2.2], [-3.1, 1.77, .32, .34, .26, 2], [-4.4, 1.87, .21, .22, .2, 2], [-6.6, 1.98, .13, .14, .13, 2]],
    cowl: [[1.2, 2.2, .03, .03, .03, 2], [.8, 2.32, .3, .2, .16, 2.2], [.1, 2.4, .46, .34, .22, 2.4], [-.9, 2.42, .5, .36, .26, 2.4], [-1.9, 2.28, .42, .3, .3, 2.2], [-2.7, 2.06, .26, .2, .2, 2], [-3.2, 1.96, .08, .07, .07, 2]],
    screen: [1.02, 2.97, .14, -.72], chin: [2.02, 2.8, -1.28, -.74], windows: [[-.95, .84, .12, 1.02], [-1.95, -1.2, .3, .95]], door: [-1.06, .93, -.82, 1.1],
    belly: (x) => x > 2 ? lerp(-.8, -1.2, clamp(x - 2, 0, 1)) : x > -2.5 ? lerp(-.3, -.8, (x + 2.5) / 4.5) : lerp(.5, -.3, clamp((x + 6.5) / 4, 0, 1)),
    mast: [-.1, 2.66, 3.08], rotor: { R: 5.1, n: 4, chord: .3 }, tailRotor: { x: -6.66, y: 2.02, z: -.25, R: .62 },
    stab: { x: -4.9, y: 1.9, span: 1.0, chord: .5 },
    fin: [[-5.75, 2.05], [-6.55, 3.2, -6.3, 2.5], [-6.98, 3.26, -6.72, 3.34], [-7.08, 3.1, -7.08, 3.24], [-6.7, 2.0]],
    keel: [[-6.0, 1.9], [-6.6, 1.3, -6.42, 1.5], [-6.9, 1.28, -6.76, 1.2], [-6.72, 1.95]],
    skid: { z: 1.04, x0: -1.9, x1: 1.75, cross: [.95, -1.0], top: .76 }, exhaust: [-2.25, 2.26, .2], light: [2.35, .82],
    name: [-5.3, -3.3, -.62, .7], colors: [0xf4f1ea, 0x2bb3c0, 0xff7a00, 0x23272e, 0xff7aa2, 0xe8455b],
    second: { 0xf4f1ea: 0xe8455b, 0x2bb3c0: 0xf4f1ea, 0xff7a00: 0xf4f1ea, 0x23272e: 0xf2a93b, 0xff7aa2: 0xf4f1ea, 0xe8455b: 0xf4f1ea, 0xf4f4f4: 0x1d2a4f },
  },
  // the army's workhorse: a long boxy cabin, a tall fin, two broad blades
  armyheli: {
    body: [...dome(2.5, 3.5, 1.36, .86, .66, .58, 2.8, 1.26), [2.5, 1.36, .86, .66, .58, 2.8], [1.7, 1.5, 1.08, .9, .74, 3.2], [.6, 1.56, 1.16, 1.0, .8, 3.6], [-1.1, 1.56, 1.16, 1.0, .8, 3.6],
      [-2.1, 1.6, 1.0, .9, .7, 3.0], [-3.0, 1.8, .6, .6, .45, 2.4], [-3.9, 1.96, .34, .36, .28, 2], [-5.6, 2.1, .24, .25, .22, 2], [-7.7, 2.32, .15, .16, .15, 2]],
    cowl: [[1.5, 2.44, .03, .03, .03, 2], [1.0, 2.52, .42, .22, .16, 2.6], [.1, 2.6, .62, .4, .22, 3], [-1.3, 2.62, .66, .42, .28, 3], [-2.4, 2.5, .5, .34, .3, 2.6], [-3.2, 2.3, .28, .22, .2, 2], [-3.7, 2.2, .08, .07, .07, 2]],
    screen: [1.5, 3.4, .1, -.5], chin: [2.5, 3.25, -1.25, -.78], windows: [[.55, 1.32, .12, .98], [-1.65, .3, .16, .98]], door: [-1.8, .42, -.86, 1.08],
    belly: (x) => x > 2.4 ? lerp(-.9, -1.25, clamp(x - 2.4, 0, 1)) : x > -3 ? -.9 : lerp(-.2, -.9, clamp((x + 7.6) / 4.6, 0, 1)),
    mast: [-.2, 2.9, 3.42], rotor: { R: 6.1, n: 2, chord: .5 }, tailRotor: { x: -8.0, y: 3.5, z: -.2, R: .85 },
    stab: { x: -6.0, y: 2.16, span: 1.15, chord: .6 },
    fin: [[-6.7, 2.3], [-7.6, 3.75, -7.3, 2.9], [-8.2, 3.8, -7.9, 3.86], [-8.36, 3.6, -8.36, 3.78], [-7.72, 2.24]],
    skid: { z: 1.2, x0: -2.4, x1: 2.3, cross: [1.5, -1.3], top: .82 }, exhaust: [-3.0, 2.48, .26], light: [2.8, .86],
    name: [-6.6, -4.2, -.6, .7], colors: [0x5c6444], second: {}, army: true,
  },
};
// the police one is the runabout in white over navy, with a searchlight and beacons
HELIS.policeheli = { ...HELIS.heli, colors: [0xf4f4f4], police: true };

function heliParts(type) {
  const S = HELIS[type], K = kit(), f = body(S.body), c = body(S.cowl), o = [];
  K.add('paint', loft(f, { seg: 36, step: .16 }));
  K.add('paint', loft(c, { seg: 22, step: .2 }));
  // glass: a wrap-round screen split by a centre post, chin panes, doors
  const [sx0, sx1, lowBack, lowFront] = S.screen;
  K.both('glass', patch(f, (u, v) => { const [p, q] = round(u, v, .35), x = lerp(sx0, sx1, p); return [x, lerp(lerp(lowBack, lowFront, Math.pow(p, .8)), PI / 2 - .035, q)]; }, 16, 14, .014));
  K.both('glass', win(f, ...S.chin, .7));
  for (const w of S.windows) K.both('glass', win(f, ...w, .5));
  K.both('trim', seam(f, ...S.door));
  // two-tone: the belly and the tail in the second colour, with a pinstripe above it
  const bx0 = f.x1 - .12, bx1 = f.x0 + .1;
  K.both('paint2', patch(f, (u, v) => { const x = lerp(bx0, bx1, u); return [x, lerp(-PI / 2, S.belly(x), v)]; }, 60, 6, .011));
  if (!S.army) K.both('stripe', patch(f, (u, v) => { const x = lerp(bx0 - .25, bx1, u), a = S.belly(x) + .09, w = .045 / Math.max(.16, f.at(x).w); return [x, lerp(a, a + w, v)]; }, 60, 1, .013));
  // engine cowl: intakes, exhausts
  K.both('trim', win(c, S.cowl[1][0] - .55, S.cowl[1][0] - .05, .15, .95, .7, .01));
  const [ex, ey, ez] = S.exhaust;
  K.both('chrome', G.cyl, ex, ey, ez, .075, .5, .075, 0, .22, PI / 2 - .12); K.both('trim', G.cyl, ex - .02, ey + .003, ez + .005, .06, .47, .06, 0, .22, PI / 2 - .12);
  // mast and swashplate (the hub and blades are the rotor's own)
  const [mx, my0, my1] = S.mast;
  K.add('metal', G.cyl, mx, (my0 + my1) / 2, 0, .06, my1 - my0, .06); K.add('metal', G.cyl, mx, my0 + .1, 0, .15, .06, .15); K.add('trim', G.cyl, mx, my0 + .02, 0, .2, .1, .2);
  // skids
  const k = S.skid;
  K.both('trim', tube([[k.x0, .09, k.z], [k.x0 + .4, .055, k.z], [k.x1 - .3, .055, k.z], [k.x1 + .12, .1, k.z], [k.x1 + .42, .3, k.z]], .055, 8, 5));
  for (const x of k.cross) K.add('trim', tube([[x, .07, -k.z], [x, .34, -k.z * .86], [x, k.top - .08, -k.z * .5], [x, k.top + .02, 0], [x, k.top - .08, k.z * .5], [x, .34, k.z * .86], [x, .07, k.z]], .045, 8, 5));
  K.both('chrome', G.cyl, k.cross[0], .2, k.z * .93, .03, .16, .03);                                                   // steps
  K.both('trim', rbox(.7, .03, .16, .012), (k.cross[0] + k.cross[1]) / 2 + .2, .3, k.z * .93);
  // tail: stabiliser with end plates, fin, guard
  const st = S.stab;
  K.add('paint', rbox(st.chord, .05, st.span * 2, .022), st.x, st.y, 0);
  K.both('paint2', slab([[-.3, -.22], [-.2, .26, -.3, .2], [.12, .26, -.02, .3], [.24, -.2, .26, .1], [.1, -.26, .22, -.26], [-.3, -.22, -.3, -.26]], .03, .012), st.x, st.y + .02, st.span);
  K.add('paint', slab(S.fin, .05, .022));
  if (S.keel) { K.add('paint2', slab(S.keel, .04, .018)); K.add('trim', tube([[-6.62, 1.34, 0], [-6.8, 1.2, 0], [-7.0, 1.2, 0]], .022, 6, 4)); }
  const tr = S.tailRotor;
  K.add('trim', G.sph, tr.x, tr.y, 0, .17, .15, .13); K.add('metal', G.cyl, tr.x, tr.y, tr.z / 2, .035, Math.abs(tr.z), .035, PI / 2);
  // lamps: landing light, red and green on the stabiliser tips, white at the tail, a beacon on the fin
  const [lx, ly] = S.light;
  K.add('trim', G.sph, lx, ly + .02, 0, .13, .07, .13); K.add('head', G.sph, lx + .03, ly - .02, 0, .1, .05, .1);
  K.add('light_port', G.sph, st.x + .05, st.y + .3, -st.span, .045, .045, .03); K.add('light_star', G.sph, st.x + .05, st.y + .3, st.span, .045, .045, .03);
  const top = S.fin[2]; K.add('light_beacon', G.sph, top[0] + .2, top[1] + .06, 0, .06, .07, .06);
  f(f.x0 + .02, 0, 0, o); K.add('light_stern', G.sph, f.x0 - .02, o[1], 0, .04, .04, .04);
  // lettering along the boom, right way round on both sides
  const [nx0, nx1, na0, na1] = S.name, label = S.army ? 'decal:ARMY 06:#1d2016' : S.police ? 'decal:POLICE:#f4f4f4' : 'decal:SUNSET AIR:#ffffff';
  K.add(label, patch(f, (u, v) => [lerp(nx0, nx1, u), lerp(na0, na1, v)], 16, 4, .016));
  K.add(label, patch(f, (u, v) => [lerp(nx1, nx0, u), PI - lerp(na0, na1, v)], 16, 4, .016));
  if (S.police) {
    // POLICE on the doors, a searchlight under the nose, red and blue beacons above and below
    const d = 'decal:POLICE:#1d2a4f';
    K.add(d, patch(f, (u, v) => [lerp(-1.0, .86, u), lerp(-.5, .04, v)], 16, 4, .016)); K.add(d, patch(f, (u, v) => [lerp(.86, -1.0, u), PI - lerp(-.5, .04, v)], 16, 4, .016));
    K.add('trim', G.cyl, 1.55, .66, 0, .05, .2, .05); K.add('trim', G.sph, 1.6, .5, 0, .2, .17, .17); K.add('head', G.sph, 1.72, .47, 0, .13, .13, .14);
    for (const [x, y, s] of [[.3, f.at(.3).y - f.at(.3).bot, .09], [-1.6, c.at(-1.6).y + c.at(-1.6).top, .08]]) { K.add('light_red', G.sph, x, y, .22, s, s * .8, s); K.add('light_blue', G.sph, x, y, -.22, s, s * .8, s); }
  }

  // main rotor (its own frame: the hub at the origin, turning about y)
  const R = kit(), ro = S.rotor;
  R.add('metal', G.cyl, 0, .02, 0, .17, .13, .17); R.add('trim', G.sph, 0, .1, 0, .13, .07, .13);
  for (let i = 0; i < ro.n; i++) {
    const a = i / ro.n * TAU, ca = Math.cos(a), sa = -Math.sin(a), len = ro.R - .55;
    R.add('metal', rbox(.5, .07, .13, .03), ca * .36, .02, sa * .36, 1, 1, 1, 0, a, 0);
    R.add('blade', rbox(len, .035, ro.chord, .016), ca * (.55 + len / 2), .02, sa * (.55 + len / 2), 1, 1, 1, .05, a, -.012);
    R.add('tip', rbox(.34, .037, ro.chord + .004, .016), ca * (ro.R - .17), .02 - .012 * (ro.R - .6), sa * (ro.R - .17), 1, 1, 1, .05, a, -.012);
  }
  // tail rotor (turning about z)
  const T = kit();
  T.add('metal', G.cyl, 0, 0, 0, .06, .1, .06, PI / 2);
  for (const s of [-1, 1]) { T.add('blade', rbox(.12, tr.R - .06, .022, .01), 0, s * (tr.R / 2 + .02), 0, 1, 1, 1, 0, .12 * s, 0); T.add('tip', rbox(.122, .1, .024, .01), 0, s * (tr.R - .06), 0, 1, 1, 1, 0, .12 * s, 0); }
  return { S, main: K.all(), rotor: R.all(), tail: T.all() };
}

// ============================================================ boats ============================================================
// A planing hull: a V bottom up to the chine, flared sides up to the gunwale, drawn to a point at the bow.
// u runs 0 (stern) to 1 (bow). y = 0 is the waterline at rest.
function hullOf(P) {
  const X = (u) => lerp(P.x0, P.x1, u), T = (u) => clamp((u - P.bowAt) / (1 - P.bowAt), 0, 1);
  const B = (u) => P.beam * (u < P.bowAt ? lerp(P.stern ?? .9, 1, smooth(clamp(u / .3, 0, 1))) : Math.pow(1 - Math.pow(T(u), P.bowPow ?? 2.4), .75));
  const C = (u) => B(u) * lerp(P.chine ?? .86, .5, T(u) ** 2);
  const sheer = (u) => lerp(P.sheer[0], P.sheer[1], u * u), tip = sheer(1);
  const keel = (u) => P.keel + (tip - .14 - P.keel) * T(u) ** 3, chineY = (u) => P.chineY + (tip - .07 - P.chineY) * T(u) ** 2.2;
  const bottom = (u, v) => [X(u), lerp(keel(u), chineY(u), Math.pow(v, 1.2)), C(u) * v];
  const side = (u, v) => [X(u), lerp(chineY(u), sheer(u), v), lerp(C(u), B(u), Math.pow(v, .7))];
  return { P, X, B, C, sheer, keel, chineY, bottom, side, uAt: (x) => (x - P.x0) / (P.x1 - P.x0) };
}
// hull skin into a kit: bottom, a boot stripe, the painted sides, the transom, a rub rail
function addHull(K, H, { bottom = 'bottom', boot = 'bottom', sides = 'paint', rail = 'trim', bootTop = .14, n = 44 } = {}) {
  const mid = [0, .25, 0];
  K.both(bottom, sheet((u, v) => H.bottom(u, v), n, 6, mid));
  K.both(boot, sheet((u, v) => H.side(u, v * bootTop), n, 1, mid));
  K.both(sides, sheet((u, v) => H.side(u, lerp(bootTop, 1, v)), n, 6, mid));
  K.add(sides, sheet((a, b) => { const p = b < .5 ? H.bottom(0, b * 2) : H.side(0, (b - .5) * 2); return [p[0], p[1], p[2] * (2 * a - 1)]; }, 8, 10, [H.P.x0 + 2, .2, 0]));
  if (rail) { const pts = []; for (let i = 0; i <= 26; i++) { const u = Math.min(.995, i / 26), p = H.side(u, 1); pts.push([p[0], p[1] - .02, p[2] + .012]); } K.both(rail, tube(pts, .034, 6, 3)); }
}

// One outboard motor, in its own frame (the pivot on the transom at the origin, the leg hanging down behind).
let outboardGeo = null;
function outboard() {
  if (outboardGeo) return outboardGeo;
  const K = kit(), c = body([[.14, .42, .03, .03, .03, 2], [.06, .45, .15, .2, .17, 2.6], [-.2, .5, .2, .27, .2, 2.8], [-.42, .48, .17, .23, .2, 2.6], [-.55, .43, .04, .05, .05, 2]]);
  K.add('cowl', loft(c, { seg: 18, step: .08 }));
  K.both('paint', patch(c, (u, v) => [lerp(-.47, .02, u), lerp(-.25, .12, v)], 10, 2, .006));
  K.add('chrome', patch(c, (u, v) => [lerp(-.3, -.1, u), lerp(PI / 2 - .5, PI / 2 + .5, v)], 4, 4, .006));
  K.add('leg', rbox(.2, .66, .13, .05), -.2, -.02, 0); K.add('leg', rbox(.44, .026, .27, .012), -.26, -.3, 0);
  K.add('leg', G.sph, -.22, -.47, 0, .27, .078, .078); K.add('leg', slab([[-.1, 0], [-.3, 0], [-.36, -.2, -.3, -.12], [-.2, -.2]], .014, .006), 0, -.52, 0);
  K.add('chrome', G.cyl, -.5, -.47, 0, .035, .1, .035, 0, 0, PI / 2);
  for (let i = 0; i < 3; i++) K.add('chrome', G.sph, -.5, -.47, 0, .012, .12, .06, i / 3 * TAU + .3, 0, 0);
  K.add('trim', rbox(.16, .3, .24, .03), .1, .14, 0);
  return outboardGeo = K.all();
}

const BOATS = {
  // an open sports boat: wrap-round screen, two seats and a bench, a sunpad, twin outboards
  speedboat: {
    hull: { x0: -3.3, x1: 3.5, beam: 1.1, sheer: [.68, .98], keel: -.4, chineY: -.1, bowAt: .42 },
    colors: [0xe8455b, 0x2bb3c0, 0xf4f1ea, 0x1d3a5f, 0xff7aa2, 0xf2a93b, 0x23272e],
    engines: [[-3.37, .36, .36], [-3.37, .36, -.36]], seat: { x: -.42, y: -.27, z: .43, pose: 'sit' },
  },
  // a sit-on water scooter
  jetski: {
    hull: { x0: -1.5, x1: 1.65, beam: .56, sheer: [.27, .37], keel: -.22, chineY: -.04, bowAt: .4, bowPow: 2.1 },
    colors: [0xffd60a, 0xff2d55, 0x00c2ff, 0x34e06b, 0xff7a00, 0xb980ff], engines: [], scale: 1.2, seat: { x: -.5, y: .25, z: 0 },
  },
  // the harbour patrol: a rigid inflatable with a centre console under a hard top
  policeboat: {
    hull: { x0: -3.5, x1: 3.7, beam: .98, sheer: [.46, .7], keel: -.38, chineY: -.08, bowAt: .5, bowPow: 2.8, stern: .96 },
    colors: [0x1d2a4f], engines: [[-3.62, .22, .38], [-3.62, .22, -.38]], seat: { x: -.5, y: .2, z: 0, pose: 'stand' },
  },
};

function speedboatParts() {
  const S = BOATS.speedboat, K = kit(), H = hullOf(S.hull), mid = [0, .3, 0];
  addHull(K, H, { rail: 'chrome' });
  const ua = H.uAt(-2.1), uc = H.uAt(.95), Bi = (u) => H.B(u) - .16, floor = 0, far = (s) => [0, .3, s * 9];
  // decks: the foredeck with a teak inlay, the side decks, the aft deck with a sunpad
  const fore = (lift, zn0, zn1, u0, u1) => (a, b) => { const u = lerp(u0, u1, a), zn = lerp(zn0, zn1, b); return [H.X(u), H.sheer(u) + .06 * (1 - zn * zn) * Math.min(1, (u - uc) * 8 + .25) + lift, zn * H.B(u)]; };
  K.add('paint2', sheet(fore(0, -1, 1, uc, 1), 20, 10, mid));
  K.add('teak', sheet(fore(.008, -.78, .78, uc + .07, .93), 16, 8, mid));
  K.both('paint2', sheet((a, b) => { const u = lerp(ua, uc, a); return [H.X(u), H.sheer(u), lerp(Bi(u), H.B(u), b)]; }, 12, 1, mid));
  K.add('paint2', sheet((a, b) => { const u = lerp(0, ua, a); return [H.X(u), H.sheer(u), (2 * b - 1) * H.B(u)]; }, 4, 4, mid));
  K.add('vinyl', rbox(.98, .12, 1.56, .055), -2.73, H.sheer(.08) + .055, 0);
  // cockpit: walls, floor, bulkheads
  for (const s of [1, -1]) K.add('gel', sheet((a, b) => { const u = lerp(ua, uc, a); return [H.X(u), lerp(floor, H.sheer(u), b), s * Bi(u)]; }, 12, 2, far(s)));
  K.add('teak', sheet((a, b) => { const u = lerp(ua, uc, a); return [H.X(u), floor, (2 * b - 1) * Bi(u)]; }, 6, 2, [0, -5, 0]));
  K.add('gel', sheet((a, b) => [H.X(ua), lerp(floor, H.sheer(ua), b), (2 * a - 1) * Bi(ua)], 2, 2, [-9, 0, 0]));
  K.add('gel', sheet((a, b) => [H.X(uc), lerp(floor, H.sheer(uc), b), (2 * a - 1) * Bi(uc)], 2, 2, [9, 0, 0]));
  // dash, wheel and throttle
  const xd = H.X(uc), yd = H.sheer(uc);
  K.add('trim', rbox(.5, .3, 1.66, .08), xd - .2, yd - .1, 0);
  K.add('trim', torus(.17, .022), xd - .5, yd + .0, S.seat.z, 1, 1, 1, 0, PI / 2 + .0, 0); K.add('chrome', G.cyl, xd - .44, yd - .0, S.seat.z, .02, .14, .02, 0, 0, PI / 2);
  K.add('chrome', G.cyl, xd - .38, yd + .1, .02, .012, .16, .012, 0, 0, -.5); K.add('trim', G.sph, xd - .42, yd + .17, .02, .03, .03, .03);
  // the screen: curved glass leaning back, with a chrome frame along the top
  const W = .93, D = .58, xc = xd - .22, TH = 1.92, sc = (a, b) => { const th = lerp(-TH, TH, a), h = lerp(.5, .3, (th / TH) ** 2); return [xc + D * Math.cos(th) - .4 * b * (h / .5), yd + .03 + h * b, W * Math.sin(th) * (1 - .07 * b)]; };
  K.add('clear', sheet(sc, 28, 3, mid, true));
  const top = []; for (let i = 0; i <= 28; i++) top.push(sc(i / 28, 1)); K.add('chrome', tube([sc(0, 0), ...top, sc(1, 0)], .017, 6, 2));
  const base = []; for (let i = 0; i <= 28; i++) base.push(sc(i / 28, 0)); K.add('trim', tube(base, .02, 6, 2));
  // seats: two buckets and a bench
  for (const z of [S.seat.z, -S.seat.z]) {
    K.add('vinyl', rbox(.52, .16, .5, .06), -.36, .34, z); K.add('vinyl', rbox(.15, .62, .5, .06), -.68, .66, z, 1, 1, 1, 0, 0, -.14);
    K.add('paint', rbox(.03, .4, .3, .012), -.775, .7, z, 1, 1, 1, 0, 0, -.14); K.add('chrome', G.cyl, -.38, .14, z, .05, .26, .05);
  }
  K.add('vinyl', rbox(.46, .18, 1.6, .06), -1.78, .33, 0); K.add('vinyl', rbox(.15, .4, 1.6, .06), -2.02, .5, 0, 1, 1, 1, 0, 0, -.1);
  // bow rail, cleats, lamps
  const rail = []; for (let i = 0; i <= 14; i++) { const u = lerp(.6, .985, i / 14), lift = .27 * Math.min(1, i / 2.5); rail.push([H.X(u), H.sheer(u) + .03 + lift, Math.max(0, H.B(u) - .1)]); }
  K.add('chrome', tube([...rail, ...rail.slice(0, -1).reverse().map(p => [p[0], p[1], -p[2]])], .016, 6, 3));
  for (const i of [5, 9, 12]) K.both('chrome', G.cyl, rail[i][0], rail[i][1] - .135, rail[i][2], .012, .27, .012);
  for (const u of [.05, .58, .9]) K.both('chrome', rbox(.2, .035, .045, .015), H.X(u), H.sheer(u) + .035, H.B(u) - .09);
  K.add('light_port', G.sph, H.X(.93), H.sheer(.93) + .06, -H.B(.93) + .03, .05, .03, .03); K.add('light_star', G.sph, H.X(.93), H.sheer(.93) + .06, H.B(.93) - .03, .05, .03, .03);
  K.add('chrome', G.cyl, -3.05, H.sheer(0) + .34, -.8, .012, .68, .012); K.add('light_beacon', G.sph, -3.05, H.sheer(0) + .7, -.8, .035, .035, .035);
  // name on the quarters
  const tag = (s) => (a, b) => { const u = lerp(s > 0 ? .07 : .33, s > 0 ? .33 : .07, a), p = H.side(u, lerp(.42, .8, b)); return [p[0], p[1], s * (p[2] + .012)]; };
  K.add('decal:MARLIN:#ffffff', sheet(tag(1), 10, 2, mid)); K.add('decal:MARLIN:#ffffff', sheet(tag(-1), 10, 2, mid));
  return { S, H, main: K.all() };
}

function jetskiParts() {
  const S = BOATS.jetski, K = kit(), H = hullOf(S.hull), mid = [0, .1, 0];
  addHull(K, H, { bottom: 'trim', boot: 'trim', sides: 'paint2', rail: 'rubber', bootTop: .3, n: 30 });
  K.add('paint2', sheet((a, b) => { const zn = 2 * b - 1; return [H.X(a), H.sheer(a) + .04 * (1 - zn * zn), zn * H.B(a)]; }, 22, 8, mid));
  for (const s of [1, -1]) K.add('rubber', sheet((a, b) => [lerp(-1.25, .3, a), H.sheer(.3) + .034, s * lerp(.25, .47, b)], 2, 1, [0, -5, 0]));
  // the saddle and nose in one piece
  const f = body([[1.62, .37, .03, .03, .03, 2], [1.36, .43, .26, .1, .08, 2.6], [.95, .52, .42, .24, .2, 2.6], [.52, .62, .4, .42, .3, 2.5], [.2, .56, .3, .34, .26, 2.5], [-.3, .5, .24, .3, .2, 2.7], [-1.0, .5, .25, .3, .2, 2.7], [-1.38, .44, .2, .18, .16, 2.4], [-1.5, .4, .04, .05, .05, 2]]);
  K.add('paint', loft(f, { seg: 24, step: .1 }));
  K.add('seat', patch(f, (u, v) => { const [p, q] = round(u, v, .4); return [lerp(-1.38, .2, p), lerp(.42, PI - .42, q)]; }, 16, 10, .012));
  K.add('glass', patch(f, (u, v) => { const [p, q] = round(u, v, .6); return [lerp(.56, 1.0, p), lerp(.75, PI - .75, q)]; }, 8, 8, .012));
  K.both('paint2', patch(f, (u, v) => [lerp(-1.3, 1.3, u), lerp(-.28, .16, v) + .12 * Math.sin(u * PI)], 20, 2, .008));
  // bars, grips, a grab handle, the jet
  K.add('trim', rbox(.26, .16, .26, .06), .42, .98, 0); K.add('trim', G.cyl, .4, 1.07, 0, .017, .74, .017, PI / 2); K.both('rubber', G.cyl, .4, 1.07, .33, .024, .13, .024, PI / 2);
  K.add('trim', tube([[-1.3, .58, -.2], [-1.48, .66, -.16], [-1.5, .68, 0], [-1.48, .66, .16], [-1.3, .58, .2]], .018, 6, 4));
  K.add('metal', G.cyl, -1.5, .06, 0, .1, .16, .1, 0, 0, PI / 2);
  const main = K.all(); for (const g of Object.values(main)) g.scale(S.scale, S.scale, S.scale);                         // drawn small, built a size up to fit the cast
  return { S, H, main };
}

function policeboatParts() {
  const S = BOATS.policeboat, K = kit(), H = hullOf(S.hull), mid = [0, .2, 0], o = [];
  addHull(K, H, { bottom: 'trim', boot: 'trim', sides: 'paint2', rail: null, bootTop: .2 });
  // the collar: one fat tube round the gunwale, with wear strips and POLICE on both sides
  const R = .27, cz = (u) => H.B(u) + .1, cy = (u) => H.sheer(u) + .05, path = [];
  for (let i = 0; i <= 22; i++) { const u = Math.min(.992, .01 + i / 22); path.push([H.X(u), cy(u), cz(u)]); }
  const loop = [...path, ...path.slice(0, -1).reverse().map(p => [p[0], p[1], -p[2]])];
  K.add('paint', tube(loop, R, 14, 3)); K.both('paint', G.sph, path[0][0], path[0][1], path[0][2], R * .7, R, R);
  for (const u of [.2, .52, .78]) K.both('rubber', G.cyl, H.X(u), cy(u), cz(u), R + .008, .16, R + .008, 0, -Math.atan2(cz(u + .01) - cz(u - .01), H.X(u + .01) - H.X(u - .01)), PI / 2);
  const tag = (s) => (a, b) => { const u = lerp(s > 0 ? .27 : .49, s > 0 ? .49 : .27, a), ph = lerp(-.5, .62, b); return [H.X(u), cy(u) + (R + .006) * Math.sin(ph), s * (cz(u) + (R + .006) * Math.cos(ph))]; };
  K.add('decal:POLICE:#f4f4f4', sheet(tag(1), 12, 5, mid)); K.add('decal:POLICE:#f4f4f4', sheet(tag(-1), 12, 5, mid));
  // deck and the inside of the hull
  const fy = .2;
  K.add('deck', sheet((a, b) => { const u = lerp(.005, .94, a); return [H.X(u), fy, (2 * b - 1) * (H.B(u) + .02)]; }, 16, 2, [0, -5, 0]));
  for (const s of [1, -1]) K.add('deck', sheet((a, b) => { const u = lerp(.005, .94, a); return [H.X(u), lerp(fy, cy(u), b), s * (H.B(u) + .02)]; }, 16, 1, [0, .3, s * 9]));
  K.add('deck', sheet((a, b) => [H.X(.005), lerp(fy, H.sheer(0) + .1, b), (2 * a - 1) * H.B(0)], 2, 1, [-9, 0, 0]));
  K.add('paint2', rbox(.5, .2, 1.5, .05), -3.2, fy + .1, 0);                                                               // engine well
  // centre console: screen, wheel, a leaning post
  K.add('paint2', rbox(.8, 1.0, .86, .09), .38, fy + .5, 0); K.add('trim', rbox(.5, .05, .8, .02), .3, fy + 1.02, 0, 1, 1, 1, 0, 0, .12);
  K.add('clear', sheet((a, b) => [.72 - .2 * b, fy + 1.0 + .42 * b, (2 * a - 1) * .42 * (1 - .1 * b)], 4, 2, mid, true));
  K.add('chrome', tube([[.72, fy + 1.0, -.42], [.52, fy + 1.42, -.378], [.52, fy + 1.42, .378], [.72, fy + 1.0, .42]], .014, 6, 2));
  K.add('trim', torus(.17, .022), -.06, fy + .98, 0, 1, 1, 1, 0, PI / 2, 0); K.add('chrome', G.cyl, -.02, fy + .98, 0, .02, .1, .02, 0, 0, PI / 2);
  K.add('seatDark', rbox(.36, .14, .86, .06), -1.0, fy + .98, 0); K.both('chrome', tube([[-.9, fy, .34], [-.98, fy + .5, .34], [-1.0, fy + .92, .34]], .022, 6, 3));
  // hard top on four legs: light bar, radar, aerials, searchlight
  const ty = 2.34;
  K.both('chrome', tube([[.74, fy, .5], [.7, 1.4, .56], [.5, ty - .04, .6]], .026, 6, 4)); K.both('chrome', tube([[-1.1, fy, .5], [-1.06, 1.4, .56], [-.86, ty - .04, .6]], .026, 6, 4));
  K.add('paint2', rbox(2.2, .08, 1.6, .035), -.18, ty, 0);
  K.add('trim', rbox(.24, .06, 1.14, .02), .3, ty + .07, 0); K.add('light_red', rbox(.22, .12, .5, .04), .3, ty + .14, .29); K.add('light_blue', rbox(.22, .12, .5, .04), .3, ty + .14, -.29);
  K.add('paint2', G.cyl, -.75, ty + .13, 0, .24, .16, .24); K.add('trim', G.cyl, -.75, ty + .05, 0, .08, .06, .08);
  K.both('trim', G.cyl, -1.18, ty + .5, .66, .008, .95, .008, 0, 0, .12);
  K.add('trim', G.cyl, .82, ty + .1, 0, .03, .1, .03); K.add('trim', G.sph, .86, ty + .22, 0, .13, .11, .11); K.add('head', G.sph, .93, ty + .22, 0, .08, .09, .09);
  // bow post, lamps
  K.add('chrome', G.cyl, 3.1, cy(.9) + .22, 0, .02, .3, .02); K.add('light_stern', G.sph, 3.1, cy(.9) + .39, 0, .04, .04, .04);
  K.add('light_port', G.sph, 2.6, cy(.86) + R * .9, -cz(.86) + .1, .05, .03, .03); K.add('light_star', G.sph, 2.6, cy(.86) + R * .9, cz(.86) - .1, .05, .03, .03);
  K.add('light_beacon', G.sph, -1.2, ty + .08, 0, .04, .04, .04);
  void o;
  return { S, H, main: K.all() };
}

// ============================================================ putting one together ============================================================
const built = {};
const partsOf = (type) => built[type] || (built[type] = HELIS[type] ? heliParts(type) : type === 'speedboat' ? speedboatParts() : type === 'jetski' ? jetskiParts() : policeboatParts());
export const isCraft = (type) => !!(HELIS[type] || BOATS[type]);
export const craftPalette = (type) => (HELIS[type] || BOATS[type]).colors;

function dress(parent, geos, material, noShadow = []) {
  const made = {};
  for (const key of Object.keys(geos)) {
    const m = new THREE.Mesh(geos[key], material(key)); m.name = key.startsWith('decal') ? 'decal' : key;
    m.castShadow = !noShadow.includes(key) && !key.startsWith('decal') && !key.startsWith('light') && key !== 'clear'; m.receiveShadow = true; parent.add(m); made[key] = m;
  }
  return made;
}

export function makeCraftModel(type, col) {
  const T = partsOf(type), S = T.S, heli = !!HELIS[type];
  col ??= choose(S.colors);
  const g = new THREE.Group(), chassis = new THREE.Group(); g.add(chassis);
  const second = S.army ? null : heli ? (S.second[col] ?? 0xf4f1ea) : 0xf4f1ea;
  const tail = lamp(heli ? 0xff2020 : 0xffffff, 2);                       // the beacon (helicopters) or the stern light (boats): this craft's own
  const red = S.police || type === 'policeboat' ? std({ color: 0x220000, emissive: 0xff2030, emissiveIntensity: 0 }) : null, blue = red ? std({ color: 0x000022, emissive: 0x2050ff, emissiveIntensity: 0 }) : null;
  const material = (key) => {
    switch (key) {
      case 'paint': return S.army ? armyPaint : type === 'policeboat' ? collar(col) : paint(col);
      case 'paint2': return S.army ? armyPaint2 : paint(second);
      case 'stripe': return paint(S.police ? 0xf2a93b : col === 0x23272e ? 0xf4f1ea : 0x23272e);
      case 'bottom': return paint(0xf4f1ea);
      case 'cowl': return paint(0x16181d);
      case 'glass': return mats.carGlass; case 'clear': return clearGlass;
      case 'trim': return dark; case 'rubber': return rubber; case 'metal': case 'leg': return mats.darkMetal; case 'chrome': return mats.rim;
      case 'blade': return blade; case 'tip': return S?.army ? blade : mats.yellowPaint;
      case 'vinyl': return vinyl; case 'seat': case 'seatDark': return seatDark; case 'teak': return teak; case 'gel': return gel; case 'deck': return deckGrey;
      case 'head': return mats.head;
      case 'light_port': return navRed; case 'light_star': return navGreen; case 'light_stern': return navWhite;
      case 'light_beacon': return tail; case 'light_red': return red; case 'light_blue': return blue;
      default: return key.startsWith('decal') ? decal(key) : dark;
    }
  };
  const made = dress(chassis, T.main, material);
  const u = g.userData = {
    type, color: col, chassis, wheels: [], rear: [], bar: red ? [made.light_red, made.light_blue] : null, tail, seat: S.seat ? { ...S.seat } : null,
    wheelKind: 'none', wheelR: .4, model: true, craft: heli ? 'heli' : 'boat', noDent: [],
  };
  if (heli) {
    const [mx, , my] = S.mast, tr = S.tailRotor;
    const rotor = new THREE.Group(); rotor.position.set(mx, my, 0); chassis.add(rotor);
    u.blades = new THREE.Group(); rotor.add(u.blades); dress(u.blades, T.rotor, material);
    u.disc = new THREE.Mesh(new THREE.CircleGeometry(S.rotor.R, 48), discMat()); u.disc.rotation.x = -PI / 2; u.disc.position.y = .03; u.disc.visible = false; rotor.add(u.disc);
    const tailRotor = new THREE.Group(); tailRotor.position.set(tr.x, tr.y, tr.z); chassis.add(tailRotor);
    u.tailBlades = new THREE.Group(); tailRotor.add(u.tailBlades); dress(u.tailBlades, T.tail, material);
    u.tailDisc = new THREE.Mesh(new THREE.CircleGeometry(tr.R, 24), discMat()); u.tailDisc.visible = false; tailRotor.add(u.tailDisc);
    Object.assign(u, { rotor, tailRotor, rotorR: S.rotor.R, rotorY: my, noDent: [rotor, tailRotor], beacon: tail, tailAt: tr.x });
  } else {
    u.engines = S.engines.map(([x, y, z]) => { const e = new THREE.Group(); e.position.set(x, y, z); chassis.add(e); dress(e, outboard(), material); return e; });
    u.stern = S.hull.x0 * (S.scale || 1); u.bow = S.hull.x1 * (S.scale || 1);
  }
  return g;
}
