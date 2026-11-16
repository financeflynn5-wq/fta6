// Combat HUD: armor bar, current weapon and ammo, the crosshair, hit markers and the sniper scope.
import { COMBAT } from '../config.js';

const $ = (id) => document.getElementById(id);

export function createWeaponHud(game) {
  const el = { armor: $('armorBar'), weapon: $('weapon'), wname: $('weaponName'), ammo: $('ammo'), cross: $('crosshair'), hit: $('hitmark'), scope: $('scope'), reload: $('reloadBar') };
  let last = '';
  return {
    update() {
      const p = game.player, c = game.combat, w = c.def, onFoot = p.mode === 'foot' && !game.over;
      el.armor.style.width = (p.armor / COMBAT.armor * 100) + '%';
      el.armor.parentElement.style.opacity = p.armor > 0 ? 1 : 0;
      const ammo = w.melee ? '' : `${c.clip[c.weapon] ?? 0}<small>/ ${c.ammo[c.weapon] ?? 0}</small>`;
      const key = w.name + ammo + (c.reloading > 0);
      if (key !== last) { last = key; el.wname.textContent = w.name; el.ammo.innerHTML = c.reloading > 0 ? '<small>RELOADING</small>' : ammo; el.weapon.classList.toggle('empty', !w.melee && !c.totalAmmo()); }
      el.weapon.style.opacity = onFoot ? 1 : .45;
      el.reload.style.width = c.reloading > 0 ? (100 - c.reloading / w.reload * 100) + '%' : '0%';
      // crosshair: only while aiming a gun; it opens up as the gun climbs
      const scoped = onFoot && w.scope && c.aimBlend > .85;
      el.cross.style.opacity = onFoot && !w.melee && c.aiming && !scoped ? Math.min(1, c.aimBlend * 1.4) : 0;
      el.cross.style.setProperty('--gap', (6 + c.bloom * 7 + c.kick * 30) + 'px');
      el.scope.hidden = !scoped;
      el.hit.style.opacity = c.hitT > 0 ? Math.min(1, c.hitT * 6) : 0;
      el.hit.classList.toggle('kill', c.killHit);
    },
  };
}
