// Keyboard input state.
const keys = new Set();
let anyKey = false;

export function initInput() {
  window.addEventListener('keydown', (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    keys.add(e.code);
    anyKey = true;
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
}

export function down(code) { return keys.has(code); }
export function axis() {
  // returns {throttle:-1..1, steer:-1..1} from WASD/arrows
  let throttle = 0, steer = 0;
  if (down('KeyW') || down('ArrowUp')) throttle += 1;
  if (down('KeyS') || down('ArrowDown')) throttle -= 1;
  if (down('KeyA') || down('ArrowLeft')) steer += 1;
  if (down('KeyD') || down('ArrowRight')) steer -= 1;
  return { throttle, steer };
}
export function pressed(code) {
  if (keys.has(code)) { keys.delete(code); return true; }
  return false;
}
export function consumeAnyKey() { const v = anyKey; anyKey = false; return v; }
