// Critters: Rocco and the other raccoons, the possums, and the pigeons who police them.
// Round heads with googly eyes on the shared body (rig.js), dressed in hoodies, tees or a uniform.
import * as THREE from 'three';
import { V, choose } from '../core/utils.js';
import { G, rbox, cap } from '../world/materials.js';
import { rig, googlyEyes, eyelids, mat, eyeB, gold, cone, M, sm, tiny, torus, tube, lathe, blend, DEEP, cache } from './rig.js';

const OUTFITS = [0xe8455b, 0x3e6fd6, 0xf2a93b, 0x2f8f83, 0x9b5de5, 0xff7aa2, 0xf4f1ea, 0x2b2f35];
const PANTS = [0x2b3443, 0x4a3b2e, 0x33415c, 0x5a5f66];
const HALF = Math.PI / 2;
const keep = (k, make) => cache[k] || (cache[k] = make());
// a hood that is up: most of a ball, open at the face, with a rolled edge round the opening
const hoodShell = () => keep('hoodShell', () => new THREE.SphereGeometry(1, 22, 12, 0, Math.PI * 2, 0, 2.0));
const mouth = mat(0x2a1a1e, .6), pink = mat(0xf0a3b0, .7);

// what the top half wears. The chest keeps the body's coordinates, so heights here are heights off the ground.
function dressTop(u, top, shirt, shirtC, hoodUp) {
  const ch = u.chest, accent = mat(blend(shirtC, shirtC === 0xf4f1ea ? 0x2b2f35 : 0xffffff, .78), .85);
  if (top === 'hoodie') {
    M(torus(.165, .05, Math.PI * 2, 18), shirt, V(0, 1.475, -.01), V(1, 1.02, 1), ch, [HALF, 0, 0]);                  // the thick collar the hood grows from
    if (!hoodUp) M(sm, shirt, V(0, 1.44, -.21), V(.25, .16, .15), ch);                                              // hood down: a soft roll behind the neck
    M(rbox(.31, .15, .06, .03), shirt, V(0, .985, .246), null, ch); M(rbox(.33, .022, .02, .008), accent, V(0, 1.058, .262), null, ch);      // the front pocket and its trim
    for (const k of [-1, 1]) { M(cap(.011, .13), accent, V(k * .055, 1.33, .243), null, ch, [.16, 0, k * .08]); M(tiny, accent, V(k * .06, 1.25, .259), .017, ch); }
  } else if (top === 'tee') {
    M(torus(.14, .024, Math.PI * 2, 18), accent, V(0, 1.468, 0), null, ch, [HALF, 0, 0]);                           // ringer collar
    M(lathe('chestStripe', [[.3065, 1.135], [.309, 1.165], [.307, 1.195]]), accent, null, V(1, 1, DEEP), ch);        // and one stripe round the chest
    for (const a of u.arms) { M(cap(.102, .06), shirt, V(0, -.055, 0), null, a); M(tube(.104, .105, .025, 14), accent, V(0, -.132, 0), null, a); }     // short sleeves with a trim
  } else if (top === 'uniform') {
    const navy = mat(0x15203f, .8), leather = mat(0x15161a, .5);
    M(lathe('belt', [[.289, .875], [.297, .905], [.289, .94]]), leather, null, V(1, 1, DEEP), u.body); M(rbox(.075, .058, .02, .008), gold, V(0, .905, .256), null, u.body);
    M(rbox(.1, .17, .11, .03), leather, V(-.275, .85, .03), null, u.body, [0, 0, -.1]);                              // holster on the right hip
    M(rbox(.058, .21, .02, .01), navy, V(0, 1.29, .247), null, ch, [-.1, 0, 0]); M(rbox(.085, .06, .03, .012), navy, V(0, 1.415, .212), null, ch, [-.5, 0, 0]);       // tie and its knot
    for (const k of [-1, 1]) M(rbox(.11, .05, .04, .012), shirt, V(k * .085, 1.44, .19), null, ch, [-.6, k * .4, k * .5]);            // collar points
    M(sm, gold, V(.14, 1.2, .236), V(.05, .06, .02), ch);                                                            // badge
    M(rbox(.07, .1, .045, .012), leather, V(-.16, 1.31, .222), null, ch, [-.12, 0, 0]); M(tube(.006, .006, .09, 6), leather, V(-.185, 1.4, .215), null, ch);        // radio
  }
}

export function critter(kind, opt = {}) {
  const cop = kind === 'pigeon';
  const furC = { raccoon: 0x8b8d94, pigeon: 0x7d879c, possum: 0xe9e4da }[kind], fur = mat(furC, .75);
  const outfit = opt.outfit ?? choose(OUTFITS);
  const hoodUp = kind === 'raccoon' && (opt.hood ?? Math.random() < .4);
  const top = cop ? 'uniform' : opt.top ?? (hoodUp || Math.random() < .55 ? 'hoodie' : 'tee');
  const shirtC = cop ? 0x2a3f7a : outfit, shirt = mat(shirtC, .9);
  const shoeC = cop ? 0xf2963a : opt.shoes ?? choose([0xf4f4f4, 0xe8455b, 0x1d1f24]);
  const r = rig({
    shirt, pants: mat(cop ? 0x1c2a55 : opt.pants ?? choose(PANTS), .9), shoes: mat(shoeC, .9), skin: fur,
    armMat: cop || top === 'tee' ? fur : null, sleeve: top === 'tee' ? shirt : null, loose: !cop, sole: mat(cop ? 0xd97f2a : shoeC === 0xf4f4f4 ? 0xcfc9c0 : 0xf4f1ea, .85),
  });
  const u = r.userData, h = u.head;
  dressTop(u, top, shirt, shirtC, hoodUp);
  M(G.sph, fur, null, V(.36, .33, .34), h);
  let lidM = fur;
  if (kind === 'raccoon') {
    const dark = mat(0x2a2a30, .75), pale = mat(0xdedad2, .75), earM = mat(0x55565e, .75); lidM = dark;
    const earY = hoodUp ? .385 : .3;
    for (const s of [-1, 1]) {
      M(sm, dark, V(s * .15, .062, .2), V(.168, .114, .125), h, [0, 0, -s * .28]);                 // the mask: a patch round each eye, proud of the fur
      M(cone(.1, .2), earM, V(s * .225, earY, -.02), null, h, [0, 0, -s * .35]);
      M(cone(.055, .13, 8), pink, V(s * .218, earY - .008, .03), null, h, [-.1, 0, -s * .35]);
      if (!hoodUp) for (const [dy, a, l] of [[-.06, .3, .15], [-.15, .75, .12]]) M(cone(.085, l, 8), fur, V(s * .315, dy, .03), null, h, [0, 0, -s * (HALF + a)]);      // cheek tufts
    }
    M(sm, mat(0xc6c8ce, .75), V(0, .21, .19), V(.2, .058, .11), h);                                // the pale band over the mask
    M(sm, pale, V(0, -.1, .27), V(.15, .11, .13), h); M(tiny, eyeB, V(0, -.058, .398), V(.052, .04, .04), h);
    M(torus(.042, .009, Math.PI, 10), mouth, V(0, -.108, .392), null, h, [.25, 0, Math.PI]);
    const tail = new THREE.Group(); tail.position.set(0, .85, -.25); u.body.add(tail);
    for (let i = 0; i < 6; i++) M(sm, mat(i % 2 ? 0x2a2a30 : 0x9a9ca3, .75), V(0, i * .06, -i * .11), .14 - i * .012, tail);
    u.tail = tail;
    if (hoodUp) {
      const hood = new THREE.Group(); hood.position.set(0, .01, -.025); hood.rotation.x = -1.2; hood.scale.set(.392, .372, .378); h.add(hood);
      M(hoodShell(), shirt, null, null, hood); M(torus(.905, .07, Math.PI * 2, 24), shirt, V(0, -.416, 0), null, hood, [HALF, 0, 0]);
    }
  }
  if (kind === 'pigeon') {
    const beak = mat(0xf2963a, .5), navy = mat(0x1c2a55, .9);
    M(cone(.08, .26), beak, V(0, -.04, .42), null, h, [HALF, 0, 0]); M(sm, mat(0xf4f1ea, .6), V(0, .012, .345), V(.075, .04, .05), h);      // beak and the pale cere above it
    M(torus(.26, .07, Math.PI * 2, 24), mat(0x5e9a7c, .3, .4), V(0, -.24, 0), null, h, [HALF, 0, 0]);
    M(G.cyl, navy, V(0, .3, 0), V(.3, .16, .3), h); M(G.cyl, navy, V(0, .39, .02), V(.36, .04, .38), h);
    M(rbox(.3, .04, .18, .02), eyeB, V(0, .24, .3), null, h); M(sm, gold, V(0, .31, .295), V(.05, .055, .02), h);
    const tail = new THREE.Group(); tail.position.set(0, .82, -.2); u.body.add(tail);
    for (const k of [-1, 0, 1]) M(sm, mat(k ? 0x6c7589 : 0x5c6477, .75), V(k * .07, 0, -.11), V(.07, .03, .17), tail, [.5, k * .35, 0]);     // tail feathers
    u.tail = tail; u.tailStiff = true;
  }
  if (kind === 'possum') {
    const earM = mat(0x3a3236, .75);
    M(cone(.13, .34, 16), mat(0xf4efe8, .75), V(0, -.07, .38), null, h, [HALF, 0, 0]); M(sm, mat(0xff8fb1, .4), V(0, -.07, .56), V(.05, .045, .045), h);
    M(torus(.05, .009, Math.PI, 10), mouth, V(0, -.15, .36), null, h, [.5, 0, Math.PI]);
    for (const s of [-1, 1]) { M(sm, earM, V(s * .25, .25, -.02), V(.11, .11, .04), h); M(sm, pink, V(s * .25, .245, .012), V(.07, .07, .022), h); }
    for (const [x, a] of [[-.05, .25], [0, 0], [.05, -.25]]) M(cone(.04, .12, 6), fur, V(x, .34, .04), null, h, [.25, 0, a]);              // a tuft on top
    const tail = new THREE.Group(); tail.position.set(0, .8, -.2); u.body.add(tail);
    M(keep('possumTail', () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0, 0, 0), V(0, -.1, -.35), V(0, .05, -.7), V(0, .25, -.8)]), 12, .04, 6)), mat(0xf4b6c6, .75), null, null, tail);
    u.tail = tail;
  }
  u.pupils = googlyEyes(h);
  u.lid = eyelids(h, lidM);
  u.skinC = furC; u.sleeveC = cop || top === 'tee' ? furC : shirtC;
  return r;
}
