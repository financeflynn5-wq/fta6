// Things lying on the sidewalks: Flynn's guns, body armor and first-aid kits. They spin over a
// glowing ring, and come back a minute after you take them. Knocked-out cops drop ammo.
import * as THREE from 'three';
import { WEAPONS, COMBAT, PLAYER } from '../config.js';
import { groundY } from '../world/city.js';
import { std, rbox } from '../world/materials.js';
import { makeWeapon } from './weaponModels.js';

// Sidewalk spots: block centre +/- 18.4 is the middle of the pavement ring.
const SPOTS = [
  ['pistol', -45.4, -31], ['smg', -8.6, 27], ['shotgun', 27, -8.6], ['burst', 81, 62.6], ['sniper', -81, -99.4],
  ['armor', 8.6, 31], ['armor', -99.4, 76], ['armor', 62.6, -81],
  ['health', -27, -8.6], ['health', 31, 45.4], ['health', -62.6, 85],
];
const COLORS = { weapon: 0xffc94d, armor: 0x4da6ff, health: 0x5dff8a, ammo: 0xffc94d };

const vestMat = std({ color: 0x2f5fb8, roughness: .6 }), strapMat = std({ color: 0x1b2433, roughness: .8 });
const kitMat = std({ color: 0xf4f4f0, roughness: .4 }), crossMat = std({ color: 0xe8203a, roughness: .5, emissive: 0x400008 });
const crateMat = std({ color: 0x4d5a36, roughness: .7 }), brassMat = std({ color: 0xe0b04a, roughness: .3, metalness: 1 });

function model(kind, id) {
  const g = new THREE.Group(), add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  if (kind === 'weapon') { const w = makeWeapon(id); w.scale.setScalar(1.5 + .6 / WEAPONS[id].length); w.rotation.y = Math.PI / 2; g.add(w); }
  else if (kind === 'armor') { add(rbox(.5, .58, .22, .08), vestMat, 0, 0, 0); add(rbox(.12, .2, .24), strapMat, -.15, .3, 0); add(rbox(.12, .2, .24), strapMat, .15, .3, 0); add(rbox(.52, .08, .24), strapMat, 0, -.12, 0); }
  else if (kind === 'health') { add(rbox(.5, .38, .3, .06), kitMat, 0, 0, 0); add(new THREE.BoxGeometry(.3, .09, .02), crossMat, 0, 0, .16); add(new THREE.BoxGeometry(.09, .3, .02), crossMat, 0, 0, .16); }
  else { add(rbox(.42, .26, .3, .05), crateMat, 0, 0, 0); for (let i = 0; i < 4; i++) add(new THREE.CylinderGeometry(.025, .025, .14, 8), brassMat, -.12 + i * .08, .2, 0); }
  return g;
}

export function createPickups(game) {
  const ringTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const gr = x.createRadialGradient(64, 64, 30, 64, 64, 62); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.7, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
  })();
  const ringGeo = new THREE.PlaneGeometry(1.7, 1.7); ringGeo.rotateX(-Math.PI / 2);
  const list = [];

  function place(kind, id, x, z, temp = false) {
    const root = new THREE.Group(), y = groundY(x, z); root.position.set(x, y, z); game.scene.add(root);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ map: ringTex, color: new THREE.Color(COLORS[kind]).multiplyScalar(2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    ring.position.y = .03; root.add(ring);
    const m = model(kind, id); m.position.y = .9; root.add(m);
    const it = { kind, id, x, z, root, m, ring, wait: 0, life: temp ? 30 : Infinity, phase: Math.random() * 6 };
    list.push(it); return it;
  }
  for (const [what, x, z] of SPOTS) place(WEAPONS[what] ? 'weapon' : what, WEAPONS[what] ? what : null, x, z);

  function take(it) {
    const p = game.player, c = game.combat, hud = game.hud;
    if (it.kind === 'armor') { if (p.armor >= COMBAT.armor) return false; p.armor = COMBAT.armor; hud.toast('BODY ARMOR', 'good'); }
    else if (it.kind === 'health') { if (p.health >= PLAYER.health) return false; p.health = PLAYER.health; hud.toast('PATCHED UP', 'good'); }
    else if (it.kind === 'weapon') { const had = c.owned.has(it.id); c.give(it.id); if (had) hud.toast(`+${WEAPONS[it.id].give} ${WEAPONS[it.id].name} AMMO`, 'good'); }
    else { const id = c.owned.has(c.weapon) && !WEAPONS[c.weapon].melee ? c.weapon : 'pistol'; c.give(id, Math.ceil(WEAPONS[id].give / 2)); hud.toast(`${WEAPONS[id].name} AMMO`, 'good'); }
    game.audio.pickup(); return true;
  }

  return {
    list,
    // a knocked-out cop drops some rounds
    drop(x, z) { place('ammo', null, x, z, true); },
    update(dt, t) {
      const p = game.player, reach = p.mode === 'car' ? 2.6 : 1.3;
      for (let i = list.length - 1; i >= 0; i--) {
        const it = list[i];
        if (it.wait > 0) { if ((it.wait -= dt) <= 0) it.root.visible = true; continue; }
        if ((it.life -= dt) <= 0) { game.scene.remove(it.root); list.splice(i, 1); continue; }
        const near = Math.abs(it.x - p.x) < 90 && Math.abs(it.z - p.z) < 90; it.root.visible = near; if (!near) continue;
        it.m.rotation.y = t * 1.6 + it.phase; it.m.position.y = .9 + Math.sin(t * 2.4 + it.phase) * .12;
        it.ring.material.opacity = .55 + Math.sin(t * 4 + it.phase) * .25;
        if (!game.over && Math.hypot(it.x - p.x, it.z - p.z) < reach && take(it)) {
          if (it.life !== Infinity) { game.scene.remove(it.root); list.splice(i, 1); }
          else { it.wait = COMBAT.pickupRespawn; it.root.visible = false; }
        }
      }
    },
  };
}
