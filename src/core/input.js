// Keyboard + mouse. Systems read `input.down(...)` for held keys and `input.hit(...)`
// for a key pressed since the last game step.
export function createInput(canvas) {
  const held = new Set(), pressed = new Set();
  const input = {
    mouseDX: 0, mouseDY: 0, wheel: 0, locked: false, lastMouse: 0, enabled: false,
    down: (...codes) => codes.some(c => held.has(c)),
    hit: (...codes) => codes.some(c => pressed.has(c)),
    axis: (neg, pos) => (pos.some(c => held.has(c)) ? 1 : 0) - (neg.some(c => held.has(c)) ? 1 : 0),
    endStep() { pressed.clear(); },
    takeMouse() { const m = [input.mouseDX, input.mouseDY]; input.mouseDX = input.mouseDY = 0; return m; },
    lock() { canvas.requestPointerLock?.()?.catch?.(() => { }); },
    press(code) { pressed.add(code); },   // for tests / on-screen buttons
    hold(code, on = true) { if (on) { held.add(code); pressed.add(code); } else held.delete(code); },
    takeWheel() { const w = input.wheel; input.wheel = 0; return w; },
  };
  const gameKeys = /^(Arrow|Space|Key[WASDEFHTQMCR]|Shift|Tab|Digit[1-6])/;
  window.addEventListener('keydown', e => {
    if (e.repeat) { if (gameKeys.test(e.code)) e.preventDefault(); return; }
    held.add(e.code); pressed.add(e.code);
    if (gameKeys.test(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', e => held.delete(e.code));
  window.addEventListener('blur', () => held.clear());
  document.addEventListener('pointerlockchange', () => { input.locked = document.pointerLockElement === canvas; });
  let drag = false;
  // mouse buttons count as keys: Mouse0 = left (fire / punch), Mouse2 = right (aim).
  // These are mouse events on purpose. Pointer events only report the FIRST button that goes down:
  // with right held to aim, a left click sends no pointerdown at all, so the gun never fired.
  // The click that captures the mouse doesn't also fire.
  canvas.addEventListener('mousedown', (e) => {
    if (!input.enabled) return;
    if (!input.locked) { input.lock(); drag = true; return; }
    held.add('Mouse' + e.button); pressed.add('Mouse' + e.button);
  });
  window.addEventListener('mouseup', (e) => { drag = false; held.delete('Mouse' + e.button); });
  // a button let go while the browser wasn't telling us (outside the window, over a menu) must not stay stuck down
  const BUTTON_BIT = [1, 4, 2, 8, 16];
  const dropReleased = (e) => { for (let b = 0; b < 5; b++) if (!(e.buttons & BUTTON_BIT[b])) held.delete('Mouse' + b); };
  document.addEventListener('pointerlockchange', () => { if (!input.locked) for (let b = 0; b < 5; b++) held.delete('Mouse' + b); });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('wheel', (e) => { if (input.enabled && input.locked) input.wheel += Math.sign(e.deltaY); }, { passive: true });
  window.addEventListener('mousemove', e => {
    dropReleased(e);
    if (!input.enabled || !(input.locked || drag)) return;
    input.mouseDX += e.movementX; input.mouseDY += e.movementY; input.lastMouse = performance.now();
  });
  return input;
}
