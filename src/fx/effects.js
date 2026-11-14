// Tyre marks, smoke and sparks. Everything is pooled, so effects never allocate mid-game.
import * as THREE from 'three';

export function createEffects(scene) {
  // ---------- tyre marks: a ring buffer of flat quads ----------
  const MAX = 1200, quad = new THREE.PlaneGeometry(1, 1); quad.rotateX(-Math.PI / 2);
  const marks = new THREE.InstancedMesh(quad, new THREE.MeshBasicMaterial({ color: 0x0c0c0e, transparent: true, opacity: .42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), MAX);
  marks.frustumCulled = false; marks.count = 0; scene.add(marks);
  let head = 0; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3(), yAxis = new THREE.Vector3(0, 1, 0);

  // ---------- soft round sprite ----------
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const grad = x.createRadialGradient(32, 32, 2, 32, 32, 31); grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(.5, 'rgba(255,255,255,.45)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = grad; x.fillRect(0, 0, 64, 64);
  const puffTex = new THREE.CanvasTexture(c);

  function pool(n, additive) {
    const items = [];
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, opacity: 0, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
      s.visible = false; scene.add(s); items.push({ s, life: 0, max: 1, vx: 0, vy: 0, vz: 0, size: 1, grow: 0, alpha: 1 });
    }
    let next = 0; return { items, take() { const p = items[next]; next = (next + 1) % n; return p; } };
  }
  const smokes = pool(110, false), sparks = pool(70, true);

  return {
    skid(x1, z1, x2, z2, y) {
      const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
      pos.set((x1 + x2) / 2, y + .03, (z1 + z2) / 2); q.setFromAxisAngle(yAxis, -Math.atan2(dz, dx)); scl.set(len + .1, 1, .24);
      marks.setMatrixAt(head, m4.compose(pos, q, scl)); head = (head + 1) % MAX; marks.count = Math.min(MAX, marks.count + 1); marks.instanceMatrix.needsUpdate = true;
    },
    // shade: 1 = white tyre smoke, 0 = black engine smoke
    smoke(x, y, z, shade, size, life, vx = 0, vz = 0) {
      const p = smokes.take(); p.s.position.set(x, y, z); p.s.visible = true; p.life = p.max = life * (.8 + Math.random() * .4);
      p.vx = vx + (Math.random() - .5) * .8; p.vz = vz + (Math.random() - .5) * .8; p.vy = .8 + Math.random() * .8; p.size = size * (.7 + Math.random() * .5); p.grow = 1.6; p.alpha = .5;
      p.s.material.color.setScalar(shade); p.s.material.rotation = Math.random() * 6.28;
    },
    spark(x, y, z, n = 8, power = 1) {
      for (let i = 0; i < n; i++) {
        const p = sparks.take(), a = Math.random() * 6.28, sp = (2 + Math.random() * 7) * power; p.s.position.set(x, y, z); p.s.visible = true; p.life = p.max = .25 + Math.random() * .35;
        p.vx = Math.cos(a) * sp; p.vz = Math.sin(a) * sp; p.vy = 2 + Math.random() * 5; p.size = .12 + Math.random() * .12; p.grow = -.1; p.alpha = 1;
        p.s.material.color.setRGB(4, 2 + Math.random(), .5);
      }
    },
    update(dt) {
      for (const pl of [smokes, sparks]) for (const p of pl.items) {
        if (p.life <= 0) continue;
        p.life -= dt; if (p.life <= 0) { p.s.visible = false; continue; }
        const k = p.life / p.max;
        p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
        if (pl === sparks) { p.vy -= 20 * dt; if (p.s.position.y < .05) { p.s.position.y = .05; p.vy *= -.4; } } else { p.vx *= 1 - dt; p.vz *= 1 - dt; }
        p.size += p.grow * dt; p.s.scale.setScalar(p.size); p.s.material.opacity = p.alpha * Math.min(1, k * 2);
      }
    },
  };
}
