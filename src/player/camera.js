// Third-person camera. Three rigs share one heading (yaw):
//   on foot  - orbits Rocco
//   aiming   - from Rocco's own eye, down the gun's sights or through the scope (sightView.js draws the gun);
//              over his right shoulder for a gun whose model hasn't loaded. Always looks exactly where the mouse points
//   driving  - sits behind the car and looks a little way into the corner
// yaw is the direction the camera looks along the ground (same angle convention as cars).
// pitch is how far it looks down (negative = up).
import * as THREE from 'three';
import { clamp, damp, angleDiff, lerp } from '../core/utils.js';
import { AIM } from '../config.js';
import { groundY } from '../world/city.js';

const HIP_FOV = 42, RAD = Math.PI / 180;
const tanHalf = (fov) => Math.tan(fov * RAD / 2);
const fovForZoom = (zoom) => 2 * Math.atan(tanHalf(HIP_FOV) / zoom) / RAD;

export function createCamera(game) {
  const camera = game.camera;
  let savedSens = AIM.sens;
  try { savedSens = clamp(parseFloat(localStorage.getItem('fta6.sens')) || AIM.sens, .3, 3); } catch { /* storage blocked: use the default */ }

  const aimAt = new THREE.Vector3();

  const cam = {
    yaw: -Math.PI / 2, pitch: .3, dist: 7, fov: HIP_FOV, x: 0, y: 3, z: 0, tx: 0, ty: 1.5, tz: 0, trauma: 0, lookAt: camera.position.clone(),
    sens: savedSens, baseFov: HIP_FOV, lift: 0,
    // aiming
    aimPitch: AIM.level, zoom: AIM.zoom, sh: AIM.shoulder, aimDist: AIM.dist, pull: 0, recoil: 0, recoilGoal: 0,
    origin: new THREE.Vector3(), dir: new THREE.Vector3(1, 0, 0),     // the crosshair ray: where a shot starts and heads (never shaken)

    shake(a) { cam.trauma = Math.min(1, cam.trauma + a); },
    snap() { cam.dist = 0; },
    // A shot lifts the view; it settles back by itself.
    kick(a) { cam.recoilGoal = Math.min(.2, cam.recoilGoal + a * AIM.recoil); cam.yaw += (Math.random() - .5) * a * AIM.recoil * .5; },
    // Start of an aim: level the view, or put the crosshair on `target` ({x, y, z} in the world).
    beginAim(target) {
      const p = game.player; cam.aimPitch = AIM.level; cam.pull = 0; cam.recoil = cam.recoilGoal = 0;
      if (!target) return;
      // the crosshair ray leaves from the shoulder, so aim the shoulder (not Rocco's middle) at the target
      let yaw = Math.atan2(target.z - p.z, target.x - p.x), sx = p.x, sz = p.z;
      for (let i = 0; i < 2; i++) { sx = p.x - Math.sin(yaw) * AIM.shoulder; sz = p.z + Math.cos(yaw) * AIM.shoulder; yaw = Math.atan2(target.z - sz, target.x - sx); }
      cam.pull = angleDiff(yaw, cam.yaw);
      cam.aimPitch = Math.atan2(p.y + AIM.height - target.y, Math.hypot(target.x - sx, target.z - sz));
    },
    setSens(s) {
      cam.sens = clamp(s, .3, 3);
      try { localStorage.setItem('fta6.sens', cam.sens.toFixed(2)); } catch { /* fine */ }
      game.hud?.toast('MOUSE SENSITIVITY ' + Math.round(cam.sens * 100) + '%', 'info');
    },

    update(dt, t) {
      const p = game.player, input = game.input, car = p.vehicle, combat = game.combat, w = combat?.def;
      const aiming = !car && !!combat?.aiming, a = car ? 0 : (combat?.aimBlend || 0);

      // ---- mouse. While aiming it slows down with the zoom, so the picture moves at the same pace under the hand.
      const [mdx, mdy] = input.takeMouse();
      const s = .0026 * cam.sens * (a > 0 ? tanHalf(cam.fov) / tanHalf(HIP_FOV) * lerp(1, AIM.adsSens, a) : 1);
      cam.yaw += mdx * s;
      if (aiming) cam.aimPitch = clamp(cam.aimPitch + mdy * s, -1.2, 1.2);
      else cam.pitch = clamp(cam.pitch + mdy * s * .77, .06, 1.2);
      if (cam.pull) { const step = cam.pull * Math.min(1, dt * 16); cam.yaw += step; cam.pull = aiming && Math.abs(cam.pull - step) > 1e-4 ? cam.pull - step : 0; }
      cam.recoil = damp(cam.recoil, cam.recoilGoal, 45, dt); cam.recoilGoal = damp(cam.recoilGoal, 0, AIM.recoilReturn, dt);

      // ---- the orbit rig (on foot and driving)
      const idle = performance.now() - input.lastMouse > 1200;
      let wantDist, tx, tz, ty, wantFov = HIP_FOV;
      if (car) {
        const h = car.ih, fx = Math.cos(h), fz = Math.sin(h);
        if (idle) {
          // settle behind the car: lean toward where it is actually travelling in a drift,
          // and look a little way into the corner it is turning through
          let dir = h;
          if (car.speed > 4) { const travel = Math.atan2(car.vz, car.vx); dir = h + clamp(angleDiff(car.vf < -1 ? travel + Math.PI : travel, h), -.5, .5) * .45; }
          dir += clamp(car.omega * .12, -.2, .2);
          cam.yaw += angleDiff(dir, cam.yaw) * Math.min(1, dt * (3 + car.speed * .1));
          cam.pitch = damp(cam.pitch, .24, 2, dt);
        }
        const k = clamp(car.speed / 38, 0, 1), big = car.stats.cam ?? 1;      // bigger vehicles are followed from further back and higher
        wantDist = (9.2 + k * 2.4) * big; wantFov = HIP_FOV + k * k * 16;
        tx = car.ix + fx * (1 + k * 2.5); tz = car.iz + fz * (1 + k * 2.5); ty = car.y + 1.7 * big;
      } else {
        if (idle && p.speed > 1 && !p.aiming) cam.yaw += angleDiff(Math.atan2(p.vz, p.vx), cam.yaw) * Math.min(1, dt * 1.1);
        const tall = p.model.userData.big ? clamp((p.model.userData.big.top - 2.1) / .33, 0, 1) : 0;          // a Big Head is followed from a little higher and further back, to see over it
        wantDist = 6.6 + tall * .7; tx = p.ix; tz = p.iz; ty = p.y + 1.55 + tall * .35;
      }
      cam.tx = damp(cam.tx, tx, 14, dt); cam.tz = damp(cam.tz, tz, 14, dt); cam.ty = damp(cam.ty, ty, 10, dt);
      if (Math.hypot(cam.tx - tx, cam.tz - tz) > 30) { cam.tx = tx; cam.tz = tz; }
      // keep buildings from getting between the camera and the action
      // When a wall is close behind, swing the camera up and over instead of into Rocco's face.
      const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);            // forward along the ground is (cy, sy), right is (-sy, cy)
      const free = Math.max(.3, game.physics.probe(cam.tx, cam.tz, -cy, -sy, wantDist + .6) - .6);
      const squeeze = clamp(1 - free / (wantDist * Math.cos(cam.pitch)), 0, 1);
      cam.lift = damp(cam.lift, squeeze, 8, dt);
      const pitch = cam.pitch + (1.25 - cam.pitch) * cam.lift, cp = Math.cos(pitch);
      const allowed = Math.max(2.2, free / cp);
      cam.dist = allowed < cam.dist ? allowed : damp(cam.dist, Math.min(wantDist, allowed), 5, dt);
      cam.baseFov = damp(cam.baseFov, wantFov, 4, dt);
      let x = cam.tx - cy * cp * cam.dist, z = cam.tz - sy * cp * cam.dist, y = cam.ty + Math.sin(pitch) * cam.dist + .4;
      const lx = cam.tx, ly = cam.ty + (car ? .5 : 0), lz = cam.tz;     // what the orbit rig looks at
      let look = Math.atan2(y - ly, Math.hypot(x - lx, z - lz));        // ...and so how far down it looks

      // ---- the aim rig, blended in as the gun comes up
      let fov = cam.baseFov;
      if (a > 0) {
        const scope = !!w?.scope, first = scope || !!combat.view?.has(combat.weapon), pa = cam.aimPitch - cam.recoil, cpa = Math.cos(pa), spa = Math.sin(pa);
        let ax, ay, az, move = a;
        if (first) {          // sights and scopes look from Rocco's eye. The camera gets there early, so the gun can come up in front of it
          ax = p.ix + cy * AIM.eyeAhead; az = p.iz + sy * AIM.eyeAhead; ay = p.y + (p.model.userData.big?.eye ?? AIM.eye); move = 1 - (1 - a) ** 3;
        } else {
          // right shoulder, pulled in when a wall is on that side or behind
          const side = clamp(game.physics.probe(p.ix, p.iz, -sy, cy, AIM.shoulder + .35) - .35, .05, AIM.shoulder);
          cam.sh = side < cam.sh ? side : damp(cam.sh, side, 6, dt);
          const sx = p.ix - sy * cam.sh, sz = p.iz + cy * cam.sh, sY = p.y + AIM.height;
          let d = Math.min(AIM.dist, Math.max(.5, (game.physics.probe(sx, sz, -cy, -sy, AIM.dist * cpa + .45) - .45) / Math.max(cpa, .2)));
          if (spa < 0) d = Math.min(d, Math.max(.5, (sY - groundY(sx - cy * cpa * d, sz - sy * cpa * d) - .3) / -spa));   // looking up: stay above the ground
          cam.aimDist = d < cam.aimDist ? d : damp(cam.aimDist, d, 6, dt);
          ax = sx - cy * cpa * cam.aimDist; az = sz - sy * cpa * cam.aimDist; ay = sY + spa * cam.aimDist;
        }
        x = lerp(x, ax, move); y = lerp(y, ay, move); z = lerp(z, az, move); look = lerp(look, pa, move);
        const zoom = scope ? AIM.scopeZoom[combat.scopeStep] ?? AIM.scopeZoom[0] : w?.zoom || AIM.zoom;
        cam.zoom = damp(cam.zoom, zoom, 14, dt);
        fov = lerp(fov, fovForZoom(cam.zoom), a);
        p.model.visible = !(first && (a > AIM.swap || Math.hypot(x - ax, y - ay, z - az) < 1.8));       // never look at the inside of his hood
      } else {
        cam.sh = AIM.shoulder; cam.aimDist = AIM.dist; cam.zoom = w?.scope ? AIM.scopeZoom[0] : w?.zoom || AIM.zoom;
        if (!car) p.model.visible = true;
      }
      cam.fov = fov;
      if (Math.abs(camera.fov - fov) > .005) { camera.fov = fov; camera.updateProjectionMatrix(); }

      // ---- place the camera. While aiming, shake only moves it and never turns it, so the crosshair stays true.
      const cl = Math.cos(look);
      cam.x = x; cam.y = y; cam.z = z;
      cam.origin.set(x, y, z); cam.dir.set(cy * cl, -Math.sin(look), sy * cl);
      cam.trauma = Math.max(0, cam.trauma - dt * 1.6);
      const sh = cam.trauma * cam.trauma * lerp(.22, .08, a), rumble = car ? clamp((car.speed - 28) / 12, 0, 1) * .007 + (car.sliding ? .006 : 0) : 0;
      const jx = (Math.sin(t * 91) + Math.sin(t * 57.3)) * (sh + rumble), jy = (Math.sin(t * 83.1) + Math.cos(t * 49)) * (sh + rumble);
      camera.position.set(x + jx, y + jy, z + jx * .5);
      cam.lookAt.set(lx, ly, lz);                         // where the action is (the sun's shadows centre on it too)
      if (a > 0) { aimAt.set(camera.position.x + cam.dir.x, camera.position.y + cam.dir.y, camera.position.z + cam.dir.z); camera.lookAt(aimAt); }
      else camera.lookAt(cam.lookAt);
      combat?.view?.update(dt, t, mdx * s, mdy * s);        // the gun in front of the eye, once the camera is where it will be drawn from
    },
  };

  // [ and ] trim the mouse sensitivity; it is remembered on this computer
  window.addEventListener('keydown', (e) => {
    if (game.state !== 'playing' || e.repeat) return;
    if (e.code === 'BracketLeft') cam.setSens(cam.sens / 1.1); else if (e.code === 'BracketRight') cam.setSens(cam.sens * 1.1);
  });
  return cam;
}
