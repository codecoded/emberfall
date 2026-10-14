// Conservative reachability check: can the hero walk/jump from the start to the rune and the portal?
import { buildLevel, LEVEL_COUNT, TILE } from '../src/levels.js';
const MAXDX = { up: [5, 4, 3.5, 3], };   // horizontal tiles coverable when jumping up 0..3 tiles
for (let i = 0; i < LEVEL_COUNT; i++) {
  const L = buildLevel(i);
  const stand = new Set();
  const key = (x, y) => x + ',' + y;
  const free = (x, y) => { const t = L.tile(x, y); return t !== TILE.SOLID; };
  const add = (x, y) => { if (free(x, y) && free(x, y + 1)) stand.add(key(x, y)); };
  for (let x = L.minX; x < L.maxX; x++) for (let y = 1; y < L.H - 2; y++) {
    const b = L.tile(x, y - 1);
    if ((b === TILE.SOLID || b === TILE.ONEWAY) && !(L.cols[x].pit && y <= 1)) add(x, y);
  }
  for (const m of L.movers) {
    if (m.axis === 'x') for (let x = Math.floor(m.x0); x < Math.ceil(m.x0 + m.range + m.w); x++) add(x, m.y0);
    else for (let y = m.y0; y <= m.y0 + m.range; y++) for (let x = Math.floor(m.x0); x < Math.ceil(m.x0 + m.w); x++) add(x, y);
  }
  const nodes = [...stand].map((k) => k.split(',').map(Number));
  const start = [Math.floor(L.start.x), L.start.y];
  const seen = new Set([key(...start)]), q = [start];
  while (q.length) {
    const [x, y] = q.pop();
    for (const [nx, ny] of nodes) {
      if (seen.has(key(nx, ny))) continue;
      const dx = Math.abs(nx - x), dy = ny - y;
      const ok = dy > 3 ? false : dy >= 0 ? dx <= MAXDX.up[dy] : dx <= 5 + Math.min(3, -dy * 0.5);
      if (ok) { seen.add(key(nx, ny)); q.push([nx, ny]); }
    }
  }
  const near = (e, r = 2) => [...seen].some((k) => { const [x, y] = k.split(',').map(Number); return Math.abs(x + 0.5 - e.x) <= 1.5 && e.y - y >= -0.5 && e.y - y <= r; });
  const report = ['rune', 'portal', 'merchant', 'shrine', 'chest', 'boss'].map((t) => { const es = L.ents.filter((e) => e.type === t); return es.length ? `${t}:${es.filter((e) => near(e, t === 'boss' ? 6 : 2)).length}/${es.length}` : null; }).filter(Boolean);
  const spikesOk = L.spikes.every((s) => L.tile(s.x, s.y - 1) === TILE.SOLID);
  console.log(`${L.name.padEnd(24)} reach ${seen.size}/${nodes.length}  ${report.join('  ')}  spikesOnGround:${spikesOk}`);
}
