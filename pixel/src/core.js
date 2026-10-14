// EMBERFALL Classic — core: constants, math, colour, canvas helpers, input.

export const W = 384, H = 216, TS = 16;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);

// ---------- hashing / noise ----------
export function hash(x, y = 0, s = 0) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul((s | 0) + 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mod = (a, n) => ((a % n) + n) % n;

// 1D value noise, periodic with integer `period` (in lattice units).
export function noise1(x, period, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const a = hash(mod(i, period), 0, seed), b = hash(mod(i + 1, period), 0, seed);
  return lerp(a, b, smooth(f));
}
export function fbm1(x, period, seed = 0, oct = 4) {
  let v = 0, amp = 0.5, tot = 0;
  for (let o = 0; o < oct; o++) {
    v += noise1(x, period, seed + o * 17) * amp;
    tot += amp; amp *= 0.5; x *= 2; period *= 2;
  }
  return v / tot;
}
// 2D value noise, periodic in x.
export function noise2(x, y, px, seed = 0) {
  const i = Math.floor(x), j = Math.floor(y), fx = smooth(x - i), fy = smooth(y - j);
  const i0 = mod(i, px), i1 = mod(i + 1, px);
  return lerp(lerp(hash(i0, j, seed), hash(i1, j, seed), fx), lerp(hash(i0, j + 1, seed), hash(i1, j + 1, seed), fx), fy);
}
export function fbm2(x, y, px, seed = 0, oct = 3) {
  let v = 0, amp = 0.5, tot = 0;
  for (let o = 0; o < oct; o++) {
    v += noise2(x, y, px, seed + o * 31) * amp;
    tot += amp; amp *= 0.5; x *= 2; y *= 2; px *= 2;
  }
  return v / tot;
}

export const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
export const bayer = (x, y) => BAYER[(x & 3) + ((y & 3) << 2)];

// ---------- colour (Amiga OCS 12-bit) ----------
// Colours are written as '#rgb' (natively 12 bit). C() -> [r,g,b].
const _cc = {};
export function C(s) {
  let c = _cc[s];
  if (!c) {
    c = _cc[s] = s.length === 4
      ? [parseInt(s[1], 16) * 17, parseInt(s[2], 16) * 17, parseInt(s[3], 16) * 17]
      : [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
  }
  return c;
}
export const q12 = (v) => clamp(Math.round(v / 17), 0, 15) * 17;
export const css = (c) => `rgb(${q12(c[0])},${q12(c[1])},${q12(c[2])})`;
export const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
// Sample a ramp of colours (array of [r,g,b]) at t in 0..1 (linear, unquantised).
export function ramp(stops, t) {
  t = clamp(t, 0, 1) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(t));
  return mixc(stops[i], stops[i + 1], t - i);
}
// Pick a discrete ramp entry with ordered dithering between neighbours.
export function rampD(stops, t, x, y) {
  const v = clamp(t, 0, 1) * (stops.length - 1);
  return stops[clamp(Math.floor(v + bayer(x, y)), 0, stops.length - 1)];
}
// gradient with positioned stops: [[pos, [r,g,b]], ...]
export function grad(stops, t) {
  if (t <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const a = stops[i - 1], b = stops[i];
      return mixc(a[1], b[1], (t - a[0]) / (b[0] - a[0]));
    }
  }
  return stops[stops.length - 1][1];
}

// ---------- canvas helpers ----------
export function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0);
  c.g = c.getContext('2d', { willReadFrequently: true });
  c.g.imageSmoothingEnabled = false;
  return c;
}
export function rect(g, x, y, w, h, col) { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), w, h); }
export function px(g, x, y, col) { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), 1, 1); }
export function line(g, x0, y0, x1, y1, col, t = 1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  g.fillStyle = col;
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  for (let n = 0; n < 400; n++) {
    g.fillRect(x0, y0, t, t);
    if (x0 === x1 && y0 === y1) break;
    const e2 = err * 2;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
}
export function disc(g, cx, cy, r, col) { ellipse(g, cx, cy, r, r, col); }
export function ellipse(g, cx, cy, rx, ry, col) {
  g.fillStyle = col;
  if (rx <= 0 || ry <= 0) return;
  for (let y = Math.ceil(-ry); y <= Math.floor(ry); y++) {
    const hw = rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry)));
    const x0 = Math.round(cx - hw), x1 = Math.round(cx + hw);
    g.fillRect(x0, Math.round(cy + y), Math.max(1, x1 - x0), 1);
  }
}
// Filled triangle / polygon with hard pixel edges (scanline).
export function poly(g, pts, col) {
  g.fillStyle = col;
  let y0 = Infinity, y1 = -Infinity;
  for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  y0 = Math.round(y0); y1 = Math.round(y1);
  for (let y = y0; y <= y1; y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const xa = Math.round(xs[i]), xb = Math.round(xs[i + 1]);
      g.fillRect(xa, y, Math.max(1, xb - xa), 1);
    }
  }
}
// Force every pixel to 12-bit colour and binary alpha.
export function quantize(cv) {
  const im = cv.g.getImageData(0, 0, cv.width, cv.height), d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) { d[i + 3] = 0; continue; }
    d[i + 3] = 255;
    d[i] = ((d[i] + 8) / 17 | 0) * 17; d[i + 1] = ((d[i + 1] + 8) / 17 | 0) * 17; d[i + 2] = ((d[i + 2] + 8) / 17 | 0) * 17;
  }
  cv.g.putImageData(im, 0, 0);
  return cv;
}
// Build a canvas from a per-pixel function returning [r,g,b] or null (transparent).
export function pixelCanvas(w, h, fn) {
  const cv = mk(w, h), im = cv.g.createImageData(w, h), d = im.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = fn(x, y);
    if (!c) continue;
    const i = (y * w + x) * 4;
    d[i] = q12(c[0]); d[i + 1] = q12(c[1]); d[i + 2] = q12(c[2]); d[i + 3] = 255;
  }
  cv.g.putImageData(im, 0, 0);
  return cv;
}

// ---------- input ----------
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  Space: 'jump', KeyZ: 'jump', KeyK: 'jump', KeyX: 'attack', KeyJ: 'attack',
  Enter: 'start', KeyP: 'pause', Escape: 'esc', KeyM: 'mute', KeyF: 'fs', KeyC: 'crt',
};
const held = new Set();
const padHeld = {};
const forced = {};
export const input = {
  pressed: {},
  anyKey: false,
  onFirstGesture: null,
  down(a) { return !!forced[a] || !!padHeld[a] || [...held].some((k) => KEYMAP[k] === a); },
  hit(a) { return !!this.pressed[a]; },
  endStep() { this.pressed = {}; this.anyKey = false; },
  // debug / scripted input
  set(a, v) { if (v && !forced[a]) this.pressed[a] = true; forced[a] = !!v; },
  press(a) { this.pressed[a] = true; },
  clear() { held.clear(); for (const k in forced) forced[k] = false; this.pressed = {}; },
  poll() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (const p of pads) if (p && p.connected) { gp = p; break; }
    const now = {};
    if (gp) {
      const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      now.left = ax < -0.4 || b(14); now.right = ax > 0.4 || b(15);
      now.up = ay < -0.6 || b(12); now.down = ay > 0.5 || b(13);
      now.jump = b(0); now.attack = b(2) || b(1); now.start = b(9); now.pause = b(8);
    }
    for (const a of ['left', 'right', 'up', 'down', 'jump', 'attack', 'start', 'pause']) {
      if (now[a] && !padHeld[a]) { this.pressed[a] = true; this.anyKey = true; if (this.onFirstGesture) this.onFirstGesture(); }
      padHeld[a] = !!now[a];
    }
  },
  attach(target = window) {
    target.addEventListener('keydown', (e) => {
      const a = KEYMAP[e.code];
      if (this.onFirstGesture) this.onFirstGesture();
      if (!a) return;
      if (!e.metaKey && !e.ctrlKey) e.preventDefault();
      if (!e.repeat) { this.pressed[a] = true; this.anyKey = true; }
      held.add(e.code);
    });
    target.addEventListener('keyup', (e) => { held.delete(e.code); });
    target.addEventListener('blur', () => held.clear());
    target.addEventListener('pointerdown', () => { if (this.onFirstGesture) this.onFirstGesture(); });
  },
};
