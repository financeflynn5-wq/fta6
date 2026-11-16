// Two real lights that follow the action: the player's headlights at night, and the
// red/blue flash of the nearest police car.
import * as THREE from 'three';
import { clamp } from '../core/utils.js';

export function createCarLights(game) {
  const head = new THREE.SpotLight(0xfff0d6, 0, 55, .55, .6, 1.3); game.scene.add(head, head.target);
  const flash = new THREE.PointLight(0xff2030, 0, 34, 1.7); game.scene.add(flash);
  const red = new THREE.Color(0xff2030), blue = new THREE.Color(0x2050ff);
  return {
    update(t) {
      const car = game.player.vehicle, night = clamp((game.env.night - .3) / .4, 0, 1);
      if (car && !car.wrecked && night > 0) {
        head.intensity = 160 * night * (car.dmg ? (car.dmg.head[0] + car.dmg.head[1]) / 2 : 1);      // smashed headlights light less
        const fx = Math.cos(car.ih), fz = Math.sin(car.ih);
        head.position.set(car.ix + fx * 2.3, car.y + .8, car.iz + fz * 2.3);
        head.target.position.set(car.ix + fx * 24, car.y - .5, car.iz + fz * 24);
      } else head.intensity = 0;
      let best = null, bd = 70;
      for (const u of game.police.units) { const d = Math.hypot(u.car.x - game.player.x, u.car.z - game.player.z); if (u.car.siren && d < bd) { bd = d; best = u.car; } }
      if (best) {
        flash.position.set(best.ix, best.y + 2.3, best.iz); flash.color.copy(Math.floor(t * 7) % 2 ? red : blue);
        flash.intensity = 12 + 30 * game.env.night;
      } else flash.intensity = 0;
    },
  };
}
