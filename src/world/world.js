// Glue between the land and the rest of the game: owns the ride system (cars on hills),
// keeps Rocco's feet on the slope, slows him down in the sea, keeps the camera out of
// hillsides, and announces the district you have just entered.
import { RIDE, WORLD, BOAT, VIEW } from '../config.js';
import { damp, clamp } from '../core/utils.js';
import { groundY, waterDepth, layer, ceilingY } from './terrain.js';
import { districtAt } from './map.js';
import * as THREE from 'three';
import { createRide } from './ride.js';

export function createWorld(game) {
  game.ride = createRide(game);
  game.markers = [];                 // radar blips anyone can add: { x, z, color, glyph, pin, visible() }
  const vel = { x: 0, y: 0 };
  const fwd = new THREE.Vector3();
  let lift = 0, district = '', districtT = 0, swimT = 0, hazeT = 0;
  let hollows = null;
  const below = { top: 0, wall: false, vague: false }, ROUND = [[9, 0], [-9, 0], [0, 9], [0, -9]];

  // How far in front of the lens the picture starts. Close to things it has to be tight (VIEW.near), or a wall beside
  // the camera would be cut open. But the depth buffer tells far-off surfaces apart about `near` times better for every
  // time further out it sits: from a helicopter, with nothing near the lens, pushing it out is what stops distant
  // windows, road edges and shorelines flickering against the surface behind them.
  function nearPlane(cam, p) {
    const c = cam.position; let room = 0;
    if (game.state === 'title' || !game.combat?.aiming) {
      // clear air under and around the camera: over the ground (here and round about), any roof below, and the trees and poles standing on them
      let floor = groundY(c.x, c.z, c.y);
      for (const [dx, dz] of ROUND) floor = Math.max(floor, groundY(c.x + dx, c.z + dz, c.y));
      game.physics.under(c.x, c.z, VIEW.side, c.y - 1, below);
      let top = below.top, wall = below.wall;
      if (below.vague) {
        // the walls of a walk-in building carry no height of their own: the building's outline does
        let known = false;
        for (const b of (hollows ||= game.city.solids.boxes.filter(b => b.hollow && b.h !== undefined))) {
          if (Math.abs(c.x - b.x) > b.hw + VIEW.side || Math.abs(c.z - b.z) > b.hd + VIEW.side) continue;
          known = true; if (b.h > c.y - 1) wall = true; else top = Math.max(top, b.h);
        }
        if (!known) top = Math.max(top, floor + VIEW.unknown);
      }
      if (!wall) room = c.y - Math.max(floor + VIEW.clutter, top + 2);
      // and never past whatever it is following (a helicopter is a big thing to have just in front of the lens)
      if (game.state !== 'title') { const v = p.vehicle; room = Math.min(room, (Math.hypot(c.x - p.x, c.y - (v ? v.y : p.y) - 1, c.z - p.z) - (v ? Math.max(v.halfLen, 5) + 1 : 1.5)) * 2); }
    }
    const near = clamp(room * VIEW.perMetre, VIEW.near, VIEW.nearMax);
    if (Math.abs(near - cam.near) > cam.near * .02) { cam.near = near; cam.updateProjectionMatrix(); }
  }

  return {
    ride: game.ride, district: () => district,

    // before the physics step
    preStep(dt) {
      const p = game.player;
      if (p.mode !== 'foot' || p.sky) return;
      const depth = waterDepth(p.x, p.z);
      p.swimming = depth > RIDE.wadeDepth;
      if (p.swimming) { const v = p.body.linvel(), k = RIDE.wadeSpeed + (1 - RIDE.wadeSpeed) * Math.max(0, 1 - (depth - RIDE.wadeDepth) * 3); vel.x = v.x * k; vel.y = v.y * k; p.body.setLinvel(vel, true); }
      // The edge of the world. The walls there don't hold the player (a boat can take you past them, and you may have to
      // wade back), so here: on dry land you can't walk out past the edge, and in the sea not past where the boats turn back.
      const L = WORLD.LIMIT, out = depth > .3 ? BOAT.limit + 6 : 0;
      if (p.x < -L - out || p.x > L + out || p.z < -L - out || p.z > WORLD.LIMIT_N + out) {
        const v = p.body.linvel(); vel.x = v.x; vel.y = v.y;
        if (p.x < -L - out) vel.x = Math.max(vel.x, 1.5); if (p.x > L + out) vel.x = Math.min(vel.x, -1.5);
        if (p.z < -L - out) vel.y = Math.max(vel.y, 1.5); if (p.z > WORLD.LIMIT_N + out) vel.y = Math.min(vel.y, -1.5);
        p.body.setLinvel(vel, true);
      }
    },

    // after the physics step: on a slope Rocco's height follows the ground exactly (only kerbs are eased)
    postStep() {
      const p = game.player;
      // Passing your own height to groundY is what lets you stand on a bridge or a roof instead of under it.
      if (p.sky || p.high) { /* in the air or up on a roof: player/skydive.js keeps his height */ }
      else if (p.mode === 'foot') {
        const g = groundY(p.x, p.z, p.y); if (p.y < g - .12) p.y = g - .12; else if (p.y > g + .35) p.y = g + .35;
        if (layer.up !== !!p.up) { p.up = layer.up; game.physics.setPersonUp(p.body, p.up); }
      } else { p.y = p.vehicle.y; p.up = !!p.vehicle.up; }       // so he steps out at the car's height
      for (const o of game.police.officers) {
        const g = groundY(o.ped.x, o.ped.z, o.ped.y); if (o.ped.y < g - .12) o.ped.y = g - .12; else if (o.ped.y > g + .35) o.ped.y = g + .35;
        if (layer.up !== !!o.up) { o.up = layer.up; game.physics.setPersonUp(o.body, o.up); }
      }
      game.physics.eyeY = p.y + 1.6;
    },

    // once per frame, right after the camera has moved
    update(dt, t) {
      const cam = game.camera, p = game.player;
      if (game.state !== 'title') {
        const need = groundY(cam.position.x, cam.position.z, p.y + 1) + .7 - cam.position.y;
        lift = need > lift ? need : damp(lift, Math.max(0, need), 5, dt);
        if (lift > .01) { cam.position.y += lift; cam.lookAt(game.cam.lookAt); }
        // under a bridge the camera stays under it too
        const roof = ceilingY(cam.position.x, cam.position.z, p.y + 1) - .5;
        if (cam.position.y > roof && !game.combat?.aiming) { cam.position.y = Math.max(roof, p.y + 1.2); cam.lookAt(game.cam.lookAt); }
      }
      // from a helicopter you see further: the haze thins as the camera climbs
      if (game.scene.fog && game.env?.fogFar) { const up = Math.min(230, Math.max(0, cam.position.y - 14)), fog = game.scene.fog; fog.near = game.env.fogNear + up * 1.2; fog.far = game.env.fogFar + up * 3.2; }
      nearPlane(cam, p);
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
