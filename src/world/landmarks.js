// Sunset General (where you wake up after being wasted) and Sunset PD (where you walk out after
// being nabbed). Each takes over an existing building on its block: a big sign over the door
// (unlit material, so it glows at night) and a respawn spot on the sidewalk out front.
import * as THREE from 'three';
import { WORLD, RESPAWN } from '../config.js';
import { ctex } from './materials.js';

function signTexture(kind, name) {
  return ctex(1024, (x, s) => {
    const hosp = kind === 'hospital', w = s, h = s / 2.6, top = (s - h) / 2;
    x.clearRect(0, 0, s, s);
    x.fillStyle = hosp ? '#f7f7f2' : '#14244f'; x.beginPath(); x.roundRect(10, top, w - 20, h, 40); x.fill();
    x.lineWidth = 14; x.strokeStyle = hosp ? '#e8203a' : '#ffd34d'; x.stroke();
    // emblem: red cross, or a gold star badge
    const cx = 64 + h * .36, cy = s / 2, r = h * .32;
    if (hosp) { x.fillStyle = '#e8203a'; x.fillRect(cx - r * .3, cy - r, r * .6, r * 2); x.fillRect(cx - r, cy - r * .3, r * 2, r * .6); }
    else {
      x.fillStyle = '#ffd34d'; x.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
      x.fill(); x.fillStyle = '#14244f'; x.beginPath(); x.arc(cx, cy, r * .22, 0, 7); x.fill();
    }
    x.font = `900 ${name.length > 10 ? 92 : 118}px "Archivo Black",Impact,sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = hosp ? '#1d2230' : '#ffffff'; x.fillText(name, (cx + r + w - 30) / 2, cy + 6);
  });
}

// The building on a block whose front sits furthest out toward one street, nearest the middle
// of the block. Returns where its front wall is (fx, fz) and how wide a sign it can carry.
export function frontage(boxes, block, side) {
  const [bi, bj] = block, [sx, sz] = side;
  const cx = WORLD.PITCH / 2 + WORLD.PITCH * bi, cz = WORLD.PITCH / 2 + WORLD.PITCH * bj;
  let best = null, bestScore = -1e9;
  for (const b of boxes) {
    if (b.wall || Math.abs(b.x - cx) > 20 || Math.abs(b.z - cz) > 20) continue;
    const face = sx ? (b.x + sx * b.hw) * sx : (b.z + sz * b.hd) * sz, off = sx ? Math.abs(b.z - cz) : Math.abs(b.x - cx);
    const score = face * 2 - off * .5 + (sx ? b.hd : b.hw) * .4;
    if (score > bestScore) { bestScore = score; best = b; }
  }
  if (!best) return null;
  return {
    fx: sx ? best.x + sx * (best.hw + .1) : best.x, fz: sz ? best.z + sz * (best.hd + .1) : best.z,
    width: Math.min(9, (sx ? best.hd : best.hw) * 2 - 1), cx, cz,
  };
}

// A sign hung over a building's front door. Unlit, so it glows at night.
export function hangSign(scene, f, side, texture) {
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(f.width, f.width), new THREE.MeshBasicMaterial({ map: texture, transparent: true }));
  sign.position.set(f.fx, 6.4, f.fz); sign.rotation.y = Math.atan2(side[0], side[1]); scene.add(sign); return sign;
}

export function createLandmarks(game) {
  const boxes = game.city.solids.boxes, out = {};
  for (const [kind, def] of Object.entries(RESPAWN)) {
    const [sx, sz] = def.side, f = frontage(boxes, def.block, def.side);
    if (!f) continue;
    hangSign(game.scene, f, def.side, signTexture(kind, def.name));
    out[kind] = { x: f.fx + sx * 2.4, z: f.fz + sz * 2.4, face: Math.atan2(sx, sz), kind, name: def.name };
  }
  return out;
}
