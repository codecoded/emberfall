// EMBERFALL Classic — per-pixel terrain rendering and hash-scattered decoration.
import { C, mk, hash, noise1, noise2, clamp, rampD, bayer, rect, px, line, poly, ellipse, css, rng } from './core.js';

const T = 16;
const R = (a) => a.map(C);
const MAT = [
  { // Whispering Woods: earth + grass
    rock: R(['#100', '#210', '#321', '#432', '#643', '#854', '#a75', '#c96']),
    grass: R(['#021', '#131', '#252', '#383', '#5b3', '#9d4']), cs: 9, round: 5,
  },
  { // Crystal Hollow: blue rock + teal moss
    rock: R(['#001', '#012', '#124', '#235', '#347', '#56a', '#78c', '#ace']),
    grass: R(['#011', '#032', '#064', '#096', '#1c9', '#7fd']), cs: 13, round: 5,
  },
  { // Ashen Keep: brick + capstones
    rock: R(['#100', '#201', '#312', '#423', '#534', '#756', '#977', '#baa']),
    grass: R(['#312', '#534', '#756', '#988', '#baa', '#dcb']), cs: 8, round: 2,
  },
];

export function renderTerrain(lv) {
  const w = lv.w, h = lv.h, Wp = w * T, Hp = h * T, world = lv.world, M = MAT[world];
  const tile = (tx, ty) => (tx < 0 || tx >= w || ty >= h ? 1 : lv.tiles[Math.max(0, ty) * w + tx]);
  const sol = (tx, ty) => tile(tx, ty) === 1;
  const seed = 100 + world * 37;

  // ---- 1. pixel mask with rounded convex corners ----
  let mask = new Uint8Array(Wp * Hp);
  const r = M.round;
  for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) {
    if (!sol(tx, ty)) continue;
    const L = !sol(tx - 1, ty), Rr = !sol(tx + 1, ty), U = !sol(tx, ty - 1), D = !sol(tx, ty + 1);
    for (let py = 0; py < T; py++) for (let pxx = 0; pxx < T; pxx++) {
      let on = 1;
      const cx = pxx < r ? r - pxx - 0.5 : pxx >= T - r ? pxx - (T - r) + 0.5 : 0;
      const cy = py < r ? r - py - 0.5 : py >= T - r ? py - (T - r) + 0.5 : 0;
      if (cx && cy && cx * cx + cy * cy > r * r) {
        const left = pxx < r, top = py < r;
        if ((left ? L : Rr) && (top ? U : D)) on = 0;
      }
      mask[(ty * T + py) * Wp + tx * T + pxx] = on;
    }
  }
  // ---- 2. organic edges: bumps on top, bites out of ceilings and walls ----
  if (world !== 2) {
    const src = mask; mask = Uint8Array.from(src);
    for (let x = 0; x < Wp; x++) {
      const bump = Math.floor(noise1(x / 6, 4096, seed) * 2.4), bite = Math.floor(noise1(x / 5, 4096, seed + 1) * (world === 1 ? 5 : 3));
      for (let y = 1; y < Hp; y++) {
        const a = src[(y - 1) * Wp + x], b = src[y * Wp + x];
        if (!a && b) for (let k = 1; k <= bump; k++) if (y - k >= 0 && tile((x / T) | 0, ((y - k) / T) | 0) === 0) mask[(y - k) * Wp + x] = 1;
        if (a && !b) for (let k = 1; k <= bite; k++) if (y - k >= 0) mask[(y - k) * Wp + x] = 0;
      }
    }
    for (let y = 0; y < Hp; y++) {
      const bite = Math.floor(noise1(y / 5, 4096, seed + 2) * 2.2);
      for (let x = 1; x < Wp; x++) {
        const a = src[y * Wp + x - 1], b = src[y * Wp + x];
        if (a && !b) for (let k = 1; k <= bite; k++) mask[y * Wp + x - k] = 0;
        if (!a && b) for (let k = 0; k < bite; k++) mask[y * Wp + x + k] = 0;
      }
    }
  }
  // ---- 3. distance to edge (chamfer) + vertical depth below/above surfaces ----
  const dist = new Float32Array(Wp * Hp);
  for (let i = 0; i < dist.length; i++) dist[i] = mask[i] ? 1e6 : 0;
  for (let y = 0; y < Hp; y++) for (let x = 0; x < Wp; x++) {
    const i = y * Wp + x; let d = dist[i];
    if (!d) continue;
    if (x > 0) d = Math.min(d, dist[i - 1] + 1);
    if (y > 0) { d = Math.min(d, dist[i - Wp] + 1); if (x > 0) d = Math.min(d, dist[i - Wp - 1] + 1.41); if (x < Wp - 1) d = Math.min(d, dist[i - Wp + 1] + 1.41); }
    dist[i] = d;
  }
  for (let y = Hp - 1; y >= 0; y--) for (let x = Wp - 1; x >= 0; x--) {
    const i = y * Wp + x; let d = dist[i];
    if (!d) continue;
    if (x < Wp - 1) d = Math.min(d, dist[i + 1] + 1);
    if (y < Hp - 1) { d = Math.min(d, dist[i + Wp] + 1); if (x > 0) d = Math.min(d, dist[i + Wp - 1] + 1.41); if (x < Wp - 1) d = Math.min(d, dist[i + Wp + 1] + 1.41); }
    dist[i] = d;
  }
  const dTop = new Uint16Array(Wp * Hp), dBot = new Uint16Array(Wp * Hp);
  for (let x = 0; x < Wp; x++) {
    let d = 999;
    for (let y = 0; y < Hp; y++) { const i = y * Wp + x; if (mask[i]) { dTop[i] = d; if (d < 999) d++; } else d = 0; }
    d = 999;
    for (let y = Hp - 1; y >= 0; y--) { const i = y * Wp + x; if (mask[i]) { dBot[i] = d; if (d < 999) d++; } else d = 0; }
  }
  const air = (x, y) => x >= 0 && y >= 0 && x < Wp && y < Hp && !mask[y * Wp + x];

  // ---- 4. voronoi lattice ----
  const cs = M.cs, gw = Math.ceil(Wp / cs) + 3, gh = Math.ceil(Hp / cs) + 3;
  const vx = new Float32Array(gw * gh), vy = new Float32Array(gw * gh), vh = new Float32Array(gw * gh);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const k = j * gw + i;
    vx[k] = (i - 1 + 0.15 + hash(i, j, seed + 3) * 0.7) * cs;
    vy[k] = (j - 1 + 0.15 + hash(i, j, seed + 4) * 0.7) * cs * (world === 0 ? 0.8 : 1);
    vh[k] = hash(i, j, seed + 5);
  }
  const ysc = world === 0 ? 0.8 : 1; // flatter cobbles in the woods
  let f1, f2, vk;
  const voro = (x, y) => {
    const ci = Math.floor(x / cs) + 1, cj = Math.floor(y / (cs * ysc)) + 1;
    f1 = 1e9; f2 = 1e9; vk = 0;
    for (let j = cj - 1; j <= cj + 1; j++) {
      if (j < 0 || j >= gh) continue;
      for (let i = ci - 1; i <= ci + 1; i++) {
        if (i < 0 || i >= gw) continue;
        const k = j * gw + i, dx = x - vx[k], dy = (y - vy[k]) * (world === 0 ? 1.25 : 1);
        const d = world === 1 ? Math.abs(dx) * 0.8 + Math.abs(dy) * 0.9 + Math.max(Math.abs(dx), Math.abs(dy)) * 0.35 : Math.sqrt(dx * dx + dy * dy);
        if (d < f1) { f2 = f1; f1 = d; vk = k; } else if (d < f2) f2 = d;
      }
    }
  };

  // ---- 5. shade every solid pixel ----
  const terr = mk(Wp, Hp), im = terr.g.createImageData(Wp, Hp), data = im.data;
  const put = (x, y, c) => { const i = (y * Wp + x) * 4; data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255; };
  const glen = (x) => 3 + Math.floor(hash(x, 0, seed + 6) * 3) + (hash(x, 1, seed + 6) < 0.14 ? 3 : 0) + Math.floor(noise1(x / 9, 4096, seed + 7) * 3);
  for (let y = 0; y < Hp; y++) for (let x = 0; x < Wp; x++) {
    const i = y * Wp + x;
    if (!mask[i]) continue;
    const d = dist[i], dt = dTop[i], db = dBot[i];
    const lit = air(x - 3, y) || air(x, y - 3) || air(x - 2, y - 2);
    const dk = clamp((d - 5) / (world === 1 ? 38 : 48), 0, 1);
    let t;
    if (world === 2) {
      // --- castle brick ---
      const row = y >> 3, xo = (row & 1) * 8, bx = (x + xo) >> 4, lx = (x + xo) & 15, ly = y & 7;
      const bh = hash(bx, row, seed);
      t = 0.5 + (bh - 0.5) * 0.3 + (noise2(x / 3, y / 3, 4096, seed + 8) - 0.5) * 0.12;
      if (bh < 0.07) t -= 0.2;
      if (lx === 0 || ly === 0) t = 0.12;
      else if (ly === 1 || lx === 1) t += 0.16;
      else if (ly === 7 || lx === 15) t -= 0.14;
      t *= 1 - 0.78 * dk;
      if (dt < 6) { // capstone slab
        const jx = (x + 5) % 24;
        t = dt === 0 ? 0.98 : dt === 5 ? 0.14 : dt === 4 ? 0.42 : 0.72 + (noise2(x / 4, y / 2, 4096, seed + 9) - 0.5) * 0.2;
        if (jx === 0 && dt > 0 && dt < 5) t = 0.3; else if (jx === 1 && dt > 0 && dt < 5) t = 0.92;
        put(x, y, rampD(M.grass, t, x, y));
        continue;
      }
      if (db < 3) t = db === 0 ? 0.05 : db === 1 ? 0.3 : 0.5;
      else if (d < 1.5) t = 0.04;
      else if (d < 3) t += lit ? 0.22 : -0.12;
    } else {
      voro(x, y);
      const edge = f2 - f1, ch = vh[vk];
      const dot = clamp(((vx[vk] - x) + (vy[vk] - y)) / cs, -1, 1);
      if (world === 0) {
        t = 0.47 + (ch - 0.5) * 0.3 + dot * 0.24;
        if (edge < 1.3) t = 0.16; else if (edge < 2.6 && dot < 0) t -= 0.1; else if (edge < 2.6) t += 0.08;
        t += Math.sin((y + noise1(x / 30, 4096, seed + 8) * 14) * 0.21) * 0.06;
      } else {
        t = 0.42 + (ch - 0.5) * 0.36 + dot * 0.36;
        if (edge < 1.2) t = 0.12; else if (edge < 2.4 && dot > 0) t += 0.14;
        if (hash(x, y, seed + 9) < 0.0025 && d < 26) t = 1.1; // mineral glints
      }
      t *= 1 - 0.82 * dk;
      if (d < 1.5) t = 0.03;
      else if (d < 3.2) t += lit ? 0.26 : -0.14;
      else if (d < 5 && lit) t += 0.1;
      // grass / moss lip
      const gl = world === 0 ? glen(x) : Math.max(1, glen(x) - 2);
      if (dt < gl) {
        const gt = dt === 0 ? 1 : dt === 1 ? 0.8 : dt >= gl - 1 ? 0.12 : 0.5 - (dt / gl) * 0.2 + (hash(x, y, seed) - 0.5) * 0.3;
        put(x, y, rampD(M.grass, gt, x, y));
        continue;
      }
      if (world === 1 && db < 2 + Math.floor(hash(x, 3, seed) * 3) && hash(x >> 2, 4, seed) < 0.55) { put(x, y, rampD(M.grass, db === 0 ? 0.15 : 0.42, x, y)); continue; }
    }
    put(x, y, rampD(M.rock, t, x, y));
  }
  // grass blades poking above the lip
  if (world !== 2) {
    for (let x = 0; x < Wp; x++) for (let y = 4; y < Hp; y++) {
      const i = y * Wp + x;
      if (!mask[i] || dTop[i] !== 0) continue;
      const hh = hash(x, y >> 4, seed + 11);
      const n = hh < (world === 0 ? 0.42 : 0.2) ? 1 + Math.floor(hash(x, 7, seed) * (world === 0 ? 3.4 : 2)) : 0;
      for (let k = 1; k <= n; k++) if (!mask[i - k * Wp]) put(x, y - k, M.grass[k === n ? 4 : 3]);
    }
  }
  terr.g.putImageData(im, 0, 0);

  // ---- 6. decoration ----
  const back = mk(Wp, Hp), front = mk(Wp, Hp), bg = back.g, fg = front.g;
  const lights = [];
  const liq = (tx, ty) => tx >= 0 && tx < w && ty >= 0 && ty < h && lv.liquid[ty * w + tx];
  const freeUp = (tx, ty) => { let n = 0; while (n < 9 && ty - 1 - n >= 0 && tile(tx, ty - 1 - n) === 0) n++; return n; };
  const freeDown = (tx, ty) => { let n = 0; while (n < 9 && ty + 1 + n < h && tile(tx, ty + 1 + n) === 0 && !liq(tx, ty + 1 + n)) n++; return n; };
  const busy = new Set(lv.ents.filter((e) => ['merchant', 'shrine', 'portal', 'chest'].includes(e.type)).map((e) => Math.floor(e.x / T)));

  if (world === 2) backwall(bg, lv, tile, seed);

  for (let tx = 0; tx < w; tx++) for (let ty = 1; ty < h; ty++) {
    const X = tx * T, Y = ty * T, hsh = hash(tx, ty, seed + 20), h2 = hash(tx, ty, seed + 21), sd = tx * 131 + ty * 7 + seed;
    // ground spots
    if (sol(tx, ty) && tile(tx, ty - 1) === 0 && !liq(tx, ty - 1)) {
      const free = freeUp(tx, ty), edge = !sol(tx - 1, ty) || !sol(tx + 1, ty);
      if (world === 0) {
        if (hsh < 0.15 && free >= 6 && !edge) tree(bg, X + 8, Y + 2, Math.min(free * 16 - 26, 50 + h2 * 44), sd);
        else if (hsh < 0.3) bush(bg, X + 8, Y + 1, 7 + h2 * 5, sd);
        else if (hsh < 0.52) for (let k = 0; k < 1 + Math.floor(h2 * 3); k++) flower(bg, X + 2 + k * 5 + Math.floor(hash(sd, k) * 3), Y + 1, sd + k);
        else if (hsh < 0.6 && !busy.has(tx)) mushroom(bg, X + 4 + Math.floor(h2 * 8), Y + 1, sd, ['#e33', '#a12', '#fee', '#edc', '#a98']);
        else if (hsh < 0.68) rock(bg, X + 8, Y + 2, 4 + h2 * 4, ['#99a', '#667', '#334'], sd);
        else if (hsh < 0.8) fern(bg, X + 8, Y + 1, 6 + h2 * 5, ['#263', '#4a4', '#132'], sd);
        if (h2 < 0.22) grassTuft(fg, X + Math.floor(hash(sd, 3) * 10), Y + 2, 5 + Math.floor(hash(sd, 4) * 5), ['#5b3', '#383', '#9d4'], sd);
        else if (h2 > 0.95) fern(fg, X + 8, Y + 3, 8, ['#142', '#253', '#021'], sd);
      } else if (world === 1) {
        if (hsh < 0.13 && free >= 2) { const col = crystalCluster(bg, X + 8, Y + 1, 9 + h2 * 9, sd); lights.push({ x: X + 8, y: Y - 7, r: 1, col, s: sd }); }
        else if (hsh < 0.22 && !busy.has(tx)) { mushroom(bg, X + 4 + Math.floor(h2 * 8), Y + 1, sd, ['#4ed', '#088', '#cff', '#9cc', '#366']); lights.push({ x: X + 8, y: Y - 4, r: 0, col: '#0aa', s: sd }); }
        else if (hsh < 0.36 && free >= 2) stalag(bg, X + 8, Y + 2, 6 + h2 * 12, 1, ['#458', '#234', '#012']);
        else if (hsh < 0.46) rock(bg, X + 8, Y + 2, 4 + h2 * 5, ['#68a', '#346', '#123'], sd);
        else if (hsh < 0.58) grassTuft(bg, X + 4, Y + 1, 4 + Math.floor(h2 * 4), ['#0a8', '#075', '#5dc'], sd);
        if (h2 < 0.1) rock(fg, X + 8, Y + 4, 4 + hsh * 3, ['#346', '#123', '#001'], sd);
        else if (h2 > 0.93) stalag(fg, X + 8, Y + 4, 7 + hsh * 6, 1, ['#234', '#012', '#001']);
      } else {
        if (hsh < 0.09 && free >= 4 && !edge && !busy.has(tx)) pillar(bg, X + 8, Y, Math.min(free, 6) * 16 - 4, sd);
        else if (hsh < 0.2) bones(bg, X + 3 + Math.floor(h2 * 6), Y, sd);
        else if (hsh < 0.32) rock(bg, X + 8, Y + 1, 3 + h2 * 4, ['#988', '#544', '#212'], sd);
        else if (hsh < 0.38 && !busy.has(tx)) { candles(bg, X + 5, Y, sd); lights.push({ x: X + 8, y: Y - 8, r: 0, col: '#f82', s: sd, flame: 1 }); }
        if (h2 < 0.08) rock(fg, X + 8, Y + 3, 3 + hsh * 3, ['#544', '#212', '#100'], sd);
      }
    }
    // ceiling spots
    const t0 = tile(tx, ty);
    if ((t0 === 1 || t0 === 2) && ty + 1 < h && tile(tx, ty + 1) === 0) {
      const free = freeDown(tx, ty), oy = t0 === 2 ? 6 : 16;
      if (free < 1) continue;
      if (world === 0) {
        if (hsh > 0.45) vine(bg, X + 3 + Math.floor(h2 * 10), Y + oy - 2, Math.min(free * 16 - 6, 8 + h2 * 34), ['#252', '#383', '#5b3'], sd);
        if (hsh > 0.8) vine(bg, X + 12, Y + oy - 2, Math.min(free * 16 - 6, 6 + h2 * 16), ['#131', '#252', '#383'], sd + 1);
      } else if (world === 1) {
        if (t0 === 2) { if (hsh < 0.5) stalag(bg, X + 8, Y + 5, 4 + h2 * 5, -1, ['#458', '#234', '#012']); continue; }
        if (hsh < 0.5) stalag(bg, X + 3 + Math.floor(h2 * 10), Y + oy - 3, Math.min(free * 16 - 8, 6 + Math.pow(h2, 2) * 34), -1, ['#458', '#234', '#012']);
        else if (hsh < 0.62) vine(bg, X + 8, Y + oy - 3, Math.min(free * 16 - 6, 8 + h2 * 20), ['#043', '#075', '#0a8'], sd);
        else if (hsh < 0.7 && free >= 3) { const col = crystalCluster(bg, X + 8, Y + oy - 3, 7 + h2 * 7, sd, -1); lights.push({ x: X + 8, y: Y + oy + 5, r: 1, col, s: sd }); }
      } else if (t0 === 1) {
        if (hsh < 0.22) chain(bg, X + 4 + Math.floor(h2 * 8), Y + oy, Math.min(free * 16 - 8, 10 + h2 * 40), sd);
        else if (hsh < 0.36 && free >= 4) banner(bg, X + 2, Y + oy, 30 + Math.floor(h2 * 14), sd);
      }
    }
  }
  bg.drawImage(terr, 0, 0);

  // ---- 7. one-way platforms + spikes (drawn over terrain) ----
  for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) {
    if (tile(tx, ty) === 2 && tile(tx - 1, ty) !== 2) {
      let n = 1; while (tile(tx + n, ty) === 2) n++;
      drawPlatform(bg, world, tx * T, ty * T, n * T, tx * 7 + ty);
    }
    if (tile(tx, ty) === 3) drawSpikes(bg, world, tx * T, ty * T, tx);
  }
  return { back, front, lights, Wp, Hp };
}

// ================= decoration primitives =================
const P = (s) => css(C(s));

function foliage(g, blobs, cols, seed, warm) {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const b of blobs) { x0 = Math.min(x0, b[0] - b[2]); x1 = Math.max(x1, b[0] + b[2]); y0 = Math.min(y0, b[1] - b[2]); y1 = Math.max(y1, b[1] + b[2]); }
  const ramp = cols.map(C);
  for (let y = Math.floor(y0) - 1; y <= y1 + 1; y++) for (let x = Math.floor(x0) - 1; x <= x1 + 1; x++) {
    let best = -1, bb = null;
    for (const b of blobs) {
      const dx = x - b[0], dy = (y - b[1]) * 1.15;
      const f = 1 - Math.sqrt(dx * dx + dy * dy) / b[2];
      if (f > best) { best = f; bb = b; }
    }
    const n = noise2(x / 2.2, y / 2.2, 4096, seed);
    const f = best + (n - 0.5) * 0.42;
    if (f <= 0) continue;
    let t = 0.42 + (((bb[0] - x) + (bb[1] - y) * 1.3) / bb[2]) * 0.34 + (n - 0.5) * 0.5;
    if (f < 0.16) t -= 0.25;
    let c = rampD(ramp, t, x, y);
    if (warm && t > 0.86 && hash(x, y, seed) < 0.55) c = C(warm);
    g.fillStyle = css(c); g.fillRect(x, y, 1, 1);
  }
}
const LEAF = [['#021', '#132', '#243', '#364', '#5a4', '#9c5'], ['#012', '#123', '#244', '#375', '#6a5', '#ac6'], ['#110', '#231', '#452', '#673', '#9a4', '#cc6']];

function tree(g, x, by, hgt, seed) {
  const r = rng(seed), w = 5 + Math.floor(r() * 4), top = by - hgt;
  const lean = (r() - 0.5) * 10;
  for (let y = by; y >= top; y--) {
    const k = (by - y) / hgt, fl = Math.pow(1 - Math.min(1, (by - y) / 9), 2) * 5;
    const cx = x + lean * k * k + Math.sin(k * 5 + seed) * 1.5, ww = w * (1 - k * 0.35) + fl;
    const xl = Math.round(cx - ww / 2), n = Math.max(2, Math.round(ww));
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1), bark = noise2((xl + i) / 1.5, y / 7, 4096, seed);
      let c = u < 0.2 ? '#964' : u < 0.45 ? '#643' : u < 0.8 ? '#421' : '#210';
      if (bark > 0.62 && u > 0.2) c = '#310'; else if (bark < 0.3 && u < 0.6) c = '#854';
      if (i === 0 || i === n - 1) c = '#100';
      px(g, xl + i, y, P(c));
    }
  }
  // branch stubs
  const tx = x + lean, pal = LEAF[seed % 3];
  line(g, x + lean * 0.5, by - hgt * 0.62, x + lean * 0.5 + 12, by - hgt * 0.62 - 9, P('#421'), 2);
  line(g, x + lean * 0.4, by - hgt * 0.5, x + lean * 0.4 - 11, by - hgt * 0.5 - 8, P('#532'), 2);
  const blobs = [[tx, top - 4, 15 + r() * 5], [tx - 13, top + 5, 11 + r() * 4], [tx + 14, top + 4, 11 + r() * 5], [tx - 5, top - 14, 10 + r() * 4], [tx + 8, top - 12, 9 + r() * 4],
    [x + lean * 0.5 + 16, by - hgt * 0.62 - 12, 7 + r() * 3], [x + lean * 0.4 - 14, by - hgt * 0.5 - 11, 6 + r() * 3]];
  foliage(g, blobs, pal, seed, '#eb6');
}
function bush(g, x, by, r, seed) {
  foliage(g, [[x, by - r * 0.7, r], [x - r * 0.9, by - r * 0.4, r * 0.7], [x + r * 0.9, by - r * 0.45, r * 0.75]], LEAF[(seed >> 1) % 3], seed, null);
  if (hash(seed, 9) < 0.4) for (let k = 0; k < 4; k++) px(g, x - r + hash(seed, k) * r * 2, by - 2 - hash(seed, k + 9) * r, P(hash(seed, 8) < 0.5 ? '#f46' : '#fd4'));
}
function flower(g, x, by, seed) {
  const hgt = 4 + Math.floor(hash(seed, 1) * 5), col = ['#f6a', '#fd4', '#fff', '#b7f', '#f84'][Math.floor(hash(seed, 2) * 5)];
  for (let k = 0; k < hgt; k++) px(g, x + (k > hgt / 2 && hash(seed, 3) < 0.5 ? 1 : 0), by - k, P('#383'));
  const fx = x + (hash(seed, 3) < 0.5 ? 1 : 0), fy = by - hgt;
  px(g, fx - 1, fy, P(col)); px(g, fx + 1, fy, P(col)); px(g, fx, fy - 1, P(col)); px(g, fx, fy + 1, P(col)); px(g, fx, fy, P('#fe8'));
  if (hgt > 5) px(g, x + 1, by - 2, P('#5b3'));
}
function mushroom(g, x, by, seed, c) {
  const big = hash(seed, 5) < 0.4, w = big ? 9 : 6, hgt = big ? 8 : 5;
  rect(g, x + (w >> 1) - 1, by - hgt + 2, big ? 3 : 2, hgt - 2, P(c[3])); rect(g, x + (w >> 1) + (big ? 1 : 0), by - hgt + 2, 1, hgt - 2, P(c[4]));
  for (let k = 0; k < (big ? 4 : 3); k++) {
    const inset = [2, 1, 0, 0][k + (big ? 0 : 1)];
    rect(g, x + inset, by - hgt - (big ? 2 : 1) + k, w - inset * 2, 1, P(k === 0 ? c[0] : k < 2 ? c[0] : c[1]));
  }
  px(g, x + 2, by - hgt - (big ? 1 : 0), P(c[2])); if (big) { px(g, x + 5, by - hgt, P(c[2])); px(g, x + 6, by - hgt - 1, P(c[2])); }
}
function rock(g, x, by, r, c, seed) {
  for (let y = -Math.ceil(r); y <= 0; y++) {
    const hw = r * 1.3 * Math.sqrt(Math.max(0, 1 - (y * y) / (r * r))) + (hash(seed, y) - 0.5) * 1.5;
    for (let dx = -Math.round(hw); dx <= Math.round(hw); dx++) {
      const u = (dx + hw) / (hw * 2 + 0.01), v = -y / r;
      let col = u < 0.4 && v > 0.45 ? c[0] : u > 0.72 || v < 0.25 ? c[2] : c[1];
      if (Math.abs(dx) >= Math.round(hw) || y === -Math.ceil(r)) col = c[2];
      px(g, x + dx, by + y, P(col));
    }
  }
}
function fern(g, x, by, len, c, seed) {
  for (let k = 0; k < 5; k++) {
    const a = -1.3 + k * 0.65 + (hash(seed, k) - 0.5) * 0.3, l = len * (0.7 + hash(seed, k + 5) * 0.5);
    let pxx = x, pyy = by;
    for (let s = 1; s <= l; s++) {
      const nx = x + Math.sin(a) * s, ny = by - Math.cos(a) * s + (s * s) / (l * 1.6) * Math.abs(Math.sin(a));
      line(g, pxx, pyy, nx, ny, P(c[k % 2])); pxx = nx; pyy = ny;
      if (s % 2 === 0) px(g, nx, ny - 1, P(c[1]));
    }
  }
  px(g, x, by, P(c[2]));
}
function grassTuft(g, x, by, len, c, seed) {
  for (let k = 0; k < 6; k++) {
    const l = len * (0.5 + hash(seed, k) * 0.6), lean = (hash(seed, k + 3) - 0.5) * 5;
    line(g, x + k * 1.6, by, x + k * 1.6 + lean, by - l, P(c[k % 3]));
  }
}
function vine(g, x, y, len, c, seed) {
  for (let k = 0; k < len; k++) {
    const xx = x + Math.round(Math.sin(k * 0.22 + seed) * 1.6);
    px(g, xx, y + k, P(c[k % 5 === 0 ? 0 : 1]));
    if (k % 4 === 1) px(g, xx + (hash(seed, k) < 0.5 ? -1 : 1), y + k, P(c[2]));
    if (k % 7 === 3 && hash(seed, k + 2) < 0.5) { px(g, xx + 1, y + k + 1, P(c[2])); px(g, xx + 2, y + k + 1, P(c[1])); }
  }
  if (len > 6) px(g, x + Math.round(Math.sin(len * 0.22 + seed) * 1.6), y + len, P(c[2]));
}
function stalag(g, x, by, len, dir, c) {
  const w = Math.max(2, len * 0.3);
  for (let k = 0; k < len; k++) {
    const hw = w * Math.pow(1 - k / len, 0.8), y = by - dir * k;
    const xl = Math.round(x - hw), n = Math.max(1, Math.round(hw * 2));
    for (let i = 0; i < n; i++) px(g, xl + i, y, P(i === 0 && n > 2 ? c[0] : i < n * 0.45 ? c[1] : c[2]));
    if (n > 3 && k % 4 === 0) px(g, xl + 1, y, P(c[0]));
  }
}
const CRY = [['#cff', '#4dd', '#088', '#045'], ['#fdf', '#c7f', '#74b', '#325'], ['#dfe', '#5e9', '#186', '#043']];
function crystalCluster(g, x, by, size, seed, dir = 1) {
  const pal = CRY[seed % 3], n = 3 + (seed % 3);
  for (let k = 0; k < n; k++) {
    const a = (k - (n - 1) / 2) * 0.42 + (hash(seed, k) - 0.5) * 0.3, len = size * (0.5 + hash(seed, k + 4) * 0.6), wd = 1.5 + hash(seed, k + 8) * 2;
    const tx = x + Math.sin(a) * len, ty = by - dir * Math.cos(a) * len;
    const bx = x + (k - (n - 1) / 2) * 2.5;
    poly(g, [[bx - wd, by], [tx - 0.5, ty], [bx + wd + 1, by]], P(pal[2]));
    poly(g, [[bx - wd, by], [tx - 0.5, ty], [bx, by]], P(pal[1]));
    line(g, bx - wd, by, tx - 0.5, ty, P(pal[0]));
    px(g, bx + wd, by - dir, P(pal[3]));
  }
  return pal[1];
}
function pillar(g, x, by, hgt, seed) {
  const w = 12, top = by - hgt, broken = hash(seed, 1) < 0.45;
  for (let y = top; y < by; y++) {
    const jag = broken && y < top + 8 ? Math.floor(hash(seed, y) * 6) : 0;
    for (let i = jag; i < w; i++) {
      const u = i / w;
      let c = u < 0.15 ? '#534' : u < 0.4 ? '#423' : u < 0.75 ? '#312' : '#201';
      if (i % 3 === 0 && u > 0.15) c = '#201';
      if ((y - top) % 22 === 0) c = '#201';
      px(g, x - w / 2 + i, y, P(c));
    }
  }
  rect(g, x - w / 2 - 2, by - 5, w + 4, 5, P('#312')); rect(g, x - w / 2 - 2, by - 5, w + 4, 1, P('#534'));
  if (!broken) { rect(g, x - w / 2 - 3, top, w + 6, 4, P('#423')); rect(g, x - w / 2 - 3, top, w + 6, 1, P('#645')); rect(g, x - w / 2 - 1, top + 4, w + 2, 2, P('#201')); }
}
function bones(g, x, by, seed) {
  disc2(g, x + 3, by - 3, ['#edc', '#a98', '#212']);
  line(g, x - 2, by - 1, x + 8, by - 1, P('#dcb')); px(g, x - 3, by - 2, P('#edc')); px(g, x + 9, by - 2, P('#edc'));
  if (hash(seed, 2) < 0.5) { line(g, x + 7, by - 1, x + 11, by - 5, P('#ba9')); }
}
function disc2(g, x, y, c) {
  rect(g, x - 2, y - 2, 5, 4, P(c[0])); rect(g, x - 1, y + 2, 3, 1, P(c[1])); rect(g, x + 2, y - 1, 1, 3, P(c[1]));
  px(g, x - 1, y, P(c[2])); px(g, x + 1, y, P(c[2])); px(g, x - 2, y - 2, 'rgba(0,0,0,0)');
}
function candles(g, x, by) {
  for (const [dx, hh] of [[0, 5], [3, 8], [6, 4]]) { rect(g, x + dx, by - hh, 2, hh, P('#dca')); rect(g, x + dx + 1, by - hh, 1, hh, P('#a87')); }
}
function chain(g, x, y, len) {
  for (let k = 0; k < len; k += 3) { rect(g, x + ((k / 3) & 1), y + k, 2, 2, P('#878')); px(g, x + ((k / 3) & 1) + 1, y + k + 1, P('#434')); px(g, x + 1 - ((k / 3) & 1), y + k + 2, P('#545')); }
  rect(g, x - 1, y + len, 4, 3, P('#545')); px(g, x, y + len, P('#989'));
}
function banner(g, x, y, len, seed) {
  const w = 12, col = hash(seed, 3) < 0.5 ? ['#c22', '#811', '#f54'] : ['#538', '#314', '#86c'];
  rect(g, x - 1, y, w + 2, 2, P('#a83'));
  for (let i = 0; i < w; i++) {
    const tat = len - Math.abs(i - w / 2) * 0.9 - Math.floor(hash(seed, i) * 4);
    for (let k = 2; k < tat; k++) {
      const fold = Math.sin(i * 0.9 + k * 0.08);
      px(g, x + i, y + k, P(i === 0 || i === w - 1 ? col[1] : fold > 0.55 ? col[2] : fold < -0.5 ? col[1] : col[0]));
    }
  }
  // emblem: ember diamond
  const cx = x + w / 2, cy = y + 12;
  for (let dy = -4; dy <= 4; dy++) for (let dx = -3; dx <= 3; dx++) if (Math.abs(dx) + Math.abs(dy) * 0.75 <= 3) px(g, cx + dx, cy + dy, P(Math.abs(dx) + Math.abs(dy) <= 1 ? '#fe8' : '#fa3'));
}

function backwall(g, lv, tile, seed) {
  const w = lv.w, h = lv.h;
  const cols = ['#100', '#201', '#201', '#312'].map(C);
  const info = [];
  for (let tx = 0; tx < w; tx++) {
    if (tile(tx, 0) !== 1) { info.push(null); continue; }
    let cy = 0; while (cy < h && tile(tx, cy) === 1) cy++;
    let gy = cy; while (gy < h && tile(tx, gy) !== 1) gy++;
    info.push(cy < h ? [cy, gy] : null);
  }
  for (let tx = 0; tx < w; tx++) {
    const inf = info[tx];
    if (!inf) continue;
    const [cy, gy] = inf;
    const openL = !info[tx - 1] && tx > 0, openR = !info[tx + 1] && tx < w - 1;
    for (let y = cy * T; y < gy * T; y++) for (let xx = 0; xx < T; xx++) {
      const x = tx * T + xx;
      if (openL && xx < 6 + noise1(y / 6, 4096, seed) * 9) continue;
      if (openR && xx > 10 - noise1(y / 6, 4096, seed + 1) * 9) continue;
      // arched windows
      const wx = ((x + 40) % 112) - 56, wy = y - (cy * T + 26);
      const tall = (gy - cy) * T > 80;
      if (tall && Math.abs(wx) < 9 && wy > 0 && wy < 38 && (wy > 9 || wx * wx + (wy - 9) * (wy - 9) < 81)) {
        if (Math.abs(wx) % 6 === 0 || wy === 20) { g.fillStyle = '#100'; g.fillRect(x, y, 1, 1); }
        continue;
      }
      const frame = tall && Math.abs(wx) < 12 && wy > -3 && wy < 41 && (wy > 9 || wx * wx + (wy - 9) * (wy - 9) < 144);
      const row = y >> 3, xo = (row & 1) * 8, lx = (x + xo) & 15, ly = y & 7;
      let t = 0.45 + (hash((x + xo) >> 4, row, seed + 3) - 0.5) * 0.7;
      if (lx === 0 || ly === 0) t = 0;
      if (frame) t = 0.95;
      const c = rampD(cols, t, x, y);
      g.fillStyle = css(c); g.fillRect(x, y, 1, 1);
    }
  }
}

export function drawPlatform(g, world, x, y, w, seed) {
  if (world === 0) {
    for (let i = 0; i < w; i++) {
      const end = i < 2 || i >= w - 2, seam = i % 8 === 7;
      const c = ['#da7', '#b85', '#964', '#853', '#632', '#310'];
      for (let k = 0; k < 6; k++) {
        if (end && (k === 0 || k === 5) && (i === 0 || i === w - 1)) continue;
        let col = c[k];
        if (seam && k > 0) col = '#421';
        if (end && k > 0 && k < 5) col = i === 0 || i === w - 1 ? '#310' : '#421';
        if (k === 0 && hash(i, seed) < 0.45) col = '#5b3';
        if (k === 1 && hash(i, seed) < 0.2) col = '#383';
        px(g, x + i, y + k, P(col));
      }
      if (hash(i, seed, 2) < 0.16 && !end) for (let k = 0; k < 2 + hash(i, seed, 3) * 5; k++) px(g, x + i, y + 6 + k, P(k % 2 ? '#421' : '#532'));
    }
    rect(g, x + 2, y - 1, 2, 8, P('#ca7')); rect(g, x + w - 4, y - 1, 2, 8, P('#ca7')); px(g, x + 3, y, P('#864')); px(g, x + w - 3, y, P('#864'));
  } else if (world === 1) {
    for (let i = 0; i < w; i++) {
      const c = ['#9bd', '#67a', '#458', '#346', '#234', '#012'];
      const lip = Math.floor(noise1((x + i) / 3, 4096, seed) * 2.5);
      for (let k = 0; k < 6 + lip; k++) {
        if ((i === 0 || i === w - 1) && (k === 0 || k >= 4)) continue;
        let col = c[Math.min(5, k)];
        if (k === 0 && hash(i, seed) < 0.5) col = '#0a8';
        if (k === 6 + lip - 1) col = '#012';
        if (i % 11 === 5 && k > 0 && k < 4) col = '#123';
        px(g, x + i, y + k, P(col));
      }
    }
  } else {
    for (let i = 0; i < w; i++) {
      const c = ['#dcb', '#a98', '#877', '#655', '#423', '#201'];
      for (let k = 0; k < 6; k++) {
        let col = c[k];
        if (i % 16 === 0 && k > 0 && k < 5) col = '#423';
        if (i === 0 || i === w - 1) col = k === 0 ? '#a98' : '#312';
        px(g, x + i, y + k, P(col));
      }
    }
    for (const bx of [x + 1, x + w - 6]) for (let k = 0; k < 5; k++) rect(g, bx + (bx === x + 1 ? 0 : k), y + 6 + k, 5 - k, 1, P(k === 0 ? '#545' : '#312'));
    px(g, x + 3, y + 2, P('#fe8')); px(g, x + w - 4, y + 2, P('#fe8'));
  }
}
export function platformSprite(world, w) {
  const cv = mk(w, 14);
  drawPlatform(cv.g, world, 0, 0, w, 77);
  // rune studs mark the ones that move
  const col = world === 0 ? '#fe8' : world === 1 ? '#4ee' : '#f82';
  for (let x = 5; x < w - 3; x += 6) { px(cv.g, x, 3, P(col)); px(cv.g, x + 1, 3, P('#fff')); }
  return cv;
}
function drawSpikes(g, world, x, y, seed) {
  const c = world === 0 ? ['#fed', '#ba9', '#654', '#321'] : world === 1 ? ['#dff', '#5dd', '#178', '#034'] : ['#eef', '#99a', '#445', '#c22'];
  for (let s = 0; s < 3; s++) {
    const bx = x + 1 + s * 5, hgt = 9 + Math.floor(hash(seed, s) * 4);
    for (let k = 0; k < hgt; k++) {
      const wd = Math.max(1, Math.round((k / hgt) * 4.5)), yy = y + 16 - hgt + k;
      const xl = bx + 2 - (wd >> 1);
      for (let i = 0; i < wd; i++) px(g, xl + i, yy, P(i === 0 ? c[0] : i < wd / 2 ? c[1] : c[2]));
    }
    if (world === 2) px(g, bx + 2, y + 16 - hgt, P(c[3]));
  }
  rect(g, x, y + 15, 16, 1, P(c[world === 2 ? 2 : 3]));
}
