// Glue between the land and the rest of the game: owns the ride system (cars on hills),
// keeps Rocco's feet on the slope, slows him down in the sea, keeps the camera out of
// hillsides, and announces the district you have just entered.
import { RIDE } from '../config.js';
import { damp } from '../core/utils.js';
import { groundY, waterDepth } from './terrain.js';
import { districtAt } from './map.js';
import * as THREE from 'three';
import { createRide } from './ride.js';

export function createWorld(game) {
  game.ride = createRide(game);
  game.markers = [];                 // radar blips anyone can add: { x, z, color, glyph, pin, visible() }
  const vel = { x: 0, y: 0 };
  const fwd = new THREE.Vector3();
  let lift = 0, district = '', districtT = 0, swimT = 0, hazeT = 0;

  return {
    ride: game.ride, district: () => district,

    // before the physics step
    preStep(dt) {
      const p = game.player;
      if (p.mode !== 'foot') return;
      const depth = waterDepth(p.x, p.z);
      p.swimming = depth > RIDE.wadeDepth;
      if (p.swimming) { const v = p.body.linvel(), k = RIDE.wadeSpeed + (1 - RIDE.wadeSpeed) * Math.max(0, 1 - (depth - RIDE.wadeDepth) * 3); vel.x = v.x * k; vel.y = v.y * k; p.body.setLinvel(vel, true); }
    },

    // after the physics step: on a slope Rocco's height follows the ground exactly (only kerbs are eased)
    postStep() {
      const p = game.player;
      if (p.mode === 'foot') { const g = groundY(p.x, p.z); if (p.y < g - .12) p.y = g - .12; else if (p.y > g + .35) p.y = g + .35; }
      for (const o of game.police.officers) { const g = groundY(o.ped.x, o.ped.z); if (o.ped.y < g - .12) o.ped.y = g - .12; else if (o.ped.y > g + .35) o.ped.y = g + .35; }
    },

    // once per frame, right after the camera has moved
    update(dt, t) {
      const cam = game.camera, p = game.player;
      if (game.state !== 'title') {
        const need = groundY(cam.position.x, cam.position.z) + .7 - cam.position.y;
        lift = need > lift ? need : damp(lift, Math.max(0, need), 5, dt);
        if (lift > .01) { cam.position.y += lift; cam.lookAt(game.cam.lookAt); }
      }
      // scenery the haze has swallowed isn't drawn: nothing shows past the far edge of the fog
      if ((hazeT -= dt) <= 0 && game.scene.fog) {
        hazeT = .2; cam.getWorldDirection(fwd); const far = game.scene.fog.far + 6, c = cam.position;
        for (const m of game.city.welded) { const s = m.geometry.boundingSphere.center; m.visible = (s.x - c.x) * fwd.x + (s.y - c.y) * fwd.y + (s.z - c.z) * fwd.z - m.geometry.boundingSphere.radius < far; }
      }
      for (const f of game.city.districts.animated) f(dt, t);
      // splashes while wading
      if (p.mode === 'foot' && p.swimming && p.speed > 1 && (swimT -= dt) <= 0) { swimT = .22; game.fx.smoke(p.x, p.y + 1.15, p.z, 1, .7, .45); }
      // "now entering" banner
      if ((districtT -= dt) <= 0) {
        districtT = .5;
        const d = districtAt(p.x, p.z);
        if (d !== district) { if (district && game.state === 'playing' && !game.over) game.hud.toast(d, 'place'); district = d; }
      }
    },
  };
}
