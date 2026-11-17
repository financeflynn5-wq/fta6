// Talking scenes for story mode: a face, a name and a line of text along the bottom of the screen.
// The world keeps going while people talk, but you stand still. E (or Space) is next, Enter skips the lot.
import { makeCharacter } from '../characters/models.js';

// Who can speak: the name over the line, which character model to draw, and the colour of the name.
export const CAST = {
  rocco: { name: 'ROCCO', kind: 'rocco', tint: '#ff8a9c' },
  sal: { name: 'BIG SAL', kind: 'sal', tint: '#ffd34d' },
  tiff: { name: 'TIFF', kind: 'tiff', tint: '#3de0ff' },
  dale: { name: 'OFFICER DALE', kind: 'dale', tint: '#8fb8ff' },
  scrap: { name: 'SCRAP', kind: 'scrap', tint: '#ff8ae6' },
  posse: { name: 'POSSUM POSSE', kind: 'possum', tint: '#ff6b86' },
};

const SPEED = 55;      // letters a second

export function createDialogue(game) {
  const hud = document.getElementById('hud');
  const bars = document.createElement('div'); bars.className = 'talkBars'; hud.appendChild(bars);
  const box = document.createElement('div'); box.className = 'talk'; box.hidden = true;
  box.innerHTML = '<canvas width="160" height="160"></canvas><div><b></b><p></p><small><kbd>E</kbd> next <i>·</i> <kbd>Enter</kbd> skip</small></div>';
  hud.appendChild(box);
  const face = box.querySelector('canvas'), name = box.querySelector('b'), words = box.querySelector('p');
  const faces = {};          // one drawn portrait per speaker, made the first time they speak
  let lines = null, at = 0, shown = 0, done = null, who = null;

  function portrait(id) {
    if (faces[id]) return faces[id];
    const c = faces[id] = document.createElement('canvas'); c.width = c.height = game.who.size;
    const m = makeCharacter(CAST[id].kind, { props: false });
    try { game.who.portrait(m, c); } catch (e) { /* no face is better than no story */ }
    m.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
    return c;
  }
  function show() {
    const [id, text] = lines[at], c = CAST[id] || CAST.rocco;
    if (id !== who) {
      who = id; name.textContent = c.name; name.style.color = c.tint;
      const x = face.getContext('2d'); x.clearRect(0, 0, 160, 160); x.drawImage(portrait(CAST[id] ? id : 'rocco'), 0, 0, 160, 160);
      box.classList.toggle('left', id !== 'rocco'); void box.offsetWidth;
    }
    shown = 0; words.textContent = ''; words.dataset.full = text;
    game.audio.click();
  }
  function end() {
    const cb = done; lines = null; done = null; who = null; box.hidden = true; bars.classList.remove('on');
    if (!game.over) game.player.frozen = false;
    game.indoors.busy = false;
    cb?.();
  }
  function next() {
    if (!lines) return;
    const full = lines[at][1];
    if (shown < full.length) { shown = full.length; words.textContent = full; return; }
    if (++at >= lines.length) end(); else show();
  }

  window.addEventListener('keydown', (e) => {
    if (!lines || e.repeat || game.state !== 'playing') return;
    if (e.code === 'KeyE' || e.code === 'Space') next();
    else if (e.code === 'Enter') end();
  });

  const talk = {
    get active() { return !!lines; },
    // lines: [[who, text], ...]. then() runs when the last line has been read (or the scene was skipped).
    play(list, then) {
      if (!list?.length) { then?.(); return; }
      lines = list; at = 0; done = then; who = null; box.hidden = false; bars.classList.add('on');
      game.player.frozen = true; game.indoors.busy = true;
      show();
    },
    stop() { if (lines) { done = null; end(); } },          // the scene is cut short and then() never runs
    next, skip: end,
    update(dt) {
      if (!lines) return;
      if (game.over) { talk.stop(); return; }
      game.player.frozen = true;
      const full = lines[at][1];
      if (shown < full.length) { shown = Math.min(full.length, shown + dt * SPEED); words.textContent = full.slice(0, Math.floor(shown)); }
    },
  };
  return talk;
}
