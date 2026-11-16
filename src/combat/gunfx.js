// Bullet tracers and muzzle flashes, pooled so firing never allocates.
import * as THREE from 'three';

export function createGunFx(scene) {
  // tracers: thin glowing boxes stretched from muzzle to impact
  const tracerGeo = new THREE.BoxGeometry(1, 1, 1); tracerGeo.translate(0, 0, .5);
  const tracers = [];
  for (let i = 0; i < 40; i++) {
    const m = new THREE.Mesh(tracerGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3, 1.4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    m.visible = false; m.frustumCulled = false; scene.add(m); tracers.push({ m, life: 0, max: 1 });
  }
  let nt = 0;

  // muzzle flash: a star sprite plus one shared warm light
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 2, 64, 64, 60); g.addColorStop(0, 'rgba(255,255,230,1)'); g.addColorStop(.25, 'rgba(255,200,90,.9)'); g.addColorStop(1, 'rgba(255,120,20,0)');
  x.fillStyle = g; x.beginPath();
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, r = i % 2 ? 22 : 62; x.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); }
  x.fill();
  const flashTex = new THREE.CanvasTexture(c); flashTex.colorSpace = THREE.SRGBColorSpace;
  const flashes = [];
  for (let i = 0; i < 8; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, color: new THREE.Color(2.5, 2, 1.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    s.visible = false; scene.add(s); flashes.push({ s, life: 0 });
  }
  let nf = 0;
  const light = new THREE.PointLight(0xffb45a, 0, 9, 2); scene.add(light); let lightLife = 0;
  const dir = new THREE.Vector3(), zAxis = new THREE.Vector3(0, 0, 1);

  return {
    tracer(ax, ay, az, bx, by, bz, width = .02, life = .05) {
      const len = Math.hypot(bx - ax, by - ay, bz - az); if (len < .3) return;
      const t = tracers[nt]; nt = (nt + 1) % tracers.length;
      // start a little down the barrel's path so it reads as a streak, not a laser
      const k = Math.min(.15, 1.2 / len);
      t.m.position.set(ax + (bx - ax) * k, ay + (by - ay) * k, az + (bz - az) * k);
      dir.set(bx - ax, by - ay, bz - az).normalize(); t.m.quaternion.setFromUnitVectors(zAxis, dir);
      t.m.scale.set(width, width, len * (1 - k)); t.m.visible = true; t.life = t.max = life; t.m.material.opacity = 1;
    },
    flash(x, y, z, size = .5) {
      const f = flashes[nf]; nf = (nf + 1) % flashes.length;
      f.s.position.set(x, y, z); f.s.scale.setScalar(size * (.8 + Math.random() * .5)); f.s.material.rotation = Math.random() * 6.28; f.s.visible = true; f.life = .045;
      light.position.set(x, y, z); light.intensity = 14 * size; lightLife = .05;
    },
    update(dt) {
      for (const t of tracers) { if (t.life <= 0) continue; t.life -= dt; if (t.life <= 0) { t.m.visible = false; continue; } t.m.material.opacity = t.life / t.max; }
      for (const f of flashes) { if (f.life <= 0) continue; f.life -= dt; if (f.life <= 0) f.s.visible = false; }
      if (lightLife > 0 && (lightLife -= dt) <= 0) light.intensity = 0;
    },
  };
}
