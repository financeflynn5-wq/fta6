// Big Heads: goofy humans with giant heads, small bodies and loud outfits. They stand on the
// same rig as the Critters and Tin Bots, so they walk, panic, fight and ride like everyone else.
// A look (see bigheadLooks.js) picks the parts: head shape, hair, hat, eyes, face and clothes.
import * as THREE from 'three';
import { V, seeded } from '../core/utils.js';
import { std, G, rbox, cap, ctex } from '../world/materials.js';
import { rig, googlyEyes, mat, eyeW, eyeB, gold, cone, M, cache } from './rig.js';
import { LOOKS, randomLook } from './bigheadLooks.js';

const UP = new THREE.Vector3(0, 1, 0), HALF = Math.PI / 2;
const keep = (k, make) => cache[k] || (cache[k] = make());
const torus = (R, r, arc = Math.PI * 2) => keep(`tor${R},${r},${arc}`, () => new THREE.TorusGeometry(R, r, 8, 28, arc));
const frustum = (a, b, h) => keep(`fr${a},${b},${h}`, () => new THREE.CylinderGeometry(a, b, h, 20));
const blend = (a, b, k) => new THREE.Color(a).lerp(new THREE.Color(b), k).getHex();
const sm = new THREE.SphereGeometry(1, 16, 10);            // small parts (ears, noses, curls) don't need the full-detail ball
const dark = mat(0x16161a, .5), white = mat(0xf7f4ee, .8), mouthIn = mat(0x4a1a20, .6);

// ---------- printed shirts ----------
const HAWAII = [['#2bb3c0', '#ff4d6d', '#ffd34d', '#fff4e6'], ['#ff7a59', '#ffffff', '#1f8f83', '#ffd34d'], ['#3b4fd6', '#ff8fc4', '#ffd34d', '#ffffff'],
  ['#f2c230', '#e8455b', '#2f8f52', '#ffffff'], ['#1f2a44', '#ff7aa2', '#3de0c0', '#fff4e6']];
const STRIPES = [['#1c2a55', '#f4f1ea'], ['#e8455b', '#f4f1ea'], ['#16161a', '#ffd34d'], ['#2f8f83', '#fff4e6']];
function printed(kind, i) {
  return keep(`print/${kind}/${i}`, () => {
    const R = seeded(977 + i * 131 + kind.length * 17);
    const t = ctex(256, (x, s) => {
      if (kind === 'hawaii') {
        const [bg, ...fl] = HAWAII[i]; x.fillStyle = bg; x.fillRect(0, 0, s, s);
        for (let n = 0; n < 22; n++) {
          const px = R() * s, py = R() * s, a0 = R() * 6; x.fillStyle = fl[n % 3];
          for (const [ox, oy] of [[0, 0], [s, 0], [-s, 0], [0, s], [0, -s]]) {        // drawn across the edges too, so the print has no seam
            for (let k = 0; k < 5; k++) { x.beginPath(); x.ellipse(px + ox + Math.cos(a0 + k * 1.256) * 10, py + oy + Math.sin(a0 + k * 1.256) * 10, 9, 5, a0 + k * 1.256, 0, 7); x.fill(); }
          }
          x.fillStyle = bg; for (const [ox, oy] of [[0, 0], [s, 0], [-s, 0], [0, s], [0, -s]]) { x.beginPath(); x.arc(px + ox, py + oy, 3.2, 0, 7); x.fill(); }
        }
      } else if (kind === 'stripes') {
        const [a, b] = STRIPES[i]; for (let n = 0; n < 8; n++) { x.fillStyle = n % 2 ? b : a; x.fillRect(0, n * s / 8, s, s / 8); }
      } else {                                                                         // leopard
        x.fillStyle = '#e0a955'; x.fillRect(0, 0, s, s);
        for (let n = 0; n < 46; n++) {
          const px = R() * s, py = R() * s, r = 7 + R() * 7;
          x.fillStyle = '#b5762c'; x.beginPath(); x.ellipse(px, py, r * .6, r * .5, R() * 3, 0, 7); x.fill();
          x.strokeStyle = '#2a1a12'; x.lineWidth = 4; x.beginPath(); x.ellipse(px, py, r, r * .8, R() * 3, R() * 2, R() * 2 + 4.2); x.stroke();
        }
      }
    });
    t.repeat.set(kind === 'stripes' ? 1 : 4, 2);
    return std({ map: t, roughness: .85 });
  });
}

// A capsule dressed in a print. The stock capsule squeezes its texture onto the rounded ends and smears it down the
// middle, so the pattern is laid on by height instead, and scaled so sleeves and torso carry flowers of the same size.
const printCap = (r, l) => keep(`pcap${r},${l}`, () => {
  const g = cap(r, l).clone(), p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, uv.getX(i) * r / .3, p.getY(i) / .94);
  return g;
});

// ---------- the head ----------
function buildHead(h, L, body) {
  const [hw, hh, hd] = L.shape, sk = mat(L.skin, .6), hair = mat(L.hairC ?? 0x2a1a12, .9);
  // a point on the face (front of the head) at x across and y up, pushed out or in by `out`
  const F = (x, y, out = 0) => V(x, y, hd * Math.sqrt(Math.max(.04, 1 - (x / hw) ** 2 - (y / hh) ** 2)) + out);
  // something stuck on the scalp, pointing straight out of it: a = how far round from the front (over the top), b = how far to the side
  const scalp = (geo, m, a, b, lift, s) => {
    const d = V(Math.sin(b), Math.sin(a) * Math.cos(b), Math.cos(a) * Math.cos(b));
    const o = M(geo, m, V(d.x * (hw + lift), d.y * (hh + lift), d.z * (hd + lift)), s, h); o.quaternion.setFromUnitVectors(UP, d); return o;
  };
  // the arms of a pair of glasses: from the outer edge of each lens (x0, y, z0) back to the ear
  const temples = (m, x0, y, z0, thick) => { for (const k of [-1, 1]) M(G.box, m, V(k * (x0 + hw + .02) / 2, y, z0 / 2), V(thick * .7, thick, Math.hypot(hw + .02 - x0, z0)), h, [0, -k * Math.atan2(hw + .02 - x0, z0), 0]); };
  M(G.sph, sk, null, V(hw, hh, hd), h);
  for (const k of [-1, 1]) M(sm, sk, V(k * (hw + .01), -.02, -.02), V(.08, .12, .06), h);
  if (L.earring) for (const k of [-1, 1]) M(torus(.055, .013), gold, V(k * (hw + .03), -.2, -.02), null, h, [0, HALF, 0]);
  if (L.blush) for (const k of [-1, 1]) M(sm, mat(blend(L.skin, 0xff5f7a, .38), .6), F(k * .31, -.13, -.012), V(.09, .06, .025), h);

  // nose
  const nose = mat(blend(L.skin, 0xd0504a, .16), .6);
  const ns = { bulb: V(.12, .12, .12), small: V(.075, .07, .08), long: V(.085, .09, .17), wide: V(.155, .1, .11) }[L.nose || 'bulb'];
  M(sm, nose, F(0, -.06, -.02), ns, h);

  // eyes
  const eyes = L.eyes || 'googly';
  let pupils = [];
  if (eyes === 'googly' || eyes === 'specs') {
    const ez = F(.17, .05).z - .05;
    pupils = googlyEyes(h, .05, ez, 1.3, .17);
    if (L.lids) for (const k of [-1, 1]) M(sm, sk, V(k * .17, .115, ez + .012), V(.156, .11, .112), h);        // heavy eyelids: unimpressed
    if (eyes === 'specs') {
      const rim = mat(L.rimC ?? 0x16161a, .35);
      for (const k of [-1, 1]) M(torus(.165, .017), rim, V(k * .185, .05, ez + .1), null, h);
      M(G.box, rim, V(0, .07, ez + .1), V(.06, .025, .025), h);
      temples(rim, .33, .07, ez + .09, .02);
    }
    const b = L.brows || 'flat';
    if (b !== 'none') {
      const tilt = { flat: 0, thick: 0, angry: -.38, worried: .34 }[b], bg = b === 'thick' ? cap(.036, .13) : cap(.023, .13);
      for (const k of [-1, 1]) M(bg, L.hair === 'bald' || L.hair === 'none' ? mat(blend(L.hairC ?? 0x2a1a12, 0x16161a, .5), .9) : hair, F(k * .18, L.hat ? .255 : .285, .0), null, h, [0, 0, HALF + k * tilt]);
    }
  } else if (eyes === 'shades') {
    const sg = mat(L.lensC ?? 0x111216, .05, .4), fz = F(.17, .08).z - .017;
    for (const k of [-1, 1]) M(rbox(.26, .16, .08, .05), sg, V(k * .17, .08, fz), null, h);
    M(G.box, sg, V(0, .1, fz + .03), V(.12, .03, .03), h);
    temples(sg, .29, .1, fz, .03);
  } else {                                                          // aviators
    const fz = F(.17, .06).z - .025, lens = mat(0x1a2a3a, .02, .6), av = mat(0xc9a24a, .15, 1);
    for (const k of [-1, 1]) { M(sm, lens, V(k * .17, .06, fz), V(.14, .12, .05), h); M(torus(.13, .015), av, V(k * .17, .06, fz + .02), V(1, .9, 1), h); }
    M(G.box, av, V(0, .1, fz + .035), V(.1, .018, .018), h);
    temples(av, .29, .09, fz, .018);
  }

  // beard under everything else on the lower face
  const lowOut = L.beard === 'full' ? .045 : 0;
  if (L.beard === 'full') M(G.sph, hair, V(0, -.2, .03), V(hw * 1.02, .37, hd * 1.01), h);
  if (L.beard === 'goatee') M(sm, hair, F(0, -.4, -.04), V(.13, .12, .09), h);

  // mouth and mustache
  const my = -.25, m = L.tash && !L.mouth ? 'none' : (L.mouth || 'smile');
  if (m === 'smile') M(torus(.105, .021, Math.PI), mouthIn, F(0, my + .09, .005 + lowOut), null, h, [-.25, 0, Math.PI]);
  else if (m === 'grin') { M(rbox(.25, .115, .03, .03), mouthIn, F(0, my, -.012 + lowOut), null, h, [-.3, 0, 0]); M(rbox(.2, .07, .03, .02), eyeW, F(0, my, .0 + lowOut), null, h, [-.3, 0, 0]); }
  else if (m === 'flat') M(cap(.019, .12), mouthIn, F(0, my - (L.tash ? .07 : 0), -.008 + lowOut), null, h, [0, 0, HALF]);
  else if (m === 'smirk') M(cap(.02, .13), mouthIn, F(.04, my, -.008 + lowOut), null, h, [0, 0, HALF + .22]);
  else if (m === 'oh') M(sm, mouthIn, F(0, my, -.01 + lowOut), V(.055, .068, .03), h);
  else if (m === 'lips') M(cap(.03, .1), mat(L.lipC ?? 0xc0405a, .4), F(0, my + .01, -.012), null, h, [0, 0, HALF]);
  const tz = F(.11, -.2).z - .02 + lowOut;
  if (L.tash === 'handlebar') for (const k of [-1, 1]) M(cap(.045, .18), hair, V(k * .11, -.2, tz), null, h, [0, 0, k * 1.2]);
  if (L.tash === 'bar') M(cap(.05, .36), hair, V(0, -.2, tz + .01), null, h, [0, 0, HALF]);
  if (L.tash === 'pencil') M(cap(.022, .24), hair, V(0, -.19, tz + .02), null, h, [0, 0, HALF]);

  // hair
  const covered = ['cap', 'capBack', 'beanie', 'fedora', 'bucket', 'cop'].includes(L.hat);        // a hat that hides the top of the head
  const st = covered && !['bob', 'long', 'ponytail', 'balding', 'pigtails'].includes(L.hair) ? 'none' : L.hair || 'short';
  const capHair = () => M(G.sph, hair, V(0, .3, -.05), V(hw * .93, .3, hd * .88), h);
  if (st === 'short') capHair();
  if (st === 'pomp') { capHair(); M(sm, hair, V(0, .5, .2), V(.3, .19, .27), h); M(sm, hair, V(0, .46, -.08), V(.36, .2, .34), h); }
  if (st === 'flattop') { capHair(); M(rbox(hw * 1.5, .2, hd * 1.42, .09), hair, V(0, hh - .07, -.04), null, h); }
  if (st === 'afro') { M(sm, hair, V(0, .25, -.1), V(hw + .2, .62, hd + .15), h); for (let i = 0; i < 9; i++) scalp(sm, hair, .75 + (i % 3) * .55, (Math.floor(i / 3) - 1) * .75, .22, .17); }
  if (st === 'curls') { capHair(); for (let i = 0; i < 11; i++) scalp(sm, hair, .62 + (i % 4) * .5, ((i * 7) % 5 - 2) * .34, .03, .15 + (i % 3) * .02); }
  if (st === 'bun') { M(G.sph, hair, V(0, .18, -.08), V(hw + .06, .5, hd + .05), h); M(G.sph, hair, V(0, .78, -.1), .38, h); }
  if (st === 'bob' || st === 'long' || st === 'pigtails' || st === 'ponytail') {
    M(G.sph, hair, V(0, .15, -.09), V(hw + .055, .5, hd + .04), h);
    if (!L.hat || L.hat === 'band' || L.hat === 'phones') for (const k of [-1, 0, 1]) M(sm, hair, F(k * .2, .36 - Math.abs(k) * .03, -.03), V(.17, .1, .1), h, [0, 0, -k * .5]);     // fringe
  }
  if (st === 'bob') for (const k of [-1, 1]) M(sm, hair, V(k * (hw - .02), -.16, -.08), V(.15, .3, .3), h);
  if (st === 'long') { for (const k of [-1, 1]) M(cap(.15, .46), hair, V(k * (hw - .04), -.34, -.14), null, h); M(G.sph, hair, V(0, -.3, -.3), V(hw * .86, .5, .26), h); }
  if (st === 'pigtails') for (const k of [-1, 1]) { M(sm, hair, V(k * (hw + .16), .14, -.08), V(.2, .24, .2), h); M(torus(.07, .03), mat(L.shoes ?? 0xff4d6d, .6), V(k * (hw + .03), .2, -.08), null, h, [0, HALF, 0]); }
  if (st === 'ponytail') { M(sm, hair, V(0, .28, -(hd + .1)), .17, h); M(cap(.1, .34), hair, V(0, -.02, -(hd + .2)), null, h, [.28, 0, 0]); }
  if (st === 'balding') M(G.sph, hair, V(0, -.03, -.1), V(hw + .035, .31, hd * .96), h);
  if (st === 'mohawk') for (let i = 0; i < 7; i++) scalp(cone(.1, .42, 10), hair, .55 + i * .34, 0, .12, V(.75, 1 - Math.abs(i - 2.5) * .07, 1.5));
  if (st === 'spikes') { capHair(); for (let i = 0; i < 9; i++) scalp(cone(.1, .3, 8), hair, .7 + (i % 3) * .5, (Math.floor(i / 3) - 1) * .5, .06, 1); }

  // hats
  const hc = mat(L.hatC ?? 0xe8455b, .85);
  if (L.hat === 'cap' || L.hat === 'capBack') {
    const b = L.hat === 'cap' ? 1 : -1;
    M(G.sph, hc, V(0, .355, 0), V(hw * 1.035, .3, hd * 1.035), h);
    M(G.cyl, hc, V(0, .275, b * (hd + .14)), V(.35, .028, .38), h, [b * .2, 0, 0]);
    M(sm, white, V(0, .66, 0), V(.05, .025, .05), h);
    if (b > 0) M(G.sph, white, V(0, .46, hd * .86), V(.1, .09, .04), h);                 // badge on the front
  }
  if (L.hat === 'beanie') {
    M(G.sph, hc, V(0, .3, -.02), V(hw * 1.04, .42, hd * 1.05), h);
    M(torus(.5, .055), mat(blend(L.hatC ?? 0xe8455b, 0xffffff, .25), .9), V(0, .235, -.02), V(hw * 1.93, hd * 1.96, 1.2), h, [HALF, 0, 0]);
    M(sm, white, V(0, .76, -.02), .1, h);
  }
  if (L.hat === 'fedora') {
    M(frustum(.34, .39, .3), hc, V(0, .55, -.02), null, h); M(frustum(.6, .62, .045), hc, V(0, .4, -.02), null, h);
    M(frustum(.385, .395, .08), dark, V(0, .46, -.02), null, h);
  }
  if (L.hat === 'bucket') { M(frustum(.35, .47, .27), hc, V(0, .5, -.02), null, h); M(frustum(.47, .66, .1), hc, V(0, .33, -.02), null, h); }
  if (L.hat === 'band') M(torus(.5, .045), hc, V(0, .27, 0), V(hw * 1.8, hd * 1.8, 1.5), h, [HALF, 0, 0]);
  if (L.hat === 'phones') {
    M(torus(1, .05, Math.PI), dark, V(0, 0, -.02), V(hw + .05, hh + .08, 1), h);
    for (const k of [-1, 1]) { M(G.cyl, hc, V(k * (hw + .06), -.02, -.02), V(.15, .09, .15), h, [0, 0, HALF]); M(G.cyl, dark, V(k * (hw + .02), -.02, -.02), V(.17, .05, .17), h, [0, 0, HALF]); }
  }
  if (L.hat === 'cop') {
    const navy = mat(0x1c2a55, .8);
    M(G.cyl, navy, V(0, .42, 0), V(.5, .22, .5), h); M(G.cyl, mat(0x111111, .4), V(0, .33, .12), V(.52, .03, .58), h); M(sm, gold, V(0, .45, .48), V(.07, .08, .02), h);
    M(sm, gold, V(.14, 1.2, .27), V(.05, .06, .02), body);
  }
  return pupils;
}

// ---------- clothes and what they carry ----------
function dress(r, L, sk, shirt) {
  const u = r.userData, body = u.body, top = L.top, pants = mat(L.legC ?? 0x2b3443, .9), accent = mat(blend(L.topC ?? 0xffffff, 0xffffff, .82), .85);
  const shortSleeves = top === 'tee' || top === 'hawaii' || top === 'leopard';
  if (shortSleeves) for (const a of u.arms) M(shirt.map ? printCap(.103, .09) : cap(.103, .09), shirt, V(0, -.07, 0), null, a);
  if (top === 'hawaii' || top === 'leopard') {            // open collar
    for (const k of [-1, 1]) M(rbox(.13, .05, .1, .02), shirt, V(k * .085, 1.47, .2), null, body, [.5, k * .5, k * .45]);
    M(sm, sk, V(0, 1.4, .19), V(.09, .12, .06), body);
  }
  if (top === 'suit') {
    M(sm, white, V(0, 1.3, .185), V(.13, .22, .1), body); M(rbox(.075, .27, .03, .02), mat(L.tieC ?? 0xe8455b, .6), V(0, 1.2, .285), null, body, [-.12, 0, 0]);
    for (const k of [-1, 1]) M(rbox(.1, .26, .03, .02), shirt, V(k * .125, 1.3, .25), null, body, [-.1, k * .35, -k * .32]);
  }
  if (top === 'track') {
    for (const [i, a] of u.arms.entries()) M(cap(.027, .36), accent, V((i ? 1 : -1) * .072, -.22, 0), null, a);
    for (const [i, l] of u.legs.entries()) M(cap(.03, .42), accent, V((i ? 1 : -1) * .095, -.3, 0), null, l);
    M(G.box, accent, V(0, 1.1, .262), V(.022, .56, .02), body); M(torus(.15, .04), shirt, V(0, 1.5, .0), V(1, 1, 1), body, [HALF, 0, 0]);
  }
  if (top === 'hoodie') {
    M(sm, shirt, V(0, 1.47, -.23), V(.27, .17, .17), body); M(rbox(.32, .15, .06, .03), shirt, V(0, .97, .245), null, body);
    for (const k of [-1, 1]) M(cap(.012, .16), white, V(k * .06, 1.3, .27), null, body);
  }
  if (top === 'uniform') { M(rbox(.5, .07, .46, .03), mat(0x15161a, .5), V(0, .86, 0), null, body); M(sm, mat(0x2a3f7a, .85), V(0, 1.42, .17), V(.11, .08, .06), body); }
  if (L.legs === 'shorts') for (const l of u.legs) M(cap(.128, .15), pants, V(0, -.13, 0), null, l);
  if (L.legs === 'skirt') { M(frustum(.27, .41, .4), pants, V(0, .7, 0), V(1, 1, .86), body); for (const l of u.legs) M(cap(.12, .06), pants, V(0, -.06, 0), null, l); }
  if (L.chain) M(torus(.2, .02), gold, V(0, 1.4, .1), V(1, 1.25, 1), body, [HALF + .62, 0, 0]);

  const hand = u.arms[1];                                  // the left hand, so the right stays free for a gun
  if (L.prop === 'phone') M(rbox(.18, .32, .04, .03), mat(0x111216, .1, .4), V(0, -.48, .1), null, hand, [.2, 0, 0]);
  if (L.prop === 'donut') M(keep('donut', () => new THREE.TorusGeometry(.12, .06, 10, 20)), mat(0xff8fb1, .5), V(0, -.47, .1), null, hand, [HALF, 0, 0]);
  if (L.prop === 'coffee') { M(frustum(.07, .055, .2), white, V(0, -.5, .1), null, hand, [HALF, 0, 0]); M(frustum(.075, .075, .03), mat(0x6b4423, .7), V(0, -.5, .2), null, hand, [HALF, 0, 0]); }
  if (L.prop === 'bag') { M(rbox(.3, .32, .13, .03), mat(L.shoes ?? 0xe8455b, .8), V(0, -.78, 0), null, hand); M(torus(.07, .012, Math.PI), dark, V(0, -.62, 0), V(1, 1.4, 1), hand); }
}

// kind: 'bighead' (a fresh citizen), 'bigcop', or one of the named three. opt.look: parts to force, or a whole saved look.
// opt.props: false leaves the hands empty (the player).
export function bigHead(kind = 'bighead', opt = {}) {
  const whole = opt.look?.shape && opt.look.skin !== undefined;        // a complete look (a remembered one) is used as is; a partial one overrides a fresh roll
  const L = { ...(whole ? null : LOOKS[kind] || randomLook(kind === 'bigcop')), ...opt.look };
  if (opt.props === false) L.prop = null;
  const sk = mat(L.skin, .6), top = L.top || 'tee';
  const topC = top === 'uniform' ? 0x2a3f7a : L.topC ?? 0xe8455b;
  const shirt = top === 'hawaii' || top === 'stripes' || top === 'leopard' ? printed(top, L.print || 0) : mat(topC, .88);
  const bare = top === 'tee' || top === 'hawaii' || top === 'leopard' || top === 'tank';
  const r = rig({ shirt, pants: mat(L.legC ?? 0x2b3443, .9), shoes: mat(L.shoes ?? 0xf4f4f4, .7), skin: sk, headY: 1.86, armMat: bare ? sk : null, legMat: L.legs === 'shorts' || L.legs === 'skirt' ? sk : null });
  const u = r.userData;
  if (shirt.map) { const torso = u.body.children.find(o => o.isMesh); torso.geometry = printCap(.3, .34); for (const a of u.arms) if (!bare) a.children[0].geometry = printCap(.085, .36); }
  u.pupils = buildHead(u.head, L, u.body);
  dress(r, L, sk, shirt);
  // bobble: the head rides on a soft spring. headR/headY: the (much bigger) target a bullet can hit.
  u.big = { rx: 0, rz: 0, vx: 0, vz: 0, pose: '', headR: L.shape[0] + .03, headY: 1.86 - L.shape[1], top: 1.86 + L.shape[1] + .05 };
  u.look = L; u.skinC = L.skin; u.sleeveC = bare ? L.skin : topC;
  return r;
}
