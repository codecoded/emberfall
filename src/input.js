// Keyboard + gamepad input with edge detection.
const MAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  Space: 'jump', KeyZ: 'jump', KeyK: 'jump', KeyX: 'attack', KeyJ: 'attack', Enter: 'start', KeyP: 'pause', Escape: 'pause',
  KeyM: 'mute', KeyF: 'full',
};
const ACTIONS = [...new Set(Object.values(MAP))];
const held = {}, queued = {}, now = {}, prev = {};
let onAny = null;

addEventListener('keydown', (e) => {
  const a = MAP[e.code];
  if (a) { if (!e.repeat) queued[a] = true; held[a] = true; e.preventDefault(); }
  if (onAny) onAny();
});
addEventListener('keyup', (e) => { const a = MAP[e.code]; if (a) held[a] = false; });
addEventListener('blur', () => { for (const a of ACTIONS) held[a] = false; });
addEventListener('pointerdown', () => { if (onAny) onAny(); });

function pad() {
  const o = {};
  const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null;
  if (!gp) return o;
  const b = (i) => gp.buttons[i] && gp.buttons[i].pressed;
  const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
  o.left = ax < -0.4 || b(14); o.right = ax > 0.4 || b(15); o.up = ay < -0.6 || b(12); o.down = ay > 0.6 || b(13);
  o.jump = b(0); o.attack = b(2) || b(1); o.start = b(9); o.pause = b(8);
  return o;
}

export const Input = {
  update() {
    const p = pad();
    for (const a of ACTIONS) { prev[a] = now[a]; now[a] = !!(held[a] || queued[a] || p[a]); queued[a] = false; }
  },
  down: (a) => !!now[a],
  pressed: (a) => !!now[a] && !prev[a],
  released: (a) => !now[a] && !!prev[a],
  onAny(fn) { onAny = fn; },
};
