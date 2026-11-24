// The cast: Critters (critters.js), Tin Bots (bots.js) and Big Heads (bigheads.js), all built on one shared body
// (rig.js) so they move the same way (animate.js), and each welded into a few skinned meshes (weld.js).
// Shapes come from the cast concepts.
import { V } from '../core/utils.js';
import { G, rbox } from '../world/materials.js';
import { mat, gold, cone, M } from './rig.js';
import { critter } from './critters.js';
import { scrap, tess, unit50 } from './bots.js';
import { bigHead } from './bigheads.js';
import { weld } from './weld.js';
export { animateCharacter, poseJoints, reelCharacter, tumblePlan, tumbleEase, standCharacter, bonkHead } from './animate.js';

// Extras for Critters and Tin Bots (Big Heads get theirs from their look): a woolly hat, a gang's headband, a crown.
//   opt.beanie / opt.band / opt.crown: a colour (crown: true for gold)
function dressUp(c, opt) {
  const u = c.userData, h = u.head, bot = !!u.bot;
  if (opt.beanie !== undefined) {
    const m = mat(opt.beanie, .95);
    if (bot) { M(rbox(.66, .26, .54, .1), m, V(0, .3, 0), null, h); M(rbox(.68, .09, .56, .04), m, V(0, .19, 0), null, h); }
    else { M(G.sph, m, V(0, .17, -.01), V(.375, .25, .355), h); M(G.cyl, m, V(0, .12, -.01), V(.38, .08, .36), h); M(G.sph, m, V(0, .42, -.01), .07, h); }
  }
  if (opt.band !== undefined) {
    const m = mat(opt.band, .8);
    if (bot) { M(rbox(.66, .1, .54, .03), m, V(0, .17, 0), null, h); for (const s of [-1, 1]) M(rbox(.08, .2, .03, .01), m, V(s * .07, .08, -.28), null, h, [0, 0, s * .35]); }
    else { M(G.cyl, m, V(0, .15, -.005), V(.357, .075, .34), h); for (const s of [-1, 1]) M(rbox(.07, .2, .03, .01), m, V(s * .06, .06, -.34), null, h, [.3, 0, s * .4]); }
  }
  if (opt.crown) {
    const y = bot ? .27 : .31, r = bot ? .2 : .17; M(G.cyl, gold, V(0, y, 0), V(r, .07, r), h);
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; M(cone(.045, .13, 6), gold, V(Math.sin(a) * r * .86, y + .09, Math.cos(a) * r * .86), null, h); }
  }
}
// Far-away characters don't need shadows.
export function setCharacterShadow(c, on) {
  if (c.userData.shadow === on) return; c.userData.shadow = on;
  c.traverse(o => { if (o.isMesh) o.castShadow = on; });
}

// Who walks the streets and who polices them (repeats make a kind more common). 'bighead' and 'bigcop' are rolled fresh every time.
export const CIVILIANS = ['raccoon', 'raccoon', 'possum', 'possum', 'scrap', 'scrap', 'scrap', 'bighead', 'bighead', 'bighead', 'bighead', 'bighead'];
export const COPS = ['pigeon', 'unit50', 'bigcop'];
export const BIG_HEADS = ['bighead', 'bigcop', 'sal', 'dale', 'tiff', 'dot'];
// Who you can play as (the title and pause menus). Rocco is the default.
export const PLAYABLE = [['rocco', 'Rocco'], ['sal', 'Big Sal'], ['tiff', 'Tiff'], ['bighead', 'Random Big Head']];

export function makeCharacter(kind, opt) {
  let c;
  if (BIG_HEADS.includes(kind)) c = bigHead(kind, opt);
  else if (kind === 'rocco') c = critter('raccoon', { outfit: 0xe8455b, hood: true, pants: 0x4a3b2e, shoes: 0x1d1f24 });
  else if (kind === 'scrap') c = scrap(opt);
  else if (kind === 'tess') c = tess();
  else if (kind === 'unit50') c = unit50();
  else c = critter(kind, opt);
  if (opt && !c.userData.big) dressUp(c, opt);
  c.userData.kind = kind; c.userData.shadow = true;
  weld(c);
  return c;
}
