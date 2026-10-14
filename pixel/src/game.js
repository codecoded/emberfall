// EMBERFALL Classic — game state machine, camera, HUD, shop, rendering.
import { W, H, TS, C, css, mk, clamp, lerp, hash, rect, px, bayer, input } from './core.js';
import { text, textW, makeLogo, GOLD, SILVER, EMBER, JADE } from './font.js';
import { audio } from './audio.js';
import { buildLevel, LEVEL_DEFS } from './levels.js';
import { makeBackdrop, drawBackdrop } from './art-bg.js';
import { renderTerrain, platformSprite } from './art-terrain.js';
import { SPR, drawSpr, initSprites, lightStamp, glow, drawHumanoid, heroPose, renderBoss, ARMOUR, BLADE } from './art-sprites.js';
import { makePlayer, updatePlayer, drawPlayer, makeEnt, makePickup, updateParts, drawParts, part, fx } from './entities.js';

const P = (s) => css(C(s));
const rnd = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));

export const G = {
  state: 'boot', t: 0, tick: 0, st: null, lv: null, art: null, bd: null, ents: [], parts: [], plats: [], amb: [],
  cam: { x: 0, y: 0, look: 0 }, shake: 0, hitstop: 0, flash: 0, paused: false, shop: null, nearMerchant: null,
  message: null, bannerInfo: null, cleared: 0, checkpoint: null, taken: new Set(), arenaLock: false, arenaDone: false, bossDead: false,
  fade: 1, fadeDir: -1, after: null, opt: { q12: true }, dustCols: ['#cba', '#987', '#654'],
  sfx: (n) => audio.sfx(n), music: (n) => audio.music(n),
  msg(s, n = 120) { G.message = { s, n, max: n }; },
  banner(a, b, n = 170) { G.bannerInfo = { a, b, n, max: n }; },
  playerDied, levelClear,
};

const artCache = {}, bdCache = {};
let logo, hudPanel, fadePats, darkCv, frameCv;

const newState = () => ({ coins: 0, lives: 3, hp: 3, maxHp: 3, armour: 0, sword: 0, rune: false, kills: 0, time: 0, level: 0 });

export function init() {
  initSprites();
  logo = makeLogo('EMBERFALL');
  hudPanel = makeHudPanel();
  fadePats = [];
  for (let k = 0; k <= 16; k++) {
    const cv = mk(W, H), im = cv.g.createImageData(W, H), d = im.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (bayer(x >> 1, y >> 1) * 16 < k) d[(y * W + x) * 4 + 3] = 255;
    cv.g.putImageData(im, 0, 0); fadePats.push(cv);
  }
  darkCv = mk(W, H);
  G.st = newState();
  toTitle();
}

function fadeTo(fn) { if (G.after) return; G.fadeDir = 1; G.after = fn; }

// ================= level management =================
export function loadLevel(i, fresh = true) {
  const st = G.st;
  st.level = i;
  G.lv = buildLevel(i);
  G.art = artCache[i] || (artCache[i] = renderTerrain(G.lv));
  G.bd = bdCache[G.lv.world] || (bdCache[G.lv.world] = makeBackdrop(G.lv.world));
  G.dustCols = [['#cb9', '#986', '#654'], ['#9bd', '#678', '#345'], ['#cba', '#877', '#544']][G.lv.world];
  if (fresh) { G.taken = new Set(); G.checkpoint = null; st.rune = false; st.kills = 0; st.time = 0; G.arenaDone = false; G.bossDead = false; }
  spawnAll();
  G.state = 'play'; G.paused = false; G.shop = null; G.cleared = 0;
  if (fresh) G.banner(`WORLD ${i + 1}`, G.lv.name, 190);
  G.music(G.lv.music);
  makeAmbient();
}
function spawnAll() {
  const lv = G.lv;
  G.ents = []; G.parts = []; G.arenaLock = false;
  G.plats = lv.plats.map((m) => ({ ...m, x0: m.x, y0: m.y, ph: 0, dx: 0, dy: 0, spr: platformSprite(lv.world, m.w) }));
  lv.ents.forEach((d, i) => {
    const key = 'e' + i;
    if (G.taken.has(key)) { if (d.type !== 'chest') return; }
    if (d.type === 'boss' && G.bossDead) return;
    if (d.type === 'rune' && G.st.rune) return;
    const e = makeEnt(G, d);
    if (!e) return;
    e.key = key;
    if (d.type === 'chest' && G.taken.has(key)) e.open = true;
    e.z = e.hit && d.type !== 'chest' ? 1 : ['gem', 'heart', 'rune'].includes(d.type) ? 2 : 0;
    G.ents.push(e);
  });
  lv.coins.forEach((c, i) => {
    const key = 'c' + i;
    if (G.taken.has(key)) return;
    const e = makePickup(G, 'coin', c.x, c.y, false); e.key = key; e.z = 2; G.ents.push(e);
  });
  if (G.bossDead && !G.st.rune && lv.arena) { const e = makePickup(G, 'rune', lv.arena.x0 + 192, lv.arena.floor - 30, false); e.z = 2; G.ents.push(e); }
  const s = G.checkpoint || lv.start;
  G.player = makePlayer(s.x, s.y);
  if (G.checkpoint) for (const e of G.ents) if (e.type === 'shrine' && e.sx === s.x) { e.lit = true; e.light = 34; }
  G.cam.x = clamp(G.player.x - W / 2, 0, lv.w * TS - W); G.cam.y = clamp(G.player.y - H * 0.55, 0, lv.h * TS - H); G.cam.look = 0;
}
function playerDied() {
  const st = G.st;
  st.lives--;
  if (st.lives < 0) { G.music(null); G.sfx('gameover'); fadeTo(() => { G.state = 'gameover'; G.t = 0; }); return; }
  fadeTo(() => { st.hp = st.maxHp; spawnAll(); makeAmbient(); G.music(G.lv.music); });
}
function levelClear(portal) {
  if (G.cleared) return;
  G.cleared = 1; G.sfx('portal'); G.music(null);
  G.player.vx = 0;
  fx.sparkle(G, portal.cx, portal.cy - 20, ['#fff', '#8ff', '#0bd'], 30);
}

// ================= ambient particles (screen space) =================
function makeAmbient() {
  const w = G.lv ? G.lv.world : 0;
  G.amb = [];
  const add = (kind, n) => { for (let i = 0; i < n; i++) G.amb.push({ kind, x: rnd(W), y: rnd(H), ph: rnd(6.28), s: rnd(0.5, 1), par: rnd(0.5, 0.9) }); };
  if (w === 0) { add('leaf', 16); add('fly', 12); } else if (w === 1) { add('mote', 26); add('drip', 7); } else { add('ember', 30); add('ash', 14); }
}
function updateAmbient(dcx, dcy) {
  for (const a of G.amb) {
    a.ph += 0.03 * a.s; a.x -= dcx * a.par; a.y -= dcy * a.par;
    if (a.kind === 'leaf') { a.x += Math.sin(a.ph * 1.7) * 0.5 - 0.25; a.y += 0.28 + a.s * 0.3 + Math.cos(a.ph * 1.7) * 0.15; }
    else if (a.kind === 'fly') { a.x += Math.sin(a.ph * 0.9) * 0.3; a.y += Math.cos(a.ph * 1.3) * 0.22; }
    else if (a.kind === 'mote') { a.x += Math.sin(a.ph) * 0.12 + 0.05; a.y -= 0.06 * a.s; }
    else if (a.kind === 'drip') { a.y += 2.2 + a.s; if (a.y > H) { a.y = rnd(-60, 0); a.x = rnd(W); } }
    else if (a.kind === 'ember') { a.x += Math.sin(a.ph * 2) * 0.35 + 0.1; a.y -= 0.35 + a.s * 0.5; }
    else if (a.kind === 'ash') { a.x += Math.sin(a.ph) * 0.3 - 0.15; a.y += 0.2 + a.s * 0.15; }
    if (a.x < -8) a.x += W + 16; else if (a.x > W + 8) a.x -= W + 16;
    if (a.y < -8) a.y += H + 16; else if (a.y > H + 8 && a.kind !== 'drip') a.y -= H + 16;
  }
}
function drawAmbient(g) {
  for (const a of G.amb) {
    const x = Math.round(a.x), y = Math.round(a.y);
    if (a.kind === 'leaf') {
      const c = ['#f84', '#fc4', '#e52', '#9c4'][(a.s * 40 | 0) % 4], f = Math.sin(a.ph * 3) > 0;
      g.fillStyle = P(c); g.fillRect(x, y, 2, 1); g.fillRect(x + (f ? 1 : 0), y + 1, 1, 1);
    } else if (a.kind === 'ash') { g.fillStyle = P(a.s > 0.75 ? '#988' : '#655'); g.fillRect(x, y, 1, 1); }
    else if (a.kind === 'drip') { g.fillStyle = P('#5bd'); g.fillRect(x, y, 1, 3); g.fillStyle = P('#cff'); g.fillRect(x, y + 2, 1, 1); }
  }
  g.globalCompositeOperation = 'lighter';
  for (const a of G.amb) {
    const x = Math.round(a.x), y = Math.round(a.y);
    if (a.kind === 'fly') {
      const b = Math.sin(a.ph * 2.3);
      if (b > -0.2) { g.drawImage(glow('#ad3', 6), x - 6, y - 6); g.fillStyle = P(b > 0.5 ? '#ffb' : '#cf5'); g.fillRect(x, y, 1, 1); }
    } else if (a.kind === 'mote') {
      const b = Math.sin(a.ph * 1.9);
      if (b > 0) { g.fillStyle = P(b > 0.7 ? '#8ff' : '#167'); g.fillRect(x, y, 1, 1); if (b > 0.85) { g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); } }
    } else if (a.kind === 'ember') {
      const k = (a.ph * 0.5) % 1;
      g.fillStyle = P(a.s > 0.8 ? '#fd4' : k < 0.5 ? '#f62' : '#a21'); g.fillRect(x, y, a.s > 0.85 ? 2 : 1, 1);
    }
  }
  g.globalCompositeOperation = 'source-over';
}

// ================= state changes =================
function toTitle() {
  G.state = 'title'; G.t = 0; G.tick = 0;
  G.lv = buildLevel(0);
  G.art = artCache[0] || (artCache[0] = renderTerrain(G.lv));
  G.bd = bdCache[0] || (bdCache[0] = makeBackdrop(0));
  G.ents = []; G.parts = []; G.plats = []; G.message = null; G.bannerInfo = null; G.shop = null;
  makeAmbient();
  G.music('title');
}
const STORY = [
  ['THE EMBER FELL FROM THE SKY', 'A THOUSAND YEARS AGO.', '', 'ITS FIRE WAS BOUND INTO THREE', 'RUNE STONES AND HIDDEN FROM', 'THE HANDS OF MEN.'],
  ['NOW THE SORCERER MALGRIM', 'HAS WOKEN IN THE ASHEN KEEP', 'AND THE LAND GROWS COLD.', '', 'TAKE UP YOUR BLADE, SIR ALDRIC.', 'FIND THE STONES. END HIS REIGN.'],
];

// ================= update =================
export function update() {
  const inp = input;
  G.tick++;
  if (inp.hit('mute')) audio.toggleMute();
  // fades
  if (G.fadeDir) {
    G.fade = clamp(G.fade + G.fadeDir * 0.06, 0, 1);
    if (G.fade >= 1 && G.fadeDir > 0) { const f = G.after; G.after = null; G.fadeDir = -1; if (f) f(); }
    else if (G.fade <= 0) G.fadeDir = 0;
    if (G.after) return;
  }
  switch (G.state) {
    case 'title':
      G.t++; updateAmbient(0.4, 0);
      if (inp.hit('esc')) { location.href = '../'; return; }
      if (inp.hit('start') || inp.hit('jump') || inp.hit('attack')) { G.sfx('select'); fadeTo(() => { G.state = 'story'; G.t = 0; G.page = 0; }); }
      break;
    case 'story':
      G.t++; updateAmbient(0.2, 0);
      if (inp.hit('start') || inp.hit('jump') || inp.hit('attack')) {
        G.sfx('select');
        const total = STORY[G.page].join('').length * 2 + 20;
        if (G.t < total) G.t = total;
        else if (G.page < STORY.length - 1) { G.page++; G.t = 0; }
        else fadeTo(() => { G.st = newState(); loadLevel(0); });
      }
      if (inp.hit('esc')) fadeTo(() => { G.st = newState(); loadLevel(0); });
      break;
    case 'play': updatePlay(inp); break;
    case 'tally':
      G.t++;
      if (G.t > 50 && (inp.hit('start') || inp.hit('jump') || inp.hit('attack'))) {
        G.sfx('select');
        const n = G.st.level + 1;
        fadeTo(() => { if (n >= LEVEL_DEFS.length) { G.state = 'ending'; G.t = 0; G.lv = buildLevel(0); G.art = artCache[0] || (artCache[0] = renderTerrain(G.lv)); G.bd = bdCache[0] || (bdCache[0] = makeBackdrop(0)); G.ents = []; G.parts = []; G.plats = []; G.shake = 0; G.flash = 0; makeAmbient(); G.music('ending'); } else loadLevel(n); });
      }
      break;
    case 'gameover':
      G.t++;
      if (G.t > 40 && inp.hit('start')) { G.sfx('select'); fadeTo(() => { G.st.lives = 3; G.st.hp = G.st.maxHp; loadLevel(G.st.level); }); }
      else if (inp.hit('esc')) fadeTo(toTitle);
      break;
    case 'ending':
      G.t++; updateAmbient(0.3, 0);
      if (G.t > 120 && (inp.hit('start') || inp.hit('esc'))) fadeTo(() => { G.st = newState(); toTitle(); });
      break;
  }
}

function updatePlay(inp) {
  const lv = G.lv, st = G.st;
  if (G.shop) { updateShop(inp); return; }
  if ((inp.hit('pause') || inp.hit('esc')) && !G.cleared) { G.paused = !G.paused; G.sfx('select'); }
  if (G.paused) { if (inp.hit('start')) G.paused = false; return; }
  if (G.shake > 0) G.shake *= 0.86;
  if (G.flash > 0) G.flash--;
  if (G.message && --G.message.n <= 0) G.message = null;
  if (G.bannerInfo && --G.bannerInfo.n <= 0) G.bannerInfo = null;
  if (G.hitstop > 0) { G.hitstop--; return; }
  G.t++;
  if (!G.cleared) st.time++;
  // moving platforms
  for (const m of G.plats) {
    m.ph += (m.speed * 2) / m.range;
    const k = 0.5 - 0.5 * Math.cos(m.ph);
    const nx = m.axis === 'h' ? m.x0 + m.range * k : m.x0, ny = m.axis === 'v' ? m.y0 - m.range * k : m.y0;
    m.dx = nx - m.x; m.dy = ny - m.y; m.x = nx; m.y = ny;
  }
  G.nearMerchant = null;
  const p = G.player, mid = G.cam.x + W / 2;
  for (const e of G.ents) {
    if (e.dead) continue;
    if (!e.boss && !e.hostileProj && Math.abs(e.x - mid) > 330) continue;
    e.update(G, e);
  }
  updatePlayer(G, inp);
  if (G.nearMerchant && inp.hit('up') && !p.dead && p.hurtT <= 0) openShop();
  for (let i = G.ents.length - 1; i >= 0; i--) {
    const e = G.ents[i];
    if (e.type === 'chest' && e.open && e.key) G.taken.add(e.key);
    if (e.dead) { if (e.key && !e.hit) G.taken.add(e.key); G.ents.splice(i, 1); }
  }
  updateParts(G);
  // arena
  const ar = lv.arena;
  if (ar && !G.arenaDone && !G.arenaLock && p.x > ar.x0 + 30 && !p.dead) { G.arenaLock = true; G.sfx('warn'); }
  // camera
  const cam = G.cam, ox = cam.x, oy = cam.y;
  cam.look = lerp(cam.look, p.facing * 26, 0.04);
  let tx = p.x + 5 - W / 2 + cam.look, ty = p.y + p.h - H * 0.62;
  if (!p.dead) {
    cam.x = lerp(cam.x, tx, 0.12);
    if (p.onGround || Math.abs(ty - cam.y) > 44) cam.y = lerp(cam.y, ty, p.onGround ? 0.09 : 0.14);
  }
  let x0 = 0, x1 = lv.w * TS - W;
  if (G.arenaLock) { x0 = lerp(Math.min(cam.x, ar.x0), ar.x0, 0.1); x1 = ar.x0; if (cam.x < ar.x0) { cam.x = lerp(cam.x, ar.x0, 0.12); x0 = 0; } }
  cam.x = clamp(cam.x, x0, Math.max(x0, x1)); cam.y = clamp(cam.y, 0, lv.h * TS - H);
  updateAmbient(cam.x - ox, cam.y - oy);
  // world-space ambient spawns
  if (lv.world === 2 && G.t % 5 === 0) for (const r of lv.liquidRuns) if (r.x < cam.x + W && r.x + r.w > cam.x && Math.random() < 0.5) part(G, { x: r.x + rnd(r.w), y: r.y + 3, vx: rnd(-0.2, 0.2), vy: -rnd(0.5, 1.6), g: 0.01, life: rnd(20, 50), cols: ['#fe8', '#fa3', '#f62', '#811'], add: true });
  if (G.cleared) {
    G.cleared++;
    if (G.cleared % 3 === 0) fx.sparkle(G, p.x + 5 + rnd(-8, 8), p.y + rnd(0, 24), ['#fff', '#8ff', '#0bd'], 2);
    if (G.cleared === 70) fadeTo(() => { G.state = 'tally'; G.t = 0; G.sfx('clear'); });
  }
}

// ================= shop =================
function shopItems() {
  const st = G.st;
  return [
    { n: 'HEALING DRAUGHT', d: 'RESTORES ALL HEARTS', cost: 15, ok: st.hp < st.maxHp, no: 'ALREADY HALE', buy() { st.hp = st.maxHp; } },
    st.armour < 2 ? { n: st.armour === 0 ? 'STEEL PLATE' : 'GOLDEN PLATE', d: 'FINER ARMOUR, +1 HEART', cost: st.armour === 0 ? 40 : 80, ok: true, buy() { st.armour++; st.maxHp++; st.hp = st.maxHp; } }
      : { n: 'ARMOUR', d: 'THE FINEST THERE IS', sold: true },
    st.sword < 2 ? { n: st.sword === 0 ? 'RUNE BLADE' : 'FLAME BLADE', d: st.sword === 0 ? 'LONGER REACH, DOUBLE DAMAGE' : 'HURLS A WAVE OF FIRE', cost: st.sword === 0 ? 50 : 100, ok: true, buy() { st.sword++; } }
      : { n: 'SWORD', d: 'NO BLADE BURNS BRIGHTER', sold: true },
    { n: 'EXTRA LIFE', d: 'ONE MORE CHANCE', cost: 60, ok: st.lives < 9, no: 'ENOUGH LIVES', buy() { st.lives++; } },
    { n: 'LEAVE', d: 'SAFE TRAVELS, KNIGHT', leave: true },
  ];
}
function openShop() { G.shop = { sel: 0, note: '', noteT: 0, t: 0 }; G.sfx('select'); G.player.vx = 0; }
function updateShop(inp) {
  const s = G.shop, items = shopItems();
  s.t++; if (s.noteT > 0) s.noteT--;
  if (inp.hit('up')) { s.sel = (s.sel + items.length - 1) % items.length; G.sfx('select'); }
  if (inp.hit('down')) { s.sel = (s.sel + 1) % items.length; G.sfx('select'); }
  if (inp.hit('esc') || inp.hit('pause')) { G.shop = null; return; }
  if (s.t > 8 && (inp.hit('start') || inp.hit('jump') || inp.hit('attack'))) {
    const it = items[s.sel];
    if (it.leave) { G.shop = null; G.sfx('select'); return; }
    if (it.sold) { s.note = 'SOLD OUT'; s.noteT = 60; G.sfx('deny'); }
    else if (!it.ok) { s.note = it.no; s.noteT = 60; G.sfx('deny'); }
    else if (G.st.coins < it.cost) { s.note = 'NOT ENOUGH GOLD'; s.noteT = 60; G.sfx('deny'); }
    else { G.st.coins -= it.cost; it.buy(); s.note = 'A FINE CHOICE!'; s.noteT = 60; G.sfx('buy'); fx.sparkle(G, G.player.x + 5, G.player.y + 8, ['#fff', '#ffb', '#fc3'], 16); }
  }
}

// ================= rendering =================
function frame(g, x, y, w, h, fill = '#102') {
  rect(g, x, y, w, h, P(fill));
  rect(g, x, y, w, 1, P('#a61')); rect(g, x, y + h - 1, w, 1, P('#a61')); rect(g, x, y, 1, h, P('#a61')); rect(g, x + w - 1, y, 1, h, P('#a61'));
  rect(g, x + 1, y + 1, w - 2, 1, P('#fc4')); rect(g, x + 1, y + 1, 1, h - 2, P('#fc4'));
  rect(g, x + 1, y + h - 2, w - 2, 1, P('#730')); rect(g, x + w - 2, y + 1, 1, h - 2, P('#730'));
  rect(g, x + 3, y + 3, w - 6, 1, P('#423')); rect(g, x + 3, y + h - 4, w - 6, 1, P('#423')); rect(g, x + 3, y + 3, 1, h - 6, P('#423')); rect(g, x + w - 4, y + 3, 1, h - 6, P('#423'));
  for (const [cx, cy] of [[x + 2, y + 2], [x + w - 3, y + 2], [x + 2, y + h - 3], [x + w - 3, y + h - 3]]) ornament(g, cx, cy);
}
function ornament(g, cx, cy) {
  rect(g, cx - 2, cy, 5, 1, P('#fc4')); rect(g, cx, cy - 2, 1, 5, P('#fc4')); rect(g, cx - 1, cy - 1, 3, 3, P('#fe8')); px(g, cx, cy, P('#f33'));
}
function makeHudPanel() {
  const cv = mk(W, 18), g = cv.g;
  for (let y = 0; y < 14; y++) rect(g, 0, y, W, 1, P(['#213', '#213', '#102', '#102', '#102', '#102', '#102', '#102', '#102', '#102', '#102', '#102', '#001', '#001'][y]));
  rect(g, 0, 14, W, 1, P('#fc4')); rect(g, 0, 15, W, 1, P('#a61')); rect(g, 0, 16, W, 1, P('#420'));
  for (let x = 6; x < W; x += 12) { px(g, x, 15, P('#fe8')); }
  for (const cx of [4, W - 5]) ornament(g, cx, 15);
  // little dividers
  for (const x of [110, W - 111]) { rect(g, x, 2, 1, 10, P('#423')); rect(g, x + 1, 2, 1, 10, P('#001')); }
  return cv;
}

function drawHud(g) {
  const st = G.st;
  g.drawImage(hudPanel, 0, 0);
  for (let i = 0; i < st.maxHp; i++) drawSpr(g, i < st.hp ? SPR.heart : SPR.heartEmpty, 0, 10 + i * 11, 7);
  drawSpr(g, SPR.coin, G.tick / 8 | 0, 78, 7);
  text(g, String(st.coins).padStart(3, '0'), 86, 4, { color: GOLD });
  text(g, G.lv.name, W / 2, 4, { color: SILVER, align: 'c' });
  drawSpr(g, SPR.helm, 0, W - 98, 7);
  text(g, 'x' + Math.max(0, st.lives), W - 90, 4, { color: SILVER });
  // rune slot
  const rx = W - 16;
  rect(g, rx - 8, 1, 15, 12, P('#001')); rect(g, rx - 8, 1, 15, 1, P('#423')); rect(g, rx - 8, 1, 1, 12, P('#423'));
  if (st.rune) { g.save(); g.beginPath(); g.rect(rx - 7, 2, 13, 10); g.clip(); drawSpr(g, SPR.rune, G.tick / 8 | 0, rx - 1, 7); g.restore(); }
  else text(g, '?', rx - 3, 4, { color: '#423' });
  text(g, 'RUNE', rx - 12, 4, { color: st.rune ? JADE : '#534', align: 'r' });
  // boss bar
  const boss = G.ents.find((e) => e.boss);
  if (boss && boss.state !== 'sleep' && G.arenaLock) {
    const bw = 200, x = (W - bw) / 2, y = H - 14;
    frame(g, x - 4, y - 4, bw + 8, 12, '#001');
    const k = clamp(boss.hp / boss.maxHp, 0, 1);
    rect(g, x, y, bw, 4, P('#301'));
    rect(g, x, y, Math.round(bw * k), 4, P('#e22')); rect(g, x, y, Math.round(bw * k), 1, P('#f86')); rect(g, x, y + 3, Math.round(bw * k), 1, P('#811'));
    text(g, boss.name, W / 2, y - 14, { color: EMBER, align: 'c', outline: '#100' });
  }
}

function drawLiquid(g, r, type, t) {
  const cx = G.cam.x, x0 = Math.max(r.x, Math.floor(cx) - 2), x1 = Math.min(r.x + r.w, Math.floor(cx) + W + 2);
  if (x1 <= x0) return;
  if (type === 'water') {
    const bands = [['#4be', 3], ['#29c', 7], ['#17a', 10], ['#058', 14], ['#036', 20], ['#013', 999]];
    let y = r.y + 2;
    g.globalAlpha = 0.7;
    for (const [c, hgt] of bands) { const hh = Math.min(hgt, r.y + r.h - y); if (hh <= 0) break; g.fillStyle = P(c); g.fillRect(x0, y, x1 - x0, hh); y += hh; g.globalAlpha = Math.min(0.95, g.globalAlpha + 0.06); }
    g.globalAlpha = 1;
    for (let x = x0; x < x1; x++) {
      const wy = r.y + 1 + Math.round(Math.sin(x * 0.22 + t * 0.07) * 1.1 + Math.sin(x * 0.09 - t * 0.045) * 0.9);
      g.fillStyle = P(((x + (t >> 3)) % 9) < 4 ? '#eff' : '#8df'); g.fillRect(x, wy, 1, 1);
      g.fillStyle = P('#4be'); g.fillRect(x, wy + 1, 1, 2);
    }
    for (let k = 0; k < r.w / 6; k++) {
      const gx = r.x + ((hash(k, r.x) * r.w + t * 0.25 * (k % 2 ? 1 : -1)) % r.w + r.w) % r.w, gy = r.y + 7 + hash(k, r.x, 2) * 30;
      if (gx < x0 || gx > x1 - 4 || Math.sin(t * 0.05 + k) < 0) continue;
      g.fillStyle = P(k % 3 ? '#4be' : '#8df'); g.fillRect(Math.round(gx), Math.round(gy), 3 + (k % 3), 1);
    }
  } else {
    const yb = Math.min(r.y + r.h, G.cam.y + H + 2);
    for (let y = r.y; y < yb; y += 2) {
      const d = y - r.y;
      for (let x = x0 & ~1; x < x1; x += 2) {
        const wy = Math.round(Math.sin(x * 0.16 + t * 0.05) * 1.2 + Math.sin(x * 0.07 - t * 0.03));
        const dd = d - wy - 2;
        if (dd < 0) continue;
        const v = Math.sin(x * 0.13 + t * 0.021 + Math.sin(y * 0.11 + t * 0.017) * 2) + Math.sin(y * 0.19 - t * 0.03 + x * 0.05);
        let c = dd < 2 ? '#ffb' : dd < 4 ? '#fd4' : dd < 10 ? (v > 0.4 ? '#fd4' : '#f82') : dd < 26 ? (v > 0.9 ? '#fa3' : v > -0.2 ? '#e41' : '#b21') : (v > 1.2 ? '#e41' : v > 0 ? '#911' : '#600');
        g.fillStyle = P(c); g.fillRect(x, y, 2, 2);
      }
    }
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = 'rgb(68,17,0)'; g.fillRect(x0, r.y - 5, x1 - x0, 6);
    g.fillStyle = 'rgb(34,0,0)'; g.fillRect(x0, r.y - 14, x1 - x0, 9);
    g.globalCompositeOperation = 'source-over';
  }
}

function drawWorld(g, showEnts) {
  const lv = G.lv, art = G.art, t = G.t;
  const sx = G.shake > 0.5 ? Math.round(rnd(-G.shake, G.shake) * 0.5) : 0, sy = G.shake > 0.5 ? Math.round(rnd(-G.shake, G.shake) * 0.5) : 0;
  const cx = Math.round(G.cam.x) + sx, cy = Math.round(G.cam.y) + sy;
  drawBackdrop(g, G.bd, G.cam.x, lv.h * TS - H - G.cam.y, G.tick / 60);
  g.save(); g.translate(-cx, -cy);
  g.drawImage(art.back, cx, cy, W, H, cx, cy, W, H);
  if (showEnts) {
    for (const m of G.plats) g.drawImage(m.spr, Math.round(m.x), Math.round(m.y));
    const vis = (e) => !e.dead && e.x + e.w > cx - 40 && e.x < cx + W + 40 && e.y + e.h > cy - 60 && e.y < cy + H + 60;
    for (const e of G.ents) if (e.z === 0 && vis(e)) e.draw(g, G, e);
    for (const e of G.ents) if (e.z === 1 && vis(e)) e.draw(g, G, e);
    drawPlayer(g, G);
    for (const e of G.ents) if (e.z !== 0 && e.z !== 1 && vis(e)) e.draw(g, G, e);
    if (G.nearMerchant && !G.shop) {
      const m = G.nearMerchant, bx = Math.round(m.x + 12), by = Math.round(m.y - 14 + Math.sin(G.tick * 0.1) * 1.5);
      frame(g, bx - 28, by - 4, 56, 15, '#102'); text(g, 'UP:TRADE', bx, by, { color: GOLD, align: 'c' });
    }
  }
  drawParts(g, G, false);
  for (const r of lv.liquidRuns) drawLiquid(g, r, lv.liquidType, G.tick);
  g.drawImage(art.front, cx, cy, W, H, cx, cy, W, H);
  g.globalCompositeOperation = 'lighter';
  for (const L of art.lights) {
    if (L.x < cx - 30 || L.x > cx + W + 30) continue;
    const pulse = Math.sin(G.tick * 0.05 + L.s) > 0.3 ? 2 : 0;
    const r = (L.r ? 16 : 9) + pulse;
    g.drawImage(glow(L.col, r), L.x - r, L.y - r);
    if (L.flame && (G.tick + L.s) % 7 < 4) { g.fillStyle = P('#fd4'); g.fillRect(L.x - 2, L.y - 1 - ((G.tick >> 2) & 1), 1, 2); g.fillRect(L.x + 1, L.y - 4, 1, 2); g.fillRect(L.x + 4, L.y, 1, 2); }
  }
  drawParts(g, G, true);
  g.globalCompositeOperation = 'source-over';
  g.restore();
  drawAmbient(g);
  // stepped darkness with light holes
  if (lv.world > 0) {
    const d = darkCv.g;
    d.globalCompositeOperation = 'source-over'; d.fillStyle = lv.world === 1 ? P('#001') : P('#100'); d.fillRect(0, 0, W, H);
    d.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r) => { if (x > -r && x < W + r && y > -r && y < H + r) d.drawImage(lightStamp(r), Math.round(x - r), Math.round(y - r)); };
    const fl = (s) => (Math.sin(G.tick * 0.31 + s) > 0.2 ? 2 : 0);
    if (showEnts) {
      const p = G.player; hole(p.x + 5 - cx, p.y + 10 - cy, lv.world === 1 ? 82 : 76);
      for (const e of G.ents) if (e.light && !e.dead) hole(e.x + e.w / 2 - cx, e.y + e.h / 2 - cy, e.light + (e.type === 'torch' ? fl(e.x) : 0));
    } else hole(W / 2, H / 2, 90);
    for (const L of art.lights) hole(L.x - cx, L.y - cy, (L.r ? 34 : 22) + (L.flame ? fl(L.s) : 0));
    if (lv.liquidType === 'lava') for (const r of lv.liquidRuns) for (let x = r.x + 12; x < r.x + r.w; x += 24) hole(x - cx, r.y + 4 - cy, 44);
    g.globalAlpha = lv.world === 1 ? 0.64 : 0.54; g.drawImage(darkCv, 0, 0); g.globalAlpha = 1;
  }
  if (G.flash > 0) { g.globalAlpha = Math.min(0.8, G.flash * 0.15); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
}

function drawBanner(g) {
  const b = G.bannerInfo;
  if (!b) return;
  const k = b.max - b.n, inn = clamp(k / 24, 0, 1), out = clamp(b.n / 20, 0, 1), e = Math.min(inn, out);
  const es = 1 - (1 - e) * (1 - e), y = 64, hw = Math.round(120 * es);
  if (hw < 4) return;
  g.save(); g.beginPath(); g.rect(W / 2 - hw, y - 20, hw * 2, 60); g.clip();
  rect(g, W / 2 - 120, y - 10, 240, 38, P('#102'));
  rect(g, W / 2 - 120, y - 8, 240, 1, P('#fc4')); rect(g, W / 2 - 120, y - 7, 240, 1, P('#a61'));
  rect(g, W / 2 - 120, y + 24, 240, 1, P('#a61')); rect(g, W / 2 - 120, y + 25, 240, 1, P('#fc4'));
  ornament(g, W / 2 - 112, y - 8); ornament(g, W / 2 + 111, y - 8); ornament(g, W / 2 - 112, y + 25); ornament(g, W / 2 + 111, y + 25);
  text(g, b.a, W / 2, y - 2, { color: SILVER, align: 'c' });
  const big = textW(b.b, 2) < 224;
  text(g, b.b, W / 2, y + (big ? 8 : 11), { color: G.arenaLock ? EMBER : GOLD, align: 'c', scale: big ? 2 : 1, shadow: '#000' });
  g.restore();
}
function dim(g, a = 0.6) { g.globalAlpha = a; g.fillStyle = '#001'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }

function drawShop(g) {
  const s = G.shop, items = shopItems(), st = G.st;
  dim(g, 0.45);
  const w = 236, h = 132, x = (W - w) / 2, y = 42;
  frame(g, x, y, w, h);
  text(g, "THE WANDERER'S WARES", W / 2, y + 9, { color: GOLD, align: 'c', shadow: '#000' });
  rect(g, x + 10, y + 20, w - 20, 1, P('#a61')); ornament(g, W / 2, y + 20);
  drawSpr(g, SPR.merchant, (G.tick / 30 | 0) % 2, x + 30, y + 74);
  items.forEach((it, i) => {
    const yy = y + 30 + i * 14, sel = i === s.sel;
    if (sel) { rect(g, x + 56, yy - 3, w - 66, 13, P('#314')); rect(g, x + 56, yy - 3, w - 66, 1, P('#637')); text(g, '>', x + 59 + ((G.tick >> 3) & 1), yy, { color: GOLD }); }
    const col = it.sold ? '#645' : sel ? '#fff' : '#bbd';
    text(g, it.n, x + 68, yy, { color: col });
    if (it.cost) { text(g, String(it.cost), x + w - 24, yy, { color: st.coins >= it.cost ? GOLD : '#a44', align: 'r' }); drawSpr(g, SPR.coin, 0, x + w - 17, yy + 3); }
    else if (it.sold) text(g, 'SOLD', x + w - 14, yy, { color: '#645', align: 'r' });
  });
  rect(g, x + 10, y + h - 30, w - 20, 1, P('#a61'));
  const it = items[s.sel];
  text(g, s.noteT > 0 ? s.note : it.d, W / 2, y + h - 24, { color: s.noteT > 0 ? EMBER : JADE, align: 'c' });
  drawSpr(g, SPR.coin, G.tick / 8 | 0, x + 14, y + h - 9); text(g, 'GOLD ' + st.coins, x + 22, y + h - 12, { color: GOLD });
  text(g, 'ENTER:BUY  ESC:LEAVE', x + w - 10, y + h - 12, { color: '#867', align: 'r' });
}

function drawTitle(g) {
  const lv = G.lv, t = G.t;
  const span = lv.w * TS - W, u = (t * 0.45) % (span * 2);
  G.cam.x = u < span ? u : span * 2 - u; G.cam.y = 118;
  drawWorld(g, false);
  // vignette band behind logo
  g.globalAlpha = 0.35; g.fillStyle = '#102'; g.fillRect(0, 0, W, 16); g.globalAlpha = 1;
  const ly = 22 + Math.round(Math.sin(t * 0.03) * 3);
  g.drawImage(logo, Math.round((W - logo.width) / 2), ly);
  // travelling glints on the logo
  for (let k = 0; k < 3; k++) {
    const gx = ((t * 1.6 + k * 130) % (logo.width + 60)) - 30, gy = ly + 10 + k * 14;
    if (gx > 8 && gx < logo.width - 8) { const X = Math.round((W - logo.width) / 2 + gx); g.fillStyle = '#fff'; g.fillRect(X - 3, gy, 7, 1); g.fillRect(X, gy - 3, 1, 7); g.fillRect(X - 1, gy - 1, 3, 3); }
  }
  text(g, 'C L A S S I C', W / 2, ly + logo.height + 1, { color: SILVER, align: 'c', outline: '#102' });
  if ((t >> 5) & 1) text(g, 'PRESS ENTER TO BEGIN', W / 2, 128, { color: GOLD, align: 'c', outline: '#102' });
  text(g, 'ESC: BACK TO MENU', W / 2, 142, { color: '#bbd', align: 'c', outline: '#102' });
  // sine scroller with copper colours
  const msg = '      WELCOME TO EMBERFALL ... A PIXEL TALE OF RUNE STONES, COLD STEEL AND AN ASHEN KEEP ...  ARROWS OR WASD TO MOVE - SPACE OR Z TO LEAP - X TO STRIKE - DOWN TO CROUCH - UP TO TRADE WITH THE WANDERER ...  ALL ART AND SOUND ARE CONJURED BY CODE - NO BITMAPS WERE HARMED ...  GREETINGS TO EVERY KNIGHT WHO EVER LOADED A DISK AND WAITED PATIENTLY ...      ';
  const sp = (t * 1.3) % (msg.length * 12);
  rect(g, 0, H - 30, W, 30, 'rgba(0,0,17,0.55)');
  rect(g, 0, H - 31, W, 1, P('#a61')); rect(g, 0, H - 32, W, 1, P('#fc4'));
  const cop = [GOLD, EMBER, SILVER, JADE];
  for (let i = 0; i < msg.length; i++) {
    const x = i * 12 - sp + W;
    const xx = ((x % (msg.length * 12)) + msg.length * 12) % (msg.length * 12) - 12;
    if (xx < -12 || xx > W) continue;
    if (msg[i] === ' ') continue;
    text(g, msg[i], Math.round(xx), H - 22 + Math.round(Math.sin(xx * 0.035 + t * 0.07) * 5), { color: cop[((i / 14) | 0) % 4], scale: 2, shadow: '#000' });
  }
}

function drawStory(g) {
  G.cam.x = 300 + G.tick * 0.2; G.cam.y = 118;
  drawWorld(g, false); dim(g, 0.72);
  frame(g, 40, 40, W - 80, 126);
  const lines = STORY[G.page];
  let left = Math.floor(G.t / 2);
  lines.forEach((l, i) => { if (left <= 0) return; text(g, l.slice(0, left), W / 2 - textW(l) / 2, 60 + i * 13, { color: i < 3 && G.page === 0 ? GOLD : SILVER, shadow: '#000' }); left -= l.length; });
  if ((G.tick >> 4) & 1) text(g, 'ENTER', W - 54, 152, { color: EMBER, align: 'r' });
  drawHumanoid(g, heroPose('idle', G.tick / 60, 0, 0), { arm: ARMOUR[0], blade: BLADE[0] }, 62, 160, false, false);
}

function drawTally(g) {
  const st = G.st;
  g.fillStyle = P('#102'); g.fillRect(0, 0, W, H);
  drawBackdrop(g, G.bd, G.tick * 0.5, 40, G.tick / 60); dim(g, 0.55);
  frame(g, 72, 34, W - 144, 146);
  text(g, 'WORLD CLEARED', W / 2, 46, { color: GOLD, align: 'c', scale: 2, shadow: '#000' });
  text(g, LEVEL_DEFS[st.level].name, W / 2, 68, { color: SILVER, align: 'c' });
  rect(g, 90, 80, W - 180, 1, P('#a61')); ornament(g, W / 2, 80);
  const sec = Math.floor(st.time / 60);
  const rows = [['GOLD', String(st.coins)], ['FOES SLAIN', String(st.kills)], ['TIME', `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`], ['LIVES', String(Math.max(0, st.lives))]];
  rows.forEach((r, i) => { if (G.t < 14 + i * 12) return; text(g, r[0], 100, 90 + i * 14, { color: '#bbd' }); text(g, r[1], W - 100, 90 + i * 14, { color: GOLD, align: 'r' }); });
  drawSpr(g, SPR.rune, G.tick / 8 | 0, W / 2, 150 + Math.sin(G.tick * 0.08) * 2);
  if (G.t > 60 && (G.tick >> 4) & 1) text(g, 'PRESS ENTER', W / 2, 167, { color: EMBER, align: 'c' });
}

export function render(g) {
  switch (G.state) {
    case 'title': drawTitle(g); break;
    case 'story': drawStory(g); break;
    case 'play':
      drawWorld(g, true);
      drawHud(g);
      drawBanner(g);
      if (G.message) { const m = G.message; if (m.n > 12 || (m.n >> 1) & 1) text(g, m.s, W / 2, H - 40, { color: GOLD, align: 'c', outline: '#102' }); }
      if (G.shop) drawShop(g);
      if (G.paused) {
        dim(g, 0.6); frame(g, 92, 50, 200, 116);
        text(g, 'PAUSED', W / 2, 60, { color: GOLD, align: 'c', scale: 2, shadow: '#000' });
        ['ARROWS / WASD   MOVE', 'SPACE / Z / UP  JUMP', 'X / J           STRIKE', 'DOWN            CROUCH', 'DOWN + JUMP     DROP', 'M MUTE  F FULL  C CRT'].forEach((l, i) => text(g, l, 110, 84 + i * 11, { color: '#bbd' }));
        text(g, 'P OR ESC TO RESUME', W / 2, 152, { color: EMBER, align: 'c' });
      }
      break;
    case 'tally': drawTally(g); break;
    case 'gameover':
      g.fillStyle = P('#100'); g.fillRect(0, 0, W, H);
      for (let y = 0; y < H; y += 2) { g.fillStyle = P(['#100', '#200', '#301', '#200'][((y + G.t) >> 4) & 3]); g.fillRect(0, y, W, 1); }
      text(g, 'GAME OVER', W / 2, 70, { color: EMBER, align: 'c', scale: 4, shadow: '#000' });
      text(g, 'THE EMBER FADES...', W / 2, 114, { color: '#b88', align: 'c' });
      if ((G.t >> 4) & 1) text(g, 'ENTER: CONTINUE   ESC: TITLE', W / 2, 150, { color: GOLD, align: 'c' });
      break;
    case 'ending': {
      G.cam.x = 0; G.cam.y = 118; drawWorld(g, false); dim(g, 0.3);
      text(g, 'THE END', W / 2, 22, { color: GOLD, align: 'c', scale: 4, shadow: '#000' });
      const L = ['MALGRIM IS UNDONE AND THE THREE', 'RUNE STONES BURN AS ONE.', '', 'THE EMBER RISES OVER THE WOODS,', 'AND SIR ALDRIC WALKS HOME', 'BENEATH A WARMER SKY.', '', `GOLD GATHERED: ${G.st.coins}`];
      L.forEach((l, i) => { if (G.t > 30 + i * 22) text(g, l, W / 2, 62 + i * 12, { color: i === 7 ? GOLD : SILVER, align: 'c', outline: '#102' }); });
      drawHumanoid(g, heroPose('idle', G.tick / 60, 0, 0), { arm: ARMOUR[G.st.armour], blade: BLADE[G.st.sword] }, 58, 171, false, false);
      if (G.t > 220 && (G.tick >> 4) & 1) text(g, 'PRESS ENTER', W / 2, 204, { color: EMBER, align: 'c', outline: '#102' });
      break;
    }
  }
  if (G.fade > 0) g.drawImage(fadePats[Math.round(G.fade * 16)], 0, 0);
  if (G.opt.q12) {
    const im = g.getImageData(0, 0, W, H), d = im.data;
    for (let i = 0; i < d.length; i += 4) { d[i] = ((d[i] + 8) / 17 | 0) * 17; d[i + 1] = ((d[i + 1] + 8) / 17 | 0) * 17; d[i + 2] = ((d[i + 2] + 8) / 17 | 0) * 17; }
    g.putImageData(im, 0, 0);
  }
}

// ================= debug helpers =================
export const debug = {
  // contact sheet of every rig/sprite for visual inspection
  sheet(g, t = 0) {
    g.fillStyle = P('#647'); g.fillRect(0, 0, W, H); g.fillStyle = P('#325'); g.fillRect(0, 108, W, 108);
    const anims = [['idle', 0], ['run', 0], ['run', 0.8], ['run', 1.6], ['run', 2.4], ['jump', 0], ['fall', 0], ['crouch', 0], ['attack', 0.1], ['attack', 0.3], ['attack', 0.42], ['attack', 0.7], ['stab', 0.4], ['hurt', 0]];
    anims.forEach(([a, k], i) => {
      const pose = heroPose(a, t, a === 'run' ? k * 2 : 0, k); pose.cape = [[0, 0], [-2, 4], [-3, 8], [-4, 12], [-4, 15]];
      drawHumanoid(g, pose, { arm: ARMOUR[i % 3], blade: BLADE[i % 3] }, 16 + i * 26, 46, false, false);
      const sp = heroPose(a, t, a === 'run' ? k * 2 : 0, k);
      drawHumanoid(g, sp, { skel: true, arm: ARMOUR[1], blade: { l: '#dcb', m: '#a98', d: '#543', len: 10 } }, 16 + i * 26, 96, i % 2 === 1, false);
    });
    let x = 14;
    for (let w = 0; w < 3; w++) for (let f = 0; f < 6; f++) { drawSpr(g, SPR.slime[w], f, 12 + (w * 6 + f) * 20, 136); }
    for (let f = 0; f < 5; f++) drawSpr(g, SPR.bat, f, 16 + f * 28, 150);
    for (let f = 0; f < 6; f++) drawSpr(g, SPR.plant, f, 160 + f * 30, 172);
    for (let f = 0; f < 4; f++) drawSpr(g, SPR.wisp, f, 16 + f * 22, 176);
    drawSpr(g, SPR.merchant, 0, 110, 210); drawSpr(g, SPR.chest, 0, 140, 210); drawSpr(g, SPR.chest, 1, 164, 210);
    drawSpr(g, SPR.shrine, 0, 188, 210); drawSpr(g, SPR.shrine, 2, 208, 210); drawSpr(g, SPR.portal, 0, 240, 210);
    for (let f = 0; f < 4; f++) { drawSpr(g, SPR.rune, f, 270 + f * 16, 200); drawSpr(g, SPR.coin, f, 270 + f * 12, 184); drawSpr(g, SPR.fireball, f, 336, 130 + f * 18); drawSpr(g, SPR.flame, f, 356, 136 + f * 18); }
    drawSpr(g, SPR.gem[0], 0, 320, 184); drawSpr(g, SPR.gem[1], 0, 332, 184); drawSpr(g, SPR.heart, 0, 346, 184); drawSpr(g, SPR.wave, 0, 372, 150); drawSpr(g, SPR.seed, 0, 372, 180);
    g.drawImage(renderBoss(t, 0, false, false), 2, 140 - 8); g.drawImage(renderBoss(t, 1, false, true), 54, 140 - 8);
  },
  gotoLevel(i) { G.fade = 0; G.fadeDir = 0; G.after = null; if (!G.st) G.st = newState(); loadLevel(i); G.bannerInfo = null; },
  teleport(tx, ty) { const p = G.player; p.x = tx * TS + 3; p.y = ty * TS - p.h; p.vx = p.vy = 0; G.cam.x = clamp(p.x - W / 2, 0, G.lv.w * TS - W); G.cam.y = clamp(p.y - H * 0.55, 0, G.lv.h * TS - H); },
  grant(o) { Object.assign(G.st, o); if (o.armour != null) { G.st.maxHp = 3 + o.armour; G.st.hp = G.st.maxHp; } },
  shop() { openShop(); },
  boss() { loadLevel(2); G.bannerInfo = null; G.fade = 0; G.fadeDir = 0; const a = G.lv.arena; this.teleport(a.x0 / TS + 4, a.floor / TS); },
  title() { toTitle(); G.fade = 0; G.fadeDir = 0; },
  state() { const p = G.player || {}; return { state: G.state, level: G.st.level, x: p.x, y: p.y, tx: Math.floor((p.x || 0) / TS), ty: Math.floor(((p.y || 0) + (p.h || 0)) / TS), hp: G.st.hp, lives: G.st.lives, coins: G.st.coins, rune: G.st.rune, ents: G.ents.length, dead: p.dead, ground: p.onGround, cleared: G.cleared, lock: G.arenaLock, fade: G.fade }; },
};
