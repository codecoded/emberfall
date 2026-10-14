// EMBERFALL Classic — bootstrap, fixed-timestep loop, scaling, debug hook.
import { W, H, input } from './core.js';
import { audio } from './audio.js';
import { G, init, update, render, debug, loadLevel } from './game.js';
import { buildLevel, LEVEL_DEFS } from './levels.js';
import { checkLevel } from './reach.js';

const canvas = document.getElementById('screen');
const stage = document.getElementById('stage');
const g = canvas.getContext('2d', { willReadFrequently: true });
g.imageSmoothingEnabled = false;

function fit() {
  const s = Math.max(1, Math.floor(Math.min(window.innerWidth / W, window.innerHeight / H)));
  stage.style.width = W * s + 'px'; stage.style.height = H * s + 'px';
  stage.style.setProperty('--s', s + 'px');
}
window.addEventListener('resize', fit); fit();

input.attach(window);
input.onFirstGesture = () => { audio.init(); };

function hotkeys() {
  if (input.hit('fs')) { if (document.fullscreenElement) document.exitFullscreen(); else if (stage.requestFullscreen) stage.requestFullscreen().catch(() => {}); }
  if (input.hit('crt')) stage.classList.toggle('crt');
}

const STEP = 1000 / 60;
let last = 0, acc = 0, manual = false;
function loop(now) {
  requestAnimationFrame(loop);
  if (manual) return;
  if (!last) last = now;
  acc += Math.min(100, now - last); last = now;
  input.poll();
  let n = 0;
  while (acc >= STEP && n < 5) { hotkeys(); update(); input.endStep(); acc -= STEP; n++; }
  if (n) render(g);
}

function boot() {
  // paint a loading card first, then generate art
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#a61'; g.fillRect(W / 2 - 40, H / 2, 80, 1);
  setTimeout(() => {
    try { init(); } catch (e) { console.error(e); window.__bootError = String(e && e.stack || e); }
    render(g);
    requestAnimationFrame(loop);
  }, 20);
}
boot();

// ---- debug hook ----
window.__game = {
  G, input, audio, ...debug,
  loadLevel,
  // take over from rAF and advance the simulation by n fixed steps, then render once
  step(n = 1, keys) {
    manual = true;
    if (keys) for (const k of Object.keys(keys)) input.set(k, keys[k]);
    for (let i = 0; i < n; i++) { hotkeys(); update(); input.endStep(); }
    render(g);
    return debug.state();
  },
  resume() { manual = false; last = 0; acc = 0; input.clear(); },
  render() { render(g); },
  press(a) { input.press(a); },
  reach() { return LEVEL_DEFS.map((_, i) => { const r = checkLevel(buildLevel(i)); return { ...r, plan: r.plan ? r.plan.length : 0 }; }); },
  // Drive the real player through level i by replaying the reach plan's inputs hop by hop (enemies removed,
  // re-centred on each tile, moving-platform hops teleported). Returns where it ended up.
  bot(i) {
    const r = checkLevel(buildLevel(i));
    if (!r.plan) return { ok: false, why: 'no plan', r };
    debug.gotoLevel(i); manual = true; input.clear();
    G.ents = G.ents.filter((e) => !(e.hit && e.type !== 'chest'));
    const p = G.player, fails = [];
    let hops = 0, tele = 0, frames = 0;
    const one = (k) => { p.inv = 50; for (const a of ['left', 'right', 'jump', 'down']) input.set(a, !!k[a]); hotkeys(); update(); input.endStep(); frames++; };
    for (let n = 0; n < 30; n++) one({});
    for (const h of r.plan) {
      if (h.mark) { if (!G.st.rune) { if (G.lv.arena) { G.st.rune = true; G.arenaLock = false; G.arenaDone = true; } else { for (let n = 0; n < 20; n++) one({}); if (!G.st.rune) fails.push('rune not collected'); } } continue; }
      const s = h.s; hops++;
      if (!s) { tele++; p.x = h.to[0] * 16 + 3; p.y = h.to[1] * 16 - p.h; p.vx = p.vy = 0; one({}); continue; }
      p.x = h.from[0] * 16 + 3 + (s.rs ? s.dir * 3 : 0); p.y = h.from[1] * 16 - p.h; p.vx = s.rs ? s.dir * 1.9 : 0; p.vy = 0; p.onGround = true; p.coyote = 6; p.onOneWay = !!s.drop;
      let landed = false;
      input.clear();
      for (let f = 0; f < 160 && !landed; f++) {
        const k = { right: s.dir > 0 && f < s.rf, left: s.dir < 0 && f < s.rf, jump: s.drop ? f === 0 : s.jh > 0 && f < s.jh, down: s.drop && f < 2 };
        one(k);
        if (p.dead) { fails.push(`died on hop ${h.from}->${h.to}`); break; }
        const tx = Math.floor((p.x + 5) / 16), ty = Math.round((p.y + p.h) / 16);
        if (f > 0 && p.onGround && (s.jh > 0 || s.drop || tx !== h.from[0] || ty !== h.from[1] || f >= s.rf + 8)) {
          landed = true;
          if (Math.abs(tx - h.to[0]) > 1 || ty !== h.to[1]) fails.push(`hop ${h.from}->${h.to} landed ${tx},${ty}`);
        }
      }
      if (p.dead) break;
      if (!landed) fails.push(`hop ${h.from}->${h.to} never landed`);
      if (fails.length > 6) break;
    }
    for (let n = 0; n < 40 && !G.cleared; n++) one({});
    input.clear();
    return { level: i, ok: fails.length === 0 && G.cleared > 0, cleared: G.cleared > 0, hops, teleportedPlatformHops: tele, frames, fails, end: debug.state() };
  },
  sheet(t) { manual = true; debug.sheet(g, t || 0); },
  png() { return canvas.toDataURL('image/png'); },
};
