// Golden tins: forty shiny cans hidden around the map. Rocco can't resist. Walk or drive through them.
import * as THREE from 'three';
import { std } from '../world/materials.js';
import { groundY } from '../world/terrain.js';
import { cash } from './kit.js';

// [x, z, height above the ground]
const SPOTS = [
  // downtown street corners
  [45.5, 45.5], [-99.5, 99.5], [153.5, -153.5], [-153.5, -153.5], [99.5, -8.5], [-45.5, 153.5], [153.5, 153.5], [-116.5, 8.5],
  // promenade, beach and pier
  [0, -310.5, .3], [0, -346], [50, -249], [-112, -267], [-312, -252], [-62, -257], [172, -250], [-148, -229.5], [122, -290],
  // Vista Heights
  [54, 331.5], [27, 351], [-162, 332.5], [-108, 297], [108, 297], [9, 225], [-63, 279],
  // Port Sunset and the bluffs
  [244, -118], [350, -150], [341.5, 72], [221, -81], [300, -30], [346, 285.5], [222, 286, 3.6],
  // Dustlands and High Meadows
  [-243, -108], [-245, 110], [-285, 180], [-200, 27], [-258, 27.5], [-243, -3, 3.4], [-311, -201], [-300, 290.5], [-236, 253],
];

export function createTins(A) {
  const { game, kit, cfg } = A, C = cfg.tins, p = game.player;
  const got = new Set(kit.save.get('tins', []));
  // one draw call for all the cans, one for their glow rings
  const lathe = new THREE.LatheGeometry([[0, 0], [.26, 0], [.3, .04], [.3, .5], [.26, .54], [.22, .56], [0, .56]].map(([x, y]) => new THREE.Vector2(x, y)), 14);
  const gold = std({ color: 0xffc233, metalness: 1, roughness: .22, emissive: 0x7a4a00, emissiveIntensity: .7 });
  const cans = new THREE.InstancedMesh(lathe, gold, SPOTS.length); cans.castShadow = true; cans.frustumCulled = false; game.scene.add(cans);
  const ringGeo = new THREE.RingGeometry(.55, .8, 24); ringGeo.rotateX(-Math.PI / 2);
  const rings = new THREE.InstancedMesh(ringGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd34d).multiplyScalar(1.6), transparent: true, opacity: .7, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), SPOTS.length);
  rings.frustumCulled = false; game.scene.add(rings);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3(), tilt = new THREE.Euler(), hide = new THREE.Matrix4().makeScale(0, 0, 0);
  const tins = SPOTS.map(([x, z, up = 0], i) => {
    const y = groundY(x, z) + up, tin = { i, x, y, z };
    rings.setMatrixAt(i, got.has(i) ? hide : m4.makeTranslation(x, y + .06, z)); cans.setMatrixAt(i, hide);
    kit.blip({ x, z, color: '#ffd34d', size: 3.4, visible: () => !got.has(i) && Math.abs(x - p.x) < 55 && Math.abs(z - p.z) < 55 });
    return tin;
  });

  return {
    progress: () => ['Golden tins', `${got.size}/${SPOTS.length}`],
    update(dt, t) {
      const car = p.vehicle, py = car ? car.y : p.y, reach = car ? 2.9 : 1.5;
      for (const tin of tins) {
        if (got.has(tin.i)) continue;
        const dx = tin.x - p.x, dz = tin.z - p.z;
        if (Math.abs(dx) > 90 || Math.abs(dz) > 90) continue;
        pos.set(tin.x, tin.y + .75 + Math.sin(t * 2.4 + tin.i) * .12, tin.z); q.setFromEuler(tilt.set(.35, t * 2 + tin.i, 0)); cans.setMatrixAt(tin.i, m4.compose(pos, q, scl.setScalar(1.25)));
        if (Math.hypot(dx, dz) < reach && Math.abs(tin.y - py) < 3.2 && !game.over) {
          got.add(tin.i); kit.save.set('tins', [...got]); cans.setMatrixAt(tin.i, hide); rings.setMatrixAt(tin.i, hide); rings.instanceMatrix.needsUpdate = true;
          game.audio.pickup(); game.fx.spark(tin.x, tin.y + .8, tin.z, 10, .8); game.addMoney(C.each);
          if (got.size === SPOTS.length) { game.addMoney(C.all); kit.ui.banner('ALL 40 TINS!', `Rocco's hoard is complete  +${cash(C.all)}`, 'gold', 6); game.audio.evade(); }
          else game.hud.toast(`GOLDEN TIN ${got.size}/${SPOTS.length}  +${cash(C.each)}`, 'good');
        }
      }
      cans.instanceMatrix.needsUpdate = true;
    },
  };
}
