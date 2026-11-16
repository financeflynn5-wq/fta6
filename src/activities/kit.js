// Shared bits every activity uses: glowing ground markers, the activity panel on the HUD,
// the big centre banner, and a tiny save file for best times and things found.
import * as THREE from 'three';
import { groundY } from '../world/terrain.js';

const tex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')); return new THREE.CanvasTexture(c); };
const fadeTex = tex(4, 128, (x) => { const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,1)'); x.fillStyle = g; x.fillRect(0, 0, 4, 128); });
const ringTex = tex(256, 256, (x) => {
  const g = x.createRadialGradient(128, 128, 70, 128, 128, 126); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.45, 'rgba(255,255,255,.22)'); g.addColorStop(.8, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
});
const glow = (color, map, opacity) => new THREE.MeshBasicMaterial({ map, color: new THREE.Color(color).multiplyScalar(1.5), opacity, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
const wallGeo = new THREE.CylinderGeometry(1, 1, 1, 36, 1, true), beamGeo = new THREE.CylinderGeometry(.4, .4, 70, 8, 1, true);
const flatGeo = new THREE.PlaneGeometry(2.5, 2.5); flatGeo.rotateX(-Math.PI / 2);

export const fmtTime = (s) => { const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r < 10 ? '0' : ''}${r.toFixed(1)}`; };
export const cash = (n) => '$' + Math.round(n).toLocaleString('en-US');

export function createKit(game) {
  // ---------- ground markers ----------
  // A ring on the ground with a low wall of light; beam = a tall line you can see from far away.
  function marker(color, radius, beam = false) {
    const g = new THREE.Group();
    const wall = new THREE.Mesh(wallGeo, glow(color, fadeTex, .45)); wall.scale.set(radius, 2, radius); wall.position.y = 1;
    const ring = new THREE.Mesh(flatGeo, glow(color, ringTex, .8)); ring.scale.setScalar(radius); ring.position.y = .07;
    g.add(wall, ring);
    let b = null; if (beam) { b = new THREE.Mesh(beamGeo, glow(color, fadeTex, .45)); b.position.y = 35; g.add(b); }
    g.visible = false; game.scene.add(g);
    const m = {
      x: 0, z: 0, r: radius, on: false,
      place(x, z, y = null) { m.x = x; m.z = z; g.position.set(x, y ?? groundY(x, z), z); g.visible = m.on = true; return m; },
      hide() { g.visible = m.on = false; },
      // cheap: only animate (and draw) when the player is near enough to see it
      tick(t, p, far = 260) { if (!m.on) return; const near = Math.abs(m.x - p.x) < far && Math.abs(m.z - p.z) < far; g.visible = near; if (near) { wall.material.opacity = .32 + Math.sin(t * 4 + m.x) * .1; wall.scale.y = 2 + Math.sin(t * 2.2 + m.z) * .25; } },
      inside(p, extra = 0) { return m.on && Math.hypot(p.x - m.x, p.z - m.z) < m.r + extra; },
      setColor(c) { for (const o of g.children) o.material.color.set(c).multiplyScalar(1.5); },
    };
    return m;
  }

  // ---------- HUD: activity panel (top centre), banner (middle), hint (above the prompt) ----------
  const hud = document.getElementById('hud');
  const el = (cls) => { const d = document.createElement('div'); d.className = cls; d.hidden = true; hud.appendChild(d); return d; };
  const panel = el('act'), banner = el('actBanner'), hint = el('actHint');
  let panelHtml = '', hintHtml = '', bannerT = 0;
  const ui = {
    // title + big value + small line under it
    panel(title, value = '', sub = '') { const h = title ? `<b>${title}</b><i>${value}</i><span>${sub}</span>` : ''; if (h !== panelHtml) { panel.innerHTML = h; panel.hidden = !h; panelHtml = h; } },
    hint(text) { if (text !== hintHtml) { hint.innerHTML = text; hint.hidden = !text; hintHtml = text; } },
    banner(big, small = '', cls = '', secs = 2.6) { banner.className = 'actBanner ' + cls; banner.innerHTML = `<b>${big}</b><span>${small}</span>`; banner.hidden = false; bannerT = secs; void banner.offsetWidth; banner.classList.add('show'); },
    update(dt) { if (bannerT > 0 && (bannerT -= dt) <= 0) banner.hidden = true; },
  };

  // ---------- save file ----------
  const KEY = 'fta6.activities.v1';
  let data = {};
  try { data = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { data = {}; }
  const save = {
    get: (k, fallback) => (k in data ? data[k] : fallback),
    set(k, v) { data[k] = v; try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* private window: keep it in memory */ } },
    wipe() { data = {}; try { localStorage.removeItem(KEY); } catch (e) { } },
  };

  // radar blip helper: adds to game.markers and returns the blip so it can be changed or removed
  const blip = (o) => { game.markers.push(o); return o; };
  const unblip = (o) => { const i = game.markers.indexOf(o); if (i >= 0) game.markers.splice(i, 1); };

  return { marker, ui, save, blip, unblip };
}
