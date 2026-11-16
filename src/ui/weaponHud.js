// Combat HUD: armor bar, current weapon and ammo, the crosshair, hit markers and the sniper scope.
import { COMBAT, AIM } from '../config.js';

const $ = (id) => document.getElementById(id);

export function createWeaponHud(game) {
  const el = { armor: $('armorBar'), weapon: $('weapon'), wname: $('weaponName'), ammo: $('ammo'), cross: $('crosshair'), hit: $('hitmark'), scope: $('scope'), reload: $('reloadBar') };
  // the scope fades in over the last part of the aim; it shows its magnification in the corner
  el.scope.hidden = false; el.scope.style.opacity = 0;
  const zoom = document.createElement('b'); el.scope.append(document.createElement('i'), zoom);
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
      // crosshair: only while aiming a gun. Its arms sit on the edge of the cone the shots land in,
      // so what it shows is what you get; it turns red over somebody you can hit.
      const scope = onFoot && w.scope ? Math.min(1, Math.max(0, (c.aimBlend - .55) / .3)) : 0;
      el.cross.style.opacity = onFoot && !w.melee && c.aiming && !w.scope ? Math.min(1, c.aimBlend * 1.4) : 0;
      const gap = Math.tan(c.spread) / Math.tan(game.camera.fov * Math.PI / 360) * innerHeight / 2;
      el.cross.style.setProperty('--gap', Math.max(4, gap + c.kick * 22).toFixed(1) + 'px');
      el.cross.classList.toggle('hot', c.onTarget);
      el.scope.style.opacity = scope; el.scope.classList.toggle('hot', c.onTarget);
      if (scope) { const z = AIM.scopeZoom[c.scopeStep] + '×'; if (zoom.textContent !== z) zoom.textContent = z; }
      el.hit.style.opacity = c.hitT > 0 ? Math.min(1, c.hitT * 6) : 0;
      el.hit.classList.toggle('kill', c.killHit);
    },
  };
}
