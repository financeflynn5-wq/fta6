// Sun, sky, fog and the day/night cycle. The day and night looks are the two approved
// "moods" from the concept; this file blends between them over a dusk/dawn.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { lerp, clamp } from '../core/utils.js';
import { TIME } from '../config.js';
import { mats, litMaterials } from './materials.js';

const smooth = (t) => t * t * (3 - 2 * t);

export function createSky(engine, city) {
  const { scene, renderer, bloom } = engine;
  const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x8a7a66, 1.1); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe2b8, 3.2); sun.castShadow = true; scene.add(sun, sun.target);
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -75, right: 75, top: 75, bottom: -75, near: 1, far: 400 });
  sun.shadow.bias = -.0004; sun.shadow.normalBias = .04;
  engine.sun = sun;

  const sky = new Sky(); sky.scale.setScalar(1200); scene.add(sky);
  const su = sky.material.uniforms; su.turbidity.value = 6; su.rayleigh.value = 1.6; su.mieCoefficient.value = .006; su.mieDirectionalG.value = .85;
  const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(62), THREE.MathUtils.degToRad(215));
  const skySun = new THREE.Vector3();

  // street lamps: a handful of real lights that hop to the lamps nearest the camera
  const points = []; for (let i = 0; i < 10; i++) { const p = new THREE.PointLight(0xffc98a, 0, 26, 1.6); scene.add(p); points.push(p); }
  let lampTimer = 0;

  const C = (h) => new THREE.Color(h);
  const day = { sun: C(0xffe2b8), hemi: C(0xcfe6ff), fog: C(0xf3d9c0), asphalt: C(0x55585e) };
  const night = { sun: C(0x8fa8ff), hemi: C(0x4a5a9a), fog: C(0x141a33), asphalt: C(0x3d4048), bg: C(0x0b0e1c) };
  scene.fog = new THREE.Fog(0xf3d9c0, 140, 420);

  // light-space axes, used to move the shadow box in whole texels (stops shadows shimmering)
  const up = new THREE.Vector3(0, 1, 0), lx = new THREE.Vector3().crossVectors(up, sunDir).normalize(), ly = new THREE.Vector3().crossVectors(sunDir, lx).normalize();
  const focus = new THREE.Vector3();

  const env = {
    night: -1, clock: 0, tailBase: .5, sun, sunDir,
    // n: 0 = full day, 1 = full night
    apply(n) {
      if (Math.abs(n - env.night) < .002) return; env.night = n;
      const polar = lerp(62, 97, smooth(clamp(n * 1.25, 0, 1)));
      skySun.setFromSphericalCoords(1, THREE.MathUtils.degToRad(polar), THREE.MathUtils.degToRad(215)); su.sunPosition.value.copy(skySun);
      const dark = n > .96; sky.visible = !dark; scene.background = dark ? night.bg : null;
      scene.fog.color.lerpColors(day.fog, night.fog, n); scene.fog.near = env.fogNear = lerp(140, 10, n); scene.fog.far = env.fogFar = lerp(420, 340, n);        // world.js pushes both out as the camera climbs
      sun.color.lerpColors(day.sun, night.sun, n); sun.intensity = lerp(2.6, .12, n);
      hemi.color.lerpColors(day.hemi, night.hemi, n); hemi.intensity = lerp(.75, .07, n);
      renderer.toneMappingExposure = lerp(.85, .95, n);
      const e = lerp(.7, .06, n); for (const m of litMaterials) m.envMapIntensity = e;
      mats.asphalt.roughness = lerp(.92, .42, n); mats.asphalt.color.lerpColors(day.asphalt, night.asphalt, n);
      const on = smooth(clamp((n - .35) / .4, 0, 1));          // lamps and windows switch on through dusk
      city.litWindows.material = n > .5 ? mats.litWin : mats.glass;
      mats.lampHead.emissiveIntensity = 5 * on; mats.shop.emissiveIntensity = .7 * on;
      mats.head.emissiveIntensity = lerp(.4, 6, on); env.tailBase = lerp(.5, 4, on);
      city.signMats.forEach(s => s.color.setScalar(lerp(.95, 2.2, on)));
      points.forEach(p => p.intensity = 22 * on);
      bloom.strength = lerp(.12, .55, n); bloom.threshold = lerp(2.5, 1.6, n); bloom.radius = lerp(.3, .45, n);
    },
    touch() { const n = env.night; env.night = -1; env.apply(n); },   // call after creating new materials
    skip() {   // jump to the next day <-> night switch
      const { day: d, dusk, night: nt, dawn } = TIME, total = d + dusk + nt + dawn, c = env.clock % total;
      env.clock += c < d ? d - c : c < d + dusk + nt ? d + dusk + nt - c : total - c;
    },
    update(dt, camPos, lookAt) {
      env.clock += dt; sky.position.set(camPos.x, 0, camPos.z);          // the sky dome travels with you (the map is bigger than it is)
      const { day: d, dusk, night: nt, dawn } = TIME, c = env.clock % (d + dusk + nt + dawn);
      env.apply(c < d ? 0 : c < d + dusk ? (c - d) / dusk : c < d + dusk + nt ? 1 : 1 - (c - d - dusk - nt) / dawn);
      // shadow box follows the action
      const texel = 150 / sun.shadow.mapSize.x;
      focus.copy(lookAt); focus.y = 0;
      const a = focus.dot(lx), b = focus.dot(ly);
      focus.addScaledVector(lx, -(a % texel)).addScaledVector(ly, -(b % texel));
      sun.target.position.copy(focus); sun.position.copy(focus).addScaledVector(sunDir, 150);
      if (env.night > .3 && (lampTimer -= dt) <= 0) {
        lampTimer = .3;
        const near = city.lampPts.slice().sort((p, q) => p.distanceToSquared(lookAt) - q.distanceToSquared(lookAt));
        points.forEach((pl, i) => pl.position.copy(near[i]));
      }
    },
    label() {
      const { day: d, dusk, night: nt, dawn } = TIME, total = d + dusk + nt + dawn, c = env.clock % total;
      // map the cycle onto a 24h clock: day 07:00-19:00, night 20:00-06:00
      let h; if (c < d) h = 7 + 12 * c / d; else if (c < d + dusk) h = 19 + (c - d) / dusk; else if (c < d + dusk + nt) h = 20 + 10 * (c - d - dusk) / nt; else h = 6 + (c - d - dusk - nt) / dawn;
      h %= 24; const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    },
  };
  env.apply(0);
  return env;
}
