// Levels are authored as a left-to-right run of ground segments:
//   [width, groundHeight, { ...things positioned relative to the segment }]
// groundHeight 0 is a pit. Item positions are [dx, up] = tiles from the segment's left edge / above its ground.
export const TILE = { AIR: 0, SOLID: 1, ONEWAY: 2, SPIKE: 3 };
export const PAD = 16;

const DEFS = [
  {
    name: 'Whispering Woods', theme: 'woods', music: 'woods', liquidY: 3.4,
    segs: [
      [14, 6, { e: [['sign', 8, 0, { text: 'Arrows / WASD to move · Space to jump · X to swing your blade' }]] }],
      [6, 7, { coins: [[1, 1.5, 4]] }],
      [9, 6, { e: [['slime', 5]] }],
      [4, 0, { liquid: 1, arc: [0, 1.5, 4] }],
      [10, 6, { e: [['slime', 6], ['chest', 8.5]], p: [[2, 3, 3]], coins: [[2, 4.2, 3]] }],
      [4, 8, {}],
      [4, 10, { coins: [[1, 1.5, 2]] }],
      [10, 8, { e: [['bat', 5, 5], ['plant', 8]] }],
      [3, 0, { liquid: 1 }],
      [9, 7, { e: [['shrine', 2], ['merchant', 6], ['sign', 4, 0, { text: 'Press Up beside the merchant to trade' }]] }],
      [6, 0, { liquid: 1, mp: [[0.5, 0, 2.5, 'x', 3, 2.2]], arc: [1, 2, 4] }],
      [12, 7, { e: [['slime', 3], ['skel', 8]], coins: [[8, 1.5, 3]] }],
      [18, 6, { p: [[2, 3, 3], [7, 6, 3], [12, 9, 5, 'solid']], e: [['rune', 14, 10.4], ['bat', 9, 10], ['plant', 16], ['sign', 1, 0, { text: 'The Rune Stone lies above. The portal will not open without it.' }]], coins: [[2, 4.2, 3], [7, 7.2, 3]] }],
      [3, 0, { liquid: 1 }],
      [5, 8, { coins: [[1, 1.5, 3]] }],
      [5, 10, { e: [['slime', 2]] }],
      [4, 12, { e: [['chest', 2]] }],
      [3, 0, { liquid: 1, ref: 9 }],
      [12, 8, { e: [['skel', 4], ['bat', 9, 5]], spikes: [[8, 2]] }],
      [5, 0, { liquid: 1, p: [[1, 0, 3]] }],
      [8, 8, { e: [['shrine', 2], ['heart', 5, 1.5]] }],
      [14, 7, { e: [['skel', 5], ['skel', 10], ['plant', 12.5]], p: [[3, 3, 3], [8, 3, 3]], coins: [[3, 4.2, 3], [8, 4.2, 3]] }],
      [14, 7, { e: [['portal', 8]] }],
    ],
  },
  {
    name: 'Crystal Hollow', theme: 'hollow', music: 'hollow', liquidY: 3.4, c: 8,
    segs: [
      [12, 5, { c: 8, e: [['sign', 6, 0, { text: 'The Hollow is dark. Let the crystals light your way.' }]] }],
      [8, 6, { c: 9, e: [['slime', 5]], coins: [[1, 1.5, 4]] }],
      [4, 0, { c: 8, liquid: 1, arc: [0, 1.5, 4] }],
      [8, 6, { c: 10, e: [['bat', 4, 5], ['chest', 6]] }],
      [5, 8, { c: 8 }],
      [5, 10, { c: 7, e: [['plant', 3]] }],
      [4, 0, { c: 7, liquid: 1, ref: 10, p: [[1, -1, 2]] }],
      [10, 8, { c: 8, e: [['skel', 6]], coins: [[2, 1.5, 5]] }],
      [8, 6, { c: 9, e: [['shrine', 2], ['merchant', 5.5]] }],
      [6, 0, { c: 8, liquid: 1, mp: [[0.5, 0, 2.5, 'x', 3, 2.4]] }],
      [6, 6, { c: 9, e: [['slime', 3]] }],
      [5, 0, { c: 7, liquid: 1, mp: [[1, 0, 3, 'y', 4, 1.8]] }],
      [10, 10, { c: 6, e: [['skel', 6], ['bat', 8, 3.5]], spikes: [[2, 2]] }],
      [16, 7, { c: 6, p: [[2, 3, 3], [7, 6, 3], [11, 3, 3]], e: [['rune', 8.5, 7.5], ['plant', 14], ['slime', 5]], coins: [[11, 4.2, 3], [2, 4.2, 3]] }],
      [3, 0, { c: 7, liquid: 1 }],
      [8, 7, { c: 9, e: [['bat', 3, 5], ['bat', 6, 5]], coins: [[1, 1.5, 5]] }],
      [4, 9, { c: 8, e: [['chest', 2]] }],
      [4, 0, { c: 8, liquid: 1, ref: 9, arc: [0, 1.5, 4] }],
      [10, 8, { c: 8, e: [['skel', 3], ['plant', 8.5]], spikes: [[5, 2]] }],
      [5, 0, { c: 8, liquid: 1, p: [[1, 0, 3]] }],
      [8, 8, { c: 9, e: [['shrine', 2], ['heart', 5, 1.5]] }],
      [12, 6, { c: 8, e: [['skel', 4], ['skel', 9]], p: [[5, 3, 3]], coins: [[5, 4.2, 3]] }],
      [14, 6, { c: 7, e: [['portal', 8]] }],
    ],
  },
  {
    name: 'Ashen Keep', theme: 'keep', music: 'keep', liquidY: 3.4,
    segs: [
      [12, 6, { e: [['sign', 6, 0, { text: 'Beyond the Keep the Sorcerer waits. Spend your gold wisely.' }]] }],
      [6, 7, { e: [['slime', 3]] }],
      [3, 0, { liquid: 1 }],
      [8, 7, { e: [['skel', 5]], coins: [[1, 1.5, 4]] }],
      [4, 9, {}],
      [4, 11, { e: [['plant', 2]] }],
      [5, 0, { liquid: 1, ref: 11, p: [[1, -1, 3]] }],
      [10, 9, { e: [['wisp', 6, 3], ['chest', 7.5]], spikes: [[2, 2]] }],
      [6, 0, { liquid: 1, mp: [[0.5, 0, 2.5, 'x', 3, 2.6]] }],
      [9, 9, { e: [['shrine', 2], ['merchant', 6]] }],
      [4, 0, { liquid: 1, arc: [0, 1.5, 4] }],
      [12, 8, { e: [['skel', 4], ['skel', 9], ['bat', 6, 5]] }],
      [5, 0, { liquid: 1, mp: [[1, 0, 3, 'y', 4, 2.0]] }],
      [6, 12, { e: [['wisp', 3, 3]], coins: [[1, 1.5, 4]] }],
      [16, 8, { p: [[2, 3, 3], [7, 6, 3], [11, 3, 3]], e: [['rune', 8.5, 7.5], ['skel', 5], ['plant', 14.5]], spikes: [[9, 2]], coins: [[2, 4.2, 3], [11, 4.2, 3]] }],
      [4, 0, { liquid: 1, p: [[1, 0, 2]] }],
      [8, 8, { e: [['wisp', 4, 3], ['slime', 5]] }],
      [4, 10, { e: [['chest', 2]] }],
      [3, 0, { liquid: 1, ref: 10 }],
      [8, 8, { e: [['shrine', 2], ['heart', 5, 1.5]] }],
      [10, 7, { e: [['skel', 4], ['wisp', 7, 3]] }],
      [14, 7, { e: [['portal', 8]] }],
    ],
  },
  {
    name: "The Sorcerer's Sanctum", theme: 'keep', music: 'boss', liquidY: 1.5, arena: true,
    segs: [
      [4, 15, {}],
      [8, 6, { e: [['heart', 4, 1.5]] }],
      [30, 6, { p: [[5, 3, 4], [21, 3, 4]], e: [['boss', 15, 3.5]] }],
      [8, 6, {}],
      [4, 15, {}],
    ],
  },
];

export function buildLevel(index) {
  const def = DEFS[index];
  const H = 26;
  const segs = def.segs;
  const first = segs[0], last = segs[segs.length - 1];
  const all = [[PAD, first[1], { c: first[2].c, pad: 1 }], ...segs, [PAD, last[1], { c: last[2].c, pad: 1 }]];
  const cols = [], ents = [], plats = [], movers = [], spikes = [];
  let x = 0, lastG = first[1];
  for (const [w, g, o = {}] of all) {
    const ref = g > 0 ? g : (o.ref ?? lastG);
    for (let i = 0; i < w; i++) cols.push({ g: g > 0 ? g : 1, pit: g === 0, c: o.c ?? def.c ?? 0, liquid: !!o.liquid });
    for (const [dx, up, pw, type = 'ow'] of o.p || []) plats.push({ x: x + dx, y: ref + up, w: pw, type });
    for (const [type, dx, up = 0, extra] of o.e || []) ents.push({ type, x: x + dx + 0.5, y: ref + up, ...extra });
    for (const [dx, up, n = 1] of o.coins || []) for (let i = 0; i < n; i++) ents.push({ type: 'coin', x: x + dx + i + 0.5, y: ref + up });
    if (o.arc) { const [dx, up, n] = o.arc; for (let i = 0; i < n; i++) { const t = n > 1 ? i / (n - 1) : 0.5; ents.push({ type: 'coin', x: x + dx + (w - 2 * dx) * t * 0.999 + 0.0, y: ref + up + Math.sin(t * Math.PI) * 1.6 }); } }
    for (const [dx, sw] of o.spikes || []) for (let i = 0; i < sw; i++) spikes.push({ x: x + dx + i, y: ref });
    for (const [dx, up, mw, axis, range, speed] of o.mp || []) movers.push({ x0: x + dx, y0: ref + up, w: mw, axis, range, speed });
    if (g > 0) lastG = g;
    x += w;
  }
  const W = x;
  const tiles = new Uint8Array(W * H), thin = new Uint8Array(W * H);
  for (let cx = 0; cx < W; cx++) {
    const c = cols[cx];
    for (let y = 0; y < c.g; y++) tiles[y * W + cx] = TILE.SOLID;
    for (let y = H - c.c; y < H && c.c > 0; y++) tiles[y * W + cx] = TILE.SOLID;
  }
  for (const p of plats) for (let i = 0; i < p.w; i++) {
    const k = (p.y - 1) * W + p.x + i;
    tiles[k] = p.type === 'solid' ? TILE.SOLID : TILE.ONEWAY;
    thin[k] = 1;
  }
  for (const s of spikes) tiles[s.y * W + s.x] = TILE.SPIKE;
  return {
    index, def, name: def.name, theme: def.theme, music: def.music, arena: !!def.arena, liquidY: def.liquidY,
    W, H, tiles, thin, cols, ents, movers, spikes, plats,
    minX: PAD, maxX: W - PAD, start: { x: PAD + 2.5, y: first[1] },
    tile(tx, ty) { if (tx < 0 || tx >= W || ty < 0) return TILE.SOLID; if (ty >= H) return TILE.AIR; return tiles[ty * W + tx]; },
    solid(tx, ty) { return this.tile(tx, ty) === TILE.SOLID; },
    groundAt(xf) { const c = cols[Math.max(0, Math.min(W - 1, Math.floor(xf)))]; return c.pit ? 0 : c.g; },
  };
}

export const LEVEL_COUNT = DEFS.length;
