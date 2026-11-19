// Foam on the sea: the churned trail behind a boat, the ring a helicopter's rotor beats flat.
// Every patch is one flat card lying on the water, all in a single mesh. A patch spreads and fades by itself.
import * as THREE from 'three';
import { WATER } from '../world/map.js';

const MAX = 420;

export function createWake(game) {
  // a soft-edged blotch of foam
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  let s = 99; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 70; i++) {
    const a = r() * 6.28, d = r() * 34, R = 10 + r() * 22, g = x.createRadialGradient(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 0, 64 + Math.cos(a) * d, 64 + Math.sin(a) * d, R);
    g.addColorStop(0, `rgba(255,255,255,${.1 + r() * .16})`); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const pos = new Float32Array(MAX * 12), col = new Float32Array(MAX * 16), uv = new Float32Array(MAX * 8), idx = new Uint16Array(MAX * 6);
  for (let i = 0; i < MAX; i++) { uv.set([0, 0, 1, 0, 1, 1, 0, 1], i * 8); idx.set([i * 4, i * 4 + 2, i * 4 + 1, i * 4, i * 4 + 3, i * 4 + 2], i * 6); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 4)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 300), 1e5);
  const mat = new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat); mesh.renderOrder = 1; mesh.frustumCulled = false; mesh.userData.noAO = true; game.scene.add(mesh);
  // x, z, size, turn, age, life, spread per second, strength, drift x, drift z
  const P = new Float32Array(MAX * 10); let next = 0, live = 0;

  return {
    // one patch of foam at (x, z): size metres across, lasting life seconds, growing by grow metres a second
    foam(x, z, size = 1.2, life = 2.5, grow = .8, strength = 1, vx = 0, vz = 0) {
      const o = next * 10; next = (next + 1) % MAX;
      P[o] = x; P[o + 1] = z; P[o + 2] = size; P[o + 3] = Math.random() * 6.28; P[o + 4] = 0; P[o + 5] = life; P[o + 6] = grow; P[o + 7] = strength; P[o + 8] = vx; P[o + 9] = vz;
    },
    update(dt) {
      const light = 1 - .78 * Math.max(0, game.env?.night ?? 0), y = WATER + .035; let n = 0;
      for (let i = 0; i < MAX; i++) {
        const o = i * 10; if (P[o + 5] <= 0) continue;
        const age = (P[o + 4] += dt), life = P[o + 5];
        if (age >= life) { P[o + 5] = 0; continue; }
        P[o] += P[o + 8] * dt; P[o + 1] += P[o + 9] * dt; P[o + 8] *= 1 - 1.5 * dt; P[o + 9] *= 1 - 1.5 * dt;
        const k = age / life, hs = (P[o + 2] + P[o + 6] * age) / 2, a = P[o + 3], ca = Math.cos(a) * hs, sa = Math.sin(a) * hs;
        const alpha = P[o + 7] * Math.min(1, age * 8) * (1 - k) * (1 - k), q = n * 12, cq = n * 16, cx = P[o], cz = P[o + 1];
        pos[q] = cx - ca + sa; pos[q + 1] = y; pos[q + 2] = cz - sa - ca; pos[q + 3] = cx + ca + sa; pos[q + 4] = y; pos[q + 5] = cz + sa - ca;
        pos[q + 6] = cx + ca - sa; pos[q + 7] = y; pos[q + 8] = cz + sa + ca; pos[q + 9] = cx - ca - sa; pos[q + 10] = y; pos[q + 11] = cz - sa + ca;
        for (let v = 0; v < 4; v++) { col[cq + v * 4] = col[cq + v * 4 + 1] = col[cq + v * 4 + 2] = light; col[cq + v * 4 + 3] = alpha; }
        n++;
      }
      if (n || live) { geo.setDrawRange(0, n * 6); geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true; }
      live = n; mesh.visible = n > 0;
    },
  };
}
