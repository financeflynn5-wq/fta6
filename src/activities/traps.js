// Speed cameras: five of them on the fast roads. Go through one above its limit and it pays you
// for every km/h over (Rocco sells the photos). Each camera needs a rest between shots.
import * as THREE from 'three';
import { mats, std } from '../world/materials.js';
import { groundY } from '../world/terrain.js';
import { cash } from './kit.js';

// [road x, road z, limit km/h, which side the pole stands on (dx, dz)]
const CAMS = [
  [81, -216, 110, 0, -1], [-324, 54, 110, -1, 0], [270, 54, 110, 1, 0], [54, 189, 95, 1, 0], [-81, 216, 105, 0, 1],
];

export function createTraps(A) {
  const { game, kit, cfg } = A, C = cfg.traps, p = game.player;
  const best = kit.save.get('traps', {});
  // two draw calls for all five: the poles, and the yellow camera boxes
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(.09, .11, 4.4, 8), mats.darkMetal, CAMS.length);
  const boxes = new THREE.InstancedMesh(new THREE.BoxGeometry(.75, .55, .5), std({ color: 0xffc928, roughness: .5, emissive: 0x4a3200, emissiveIntensity: .5 }), CAMS.length);
  poles.castShadow = boxes.castShadow = true; poles.frustumCulled = boxes.frustumCulled = false; game.scene.add(poles, boxes);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), v3 = new THREE.Vector3();

  const cams = CAMS.map(([x, z, limit, dx, dz], i) => {
    const px = x + dx * 8.6, pz = z + dz * 8.6, y = groundY(px, pz);
    poles.setMatrixAt(i, m4.makeTranslation(px, y + 2.2, pz));
    boxes.setMatrixAt(i, m4.compose(v3.set(px, y + 4.5, pz), q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, Math.atan2(dx, dz)), one));
    kit.blip({ x, z, color: '#ffffff', glyph: 'S', size: 6, visible: () => !A.busy });
    return { i, x, z, px, pz, y: y + 4.5, limit, peak: 0, rest: 0 };
  });

  return {
    progress: () => ['Speed cameras', `${cams.filter(c => best[c.i] >= c.limit).length}/${cams.length} beaten`],
    update(dt) {
      const car = p.mode === 'car' ? p.vehicle : null;
      for (const c of cams) {
        c.rest -= dt;
        const d = Math.abs(p.x - c.x) + Math.abs(p.z - c.z);
        if (d > 60) { c.peak = 0; continue; }
        if (car && c.rest <= 0 && d < 11 && Math.hypot(p.x - c.x, p.z - c.z) < 9.5) c.peak = Math.max(c.peak, car.speed * 3.6);
        else if (c.peak && d > 12) {
          const kmh = Math.round(c.peak); c.peak = 0;
          if (kmh >= c.limit) {
            const pay = Math.round((kmh - c.limit + 10) * C.perKmh / 10) * 10, old = best[c.i] || 0;
            if (kmh > old) { best[c.i] = kmh; kit.save.set('traps', best); }
            c.rest = C.cooldown; game.addMoney(pay); game.audio.click(); game.audio.cash();
            kit.ui.flash();
            game.hud.toast(`SPEED CAMERA  ${kmh} km/h  +${cash(pay)}${kmh > old && old ? '  NEW BEST' : ''}`, 'good');
          } else if (kmh > c.limit * .6) game.hud.toast(`SPEED CAMERA: ${kmh} OF ${c.limit} km/h`, 'info');
        }
      }
    },
  };
}
