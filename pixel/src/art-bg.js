// EMBERFALL Classic — backgrounds: copper-bar skies and procedurally generated parallax layers.
import { W, H, C, mk, mixc, grad, bayer, hash, rng, noise1, fbm1, noise2, fbm2, clamp, rampD, poly, rect, ellipse, line, css } from './core.js';

export const LW = 640; // parallax layer width (tileable)
const wrap = (x) => ((x % LW) + LW) % LW;

// Write float colours with ordered dithering down to 12 bit.
function ditherCanvas(w, h, fn) {
  const cv = mk(w, h), im = cv.g.createImageData(w, h), d = im.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = fn(x, y);
    if (!c) continue;
    const i = (y * w + x) * 4, b = bayer(x, y);
    d[i] = clamp(Math.floor(c[0] / 17 + b), 0, 15) * 17;
    d[i + 1] = clamp(Math.floor(c[1] / 17 + b), 0, 15) * 17;
    d[i + 2] = clamp(Math.floor(c[2] / 17 + b), 0, 15) * 17;
    d[i + 3] = 255;
  }
  cv.g.putImageData(im, 0, 0);
  return cv;
}

// ---------- sky ----------
function makeSky(o) {
  const stops = o.stops.map(([p, c]) => [p, C(c)]);
  const orb = o.orb;
  return ditherCanvas(W, H, (x, y) => {
    let c = grad(stops, y / H);
    let cloud = 0;
    if (o.clouds) {
      const k = o.clouds;
      const band = Math.exp(-Math.pow((y - k.y) / k.spread, 2));
      const n = fbm2(x / 70 + k.seed, y / 13, 4096, k.seed, 4);
      const th = 0.62 - band * 0.2;
      if (n > th) {
        const below = fbm2(x / 70 + k.seed, (y + 3) / 13, 4096, k.seed, 4) <= 0.62 - Math.exp(-Math.pow((y + 3 - k.y) / k.spread, 2)) * 0.2;
        cloud = below ? 2 : 1;
      }
    }
    if (orb) {
      const dx = x - orb.x, dy = y - orb.y;
      const d = Math.sqrt(dx * dx + dy * dy) + (bayer(x, y) - 0.5) * 5;
      if (d < orb.r && cloud === 0) {
        c = C(orb.core);
        if (orb.craters) {
          const n = noise2(x / 5, y / 5, 256, 77);
          if (n > 0.62) c = C(orb.crater);
          if (dx + dy > orb.r * 0.75) c = C(orb.crater);
        } else if (orb.stripes && y > orb.y + orb.r * 0.25 && ((y - orb.y) | 0) % 5 >= 3) c = grad(stops, y / H); // synth-sun slits
      } else {
        for (const [r, col, s] of orb.bands) if (d < r) { c = mixc(c, C(col), s); break; }
      }
    }
    if (cloud) c = mixc(c, C(cloud === 2 ? o.clouds.lit : o.clouds.body), cloud === 2 ? 0.75 : 0.7);
    else if (o.stars && y < o.stars.maxY) {
      const h = hash(x, y, o.stars.seed);
      const dens = o.stars.dens * (1 - y / o.stars.maxY);
      if (h < dens) c = mixc(c, C(o.stars.col), 0.4 + hash(x, y, 9) * 0.6);
    }
    return c;
  });
}

// ---------- mountains with skewed facet shading ----------
function mountains(o) {
  const ridge = new Float32Array(LW);
  for (let x = 0; x < LW; x++) {
    const u = (x / LW) * o.period;
    let r = 0, amp = 0.55, tot = 0, p = o.period, uu = u;
    for (let k = 0; k < 5; k++) {
      const n = noise1(uu, p, o.seed + k * 13);
      r += (k < 2 ? 1 - Math.abs(2 * n - 1) * (o.sharp ?? 1) : n) * amp;
      tot += amp; amp *= 0.5; uu *= 2; p *= 2;
    }
    ridge[x] = o.base - o.amp * (r / tot);
  }
  const cols = o.cols.map(C), haze = C(o.haze);
  return ditherCanvas(LW, H, (x, y) => {
    const d = y - ridge[x];
    if (d < 0) return null;
    const xs = wrap(Math.round(x + d * o.skew));
    const slope = ridge[wrap(xs + 3)] - ridge[wrap(xs - 3)];
    const sub = noise2((x - d * 0.4) / 11, y / 9, 4096, o.seed + 5);
    let t = slope < 0 ? 0.78 : 0.24;
    t += (sub - 0.5) * 0.5 + clamp(-slope * 0.04, -0.12, 0.12);
    if (d < 1.2) t = slope < 0 ? 1 : 0.5;
    let c = rampD(cols, t, x, y);
    const hz = clamp((y - (o.base - o.amp * 0.75)) / (o.hazeEnd - (o.base - o.amp * 0.75)), 0, 1);
    c = mixc(c, haze, hz * hz * o.hazeAmt + (o.hazeBase || 0));
    return c;
  });
}

// ---------- silhouette layers ----------
// Shapes are drawn in opaque white; finishSil recolours with body/rim/texture + bottom haze.
function finishSil(cv, o) {
  const w = cv.width, h = cv.height, im = cv.g.getImageData(0, 0, w, h), d = im.data;
  const body = C(o.body), rim = C(o.rim), tex = C(o.tex || o.body), haze = o.haze ? C(o.haze) : null;
  const A = (x, y) => (y < 0 ? 0 : y >= h ? 255 : d[(y * w + wrap(x)) * 4 + 3]);
  const out = new Uint8ClampedArray(d.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (d[i + 3] < 128) continue;
    let c = body;
    const n = noise2(x / (o.tx || 5), y / (o.ty || 9), 4096, o.seed || 1);
    if (n > 0.6) c = tex;
    if (!A(x - 1, y) || !A(x - 1, y - 1) || (!A(x, y - 1) && hash(x, y, 3) < 0.7)) { if (hash(x, y, 5) < (o.rimDens ?? 0.8)) c = rim; }
    else if ((!A(x - 2, y) || !A(x - 2, y - 2)) && hash(x, y, 6) < 0.35) c = rim;
    if (haze) {
      const hz = clamp((y - o.hazeY0) / (o.hazeY1 - o.hazeY0), 0, 1) * (o.hazeAmt ?? 0.6);
      if (bayer(x, y) < hz) c = haze;
    }
    out[i] = c[0]; out[i + 1] = c[1]; out[i + 2] = c[2]; out[i + 3] = 255;
  }
  im.data.set(out);
  cv.g.putImageData(im, 0, 0);
  return cv;
}
// draw a shape at x and its wraps
function wrapDraw(fn) { fn(0); fn(-LW); fn(LW); }

function conifer(g, x, by, h, hw) {
  g.fillStyle = '#fff';
  for (let i = 0; i < h; i++) {
    const w = (i / h) * hw * (0.5 + 0.5 * ((i % 9) / 9)) + 0.6;
    g.fillRect(Math.round(x - w), Math.round(by - h + i), Math.max(1, Math.round(w * 2)), 1);
  }
  g.fillRect(Math.round(x - 1), by, 3, 12);
}

function treeline(seed, o) {
  const cv = mk(LW, H), g = cv.g, r = rng(seed);
  g.fillStyle = '#fff';
  for (let x = 0; x < LW; x++) {
    const y = o.base + fbm1((x / LW) * 8, 8, seed) * 14;
    g.fillRect(x, Math.round(y), 1, H);
  }
  const n = o.count;
  for (let i = 0; i < n; i++) {
    const x = (i + r() * 0.8) * (LW / n), hh = o.hmin + r() * (o.hmax - o.hmin);
    const by = Math.round(o.base + fbm1((wrap(x) / LW) * 8, 8, seed) * 14) + 3;
    wrapDraw((ox) => conifer(g, x + ox, by, hh, hh * 0.24 + 3));
  }
  return finishSil(cv, o);
}

function leafBlob(g, x, y, r, seed) {
  g.fillStyle = '#fff';
  for (let k = 0; k < 7; k++) {
    const a = hash(k, seed, 1) * 6.28, d = hash(k, seed, 2) * r * 0.7;
    ellipse(g, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6, r * (0.45 + hash(k, seed, 3) * 0.35), r * (0.35 + hash(k, seed, 4) * 0.25), '#fff');
  }
}

function nearTrunks(seed, o) {
  const cv = mk(LW, H), g = cv.g, r = rng(seed);
  // canopy roof
  g.fillStyle = '#fff';
  for (let x = 0; x < LW; x++) {
    const y = 2 + fbm1((x / LW) * 10, 10, seed + 3) * 26 + Math.abs(Math.sin(x * 0.37 + hash(x >> 3, seed) * 5)) * 4;
    g.fillRect(x, 0, 1, Math.round(y));
    if (hash(x, seed, 9) < 0.04) g.fillRect(x, Math.round(y) - 2, 1, 6 + Math.floor(hash(x, seed, 10) * 18)); // vines
  }
  const n = 4;
  for (let i = 0; i < n; i++) {
    const x = (i + 0.2 + r() * 0.6) * (LW / n), w = 14 + r() * 16;
    wrapDraw((ox) => {
      for (let y = 0; y < H; y++) {
        const fl = Math.pow(clamp((y - (H - 46)) / 46, 0, 1), 2) * 12 + Math.pow(clamp((40 - y) / 40, 0, 1), 2) * 14;
        const sway = Math.sin(y * 0.03 + i * 2) * 4;
        g.fillRect(Math.round(x + ox - w / 2 - fl + sway), y, Math.round(w + fl * 2), 1);
      }
      // branches
      for (let b = 0; b < 2; b++) {
        const by = 40 + b * 16 + r() * 10, dir = b % 2 ? 1 : -1, len = 26 + r() * 26;
        for (let k = 0; k < len; k++) g.fillRect(Math.round(x + ox + dir * (w / 2 + k)), Math.round(by - k * 0.55 - Math.sin(k * 0.2) * 2), 2, Math.max(1, Math.round(4 - k * 0.1)));
      }
    });
  }
  return finishSil(cv, o);
}

function teeth(seed, n, wmin, wmax, lmin, lmax) {
  const prof = new Float32Array(LW), r = rng(seed);
  for (let i = 0; i < n; i++) {
    const cx = (i + r() * 0.9) * (LW / n), w = wmin + r() * (wmax - wmin), len = lmin + Math.pow(r(), 1.6) * (lmax - lmin);
    for (let dx = -Math.ceil(w); dx <= Math.ceil(w); dx++) {
      const v = len * Math.pow(Math.max(0, 1 - Math.abs(dx) / w), 1.25);
      const xx = wrap(Math.round(cx + dx));
      if (v > prof[xx]) prof[xx] = v;
    }
  }
  return prof;
}

function caveTeeth(seed, o) {
  const cv = mk(LW, H), g = cv.g;
  const top = teeth(seed, o.n, 8, 26, 14, o.len), bot = teeth(seed + 9, o.n, 10, 30, 10, o.len * 0.8);
  g.fillStyle = '#fff';
  for (let x = 0; x < LW; x++) {
    const ty = o.top + fbm1((x / LW) * 12, 12, seed) * 16 + top[x];
    const by = o.bot - fbm1((x / LW) * 12, 12, seed + 4) * 16 - bot[x];
    g.fillRect(x, 0, 1, Math.round(ty));
    g.fillRect(x, Math.round(by), 1, H);
  }
  if (o.columns) {
    const r = rng(seed + 20);
    for (let i = 0; i < o.columns; i++) {
      const x = (i + 0.2 + r() * 0.6) * (LW / o.columns), w = 8 + r() * 12;
      wrapDraw((ox) => {
        for (let y = 0; y < H; y++) {
          const k = Math.abs(y - 105) / 105;
          g.fillRect(Math.round(x + ox - w / 2 - k * k * 22 + Math.sin(y * 0.11 + i) * 2), y, Math.round(w + k * k * 44), 1);
        }
      });
    }
  }
  finishSil(cv, o);
  if (o.crystals) {
    const r = rng(seed + 31);
    for (let i = 0; i < o.crystals; i++) {
      const x = Math.round((i + r()) * (LW / o.crystals));
      let by = H - 1;
      const im = g.getImageData(wrap(x), 0, 1, H).data;
      for (let y = H - 1; y > 60; y--) if (im[y * 4 + 3] < 128) { by = y + 2; break; }
      const pal = o.crystalPal[i % o.crystalPal.length].map((c) => css(C(c)));
      for (let k = 0; k < 4; k++) {
        const a = (r() - 0.5) * 1.3, len = 10 + r() * 22, w = 2 + r() * 3;
        const tx = x + Math.sin(a) * len, ty = by - Math.cos(a) * len;
        wrapDraw((ox) => {
          poly(g, [[x + ox - w, by], [tx + ox, ty], [x + ox + w, by]], pal[0]);
          poly(g, [[x + ox - w, by], [tx + ox, ty], [x + ox - w * 0.2, by]], pal[1]);
          line(g, x + ox - w + 1, by - 1, tx + ox, ty, pal[2]);
        });
      }
    }
  }
  return cv;
}

function caveWall(seed, o) {
  const cols = o.cols.map(C), rimc = C(o.rim);
  const f = (x, y) => fbm2((x / LW) * 9, y / 60, 9, seed, 4) + Math.pow(Math.abs(y - 112) / 112, 2) * 0.42;
  return ditherCanvas(LW, H, (x, y) => {
    const n = f(x, y);
    if (n < 0.5) return null;
    const lit = f(x - 2, y - 2) - n;
    const fac = noise2(x / 14 + y / 40, y / 10 - x / 50, 4096, seed + 2);
    let t = 0.35 + (fac - 0.5) * 0.9 + clamp(-lit * 14, -0.3, 0.3);
    if (n < 0.515) return lit < 0 ? rimc : cols[0];
    return rampD(cols, t, x, y);
  });
}

function castleLine(seed, o) {
  const cv = mk(LW, H), g = cv.g, r = rng(seed);
  g.fillStyle = '#fff';
  const hill = (x) => o.base + fbm1((wrap(x) / LW) * 6, 6, seed) * 30;
  for (let x = 0; x < LW; x++) g.fillRect(x, Math.round(hill(x)), 1, H);
  const wins = [];
  const tower = (x, w, h, roof) => wrapDraw((ox) => {
    const by = Math.round(hill(x)) + 6, X = Math.round(x + ox - w / 2);
    g.fillStyle = '#fff';
    g.fillRect(X, by - h, w, h);
    if (roof) poly(g, [[X - 2, by - h], [X + w / 2, by - h - w * 1.5], [X + w + 2, by - h]], '#fff');
    else { g.fillRect(X - 1, by - h - 2, w + 2, 3); for (let k = -1; k < w + 1; k += 4) g.fillRect(X + k, by - h - 5, 2, 3); }
    if (ox === 0) for (let k = 0; k < 3; k++) if (r() < 0.6) wins.push([X + 2 + Math.floor(r() * Math.max(1, w - 5)), by - h + 6 + Math.floor(r() * (h - 14))]);
  });
  for (const cx of o.castles) {
    tower(cx, 44, 26, false); tower(cx - 26, 12, 48, true); tower(cx + 24, 14, 60, true);
    tower(cx - 4, 18, 44, false); tower(cx + 8, 8, 78, true); tower(cx - 44, 9, 30, false); tower(cx + 46, 9, 34, true);
  }
  finishSil(cv, o);
  for (const [x, y] of wins) { rect(g, wrap(x), y, 1, 2, css(C(o.win))); if (hash(x, y) < 0.4) rect(g, wrap(x + 1), y, 1, 2, css(C(o.win2))); }
  return cv;
}

function deadTree(g, x, y, len, a, depth, seed) {
  if (depth > 5 || len < 3) return;
  const x2 = x + Math.sin(a) * len, y2 = y - Math.cos(a) * len;
  line(g, x, y, x2, y2, '#fff', Math.max(1, 4 - depth));
  deadTree(g, x2, y2, len * 0.72, a - 0.35 - hash(seed, depth, 1) * 0.5, depth + 1, seed * 3 + 1);
  deadTree(g, x2, y2, len * 0.7, a + 0.3 + hash(seed, depth, 2) * 0.5, depth + 1, seed * 3 + 2);
}

function ruins(seed, o) {
  const cv = mk(LW, H), g = cv.g, r = rng(seed);
  g.fillStyle = '#fff';
  const ground = (x) => o.base + fbm1((wrap(x) / LW) * 7, 7, seed) * 12;
  for (let x = 0; x < LW; x++) g.fillRect(x, Math.round(ground(x)), 1, H);
  for (let i = 0; i < 5; i++) {
    const x = (i + r() * 0.7) * (LW / 5);
    wrapDraw((ox) => deadTree(g, x + ox, ground(x) + 3, 16 + hash(i, seed) * 10, (hash(i, seed, 4) - 0.5) * 0.4, 0, seed + i));
  }
  for (let i = 0; i < 3; i++) {
    const x = Math.round((i + 0.3 + r() * 0.4) * (LW / 3)), wdt = 70 + Math.floor(r() * 40), ht = 44 + Math.floor(r() * 20);
    wrapDraw((ox) => {
      const by = Math.round(ground(x)) + 4;
      g.fillStyle = '#fff';
      for (let k = 0; k < wdt; k++) {
        const top = by - ht + Math.floor(noise1(k / 9, 64, seed + i) * 26) * (k > wdt * 0.6 ? 1 : 0.2);
        g.fillRect(x + ox + k, Math.round(top), 1, by - Math.round(top));
      }
      for (let k = -1; k < wdt * 0.6; k += 5) g.fillRect(x + ox + k, by - ht - 3, 3, 4);
      // arch cut-outs
      g.globalCompositeOperation = 'destination-out';
      for (let a = 0; a < 2; a++) {
        const ax = x + ox + 14 + a * 28;
        g.fillRect(ax, by - 24, 12, 26); ellipse(g, ax + 6, by - 24, 6, 7, '#fff');
      }
      g.globalCompositeOperation = 'source-over';
    });
  }
  return finishSil(cv, o);
}

function nearPillars(seed, o) {
  const cv = mk(LW, H), g = cv.g, r = rng(seed);
  for (let i = 0; i < 3; i++) {
    const x = Math.round((i + 0.2 + r() * 0.6) * (LW / 3)), w = 22 + Math.floor(r() * 8), broken = i === 1;
    wrapDraw((ox) => {
      g.fillStyle = '#fff';
      const top = broken ? 70 : 0;
      for (let y = top; y < H; y++) {
        const jag = broken && y < top + 14 ? Math.floor(hash(y, seed) * 8) : 0;
        g.fillRect(x + ox - w / 2 + jag, y, w - jag - (broken && y < top + 8 ? Math.floor(hash(y, seed, 2) * 6) : 0), 1);
      }
      if (!broken) { g.fillRect(x + ox - w / 2 - 5, 18, w + 10, 6); g.fillRect(x + ox - w / 2 - 3, 24, w + 6, 3); }
      g.fillRect(x + ox - w / 2 - 4, H - 22, w + 8, 22);
      // chain
      if (!broken) for (let y = 27; y < 80 + i * 20; y += 3) g.fillRect(x + ox + w / 2 + 12 + ((y / 3) & 1), y, 2, 2);
    });
  }
  // top arch band
  g.fillStyle = '#fff';
  for (let x = 0; x < LW; x++) g.fillRect(x, 0, 1, 12 + Math.round(Math.abs(Math.sin((x / LW) * Math.PI * 3)) * 8));
  return finishSil(cv, o);
}

function mist(seed, yc, thick, col, dens) {
  const c = C(col);
  return ditherCanvas(LW, H, (x, y) => {
    const g = Math.exp(-Math.pow((y - yc) / thick, 2));
    if (g < 0.05) return null;
    const n = fbm2((x / LW) * 6, y / 9, 6, seed, 3);
    return g * dens * (0.35 + n * 1.2) > bayer(x, y) + 0.12 ? c : null;
  });
}

// ---------- world backdrops ----------
export function makeBackdrop(world) {
  if (world === 0) {
    return {
      sky: makeSky({
        stops: [[0, '#103'], [0.16, '#315'], [0.36, '#826'], [0.54, '#e45'], [0.68, '#f84'], [0.8, '#fc6'], [1, '#fea']],
        orb: { x: 268, y: 138, r: 25, core: '#ffd', stripes: false, bands: [[31, '#ffc', 0.75], [42, '#fd8', 0.5], [58, '#fa6', 0.32], [82, '#f86', 0.16]] },
        clouds: { y: 78, spread: 34, seed: 3, body: '#526', lit: '#f96' },
        stars: { maxY: 80, dens: 0.012, col: '#fef', seed: 4 },
      }),
      layers: [
        { img: mountains({ seed: 11, base: 150, amp: 86, period: 4, skew: 0.5, cols: ['#637', '#848', '#a59', '#d7a', '#fa9'], haze: '#f96', hazeEnd: 200, hazeAmt: 0.85, hazeBase: 0.12 }), fx: 0.05, fy: 0.04 },
        { img: mist(21, 150, 16, '#fb8', 0.9), fx: 0.07, fy: 0.05, drift: 3 },
        { img: mountains({ seed: 12, base: 176, amp: 64, period: 6, skew: 0.6, cols: ['#314', '#425', '#636', '#847', '#b58'], haze: '#c56', hazeEnd: 216, hazeAmt: 0.6 }), fx: 0.1, fy: 0.07 },
        { img: mist(22, 172, 12, '#e77', 0.8), fx: 0.14, fy: 0.09, drift: -5 },
        { img: treeline(13, { base: 166, count: 34, hmin: 22, hmax: 62, body: '#213', rim: '#425', tex: '#102', haze: '#636', hazeY0: 170, hazeY1: 216, hazeAmt: 0.5, seed: 5 }), fx: 0.2, fy: 0.12 },
        { img: mist(23, 190, 12, '#748', 0.7), fx: 0.26, fy: 0.14, drift: 6 },
        { img: nearTrunks(14, { body: '#102', rim: '#314', tex: '#001', rimDens: 0.55, tx: 3, ty: 22, seed: 6 }), fx: 0.42, fy: 0.2 },
      ],
    };
  }
  if (world === 1) {
    return {
      sky: makeSky({
        stops: [[0, '#001'], [0.3, '#012'], [0.52, '#035'], [0.7, '#023'], [1, '#001']],
        orb: { x: 210, y: 112, r: 0, core: '#fff', bands: [[26, '#4dd', 0.4], [48, '#2aa', 0.28], [78, '#088', 0.18], [120, '#066', 0.1]] },
        stars: { maxY: 400, dens: 0.004, col: '#5ee', seed: 8 },
      }),
      layers: [
        { img: caveWall(31, { cols: ['#012', '#013', '#024', '#135', '#146'], rim: '#157' }), fx: 0.06, fy: 0.04 },
        { img: mist(41, 120, 26, '#046', 0.55), fx: 0.09, fy: 0.05, drift: 2 },
        { img: caveTeeth(32, { n: 30, len: 60, top: 14, bot: 196, body: '#013', rim: '#135', tex: '#012', seed: 3, crystals: 5, crystalPal: [['#0aa', '#4ee', '#cff'], ['#84c', '#c8f', '#fdf']] }), fx: 0.14, fy: 0.08 },
        { img: mist(42, 168, 14, '#035', 0.6), fx: 0.2, fy: 0.1, drift: -4 },
        { img: caveTeeth(33, { n: 16, len: 76, top: 6, bot: 208, columns: 3, body: '#012', rim: '#124', tex: '#001', seed: 4, crystals: 3, crystalPal: [['#086', '#2db', '#bfe']] }), fx: 0.26, fy: 0.14 },
        { img: caveTeeth(34, { n: 9, len: 90, top: -6, bot: 224, body: '#001', rim: '#012', tex: '#000', rimDens: 0.5, seed: 5 }), fx: 0.45, fy: 0.2 },
      ],
    };
  }
  return {
    sky: makeSky({
      stops: [[0, '#100'], [0.2, '#301'], [0.42, '#712'], [0.6, '#b21'], [0.74, '#e52'], [0.86, '#f83'], [1, '#fb5']],
      orb: { x: 104, y: 62, r: 22, core: '#fdb', craters: true, crater: '#e97', bands: [[27, '#fa8', 0.55], [36, '#f64', 0.34], [50, '#d33', 0.2], [70, '#a22', 0.1]] },
      clouds: { y: 96, spread: 40, seed: 7, body: '#301', lit: '#e52' },
      stars: { maxY: 70, dens: 0.008, col: '#fcc', seed: 5 },
    }),
    layers: [
      { img: mountains({ seed: 51, base: 158, amp: 100, period: 5, skew: 0.45, sharp: 1.25, cols: ['#412', '#623', '#834', '#b44', '#e75'], haze: '#f73', hazeEnd: 205, hazeAmt: 0.85, hazeBase: 0.1 }), fx: 0.05, fy: 0.04 },
      { img: mist(61, 156, 14, '#f95', 0.8), fx: 0.07, fy: 0.05, drift: 3 },
      { img: castleLine(52, { base: 150, castles: [150, 470], body: '#301', rim: '#623', tex: '#201', win: '#fc4', win2: '#f82', haze: '#a32', hazeY0: 168, hazeY1: 216, hazeAmt: 0.55, seed: 2 }), fx: 0.1, fy: 0.07 },
      { img: mist(62, 178, 12, '#b33', 0.75), fx: 0.15, fy: 0.09, drift: -5 },
      { img: ruins(53, { base: 180, body: '#200', rim: '#512', tex: '#100', haze: '#511', hazeY0: 188, hazeY1: 216, hazeAmt: 0.4, seed: 3 }), fx: 0.22, fy: 0.12 },
      { img: nearPillars(54, { body: '#100', rim: '#412', tex: '#000', rimDens: 0.6, tx: 6, ty: 5, seed: 4 }), fx: 0.42, fy: 0.2 },
    ],
  };
}

// camYn: 0 when the camera is at the bottom of the level, increasing (px) as it rises.
export function drawBackdrop(g, bd, camX, camUp, t) {
  g.drawImage(bd.sky, 0, 0);
  for (const L of bd.layers) {
    const ox = -Math.floor(wrap(camX * L.fx + (L.drift ? t * L.drift : 0)));
    const oy = Math.round(camUp * L.fy);
    g.drawImage(L.img, ox, oy);
    g.drawImage(L.img, ox + LW, oy);
  }
}
