// "Play as" on the title and pause menus: a row of portraits. Picking one swaps your body on
// the spot (same place, same guns, same cash). The last pick is remembered; a rolled Big Head
// keeps their look until you roll again.
import * as THREE from 'three';
import { makeCharacter, PLAYABLE } from '../characters/models.js';

const SIZE = 160;

export function createWhoPicker(game) {
  const { renderer } = game.engine, player = game.player;
  const rt = new THREE.WebGLRenderTarget(SIZE, SIZE, { samples: 4 });
  const stage = new THREE.Scene(); stage.environment = game.scene.environment;
  stage.add(new THREE.HemisphereLight(0xfff0e0, 0x8a7a66, .55));
  const key = new THREE.DirectionalLight(0xffe2b8, .9); key.position.set(3, 5, 6); stage.add(key);
  const camera = new THREE.PerspectiveCamera(24, 1, .1, 30), px = new Uint8Array(SIZE * SIZE * 4), keep = new THREE.Color();
  const srgb = new Uint8ClampedArray(256); for (let i = 0; i < 256; i++) srgb[i] = Math.round(255 * Math.pow(i / 255, 1 / 2.2));

  // Head and shoulders of a (freshly made, standing) character, drawn into a 2D canvas.
  function portrait(model, canvas) {
    const hy = model.userData.head.position.y, big = !!model.userData.big;
    stage.add(model); model.rotation.y = .38; model.updateMatrixWorld(true);
    camera.position.set(.2, hy + .2, big ? 5.4 : 4.2); camera.lookAt(0, hy - (big ? .1 : .14), 0);
    const target = renderer.getRenderTarget(), alpha = renderer.getClearAlpha(); renderer.getClearColor(keep);
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(stage, camera);
    renderer.readRenderTargetPixels(rt, 0, 0, SIZE, SIZE, px);
    renderer.setRenderTarget(target); renderer.setClearColor(keep, alpha);
    stage.remove(model); model.rotation.y = 0;
    const img = new ImageData(SIZE, SIZE), d = img.data;
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {        // flip, undo the premultiplied edges, linear -> sRGB
      const s = ((SIZE - 1 - y) * SIZE + x) * 4, o = (y * SIZE + x) * 4, a = px[s + 3], k = a ? 255 / a : 0;
      d[o] = srgb[Math.min(255, Math.round(px[s] * k))]; d[o + 1] = srgb[Math.min(255, Math.round(px[s + 1] * k))]; d[o + 2] = srgb[Math.min(255, Math.round(px[s + 2] * k))]; d[o + 3] = a;
    }
    canvas.getContext('2d').putImageData(img, 0, 0);
  }
  const scrap = (model) => model.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
  const savedLook = () => { try { return JSON.parse(localStorage.getItem('fta6.look') || 'null') || undefined; } catch { return undefined; } };

  const rows = [...document.querySelectorAll('.who')], faces = {};       // faces[id]: one master canvas per choice
  for (const [id] of PLAYABLE) {
    const c = faces[id] = document.createElement('canvas'); c.width = c.height = SIZE;
    const mine = id === player.who;                       // show who you actually are, including a remembered random look
    const m = mine && id === 'bighead' ? makeCharacter(id, { props: false, look: player.model.userData.look }) : makeCharacter(id, { props: false, look: id === 'bighead' ? savedLook() : undefined });
    portrait(m, c); scrap(m);
  }
  const name = (id) => PLAYABLE.find(([k]) => k === id)[1];
  function refresh() {
    for (const row of rows) for (const b of row.querySelectorAll('button')) {
      const id = b.dataset.who, on = id === player.who; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
      const c = b.querySelector('canvas'), x = c.getContext('2d'); x.clearRect(0, 0, SIZE, SIZE); x.drawImage(faces[id], 0, 0);
    }
    const you = player.who === 'bighead' ? 'a Big Head' : name(player.who);
    const tag = document.getElementById('whoTag'); if (tag) tag.textContent = `You are ${you}.`;
  }
  function pick(id) {
    if (id === player.who && id !== 'bighead') return;
    let model;
    if (id === 'bighead') {                               // every click rolls a new one
      model = makeCharacter(id, { props: false }); portrait(model, faces[id]);
      try { localStorage.setItem('fta6.look', JSON.stringify(model.userData.look)); } catch { /* fine */ }
    }
    player.setCharacter(id, model); refresh();
    if (game.state !== 'title') game.hud.toast(id === 'bighead' ? 'NEW FACE IN TOWN' : `YOU ARE ${name(id).toUpperCase()}`, 'info');
  }
  for (const row of rows) {
    const label = document.createElement('span'); label.textContent = 'Play as'; row.append(label);
    for (const [id, text] of PLAYABLE) {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.who = id; b.title = id === 'bighead' ? 'Roll a new Big Head' : text;
      const c = document.createElement('canvas'); c.width = c.height = SIZE; const s = document.createElement('small'); s.textContent = id === 'bighead' ? 'Random' : text;
      b.append(c, s); b.addEventListener('click', () => pick(id)); row.append(b);
    }
    row.hidden = false;
  }
  refresh();
  return { pick, refresh };
}
