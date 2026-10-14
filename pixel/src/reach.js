// EMBERFALL Classic — level completability check. Pure (no DOM): simulates real jump physics
// from every standable tile with a set of input strategies and BFSes over the landings.
import { PHYS, TS, moveBody, tileAt, liquidAt } from './physics.js';

const BW = 10, BH = 24;

export function checkLevel(lvIn) {
  // clone grid; bake moving-platform sweeps in as one-way tiles
  const lv = { ...lvIn, tiles: Uint8Array.from(lvIn.tiles) };
  const W = lv.w, H = lv.h;
  const key = (tx, ty) => ty * W + tx;
  const platGroups = [];
  for (const p of lv.plats) {
    const cells = [];
    const tx0 = Math.round(p.x / TS), ty0 = Math.round(p.y / TS), pw = Math.round(p.w / TS), r = Math.round(p.range / TS);
    if (p.axis === 'h') { for (let i = 0; i < pw + r; i++) cells.push([tx0 + i, ty0]); }
    else for (let j = 0; j <= r; j++) for (let i = 0; i < pw; i++) cells.push([tx0 + i, ty0 - j]);
    for (const [cx, cy] of cells) if (tileAt(lv, cx, cy) === 0) lv.tiles[cy * W + cx] = 2;
    platGroups.push(cells.map(([cx, cy]) => key(cx, cy)));
  }
  const standable = (tx, ty) => {
    if (tx < 0 || tx >= W || ty < 2 || ty >= H) return false;
    const t = tileAt(lv, tx, ty);
    if (t !== 1 && t !== 2) return false;
    return tileAt(lv, tx, ty - 1) !== 1 && tileAt(lv, tx, ty - 2) !== 1 && tileAt(lv, tx, ty - 1) !== 3;
  };
  const supportNode = (b) => {
    const ty = Math.round((b.y + b.h) / TS);
    const cx = Math.floor((b.x + b.w / 2) / TS);
    for (const tx of [cx, Math.floor(b.x / TS), Math.floor((b.x + b.w - 0.01) / TS)]) if (standable(tx, ty)) return key(tx, ty);
    return -1;
  };
  const dead = (b) => {
    if (b.y > H * TS) return true;
    if (liquidAt(lv, b.x + b.w / 2, b.y + b.h - 4)) return true;
    const ty = Math.floor((b.y + b.h - 1) / TS);
    for (let tx = Math.floor(b.x / TS); tx <= Math.floor((b.x + b.w - 0.01) / TS); tx++) {
      if (tileAt(lv, tx, ty) === 3 && b.y + b.h > ty * TS + 6) return true;
    }
    return false;
  };
  const sim = (tx, ty, dir, jumpHold, runFrames, runStart, drop) => {
    const b = { x: tx * TS + (TS - BW) / 2 + (runStart ? dir * 3 : 0), y: ty * TS - BH, w: BW, h: BH, vx: runStart ? dir * PHYS.RUN : 0, vy: 0, drop: drop ? 12 : 0 };
    const from = key(tx, ty);
    let grounded = jumpHold <= 0;
    if (jumpHold > 0) b.vy = -PHYS.JUMP;
    for (let f = 0; f < 150; f++) {
      const want = f < runFrames ? dir * PHYS.RUN : 0, acc = grounded ? PHYS.ACC : PHYS.ACC * 0.75;
      if (b.vx < want) b.vx = Math.min(want, b.vx + acc); else if (b.vx > want) b.vx = Math.max(want, b.vx - acc);
      if (jumpHold > 0 && f === jumpHold && b.vy < -2.2) b.vy *= 0.45;
      b.vy = Math.min(PHYS.MAXFALL, b.vy + PHYS.GRAV);
      if (b.drop > 0) b.drop--;
      moveBody(lv, b);
      grounded = b.onGround;
      if (dead(b)) return -1;
      if (b.onGround) {
        const n = supportNode(b);
        if (n !== from && n >= 0) return n;
        if (jumpHold > 0 || f >= runFrames + 8) return n;
      }
    }
    return -1;
  };
  const edges = new Map(), strat = new Map();
  const nodes = [];
  for (let ty = 2; ty < H; ty++) for (let tx = 0; tx < W; tx++) if (standable(tx, ty)) nodes.push(key(tx, ty));
  const nodeSet = new Set(nodes);
  for (const n of nodes) {
    const tx = n % W, ty = (n / W) | 0, out = new Set();
    const tryIt = (dir, jh, rf, rs, drop) => {
      const m = sim(tx, ty, dir, jh, rf, rs, drop);
      if (m < 0 || m === n) return;
      out.add(m);
      const k = n * 65536 + m;
      if (!strat.has(k) || (strat.get(k).rs && !rs)) strat.set(k, { dir, jh, rf, rs, drop });
    };
    for (const dir of [-1, 1]) {
      for (const rs of [0, 1]) {
        tryIt(dir, 0, 40, rs, false);
        for (const jh of [4, 9, 99]) for (const rf of [0, 6, 12, 20, 30, 99]) tryIt(dir, jh, rf, rs, false);
      }
    }
    if (tileAt(lv, tx, ty) === 2) tryIt(1, 0, 0, 0, true);
    edges.set(n, out);
  }
  for (const g of platGroups) {
    const gs = g.filter((k) => nodeSet.has(k));
    for (const a of gs) for (const b of gs) if (a !== b) edges.get(a).add(b);
  }
  const bfs = (start) => {
    const seen = new Set([start]), q = [start];
    while (q.length) { const n = q.pop(); for (const m of edges.get(n) || []) if (!seen.has(m)) { seen.add(m); q.push(m); } }
    return seen;
  };
  const nodeOf = (x, y) => {
    const tx = Math.floor(x / TS), ty = Math.round(y / TS);
    for (const [dx, dy] of [[0, 0], [0, 1], [-1, 0], [1, 0], [0, 2]]) if (nodeSet.has(key(tx + dx, ty + dy))) return key(tx + dx, ty + dy);
    return -1;
  };
  const start = nodeOf(lv.start.x, lv.start.y);
  const fromStart = bfs(start);
  const res = { level: lv.name, nodes: nodes.length, reachableNodes: fromStart.size, unreachable: [], ok: true };
  let runeNode = -1, portalNode = -1;
  for (const e of lv.ents) {
    if (!['rune', 'portal', 'merchant', 'shrine', 'chest', 'boss'].includes(e.type)) continue;
    const n = e.type === 'boss' ? nodeOf(e.x, lv.arena.floor) : nodeOf(e.x, e.y);
    if (e.type === 'rune' || e.type === 'boss') runeNode = n;
    if (e.type === 'portal') portalNode = n;
    if (n < 0 || !fromStart.has(n)) { res.unreachable.push(`${e.type}@${Math.floor(e.x / TS)},${Math.round(e.y / TS)}`); res.ok = false; }
  }
  res.runeReachable = runeNode >= 0 && fromStart.has(runeNode);
  res.portalFromRune = runeNode >= 0 && portalNode >= 0 && bfs(runeNode).has(portalNode);
  if (!res.runeReachable || !res.portalFromRune) res.ok = false;
  // soft-lock check: reachable nodes from which the portal can no longer be reached
  let traps = 0; const trapList = [];
  for (const n of fromStart) if (!bfs(n).has(portalNode)) { traps++; if (trapList.length < 8) trapList.push(`${n % W},${(n / W) | 0}`); }
  res.traps = traps; res.trapSample = trapList;
  // coins: reachable if within jump-touch of a reachable node
  let coinsOk = 0;
  for (const c of lv.coins) {
    const tx = Math.floor(c.x / TS), ty = Math.floor(c.y / TS);
    let ok = false;
    for (let dy = 0; dy <= 5 && !ok; dy++) for (let dx = -2; dx <= 2; dx++) if (fromStart.has(key(tx + dx, ty + dy))) { ok = true; break; }
    if (ok) coinsOk++;
  }
  res.coins = `${coinsOk}/${lv.coins.length}`;
  const platCells = new Set(platGroups.flat());
  // explicit route start -> rune (or boss floor) -> portal, with the input strategy for every hop
  const route = (a, b) => {
    const prev = new Map([[a, -1]]), q = [a];
    for (let i = 0; i < q.length; i++) { const n = q[i]; if (n === b) break; for (const m of edges.get(n) || []) if (!prev.has(m)) { prev.set(m, n); q.push(m); } }
    if (!prev.has(b)) return null;
    const out = [];
    for (let n = b; prev.get(n) !== -1; n = prev.get(n)) { const f = prev.get(n); out.unshift({ from: [f % W, (f / W) | 0], to: [n % W, (n / W) | 0], s: platCells.has(f) || platCells.has(n) ? null : strat.get(f * 65536 + n) || null }); }
    return out;
  };
  if (res.ok) res.plan = [...route(start, runeNode), { mark: 'rune' }, ...route(runeNode, portalNode)];
  return res;
}
