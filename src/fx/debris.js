// Bits that come off in a crash: small shards of paint, glass and lens (one instanced mesh, one draw
// call), and whole parts such as a torn-off bumper. Looks only: nothing here collides with the cars.
import * as THREE from 'three';
import { DAMAGE } from '../config.js';
import { groundY } from '../world/terrain.js';
import { std } from '../world/materials.js';

const GRAVITY = 19;

export function createDebris(scene) {
  // ---------- shards ----------
  const N = DAMAGE.shards, geo = new THREE.BoxGeometry(1, .09, .6);
  { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) if (p.getX(i) > 0) p.setZ(i, p.getZ(i) * .35); }   // a wedge, not a brick
  geo.computeVertexNormals();
  const im = new THREE.InstancedMesh(geo, std({ color: 0xffffff, roughness: .4, metalness: .45 }), N);
  im.frustumCulled = false; im.castShadow = false; im.receiveShadow = false; im.count = 0; scene.add(im);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pos = new THREE.Vector3(), scl = new THREE.Vector3(), col = new THREE.Color();
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0), items = [];
  for (let i = 0; i < N; i++) { items.push({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0, wx: 0, wy: 0, wz: 0, s: 1, gy: 0, still: false }); im.setMatrixAt(i, hidden); im.setColorAt(i, col.set(0xffffff)); }
  let next = 0, top = 0;

  // ---------- whole parts ----------
  const parts = [], axis = new THREE.Vector3(), dq = new THREE.Quaternion(), flat = new THREE.Quaternion(), fwd = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const drop = (p) => { scene.remove(p.group); p.group.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); };

  return {
    // n shards thrown from a point, mostly along (dx, dz), carrying the car's own speed (vx, vz)
    burst(x, y, z, dx, dz, n, color, size = .14, speed = 5, vx = 0, vz = 0) {
      const gy = groundY(x, z);
      for (let k = 0; k < n; k++) {
        const i = next; next = (next + 1) % N; if (i >= top) { top = i + 1; im.count = top; }
        const p = items[i], a = Math.random() * 6.283, sp = speed * (.35 + Math.random() * .9);
        p.x = x + (Math.random() - .5) * .5; p.y = Math.max(gy + .1, y + (Math.random() - .5) * .5); p.z = z + (Math.random() - .5) * .5;
        p.vx = vx * .7 + dx * sp + Math.cos(a) * sp * .55; p.vz = vz * .7 + dz * sp + Math.sin(a) * sp * .55; p.vy = 1.5 + Math.random() * speed * .8;
        p.rx = Math.random() * 6.283; p.ry = Math.random() * 6.283; p.rz = Math.random() * 6.283;
        p.wx = (Math.random() - .5) * 22; p.wy = (Math.random() - .5) * 22; p.wz = (Math.random() - .5) * 22;
        p.s = size * (.55 + Math.random() * .9); p.life = DAMAGE.shardLife * (.6 + Math.random() * .4); p.gy = gy; p.still = false;
        col.set(color).multiplyScalar(.75 + Math.random() * .4); im.setColorAt(i, col);
      }
      if (n > 0 && im.instanceColor) im.instanceColor.needsUpdate = true;
    },

    // A torn-off part: a group already standing where it left the car. half = how high its middle rests off the ground.
    addPart(group, vx, vy, vz, half = .15) {
      while (parts.length >= DAMAGE.parts) drop(parts.shift());
      scene.add(group);
      parts.push({ group, vx, vy, vz, wx: (Math.random() - .5) * 5, wy: (Math.random() - .5) * 6, wz: (Math.random() - .5) * 5, half, life: DAMAGE.partLife, down: false, still: false });
    },

    update(dt) {
      let dirty = false;
      for (let i = 0; i < top; i++) {
        const p = items[i]; if (p.life <= 0) continue;
        p.life -= dt;
        if (p.life <= 0) { im.setMatrixAt(i, hidden); dirty = true; continue; }
        if (p.still && p.life > .6) continue;
        if (!p.still) {
          p.vy -= GRAVITY * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
          p.rx += p.wx * dt; p.ry += p.wy * dt; p.rz += p.wz * dt;
          if (p.y < p.gy + .03) {
            p.gy = groundY(p.x, p.z); p.y = p.gy + .03;
            if (p.vy > -1.6) { p.still = true; p.rx = 0; p.rz = 0; }             // lies flat where it stopped
            else { p.vy *= -.32; p.vx *= .55; p.vz *= .55; p.wx *= .5; p.wy *= .5; p.wz *= .5; }
          }
        }
        const s = p.s * Math.min(1, p.life / .6);
        pos.set(p.x, p.y, p.z); q.setFromEuler(e.set(p.rx, p.ry, p.rz)); scl.set(s, s, s);
        im.setMatrixAt(i, m4.compose(pos, q, scl)); dirty = true;
      }
      if (dirty) im.instanceMatrix.needsUpdate = true;

      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i], g = p.group; p.life -= dt;
        if (p.life <= 0) { drop(p); parts.splice(i, 1); continue; }
        if (p.life < 1) g.scale.setScalar(Math.max(.001, p.life));
        if (p.still) continue;
        p.vy -= GRAVITY * dt; g.position.x += p.vx * dt; g.position.y += p.vy * dt; g.position.z += p.vz * dt;
        const w = Math.hypot(p.wx, p.wy, p.wz);
        if (w > .01) { dq.setFromAxisAngle(axis.set(p.wx / w, p.wy / w, p.wz / w), w * dt); g.quaternion.premultiply(dq); }
        const gy = groundY(g.position.x, g.position.z) + p.half;
        if (g.position.y < gy) {
          g.position.y = gy; p.down = true;
          p.vy = p.vy < -2.5 ? -p.vy * .28 : 0; p.wx *= .4; p.wz *= .4; p.wy *= .8;
        }
        if (p.down) {                                   // slides to a stop and settles flat
          const k = Math.max(0, 1 - 2.6 * dt); p.vx *= k; p.vz *= k; p.wy *= k; p.wx *= k; p.wz *= k;
          fwd.set(1, 0, 0).applyQuaternion(g.quaternion); flat.setFromAxisAngle(up, Math.atan2(-fwd.z, fwd.x));
          g.quaternion.slerp(flat, 1 - Math.exp(-7 * dt));
          if (p.vy === 0 && Math.hypot(p.vx, p.vz) < .15) { p.still = true; g.quaternion.copy(flat); }
        }
      }
    },
    get partCount() { return parts.length; },
  };
}
