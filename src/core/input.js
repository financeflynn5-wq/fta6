// Keyboard + mouse. Systems read `input.down(...)` for held keys and `input.hit(...)`
// for a key pressed since the last game step.
export function createInput(canvas) {
  const held = new Set(), pressed = new Set();
  const input = {
    mouseDX: 0, mouseDY: 0, locked: false, lastMouse: 0, enabled: false,
    down: (...codes) => codes.some(c => held.has(c)),
    hit: (...codes) => codes.some(c => pressed.has(c)),
    axis: (neg, pos) => (pos.some(c => held.has(c)) ? 1 : 0) - (neg.some(c => held.has(c)) ? 1 : 0),
    endStep() { pressed.clear(); },
    takeMouse() { const m = [input.mouseDX, input.mouseDY]; input.mouseDX = input.mouseDY = 0; return m; },
    lock() { canvas.requestPointerLock?.()?.catch?.(() => { }); },
    press(code) { pressed.add(code); },   // for tests / on-screen buttons
  };
  const gameKeys = /^(Arrow|Space|Key[WASDEFHTQMCR]|Shift|Tab)/;
  window.addEventListener('keydown', e => {
    if (e.repeat) { if (gameKeys.test(e.code)) e.preventDefault(); return; }
    held.add(e.code); pressed.add(e.code);
    if (gameKeys.test(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', e => held.delete(e.code));
  window.addEventListener('blur', () => held.clear());
  document.addEventListener('pointerlockchange', () => { input.locked = document.pointerLockElement === canvas; });
  let drag = false;
  canvas.addEventListener('pointerdown', () => { if (!input.enabled) return; if (!input.locked) input.lock(); drag = true; });
  window.addEventListener('pointerup', () => drag = false);
  window.addEventListener('mousemove', e => {
    if (!input.enabled || !(input.locked || drag)) return;
    input.mouseDX += e.movementX; input.mouseDY += e.movementY; input.lastMouse = performance.now();
  });
  return input;
}
