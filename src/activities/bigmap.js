// Hold Tab: the whole of Sunset Coast, with everything there is to do and how much of it you've done.
// Drawn with north (the valley, then the hills) at the top and the beach at the bottom. The game keeps running underneath.
const PLACES = [['VISTA HEIGHTS', 0, 300], ['PORT SUNSET', 300, -20], ['THE DUSTLANDS', -250, 40], ['SUNSET BEACH', 0, -268], ['DOWNTOWN', 0, 0], ['WHISPER WOODS', -262, 292], ['LIGHTHOUSE BLUFFS', 222, 262], ['SUNSET ZOO', 312, 284], ['PALM PROMENADE', 0, -193],
  ['PALMVIEW', -243, 594], ['FLAMINGO PARK', -81, 600], ['CORAL PLAZA', 81, 560], ['MARLIN BAY', 292, 600], ['GOLDEN ACRES', -160, 770], ['FORT PELICAN', 190, 800]];
const KEY = [['#3de0ff', 'R', 'Race'], ['#ff8a3d', 'J', 'Stunt jump'], ['#ff6b3d', 'P', 'Pizza run'], ['#ffffff', 'S', 'Speed camera'], ['#ff4d6d', 'B', 'Car bowling'], ['#7fb0ff', 'W', 'Bounty hunt'], ['#b980ff', 'D', 'Derby'], ['#b4f03c', 'M', 'Smash spree'], ['#ffe14d', 'T', 'Gun range'], ['#3df0b0', 'C', 'Spray shop'], ['#6dff8a', 'S', 'Story job'], ['#ff4fd8', '', 'Scrap\'s chop shop'], ['#ffd34d', '', 'Golden tin (when close)'], ['#ffffff', '', 'Open door: shop, diner or lobby'], ['#ff8a3d', 'G', 'Gun shop'], ['#19b6a4', 'H', 'Helicopter'], ['#35c7e0', '⚓', 'Boat'], ['#c58bff', 'V', 'Gang corner (also K and P)'], ['#ff4d8d', 'Y', 'The Tipsy Possum'], ['#ffd34d', 'Z', 'Sunset Zoo'], ['#ff3b30', '', 'Shark, or a zoo animal on the loose'],
  ['#fff3dc', '<img src="assets/mousebear/logo.png" alt="" style="width:18px;height:18px;border-radius:50%">', 'Mouse Bear Trucking']];

export function createBigMap(A) {
  const { game } = A, p = game.player, mini = game.minimap;
  const wrap = document.createElement('div'); wrap.className = 'bigMap'; wrap.hidden = true;
  wrap.innerHTML = `<canvas></canvas><aside><h3>SUNSET COAST</h3><ul class="done"></ul><ul class="key">${KEY.map(([c, g, n]) => `<li><i style="background:${c}">${g}</i>${n}</li>`).join('')}</ul><p>Stop in a glowing ring to start. Hold <kbd>X</kbd> to quit.</p></aside>`;
  document.getElementById('hud').appendChild(wrap);
  const cv = wrap.querySelector('canvas'), done = wrap.querySelector('.done'), W = 640, k = W / (mini.half * 2), H = Math.round((mini.half + mini.top) * k), c = W / 2, n = mini.top * k;
  cv.width = W; cv.height = H; const x = cv.getContext('2d');
  const sx = (wx) => c - wx * k, sy = (wz) => n - wz * k;        // north is up, so the map is turned half round
  let shown = false, wait = 0, doneHtml = '';

  function disc(wx, wz, r, fill, glyph, ink = '#111', img = null) {
    const X = sx(wx), Y = sy(wz);
    x.fillStyle = fill; x.strokeStyle = '#111'; x.lineWidth = 2; x.beginPath(); x.arc(X, Y, r, 0, 7); x.stroke(); x.fill();
    if (img?.complete && img.naturalWidth) x.drawImage(img, X - r, Y - r, r * 2, r * 2);
    else if (glyph) { x.fillStyle = ink; x.font = `900 ${Math.round(r * 1.45)}px "Archivo Black",Impact,sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(glyph, X, Y + .5); }
  }
  function draw(t) {
    x.clearRect(0, 0, W, H);
    x.save(); x.translate(c, n); x.scale(k, k); x.rotate(Math.PI); x.drawImage(mini.plan, -mini.half, -mini.half); x.restore();
    // district names
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '900 13px "Archivo Black",Impact,sans-serif'; x.lineWidth = 4; x.strokeStyle = 'rgba(10,12,18,.75)'; x.fillStyle = 'rgba(255,255,255,.92)';
    for (const [name, wx, wz] of PLACES) { x.strokeText(name, sx(wx), sy(wz)); x.fillText(name, sx(wx), sy(wz)); }
    // hospital and police station
    for (const key in game.landmarks) { const m = game.landmarks[key], hosp = key === 'hospital'; disc(m.x, m.z, 8, hosp ? '#ffffff' : '#2d55c8', hosp ? '+' : '★', hosp ? '#e8203a' : '#ffd34d'); }
    // everything on the radar
    for (const m of game.markers) if (!m.visible || m.visible()) disc(m.x, m.z, (m.size || 7) * 1.15 + (m.hot ? Math.sin(t * 6) * 1.5 : 0), m.color, m.glyph, m.ink, m.img);
    for (const b of game.jobs.blips()) {
      const X = sx(b.x), Y = sy(b.z), s = 8 + (b.hot ? Math.sin(t * 6) * 1.5 : 0);
      x.fillStyle = b.kind === 'chop' || b.kind === 'car' ? '#ff4fd8' : '#ffd34d'; x.strokeStyle = '#111'; x.lineWidth = 2; x.beginPath();
      if (b.kind === 'chop') { x.moveTo(X, Y - s * 1.25); x.lineTo(X + s * 1.25, Y); x.lineTo(X, Y + s * 1.25); x.lineTo(X - s * 1.25, Y); x.closePath(); } else if (b.kind === 'car') x.rect(X - s, Y - s * .7, s * 2, s * 1.4); else x.arc(X, Y, s, 0, 7);
      x.stroke(); x.fill();
    }
    // you: the arrow points the way you face. World heading h (x toward z) becomes a screen angle on the turned-round map.
    const h = p.vehicle ? p.vehicle.h : Math.PI / 2 - p.face;
    x.save(); x.translate(sx(p.x), sy(p.z)); x.rotate(h - Math.PI / 2); x.scale(1.5, 1.5);
    x.fillStyle = '#ffd34d'; x.strokeStyle = '#111'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, -9); x.lineTo(6.5, 7); x.lineTo(0, 3.5); x.lineTo(-6.5, 7); x.closePath(); x.stroke(); x.fill(); x.restore();
  }

  return {
    update(dt, held) {
      if (held !== shown) {
        shown = held; wrap.hidden = !held; wait = 0;
        if (held) { const html = A.progress().map(([n, v]) => `<li><b>${n}</b><span>${v}</span></li>`).join(''); if (html !== doneHtml) done.innerHTML = doneHtml = html; }
      }
      if (shown && (wait -= dt) <= 0) { wait = .1; draw(game.time); }
    },
  };
}
