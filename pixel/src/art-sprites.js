// EMBERFALL Classic — procedural sprite rigs, outline compositing, baked item/enemy frames.
import { C, mk, css, rect, px, line, poly, ellipse, disc, hash, lerp, clamp, bayer, smooth } from './core.js';

const P = (s) => css(C(s));
const SZ = 96;
const scr = () => _scr || (_scr = mk(SZ, SZ));
let _scr, _sil;
const silc = () => _sil || (_sil = mk(SZ, SZ));

// dst <- src with a 1px dark outline (silhouette via source-in, drawn at 4 offsets).
function compose(dst, src, w, h, outline, flash) {
  const s = silc().g;
  s.globalCompositeOperation = 'source-over'; s.clearRect(0, 0, w, h); s.drawImage(src, 0, 0, w, h, 0, 0, w, h);
  s.globalCompositeOperation = 'source-in'; s.fillStyle = outline; s.fillRect(0, 0, w, h);
  dst.clearRect(0, 0, w, h);
  if (outline !== 'none') for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) dst.drawImage(_sil, 0, 0, w, h, dx, dy, w, h);
  if (flash) { s.fillStyle = '#fff'; s.fillRect(0, 0, w, h); dst.drawImage(_sil, 0, 0, w, h, 0, 0, w, h); } else dst.drawImage(src, 0, 0, w, h, 0, 0, w, h);
  s.globalCompositeOperation = 'source-over';
}
function bake(w, h, ax, ay, n, fn, outline = '#101') {
  const s = { f: [], fl: [], w, h, ax, ay, n };
  for (let i = 0; i < n; i++) {
    const g = scr().g; g.clearRect(0, 0, SZ, SZ); fn(g, i);
    const a = mk(w, h), b = mk(w, h);
    compose(a.g, _scr, w, h, outline, false); compose(b.g, _scr, w, h, outline, true);
    s.f.push(a); s.fl.push(b);
  }
  return s;
}
export function drawSpr(g, s, i, x, y, flip, flash) {
  const im = (flash ? s.fl : s.f)[((i | 0) % s.n + s.n) % s.n];
  x = Math.round(x); y = Math.round(y);
  if (flip) { g.save(); g.translate(x, 0); g.scale(-1, 1); g.drawImage(im, -s.ax, y - s.ay); g.restore(); } else g.drawImage(im, x - s.ax, y - s.ay);
}

// ================= humanoid rig (hero + skeleton knight) =================
export const ARMOUR = [
  { l: '#eb6', m: '#a62', d: '#521', t: '#ffd' }, // bronze
  { l: '#fff', m: '#9bd', d: '#457', t: '#fd5' }, // steel
  { l: '#ffb', m: '#fc3', d: '#a51', t: '#fff' }, // gold
];
export const BLADE = [
  { l: '#fff', m: '#bcd', d: '#678', len: 10, trail: ['#fff', '#cde', '#89b'] },
  { l: '#fff', m: '#6ef', d: '#07a', len: 12, trail: ['#fff', '#8ff', '#0bd'] },
  { l: '#fff', m: '#fd4', d: '#e41', len: 13, trail: ['#fff', '#fd4', '#f62'] },
];
export const HERO_AX = 32, HERO_AY = 46;

function ik(hx, hy, fx, fy, l1, l2, bend) {
  let dx = fx - hx, dy = fy - hy, d = Math.hypot(dx, dy) || 0.001;
  const max = l1 + l2 - 0.05;
  if (d > max) { dx *= max / d; dy *= max / d; d = max; fx = hx + dx; fy = hy + dy; }
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  let nx = -dy / d, ny = dx / d;
  if (nx * bend < 0) { nx = -nx; ny = -ny; }
  return [hx + (dx * a) / d + nx * hh, hy + (dy * a) / d + ny * hh, fx, fy];
}
function limb(g, x0, y0, x1, y1, cm, cl) { line(g, x0, y0, x1, y1, cm, 2); line(g, x0, y0, x1, y1, cl, 1); }

function drawSword(g, hx, hy, th, bl, len) {
  const sx = Math.sin(th), cy = Math.cos(th);
  line(g, hx - sx * 2, hy - cy * 2, hx, hy, P('#421'), 1);
  // crossguard (perpendicular)
  line(g, hx + sx - cy * 2, hy + cy + sx * 2, hx + sx + cy * 2, hy + cy - sx * 2, P('#fc4'), 1);
  const x0 = hx + sx * 2, y0 = hy + cy * 2, x1 = hx + sx * (len + 1), y1 = hy + cy * (len + 1);
  line(g, x0, y0, x1, y1, P(bl.d), 2);
  line(g, x0, y0, x1, y1, P(bl.m), 1);
  line(g, x0 + sx * 2, y0 + cy * 2, x1, y1, P(bl.l), 1);
}

// pose: {hip, sh, lean, fa:[x,up], fb:[x,up], af:[angle,bend], ab:[angle,bend], sw, thrust, hy, cape:[[x,y]..], t}
function humanoid(g, p, st) {
  const ox = HERO_AX, gy = HERO_AY - 1, L = 5;
  const hipY = gy - L * 2 + (p.hip || 0), hipX = ox + (p.shift || 0);
  const lean = p.lean || 0, shY = hipY - 8 + (p.sh || 0), shX = hipX + lean;
  const bone = st.skel;
  const A = st.arm;
  // --- cape ---
  if (p.cape && !bone) {
    const pts = p.cape, cx = shX - 2, cy = shY + 1;
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1], steps = 5;
        for (let s = 0; s <= steps; s++) {
          const u = s / steps, k = (i + u) / (pts.length - 1);
          const x = cx + lerp(a[0], b[0], u), y = cy + lerp(a[1], b[1], u), sz = 3 + k * 2.2;
          if (pass === 0) rect(g, x - sz / 2, y - sz / 2 + 1, Math.round(sz), Math.round(sz), P('#701'));
          else if (pass === 1) rect(g, x - sz / 2, y - sz / 2, Math.round(sz) - 1, Math.round(sz), P('#c12'));
          else if (k < 0.75) px(g, x - sz / 2, y - sz / 2, P('#f54'));
        }
      }
    }
  }
  // --- limbs geometry ---
  const fa = p.fa || [2, 0], fb = p.fb || [-2, 0];
  const legA = ik(hipX + 1, hipY, ox + fa[0], gy - fa[1], L, L, 1);
  const legB = ik(hipX - 1, hipY, ox + fb[0], gy - fb[1], L, L, 1);
  const arm = (sx, sy, a, bend, th) => {
    const ex = sx + Math.sin(a) * 4, ey = sy + Math.cos(a) * 4;
    const a2 = a + bend, hx = ex + Math.sin(a2) * (4 + th), hy = ey + Math.cos(a2) * (4 + th);
    return [ex, ey, hx, hy];
  };
  const af = p.af || [0.3, 0.8], ab = p.ab || [-0.2, 0.3];
  const armF = arm(shX + 1, shY + 2, af[0], af[1], p.thrust || 0), armB = arm(shX - 1, shY + 2, ab[0], ab[1], 0);
  const drawLeg = (l, hx, back) => {
    if (bone) {
      line(g, hx, hipY, l[0], l[1], P(back ? '#a98' : '#edc')); line(g, l[0], l[1], l[2], l[3] - 1, P(back ? '#a98' : '#edc'));
      px(g, l[0], l[1], P('#fff')); rect(g, l[2] - 1, l[3], 3, 1, P(back ? '#a98' : '#edc'));
    } else {
      const m = back ? A.d : A.m, li = back ? A.m : A.l;
      limb(g, hx - 1, hipY, l[0] - 1, l[1], P(m), P(li));
      limb(g, l[0] - 1, l[1], l[2] - 1, l[3] - 2, P(m), P(li));
      px(g, l[0], l[1], P(li));
      rect(g, l[2] - 2, l[3] - 1, 4, 2, P(back ? '#211' : '#322')); px(g, l[2] + 2, l[3], P(back ? '#211' : '#322')); px(g, l[2] - 1, l[3] - 1, P(back ? '#322' : '#644'));
    }
  };
  const drawArm = (a, sx, sy, back) => {
    if (bone) { line(g, sx, sy, a[0], a[1], P(back ? '#a98' : '#edc')); line(g, a[0], a[1], a[2], a[3], P(back ? '#a98' : '#edc')); px(g, a[2], a[3], P('#fff')); }
    else {
      const m = back ? A.d : A.m, li = back ? A.m : A.l;
      limb(g, sx - 1, sy, a[0] - 1, a[1], P(m), P(li)); limb(g, a[0] - 1, a[1], a[2] - 1, a[3] - 1, P(m), P(li));
      rect(g, a[2] - 1, a[3] - 1, 2, 2, P(back ? '#532' : '#da8'));
    }
  };
  // --- back arm + back leg ---
  drawArm(armB, shX - 1, shY + 2, true);
  drawLeg(legB, hipX - 1, true);
  // --- torso ---
  const th = hipY - shY;
  for (let i = 0; i < th; i++) {
    const k = i / Math.max(1, th - 1), xo = Math.round(hipX + lean * (1 - k)), y = shY + i;
    if (bone) {
      if (i === th - 1) { rect(g, xo - 2, y, 5, 1, P('#cba')); px(g, xo - 2, y, P('#edc')); }
      else if (i % 2 === 0 && i < th - 2) { rect(g, xo - 2, y, 5, 1, P('#edc')); px(g, xo + 2, y, P('#a98')); px(g, xo, y, P('#766')); }
      else px(g, xo, y, P('#cba'));
    } else {
      const row = i === th - 2 ? ['#322', '#322', '#322', '#322', '#fc4', '#322', '#322'] : i === 0 ? [A.m, A.l, A.l, A.l, A.l, A.m, A.d]
        : i < 4 ? [A.d, A.m, A.l, A.l, A.m, A.m, A.d] : i === th - 1 ? [A.d, A.m, A.m, A.d, A.m, A.m, A.d] : [A.d, A.m, A.m, A.l, A.m, A.d, A.d];
      for (let c = 0; c < 7; c++) px(g, xo - 3 + c, y, P(row[c]));
      if (i === 2) px(g, xo + 1, y, P(A.t));
    }
  }
  // --- front leg ---
  drawLeg(legA, hipX + 1, false);
  // --- head ---
  const hx = shX - 3 + (p.hx || 0), hy = shY - 7 + (p.hy || 0);
  if (bone) {
    const rows = ['.lllll.', 'lllllld', 'llollod', 'lllllld', '.llldd.', '..l.l.l'];
    rows.forEach((r, j) => { for (let c = 0; c < 7; c++) { const ch = r[c]; if (ch !== '.') px(g, hx + c, hy + 1 + j, P(ch === 'l' ? '#fed' : ch === 'd' ? '#ba9' : p.angry ? '#f33' : '#301')); } });
    // rusted half-helm
    rect(g, hx, hy, 7, 2, P('#754')); rect(g, hx + 1, hy - 1, 5, 1, P('#976')); px(g, hx + 3, hy - 2, P('#976')); px(g, hx + 1, hy, P('#a87'));
  } else {
    const rows = ['..lll..', '.lllllm', 'llllmmd', 'lmdvvvv', 'lmmdvmd', '.mmmdd.', '..ddd..'];
    rows.forEach((r, j) => { for (let c = 0; c < 7; c++) { const ch = r[c]; if (ch !== '.') px(g, hx + c, hy + j, P(ch === 'l' ? A.l : ch === 'm' ? A.m : ch === 'd' ? A.d : '#102')); } });
    px(g, hx + 5, hy + 3, P('#8ef'));
    px(g, hx + 3, hy + 2, P(A.t));
    // plume
    const wv = Math.sin((p.t || 0) * 6) * 0.8 + (p.plume || 0);
    const pl = [[3, -1], [2, -2], [1, -3], [0, -3], [-1, -2.5], [-2, -1.6 + wv * 0.5], [-3, -0.4 + wv], [-4, 1 + wv * 1.4]];
    pl.forEach(([dx, dy], i) => { rect(g, hx + dx, hy + dy, 2, 2, P('#a02')); });
    pl.forEach(([dx, dy], i) => { px(g, hx + dx, hy + dy, P(i < 6 ? '#f44' : '#d23')); });
  }
  // --- sword + front arm ---
  if (bone) { // round shield on the back arm, drawn over the body
    const sx = armB[2] + 2, sy = armB[3];
    disc(g, sx, sy, 4, P('#532')); disc(g, sx, sy, 3, P('#854')); px(g, sx, sy, P('#dc9')); px(g, sx - 1, sy - 2, P('#a75')); rect(g, sx - 3, sy, 1, 2, P('#321'));
  }
  if (p.sw != null) drawSword(g, armF[2], armF[3], p.sw, st.blade, st.blade.len);
  drawArm(armF, shX + 1, shY + 2, false);
  if (!bone) { // pauldron
    rect(g, shX - 1, shY, 4, 3, P(A.m)); rect(g, shX - 1, shY, 3, 1, P(A.l)); px(g, shX, shY + 1, P(A.l)); px(g, shX + 2, shY + 2, P(A.d));
  }
  return { hand: [armF[2] - ox, armF[3] - gy], shoulder: [shX + 1 - ox, shY + 2 - gy] };
}

const heroOut = [null, null];
export function renderHumanoid(pose, st, flash) {
  const g = scr().g; g.clearRect(0, 0, 64, 64);
  const info = humanoid(g, pose, st);
  const k = flash ? 1 : 0;
  const out = heroOut[k] || (heroOut[k] = mk(64, 64));
  compose(out.g, _scr, 64, 64, '#101', flash);
  out.info = info;
  return out;
}
export function drawHumanoid(g, pose, st, x, y, flip, flash, alpha = 1) {
  const im = renderHumanoid(pose, st, flash);
  x = Math.round(x); y = Math.round(y);
  if (alpha < 1) g.globalAlpha = alpha;
  if (flip) { g.save(); g.translate(x, 0); g.scale(-1, 1); g.drawImage(im, -HERO_AX, y - HERO_AY); g.restore(); } else g.drawImage(im, x - HERO_AX, y - HERO_AY);
  g.globalAlpha = 1;
  return im.info;
}

// anim: idle|run|jump|fall|crouch|attack|stab|airatk|hurt ; t = seconds-ish clock, ph = run phase, k = attack progress 0..1
export function heroPose(anim, t, ph, k) {
  const p = { t };
  const s = Math.sin(ph), c = Math.cos(ph);
  switch (anim) {
    case 'run':
      p.fa = [s * 5, Math.max(0, c) * 4]; p.fb = [-s * 5, Math.max(0, -c) * 4];
      p.hip = -Math.abs(c) * 1.2 + 0.6; p.lean = 1; p.af = [0.5 - s * 0.6, 1.2]; p.ab = [s * 0.9 - 0.1, 0.7]; p.sw = 2.25 + s * 0.15; p.plume = 0.8;
      break;
    case 'jump':
      p.fa = [3, 5]; p.fb = [-2, 2]; p.af = [1.3, 0.9]; p.ab = [-1.0, 0.5]; p.sw = 2.6; p.lean = 1; p.plume = 1.2; break;
    case 'fall':
      p.fa = [3 + Math.sin(t * 14) * 0.6, 1]; p.fb = [-3, 3]; p.af = [2.1, 0.5]; p.ab = [-2.1, 0.4]; p.sw = 2.95; p.plume = -1.6; break;
    case 'crouch':
      p.hip = 6; p.fa = [4, 0]; p.fb = [-3, 0]; p.lean = 1; p.af = [0.9, 1.3]; p.ab = [0.3, 0.8]; p.sw = 2.2; break;
    case 'stab': {
      const u = Math.sin(Math.min(1, k * 1.4) * Math.PI);
      p.hip = 6; p.fa = [4 + u, 0]; p.fb = [-3, 0]; p.lean = 1 + u; p.af = [1.57, 0]; p.thrust = u * 3 - 1; p.ab = [-0.6, 0.6]; p.sw = 1.57; p.shift = u;
      break;
    }
    case 'attack': case 'airatk': {
      let a, th;
      if (k < 0.2) { const u = smooth(k / 0.2); a = lerp(2.4, 3.9, u); th = a + 0.55; p.lean = -1; }
      else if (k < 0.5) { const u = smooth((k - 0.2) / 0.3); a = lerp(3.9, 0.95, u); th = a + 0.3 - u * 0.5; p.lean = lerp(-1, 2, u); }
      else { const u = (k - 0.5) / 0.5; a = lerp(0.95, 0.6, u); th = lerp(0.75, 1.7, smooth(u)); p.lean = lerp(2, 0, u); }
      p.af = [a, 0.25]; p.sw = th; p.ab = [-0.8, 0.5];
      if (anim === 'attack') { const st = k > 0.2 ? Math.min(1, (k - 0.2) / 0.2) : 0; p.fa = [2 + st * 3, 0]; p.fb = [-3, 0]; p.hip = st * 1; }
      else { p.fa = [3, 4]; p.fb = [-3, 2]; }
      break;
    }
    case 'hurt':
      p.lean = -2; p.fa = [3, 3]; p.fb = [-1, 1]; p.af = [2.6, 0.2]; p.ab = [-2.4, 0.2]; p.sw = 3.4; p.hy = -1; p.plume = 2; break;
    default: { // idle
      const b = Math.sin(t * 2.4);
      p.sh = b > 0.2 ? 1 : 0; p.fa = [3, 0]; p.fb = [-2, 0]; p.af = [0.35 + b * 0.04, 0.9]; p.ab = [-0.25, 0.3]; p.sw = 2.5 + b * 0.04; p.plume = b * 0.3;
    }
  }
  return p;
}

// ================= boss: floating sorcerer =================
export const BOSS_AX = 32, BOSS_AY = 40;
const bossOut = [null, null];
export function renderBoss(t, cast, flash, enraged) {
  const g = scr().g; g.clearRect(0, 0, 72, 80);
  const cx = 32, sy = 26;
  const robe = enraged ? ['#201', '#512', '#824', '#c46'] : ['#102', '#314', '#526', '#84a'];
  // robe
  for (let y = sy; y < 68; y++) {
    const k = (y - sy) / 40, hw = 7 + k * 9 + Math.sin(y * 0.3 + t * 4) * k * 2.2;
    const xo = Math.sin(t * 2 + y * 0.08) * k * 3;
    for (let x = Math.round(cx - hw + xo); x <= Math.round(cx + hw + xo); x++) {
      const hem = 60 + hash(x, 1) * 7 + Math.sin(x * 0.9 + t * 5) * 1.6;
      if (y > hem) continue;
      const u = (x - (cx - hw + xo)) / (hw * 2), fold = Math.sin(x * 1.1 - xo + y * 0.12);
      let c = u < 0.14 ? robe[3] : u > 0.82 ? robe[0] : fold > 0.5 ? robe[2] : fold < -0.4 ? robe[0] : robe[1];
      if (y > hem - 2) c = '#fc4'; else if (y > hem - 3) c = robe[0];
      px(g, x, y, P(c));
    }
  }
  rect(g, cx - 1, sy + 2, 2, 30, P('#fc4')); for (let y = sy + 4; y < sy + 30; y += 5) px(g, cx - 1, y, P('#a61'));
  // mantle
  ellipse(g, cx, sy + 1, 11, 4.5, P(robe[2])); ellipse(g, cx - 1, sy, 9, 3, P(robe[3])); rect(g, cx - 10, sy + 4, 21, 1, P('#fc4'));
  // hood
  disc(g, cx, 16, 8, P(robe[1])); disc(g, cx - 1, 15, 7, P(robe[2])); ellipse(g, cx - 3, 12, 3, 2, P(robe[3]));
  ellipse(g, cx + 1, 18, 5, 5.5, P('#000'));
  const ec = cast > 0.3 ? '#ff8' : '#f4f';
  rect(g, cx - 2, 17, 2, cast > 0.3 ? 2 : 1, P(ec)); rect(g, cx + 3, 17, 2, cast > 0.3 ? 2 : 1, P(ec));
  poly(g, [[cx - 6, 8], [cx - 2, 2 + Math.sin(t * 3)], [cx + 3, 9]], P(robe[1]));
  // staff arm
  const raise = cast * 9;
  const hxs = cx + 15, hys = sy + 10 - raise;
  line(g, cx + 8, sy + 4, hxs, hys, P(robe[1]), 3); line(g, cx + 8, sy + 3, hxs, hys - 1, P(robe[3]), 1);
  line(g, hxs + 1, hys - 24, hxs + 1, hys + 22, P('#532'), 2); line(g, hxs + 1, hys - 24, hxs + 1, hys + 22, P('#a74'), 1);
  rect(g, hxs - 1, hys - 1, 4, 3, P('#dbc'));
  const oc = cast > 0.3 ? ['#fff', '#fe8', '#f72'] : ['#fdf', '#f6f', '#92c'];
  disc(g, hxs + 1, hys - 28, 4, P(oc[2])); disc(g, hxs + 1, hys - 28, 3, P(oc[1])); px(g, hxs, hys - 30, P(oc[0])); px(g, hxs + 1, hys - 29, P(oc[0]));
  rect(g, hxs - 3, hys - 24, 2, 2, P('#fc4')); rect(g, hxs + 4, hys - 24, 2, 2, P('#fc4'));
  // other arm
  const ax2 = cx - 14 - cast * 2, ay2 = sy + 12 - raise * 1.6;
  line(g, cx - 9, sy + 4, ax2, ay2, P(robe[1]), 3); line(g, cx - 9, sy + 3, ax2, ay2 - 1, P(robe[3]), 1);
  rect(g, ax2 - 1, ay2 - 1, 3, 3, P('#dbc'));
  if (cast > 0.3) { disc(g, ax2, ay2 - 5, 2 + Math.sin(t * 20) * 0.8, P('#fa3')); px(g, ax2, ay2 - 5, P('#fff')); }
  const k = flash ? 1 : 0, out = bossOut[k] || (bossOut[k] = mk(72, 80));
  compose(out.g, _scr, 72, 80, '#000', flash);
  return out;
}

// ================= baked sprites =================
export const SPR = {};

function slimeDraw(pal) {
  // frames 0-3 idle wobble, 4 stretch (jump), 5 squash (land)
  const sq = [0, 0.25, 0, -0.2, -0.7, 0.8];
  return (g, i) => {
    const s = sq[i], rx = 7.5 * (1 + s * 0.28), ry = 11 * (1 - s * 0.32), cx = 14, by = 21;
    for (let y = 0; y <= Math.round(ry); y++) {
      const v = y / ry, hw = rx * Math.pow(1 - Math.pow(1 - v, 2.2), 0.5) * (v > 0.85 ? 1.04 : 1);
      for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) {
        const u = (x - cx) / (hw + 0.01);
        let c = v > 0.86 || u > 0.72 ? pal[3] : (u < -0.25 && v < 0.5) ? pal[1] : pal[2];
        if (u < -0.2 && u > -0.62 && v > 0.2 && v < 0.38) c = pal[0];
        px(g, x, by - Math.round(ry) + y, P(c));
      }
    }
    const ey = by - Math.round(ry * 0.52);
    rect(g, cx - 1, ey, 2, 3, P('#101')); rect(g, cx + 3, ey, 2, 3, P('#101')); px(g, cx - 1, ey, P('#fff')); px(g, cx + 3, ey, P('#fff'));
    rect(g, cx, ey + 4, 4, 1, P(pal[4]));
  };
}
function batDraw(g, i) {
  const cx = 14, cy = 9;
  if (i === 0) { // hanging, wings folded
    poly(g, [[cx - 4, cy - 6], [cx + 4, cy - 6], [cx + 3, cy + 6], [cx, cy + 8], [cx - 3, cy + 6]], P('#314'));
    rect(g, cx - 3, cy - 6, 2, 10, P('#637')); rect(g, cx - 2, cy + 3, 5, 4, P('#526'));
    px(g, cx - 1, cy + 5, P('#f33')); px(g, cx + 1, cy + 5, P('#f33')); px(g, cx - 2, cy + 8, P('#526')); px(g, cx + 2, cy + 8, P('#526'));
    rect(g, cx - 2, cy - 8, 1, 2, P('#526')); rect(g, cx + 2, cy - 8, 1, 2, P('#526'));
    return;
  }
  const a = [0, -0.9, -0.2, 0.7, 0.1][i];
  for (const d of [-1, 1]) {
    const tx = cx + d * 12, ty = cy + a * 8, mx = cx + d * 6, my = cy + a * 3 - 3;
    poly(g, [[cx, cy - 1], [mx, my], [tx, ty], [cx + d * 8, ty + 3 - a], [cx + d * 5, cy + 4], [cx, cy + 2]], P('#314'));
    line(g, cx, cy - 1, mx, my, P('#84a')); line(g, mx, my, tx, ty, P('#84a')); line(g, mx, my, cx + d * 5, cy + 3, P('#526'));
  }
  ellipse(g, cx, cy, 3, 4, P('#526')); px(g, cx - 1, cy - 2, P('#84a'));
  px(g, cx - 2, cy - 5, P('#526')); px(g, cx + 2, cy - 5, P('#526'));
  px(g, cx - 1, cy - 1, P('#f33')); px(g, cx + 1, cy - 1, P('#f33')); px(g, cx, cy + 1, P('#fff'));
}
function plantDraw(g, i) {
  const bx = 14, by = 29, sway = [0, 1, 0, -1, 2, -2][i], open = [0.25, 0.3, 0.25, 0.2, 1, 0.5][i];
  // leaves
  poly(g, [[bx, by], [bx - 10, by - 5], [bx - 5, by - 1]], P('#383')); line(g, bx, by, bx - 9, by - 5, P('#5b3'));
  poly(g, [[bx, by], [bx + 10, by - 4], [bx + 5, by]], P('#252')); line(g, bx, by, bx + 9, by - 4, P('#383'));
  // stem
  let pxx = bx, pyy = by;
  for (let k = 1; k <= 14; k++) {
    const x = bx + Math.sin(k * 0.25) * 2 + (sway * k) / 14, y = by - k;
    line(g, pxx, pyy, x, y, P('#252'), 2); px(g, x, y, P('#5b3')); pxx = x; pyy = y;
  }
  const hx = pxx + 1, hy = pyy - 4;
  disc(g, hx, hy, 6, P('#a13')); disc(g, hx - 1, hy - 1, 5, P('#d35')); ellipse(g, hx - 2, hy - 3, 2, 1.5, P('#f79'));
  // mouth wedge facing forward
  const m = 1 + open * 4;
  poly(g, [[hx - 1, hy], [hx + 8, hy - m], [hx + 8, hy + m]], P('#301'));
  for (let k = 0; k < 3; k++) { px(g, hx + 2 + k * 2, hy - Math.round(m * (0.25 + k * 0.28)), P('#fff')); px(g, hx + 2 + k * 2, hy + Math.round(m * (0.25 + k * 0.28)), P('#fff')); }
  px(g, hx - 3, hy + 2, P('#fee')); px(g, hx - 1, hy - 4, P('#fee')); px(g, hx - 4, hy - 1, P('#fee'));
  rect(g, hx - 4, hy + 5, 6, 1, P('#383'));
}
function wispDraw(g, i) {
  const cx = 12, cy = 14, t = i / 4 * 6.28;
  for (let k = 0; k < 9; k++) { // flame tail rising
    const w = 4.5 * (1 - k / 9), x = cx + Math.sin(t + k * 0.8) * (k * 0.35);
    rect(g, x - w, cy - 4 - k, Math.max(1, w * 2), 1, P(k < 3 ? '#8ef' : k < 6 ? '#4bd' : '#27a'));
  }
  disc(g, cx, cy, 5, P('#4bd')); disc(g, cx, cy, 4, P('#8ef')); disc(g, cx - 1, cy - 1, 2, P('#fff'));
  rect(g, cx - 2, cy, 2, 2, P('#013')); rect(g, cx + 2, cy, 2, 2, P('#013')); rect(g, cx - 1, cy + 3, 3, 1, P('#013'));
}
function merchantDraw(g, i) {
  const bx = 18, by = 33, b = i ? 1 : 0;
  // backpack
  rect(g, bx - 13, by - 22 + b, 9, 15, P('#853')); rect(g, bx - 13, by - 22 + b, 9, 2, P('#a74')); rect(g, bx - 13, by - 22 + b, 2, 15, P('#a74'));
  rect(g, bx - 14, by - 26 + b, 11, 4, P('#c96')); rect(g, bx - 14, by - 26 + b, 11, 1, P('#eb8')); rect(g, bx - 11, by - 26 + b, 1, 4, P('#532')); rect(g, bx - 6, by - 26 + b, 1, 4, P('#532'));
  rect(g, bx - 12, by - 12 + b, 3, 4, P('#4bd')); px(g, bx - 12, by - 12 + b, P('#cff')); rect(g, bx - 8, by - 15 + b, 2, 3, P('#c33'));
  // robe
  for (let y = 0; y < 20; y++) {
    const hw = 4 + y * 0.28, yy = by - 19 + y;
    for (let x = Math.round(bx - hw); x <= Math.round(bx + hw); x++) {
      const u = (x - bx + hw) / (hw * 2);
      px(g, x, yy, P(u < 0.2 ? '#396' : u > 0.8 ? '#132' : (x + (y >> 2)) % 5 === 0 ? '#153' : '#274'));
    }
  }
  rect(g, bx - 9, by - 1, 19, 1, P('#fc4'));
  rect(g, bx - 4, by - 12, 9, 2, P('#a61')); px(g, bx, by - 12, P('#fc4'));
  // hood + face
  disc(g, bx, by - 23 + b, 6, P('#274')); disc(g, bx - 1, by - 24 + b, 5, P('#396')); ellipse(g, bx + 1, by - 22 + b, 4, 4, P('#210'));
  px(g, bx, by - 23 + b, P('#fe8')); px(g, bx + 3, by - 23 + b, P('#fe8'));
  poly(g, [[bx - 2, by - 20 + b], [bx + 4, by - 20 + b], [bx + 1, by - 13 + b]], P('#eee')); px(g, bx + 1, by - 18 + b, P('#bbb'));
  // lantern staff
  line(g, bx + 11, by - 30, bx + 11, by, P('#532'), 2); line(g, bx + 11, by - 30, bx + 11, by, P('#964'), 1);
  line(g, bx + 11, by - 30, bx + 15, by - 30, P('#964'));
  rect(g, bx + 13, by - 28 + b, 5, 6, P('#a61')); rect(g, bx + 14, by - 27 + b, 3, 4, P(i ? '#ff8' : '#fd4')); px(g, bx + 15, by - 26 + b, P('#fff'));
  rect(g, bx + 8, by - 13, 3, 3, P('#da8'));
}
function chestDraw(g, i) {
  const x = 2, y = 5;
  if (i === 0) {
    rect(g, x, y + 4, 18, 10, P('#853')); rect(g, x, y + 4, 18, 1, P('#310'));
    for (let k = 0; k < 4; k++) rect(g, x + k, y + 3 - k, 18 - k * 2, 1, P(k === 3 ? '#c96' : '#a74'));
    rect(g, x, y + 9, 18, 1, P('#632')); rect(g, x + 1, y + 5, 16, 1, P('#a74'));
    for (const bx of [x + 2, x + 13]) { rect(g, bx, y, 3, 14, P('#fc4')); rect(g, bx, y, 1, 14, P('#ffb')); rect(g, bx + 2, y, 1, 14, P('#a61')); }
    rect(g, x + 7, y + 3, 4, 5, P('#fc4')); rect(g, x + 8, y + 5, 2, 2, P('#310')); px(g, x + 7, y + 3, P('#ffb'));
  } else {
    rect(g, x, y + 4, 18, 10, P('#853')); rect(g, x, y + 9, 18, 1, P('#632'));
    rect(g, x + 1, y + 4, 16, 3, P('#fd4')); rect(g, x + 2, y + 3, 14, 1, P('#ffb')); px(g, x + 5, y + 2, P('#fff')); px(g, x + 11, y + 2, P('#fff'));
    rect(g, x, y - 5, 18, 5, P('#632')); rect(g, x, y - 5, 18, 1, P('#a74')); rect(g, x + 1, y - 1, 16, 1, P('#310'));
    for (const bx of [x + 2, x + 13]) { rect(g, bx, y - 5, 3, 5, P('#fc4')); rect(g, bx, y + 6, 3, 8, P('#fc4')); rect(g, bx, y + 6, 1, 8, P('#ffb')); rect(g, bx + 2, y + 6, 1, 8, P('#a61')); }
  }
}
function shrineDraw(g, i) {
  const cx = 10, by = 33;
  rect(g, cx - 7, by - 4, 15, 4, P('#667')); rect(g, cx - 7, by - 4, 15, 1, P('#99a')); rect(g, cx - 5, by - 7, 11, 3, P('#556')); rect(g, cx - 5, by - 7, 11, 1, P('#889'));
  for (let y = by - 20; y < by - 7; y++) for (let x = -3; x <= 3; x++) px(g, cx + x, y, P(x === -3 ? '#aab' : x < 0 ? '#778' : x < 3 ? '#556' : '#334'));
  for (let y = by - 18; y < by - 9; y += 3) px(g, cx - 1 + ((y / 3) & 1), y, P(i ? '#4ef' : '#334'));
  rect(g, cx - 6, by - 23, 13, 3, P('#778')); rect(g, cx - 6, by - 23, 13, 1, P('#bbc')); rect(g, cx - 4, by - 24, 9, 1, P('#99a'));
  if (i === 0) { disc(g, cx, by - 27, 2, P('#445')); px(g, cx - 1, by - 28, P('#667')); return; }
  const f = i - 1;
  for (let k = 0; k < 9; k++) {
    const w = [3, 3.5, 3.5, 3, 2.5, 2, 1.5, 1, 0.5][k], x = cx + Math.sin(f * 1.6 + k * 0.7) * (k * 0.22);
    rect(g, x - w, by - 25 - k, Math.max(1, Math.round(w * 2)), 1, P(k < 2 ? '#fff' : k < 5 ? '#8ef' : '#29d'));
  }
  rect(g, cx - 1, by - 28, 2, 3, P('#fff'));
}
function runeDraw(g, i) {
  const cx = 9, cy = 10;
  for (let y = -8; y <= 8; y++) {
    const hw = 5.6 * Math.pow(1 - Math.pow(Math.abs(y) / 8.6, 3), 0.5);
    for (let x = Math.round(-hw); x <= Math.round(hw); x++) {
      const u = x / (hw + 0.1);
      px(g, cx + x, cy + y, P(u < -0.5 || y < -6 ? '#ccd' : u > 0.55 || y > 6 ? '#445' : (x * 3 + y * 5) % 11 === 0 ? '#667' : '#889'));
    }
  }
  const gl = ['#4ef', '#8ff', '#fff', '#8ff'][i], g2 = ['#07a', '#0bd', '#4ef', '#0bd'][i];
  line(g, cx, cy - 5, cx, cy + 5, P(gl)); line(g, cx, cy - 5, cx + 3, cy - 2, P(gl)); line(g, cx + 3, cy - 2, cx, cy + 1, P(gl));
  line(g, cx, cy + 1, cx - 3, cy + 4, P(gl)); px(g, cx + 1, cy - 5, P(g2)); px(g, cx - 1, cy + 5, P(g2)); px(g, cx + 1, cy + 1, P(g2));
}
function coinDraw(g, i) {
  const rx = [3.4, 2.4, 0.8, 2.4][i], cx = 5, cy = 5;
  for (let y = -3; y <= 3; y++) {
    const hw = rx * Math.sqrt(1 - (y * y) / 12.5);
    for (let x = Math.round(-hw); x <= Math.round(hw); x++) px(g, cx + x, cy + y, P(x <= -hw + 1 && hw > 1 ? '#ffb' : x >= hw - 0.8 && hw > 1 ? '#a61' : y === -3 ? '#ffb' : '#fc3'));
  }
  if (i === 0) { rect(g, cx, cy - 1, 1, 3, P('#a61')); px(g, cx - 1, cy - 2, P('#fff')); }
}
function gemDraw(pal) {
  return (g) => {
    const cx = 5, cy = 6;
    for (let y = -4; y <= 5; y++) {
      const hw = y < -1 ? 4 + (y + 1) : 4 - (y + 1) * 0.72;
      for (let x = Math.round(-hw); x <= Math.round(hw); x++) px(g, cx + x, cy + y, P(y < -1 ? (x < 0 ? pal[0] : pal[1]) : x < -1 ? pal[1] : x > 1 ? pal[3] : pal[2]));
    }
    px(g, cx - 2, cy - 3, P('#fff')); px(g, cx - 1, cy - 3, P('#fff'));
  };
}
const HEART = ['.XX.XX.', 'XHXXXXX', 'XXXXXXD', '.XXXXD.', '..XXD..', '...D...'];
function heartDraw(c) {
  return (g) => HEART.forEach((r, j) => { for (let i = 0; i < 7; i++) if (r[i] !== '.') px(g, 2 + i, 2 + j, P(r[i] === 'H' ? c[0] : r[i] === 'D' ? c[2] : c[1])); });
}
function portalDraw(g) {
  const cx = 20, by = 51;
  for (let a = 0; a <= 32; a++) {
    const ang = Math.PI * (a / 32), x = cx - Math.cos(ang) * 14, y = by - 30 - Math.sin(ang) * 14;
    rect(g, x - 3, y - 3, 6, 6, P('#556'));
  }
  rect(g, cx - 17, by - 30, 6, 30, P('#556')); rect(g, cx + 11, by - 30, 6, 30, P('#556'));
  // stone blocks + lighting
  for (let y = by - 30; y < by; y++) for (const sx of [cx - 17, cx + 11]) {
    const j = (y - by + 30) % 8;
    px(g, sx, y, P('#99a')); px(g, sx + 1, y, P('#778')); px(g, sx + 5, y, P('#334'));
    if (j === 0) rect(g, sx, y, 6, 1, P('#334')); else if (j === 1) rect(g, sx + 1, y, 4, 1, P('#889'));
  }
  for (let a = 0; a <= 32; a++) {
    const ang = Math.PI * (a / 32), x = cx - Math.cos(ang) * 16.5, y = by - 30 - Math.sin(ang) * 16.5;
    px(g, x, y, P(a < 20 ? '#aab' : '#667'));
    if (a % 5 === 0) line(g, cx - Math.cos(ang) * 11.5, by - 30 - Math.sin(ang) * 11.5, x, y, P('#334'));
  }
  rect(g, cx - 19, by - 3, 10, 3, P('#667')); rect(g, cx + 9, by - 3, 10, 3, P('#667')); rect(g, cx - 19, by - 3, 10, 1, P('#aab')); rect(g, cx + 9, by - 3, 10, 1, P('#aab'));
  rect(g, cx - 2, by - 50, 5, 5, P('#778')); px(g, cx, by - 48, P('#4ef'));
  for (const [dx, dy] of [[-15, -20], [13, -12], [-15, -8], [13, -24]]) { px(g, cx + dx + 1, by + dy, P('#4ef')); px(g, cx + dx + 2, by + dy + 1, P('#4ef')); }
}
function flameDraw(cols) {
  return (g, i) => {
    const cx = 6, by = 15;
    for (let k = 0; k < 12; k++) {
      const w = [2.5, 3, 3.2, 3, 2.6, 2.2, 1.8, 1.4, 1, 0.8, 0.5, 0.5][k], x = cx + Math.sin(i * 1.7 + k * 0.6) * (k * 0.16);
      if (k > 9 && (i + k) % 2) continue;
      rect(g, Math.round(x - w), by - k, Math.max(1, Math.round(w * 2)), 1, P(cols[2]));
      if (k < 8 && w > 1.4) rect(g, Math.round(x - w + 1), by - k, Math.max(1, Math.round(w * 2) - 2), 1, P(cols[1]));
      if (k < 5 && w > 2.2) rect(g, Math.round(x - 1), by - k, 2, 1, P(cols[0]));
    }
  };
}
function fireballDraw(cols) {
  return (g, i) => {
    const cx = 8, cy = 8;
    for (let k = 0; k < 6; k++) { const a = i * 1.57 + k * 1.05; px(g, cx + Math.cos(a) * 6, cy + Math.sin(a) * 6, P(cols[2])); px(g, cx + Math.cos(a + 0.5) * 5, cy + Math.sin(a + 0.5) * 5, P(cols[1])); }
    disc(g, cx, cy, 4.4, P(cols[2])); disc(g, cx, cy, 3.2, P(cols[1])); disc(g, cx - (i & 1), cy - ((i >> 1) & 1), 1.6, P(cols[0]));
  };
}
function waveDraw(g, i) {
  const cx = 4, cy = 12;
  for (let y = -10; y <= 10; y++) {
    const x = Math.sqrt(100 - y * y) * 0.8, th = 3.2 * (1 - Math.abs(y) / 11) + 0.6;
    rect(g, cx + x - th, cy + y, Math.max(1, Math.round(th)), 1, P('#f62'));
    if (th > 1.6) rect(g, cx + x - th + 1.4, cy + y, Math.max(1, Math.round(th - 1.4)), 1, P('#fd4'));
    if (th > 2.8) px(g, cx + x - 1, cy + y, P('#fff'));
    if ((y + i * 3 + 30) % 5 === 0) px(g, cx + x - th - 2, cy + y, P('#f62'));
  }
}
function helmDraw(g) {
  const rows = ['..lll..', '.llllm.', 'lllmmmd', 'lmmvvvv', 'lmmmmmd', '.mmmdd.'];
  rows.forEach((r, j) => { for (let c = 0; c < 7; c++) { const ch = r[c]; if (ch !== '.') px(g, 3 + c, 4 + j, P(ch === 'l' ? '#fff' : ch === 'm' ? '#9bd' : ch === 'd' ? '#457' : '#101')); } });
  rect(g, 2, 2, 3, 2, P('#f44')); rect(g, 4, 1, 3, 2, P('#f44')); px(g, 1, 3, P('#a02')); px(g, 1, 4, P('#a02'));
}

export function initSprites() {
  SPR.slime = [
    bake(28, 24, 14, 22, 6, slimeDraw(['#efd', '#9e5', '#4b3', '#274', '#142'])),
    bake(28, 24, 14, 22, 6, slimeDraw(['#eff', '#7de', '#39c', '#157', '#024'])),
    bake(28, 24, 14, 22, 6, slimeDraw(['#ffc', '#fb3', '#e52', '#811', '#300'])),
  ];
  SPR.bat = bake(28, 20, 14, 9, 5, batDraw);
  SPR.plant = bake(32, 32, 14, 30, 6, plantDraw);
  SPR.wisp = bake(24, 22, 12, 14, 4, wispDraw, '#125');
  SPR.merchant = bake(40, 36, 18, 34, 2, merchantDraw);
  SPR.chest = bake(22, 20, 11, 19, 2, chestDraw);
  SPR.shrine = bake(20, 34, 10, 33, 5, shrineDraw);
  SPR.rune = bake(18, 20, 9, 10, 4, runeDraw);
  SPR.coin = bake(10, 10, 5, 5, 4, coinDraw, '#420');
  SPR.gem = [bake(10, 12, 5, 6, 1, gemDraw(['#fff', '#8ff', '#2cd', '#079']), '#024'), bake(10, 12, 5, 6, 1, gemDraw(['#fff', '#f9b', '#e36', '#814']), '#301')];
  SPR.heart = bake(11, 10, 5, 5, 1, heartDraw(['#fff', '#f34', '#a02']), '#300');
  SPR.heartEmpty = bake(11, 10, 5, 5, 1, heartDraw(['#545', '#323', '#212']), '#000');
  SPR.portal = bake(40, 52, 20, 51, 1, portalDraw);
  SPR.flame = bake(12, 16, 6, 15, 4, flameDraw(['#fff', '#fd4', '#f62']), 'none');
  SPR.fireball = bake(16, 16, 8, 8, 4, fireballDraw(['#fff', '#fd4', '#f52']), 'none');
  SPR.darkball = bake(16, 16, 8, 8, 4, fireballDraw(['#fff', '#f8f', '#a2d']), 'none');
  SPR.seed = bake(8, 8, 4, 4, 2, (g, i) => { disc(g, 4, 4, 2.2, P('#8d3')); px(g, 3, 3, P('#efa')); px(g, 5 - i, 5, P('#383')); });
  SPR.wave = bake(16, 24, 6, 12, 2, waveDraw, 'none');
  SPR.helm = bake(12, 12, 6, 6, 1, helmDraw);
  SPR.bracket = bake(10, 12, 5, 2, 1, (g) => { rect(g, 3, 1, 4, 2, P('#989')); rect(g, 2, 3, 6, 1, P('#545')); rect(g, 4, 4, 2, 6, P('#643')); px(g, 4, 4, P('#964')); rect(g, 3, 1, 4, 1, P('#cbc')); });
}

// ================= lighting stamps / glows =================
const stamps = {};
// Stepped (banded) alpha disc used with destination-out to punch light holes.
export function lightStamp(r) {
  r = Math.round(r);
  if (stamps[r]) return stamps[r];
  const cv = mk(r * 2, r * 2), im = cv.g.createImageData(r * 2, r * 2), d = im.data;
  const bands = [255, 255, 200, 140, 84, 40];
  for (let y = 0; y < r * 2; y++) for (let x = 0; x < r * 2; x++) {
    const dd = Math.hypot(x - r + 0.5, y - r + 0.5) / r;
    if (dd >= 1) continue;
    const b = clamp(Math.floor(dd * bands.length + (bayer(x, y) - 0.5) * 0.5), 0, bands.length - 1);
    d[(y * r * 2 + x) * 4 + 3] = bands[b];
  }
  cv.g.putImageData(im, 0, 0);
  return (stamps[r] = cv);
}
const glows = {};
// Additive banded halo.
export function glow(col, r) {
  const key = col + r;
  if (glows[key]) return glows[key];
  const c = C(col), cv = mk(r * 2, r * 2), im = cv.g.createImageData(r * 2, r * 2), d = im.data;
  for (let y = 0; y < r * 2; y++) for (let x = 0; x < r * 2; x++) {
    const dd = Math.hypot(x - r + 0.5, y - r + 0.5) / r;
    if (dd >= 1) continue;
    const lvl = dd < 0.3 ? 0.5 : dd < 0.55 ? 0.28 : dd < 0.8 ? 0.15 : 0.07;
    const i = (y * r * 2 + x) * 4;
    d[i] = c[0] * lvl; d[i + 1] = c[1] * lvl; d[i + 2] = c[2] * lvl; d[i + 3] = 255;
  }
  cv.g.putImageData(im, 0, 0);
  return (glows[key] = cv);
}
