// Third-person camera: orbits Rocco on foot, sits behind the car when driving.
// yaw is the direction the camera looks along the ground (same angle convention as cars).
import { clamp, damp, angleDiff, lerp } from '../core/utils.js';

export function createCamera(game) {
  const camera = game.camera;
  const cam = {
    yaw: -Math.PI / 2, pitch: .3, dist: 7, fov: 42, x: 0, y: 3, z: 0, tx: 0, ty: 1.5, tz: 0, trauma: 0, lookAt: camera.position.clone(),
    shake(a) { cam.trauma = Math.min(1, cam.trauma + a); },
    snap() { cam.dist = 0; },
    update(dt, t) {
      const p = game.player, input = game.input, car = p.vehicle;
      const [mdx, mdy] = input.takeMouse();
      // aiming: over Rocco's right shoulder, mouse slows down with the zoom, and you can look up
      const combat = game.combat, aim = car ? 0 : (combat?.aimBlend || 0), w = combat?.def;
      const sens = cam.fov / 42;
      cam.yaw += mdx * .0026 * sens; cam.pitch = clamp(cam.pitch + mdy * .002 * sens, lerp(.06, -.5, aim), 1.2);
      if (combat?.aiming && (cam.aimT = (cam.aimT || 0) + dt) < .3) cam.pitch = damp(cam.pitch, .1, 9, dt);   // level the view as the gun comes up
      if (!combat?.aiming) cam.aimT = 0;
      const idle = performance.now() - input.lastMouse > 1400;
      let wantDist, height, tx, tz, ty, wantFov = 42;
      if (car) {
        // settle behind the car; lean toward where it is actually travelling when drifting
        if (idle) {
          let dir = car.h;
          if (car.speed > 4) { const travel = Math.atan2(car.vz, car.vx); dir = car.h + clamp(angleDiff(car.vf < -1 ? travel + Math.PI : travel, car.h), -.5, .5) * .45; }
          if (car.vf < -2.5) dir += 0;      // keep the view steady in reverse
          cam.yaw += angleDiff(dir, cam.yaw) * Math.min(1, dt * (2.2 + car.speed * .09));
          cam.pitch = damp(cam.pitch, .24, 2, dt);
        }
        const s = clamp(car.speed / 38, 0, 1);
        wantDist = 9.2 + s * 2.4; height = 1.7; wantFov = 42 + s * s * 16;
        tx = car.x + car.fx * (1 + s * 2.5); tz = car.z + car.fz * (1 + s * 2.5); ty = car.y + height;
      } else {
        if (idle && p.speed > 1 && !p.aiming) cam.yaw += angleDiff(Math.atan2(p.vz, p.vx), cam.yaw) * Math.min(1, dt * 1.1);
        const sh = aim * 1.2;   // shoulder offset to the right
        wantDist = lerp(6.6, 3.9, aim); tx = p.x - Math.sin(cam.yaw) * sh; tz = p.z + Math.cos(cam.yaw) * sh; ty = p.y + 1.55 + aim * .3;
        wantFov = lerp(42, w?.scope ? 42 / w.scope * 2 : 34, aim);
      }
      cam.tx = damp(cam.tx, tx, 14, dt); cam.tz = damp(cam.tz, tz, 14, dt); cam.ty = damp(cam.ty, ty, 10, dt);
      if (Math.hypot(cam.tx - tx, cam.tz - tz) > 30) { cam.tx = tx; cam.tz = tz; }
      // keep buildings from getting between the camera and the action
      // When a wall is close behind, swing the camera up and over instead of into Rocco's face.
      const dx = -Math.cos(cam.yaw), dz = -Math.sin(cam.yaw);
      const free = Math.max(.3, game.physics.probe(cam.tx, cam.tz, dx, dz, wantDist + .6) - .6);
      const squeeze = clamp(1 - free / (wantDist * Math.cos(cam.pitch)), 0, 1);
      cam.lift = damp(cam.lift || 0, squeeze, 8, dt);
      const pitch = cam.pitch + (1.25 - cam.pitch) * cam.lift, cp = Math.cos(pitch);
      const allowed = Math.max(2.2, free / cp);
      cam.dist = allowed < cam.dist ? allowed : damp(cam.dist, Math.min(wantDist, allowed), 5, dt);
      cam.fov = damp(cam.fov, wantFov, aim > .01 ? 14 : 4, dt);
      if (Math.abs(camera.fov - cam.fov) > .01) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }

      cam.trauma = Math.max(0, cam.trauma - dt * 1.6);
      const sh = cam.trauma * cam.trauma, rumble = car ? clamp((car.speed - 26) / 14, 0, 1) * .02 + (car.sliding ? .012 : 0) : 0;
      const jx = (Math.sin(t * 91) + Math.sin(t * 57.3)) * (sh * .22 + rumble), jy = (Math.sin(t * 83.1) + Math.cos(t * 49)) * (sh * .22 + rumble);
      cam.x = cam.tx + dx * cp * cam.dist; cam.z = cam.tz + dz * cp * cam.dist; cam.y = cam.ty + Math.sin(pitch) * cam.dist + .4;
      camera.position.set(cam.x + jx, cam.y + jy, cam.z + jx * .5);
      cam.lookAt.set(cam.tx, lerp(cam.ty, cam.ty + .5, car ? 1 : 0), cam.tz);
      camera.lookAt(cam.lookAt);
    },
  };
  return cam;
}
