// Car bowling on the port's north lot: ten giant pins, one run-up, your car is the ball.
import * as THREE from 'three';
import { std } from '../world/materials.js';
import { groundY } from '../world/terrain.js';
import { GROUP } from '../core/physics.js';
import { cash } from './kit.js';

const R = .42, TALL = 2.3;

export function createBowling(A) {
  const { game, kit, cfg, districts: D } = A, C = cfg.bowling, p = game.player, spot = D.spots.bowling, RAPIER = game.physics.RAPIER, world = game.physics.world;

  // one draw call: a lathe-turned pin, white with a red collar painted into the vertex colours
  const prof = [[0, 0], [.3, 0], [.4, .25], [.42, .6], [.36, 1], [.2, 1.4], [.17, 1.62], [.24, 1.86], [.26, 2.04], [.2, 2.22], [0, 2.3]];
  const geo = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 14);
  { const pos = geo.attributes.position, col = new Float32Array(pos.count * 3); for (let i = 0; i < pos.count; i++) { const y = pos.getY(i), red = y > 1.3 && y < 1.7; col.set(red ? [.82, .1, .13] : [1, .98, .94], i * 3); } geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
  const mesh = new THREE.InstancedMesh(geo, std({ vertexColors: true, roughness: .35 }), 10); mesh.castShadow = true; mesh.frustumCulled = false; game.scene.add(mesh);

  const pins = [];
  for (let r = 0; r < 4; r++) for (let k = 0; k <= r; k++) {
    const x = spot.pinsX + (k - r / 2) * 1.5, z = spot.pinsZ - 3.6 + r * 1.3;
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, z).lockRotations().setLinearDamping(1.6));
    world.createCollider(RAPIER.ColliderDesc.ball(R).setMass(25).setFriction(.1).setRestitution(.5).setCollisionGroups(((GROUP.PROP << 16) | 0xffff) >>> 0), body);
    pins.push({ x, z, y: groundY(x, z), body, moved: 0 });
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), axis = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), at = { x: 0, y: 0 }, still = { x: 0, y: 0 };
  let dirty = true, run = null, tidyT = 0;
  function reset() { for (const pin of pins) { at.x = pin.x; at.y = pin.z; pin.body.setTranslation(at, true); pin.body.setLinvel(still, true); pin.moved = 0; } dirty = true; }
  function draw() {
    for (let i = 0; i < 10; i++) {
      const pin = pins[i], t = pin.body.translation(), dx = t.x - pin.x, dz = t.y - pin.z, d = Math.hypot(dx, dz); pin.moved = d;
      // a pin tips over in the direction it was shoved, and is flat once it has gone its own height
      const tip = Math.min(Math.PI / 2, d * 1.4);
      if (d > .01) q.setFromAxisAngle(axis.set(dz / d, 0, -dx / d), tip); else q.identity();
      mesh.setMatrixAt(i, m4.compose(pos.set(t.x, pin.y + Math.sin(tip) * R * .8, t.y), q, one));
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  const count = () => pins.filter(pin => pin.moved > .6).length;
  function stop() { run = null; tidyT = 7; A.end(); }

  const part = {
    abort(msg = 'LANE CLOSED') { if (!run) return; if (msg) game.hud.toast(msg, 'bad'); stop(); },
    progress() { const b = kit.save.get('bowl.best', -1); return ['Car bowling', b < 0 ? 'not tried' : b === 10 ? `strike! ×${kit.save.get('bowl.strikes', 1)}` : `best ${b}/10`]; },
    update(dt) {
      const near = Math.abs(p.x - spot.pinsX) < 150 && Math.abs(p.z - spot.pinsZ) < 150;
      if (near || dirty) { draw(); dirty = false; }
      // stand the pins back up once the lane is empty
      if (!run && tidyT > 0 && (tidyT -= dt) <= 0) { if (Math.hypot(p.x - spot.pinsX, p.z - spot.pinsZ) > 14) reset(); else tidyT = 2; }
      if (!run) return;
      if (A.quitHeld(dt)) return part.abort();
      run.t += dt;
      if (p.mode !== 'car' && !run.hit) return part.abort('NO CAR, NO BALL');
      if (!run.hit) {
        if (pins.some(pin => pin.moved > .25)) { run.hit = true; run.settle = C.settle; game.audio.clank(); }
        else if (run.t > 40) return part.abort('TOO SLOW: LANE CLOSED');
        kit.ui.panel('CAR BOWLING', `${Math.round(p.speed * 3.6)} km/h`, 'Floor it down the lane');
      } else {
        run.settle -= dt; const n = count();
        kit.ui.panel('CAR BOWLING', `${n}`, n === 10 ? 'ALL OF THEM!' : 'pins down');
        if (run.settle <= 0 || n === 10) {
          const pay = n * C.perPin + (n === 10 ? C.strike : 0), best = kit.save.get('bowl.best', -1);
          if (n > best) kit.save.set('bowl.best', n);
          if (n === 10) kit.save.set('bowl.strikes', kit.save.get('bowl.strikes', 0) + 1);
          game.addMoney(pay); game.audio.evade();
          kit.ui.banner(n === 10 ? 'STRIKE!' : n >= 7 ? 'NICE ROLL' : n >= 4 ? 'NOT BAD' : n ? 'GUTTER-ISH' : 'GUTTER BALL', `${n} of 10 pins  +${cash(pay)}`, n === 10 ? 'gold' : n >= 7 ? 'silver' : 'plain', 4);
          stop();
        }
      }
    },
  };

  A.starter({
    x: spot.x, z: spot.z, r: 5, color: 0xff4d6d, glyph: 'B', mode: 'car', name: 'CAR BOWLING',
    info: () => { const b = kit.save.get('bowl.best', -1); return `Ten giant pins at the far end of the lane${b >= 0 ? ` · best ${b}/10` : ''}`; },
    onStart: () => { A.begin(part); reset(); run = { t: 0, hit: false, settle: 0 }; kit.ui.banner('CAR BOWLING', 'One run-up. Hit the pins as hard as you like.', 'go', 2.6); game.audio.star(); },
  });
  return part;
}
