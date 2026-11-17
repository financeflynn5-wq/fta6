// Spray 'n' Scram: a drive-in paint shop downtown. Stop a car in the ring and, for a fee, it comes out
// fixed and a different colour. If no cop can see you drive in, they give up looking for the old one.
import * as THREE from 'three';
import { WORLD } from '../config.js';
import { ctex, paint } from '../world/materials.js';
import { frontage, hangSign } from '../world/landmarks.js';
import { cash } from './kit.js';

const MINT = 0x3df0b0;

function sprayTex(name) {
  const [top, ...rest] = name.split(' ');
  return ctex(1024, (x, s) => {
    const h = s / 2.3, y0 = (s - h) / 2;
    x.clearRect(0, 0, s, s);
    x.fillStyle = '#17181f'; x.beginPath(); x.roundRect(10, y0, s - 20, h, 40); x.fill();
    x.lineWidth = 14; x.strokeStyle = '#3df0b0'; x.stroke();
    // emblem: a spray can and three puffs of paint
    const cx = 70 + h * .3, cy = s / 2, r = h * .3;
    x.fillStyle = '#ffd34d'; x.beginPath(); x.roundRect(cx - r * .42, cy - r * .5, r * .84, r * 1.5, 14); x.fill();
    x.fillStyle = '#f4f1ea'; x.fillRect(cx - r * .2, cy - r * .82, r * .4, r * .32);
    for (const [dx, dy, c, q] of [[.9, -.95, '#ff4fd8', .2], [1.3, -.6, '#3de0ff', .16], [1.02, -.42, '#3df0b0', .12]]) { x.fillStyle = c; x.beginPath(); x.arc(cx + r * dx, cy + r * dy, r * q, 0, 7); x.fill(); }
    const tx = (cx + r * 1.5 + s - 30) / 2;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '900 150px "Archivo Black",Impact,sans-serif'; x.fillStyle = '#ffffff'; x.fillText(top, tx, cy - h * .2);
    x.font = '900 96px "Archivo Black",Impact,sans-serif'; x.fillStyle = '#3df0b0'; x.fillText(rest.join(' '), tx, cy + h * .23);
  });
}

export function createSpray(A) {
  const { game, kit, cfg } = A, C = cfg.spray, p = game.player, police = game.police;
  const [sx, sz] = C.side, half = WORLD.BLOCK / 2, mid = WORLD.PITCH / 2, pitch = WORLD.PITCH;
  const front = frontage(game.city.solids.boxes, C.block, C.side);
  const bx = mid + pitch * C.block[0], bz = mid + pitch * C.block[1];
  const spot = { x: sx ? bx + sx * (half + 3.6) : (front ? front.fx : bx), z: sz ? bz + sz * (half + 3.6) : (front ? front.fz : bz) };
  if (front) hangSign(game.scene, front, C.side, sprayTex(C.name));
  for (const v of game.traffic.vehicles.slice()) if (!v.driver && Math.hypot(v.x - spot.x, v.z - spot.z) < C.radius + 4) game.traffic.remove(v);   // keep the bay clear
  const mark = kit.marker(MINT, C.radius).place(spot.x, spot.z);
  kit.blip({ x: spot.x, z: spot.z, color: '#3df0b0', glyph: 'C', size: 7.5 });
  let dwell = 0, fresh = null, hinted = false;

  function respray(v) {
    game.damage.repair(v); v.health = v.stats.health; v.burn = undefined;
    // a new colour, on the models that have ordinary car paint (a cruiser keeps its livery)
    const u = v.mesh.userData, old = u.color;
    if (old !== undefined && v.type !== 'police') {
      const was = paint(old), pool = C.colors.filter(c => c !== old), next = pool[Math.floor(Math.random() * pool.length)], now = paint(next);
      let swapped = false;
      v.mesh.traverse(o => { if (o.isMesh && o.material === was) { o.material = now; swapped = true; } });
      if (swapped) u.color = next;
    }
    const lost = police.stars > 0 && !police.seen;
    if (lost) police.clear(false);
    game.addMoney(-C.price); kit.ui.flash(); game.audio.wrench?.();
    game.hud.toast(lost ? `FRESH PAINT. THE COPS ARE LOOKING FOR THE OLD ONE.  -${cash(C.price)}` : police.stars > 0 ? `FIXED AND PAINTED, BUT THE COPS SAW YOU GO IN  -${cash(C.price)}` : `FIXED AND PAINTED  -${cash(C.price)}`, lost || !police.stars ? 'good' : 'bad');
    game.env?.touch?.();
  }

  return {
    spot,
    update(dt, t) {
      mark.tick(t, p);
      const v = p.mode === 'car' ? p.vehicle : null, inside = !!v && mark.inside(p);
      if (!inside) { dwell = 0; if (!v || Math.hypot(p.x - spot.x, p.z - spot.z) > C.radius + 3) fresh = null; if (hinted) { hinted = false; if (!A.busy) kit.ui.hint(''); } return; }
      if (v === fresh || v.wrecked) return;
      const broke = game.money < C.price;
      // the start rings own the hint line when nothing is running; this only speaks up while you are in the bay
      if (!A.busy) { kit.ui.hint(`<b>${C.name}</b>${broke ? `You need ${cash(C.price)}` : p.speed < 2.5 ? 'Spraying…' : 'Stop here'}<em>Repair and a new colour for ${cash(C.price)} · shakes the cops if they can't see you</em>`); hinted = true; }
      dwell = !broke && p.speed < 2.5 && !game.over ? dwell + dt : 0;
      if (dwell > .8) { dwell = 0; fresh = v; respray(v); }
    },
  };
}
