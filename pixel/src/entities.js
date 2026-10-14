// EMBERFALL Classic — player, enemies, boss, pickups, projectiles, particles.
import { C, css, clamp, lerp, hash, rect, px, sign } from './core.js';
import { PHYS, TS, moveBody, overlap, tileAt, solidAt, liquidAt } from './physics.js';
import { SPR, drawSpr, drawHumanoid, heroPose, renderBoss, BOSS_AX, BOSS_AY, ARMOUR, BLADE, glow } from './art-sprites.js';

const P = (s) => css(C(s));
const rnd = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));

// ================= particles =================
export function part(G, o) {
  if (G.parts.length > 500) return;
  G.parts.push({ x: o.x, y: o.y, vx: o.vx || 0, vy: o.vy || 0, g: o.g || 0, life: o.life || 30, max: o.life || 30, cols: o.cols || ['#fff'], size: o.size || 1, add: !!o.add, drag: o.drag ?? 1, kind: o.kind });
}
export const fx = {
  dust(G, x, y, n = 4, dir = 0) { for (let i = 0; i < n; i++) part(G, { x: x + rnd(-4, 4), y: y - rnd(0, 2), vx: rnd(-0.6, 0.6) - dir * 0.4, vy: -rnd(0.1, 0.7), g: -0.005, life: rnd(14, 26), cols: G.dustCols, size: rnd() < 0.4 ? 2 : 1, drag: 0.94 }); },
  spark(G, x, y, cols, n = 8, sp = 2.4) { for (let i = 0; i < n; i++) { const a = rnd(6.28), s = rnd(0.5, sp); part(G, { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.6, g: 0.1, life: rnd(10, 22), cols, drag: 0.95, add: true }); } },
  burst(G, x, y, cols, n = 14, sp = 2) { for (let i = 0; i < n; i++) { const a = rnd(6.28), s = rnd(0.3, sp); part(G, { x: x + rnd(-3, 3), y: y + rnd(-3, 3), vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.8, g: 0.09, life: rnd(18, 40), cols, size: rnd() < 0.35 ? 2 : 1, drag: 0.96 }); } },
  sparkle(G, x, y, cols = ['#fff', '#ffb', '#fc3'], n = 5) { for (let i = 0; i < n; i++) part(G, { x: x + rnd(-5, 5), y: y + rnd(-5, 5), vx: rnd(-0.3, 0.3), vy: -rnd(0.2, 0.9), life: rnd(14, 28), cols, add: true, kind: 'star' }); },
  splash(G, x, y, cols) { for (let i = 0; i < 16; i++) part(G, { x: x + rnd(-5, 5), y, vx: rnd(-1.4, 1.4), vy: -rnd(1, 3.6), g: 0.16, life: rnd(20, 40), cols, size: rnd() < 0.3 ? 2 : 1 }); },
};
export function updateParts(G) {
  const a = G.parts;
  for (let i = a.length - 1; i >= 0; i--) {
    const p = a[i];
    p.vy += p.g; p.vx *= p.drag; p.vy *= p.drag; p.x += p.vx; p.y += p.vy;
    if (--p.life <= 0) { a[i] = a[a.length - 1]; a.pop(); }
  }
}
export function drawParts(g, G, add) {
  for (const p of G.parts) {
    if (p.add !== add) continue;
    const k = 1 - p.life / p.max;
    g.fillStyle = P(p.cols[Math.min(p.cols.length - 1, (k * p.cols.length) | 0)]);
    const x = Math.round(p.x), y = Math.round(p.y);
    if (p.kind === 'star' && k < 0.6) { g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); } else g.fillRect(x, y, p.size, p.size);
  }
}

// ================= player =================
const ATK = 18;
export function makePlayer(x, y) {
  return {
    type: 'player', x: x - 5, y: y - 24, w: 10, h: 24, vx: 0, vy: 0, facing: 1, onGround: true, coyote: 0, buffer: 0, crouch: false,
    atk: 0, atkKind: 'attack', atkHit: new Set(), inv: 0, hurtT: 0, dead: 0, runPh: 0, drop: 0, riding: null, jumping: false, t: 0,
    cape: [[0, 0], [-2, 4], [-3, 8], [-4, 12], [-4, 15]], stepT: 0, landT: 0,
  };
}
export function hurtPlayer(G, dmg, fromX) {
  const p = G.player, st = G.st;
  if (p.inv > 0 || p.dead || G.cleared) return;
  st.hp -= dmg; p.inv = 100; p.hurtT = 16; p.atk = 0;
  p.vx = (p.x + 5 < fromX ? -1 : 1) * 2.4; p.vy = -3.2; p.riding = null; p.onGround = false;
  G.shake = 7; G.hitstop = 5; G.sfx('hurt'); G.flash = 4;
  fx.spark(G, p.x + 5, p.y + 10, ['#fff', '#f44', '#a02'], 10);
  if (st.hp <= 0) killPlayer(G);
}
export function killPlayer(G) {
  const p = G.player;
  if (p.dead) return;
  G.st.hp = 0; p.dead = 1; p.vy = -4.6; p.vx *= 0.3; p.atk = 0; G.sfx('death'); G.shake = 9;
  const A = ARMOUR[G.st.armour];
  fx.burst(G, p.x + 5, p.y + 10, [A.l, A.m, A.d, '#c12'], 22, 2.6);
}
function canStand(G, p) {
  const y = p.y - 9;
  for (let tx = Math.floor(p.x / TS); tx <= Math.floor((p.x + p.w - 0.01) / TS); tx++) if (solidAt(G.lv, tx, Math.floor(y / TS))) return false;
  return true;
}
export function updatePlayer(G, inp) {
  const p = G.player, st = G.st, lv = G.lv;
  p.t++;
  if (p.dead) {
    p.dead++; p.vy = Math.min(6, p.vy + 0.25); p.y += p.vy; p.x += p.vx;
    if (p.dead > 95) G.playerDied();
    return;
  }
  if (p.inv > 0) p.inv--;
  if (p.landT > 0) p.landT--;
  if (p.riding) { p.x += p.riding.dx; p.y = p.riding.y - p.h; }
  const ctrl = p.hurtT <= 0 && !G.cleared;
  if (p.hurtT > 0) p.hurtT--;
  let dir = ctrl ? (inp.down('right') ? 1 : 0) - (inp.down('left') ? 1 : 0) : 0;
  // crouch
  const wantCrouch = ctrl && p.onGround && inp.down('down');
  if (wantCrouch && !p.crouch) { p.crouch = true; p.h = 15; p.y += 9; }
  else if (!wantCrouch && p.crouch && (p.atk <= 0 || !p.onGround) && canStand(G, p)) { p.crouch = false; p.h = 24; p.y -= 9; }
  if (dir && p.atk <= 0) p.facing = dir;
  let max = PHYS.RUN;
  if (p.atk > 0 && p.onGround) max *= 0.4;
  const target = p.crouch ? 0 : dir * max;
  if (ctrl) {
    const acc = p.onGround ? PHYS.ACC : PHYS.ACC * 0.75;
    if (p.vx < target) p.vx = Math.min(target, p.vx + acc); else if (p.vx > target) p.vx = Math.max(target, p.vx - acc);
  } else p.vx *= 0.97;
  // jump (buffer + coyote, variable height)
  if (ctrl && (inp.hit('jump') || (inp.hit('up') && !G.nearMerchant))) p.buffer = PHYS.BUFFER;
  else if (p.buffer > 0) p.buffer--;
  p.coyote = p.onGround ? PHYS.COYOTE : p.coyote - 1;
  if (p.buffer > 0 && p.coyote > 0) {
    if (inp.down('down') && p.onOneWay) { p.drop = 12; p.buffer = 0; p.coyote = 0; p.riding = null; }
    else if (inp.down('down') && p.riding) { p.riding = null; p.dropPlat = 14; p.buffer = 0; p.coyote = 0; }
    else if (!p.crouch || canStand(G, p)) {
      if (p.crouch) { p.crouch = false; p.h = 24; p.y -= 9; }
      p.vy = -PHYS.JUMP; p.jumping = true; p.buffer = 0; p.coyote = 0; p.riding = null; p.onGround = false;
      G.sfx('jump'); fx.dust(G, p.x + 5, p.y + p.h, 4);
    }
  }
  const held = inp.down('jump') || inp.down('up');
  if (p.jumping && !held && p.vy < -2.2) { p.vy *= 0.45; p.jumping = false; }
  if (p.vy >= 0) p.jumping = false;
  // attack
  if (ctrl && inp.hit('attack') && p.atk <= 0) {
    p.atk = ATK; p.atkKind = p.crouch ? 'stab' : p.onGround ? 'attack' : 'airatk'; p.atkHit.clear(); p.waved = false; G.sfx('slash');
  }
  // integrate
  p.vy = Math.min(PHYS.MAXFALL, p.vy + PHYS.GRAV);
  if (p.drop > 0) p.drop--;
  if (p.dropPlat > 0) p.dropPlat--;
  const wasGround = p.onGround, vyIn = p.vy, y0 = p.y;
  moveBody(lv, p);
  // moving platforms
  let ride = null;
  if (vyIn >= 0 && !p.dropPlat) {
    for (const m of G.plats) {
      if (p.x + p.w <= m.x || p.x >= m.x + m.w) continue;
      const bottom = p.y + p.h;
      if (bottom >= m.y - 0.5 && y0 + p.h <= m.y - m.dy + 2.5) { p.y = m.y - p.h; p.vy = 0; p.onGround = true; ride = m; }
    }
  }
  p.riding = ride;
  if (!wasGround && p.onGround && vyIn > 2.6) { fx.dust(G, p.x + 5, p.y + p.h, 6); G.sfx('land'); p.landT = 6; }
  // camera-locked arena keeps the player inside
  if (G.arenaLock) p.x = clamp(p.x, G.lv.arena.x0 + 2, G.lv.arena.x1 - p.w - 2);
  if (p.x < 0) p.x = 0;
  // run cycle + dust
  if (p.onGround && Math.abs(p.vx) > 0.3) {
    p.runPh += Math.abs(p.vx) * 0.2;
    if (++p.stepT > 13) { p.stepT = 0; fx.dust(G, p.x + 5 - p.facing * 4, p.y + p.h, 1, p.facing); }
  }
  // hazards
  const feet = p.y + p.h, ty = Math.floor((feet - 1) / TS);
  for (let tx = Math.floor(p.x / TS); tx <= Math.floor((p.x + p.w - 0.01) / TS); tx++) {
    if (tileAt(lv, tx, ty) === 3 && feet > ty * TS + 7) { hurtPlayer(G, 1, p.x + 5 + p.facing); p.vy = -4; break; }
  }
  if (liquidAt(lv, p.x + 5, feet - 5)) {
    fx.splash(G, p.x + 5, Math.floor((feet - 5) / TS) * TS, lv.liquidType === 'lava' ? ['#fff', '#fd4', '#f62', '#a21'] : ['#fff', '#aef', '#4bd', '#27a']);
    G.sfx(lv.liquidType === 'lava' ? 'fireball' : 'land');
    killPlayer(G); p.vy = lv.liquidType === 'lava' ? -5 : 1; p.sunk = lv.liquidType !== 'lava';
    return;
  }
  if (p.y > lv.h * TS + 24) { killPlayer(G); return; }
  // attack resolution
  if (p.atk > 0) {
    p.atk--;
    const k = 1 - p.atk / ATK, bl = BLADE[st.sword];
    if (k >= 0.2 && k <= 0.62) {
      const reach = bl.len + 11 + (p.atkKind === 'stab' ? 3 : 0), cx = p.x + 5;
      const hb = p.atkKind === 'stab' ? { x: p.facing > 0 ? cx : cx - reach, y: p.y + 1, w: reach, h: p.h - 3 }
        : { x: p.facing > 0 ? cx - 2 : cx - reach, y: p.y - 12, w: reach + 2, h: p.h + 10 };
      for (const e of G.ents) {
        if (e.dead || !e.hit || p.atkHit.has(e) || !overlap(hb, e)) continue;
        p.atkHit.add(e);
        if (e.hit(G, e, st.sword === 0 ? 1 : 2, p.facing) !== false) {
          G.hitstop = 4; G.shake = Math.max(G.shake, 3);
          fx.spark(G, clamp(cx + p.facing * reach * 0.8, e.x, e.x + e.w), clamp(p.y + 8, e.y, e.y + e.h), bl.trail, 9);
        }
      }
      if (st.sword === 2 && !p.waved && k > 0.32) {
        p.waved = true; G.sfx('wave');
        G.ents.push(makeProj(G, 'wave', cx + p.facing * 12, p.y + (p.atkKind === 'stab' ? 8 : 10), p.facing * 3.4, 0));
      }
    }
  }
  // cape simulation in local (facing-normalised) space
  const lvx = p.vx * p.facing, c = p.cape;
  for (let i = 1; i < c.length; i++) {
    const wx = -Math.max(0, lvx) * 1.5 - 0.45 + Math.sin(p.t * 0.16 + i * 0.9) * 0.35 * (1 + Math.abs(lvx)), wy = 2.6 + clamp(-p.vy * 0.9, -4.6, 2);
    const l = Math.hypot(wx, wy) || 1, tx = c[i - 1][0] + (wx / l) * 3.6, tyy = c[i - 1][1] + (wy / l) * 3.6;
    c[i][0] += (tx - c[i][0]) * 0.3; c[i][1] += (tyy - c[i][1]) * 0.3;
  }
}
export function drawPlayer(g, G) {
  const p = G.player, st = G.st;
  if (p.dead && (p.dead > 70 || p.sunk)) return;
  if (p.inv > 0 && !p.dead && p.hurtT <= 0 && ((p.inv >> 1) & 1)) return;
  let anim = 'idle', k = 0;
  if (p.dead || p.hurtT > 0) anim = 'hurt';
  else if (p.atk > 0) { anim = p.atkKind; k = 1 - p.atk / ATK; }
  else if (p.crouch) anim = 'crouch';
  else if (!p.onGround) anim = p.vy < 0.5 ? 'jump' : 'fall';
  else if (Math.abs(p.vx) > 0.3) anim = 'run';
  const pose = heroPose(anim, p.t / 60, p.runPh, k);
  if (p.landT > 0 && anim === 'idle') pose.hip = 2;
  pose.cape = p.cape;
  const style = { arm: ARMOUR[st.armour], blade: BLADE[st.sword] };
  const flash = p.hurtT > 10 || (p.dead && p.dead < 8);
  const fy = p.y + p.h + 1;
  // slash crescent
  if (p.atk > 0 && p.atkKind !== 'stab' && k > 0.2 && k < 0.85) {
    const u = clamp((k - 0.2) / 0.3, 0, 1), fade = k > 0.5 ? (k - 0.5) / 0.35 : 0;
    const th1 = lerp(4.2, 0.75, u * u * (3 - 2 * u)), th0 = Math.min(4.4, th1 + 2.2 * (1 - fade)), Rr = 9 + BLADE[st.sword].len, tr = BLADE[st.sword].trail;
    const cx = p.x + 5 + p.facing * 2, cy = fy - 18 + (pose.hip || 0);
    for (let a = th1; a < th0; a += 0.045) {
      const f = (a - th1) / 2.2 + fade * 0.6;
      const wdt = Math.max(1, Math.round(4 * (1 - f)));
      for (let r = 0; r < wdt; r++) {
        if (f > 0.5 && ((Math.round(a * 22) + r) & 1)) continue;
        g.fillStyle = P(tr[f < 0.18 && r < 2 ? 0 : f < 0.5 ? 1 : 2]);
        g.fillRect(Math.round(cx + p.facing * Math.sin(a) * (Rr - r)), Math.round(cy + Math.cos(a) * (Rr - r)), 1, 1);
      }
    }
  }
  if (p.atk > 0 && p.atkKind === 'stab' && k > 0.15 && k < 0.6) {
    const tr = BLADE[st.sword].trail, len = BLADE[st.sword].len + 14;
    for (let i = 0; i < len; i += 2) { g.fillStyle = P(tr[i > len * 0.6 ? 0 : 1]); g.fillRect(Math.round(p.x + 5 + p.facing * (6 + i)), Math.round(fy - 10 - (i & 2 ? 1 : 0)), 2, 1); }
  }
  drawHumanoid(g, pose, style, p.x + 5, fy, p.facing < 0, flash);
}

// ================= generic helpers =================
function die(G, e, cols, drops = 2) {
  e.dead = true; G.sfx('kill'); G.st.kills++;
  fx.burst(G, e.x + e.w / 2, e.y + e.h / 2, cols, 16);
  fx.spark(G, e.x + e.w / 2, e.y + e.h / 2, ['#fff', cols[0]], 6);
  const n = drops + (Math.random() < 0.5 ? 1 : 0);
  for (let i = 0; i < n; i++) G.ents.push(makePickup(G, Math.random() < 0.12 ? 'gem' : 'coin', e.x + e.w / 2, e.y + e.h / 2, true));
  if (Math.random() < (G.st.hp < G.st.maxHp ? 0.2 : 0.05)) G.ents.push(makePickup(G, 'heart', e.x + e.w / 2, e.y + e.h / 2, true));
}
const touch = (G, e) => { if (!G.player.dead && overlap(e, G.player)) hurtPlayer(G, e.dmg || 1, e.x + e.w / 2); };
const groundAhead = (G, x, y) => { const t = tileAt(G.lv, Math.floor(x / TS), Math.floor(y / TS)); return t === 1 || t === 2; };
const pc = (G) => ({ x: G.player.x + 5, y: G.player.y + G.player.h / 2 });

// ================= enemies =================
function makeSlime(G, d) {
  const w = G.lv.world;
  return {
    type: 'slime', x: d.x - 7, y: d.y - 10, w: 14, h: 10, vx: 0, vy: 0, hp: 2 + w, t: rnd(20, 60), flash: 0, facing: -1, landT: 0,
    update(G, e) {
      const p = pc(G);
      if (e.flash > 0) e.flash--;
      if (e.landT > 0) e.landT--;
      e.vy = Math.min(6, e.vy + 0.26);
      const wasAir = !e.onGround;
      moveBody(G.lv, e);
      if (e.onGround) {
        if (wasAir) { e.landT = 8; e.vx = 0; fx.dust(G, e.x + 7, e.y + e.h, 2); }
        e.vx *= 0.7;
        if (--e.t <= 0) {
          let dir = Math.abs(p.x - (e.x + 7)) < 130 && Math.abs(p.y - e.y) < 70 ? sign(p.x - (e.x + 7)) || 1 : (Math.random() < 0.5 ? -1 : 1);
          const ok = (dd) => { const lx = e.x + 7 + dd * 30, fyy = e.y + e.h; return !solidAt(G.lv, Math.floor((e.x + 7 + dd * 14) / TS), Math.floor((fyy - 4) / TS)) && (groundAhead(G, lx, fyy + 2) || groundAhead(G, lx, fyy + 18)) && !liquidAt(G.lv, lx, fyy + 20); };
          if (!ok(dir)) dir = ok(-dir) ? -dir : 0;
          if (dir) { e.vx = dir * 1.15; e.vy = -3.6; e.facing = dir; e.onGround = false; }
          e.t = rnd(36, 80);
        }
      }
      if (liquidAt(G.lv, e.x + 7, e.y + 6) || e.y > G.lv.h * TS) e.dead = true;
      touch(G, e);
    },
    hit(G, e, dmg, dir) { e.hp -= dmg; e.flash = 8; e.vx = dir * 1.6; e.vy = -1.6; G.sfx('hit'); if (e.hp <= 0) die(G, e, [['#9e5', '#4b3', '#274'], ['#7de', '#39c', '#157'], ['#fb3', '#e52', '#811']][w]); },
    draw(g, G, e) { const f = !e.onGround ? 4 : e.landT > 0 ? 5 : (G.t / 10 | 0) % 4; drawSpr(g, SPR.slime[w], f, e.x + 7, e.y + e.h + 1, e.facing < 0, e.flash > 3); },
  };
}
function makeBat(G, d) {
  return {
    type: 'bat', x: d.x - 6, y: d.y + 2, w: 12, h: 10, hx: d.x - 6, hy: d.y + 2, vx: 0, vy: 0, hp: 1 + (G.lv.world > 1 ? 1 : 0), state: 'hang', t: 0, flash: 0, light: 0,
    update(G, e) {
      const p = pc(G);
      if (e.flash > 0) e.flash--;
      e.t++;
      if (e.state === 'hang') {
        if (e.t > 50 && Math.abs(p.x - e.x - 6) < 96 && p.y - e.y > -10 && p.y - e.y < 130 && !G.player.dead) { e.state = 'swoop'; e.t = 0; e.vy = 1; }
        return;
      }
      const tx = e.state === 'swoop' ? p.x - 6 : e.hx, tyy = e.state === 'swoop' ? p.y - 8 : e.hy;
      const dx = tx - e.x, dy = tyy - e.y, l = Math.hypot(dx, dy) || 1, sp = e.state === 'swoop' ? 2.1 : 1.6;
      e.vx += ((dx / l) * sp - e.vx) * 0.07; e.vy += ((dy / l) * sp - e.vy) * 0.07;
      e.x += e.vx; e.y += e.vy + Math.sin(e.t * 0.3) * 0.5;
      if (e.state === 'swoop' && (e.t > 130 || G.player.dead)) { e.state = 'return'; e.t = 0; }
      if (e.state === 'return' && l < 3) { e.state = 'hang'; e.x = e.hx; e.y = e.hy; e.t = 0; e.vx = e.vy = 0; }
      if (!G.player.dead && overlap(e, G.player)) { hurtPlayer(G, 1, e.x + 6); if (e.state === 'swoop') { e.state = 'return'; e.t = 0; } }
    },
    hit(G, e, dmg, dir) { e.hp -= dmg; e.flash = 8; e.vx = dir * 3; e.vy = -1; G.sfx('hit'); if (e.state === 'hang') { e.state = 'swoop'; e.t = 0; } if (e.hp <= 0) die(G, e, ['#84a', '#526', '#314'], 1); },
    draw(g, G, e) { drawSpr(g, SPR.bat, e.state === 'hang' ? 0 : 1 + ((G.t / 4 | 0) % 4), e.x + 6, e.y + 6, false, e.flash > 3); },
  };
}
function makePlant(G, d) {
  return {
    type: 'plant', x: d.x - 7, y: d.y - 22, w: 14, h: 22, hp: 3 + G.lv.world, t: rnd(40, 90), spit: 0, flash: 0, facing: -1,
    update(G, e) {
      const p = pc(G), dx = p.x - (e.x + 7), dy = p.y - (e.y + 4);
      if (e.flash > 0) e.flash--;
      if (e.spit > 0) {
        e.spit--;
        if (e.spit === 16) {
          const T = clamp(Math.abs(dx) / 2.2, 34, 64), gr = 0.16;
          G.ents.push(makeProj(G, 'seed', e.x + 7 + e.facing * 9, e.y + 3, clamp(dx / T, -2.6, 2.6), clamp((dy - 0.5 * gr * T * T) / T, -6, 1)));
          G.sfx('spit');
        }
      } else if (Math.abs(dx) < 150 && Math.abs(dy) < 96 && !G.player.dead) {
        e.facing = dx < 0 ? -1 : 1;
        if (--e.t <= 0) { e.spit = 30; e.t = rnd(90, 130); }
      }
      touch(G, e);
    },
    hit(G, e, dmg) { e.hp -= dmg; e.flash = 8; G.sfx('hit'); if (e.hp <= 0) die(G, e, ['#d35', '#a13', '#383', '#5b3']); },
    draw(g, G, e) { const f = e.spit > 20 ? 5 : e.spit > 8 ? 4 : (G.t / 12 | 0) % 4; drawSpr(g, SPR.plant, f, e.x + 7, e.y + e.h + 1, e.facing < 0, e.flash > 3); },
  };
}
const SKEL_STYLE = { skel: true, arm: ARMOUR[1], blade: { l: '#dcb', m: '#a98', d: '#543', len: 10 } };
function makeSkel(G, d) {
  return {
    type: 'skel', x: d.x - 5, y: d.y - 24, w: 10, h: 24, vx: 0, vy: 0, hp: 4 + G.lv.world, state: 'patrol', t: 0, flash: 0, facing: Math.random() < 0.5 ? -1 : 1, ph: 0, stun: 0,
    update(G, e) {
      const p = pc(G), cx = e.x + 5, dx = p.x - cx, dy = p.y - (e.y + 12), lv = G.lv;
      if (e.flash > 0) e.flash--;
      e.t++;
      const edge = (dir) => solidAt(lv, Math.floor((cx + dir * 9) / TS), Math.floor((e.y + 12) / TS)) || !groundAhead(G, cx + dir * 8, e.y + e.h + 3);
      let want = 0;
      if (e.stun > 0) { e.stun--; }
      else if (e.state === 'patrol') {
        if (edge(e.facing)) e.facing = -e.facing;
        want = e.facing * 0.45;
        if (Math.abs(dx) < 110 && Math.abs(dy) < 30 && !G.player.dead) { e.state = 'chase'; e.t = 0; }
      } else if (e.state === 'chase') {
        e.facing = dx < 0 ? -1 : 1;
        want = edge(e.facing) ? 0 : e.facing * 1.0;
        if (Math.abs(dx) < 38 && Math.abs(dy) < 26) { e.state = 'tele'; e.t = 0; G.sfx('warn'); }
        else if (Math.abs(dx) > 170 || Math.abs(dy) > 70 || G.player.dead) e.state = 'patrol';
      } else if (e.state === 'tele') {
        if (e.t > 26) { e.state = 'lunge'; e.t = 0; G.sfx('slash'); }
      } else if (e.state === 'lunge') {
        want = edge(e.facing) ? 0 : e.facing * 3.1;
        const hb = { x: e.facing > 0 ? cx : cx - 22, y: e.y + 4, w: 22, h: 14 };
        if (!G.player.dead && overlap(hb, G.player)) hurtPlayer(G, 1, cx);
        if (e.t > 15) { e.state = 'rec'; e.t = 0; }
      } else if (e.state === 'rec') { if (e.t > 36) { e.state = 'chase'; e.t = 0; } }
      if (e.stun <= 0) e.vx += (want - e.vx) * (e.state === 'lunge' ? 0.5 : 0.25); else e.vx *= 0.85;
      e.vy = Math.min(6, e.vy + 0.28);
      moveBody(lv, e);
      e.ph += Math.abs(e.vx) * 0.22;
      if (liquidAt(lv, cx, e.y + 20) || e.y > lv.h * TS) e.dead = true;
      touch(G, e);
    },
    hit(G, e, dmg, dir) {
      e.hp -= dmg; e.flash = 8; e.vx = dir * 2.2; G.sfx('hit');
      if (e.state !== 'lunge') { e.stun = 12; if (e.state === 'patrol') e.state = 'chase'; }
      if (e.hp <= 0) { die(G, e, ['#fed', '#ba9', '#754'], 3); if (Math.random() < 0.5) G.ents.push(makePickup(G, 'gem', e.x + 5, e.y + 10, true)); }
    },
    draw(g, G, e) {
      let pose;
      if (e.state === 'tele') pose = { fa: [3, 0], fb: [-3, 0], af: [3.5 + Math.sin(e.t * 0.9) * 0.08, 0.2], ab: [0.6, 0.9], sw: 4.0, lean: -1, angry: true };
      else if (e.state === 'lunge') pose = { fa: [5, 0], fb: [-4, 0], af: [1.57, 0], ab: [0.9, 0.9], sw: 1.57, lean: 2, hip: 1, thrust: 2, angry: true };
      else if (Math.abs(e.vx) > 0.15) { pose = heroPose('run', 0, e.ph, 0); pose.ab = [0.7, 1.0]; pose.angry = e.state === 'chase'; }
      else { pose = heroPose('idle', G.t / 60, 0, 0); pose.ab = [0.7, 1.0]; }
      drawHumanoid(g, pose, SKEL_STYLE, e.x + 5, e.y + e.h + 1, e.facing < 0, e.flash > 3 || (e.state === 'tele' && (e.t >> 2) & 1 && e.t > 12));
    },
  };
}
function makeWisp(G, d) {
  return {
    type: 'wisp', x: d.x - 5, y: d.y - 10, w: 10, h: 10, vx: 0, vy: 0, hp: 2, t: rnd(100), flash: 0, light: 34, hx: d.x - 5, hy: d.y - 10,
    update(G, e) {
      const p = pc(G);
      e.t++;
      if (e.flash > 0) e.flash--;
      let tx = e.hx, tyy = e.hy;
      const dd = Math.hypot(p.x - e.x - 5, p.y - e.y - 5);
      if (dd < 170 && !G.player.dead) { tx = p.x - 5; tyy = p.y - 6; }
      const dx = tx - e.x, dy = tyy - e.y, l = Math.hypot(dx, dy) || 1;
      if (l > 2) { e.vx += ((dx / l) * 0.62 - e.vx) * 0.04; e.vy += ((dy / l) * 0.62 - e.vy) * 0.04; } else { e.vx *= 0.9; e.vy *= 0.9; }
      e.x += e.vx + Math.sin(e.t * 0.05) * 0.3; e.y += e.vy + Math.cos(e.t * 0.07) * 0.3;
      if (G.t % 6 === 0) part(G, { x: e.x + 5 + rnd(-3, 3), y: e.y + 2, vy: -0.4, life: 18, cols: ['#8ef', '#4bd', '#27a'], add: true });
      touch(G, e);
    },
    hit(G, e, dmg, dir) { e.hp -= dmg; e.flash = 10; e.vx = dir * 3.4; e.vy = -1; G.sfx('hit'); if (e.hp <= 0) die(G, e, ['#fff', '#8ef', '#4bd', '#27a'], 2); },
    draw(g, G, e) {
      g.globalCompositeOperation = 'lighter'; g.drawImage(glow('#4bd', 14), Math.round(e.x + 5 - 14), Math.round(e.y + 5 - 14)); g.globalCompositeOperation = 'source-over';
      drawSpr(g, SPR.wisp, G.t / 6 | 0, e.x + 5, e.y + 9, e.vx < 0, e.flash > 3);
    },
  };
}

// ================= boss =================
const ANCH = [[5, -82], [12, -26], [19, -82], [12, -96], [7, -24], [17, -24]];
function makeBoss(G, d) {
  const ar = G.lv.arena;
  const at = (i) => ({ x: ar.x0 + ANCH[i][0] * 16 - 11, y: ar.floor + ANCH[i][1] - 40 });
  const e = {
    type: 'boss', w: 22, h: 40, ...at(3), hp: 26, maxHp: 26, state: 'sleep', t: 0, flash: 0, alpha: 1, cast: 0, anchor: 3, hits: 0, light: 52, boss: true, name: 'MALGRIM THE ASHEN', by: 0,
    update(G, e) {
      const p = pc(G), cx = e.x + 11, cy = e.y + 16;
      e.t++;
      if (e.flash > 0) e.flash--;
      e.by = Math.sin(G.t * 0.05) * 3;
      const phase = e.hp > e.maxHp * 0.62 ? 0 : e.hp > e.maxHp * 0.3 ? 1 : 2;
      e.phase = phase;
      if (e.state === 'sleep') { if (G.arenaLock) { e.state = 'intro'; e.t = 0; G.music('boss'); G.banner('LORD OF THE ASHEN KEEP', e.name, 150); } return; }
      if (e.state === 'intro') { e.cast = Math.min(1, e.t / 60); if (e.t > 110) { e.state = 'idle'; e.t = 0; e.cast = 0; } return; }
      if (e.state === 'dying') {
        e.x += Math.sin(e.t * 2.2) * 1.2;
        if (e.t % 7 === 0) { fx.burst(G, cx + rnd(-12, 12), cy + rnd(-18, 18), ['#fff', '#fd4', '#f62', '#a2d'], 12, 2.6); G.shake = 5; if (e.t % 21 === 0) G.sfx('boom'); }
        if (e.t > 130) {
          e.dead = true; G.bossDead = true; G.flash = 10; G.shake = 14; G.sfx('boom'); G.music(null);
          fx.burst(G, cx, cy, ['#fff', '#fd4', '#f62', '#a2d', '#314'], 60, 4);
          G.ents.push({ ...makePickup(G, 'rune', ar.x0 + 12 * 16, ar.floor - 40, false) });
          for (let i = 0; i < 14; i++) G.ents.push(makePickup(G, i % 4 === 0 ? 'gem' : 'coin', cx, cy, true));
          G.arenaLock = false; G.arenaDone = true;
        }
        return;
      }
      if (e.state === 'idle') {
        e.cast = Math.max(0, e.cast - 0.08);
        if (e.t > [78, 58, 40][phase]) {
          e.state = 'cast'; e.t = 0; G.sfx('warn');
          e.act = phase === 0 ? 'volley' : phase === 1 ? (Math.random() < 0.5 ? 'volley' : 'rain') : 'both';
          if (e.act !== 'volley') spawnRain(G, e, phase);
        }
      } else if (e.state === 'cast') {
        e.cast = Math.min(1, e.cast + 0.07);
        if (e.t % 4 === 0) part(G, { x: cx + 16 + rnd(-8, 8), y: e.y - 14 + rnd(-8, 8), vx: rnd(-0.3, 0.3), vy: -0.5, life: 16, cols: ['#fff', '#fd4', '#f62'], add: true });
        if (e.t === 34) {
          if (e.act !== 'rain') {
            const n = [3, 5, 5][phase], base = Math.atan2(p.y - cy, p.x - cx), sp = [1.9, 2.2, 2.5][phase];
            for (let i = 0; i < n; i++) { const a = base + (i - (n - 1) / 2) * 0.24; G.ents.push(makeProj(G, 'fireball', cx, cy - 6, Math.cos(a) * sp, Math.sin(a) * sp)); }
            G.sfx('fireball');
          }
        }
        if (e.t > 52) { e.state = 'vanish'; e.t = 0; G.sfx('teleport'); }
      } else if (e.state === 'vanish') {
        e.cast = Math.max(0, e.cast - 0.1); e.alpha = Math.max(0, 1 - e.t / 20);
        if (e.t > 22) {
          let n; do { n = Math.floor(Math.random() * ANCH.length); } while (n === e.anchor || Math.abs(at(n).x + 11 - p.x) < 34);
          e.anchor = n; Object.assign(e, at(n)); e.state = 'appear'; e.t = 0; e.hits = 0;
        }
      } else if (e.state === 'appear') {
        e.alpha = Math.min(1, e.t / 20);
        if (e.t > 22) { e.state = 'idle'; e.t = 0; }
      }
      if (e.alpha > 0.6 && !G.player.dead && overlap({ x: e.x + 3, y: e.y + 4 + e.by, w: e.w - 6, h: e.h - 8 }, G.player)) hurtPlayer(G, 1, cx);
    },
    hit(G, e, dmg, dir) {
      if (e.state === 'sleep' || e.state === 'intro' || e.state === 'dying' || e.alpha < 0.6) return false;
      e.hp -= dmg; e.flash = 8; e.hits++; G.sfx('hit');
      if (e.hp <= 0) { e.state = 'dying'; e.t = 0; e.alpha = 1; G.sfx('boom'); for (const o of G.ents) if (o.hostileProj) o.dead = true; return; }
      if (e.hits >= 3 && (e.state === 'idle' || e.state === 'cast')) { e.state = 'vanish'; e.t = 0; G.sfx('teleport'); }
    },
    draw(g, G, e) {
      const im = renderBoss(G.t / 60, e.cast, e.flash > 3 || (e.state === 'dying' && (e.t >> 1) & 1), e.phase === 2);
      const x = Math.round(e.x + 11), y = Math.round(e.y + e.h + e.by), flip = G.player.x + 5 < e.x + 11;
      if (e.alpha <= 0.02) return;
      g.save(); g.translate(x, y);
      if (e.alpha < 1) g.scale(e.alpha, 1 + (1 - e.alpha) * 0.6);
      if (e.state === 'sleep') g.globalAlpha = 0.85;
      if (flip) g.scale(-1, 1);
      g.drawImage(im, -BOSS_AX, -BOSS_AY - 28);
      g.restore();
    },
  };
  return e;
}
function spawnRain(G, e, phase) {
  const ar = G.lv.arena, p = pc(G), n = phase === 2 ? 7 : 6, cols = [clamp(p.x, ar.x0 + 12, ar.x1 - 12)];
  let guard = 0;
  while (cols.length < n && guard++ < 60) {
    const x = ar.x0 + 16 + Math.random() * (ar.x1 - ar.x0 - 32);
    if (cols.every((c) => Math.abs(c - x) > 30)) cols.push(x);
  }
  cols.forEach((x, i) => G.ents.push({
    type: 'rainwarn', x: x - 4, y: ar.floor - 170, w: 8, h: 8, t: -i * 5, fx: x, hostileProj: true,
    update(G, w) { w.t++; if (w.t === 46) { G.ents.push(makeProj(G, 'rain', w.fx, ar.floor - 172, 0, 3.4)); G.sfx('fireball'); } if (w.t > 46) w.dead = true; },
    draw(g, G, w) {
      if (w.t < 0 || (w.t >> 2) & 1) return;
      g.fillStyle = P('#f62');
      for (let y = ar.floor - 160; y < ar.floor - 2; y += 6) g.fillRect(Math.round(w.fx), y, 1, 2);
      g.fillStyle = P('#fd4'); g.fillRect(Math.round(w.fx) - 4, ar.floor - 2, 9, 1); g.fillRect(Math.round(w.fx) - 2, ar.floor - 3, 5, 1);
    },
  }));
}

// ================= projectiles =================
export function makeProj(G, kind, x, y, vx, vy) {
  const hostile = kind !== 'wave';
  const sz = kind === 'seed' ? 5 : kind === 'wave' ? 10 : 8;
  return {
    type: kind, x: x - sz / 2, y: y - (kind === 'wave' ? 9 : sz / 2), w: sz, h: kind === 'wave' ? 18 : sz, vx, vy, t: 0, hostileProj: hostile, light: kind === 'seed' ? 0 : 34,
    update(G, e) {
      e.t++;
      if (kind === 'seed') e.vy += 0.16;
      e.x += e.vx; e.y += e.vy;
      const cx = e.x + e.w / 2, cy = e.y + e.h / 2, lv = G.lv;
      const ar = lv.arena;
      const hitWall = solidAt(lv, Math.floor(cx / TS), Math.floor(cy / TS)) || (kind === 'fireball' && ar && G.arenaLock && (cx < ar.x0 || cx > ar.x1));
      if (hitWall || e.t > (kind === 'wave' ? 34 : 260) || cy > lv.h * TS) {
        e.dead = true;
        if (kind !== 'seed') { fx.spark(G, cx, cy, ['#fff', '#fd4', '#f62'], kind === 'rain' ? 12 : 6); if (kind === 'rain') { G.shake = Math.max(G.shake, 2); fx.dust(G, cx, cy, 4); } }
        else fx.burst(G, cx, cy, ['#8d3', '#383'], 4, 1);
        return;
      }
      if (hostile) { if (!G.player.dead && overlap(e, G.player)) { hurtPlayer(G, 1, cx - e.vx * 4); e.dead = true; } }
      else {
        for (const o of G.ents) if (!o.dead && o.hit && overlap(e, o)) { if (o.hit(G, o, 1, sign(e.vx)) !== false) { e.dead = true; fx.spark(G, cx, cy, ['#fff', '#fd4', '#f62'], 8); break; } }
        if (e.t % 2 === 0) part(G, { x: cx - e.vx * 2, y: cy + rnd(-7, 7), vx: -e.vx * 0.1, life: 12, cols: ['#fd4', '#f62', '#a21'], add: true });
      }
      if ((kind === 'fireball' || kind === 'rain') && e.t % 3 === 0) part(G, { x: cx + rnd(-2, 2), y: cy + rnd(-2, 2), vx: -e.vx * 0.2, vy: -e.vy * 0.2 - 0.2, life: 14, cols: ['#fd4', '#f62', '#a21', '#412'], add: true });
    },
    draw(g, G, e) {
      const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
      if (kind === 'seed') drawSpr(g, SPR.seed, e.t >> 3, cx, cy);
      else if (kind === 'wave') drawSpr(g, SPR.wave, e.t >> 2, cx, cy, e.vx < 0);
      else { g.globalCompositeOperation = 'lighter'; g.drawImage(glow('#f62', 12), Math.round(cx - 12), Math.round(cy - 12)); g.globalCompositeOperation = 'source-over'; drawSpr(g, SPR.fireball, e.t >> 2, cx, cy); }
    },
  };
}

// ================= pickups & objects =================
export function makePickup(G, kind, x, y, bounce) {
  const big = kind === 'rune';
  return {
    type: kind, x: x - (big ? 6 : 4), y: y - (big ? 8 : 4), w: big ? 12 : 8, h: big ? 16 : 8, vx: bounce ? rnd(-1.6, 1.6) : 0, vy: bounce ? -rnd(2.2, 4.2) : 0, t: 0, bounce, light: big ? 52 : 0, by: y,
    gemK: Math.random() < 0.5 ? 0 : 1,
    update(G, e) {
      e.t++;
      if (bounce) {
        e.vy = Math.min(6, e.vy + 0.22);
        const vy = e.vy;
        moveBody(G.lv, e);
        if (e.onGround) { e.vy = vy > 1.2 ? -vy * 0.5 : 0; e.vx *= 0.8; }
        if (e.hitWall) e.vx = 0;
        if (e.t > 600 || e.y > G.lv.h * TS || liquidAt(G.lv, e.x + 4, e.y + 4)) e.dead = true;
      } else if (kind === 'rune' && G.lv.arena && e.y + e.h < G.lv.arena.floor - 22) e.y += 0.5;
      if (kind === 'rune' && G.t % 5 === 0) fx.sparkle(G, e.x + 6, e.y + 8, ['#fff', '#8ff', '#0bd'], 1);
      if ((e.t > 16 || !bounce) && !G.player.dead && overlap({ x: e.x - 2, y: e.y - 2, w: e.w + 4, h: e.h + 4 }, G.player)) {
        e.dead = true;
        const st = G.st, cx = e.x + e.w / 2, cy = e.y + e.h / 2;
        if (kind === 'coin') { st.coins++; G.sfx('coin'); fx.sparkle(G, cx, cy); }
        else if (kind === 'gem') { st.coins += 5; G.sfx('gem'); fx.sparkle(G, cx, cy, ['#fff', '#8ff', '#2cd'], 8); }
        else if (kind === 'heart') { st.hp = Math.min(st.maxHp, st.hp + 1); G.sfx('heart'); fx.sparkle(G, cx, cy, ['#fff', '#f9b', '#f34'], 8); }
        else if (kind === 'rune') { st.rune = true; G.sfx('rune'); G.flash = 6; fx.sparkle(G, cx, cy, ['#fff', '#8ff', '#0bd'], 26); G.msg('THE RUNE STONE IS YOURS - SEEK THE PORTAL', 200); }
      }
    },
    draw(g, G, e) {
      if (bounce && e.t > 480 && (e.t >> 2) & 1) return;
      const cx = e.x + e.w / 2, bob = bounce ? 0 : Math.sin(G.t * 0.07 + e.x) * 2.5, cy = e.y + e.h / 2 + bob;
      if (kind === 'coin') drawSpr(g, SPR.coin, (G.t / 6 + e.x) | 0, cx, cy);
      else if (kind === 'gem') drawSpr(g, SPR.gem[e.gemK], 0, cx, cy);
      else if (kind === 'heart') drawSpr(g, SPR.heart, 0, cx, cy);
      else { g.globalCompositeOperation = 'lighter'; g.drawImage(glow('#0bd', 18), Math.round(cx - 18), Math.round(cy - 18)); g.globalCompositeOperation = 'source-over'; drawSpr(g, SPR.rune, G.t / 8 | 0, cx, cy); }
    },
  };
}
function makeChest(G, d) {
  return {
    type: 'chest', x: d.x - 8, y: d.y - 13, w: 16, h: 13, open: false,
    update() {},
    hit(G, e) {
      if (e.open) return false;
      e.open = true; G.sfx('chest');
      fx.sparkle(G, e.x + 8, e.y, ['#fff', '#ffb', '#fc3'], 14);
      for (let i = 0; i < 7; i++) G.ents.push(makePickup(G, 'coin', e.x + 8, e.y, true));
      G.ents.push(makePickup(G, 'gem', e.x + 8, e.y, true));
      if (G.st.hp < G.st.maxHp) G.ents.push(makePickup(G, 'heart', e.x + 8, e.y, true));
    },
    draw(g, G, e) { drawSpr(g, SPR.chest, e.open ? 1 : 0, e.x + 8, e.y + e.h + 1); if (!e.open && (G.t + (e.x | 0)) % 90 < 6) { g.fillStyle = '#fff'; g.fillRect(Math.round(e.x + 3), Math.round(e.y + 1), 1, 3); g.fillRect(Math.round(e.x + 2), Math.round(e.y + 2), 3, 1); } },
  };
}
function makeShrine(G, d) {
  return {
    type: 'shrine', x: d.x - 8, y: d.y - 30, w: 16, h: 30, lit: false, light: 0, sx: d.x, sy: d.y,
    update(G, e) {
      if (!e.lit && !G.player.dead && overlap(e, G.player)) {
        for (const o of G.ents) if (o.type === 'shrine') { o.lit = false; o.light = 0; }
        e.lit = true; e.light = 34; G.checkpoint = { x: e.sx, y: e.sy }; G.st.hp = G.st.maxHp;
        G.sfx('checkpoint'); fx.sparkle(G, e.x + 8, e.y, ['#fff', '#8ef', '#29d'], 18); G.msg('SHRINE KINDLED', 110);
      }
    },
    draw(g, G, e) { drawSpr(g, SPR.shrine, e.lit ? 1 + ((G.t / 6 | 0) % 4) : 0, e.x + 8, e.y + e.h + 1); },
  };
}
function makeMerchant(G, d) {
  return {
    type: 'merchant', x: d.x - 12, y: d.y - 30, w: 24, h: 30, light: 34,
    update(G, e) { if (!G.player.dead && G.player.onGround && overlap({ x: e.x - 6, y: e.y, w: e.w + 12, h: e.h }, G.player)) G.nearMerchant = e; },
    draw(g, G, e) { drawSpr(g, SPR.merchant, (G.t / 30 | 0) % 2, e.x + 12, e.y + e.h + 1, G.player.x < e.x); },
  };
}
function makePortal(G, d) {
  return {
    type: 'portal', x: d.x - 8, y: d.y - 34, w: 16, h: 34, light: 52, said: 0, cx: d.x, cy: d.y,
    update(G, e) {
      if (e.said > 0) e.said--;
      if (!G.player.dead && !G.cleared && overlap(e, G.player)) {
        if (G.st.rune) G.levelClear(e);
        else if (e.said <= 0) { G.msg('FIND THE RUNE STONE', 120); G.sfx('deny'); e.said = 200; }
      }
    },
    draw(g, G, e) {
      const on = G.st.rune, cx = Math.round(e.cx), by = Math.round(e.cy), t = G.t;
      // swirling interior
      for (let y = -42; y < -1; y++) for (let x = -10; x <= 10; x++) {
        if (y < -30 && x * x + (y + 30) * (y + 30) > 110) continue;
        const dx = x, dy = (y + 22) * 0.6, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
        const v = Math.sin(a * 2 + r * 0.6 - t * (on ? 0.12 : 0.03)) + Math.sin(r * 0.9 - t * 0.05) * 0.5;
        const c = on ? (v > 0.9 ? '#fff' : v > 0.3 ? '#8ff' : v > -0.4 ? '#0bd' : '#059') : (v > 0.9 ? '#526' : v > 0 ? '#314' : '#102');
        g.fillStyle = P(c); g.fillRect(cx + x, by + y, 1, 1);
      }
      drawSpr(g, SPR.portal, 0, cx, by + 1);
      if (on && t % 4 === 0) part(G, { x: cx + rnd(-9, 9), y: by - rnd(4, 40), vx: rnd(-0.3, 0.3), vy: -rnd(0.2, 0.8), life: 26, cols: ['#fff', '#8ff', '#0bd'], add: true });
    },
  };
}
function makeTorch(G, d) {
  return {
    type: 'torch', x: d.x - 4, y: d.y - 14, w: 8, h: 14, light: 52, tx: d.x, ty: d.y,
    update(G, e) { if ((G.t + (e.x | 0)) % 9 === 0) part(G, { x: e.tx + rnd(-1, 1), y: e.ty - 14, vx: rnd(-0.15, 0.15), vy: -rnd(0.3, 0.8), life: rnd(16, 30), cols: ['#fd4', '#f62', '#a21', '#412'], add: true }); },
    draw(g, G, e) {
      g.globalCompositeOperation = 'lighter'; g.drawImage(glow('#f62', 20), Math.round(e.tx - 20), Math.round(e.ty - 30)); g.globalCompositeOperation = 'source-over';
      drawSpr(g, SPR.bracket, 0, e.tx, e.ty - 2); drawSpr(g, SPR.flame, (G.t / 5 + e.x) | 0, e.tx, e.ty - 1);
    },
  };
}

export function makeEnt(G, d) {
  switch (d.type) {
    case 'slime': return makeSlime(G, d);
    case 'bat': return makeBat(G, d);
    case 'plant': return makePlant(G, d);
    case 'skel': return makeSkel(G, d);
    case 'wisp': return makeWisp(G, d);
    case 'boss': return makeBoss(G, d);
    case 'chest': return makeChest(G, d);
    case 'shrine': return makeShrine(G, d);
    case 'merchant': return makeMerchant(G, d);
    case 'portal': return makePortal(G, d);
    case 'torch': return makeTorch(G, d);
    case 'rune': return makePickup(G, 'rune', d.x, d.y - 14, false);
    case 'gem': case 'heart': return makePickup(G, d.type, d.x, d.y - 8, false);
    default: return null;
  }
}
