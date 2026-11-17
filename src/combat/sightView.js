// The view down the sights. While Rocco aims, the camera sits at his eye and this file draws the
// gun he is holding in front of it, lined up so the gun's own sights sit on the middle of the
// screen: the pistol's notch and post, the SMG's red dot, the bead on the shotgun's rib and the
// burst rifle's optic. (The sniper keeps its full-screen scope, drawn by the HUD.)
//
// The gun is drawn in a small scene of its own, on top of the finished picture of the world, so
// it never pokes through a wall, and through a camera of its own that can see things a couple of
// centimetres from the eye (the world camera can't see anything closer than 30 cm).
import * as THREE from 'three';
import { Pass } from 'three/addons/postprocessing/Pass.js';
import { WEAPONS, AIM } from '../config.js';
import { clamp, damp, lerp } from '../core/utils.js';
import { std } from '../world/materials.js';
import { weaponCopy } from './weaponModels.js';

// Measured on Flynn's models, in each model's own units (barrel along +Z, up +Y, the shooter's right is -X).
//   rear, front : two points on the gun's own sight line. The eye sits `eye` metres behind `rear`, looking at `front`.
//   hands       : where the right and left paw hold it
//   glass / reticle / bead : meshes in the model that become clear glass / a lit aiming mark
//   dots        : night-sight dots, as [x, y, z] on the part named first, with their radius last
//   hole        : an eyepiece to look through: [x, y, z, radius]. The model's optic is solid, so the view cuts a window in it.
//   slide / pump: a part that moves when the gun fires: [mesh name, travel along the barrel, seconds, delay]
export const SIGHTS = {
  pistol:  { rear: [0, .3316, -.242], front: [0, .3306, .38], eye: .5, hands: [[0, -.1, -.33], [.085, -.2, -.27]], slide: ['Pistol_Slide', -.1, .11, 0],
             dots: ['Pistol_Slide', [-.019, .3205, -.2668], [.019, .3205, -.2668], [0, .3205, .3652], .0047] },
  smg:     { rear: [-.021, .4736, -.011], front: [-.021, .4736, .6], eye: .27, hands: [[-.021, -.14, -.34], [-.021, -.06, .64]], glass: 'SMG_Lens', reticle: 'SMG_Reticle' },
  shotgun: { rear: [-.0203, .304, -.6], front: [-.0203, .2935, 1.99], eye: .12, hands: [[-.02, -.07, -.72], [-.02, -.04, .7]], bead: 'Shotgun_Glow', pump: ['Shotgun_Pump', -.3, .42, .16] },
  burst:   { rear: [-.0163, .365, -.438], front: [-.0163, .365, .24], eye: .17, hands: [[-.012, -.2, -.12], [-.012, -.07, .46]], hole: [-.0163, .365, -.444, .0395], hide: 'Burst_Lens' },
};

const Y = new THREE.Vector3(0, 1, 0), AHEAD = new THREE.Vector3(0, 0, -1);
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);

// ---------- the parts that are not in the model ----------
const glow = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), toneMapped: false });
const glassMat = new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: .05, depthWrite: false });
const dotMat = glow(.5, 1.25, .55);                                             // the soft green of night sights
const holeMat = new THREE.MeshBasicMaterial({ colorWrite: false });            // writes depth only: whatever lies behind it is left as the world
let reticleTex = null;
// The burst rifle's aiming mark: fine cross with an open middle, a centre dot and a ring.
function opticReticle() {
  if (reticleTex) return reticleTex;
  const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
  x.strokeStyle = x.fillStyle = '#fff'; x.lineCap = 'butt';
  const line = (x0, y0, x1, y1, w) => { x.lineWidth = w; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke(); };
  line(256, 500, 256, 318, 6); line(12, 256, 194, 256, 6); line(500, 256, 318, 256, 6);        // heavy posts: left, right and below
  line(256, 318, 256, 270, 2.2); line(194, 256, 242, 256, 2.2); line(318, 256, 270, 256, 2.2); line(256, 160, 256, 242, 2.2);
  x.lineWidth = 2.4; x.beginPath(); x.arc(256, 256, 44, 0, Math.PI * 2); x.stroke();
  x.beginPath(); x.arc(256, 256, 4.5, 0, Math.PI * 2); x.fill();
  reticleTex = new THREE.CanvasTexture(c); reticleTex.anisotropy = 4;
  return reticleTex;
}

// Rocco's paws and sleeves, as seen from his own eyes.
let fur = null, sleeve = null;
const pawGeo = new THREE.SphereGeometry(1, 20, 14), armGeo = new THREE.CapsuleGeometry(.07, .5, 6, 14);
function makeHand(elbow) {
  fur ||= std({ color: 0x8b8d94, roughness: .75 }); sleeve ||= std({ color: 0xe8455b, roughness: .9 });
  const g = new THREE.Group(), paw = new THREE.Mesh(pawGeo, fur), arm = new THREE.Mesh(armGeo, sleeve), cuff = new THREE.Mesh(pawGeo, sleeve);
  paw.scale.set(.068, .062, .085); cuff.scale.set(.074, .074, .05); g.add(paw, arm, cuff);
  g.userData = { elbow: new THREE.Vector3(...elbow), arm, cuff };
  return g;
}
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
function aimHand(hand, at) {         // put the paw at `at` (in the view's own axes) and run the sleeve back to the elbow
  const u = hand.userData; hand.position.copy(at);
  tmp.copy(u.elbow).sub(at); const len = tmp.length(); tmp.divideScalar(len);
  u.arm.position.copy(tmp).multiplyScalar(.38); u.arm.quaternion.setFromUnitVectors(Y, tmp);
  u.cuff.position.copy(tmp).multiplyScalar(.085); u.cuff.quaternion.setFromUnitVectors(AHEAD, tmp);
}

// One gun, lined up: the group's origin is the eye and -Z is the line through its sights.
export function buildSightRig(id, gun) {
  const S = SIGHTS[id], k = gun.scale.x;
  const rear = V(S.rear).multiplyScalar(k), front = V(S.front).multiplyScalar(k);
  const turn = new THREE.Quaternion().setFromAxisAngle(Y, Math.PI);
  const q = new THREE.Quaternion().setFromUnitVectors(front.clone().sub(rear).normalize().applyQuaternion(turn), AHEAD).multiply(turn);
  const aligned = new THREE.Group(); aligned.quaternion.copy(q); aligned.position.set(0, 0, -S.eye).sub(rear.clone().applyQuaternion(q));
  aligned.add(gun);
  const toView = (p) => p.clone().multiplyScalar(k).applyQuaternion(q).add(aligned.position);     // a point on the model -> the view's axes
  const rig = { id, aligned, eye: S.eye, hot: null, reticle: null, parts: [], hands: [], grip: toView(V(S.hands[0])), muzzle: new THREE.Vector3() };

  const named = {};
  gun.traverse(o => { if (!o.isMesh) return; named[o.name] = o; o.castShadow = o.receiveShadow = false; o.renderOrder = 2; });
  // the barrel tip: straight ahead of the sights, at the front of the model
  const box = new THREE.Box3().setFromObject(gun);
  rig.muzzle.copy(toView(new THREE.Vector3(S.front[0], (box.min.y / k + box.max.y / k) / 2 + .12 * (box.max.y - box.min.y) / k, box.max.z / k)));

  if (S.hide && named[S.hide]) named[S.hide].visible = false;
  if (S.glass && named[S.glass]) { named[S.glass].material = glassMat; named[S.glass].renderOrder = 3; }
  if (S.reticle && named[S.reticle]) { rig.reticle = named[S.reticle]; rig.reticle.material = glow(2.4, .1, .07); rig.reticle.renderOrder = 4; }
  if (S.bead && named[S.bead]) named[S.bead].material = glow(2.4, .16, .08);
  if (S.dots && named[S.dots[0]]) {
    const geo = new THREE.CircleGeometry(S.dots[S.dots.length - 1], 20);
    for (const at of S.dots.slice(1, -1)) { const d = new THREE.Mesh(geo, dotMat); d.rotation.y = Math.PI; d.position.set(at[0], at[1], at[2]); d.renderOrder = 3; named[S.dots[0]].add(d); }
  }
  if (S.hole) {
    const [hx, hy, hz, r] = S.hole, extras = new THREE.Group(); extras.scale.setScalar(k); extras.quaternion.copy(q); extras.position.copy(aligned.position);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(r, 48), holeMat); hole.rotation.y = Math.PI; hole.position.set(hx, hy, hz); hole.renderOrder = 1;
    const glass = new THREE.Mesh(hole.geometry, glassMat); glass.rotation.y = Math.PI; glass.position.set(hx, hy, hz - .002); glass.renderOrder = 3;
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: opticReticle(), color: new THREE.Color(2.4, .32, .06), transparent: true, depthWrite: false, toneMapped: false }));
    mark.rotation.y = Math.PI; mark.position.set(hx, hy, hz - .004); mark.renderOrder = 4; rig.reticle = mark;
    extras.add(hole, glass, mark); rig.extras = extras;
  }
  if (rig.reticle) rig.hot = { off: rig.reticle.material.color.clone(), on: new THREE.Color(3.2, 1.5, .1) };
  for (const key of ['slide', 'pump']) {
    const def = S[key]; if (!def || !named[def[0]]) continue;
    rig.parts.push({ mesh: named[def[0]], travel: def[1], time: def[2], delay: def[3], t: 9, hand: key === 'pump' ? 1 : -1 });
  }
  // paws: right on the grip, left on the fore-end (or cupped under the pistol)
  rig.hands = [makeHand([.3, -.5, .12]), makeHand([-.34, -.5, .1])];
  rig.handAt = [toView(V(S.hands[0])), toView(V(S.hands[1]))];
  rig.handMove = new THREE.Vector3(0, 0, 1).applyQuaternion(q).multiplyScalar(k);       // one model unit along the barrel, in the view's axes
  rig.hands.forEach((h, i) => aimHand(h, rig.handAt[i]));
  return rig;
}

// Draws the gun scene over the world: first a copy of the picture so far, then the gun on a fresh depth buffer.
class SightPass extends Pass {
  constructor(scene, camera) {
    super(); this.scene = scene; this.camera = camera; this.enabled = false;
    this.copy = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: { map: { value: null } }, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
      fragmentShader: 'uniform sampler2D map; varying vec2 vUv; void main() { gl_FragColor = texture2D(map, vUv); }',
    }));
    this.copy.frustumCulled = false; this.copy.renderOrder = -1; scene.add(this.copy);
  }
  render(renderer, writeBuffer, readBuffer) {
    this.copy.material.uniforms.map.value = readBuffer.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    const auto = renderer.autoClear; renderer.autoClear = true;
    renderer.render(this.scene, this.camera);
    renderer.autoClear = auto;
  }
}

const spring = (s, k, c, dt) => { s.v += (-k * s.x - c * s.v) * dt; s.x += s.v * dt; };

export function createSightView(game) {
  const { engine } = game, camera = engine.camera;
  const eye = new THREE.PerspectiveCamera(camera.fov, camera.aspect, .015, 30);      // the same view as the world camera, for things close to the eye
  const scene = new THREE.Scene(); scene.environment = engine.scene.environment;
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8a7a66, 1), sun = new THREE.DirectionalLight(0xffffff, 1), flash = new THREE.PointLight(0xffb45a, 0, 4, 2);
  scene.add(hemi, sun, sun.target, flash);
  const root = new THREE.Group(), pose = new THREE.Group(); root.add(pose); scene.add(root); root.visible = false;
  const pass = new SightPass(scene, eye);
  // after the world (and its ambient occlusion), before bloom and tone mapping, so the gun gets the same finish
  const passes = engine.composer.passes, at = passes.indexOf(engine.gtao);
  engine.composer.insertPass(pass, at >= 0 ? at + 1 : 1);

  const rigs = {};
  let rig = null, worldHemi = null, flashT = 0;
  const back = { x: 0, v: 0 }, lift = { x: 0, v: 0 }, roll = { x: 0, v: 0 }, yaw = { x: 0, v: 0 };
  const e = new THREE.Euler(), qPose = new THREE.Quaternion(), pivot = new THREE.Vector3(), off = new THREE.Vector3();
  let lagX = 0, lagY = 0, bobT = 0, bobK = 0, dip = 0, draw = 1;

  function rigFor(id) {
    if (rigs[id]) return rigs[id];
    if (!SIGHTS[id]) return null;
    const gun = weaponCopy(id); if (!gun) return null;         // not loaded (yet): the shoulder view is used instead
    const r = rigs[id] = buildSightRig(id, gun); r.aligned.visible = false; pose.add(r.aligned);
    if (r.extras) { r.extras.visible = false; pose.add(r.extras); }
    for (const h of r.hands) { h.visible = false; pose.add(h); }
    game.env?.touch();                                          // new materials: give them the time of day's reflections
    return r;
  }
  const show = (r, on) => { if (!r) return; r.aligned.visible = on; if (r.extras) r.extras.visible = on; for (const h of r.hands) h.visible = on; };

  const view = {
    scene, pass, shown: false, up: 0,
    // Does this weapon have sights to look down (and is its model here)?
    has: (id) => !!rigFor(id),
    // Where the barrel ends, in the world, for the flash and tracers of a shot fired from this view.
    muzzle(out) {
      const r = rig; if (!r) return out.copy(camera.position);
      root.updateMatrixWorld(true);
      return pose.localToWorld(out.copy(r.muzzle));
    },
    // A shot: the gun jumps in the hands and its moving parts cycle.
    fire(w) {
      const k = w.kick * AIM.kick;
      back.v += k * 17; lift.v += k * 30; roll.v += (Math.random() - .5) * k * 22; yaw.v += (Math.random() - .5) * k * 10;
      if (rig) for (const p of rig.parts) p.t = -p.delay;
      flashT = .06;
    },
    // Every frame, after the camera has been placed. turnX / turnY: how far the view turned this frame (radians).
    update(dt, t, turnX = 0, turnY = 0) {
      const combat = game.combat, p = game.player, id = combat.weapon, a = p.mode === 'foot' ? combat.aimBlend : 0;
      const want = a > AIM.swap && !WEAPONS[id].scope ? rigFor(id) : null;
      if (want !== rig) { show(rig, false); rig = want; show(rig, true); if (rig) draw = 0; }
      view.shown = pass.enabled = root.visible = !!rig;
      spring(back, 260, 22, dt); spring(lift, 300, 24, dt); spring(roll, 240, 18, dt); spring(yaw, 240, 20, dt);
      if (!rig) { view.up = 0; lagX = lagY = 0; return; }

      // how far up the gun is: it rises into the eye line once Rocco has dropped out of the picture (AIM.swap)
      const u = clamp((a - AIM.swap) / (1 - AIM.swap), 0, 1), up = view.up = 1 - (1 - u) * (1 - u), low = 1 - up;
      draw = Math.min(1, draw + dt * 7); dip = damp(dip, combat.reloading > 0 ? 1 : 0, 10, dt);
      const down = Math.max(low, (1 - draw) * .7, dip * .5);
      const reach = rig.eye * Math.tan(camera.fov * Math.PI / 360);        // half the height of the view, out where the sights are
      // the gun trails the hand a little when the view turns, and bobs with Rocco's steps
      lagX = damp(lagX, clamp(-turnX / Math.max(dt, .001) * .011, -.03, .03) * AIM.sway, 14, dt);
      lagY = damp(lagY, clamp(-turnY / Math.max(dt, .001) * .011, -.03, .03) * AIM.sway, 14, dt);
      bobK = damp(bobK, clamp(p.speed / 2.4, 0, 1), 8, dt); bobT += dt * (4 + p.speed * 1.6);
      const bx = Math.sin(bobT) * .0035 * bobK * AIM.bob, by = Math.abs(Math.cos(bobT)) * .003 * bobK * AIM.bob;
      const breatheX = Math.sin(t * .9) * .0005 * AIM.sway, breatheY = Math.sin(t * 1.3 + 1) * .0006 * AIM.sway;

      // lowered, the gun hangs below and to the right of the view, canted, with the muzzle dipped
      e.set(clamp(lift.x, -.02, .3) - down * .3 - lagY + breatheY, yaw.x + down * .2 - lagX + breatheX, roll.x - down * .4, 'YXZ');
      qPose.setFromEuler(e);
      // turns happen about the hand on the grip, so a kick lifts the muzzle rather than the whole gun
      pivot.copy(rig.grip); off.copy(pivot).applyQuaternion(qPose);
      pose.quaternion.copy(qPose);
      pose.position.set(pivot.x - off.x + bx + breatheX + down * reach * .8, pivot.y - off.y - by + breatheY - down * reach * 1.5, pivot.z - off.z + clamp(back.x, -.02, .14) + down * .03);

      // the slide and the pump
      for (const part of rig.parts) {
        part.t += dt; const s = part.t / part.time;                       // back in the first third of the time, forward again over the rest
        const z = s <= 0 || s >= 1 ? 0 : (s < .3 ? s / .3 : 1 - (s - .3) / .7) * part.travel;
        part.mesh.position.z = z;
        if (part.hand >= 0) { tmp.copy(rig.handAt[part.hand]).addScaledVector(rig.handMove, z); aimHand(rig.hands[part.hand], tmp); }
      }
      if (rig.hot) rig.reticle.material.color.copy(combat.onTarget ? rig.hot.on : rig.hot.off);

      // sit on the camera, and take the daylight from the world
      root.position.copy(camera.position); root.quaternion.copy(camera.quaternion);
      eye.position.copy(camera.position); eye.quaternion.copy(camera.quaternion);
      if (eye.fov !== camera.fov || eye.aspect !== camera.aspect) { eye.fov = camera.fov; eye.aspect = camera.aspect; eye.updateProjectionMatrix(); }
      const ws = engine.sun; worldHemi ||= engine.scene.children.find(o => o.isHemisphereLight);
      if (ws) { sun.color.copy(ws.color); sun.intensity = ws.intensity; sun.position.copy(ws.position).sub(ws.target.position).normalize().multiplyScalar(50).add(camera.position); sun.target.position.copy(camera.position); }
      if (worldHemi) { hemi.color.copy(worldHemi.color); hemi.groundColor.copy(worldHemi.groundColor); hemi.intensity = Math.max(worldHemi.intensity, AIM.nightGlow); }
      flashT -= dt; flash.intensity = flashT > 0 ? 30 : 0;
      if (flashT > 0) { root.updateMatrixWorld(true); flash.position.copy(pose.localToWorld(tmp2.copy(rig.muzzle))); }
    },
  };
  return view;
}
