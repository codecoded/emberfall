// EMBERFALL Classic — hand-defined 5x7 bitmap font, text drawing, big metallic logo.
import { mk, C, q12, grad, bayer } from './core.js';

const G = {
  A: '01110 10001 10001 11111 10001 10001 10001', B: '11110 10001 10001 11110 10001 10001 11110',
  C: '01110 10001 10000 10000 10000 10001 01110', D: '11110 10001 10001 10001 10001 10001 11110',
  E: '11111 10000 10000 11110 10000 10000 11111', F: '11111 10000 10000 11110 10000 10000 10000',
  G: '01110 10001 10000 10111 10001 10001 01111', H: '10001 10001 10001 11111 10001 10001 10001',
  I: '01110 00100 00100 00100 00100 00100 01110', J: '00111 00010 00010 00010 00010 10010 01100',
  K: '10001 10010 10100 11000 10100 10010 10001', L: '10000 10000 10000 10000 10000 10000 11111',
  M: '10001 11011 10101 10101 10001 10001 10001', N: '10001 11001 10101 10011 10001 10001 10001',
  O: '01110 10001 10001 10001 10001 10001 01110', P: '11110 10001 10001 11110 10000 10000 10000',
  Q: '01110 10001 10001 10001 10101 10010 01101', R: '11110 10001 10001 11110 10100 10010 10001',
  S: '01111 10000 10000 01110 00001 00001 11110', T: '11111 00100 00100 00100 00100 00100 00100',
  U: '10001 10001 10001 10001 10001 10001 01110', V: '10001 10001 10001 10001 10001 01010 00100',
  W: '10001 10001 10001 10101 10101 11011 10001', X: '10001 10001 01010 00100 01010 10001 10001',
  Y: '10001 10001 01010 00100 00100 00100 00100', Z: '11111 00001 00010 00100 01000 10000 11111',
  0: '01110 10001 10011 10101 11001 10001 01110', 1: '00100 01100 00100 00100 00100 00100 01110',
  2: '01110 10001 00001 00110 01000 10000 11111', 3: '11110 00001 00001 01110 00001 00001 11110',
  4: '00010 00110 01010 10010 11111 00010 00010', 5: '11111 10000 11110 00001 00001 10001 01110',
  6: '00110 01000 10000 11110 10001 10001 01110', 7: '11111 00001 00010 00100 01000 01000 01000',
  8: '01110 10001 10001 01110 10001 10001 01110', 9: '01110 10001 10001 01111 00001 00010 01100',
  '.': '00000 00000 00000 00000 00000 01100 01100', ',': '00000 00000 00000 00000 01100 00100 01000',
  '!': '00100 00100 00100 00100 00100 00000 00100', '?': '01110 10001 00001 00110 00100 00000 00100',
  ':': '00000 01100 01100 00000 01100 01100 00000', '-': '00000 00000 00000 11111 00000 00000 00000',
  '+': '00000 00100 00100 11111 00100 00100 00000', "'": '00100 00100 01000 00000 00000 00000 00000',
  '/': '00001 00001 00010 00100 01000 10000 10000', '(': '00010 00100 01000 01000 01000 00100 00010',
  ')': '01000 00100 00010 00010 00010 00100 01000', '*': '00000 10001 01010 00100 01010 10001 00000',
  '>': '01000 00100 00010 00001 00010 00100 01000', '<': '00010 00100 01000 10000 01000 00100 00010',
  '=': '00000 00000 11111 00000 11111 00000 00000', '"': '01010 01010 00000 00000 00000 00000 00000',
  '%': '11001 11010 00010 00100 01000 01011 10011', '#': '01010 11111 01010 01010 01010 11111 01010',
  ' ': '00000 00000 00000 00000 00000 00000 00000',
};
const CHARS = Object.keys(G);
const IDX = {};
CHARS.forEach((c, i) => { IDX[c] = i; G[c] = G[c].split(' '); });

export function glyphBit(ch, x, y) {
  const g = G[ch] || G['?'];
  return x >= 0 && x < 5 && y >= 0 && y < 7 && g[y][x] === '1';
}

const atlases = {};
// colour: '#rgb' string or array of 7 '#rgb' strings (one per glyph row).
function atlas(color) {
  const key = Array.isArray(color) ? color.join('') : color;
  let a = atlases[key];
  if (a) return a;
  a = atlases[key] = mk(CHARS.length * 6, 7);
  CHARS.forEach((ch, i) => {
    for (let y = 0; y < 7; y++) {
      a.g.fillStyle = Array.isArray(color) ? color[y] : color;
      for (let x = 0; x < 5; x++) if (G[ch][y][x] === '1') a.g.fillRect(i * 6 + x, y, 1, 1);
    }
  });
  return a;
}

export const GOLD = ['#ffd', '#fe8', '#fc4', '#fa2', '#d71', '#a40', '#720'];
export const SILVER = ['#fff', '#eef', '#cde', '#9bd', '#79b', '#568', '#346'];
export const EMBER = ['#ffb', '#fd6', '#fa3', '#f72', '#e41', '#b21', '#711'];
export const JADE = ['#efe', '#bfc', '#7e9', '#4c7', '#295', '#174', '#042'];

export const textW = (s, scale = 1) => (s.length * 6 - 1) * scale;

function blit(g, a, s, x, y, scale) {
  for (let i = 0; i < s.length; i++) {
    const idx = IDX[s[i]] ?? IDX['?'];
    if (s[i] !== ' ') g.drawImage(a, idx * 6, 0, 5, 7, x + i * 6 * scale, y, 5 * scale, 7 * scale);
  }
}
// opt: {color, align:'l'|'c'|'r', shadow:'#rgb', outline:'#rgb', scale}
export function text(g, s, x, y, opt = {}) {
  s = String(s).toUpperCase();
  const scale = opt.scale || 1;
  const w = textW(s, scale);
  x = Math.round(opt.align === 'c' ? x - w / 2 : opt.align === 'r' ? x - w : x);
  y = Math.round(y);
  if (opt.outline) {
    const o = atlas(opt.outline);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) blit(g, o, s, x + dx * scale, y + dy * scale, scale);
  }
  if (opt.shadow) blit(g, atlas(opt.shadow), s, x + scale, y + scale, scale);
  blit(g, atlas(opt.color || '#fff'), s, x, y, scale);
  return w;
}

// ---------- big logo ----------
function epx2(src, w, h) {
  const out = new Uint8Array(w * 2 * h * 2);
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : src[y * w + x]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const P = at(x, y), A = at(x, y - 1), B = at(x + 1, y), Cc = at(x - 1, y), D = at(x, y + 1);
    let p1 = P, p2 = P, p3 = P, p4 = P;
    if (Cc === A && Cc !== D && A !== B) p1 = A;
    if (A === B && A !== Cc && B !== D) p2 = B;
    if (D === Cc && D !== B && Cc !== A) p3 = Cc;
    if (B === D && B !== A && D !== Cc) p4 = D;
    const o = y * 2 * w * 2 + x * 2;
    out[o] = p1; out[o + 1] = p2; out[o + w * 2] = p3; out[o + w * 2 + 1] = p4;
  }
  return out;
}

// Large chiselled metallic logo. Returns a canvas.
export function makeLogo(str, stops) {
  const gw = 7, n = str.length;
  let w = n * gw, h = 9;
  let m = new Uint8Array(w * h);
  for (let i = 0; i < n; i++) for (let y = 0; y < 7; y++) for (let x = 0; x < 5; x++) {
    if (glyphBit(str[i], x, y)) {
      m[(y + 1) * w + i * gw + x + 1] = 1;
      // embolden horizontally for a heavier, more heraldic face
      if (x < 4 || true) m[(y + 1) * w + i * gw + x + 2] = 1;
    }
  }
  m = epx2(m, w, h); w *= 2; h *= 2;
  m = epx2(m, w, h); w *= 2; h *= 2;
  // m is now 4x. Stretch vertically x1.5 for tall gothic proportions.
  const S = 1, VS = 1.5;
  const lw = w * S, lh = Math.round(h * VS);
  const M = new Uint8Array(lw * lh);
  for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) M[y * lw + x] = m[Math.min(h - 1, Math.floor(y / VS)) * w + x];
  const at = (x, y) => (x < 0 || y < 0 || x >= lw || y >= lh ? 0 : M[y * lw + x]);
  const pad = 6;
  const cv = mk(lw + pad * 2, lh + pad * 2), im = cv.g.createImageData(cv.width, cv.height), d = im.data;
  const put = (x, y, c) => { const i = (y * cv.width + x) * 4; d[i] = q12(c[0]); d[i + 1] = q12(c[1]); d[i + 2] = q12(c[2]); d[i + 3] = 255; };
  stops = stops || [
    [0.0, C('#fff')], [0.12, C('#fe9')], [0.3, C('#fb3')], [0.46, C('#e52')], [0.52, C('#811')],
    [0.54, C('#301')], [0.62, C('#812')], [0.8, C('#f62')], [0.93, C('#fd6')], [1.0, C('#ffc')],
  ];
  let top = lh, bot = 0;
  for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) if (M[y * lw + x]) { top = Math.min(top, y); bot = Math.max(bot, y); }
  // drop shadow + outline
  for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
    const lx = x - pad, ly = y - pad;
    if (at(lx, ly)) continue;
    let near = false;
    for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) + Math.abs(dy) <= 3 && at(lx + dx, ly + dy)) { near = true; break; }
    if (near) put(x, y, C('#201'));
    else if (at(lx - 4, ly - 4) || at(lx - 3, ly - 3)) put(x, y, C('#000'));
  }
  for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) {
    if (!M[y * lw + x]) continue;
    const t = (y - top) / (bot - top);
    let c = grad(stops, Math.min(1, Math.max(0, t + (bayer(x, y) - 0.5) * 0.07)));
    const hiT = !at(x, y - 1) || !at(x - 1, y), hiB = !at(x, y + 1) || !at(x + 1, y);
    if (hiT && !hiB) c = C('#ffe');
    else if (hiB) c = C('#612');
    else if (!at(x - 2, y) || !at(x, y - 2)) c = [Math.min(255, c[0] + 40), Math.min(255, c[1] + 40), Math.min(255, c[2] + 34)];
    put(x + pad, y + pad, c);
  }
  cv.g.putImageData(im, 0, 0);
  return cv;
}
