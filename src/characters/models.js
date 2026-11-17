// The cast: Critters (raccoon, possum, pigeon cop), Tin Bots (Scrap, Tess, Unit 5-0) and Big Heads
// (bigheads.js), all built on one shared rig (rig.js) so they animate the same way. Shapes come from the cast concepts.
import * as THREE from 'three';
import { V, choose } from '../core/utils.js';
import { std, G, rbox } from '../world/materials.js';
import { rig, googlyEyes, mat, glow, eyeW, eyeB, gold, cone, M, cache } from './rig.js';
import { bigHead } from './bigheads.js';
import { plainGeometry } from '../world/batching.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const OUTFITS = [0xe8455b, 0x3e6fd6, 0xf2a93b, 0x2f8f83, 0x9b5de5, 0xff7aa2, 0xf4f1ea, 0x2b2f35];
const PANTS = [0x2b3443, 0x4a3b2e, 0x33415c, 0x5a5f66];

function critter(kind, opt = {}) {
  const cop = kind === 'pigeon';
  const fur = mat({ raccoon: 0x8b8d94, pigeon: 0x7d879c, possum: 0xe9e4da }[kind], .75);
  const outfit = opt.outfit ?? choose(OUTFITS);
  const r = rig({
    shirt: mat(cop ? 0x2a3f7a : outfit, .9), pants: mat(cop ? 0x1c2a55 : choose(PANTS), .9),
    shoes: mat(cop ? 0xf2963a : choose([0xf4f4f4, 0xe8455b, 0x1d1f24]), .9), skin: fur, armMat: cop ? fur : null
  });
  const u = r.userData, h = u.head;
  M(G.sph, fur, null, V(.36, .33, .34), h);
  if (kind === 'raccoon') {
    M(G.sph, mat(0x2a2a30, .75), V(0, .05, .02), V(.355, .12, .33), h); M(G.sph, mat(0xdedad2, .75), V(0, -.1, .27), V(.15, .11, .13), h);
    M(G.sph, eyeB, V(0, -.06, .4), V(.05, .04, .04), h);
    for (const s of [-1, 1]) M(cone(.1, .2), mat(0x55565e, .75), V(s * .22, .3, -.02), null, h, [0, 0, -s * .35]);
    const tail = new THREE.Group(); tail.position.set(0, .85, -.28); u.body.add(tail);
    for (let i = 0; i < 6; i++) M(G.sph, mat(i % 2 ? 0x2a2a30 : 0x9a9ca3, .75), V(0, i * .06, -i * .11), .14 - i * .012, tail);
    u.tail = tail;
    if (opt.hood ?? Math.random() < .4) M(G.sph, mat(outfit, .9), V(0, .24, -.03), V(.37, .2, .35), h);
  }
  if (kind === 'pigeon') {
    M(cone(.08, .26), mat(0xf2963a, .5), V(0, -.04, .42), null, h, [Math.PI / 2, 0, 0]);
    M(new THREE.TorusGeometry(.26, .07, 10, 24), mat(0x5e9a7c, .3, .4), V(0, -.24, 0), null, h, [Math.PI / 2, 0, 0]);
    M(G.cyl, mat(0x1c2a55, .9), V(0, .3, 0), V(.3, .16, .3), h); M(G.cyl, mat(0x1c2a55, .9), V(0, .39, .02), V(.36, .04, .38), h);
    M(rbox(.3, .04, .18, .02), eyeB, V(0, .24, .3), null, h);
    M(G.sph, gold, V(.14, 1.2, .27), V(.05, .06, .02), u.body);
  }
  if (kind === 'possum') {
    M(cone(.13, .34, 16), mat(0xf4efe8, .75), V(0, -.07, .38), null, h, [Math.PI / 2, 0, 0]); M(G.sph, mat(0xff8fb1, .4), V(0, -.07, .56), V(.05, .045, .045), h);
    for (const s of [-1, 1]) M(G.sph, mat(0x3a3236, .75), V(s * .25, .25, -.02), V(.11, .11, .04), h);
    M(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0, 0, 0), V(0, -.1, -.35), V(0, .05, -.7), V(0, .25, -.8)]), 12, .04, 6), mat(0xf4b6c6, .75), V(0, .8, -.2), null, u.body);
  }
  u.pupils = googlyEyes(h);
  return r;
}

const BOT_METALS = [[0xb07a4a, 0xc28a55], [0x6f8f9a, 0x8fb0bb], [0x9a6fb0, 0xb48fca], [0x8a9a5a, 0xa9b96f], [0xb05a4a, 0xcf7a66], [0x7a8088, 0xa6adb5]];
function scrap() {   // rusty little bot with a screen face and one antenna
  const [bodyC, headC] = choose(BOT_METALS);
  const r = rig({ shirt: mat(bodyC, .45, .8), pants: mat(0x6b5a48, .5, .7), shoes: mat(0x3a3d42, .5, .6), skin: mat(0x8a8f96, .35, .9), headY: 1.82 });
  const h = r.userData.head, e = glow(choose([0x5dff8a, 0x5ac8ff, 0xffd34d, 0xff8fb1]), 6);
  M(rbox(.62, .5, .5, .08), mat(headC, .4, .85), null, null, h); M(rbox(.46, .32, .06, .04), mat(0x081410, .2), V(0, 0, .24), null, h);
  for (const k of [-1, 1]) M(G.sph, e, V(k * .1, .03, .28), V(.05, .07, .02), h); M(rbox(.18, .03, .02, .01), e, V(0, -.08, .28), null, h);
  M(G.cyl, mat(0x8a8f96, .3, 1), V(.18, .38, 0), V(.02, .3, .02), h); M(G.sph, glow(0xff4040, 2.5), V(.18, .55, 0), .06, h);
  r.userData.bot = true; return r;
}
let fareTex = null;
function tess() {    // taxi bot, her face is a fare meter
  const r = rig({ shirt: mat(0xf6c21c, .35, .6), pants: mat(0x23272e, .5, .5), shoes: mat(0x15161a), skin: mat(0x9aa0a8, .3, 1), headY: 1.84 });
  const h = r.userData.head; M(G.sph, mat(0xf6c21c, .3, .6), null, V(.38, .36, .36), h);
  if (!fareTex) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
    x.fillStyle = '#08140c'; x.fillRect(0, 0, 256, 128); x.fillStyle = '#7dff8a'; x.font = 'bold 54px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('$4.20', 128, 64);
    fareTex = new THREE.CanvasTexture(c); fareTex.colorSpace = THREE.SRGBColorSpace;
  }
  M(rbox(.42, .22, .05, .03), cache.fare || (cache.fare = std({ map: fareTex, emissive: 0xffffff, emissiveMap: fareTex, emissiveIntensity: 1.6 })), V(0, .04, .34), null, h);
  for (const k of [-1, 1]) M(G.sph, mat(0x9aa0a8, .3, 1), V(k * .38, 0, 0), V(.06, .12, .12), h);
  M(rbox(.3, .12, .16, .03), cache.taxiLamp || (cache.taxiLamp = std({ color: 0x222222, emissive: 0xffd34d, emissiveIntensity: 1.2 })), V(0, .42, 0), null, h);
  r.userData.bot = true; return r;
}
function unit50() {  // police bot with a siren for a head
  const r = rig({ shirt: mat(0x2a3f7a, .35, .7), pants: mat(0x1c2a55, .4, .7), shoes: mat(0x15161a, .4, .6), skin: mat(0xcfd3d8, .25, 1), headY: 1.82 });
  const h = r.userData.head;
  M(rbox(.56, .46, .5, .1), mat(0xe8ebef, .25, .9), null, null, h); M(rbox(.44, .26, .06, .04), mat(0x080a14, .2), V(0, 0, .24), null, h);
  const e = cache.copEye || (cache.copEye = glow(0x5ac8ff, 6)); for (const k of [-1, 1]) M(rbox(.12, .05, .02, .02), e, V(k * .1, .02, .28), null, h);
  const red = std({ color: 0x220000, emissive: 0xff2030, emissiveIntensity: .1 }), blue = std({ color: 0x000022, emissive: 0x2050ff, emissiveIntensity: .1 });
  M(G.cyl, mat(0x222222, .4, .5), V(0, .26, 0), V(.2, .06, .2), h); M(G.sph, red, V(-.08, .36, 0), .1, h); M(G.sph, blue, V(.08, .36, 0), .1, h);
  M(G.sph, gold, V(.14, 1.2, .27), V(.05, .06, .02), r.userData.body);
  r.userData.siren = [red, blue]; r.userData.bot = true; return r;
}

// A character is ~30 little shapes. Weld each limb into one or two meshes so a street full
// of citizens stays cheap to draw. Plain cloth/fur and plain metal share two vertex-coloured materials.
const matteShared = std({ vertexColors: true, roughness: .82 }), metalShared = std({ vertexColors: true, roughness: .4, metalness: .85 });
function weld(group) {
  const buckets = new Map();
  for (const m of group.children.slice()) {
    if (!m.isMesh || m.userData.live) continue;
    const mt = m.material, plain = !mt.map && mt.emissive.getHex() === 0;
    const target = plain && mt.metalness >= .5 ? metalShared : plain && mt.metalness === 0 && mt.roughness >= .4 ? matteShared : mt;
    m.updateMatrix(); const g = plainGeometry(m.geometry, m.matrix);
    if (target !== mt) {
      const n = g.attributes.position.count, col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { col[i * 3] = mt.color.r; col[i * 3 + 1] = mt.color.g; col[i * 3 + 2] = mt.color.b; }
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    }
    if (!buckets.has(target)) buckets.set(target, []); buckets.get(target).push(g); group.remove(m);
  }
  for (const [mt, list] of buckets) { const m = new THREE.Mesh(mergeGeometries(list), mt); m.castShadow = m.receiveShadow = true; group.add(m); list.forEach(g => g.dispose()); }
  for (const c of group.children) if (c.isGroup) weld(c);
}
// Far-away characters don't need shadows.
export function setCharacterShadow(c, on) {
  if (c.userData.shadow === on) return; c.userData.shadow = on;
  c.traverse(o => { if (o.isMesh) o.castShadow = on; });
}

// Who walks the streets and who polices them (repeats make a kind more common). 'bighead' and 'bigcop' are rolled fresh every time.
export const CIVILIANS = ['raccoon', 'raccoon', 'possum', 'possum', 'scrap', 'scrap', 'scrap', 'bighead', 'bighead', 'bighead', 'bighead', 'bighead'];
export const COPS = ['pigeon', 'unit50', 'bigcop'];
export const BIG_HEADS = ['bighead', 'bigcop', 'sal', 'dale', 'tiff'];
// Who you can play as (the title and pause menus). Rocco is the default.
export const PLAYABLE = [['rocco', 'Rocco'], ['sal', 'Big Sal'], ['tiff', 'Tiff'], ['bighead', 'Random Big Head']];

export function makeCharacter(kind, opt) {
  let c;
  if (BIG_HEADS.includes(kind)) c = bigHead(kind, opt);
  else if (kind === 'rocco') c = critter('raccoon', { outfit: 0xe8455b, hood: true });
  else if (kind === 'scrap') c = scrap();
  else if (kind === 'tess') c = tess();
  else if (kind === 'unit50') c = unit50();
  else c = critter(kind);
  c.userData.kind = kind; c.userData.shadow = true;
  weld(c);
  return c;
}

// pose: 'move' (walk/run by speed), 'stand', 'flail' (panic run), 'down' (knocked over)
export function animateCharacter(c, t, dt, speed, pose = 'move', alert = false) {
  const u = c.userData;
  const moving = pose !== 'stand' && pose !== 'down' && speed > .3;
  if (moving) u.phase += dt * (3.2 + speed * 1.55);
  const ph = u.phase, stiff = u.bot ? .75 : 1;
  const amp = moving ? Math.min(1.05, .42 + speed * .085) * stiff : 0;
  const lieT = pose === 'down' ? 1 : 0; u.lie += (lieT - u.lie) * Math.min(1, dt * (lieT ? 14 : 5));
  u.legs[0].rotation.x = Math.sin(ph) * amp; u.legs[1].rotation.x = -Math.sin(ph) * amp;
  if (pose === 'flail') { u.arms[0].rotation.x = -2.7 + Math.sin(t * 17) * .4; u.arms[1].rotation.x = -2.7 + Math.cos(t * 15) * .4; }
  else if (pose === 'down') { u.arms[0].rotation.x = -2.2; u.arms[1].rotation.x = -1.2; u.legs[0].rotation.x = .5; u.legs[1].rotation.x = -.3; }
  else { u.arms[0].rotation.x = -Math.sin(ph) * amp * .8; u.arms[1].rotation.x = Math.sin(ph) * amp * .8; }
  // knocked flat on their back, or upright with a little bounce
  u.body.rotation.x = -u.lie * Math.PI / 2;
  u.body.position.y = u.lie * .28 + (1 - u.lie) * (moving ? Math.abs(Math.sin(ph)) * .07 * stiff : Math.sin(t * 2 + u.phase) * .015);
  u.body.position.z = u.lie * .9;
  u.body.rotation.z = moving && speed > 5 ? Math.sin(ph) * .05 : 0;
  u.head.rotation.z = Math.sin(ph * .5) * .06;
  if (u.big) {                       // arms go round the giant head rather than through it
    const out = pose === 'flail' ? .85 : .12; u.arms[0].rotation.z = -out; u.arms[1].rotation.z = out;
    bobble(u, dt, pose, moving, 3.2 + speed * 1.55, ph, amp);
  }
  for (let i = 0; i < u.pupils.length; i++) {
    const p = u.pupils[i], d = p.userData; p.position.x = d.bx + Math.sin(t * 7 + i + u.phase) * .025 * d.amp; p.position.y = d.by + Math.cos(t * 5 + i) * .02 * d.amp;
  }
  if (u.tail) u.tail.rotation.y = Math.sin(t * 3 + u.phase) * .35;
  if (u.siren) { const on = alert ? Math.floor(t * 6) % 2 : -1; u.siren[0].emissiveIntensity = on === 1 ? 6 : .1; u.siren[1].emissiveIntensity = on === 0 ? 6 : .1; }
}

// Big Heads are bobbleheads: the head sits on a soft spring. Every stride nudges it, and being
// knocked over, punched or scared gives it a proper shove, so it nods and rolls a moment after the body.
const BOB = { stiff: 95, damp: 5.5, sway: .17, kick: 5.5, max: .5 };      // sway: how far (radians) a full stride rocks the head
function bobble(u, dt, pose, moving, rate, ph, amp) {
  const b = u.big, h = Math.min(dt, 1 / 30);
  if (pose !== b.pose) {
    if (pose === 'down') { b.vx -= BOB.kick; b.vz += (u.phase % 2 - 1) * BOB.kick; }
    else if (pose === 'flail' || b.pose === 'down') { b.vx += BOB.kick * .55; b.vz -= (u.phase % 2 - 1) * BOB.kick * .5; }
    b.pose = pose;
  }
  // the stride pushes just hard enough for the spring to swing `sway` at this step rate, so a sprint rocks it more than a stroll
  const push = moving ? amp * BOB.sway * Math.hypot(BOB.stiff - rate * rate, rate * BOB.damp) : 0;
  b.vx += (-BOB.stiff * b.rx + Math.cos(ph) * push * .6) * h; b.vz += (-BOB.stiff * b.rz + Math.sin(ph) * push) * h;
  const k = Math.max(0, 1 - BOB.damp * h); b.vx *= k; b.vz *= k;
  b.rx = Math.max(-BOB.max, Math.min(BOB.max, b.rx + b.vx * h)); b.rz = Math.max(-BOB.max, Math.min(BOB.max, b.rz + b.vz * h));
  u.head.rotation.x = b.rx; u.head.rotation.z = b.rz;
  u.head.position.z = u.lie * b.rest;              // lying on their back: the big head rests on the ground, not in it
}
// Give a Big Head's head a shove from outside (a punch, a bullet, a car): dx, dz in the character's own frame are not needed, any direction reads fine.
export function bonkHead(c, power = 1) { const b = c.userData.big; if (b) { b.vx += (Math.random() - .5) * 9 * power; b.vz += (Math.random() < .5 ? -1 : 1) * 6 * power; } }
