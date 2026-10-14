// EMBERFALL Classic — level definitions (cursor-based segment DSL) and builder. Pure (no DOM).
//
// A level is a list of ground segments laid left to right:  [width, groundHeight, opts]
//   groundHeight = tiles of ground measured from the level bottom; 0 = pit.
// Everything in opts is positioned relative to the segment: dx = tiles from its left edge,
// up = tiles above its ground surface (for pits: above the previous segment's surface).
//   p:   [[dx, up, w]]                 one-way platforms
//   b:   [[dx, up, w, h]]              solid blocks (top at `up`, extending h down)
//   e:   [[type, dx, up=0]]            entities (feet at `up`; bats hang with their top at `up`)
//   c:   [[dx, up, n, 'a'?]]           row of n coins ('a' = arc)
//   s:   [[dx, n, up=0]]               spikes
//   mp:  [[dx, up, w, 'h'|'v', range, speed]]  moving platforms
//   liq: 1                             pit is filled with the world's liquid
//   gap: n                             ceiling n tiles above the ground (cave/castle)
//   arena: 1                           boss arena (camera locks to this segment)
export const HT = 24;

const WOODS = {
  name: 'WHISPERING WOODS', world: 0, liquid: 'water', music: 'woods',
  segs: [
    [12, 6, { c: [[6, 1, 4]] }],
    [7, 7, { e: [['slime', 4]], c: [[2, 3, 3]] }],
    [3, 0, { liq: 1, c: [[0, 3, 3, 'a']] }],
    [10, 7, { e: [['plant', 7]], p: [[2, 3, 4]], c: [[2, 4, 4]] }],
    [5, 9, { e: [['slime', 3]], c: [[1, 1, 3]] }],
    [8, 11, { e: [['chest', 5], ['bat', 2, 3]], p: [[1, 4, 3]], c: [[1, 5, 3]] }],
    [4, 0, { liq: 1, c: [[0, 2, 4, 'a']] }],
    [12, 8, { e: [['shrine', 2], ['slime', 8], ['heart', 10, 6]], p: [[5, 3, 3], [9, 5, 3]], c: [[5, 4, 3]] }],
    [6, 6, { e: [['slime', 3]], c: [[1, 1, 4]] }],
    [5, 0, { liq: 1, mp: [[0, 0, 2, 'h', 3, 0.5]], c: [[1, 2, 3]] }],
    [14, 6, { e: [['merchant', 4], ['plant', 11]], p: [[7, 3, 3]], c: [[7, 4, 3]] }],
    [4, 8, { c: [[1, 1, 2]] }],
    [4, 10, { e: [['bat', 1, 5]], c: [[1, 1, 2]] }],
    [10, 12, { e: [['skel', 5], ['chest', 8]], c: [[2, 1, 5]] }],
    [3, 0, { liq: 1, c: [[0, 2, 3, 'a']] }],
    [8, 12, { e: [['rune', 2, 9], ['bat', 6, 5], ['gem', 6, 7]], p: [[1, 3, 3], [5, 6, 3], [1, 9, 3]], c: [[1, 4, 3], [5, 7, 3]] }],
    [6, 9, { e: [['slime', 3]] }],
    [10, 6, { e: [['shrine', 2], ['slime', 6], ['plant', 8]], c: [[3, 1, 5]] }],
    [4, 0, { liq: 1, p: [[1, 1, 2]], c: [[1, 3, 2]] }],
    [9, 7, { e: [['skel', 6]], s: [[3, 2]], c: [[2, 3, 4, 'a']] }],
    [3, 0, { liq: 1 }],
    [5, 8, { e: [['slime', 2]], c: [[1, 1, 3]] }],
    [3, 0, { liq: 1, c: [[0, 3, 3, 'a']] }],
    [5, 9, { e: [['bat', 2, 5], ['plant', 3]] }],
    [4, 0, { liq: 1, mp: [[1, 0, 2, 'v', 3, 0.4]], c: [[1, 3, 2]] }],
    [14, 10, { e: [['skel', 8], ['chest', 12], ['heart', 4, 7]], p: [[2, 3, 3], [6, 6, 3]], c: [[2, 4, 3], [6, 7, 3]] }],
    [6, 8, { e: [['slime', 3]], c: [[1, 1, 4]] }],
    [14, 6, { e: [['portal', 9], ['bat', 3, 6]], c: [[2, 1, 4]] }],
    [3, 9, {}],
  ],
};

const HOLLOW = {
  name: 'CRYSTAL HOLLOW', world: 1, liquid: 'water', music: 'cave', gap: 9,
  segs: [
    [10, 8, { gap: 6, c: [[5, 1, 4]] }],
    [6, 8, { e: [['slime', 3]], c: [[1, 3, 3, 'a']] }],
    [4, 6, { c: [[1, 1, 2]] }],
    [3, 0, { liq: 1, c: [[0, 3, 3, 'a']] }],
    [8, 6, { e: [['plant', 5], ['bat', 2, 9]], c: [[1, 1, 3]] }],
    [5, 8, { e: [['slime', 2]] }],
    [6, 10, { gap: 7, e: [['skel', 3]], c: [[1, 1, 4]] }],
    [5, 0, { liq: 1, mp: [[0, 0, 2, 'h', 3, 0.5]], c: [[1, 2, 3]] }],
    [10, 10, { e: [['shrine', 2], ['chest', 7], ['bat', 5, 9]], c: [[3, 1, 3]] }],
    [4, 7, { e: [['slime', 2]] }],
    [12, 4, { gap: 13, e: [['rune', 3, 9], ['bat', 9, 7], ['plant', 9], ['gem', 8, 6]], p: [[2, 3, 3], [7, 5, 3], [2, 8, 3]], c: [[2, 4, 3], [7, 6, 3]] }],
    [5, 6, { e: [['slime', 2]], c: [[1, 1, 3]] }],
    [4, 0, { liq: 1, p: [[1, 0, 2]], c: [[1, 2, 2]] }],
    [10, 7, { e: [['merchant', 5], ['heart', 8, 4]], c: [[1, 1, 2]] }],
    [6, 9, { gap: 6, e: [['slime', 3]], s: [[4, 2]], c: [[0, 3, 4, 'a']] }],
    [8, 11, { gap: 6, e: [['bat', 3, 6], ['skel', 5]], c: [[2, 1, 4]] }],
    [3, 0, { liq: 1, c: [[0, 2, 3, 'a']] }],
    [8, 11, { e: [['shrine', 2], ['plant', 6]], p: [[4, 3, 3]], c: [[4, 4, 3]] }],
    [5, 8, { e: [['slime', 2], ['bat', 3, 9]] }],
    [6, 0, { liq: 1, mp: [[0, 0, 2, 'h', 4, 0.6]], gap: 9, c: [[1, 2, 4]] }],
    [10, 6, { e: [['plant', 4], ['skel', 7]], s: [[1, 2]], c: [[4, 1, 4]] }],
    [4, 8, { e: [['bat', 2, 9]] }],
    [4, 10, { c: [[1, 1, 2]] }],
    [10, 12, { gap: 7, e: [['skel', 4], ['chest', 8], ['heart', 6, 4]], c: [[1, 1, 3]] }],
    [4, 0, { liq: 1, mp: [[1, -1, 2, 'v', 3, 0.4]] }],
    [6, 10, { e: [['slime', 3], ['gem', 3, 4]] }],
    [14, 7, { e: [['portal', 9], ['bat', 4, 9], ['slime', 5]], c: [[1, 1, 4]] }],
    [3, 20, {}],
  ],
};

const KEEP = {
  name: 'ASHEN KEEP', world: 2, liquid: 'lava', music: 'keep',
  segs: [
    [12, 6, { e: [['torch', 5, 2], ['torch', 10, 2]], c: [[6, 1, 4]] }],
    [6, 8, { e: [['skel', 3]], c: [[1, 1, 3]] }],
    [3, 0, { liq: 1, c: [[0, 3, 3, 'a']] }],
    [8, 8, { e: [['wisp', 5, 4], ['torch', 6, 2]], s: [[3, 2]], c: [[2, 3, 4, 'a']] }],
    [5, 10, { e: [['bat', 2, 5]], c: [[1, 1, 3]] }],
    [4, 0, { liq: 1, mp: [[0, 0, 2, 'h', 2, 0.5]], c: [[1, 2, 2]] }],
    [10, 10, { gap: 7, e: [['skel', 5], ['chest', 8], ['torch', 2, 2], ['torch', 7, 2]], c: [[2, 1, 4]] }],
    [6, 7, { gap: 10, e: [['slime', 3], ['torch', 4, 2]] }],
    [5, 0, { liq: 1, p: [[1, 1, 1], [3, 2, 1]], c: [[1, 3, 1], [3, 4, 1]] }],
    [10, 7, { e: [['shrine', 2], ['wisp', 7, 5], ['heart', 6, 5]], p: [[5, 3, 3]], c: [[5, 4, 3]] }],
    [5, 9, { e: [['slime', 2], ['torch', 3, 2]] }],
    [5, 11, { e: [['bat', 2, 5]], c: [[1, 1, 3]] }],
    [10, 13, { e: [['skel', 4], ['skel', 8], ['gem', 5, 4]], c: [[2, 1, 5]] }],
    [3, 0, { liq: 1, c: [[0, 2, 3, 'a']] }],
    [6, 13, { e: [['wisp', 3, 4], ['chest', 3]] }],
    [8, 10, { e: [['slime', 4], ['torch', 2, 2], ['torch', 6, 2]], s: [[5, 2]] }],
    [5, 0, { liq: 1, mp: [[1, 0, 3, 'v', 3, 0.4]], c: [[1, 4, 3]] }],
    [12, 7, { e: [['merchant', 4], ['shrine', 9], ['torch', 7, 2]], c: [[1, 1, 2]] }],
    [6, 9, { s: [[2, 2]], e: [['bat', 1, 5]] }],
    [4, 0, { liq: 1, c: [[0, 3, 4, 'a']] }],
    [10, 9, { gap: 6, e: [['skel', 3], ['skel', 7], ['torch', 5, 2]], c: [[2, 1, 5]] }],
    [6, 6, { e: [['wisp', 3, 5], ['heart', 3, 3]], p: [[2, 2, 2]] }],
    [3, 0, { liq: 1, c: [[0, 3, 3, 'a']] }],
    [8, 6, { e: [['shrine', 3], ['torch', 1, 2], ['torch', 6, 2]], c: [[4, 1, 3]] }],
    [24, 4, { arena: 1, gap: 11, e: [['boss', 12, 3], ['portal', 20], ['torch', 2, 3], ['torch', 8, 3], ['torch', 15, 3], ['torch', 21, 3]], p: [[3, 3, 4], [17, 3, 4]] }],
    [3, 18, {}],
  ],
};

export const LEVEL_DEFS = [WOODS, HOLLOW, KEEP];

export function buildLevel(index) {
  const def = LEVEL_DEFS[index];
  const w = def.segs.reduce((a, s) => a + s[0], 0), h = HT;
  const tiles = new Uint8Array(w * h), liquid = new Uint8Array(w * h);
  const lv = {
    index, w, h, tiles, liquid, name: def.name, world: def.world, liquidType: def.liquid, music: def.music,
    ents: [], coins: [], plats: [], liquidRuns: [], start: null, arena: null,
  };
  const set = (x, y, v) => { if (x >= 0 && x < w && y >= 0 && y < h) tiles[y * w + x] = v; };
  let x = 0, prevTop = HT - def.segs[0][1];
  const pits = [], tops = [];
  for (const [sw, sh, o = {}] of def.segs) {
    const pit = sh === 0;
    const top = pit ? prevTop : HT - sh;
    tops.push({ x, w: sw, top, pit });
    if (!pit) for (let i = 0; i < sw; i++) for (let y = top; y < h; y++) set(x + i, y, 1);
    else if (o.liq) pits.push({ x, w: sw, i: tops.length - 1 });
    const gap = o.gap ?? def.gap;
    if (gap) for (let i = 0; i < sw; i++) for (let y = 0; y < top - gap; y++) set(x + i, y, 1);
    for (const [dx, up, pw] of o.p || []) for (let i = 0; i < pw; i++) set(x + dx + i, top - up, 2);
    for (const [dx, up, bw, bh = 1] of o.b || []) for (let i = 0; i < bw; i++) for (let j = 0; j < bh; j++) set(x + dx + i, top - up + j, 1);
    for (const [dx, n, up = 0] of o.s || []) for (let i = 0; i < n; i++) set(x + dx + i, top - up - 1, 3);
    for (const [dx, up, n, arc] of o.c || []) {
      for (let i = 0; i < n; i++) {
        const a = arc ? Math.sin(((i + 0.5) / n) * Math.PI) * 20 : 0;
        lv.coins.push({ x: (x + dx + i + 0.5) * 16, y: (top - up + 0.5) * 16 - a });
      }
    }
    for (const [dx, up, pw, axis, range, speed] of o.mp || []) {
      lv.plats.push({ x: (x + dx) * 16, y: (top - up) * 16, w: pw * 16, axis, range: range * 16, speed });
    }
    for (const [type, dx, up = 0] of o.e || []) {
      lv.ents.push({ type, x: (x + dx + 0.5) * 16, y: (top - up) * 16 });
    }
    if (o.arena) lv.arena = { x0: x * 16, x1: (x + sw) * 16, floor: top * 16 };
    if (!lv.start) lv.start = { x: (x + 2.5) * 16, y: top * 16 };
    if (!pit) prevTop = top;
    x += sw;
  }
  for (const p of pits) {
    const l = tops[p.i - 1], r = tops[p.i + 1];
    const surf = Math.max(l ? l.top : 0, r ? r.top : 0) + 1;
    for (let i = 0; i < p.w; i++) for (let y = surf; y < h; y++) liquid[y * w + p.x + i] = 1;
    lv.liquidRuns.push({ x: p.x * 16, w: p.w * 16, y: surf * 16, h: (h - surf) * 16 });
  }
  lv.tops = tops;
  return lv;
}
