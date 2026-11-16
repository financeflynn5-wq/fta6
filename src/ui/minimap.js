// Round radar in the corner. Rotates with the camera; cops flash red and blue.
import { WORLD } from '../config.js';
import { paintPlan } from '../world/ground.js';

export function createMinimap(game) {
  const cv = document.getElementById('minimap'), x = cv.getContext('2d'), S = cv.width, R = S / 2;
  const SCALE = 1.05;   // pixels per metre
  // the street plan never changes, so draw it once
  const plan = document.createElement('canvas'), half = WORLD.LIMIT + 30; plan.width = plan.height = half * 2;
  const g = plan.getContext('2d');
  paintPlan(g, half, game.city.districts.decks);      // land, sea and roads from the map
  g.fillStyle = '#d6cfc4';
  for (const bi of WORLD.blocksIdx) for (const bj of WORLD.blocksIdx) g.fillRect(half + 27 + WORLD.PITCH * bi - 20, half + 27 + WORLD.PITCH * bj - 20, 40, 40);
  let frame = 0;

  return {
    plan, half,
    setBuildings(boxes) { g.fillStyle = '#e9a58f'; for (const b of boxes) if (!b.wall) g.fillRect(half + b.x - b.hw, half + b.z - b.hd, b.hw * 2, b.hd * 2); },
    update(t) {
      if (frame++ % 2) return;
      const p = game.player, yaw = game.cam.yaw;
      x.clearRect(0, 0, S, S); x.save();
      x.beginPath(); x.arc(R, R, R, 0, 7); x.clip();
      x.translate(R, R); x.rotate(-yaw - Math.PI / 2); x.scale(SCALE, SCALE); x.translate(-p.x, -p.z);
      x.drawImage(plan, -half, -half);
      // other cars
      for (const v of game.traffic.vehicles) {
        if (Math.abs(v.x - p.x) > 120 || Math.abs(v.z - p.z) > 120 || v === p.vehicle) continue;
        const cop = v.type === 'police' && (v.siren || v.driver);
        x.save(); x.translate(v.x, v.z); x.rotate(v.h);
        x.fillStyle = cop ? (v.siren ? (Math.floor(t * 6) % 2 ? '#ff3048' : '#3d7bff') : '#7fb0ff') : v.wrecked ? '#333' : '#f1f1f1';
        const hl = v.halfLen * 1.3, hw = Math.max(1.1, v.halfWid * 1.7); x.fillRect(-hl, -hw, hl * 2, hw * 2); x.restore();
      }
      // hospital (red cross), police station (blue badge), pickups (small dots)
      for (const k in game.landmarks) {
        const m = game.landmarks[k], hosp = k === 'hospital';
        x.fillStyle = hosp ? '#ffffff' : '#2d55c8'; x.strokeStyle = '#111'; x.lineWidth = 1.5; x.beginPath(); x.arc(m.x, m.z, 6, 0, 7); x.fill(); x.stroke();
        x.fillStyle = hosp ? '#e8203a' : '#ffd34d';
        if (hosp) { x.fillRect(m.x - 1.4, m.z - 4, 2.8, 8); x.fillRect(m.x - 4, m.z - 1.4, 8, 2.8); } else { x.beginPath(); x.arc(m.x, m.z, 2.6, 0, 7); x.fill(); }
      }
      for (const it of game.pickups.list) {
        if (it.wait > 0 || Math.abs(it.x - p.x) > 120 || Math.abs(it.z - p.z) > 120) continue;
        x.fillStyle = it.kind === 'armor' ? '#4da6ff' : it.kind === 'health' ? '#5dff8a' : '#ffc94d';
        x.beginPath(); x.arc(it.x, it.z, 2.4, 0, 7); x.fill();
      }
      for (const o of game.police.officers) { x.fillStyle = Math.floor(t * 6) % 2 ? '#ff3048' : '#3d7bff'; x.beginPath(); x.arc(o.ped.x, o.ped.z, 2.2, 0, 7); x.fill(); }
      if (game.police.searching) { const k = game.police.lastKnown; x.strokeStyle = 'rgba(255,211,77,.9)'; x.lineWidth = 1.5; x.beginPath(); x.arc(k.x, k.z, 9 + Math.sin(t * 5) * 2, 0, 7); x.stroke(); }
      x.restore();
      // jobs: Scrap's (pink diamond), the car he wants (pink box), fares (gold). Far ones stick to the rim.
      const a = -yaw - Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a);
      for (const b of game.jobs.blips()) {
        const dx = (b.x - p.x) * SCALE, dz = (b.z - p.z) * SCALE;
        let sx = dx * ca - dz * sa, sy = dx * sa + dz * ca;
        const d = Math.hypot(sx, sy), max = R - 10, s = (d > max ? 5 : 6.5) + (b.hot ? Math.sin(t * 6) * 1.3 : 0);
        if (d > max) { sx *= max / d; sy *= max / d; }
        const cx = R + sx, cy = R + sy;
        x.globalAlpha = b.hot || d <= max ? 1 : .7;
        x.fillStyle = b.kind === 'chop' || b.kind === 'car' ? '#ff4fd8' : '#ffd34d'; x.strokeStyle = '#111'; x.lineWidth = 2; x.beginPath();
        if (b.kind === 'chop') { x.moveTo(cx, cy - s * 1.25); x.lineTo(cx + s * 1.25, cy); x.lineTo(cx, cy + s * 1.25); x.lineTo(cx - s * 1.25, cy); x.closePath(); }
        else if (b.kind === 'car') x.rect(cx - s, cy - s * .7, s * 2, s * 1.4);
        else x.arc(cx, cy, s, 0, 7);
        x.stroke(); x.fill();
        if (b.kind === 'dest') { x.fillStyle = '#111'; x.beginPath(); x.arc(cx, cy, s * .42, 0, 7); x.fill(); }
        x.globalAlpha = 1;
      }
      // activity markers (game.markers): a coloured disc with a letter; pinned ones stick to the rim when far away
      for (const m of game.markers) {
        if (m.visible && !m.visible()) continue;
        const dx = (m.x - p.x) * SCALE, dz = (m.z - p.z) * SCALE;
        let sx = dx * ca - dz * sa, sy = dx * sa + dz * ca;
        const d = Math.hypot(sx, sy), max = R - 10;
        if (d > max) { if (!m.pin) continue; sx *= max / d; sy *= max / d; }
        const cx = R + sx, cy = R + sy, s = (m.size || 7) * (d > max ? .8 : 1) + (m.hot ? Math.sin(t * 6) * 1.2 : 0);
        x.fillStyle = m.color; x.strokeStyle = '#111'; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, s, 0, 7); x.stroke(); x.fill();
        if (m.glyph) { x.fillStyle = m.ink || '#111'; x.font = `900 ${Math.round(s * 1.45)}px "Archivo Black",Impact,sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(m.glyph, cx, cy + .5); }
      }
      // the player: always centre, always pointing the way they face
      const heading = p.vehicle ? p.vehicle.h : Math.PI / 2 - p.face;
      x.save(); x.translate(R, R); x.rotate(heading - yaw);
      x.fillStyle = '#ffd34d'; x.strokeStyle = '#111'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, -9); x.lineTo(6.5, 7); x.lineTo(0, 3.5); x.lineTo(-6.5, 7); x.closePath(); x.stroke(); x.fill(); x.restore();
    },
  };
}
