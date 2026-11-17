// Tyre marks, smoke, fire and sparks.
// Every particle is one corner-facing card in a single instanced mesh (one draw call), sorted far to
// near. Smoke cards carry a billowy "clump of balls" shape with its own surface slopes, so the sun and
// the sky light each puff like a solid cloud, and a puff thins out into wisps as it dies instead of
// just fading. Nothing here allocates mid-game.
import * as THREE from 'three';
import { FX } from '../config.js';

const STRIDE = 18, SMOKE = 0, SPARK = 1, FIRE = 2, clamp01 = (v) => Math.min(1, Math.max(0, v));

// ---------- the puff shapes: 4 different clumps, 2 x 2 on one texture ----------
// red / green = which way the surface faces, blue = how thick the puff is there, alpha = density
function puffAtlas() {
  const F = 160, W = F * 2, data = new Uint8Array(W * W * 4);
  let seed = 20261117; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const H = new Float32Array(F * F), B = new Float32Array(F * F);
  // lumpy noise that breaks the density up, so a dying puff tears into wisps
  const G = 9, grid = new Float32Array(G * G);
  const noise = (u, v) => {
    const x = u * (G - 1), y = v * (G - 1), xi = Math.min(G - 2, x | 0), yi = Math.min(G - 2, y | 0), fx = x - xi, fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), a = grid[yi * G + xi], b = grid[yi * G + xi + 1], c = grid[(yi + 1) * G + xi], d = grid[(yi + 1) * G + xi + 1];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
  for (let f = 0; f < 4; f++) {
    for (let i = 0; i < G * G; i++) grid[i] = rnd();
    const balls = [[0, 0, .5]];
    for (let i = 0; i < 15; i++) { const a = rnd() * 6.2832, rad = .15 + rnd() * .22, r = Math.min(.9 - rad, .22 + rnd() * .42); balls.push([Math.cos(a) * r, Math.sin(a) * r, rad]); }
    for (let j = 0; j < F; j++) for (let i = 0; i < F; i++) {
      const u = (i + .5) / F * 2 - 1, v = (j + .5) / F * 2 - 1; let h = 0;
      for (const b of balls) { const dx = u - b[0], dy = v - b[1], q = b[2] * b[2] - dx * dx - dy * dy; if (q > 0) { const s = Math.sqrt(q); if (s > h) h = s; } }
      H[j * F + i] = h;
    }
    // soften the creases between the balls a little
    for (let pass = 0; pass < 2; pass++) {
      for (let j = 0; j < F; j++) for (let i = 0; i < F; i++) {
        let s = 0, n = 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const x = i + di, y = j + dj; if (x >= 0 && y >= 0 && x < F && y < F) { s += H[y * F + x]; n++; } }
        B[j * F + i] = s / n;
      }
      H.set(B);
    }
    const ox = (f & 1) * F, oy = (f >> 1) * F, k = F * .5 * 1.15;
    for (let j = 0; j < F; j++) for (let i = 0; i < F; i++) {
      const h = H[j * F + i], hx = (H[j * F + Math.min(F - 1, i + 1)] - H[j * F + Math.max(0, i - 1)]) * .5 * k, hy = (H[Math.min(F - 1, j + 1) * F + i] - H[Math.max(0, j - 1) * F + i]) * .5 * k;
      const l = 1 / Math.hypot(hx, hy, 1), o = ((oy + j) * W + ox + i) * 4;
      const dens = Math.min(1, h * 2.1) * (.55 + .45 * noise(i / F, j / F));
      data[o] = Math.round((-hx * l * .5 + .5) * 255); data[o + 1] = Math.round((-hy * l * .5 + .5) * 255);
      data[o + 2] = Math.round(Math.min(1, h * 2) * 255); data[o + 3] = Math.round(dens * 255);
    }
  }
  const t = new THREE.DataTexture(data, W, W, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}

const VERT = /* glsl */`
attribute vec4 aA;      // where (xyz) and how big
attribute vec4 aB;      // colour and opacity
attribute vec4 aC;      // turn, which puff shape (-1 = spark), floor height, glow (0 = lit smoke, 1 = fire)
attribute vec4 aD;      // velocity, and how far it streaks along it
attribute vec2 aE;      // how far it has thinned out, and how soft it is (white smoke is hazy, soot is lumpy)
varying vec2 vUv; varying vec4 vCol; varying vec4 vP; varying vec2 vTurn; varying float vHigh; varying float vDepth;
void main() {
  vec4 mv = viewMatrix * vec4(aA.xyz, 1.0);
  float c = cos(aC.x), s = sin(aC.x);
  vec2 q = position.xy, off = vec2(c * q.x - s * q.y, s * q.x + c * q.y) * aA.w;
  if (aD.w > 0.0) {
    vec2 vv = (viewMatrix * vec4(aD.xyz, 0.0)).xy; float l = length(vv);
    if (l > 1e-3) { vec2 d = vv / l; off = d * q.x * (aA.w + l * aD.w) + vec2(-d.y, d.x) * q.y * aA.w; }
  }
  mv.xy += off;
  vHigh = aA.y + viewMatrix[1][0] * off.x + viewMatrix[1][1] * off.y - aC.z;      // height of this corner above the puff's floor
  vDepth = -mv.z; vUv = uv; vCol = aB; vP = vec4(aC.w, aE.x, aC.y, aE.y); vTurn = vec2(c, s);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */`
uniform sampler2D uMap; uniform vec3 uSun; uniform vec3 uSky; uniform vec3 uGround; uniform vec3 uSunDir;
uniform vec3 uFog; uniform float uFogNear; uniform float uFogFar;
varying vec2 vUv; varying vec4 vCol; varying vec4 vP; varying vec2 vTurn; varying float vHigh; varying float vDepth;
void main() {
  float fog = smoothstep(uFogNear, uFogFar, vDepth);
  if (vP.z < 0.0) {                                    // spark: a hot streak
    vec2 p = vUv * 2.0 - 1.0; float d = dot(p, p);
    float a = exp(-(p.x * p.x * 2.0 + p.y * p.y * 7.0)) * (1.0 - smoothstep(0.6, 1.0, d)) * vCol.a * (1.0 - fog);
    gl_FragColor = vec4(vCol.rgb * a, 0.0); return;
  }
  vec2 cell = vec2(mod(vP.z, 2.0), floor(vP.z * 0.5));
  vec4 t = texture2D(uMap, (cell + vUv) * 0.5);
  float a = smoothstep(vP.y, vP.y + mix(0.34, 0.75, vP.w), t.a) * vCol.a;
  a *= smoothstep(0.0, 0.4, vHigh) * smoothstep(0.7, 3.0, vDepth);     // melt into the ground / bonnet, and never slap the camera
  if (a < 0.004) discard;
  vec2 n2 = (t.rg * 2.0 - 1.0) * mix(1.0, 0.4, vP.w); n2 = vec2(vTurn.x * n2.x - vTurn.y * n2.y, vTurn.y * n2.x + vTurn.x * n2.y);
  vec3 n = vec3(n2, sqrt(max(0.0, 1.0 - dot(n2, n2))));
  float sun = clamp((dot(n, uSunDir) + 0.5) / 1.5, 0.0, 1.0);
  // smoke scatters light around inside itself, so its shaded side is much brighter than a solid's would be
  vec3 lit = vCol.rgb * (mix(uGround, uSky, 0.5 + 0.5 * n.y) * (1.1 + 0.7 * t.b) + uSun * mix(sun * sun, 0.55, vP.w) * 0.9);
  lit = mix(lit, uFog, fog);
  vec3 hot = vCol.rgb * (0.35 + 0.65 * t.b) * (1.0 - fog);
  float glow = vP.x;
  gl_FragColor = vec4(mix(lit, hot, glow) * a, a * (1.0 - glow));
}`;

export function createEffects(scene, camera) {
  // ---------- tyre marks: a ring buffer of flat quads ----------
  const MAX = 1200, quad = new THREE.PlaneGeometry(1, 1); quad.rotateX(-Math.PI / 2);
  const marks = new THREE.InstancedMesh(quad, new THREE.MeshBasicMaterial({ color: 0x0c0c0e, transparent: true, opacity: .42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), MAX);
  marks.frustumCulled = false; marks.count = 0; scene.add(marks);
  let head = 0; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3(), yAxis = new THREE.Vector3(0, 1, 0);

  // ---------- particles ----------
  const N = FX.particles, f32 = () => new Float32Array(N);
  const X = f32(), Y = f32(), Z = f32(), VX = f32(), VY = f32(), VZ = f32(), SIZE = f32(), GROW = f32(), LIFE = f32(), LMAX = f32();
  const R = f32(), G = f32(), B = f32(), ALPHA = f32(), ROT = f32(), SPIN = f32(), FRAME = f32(), FLOOR = f32(), RISE = f32(), TURB = f32(), SEED = f32(), STRETCH = f32(), SOFT = f32();
  const KIND = new Uint8Array(N), order = new Uint16Array(N), key = new Float32Array(N);
  let next = 0, clock = 0;

  const buf = new THREE.InstancedInterleavedBuffer(new Float32Array(N * STRIDE), STRIDE); buf.setUsage(THREE.DynamicDrawUsage);
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-.5, -.5, 0, .5, -.5, 0, .5, .5, 0, -.5, .5, 0], 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  geo.setAttribute('aA', new THREE.InterleavedBufferAttribute(buf, 4, 0)); geo.setAttribute('aB', new THREE.InterleavedBufferAttribute(buf, 4, 4));
  geo.setAttribute('aC', new THREE.InterleavedBufferAttribute(buf, 4, 8)); geo.setAttribute('aD', new THREE.InterleavedBufferAttribute(buf, 4, 12));
  geo.setAttribute('aE', new THREE.InterleavedBufferAttribute(buf, 2, 16));
  geo.instanceCount = 0;
  const uni = {
    uMap: { value: puffAtlas() }, uSun: { value: new THREE.Color(1, 1, 1) }, uSky: { value: new THREE.Color(.3, .3, .3) }, uGround: { value: new THREE.Color(.2, .2, .2) },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uFog: { value: new THREE.Color(1, 1, 1) }, uFogNear: { value: 100 }, uFogFar: { value: 400 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: uni, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,      // colours arrive already multiplied by opacity, so fire and sparks can add light in the same pass
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 10; mesh.userData.noAO = true; scene.add(mesh);

  let sunLight = null, hemi = null; const cam = new THREE.Vector3(0, 1e4, 0), fwd = new THREE.Vector3(0, 0, -1), tmp = new THREE.Vector3();
  const wind = FX.wind;

  // how much of an effect to draw at this distance: all of it up close, none far away
  const keep = (x, z) => { const d = Math.hypot(x - cam.x, z - cam.z); return d < FX.near ? 1 : d > FX.far ? 0 : 1 - (d - FX.near) / (FX.far - FX.near); };
  function take(kind, x, y, z, life) {
    const i = next; next = (next + 1) % N;
    KIND[i] = kind; X[i] = x; Y[i] = y; Z[i] = z; LIFE[i] = LMAX[i] = life; SEED[i] = Math.random() * 100; STRETCH[i] = 0; FLOOR[i] = -1e3; FRAME[i] = (Math.random() * 4) | 0;
    ROT[i] = Math.random() * 6.2832; SPIN[i] = (Math.random() - .5) * .9;
    return i;
  }

  const fx = {
    skid(x1, z1, x2, z2, y) {
      const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
      pos.set((x1 + x2) / 2, y + .03, (z1 + z2) / 2); q.setFromAxisAngle(yAxis, -Math.atan2(dz, dx)); scl.set(len + .1, 1, .24);
      marks.setMatrixAt(head, m4.compose(pos, q, scl)); head = (head + 1) % MAX; marks.count = Math.min(MAX, marks.count + 1); marks.instanceMatrix.needsUpdate = true;
    },
    // shade: 1 = white (tyre smoke, steam, spray), 0 = black (a dying engine). size in metres, life in seconds.
    // o (all optional): rise (m/s it climbs at), grow (m/s it widens), alpha, turb (how much it wanders), floor (height it melts into)
    smoke(x, y, z, shade, size, life, vx = 0, vz = 0, o) {
      const near = keep(x, z); if (near < 1 && Math.random() > near) return;
      const i = take(SMOKE, x, y, z, life * (.8 + Math.random() * .4)), dark = 1 - shade;
      VX[i] = vx + (Math.random() - .5) * .8; VZ[i] = vz + (Math.random() - .5) * .8; VY[i] = .6 + Math.random() * .7 + dark * .8;
      RISE[i] = o?.rise ?? .55 + dark * 1.3; GROW[i] = o?.grow ?? 1.35 + dark * .5; TURB[i] = o?.turb ?? .9;
      SIZE[i] = size * (.75 + Math.random() * .5); FLOOR[i] = o?.floor ?? y - Math.min(.3, size * .35);
      const alb = .035 + .93 * Math.pow(shade, 1.3), warm = dark * .012; SOFT[i] = clamp01(shade * 1.5 - .3);      // soot is never quite black, and a touch warm
      R[i] = alb + warm; G[i] = alb + warm * .4; B[i] = alb; ALPHA[i] = o?.alpha ?? .5 + dark * .38;
    },
    // a lick of flame: bright, quick, climbs and shrinks. Glows at night.
    fire(x, y, z, size = .7, vx = 0, vz = 0) {
      const near = keep(x, z); if (near < 1 && Math.random() > near) return;
      const i = take(FIRE, x, y, z, .32 + Math.random() * .3);
      VX[i] = vx + (Math.random() - .5) * 1.1; VZ[i] = vz + (Math.random() - .5) * 1.1; VY[i] = 1.6 + Math.random() * 1.8; RISE[i] = 3.2; GROW[i] = -.5; TURB[i] = 2.2;
      SIZE[i] = size * (.7 + Math.random() * .6); FLOOR[i] = y - .25; R[i] = 1; G[i] = 1; B[i] = 1; ALPHA[i] = .9; STRETCH[i] = .16;      // drawn out along its climb, into a tongue
    },
    spark(x, y, z, n = 8, power = 1) {
      if (keep(x, z) <= 0) return;
      for (let k = 0; k < n; k++) {
        const i = take(SPARK, x, y, z, .25 + Math.random() * .4), a = Math.random() * 6.2832, sp = (2 + Math.random() * 7) * power;
        VX[i] = Math.cos(a) * sp; VZ[i] = Math.sin(a) * sp; VY[i] = 2 + Math.random() * 5; SIZE[i] = .035 + Math.random() * .035; GROW[i] = 0; STRETCH[i] = .045; FRAME[i] = -1;
        FLOOR[i] = y - .6; R[i] = 4.2; G[i] = 1.3 + Math.random() * 1.1; B[i] = .22; ALPHA[i] = 1; ROT[i] = 0; SPIN[i] = 0;
      }
    },
    get alive() { return geo.instanceCount; },
    update(dt) {
      clock += dt;
      if (camera) { camera.getWorldPosition(cam); camera.getWorldDirection(fwd); }
      // light the smoke with whatever the sun and sky are doing right now
      if (!sunLight) scene.traverse(o => { if (o.isDirectionalLight) sunLight ??= o; else if (o.isHemisphereLight) hemi ??= o; });
      const PI = Math.PI;
      if (sunLight) {
        uni.uSun.value.copy(sunLight.color).multiplyScalar(sunLight.intensity / PI);
        tmp.copy(sunLight.position).sub(sunLight.target.position).normalize(); if (camera) tmp.transformDirection(camera.matrixWorldInverse); uni.uSunDir.value.copy(tmp);
      }
      if (hemi) {
        const k = hemi.intensity / PI, glow = FX.nightGlow;      // the city's own glow keeps smoke readable at night
        uni.uSky.value.copy(hemi.color).multiplyScalar(k).addScalar(glow); uni.uGround.value.copy(hemi.groundColor).multiplyScalar(k * .8).addScalar(glow * .7);
      }
      if (scene.fog) { uni.uFog.value.copy(scene.fog.color); uni.uFogNear.value = scene.fog.near; uni.uFogFar.value = scene.fog.far; }

      let n = 0;
      for (let i = 0; i < N; i++) {
        if (LIFE[i] <= 0) continue;
        LIFE[i] -= dt; if (LIFE[i] <= 0) continue;
        const kind = KIND[i];
        if (kind === SPARK) {
          VY[i] -= 20 * dt; X[i] += VX[i] * dt; Y[i] += VY[i] * dt; Z[i] += VZ[i] * dt;
          if (Y[i] < FLOOR[i] && VY[i] < 0) { Y[i] = FLOOR[i]; VY[i] *= -.4; VX[i] *= .7; VZ[i] *= .7; }
        } else {
          const s = SEED[i], tb = TURB[i] * dt, d = Math.min(1, dt * .7);
          VX[i] += (wind[0] - VX[i]) * d + Math.sin(s * 13 + clock * 1.7 + Y[i] * .9) * tb;
          VZ[i] += (wind[1] - VZ[i]) * d + Math.cos(s * 7 + clock * 1.3 + Y[i] * .7) * tb;
          VY[i] += (RISE[i] - VY[i]) * Math.min(1, dt * 1.4);
          X[i] += VX[i] * dt; Y[i] += VY[i] * dt; Z[i] += VZ[i] * dt;
          const u = 1 - LIFE[i] / LMAX[i];
          SIZE[i] = Math.max(.05, SIZE[i] + GROW[i] * (1 - .6 * u) * dt); ROT[i] += SPIN[i] * dt;
        }
        key[i] = (X[i] - cam.x) * fwd.x + (Y[i] - cam.y) * fwd.y + (Z[i] - cam.z) * fwd.z;
        order[n++] = i;
      }
      // far ones first, so nearer smoke covers them properly
      const live = order.subarray(0, n); live.sort((a, b) => key[b] - key[a]);
      const a = buf.array;
      for (let j = 0; j < n; j++) {
        const i = live[j], o = j * STRIDE, u = 1 - LIFE[i] / LMAX[i], kind = KIND[i];
        a[o] = X[i]; a[o + 1] = Y[i]; a[o + 2] = Z[i]; a[o + 3] = SIZE[i];
        a[o + 8] = ROT[i]; a[o + 9] = FRAME[i]; a[o + 10] = FLOOR[i];
        a[o + 12] = VX[i]; a[o + 13] = VY[i]; a[o + 14] = VZ[i]; a[o + 15] = STRETCH[i]; a[o + 17] = kind === SMOKE ? SOFT[i] : 0;
        if (kind === SMOKE) {
          const fade = u > .7 ? 1 - (u - .7) / .3 : 1;
          a[o + 4] = R[i]; a[o + 5] = G[i]; a[o + 6] = B[i]; a[o + 7] = ALPHA[i] * Math.min(1, u * 9) * fade;
          a[o + 11] = 0; a[o + 16] = u < .25 ? 0 : (u - .25) / .75 * .62;
        } else if (kind === FIRE) {
          // white-yellow at the root, orange, then a dull red tip
          const h = 1 - u;
          a[o + 4] = 3.4 * (.3 + .7 * h); a[o + 5] = 1.9 * h * h + .1; a[o + 6] = .5 * h * h * h * h; a[o + 7] = ALPHA[i] * Math.min(1, u * 8) * Math.min(1, h * 2.5);
          a[o + 11] = 1; a[o + 16] = .12 + u * .55;
        } else {
          a[o + 4] = R[i]; a[o + 5] = G[i]; a[o + 6] = B[i]; a[o + 7] = Math.min(1, (1 - u) * 2);
          a[o + 11] = 1; a[o + 16] = 0;
        }
      }
      geo.instanceCount = n; mesh.visible = n > 0;
      if (n) { buf.clearUpdateRanges(); buf.addUpdateRange(0, n * STRIDE); buf.needsUpdate = true; }
    },
  };
  return fx;
}
