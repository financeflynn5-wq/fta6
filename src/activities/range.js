// The Golden Acres gun range, in the field east of the old barn: stand at the counter and knock down the
// targets as they pop up. Any gun will do, and the range lends you a pistol if you turn up without one.
// Nobody calls the police about gunfire here while the clock is running.
import * as THREE from 'three';
import { WEAPONS } from '../config.js';
import { std } from '../world/materials.js';
import { groundY } from '../world/terrain.js';
import { cash, fmtTime } from './kit.js';

const YELLOW = 0xffe14d, R = .55, EYE = 1.35;
// where the targets stand, measured from the firing spot: [across, down range]
const LANES = [[-8, 15], [0, 14], [8, 15], [-12, 25], [-4, 26], [4, 25], [12, 26], [-14, 37], [-5, 38], [5, 37], [14, 38]];

const canvasTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };

export function createRange(A) {
  const { game, kit, cfg } = A, C = cfg.range, p = game.player, combat = game.combat, scene = game.scene;
  const box = (mat, x, y, z, w, h, d, cast = true) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; scene.add(m); return m; };

  // ---------- the range itself: a counter to shoot over, a sign, and a wall of hay to stop the bullets ----------
  const wood = std({ color: 0x9a744c, roughness: .85 }), dark = std({ color: 0x5b4330, roughness: .9 }), hay = std({ color: 0xdcb85c, roughness: 1 });
  const gy = groundY(C.x, C.z), cz = C.z + 2.6;
  box(wood, C.x, gy + .5, cz, 13, 1, .7); box(dark, C.x, gy + 1.03, cz, 13.4, .08, 1);
  game.physics.addWall(C.x, cz, 6.5, .4, 0, 'low', gy + 1.1);
  // the sign rides high on its posts, clear of the view over your shoulder
  for (const s of [-1, 1]) { box(dark, C.x + s * 7, gy + 3.6, cz, .24, 7.2, .24); game.physics.addWall(C.x + s * 7, cz, .15, .15, 0, 'solid', gy + 7.2); }
  const signTex = canvasTex(1024, 128, (x) => {
    x.fillStyle = '#2b2118'; x.fillRect(0, 0, 1024, 128); x.strokeStyle = '#ffe14d'; x.lineWidth = 8; x.strokeRect(6, 6, 1012, 116);
    x.fillStyle = '#ffe14d'; x.font = '900 74px "Archivo Black",Impact,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('GOLDEN ACRES GUN RANGE', 512, 68);
  });
  { const m = new THREE.Mesh(new THREE.BoxGeometry(14.2, 1.5, .14), [dark, dark, dark, dark, std({ map: signTex, roughness: .7 }), std({ map: signTex, roughness: .7 })]); m.position.set(C.x, gy + 6.5, cz); m.castShadow = true; scene.add(m); }
  { const bz = C.z + 46, by = groundY(C.x, bz); box(hay, C.x, by + 1.5, bz, 40, 3, 1.8); game.physics.addWall(C.x, bz, 20, .9, 0, 'solid', by + 3); }

  // the farm's hay bales are rolled out of the lanes (this runs before places.js stands them up)
  { const B = A.districts.breakables; for (let i = B.length - 1; i >= 0; i--) { const b = B[i]; if (b.kind === 'bale' && Math.abs(b.x - C.x) < 19 && b.z > C.z - 4 && b.z < C.z + 45) B.splice(i, 1); } }

  // ---------- the targets: a bullseye on a post that lies flat until it is its turn ----------
  const faceTex = canvasTex(256, 256, (x) => { for (const [r, c] of [[128, '#f4f1ea'], [100, '#e8203a'], [72, '#f4f1ea'], [44, '#e8203a'], [18, '#ffd34d']]) { x.fillStyle = c; x.beginPath(); x.arc(128, 128, r, 0, 7); x.fill(); } });
  const discGeo = new THREE.CylinderGeometry(R, R, .07, 28); discGeo.rotateX(Math.PI / 2); discGeo.translate(0, EYE, 0);
  const postGeo = new THREE.BoxGeometry(.09, EYE, .09); postGeo.translate(0, EYE / 2, .06);
  const rim = std({ color: 0xf4f1ea, roughness: .6 }), faceMat = std({ map: faceTex, roughness: .6 });
  const targets = LANES.map(([a, d]) => {
    const x = C.x + a, z = C.z + d, y = groundY(x, z), g = new THREE.Group();
    const disc = new THREE.Mesh(discGeo, [rim, faceMat, faceMat]), post = new THREE.Mesh(postGeo, dark); disc.castShadow = post.castShadow = true;
    g.add(disc, post); g.position.set(x, y + .04, z); g.rotation.x = Math.PI / 2; scene.add(g);
    return { x, y: y + .04 + EYE, z, g, up: 0, live: false, life: 0, rest: 0 };
  });

  let run = null;
  const o = new THREE.Vector3(), d = new THREE.Vector3();

  // One round has just left the barrel: which target (if any) was it pointing at?
  function shot() {
    const aimed = combat.aiming && combat.aimBlend > .35, w = combat.def;
    if (aimed) { o.copy(game.cam.origin); d.copy(game.cam.dir); } else { o.set(p.x, p.y + EYE, p.z); d.set(Math.cos(game.cam.yaw), 0, Math.sin(game.cam.yaw)); }
    const pad = (aimed ? .12 : .6) + (w.pellets > 1 ? .3 : 0);
    let best = null, bt = w.range;
    for (const tg of targets) {
      if (!tg.live) continue;
      const cx = tg.x - o.x, cy = tg.y - o.y, cz = tg.z - o.z, along = cx * d.x + cy * d.y + cz * d.z;
      if (along < 1 || along > bt || cx * cx + cy * cy + cz * cz - along * along > (R + pad) * (R + pad)) continue;
      best = tg; bt = along;
    }
    if (!best) return;
    best.live = false; best.rest = 1.2; run.hits++;
    game.audio.ting(); game.fx.spark(best.x, best.y, best.z, 6, .5);
  }
  function stop() { for (const tg of targets) tg.live = false; combat.quiet = false; run = null; A.end(); }

  const part = {
    abort(msg = 'RANGE CLOSED') { if (!run) return; if (msg) game.hud.toast(msg, 'bad'); stop(); },
    progress() { const b = kit.save.get('range.best', 0), m = kit.medal(b, C.medals); return ['Gun range', b ? `best ${b} hits${m ? ' · ' + m : ''}` : 'not tried']; },
    update(dt) {
      // the boards swing up and down whether or not anyone is shooting
      if (Math.abs(p.x - C.x) < 120 && Math.abs(p.z - C.z) < 120) for (const tg of targets) {
        const want = tg.live ? 1 : 0; if (tg.up === want) continue;
        tg.up = want ? Math.min(1, tg.up + dt * 7) : Math.max(0, tg.up - dt * 9); tg.g.rotation.x = (1 - tg.up) * Math.PI / 2;
      }
      if (!run) return;
      if (A.quitHeld(dt)) return part.abort();
      if (p.mode !== 'foot' || Math.hypot(p.x - C.x, p.z - C.z) > 9) return part.abort('YOU LEFT THE FIRING LINE');
      if (combat.lastShot !== run.shot) { run.shot = combat.lastShot; shot(); }
      // keep a few targets up
      let up = 0;
      for (const tg of targets) { tg.rest -= dt; if (tg.live && (tg.life -= dt) <= 0) { tg.live = false; tg.rest = .8; } if (tg.live) up++; }
      if (up < C.up && (run.gap -= dt) <= 0) {
        const free = targets.filter(tg => !tg.live && tg.rest <= 0);
        if (free.length) { const tg = free[Math.floor(Math.random() * free.length)]; tg.live = true; tg.life = C.stay; run.gap = .3; }
      }
      run.left -= dt;
      if (run.left <= 0) {
        const m = kit.medal(run.hits, C.medals), pay = run.hits * C.perHit + (m ? C.pay[m] : 0), best = kit.save.get('range.best', 0), isBest = run.hits > best;
        if (isBest) kit.save.set('range.best', run.hits);
        if (pay) game.addMoney(pay);
        kit.ui.banner(m ? m.toUpperCase() + '!' : run.hits ? 'TIME’S UP' : 'MISSED THE LOT', `${run.hits} hits  +${cash(pay)}${isBest && best ? '  NEW BEST' : ''}`, m || 'plain', 4.5);
        game.audio.evade(); return stop();
      }
      const next = run.hits < C.medals.bronze ? `bronze at ${C.medals.bronze}` : run.hits < C.medals.silver ? `silver at ${C.medals.silver}` : run.hits < C.medals.gold ? `gold at ${C.medals.gold}` : 'GOLD!';
      kit.ui.panel('GUN RANGE', fmtTime(run.left), `${run.hits} hits · ${next} · hold right mouse to aim`);
    },
  };

  A.starter({
    x: C.x, z: C.z, r: 2.6, color: YELLOW, glyph: 'T', mode: 'foot', name: 'GUN RANGE',
    info: () => { const b = kit.save.get('range.best', 0); return `${C.time} seconds of pop-up targets · ${cash(C.perHit)} a hit${b ? ` · best ${b}` : ''} · gold at ${C.medals.gold}`; },
    onStart: () => {
      // nothing to shoot with? The range lends a pistol.
      const loaded = (id) => !WEAPONS[id].melee && combat.clip[id] + combat.ammo[id] > 0;
      if (![...combat.owned].some(loaded)) { combat.give('pistol', C.lend); game.hud.toast('THE RANGE LENDS YOU A PISTOL', 'info'); }
      if (!loaded(combat.weapon)) combat.select([...combat.owned].filter(loaded).sort((a, b) => WEAPONS[a].slot - WEAPONS[b].slot)[0]);
      A.begin(part); combat.quiet = true;
      run = { hits: 0, left: C.time, gap: .8, shot: combat.lastShot };
      for (const tg of targets) { tg.live = false; tg.rest = 0; }
      kit.ui.banner('GUN RANGE', 'Knock the targets down as they pop up', 'go', 2.6); game.audio.star();
    },
  });
  return part;
}
