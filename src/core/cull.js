// Whole things, not their parts. A car is five meshes and a person is twenty joints; every frame the renderer used to
// work out where each of those was and then test each mesh against the view, for every car and person on the map,
// including the ones behind you and the ones lost in the haze. This looks at each thing once, as one ball: if neither
// it nor its shadow can be on screen it sits the frame out completely (no joint maths, no tests, no shadow drawing).
// Nothing you can see changes: a thing is only skipped when no pixel of it or of its shadow could be drawn.
import * as THREE from 'three';

const frustum = new THREE.Frustum(), m4 = new THREE.Matrix4(), ball = new THREE.Sphere(), c = new THREE.Vector3();
const fwd = new THREE.Vector3(), sunDir = new THREE.Vector3(), lx = new THREE.Vector3(), ly = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
const REFRESH = 120;         // frames between re-measuring a thing that is in play (models get swapped, riders get on)

export function createCuller(scene, camera) {
  const known = new WeakMap(), hid = [], paused = [];
  let frame = 0, serial = 0;
  const cull = {
    on: true,          // false: draw everything, as before (for comparing)
    keep: null,        // keep(): one thing never skipped (the player: game code reads where his gun is)
    ground: null,      // ground(x, z): how high the land is (a shadow is followed down to it)
    stats: { roots: 0, hidden: 0, culled: 0, shadowOnly: 0 },

    // How big is this thing, as a ball centred `y` above its origin? null: leave it to the renderer (see the reasons below).
    measure(root) {
      let ok = true, meshes = 0, cast = false, lo = Infinity, hi = -Infinity, wide = 0;
      root.updateMatrixWorld(true);
      const e = root.matrixWorld.elements, ox = e[12], oy = e[13], oz = e[14];
      root.traverse(o => {
        if (!ok) return;
        // lights must keep shining from off screen; effects and batches draw far from their own origin
        if (o.isLight || o.isCamera || o.isInstancedMesh || o.isPoints || o.isLine || o.isSprite || o.userData.noCull || (o.isMesh && (!o.frustumCulled || o.material.isShaderMaterial))) { ok = false; return; }
        if (!o.isMesh) return;
        const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere();
        const s = g.boundingSphere, r = s.radius * o.matrixWorld.getMaxScaleOnAxis();
        if (!(r >= 0) || !isFinite(r)) { ok = false; return; }
        c.copy(s.center).applyMatrix4(o.matrixWorld);
        meshes++; cast ||= o.castShadow;
        lo = Math.min(lo, c.y - r - oy); hi = Math.max(hi, c.y + r - oy); wide = Math.max(wide, Math.hypot(c.x - ox, c.z - oz) + r);
      });
      if (!ok || !meshes) return null;
      return { y: (lo + hi) / 2, r: Math.hypot(wide, (hi - lo) / 2) * 1.15 + 1, cast };
    },

    // Before the frame is drawn: decide who sits it out. `sun` is the light that casts the shadows.
    before(sun) {
      frame++;
      if (!cull.on) return;
      camera.updateMatrixWorld();
      frustum.setFromProjectionMatrix(m4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      camera.getWorldDirection(fwd);
      const eye = camera.position, far = scene.fog ? scene.fog.far + 6 : Infinity, st = cull.stats;
      let box = 0;
      if (sun?.castShadow) {
        sunDir.copy(sun.position).sub(sun.target.position).normalize();
        lx.crossVectors(UP, sunDir).normalize(); ly.crossVectors(sunDir, lx).normalize();
        const sc = sun.shadow.camera; box = Math.max(sc.right, sc.top);
      }
      st.roots = st.hidden = st.culled = st.shadowOnly = 0;
      const kids = scene.children;
      for (let i = 0; i < kids.length; i++) {
        const root = kids[i];
        if (!root.isGroup || root === cull.keep?.()) continue;
        if (!root.visible) { if (root.matrixWorldAutoUpdate) { root.matrixWorldAutoUpdate = false; paused.push(root); } st.hidden++; continue; }       // hidden by the game: its joints can rest too
        let k = known.get(root);
        if (!k) known.set(root, k = { size: undefined, at: (serial++ % REFRESH), kids: -1 });
        if (k.size === undefined || (frame + k.at) % REFRESH === 0 || k.kids !== root.children.length) { k.size = cull.measure(root); k.kids = root.children.length; }
        const size = k.size; if (!size) continue;
        st.roots++;
        const p = root.position, s = Math.max(root.scale.x, root.scale.y, root.scale.z), r = size.r * s;
        c.set(p.x, p.y + size.y * s, p.z);
        let keep = false;
        const depth = (c.x - eye.x) * fwd.x + (c.y - eye.y) * fwd.y + (c.z - eye.z) * fwd.z;
        if (depth - r < far) {          // past the far edge of the haze nothing shows at all (world.js does the same for scenery)
          ball.center.copy(c); ball.radius = r;
          if (frustum.intersectsSphere(ball)) keep = true;
          else if (box && size.cast) {
            // Off screen, but its shadow may not be: follow the shadow down the sunlight to the ground and see if that crosses the view.
            const t = sun.target.position, dx = c.x - t.x, dy = c.y - t.y, dz = c.z - t.z;
            if (Math.abs(dx * lx.x + dy * lx.y + dz * lx.z) < box + r && Math.abs(dx * ly.x + dy * ly.y + dz * ly.z) < box + r) {
              let floor = cull.ground ? cull.ground(c.x, c.z) - 3 : -3;
              let len = Math.max(0, (c.y + r - floor) / sunDir.y);
              if (cull.ground && len > 30) { floor = Math.min(floor, cull.ground(c.x - sunDir.x * len, c.z - sunDir.z * len) - 3); len = Math.max(0, (c.y + r - floor) / sunDir.y); }
              const step = Math.max(r, 4), n = Math.ceil(len / step);
              ball.radius = r + step * .5 + 1;
              for (let j = 1; j <= n && !keep; j++) { ball.center.copy(c).addScaledVector(sunDir, -j * step); keep = frustum.intersectsSphere(ball); }
              if (keep) st.shadowOnly++;
            }
          }
        }
        if (!keep) { root.visible = false; root.matrixWorldAutoUpdate = false; hid.push(root); st.culled++; }
      }
    },
    // once every joint that is in the frame has been placed: the rest may be asked for again by game code at any time
    placed() { for (const o of hid) o.matrixWorldAutoUpdate = true; for (const o of paused) o.matrixWorldAutoUpdate = true; paused.length = 0; },
    // after the frame is drawn: everything is as the game left it
    after() { for (const o of hid) o.visible = true; hid.length = 0; },
  };
  return cull;
}
