// The body every character is built on, and the little helpers the cast families share.
// A family adds its own head and outfit. The body has real joints:
//
//   root
//    └ body            hips: the whole character bounces, tips over and tumbles through this
//       ├ legs[i]      hip joint → thigh        └ knees[i] → shin        └ feet[i] → shoe
//       └ chest        everything above the belt (twists and leans against the hips)
//          ├ arms[i]   shoulder joint → upper arm   └ elbows[i] → forearm and hand   └ hands[i]: where a held thing goes
//          └ head
//
// The chest and hands[i] keep the same coordinates as the body and arms[i] they hang from, so anything placed
// "on the body at chest height" or "in the arm at hand height" can simply be added to them instead.
// arms[0] / legs[0] are the character's right side. Everything is welded into a few skinned meshes by models.js.
import * as THREE from 'three';
import { V } from '../core/utils.js';
import { std, G, mesh, rbox, cap } from '../world/materials.js';

export const cache = {};
export const mat = (c, r = .7, m = 0) => cache[c + '/' + r + '/' + m] || (cache[c + '/' + r + '/' + m] = std({ color: c, roughness: r, metalness: m }));
export const glow = (c, i) => std({ color: 0x000000, emissive: c, emissiveIntensity: i });
export const eyeW = mat(0xffffff, .15), eyeB = mat(0x0d0d10, .05), gold = mat(0xffd34d, .3, 1);
export const cone = (r, h, seg = 12) => new THREE.ConeGeometry(r, h, seg);
export const M = (geo, m, p, s, parent, rot) => { const o = mesh(geo, m, p, s, parent); if (rot) o.rotation.set(...rot); return o; };
export const sm = new THREE.SphereGeometry(1, 16, 10);            // small parts don't need the full-detail ball
export const tiny = new THREE.SphereGeometry(1, 10, 6);           // rivets, buttons, toes
const keep = (k, make) => cache[k] || (cache[k] = make());
export const torus = (R, r, arc = Math.PI * 2, seg = 28) => keep(`tor${R},${r},${arc},${seg}`, () => new THREE.TorusGeometry(R, r, 8, seg, arc));
export const tube = (a, b, h, seg = 16) => keep(`fr${a},${b},${h},${seg}`, () => new THREE.CylinderGeometry(a, b, h, seg));
export const blend = (a, b, k) => new THREE.Color(a).lerp(new THREE.Color(b), k).getHex();

// A shape turned on a lathe from a smooth outline: [[radius, height], ...] from the bottom up.
export function lathe(key, pts, seg = 22) {
  return keep('lathe/' + key, () => {
    const line = new THREE.SplineCurve(pts.map(([r, y]) => new THREE.Vector2(r, y))).getPoints(pts.length * 3).map(p => new THREE.Vector2(Math.max(0, p.x), p.y));
    const g = new THREE.LatheGeometry(line, seg); g.computeVertexNormals(); return g;
  });
}
// The soft body: hips in the trousers' colour, and a top that is either tucked in at the belt or hangs loose over it.
const HIPS = [[0, .655], [.15, .668], [.236, .715], [.274, .8], [.288, .9], [.288, .935]];
const TUCKED = [[.288, .9], [.297, 1.04], [.3, 1.17], [.287, 1.29], [.247, 1.39], [.18, 1.455], [.1, 1.5], [0, 1.515]];
const LOOSE = [[.24, .835], [.302, .85], [.312, .9], [.308, 1.04], [.303, 1.17], [.288, 1.29], [.247, 1.39], [.18, 1.455], [.1, 1.5], [0, 1.515]];
export const DEEP = .86;                 // bodies are a little flatter front to back than they are wide
export const torsoGeo = (loose) => lathe(loose ? 'loose' : 'tucked', loose ? LOOSE : TUCKED);

export const JOINT = { knee: .33, ankle: .33, elbow: .235 };      // how far down each limb its joint sits

// o: { shirt, pants, shoes, skin }: materials. Extras:
//   headY     how high the head's middle sits            armMat / legMat   bare (or furry) arms and legs
//   style     'soft' (Critters, Big Heads) or 'bot'      loose             the top hangs over the belt (hoodies, tees)
//   sole      material of the shoe soles                 foreMat           the forearm, when it differs from the upper arm (short sleeves)
//   joint     (bots) material of the ball joints and thin limbs      sleeve   the shoulder, when a short sleeve covers it
export function rig(o) {
  const { shirt, pants, shoes, skin, headY = 1.66, armMat, legMat, style = 'soft', loose = true } = o;
  const bot = style === 'bot';
  const root = new THREE.Group(), body = new THREE.Group(), chest = new THREE.Group(); root.add(body); body.add(chest);
  const legs = [], arms = [], knees = [], feet = [], elbows = [], hands = [];
  const sole = o.sole || mat(0xf4f1ea, .8), joint = o.joint || skin;

  // ---------- legs ----------
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * .16, .74, 0); body.add(hip);
    const knee = new THREE.Group(); knee.position.set(0, -JOINT.knee, 0); hip.add(knee);
    const foot = new THREE.Group(); foot.position.set(0, -JOINT.ankle, 0); knee.add(foot);
    if (bot) {
      M(sm, joint, null, .1, hip); M(tube(.062, .062, .3, 12), joint, V(0, -.17, 0), null, hip);
      M(sm, joint, null, .088, knee); M(cap(.098, .15), pants, V(0, -.17, 0), null, knee); M(tube(.112, .112, .05, 14), joint, V(0, -.285, 0), null, knee);
      M(rbox(.25, .15, .36, .05), shoes, V(0, -.005, .06), null, foot); M(rbox(.2, .09, .12, .03), joint, V(0, -.03, .2), null, foot);
    } else {
      // each capsule's round end is centred on the joint, so a bent knee is still one smooth shape
      M(cap(.113, .3), legMat || pants, V(0, -.18, 0), null, hip);
      M(cap(.106, .25), legMat || pants, V(0, -.125, 0), null, knee);
      if (!legMat) M(tube(.114, .118, .05, 14), pants, V(0, -.262, 0), null, knee);                  // the turn-up at the trouser cuff
      else M(tube(.109, .112, .07, 14), o.sock || mat(0xf4f1ea, .9), V(0, -.25, 0), null, knee);        // socks under bare legs
      M(rbox(.205, .125, .3, .055), shoes, V(0, -.012, .045), null, foot); M(sm, shoes, V(0, -.03, .17), V(.1, .068, .115), foot);
      M(rbox(.215, .05, .375, .022), sole, V(0, -.055, .056), null, foot);
    }
    legs.push(hip); knees.push(knee); feet.push(foot);
  }
  // ---------- hips and chest ----------
  if (bot) {
    M(rbox(.44, .2, .34, .08), pants, V(0, .76, 0), null, body); M(tube(.15, .17, .1, 16), joint, V(0, .86, 0), null, body);
    M(rbox(.58, .56, .42, .12), shirt, V(0, 1.16, 0), null, chest);
    M(tube(.075, .075, .2, 12), joint, V(0, 1.5, 0), null, chest); M(torus(.1, .028, Math.PI * 2, 16), joint, V(0, 1.45, 0), null, chest, [Math.PI / 2, 0, 0]);
  } else {
    M(lathe('hips', HIPS), pants, null, V(1, 1, DEEP), body);
    M(torsoGeo(loose), shirt, null, V(1, 1, DEEP), chest).name = 'torso';
    M(tube(.1, .115, .16, 14), skin, V(0, 1.5, 0), null, chest);                                    // neck
  }
  // ---------- arms ----------
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * .36, 1.3, 0); sh.rotation.z = s * .12; chest.add(sh);
    const el = new THREE.Group(); el.position.set(0, -JOINT.elbow, 0); sh.add(el);
    const hand = new THREE.Group(); hand.position.set(0, JOINT.elbow, 0); el.add(hand);       // same coordinates as the arm itself
    if (bot) {
      M(sm, joint, null, .105, sh); M(tube(.052, .052, .2, 12), joint, V(0, -.12, 0), null, sh);
      M(sm, joint, null, .075, el); M(cap(.082, .1), armMat || shirt, V(0, -.12, 0), null, el); M(tube(.06, .06, .05, 12), joint, V(0, -.225, 0), null, el);
      for (const k of [-1, 1]) M(rbox(.036, .12, .07, .014), joint, V(k * .045, -.3, .0), null, el, [0, 0, k * .12]);      // a two-finger grab
      M(rbox(.12, .045, .08, .02), joint, V(0, -.245, 0), null, el);
    } else {
      const upper = armMat || shirt, fore = o.foreMat || upper;
      M(sm, o.sleeve || upper, null, V(.098, .096, .096), sh).name = 'shoulder'; M(cap(.088, .2), upper, V(0, -.135, 0), null, sh).name = 'upper';
      M(cap(.085, .15), fore, V(0, -.075, 0), null, el).name = 'fore';
      if (fore === shirt) M(tube(.091, .094, .045, 14), shirt, V(0, -.19, 0), null, el);            // the cuff of a long sleeve
      // a mitten of a hand: palm, a thumb in front, and the fingers curled under
      M(sm, skin, V(0, -.262, .004), V(.076, .09, .064), el); M(tiny, skin, V(s * -.016, -.245, .064), V(.031, .048, .033), el, [.55, 0, 0]);
      M(sm, skin, V(0, -.318, .01), V(.066, .05, .057), el);
    }
    arms.push(sh); elbows.push(el); hands.push(hand);
  }
  const head = new THREE.Group(); head.position.set(0, headY, 0); chest.add(head);
  root.userData = { legs, arms, knees, feet, elbows, hands, head, body, chest, pupils: [], phase: Math.random() * 6, lie: 0, style };
  return root;
}

const glint = new THREE.SphereGeometry(1, 8, 6);       // the speck of light in each eye
// Two googly eyes. The pupils stay loose (they get a joint of their own) and remember where they sit, so they can roll about.
export function googlyEyes(head, y = .06, z = .27, s = 1, gap = .13) {
  const pupils = [];
  for (const k of [-1, 1]) {
    M(G.sph, eyeW, V(k * gap, y, z), V(.11 * s, .12 * s, .08 * s), head);
    const p = new THREE.Group(); p.position.set(k * gap, y - .01, z + .07 * s); head.add(p);
    M(sm, eyeB, null, V(.055 * s, .06 * s, .03 * s), p); M(glint, eyeW, V(.02 * s, .03 * s, .03 * s), .016 * s, p);
    p.userData = { bx: p.position.x, by: p.position.y, amp: s }; pupils.push(p);
  }
  return pupils;
}
// Eyelids for a pair of googly eyes: one joint across both eyes that swings the lids down for a blink.
// Open, they sit over the top of each eye like a brow ridge. Returns the joint (rotation.x: 0 open .. 1.25 shut).
export function eyelids(head, m, y = .06, z = .27, s = 1, gap = .13) {
  const lid = new THREE.Group(); lid.position.set(0, y, z); head.add(lid);
  const shell = keep('lidShell', () => new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI * .5));      // the top half of a ball
  for (const k of [-1, 1]) M(shell, m, V(k * gap, 0, 0), V(.118 * s, .128 * s, .088 * s), lid, [-.95, 0, 0]);
  lid.userData.open = 0; return lid;
}
