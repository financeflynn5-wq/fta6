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

export function createLandmarks(game) {
  const boxes = game.city.solids.boxes, out = {};
  for (const [kind, def] of Object.entries(RESPAWN)) {
    const [bi, bj] = def.block, [sx, sz] = def.side;
    const cx = 27 + WORLD.PITCH * bi, cz = 27 + WORLD.PITCH * bj;
    // the building whose front sits furthest out toward that street, nearest the middle of the block
    let best = null, bestScore = -1e9;
    for (const b of boxes) {
      if (b.wall || Math.abs(b.x - cx) > 20 || Math.abs(b.z - cz) > 20) continue;
      const face = sx ? (b.x + sx * b.hw) * sx : (b.z + sz * b.hd) * sz, off = sx ? Math.abs(b.z - cz) : Math.abs(b.x - cx);
      const score = face * 2 - off * .5 + (sx ? b.hd : b.hw) * .4;
      if (score > bestScore) { bestScore = score; best = b; }
    }
    if (!best) continue;
    const fx = sx ? best.x + sx * (best.hw + .1) : best.x, fz = sz ? best.z + sz * (best.hd + .1) : best.z;
    const width = Math.min(9, (sx ? best.hd : best.hw) * 2 - 1);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(width, width), new THREE.MeshBasicMaterial({ map: signTexture(kind, def.name), transparent: true }));
    sign.position.set(fx, 6.4, fz); sign.rotation.y = Math.atan2(sx, sz); game.scene.add(sign);
    const spot = { x: fx + sx * 2.4, z: fz + sz * 2.4, face: Math.atan2(sx, sz), kind, name: def.name };
    out[kind] = spot;
  }
  return out;
}
