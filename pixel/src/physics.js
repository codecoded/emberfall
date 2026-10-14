// EMBERFALL Classic — tile physics shared by entities and the reachability checker. Pure (no DOM).
export const TS = 16;
export const PHYS = { RUN: 1.9, ACC: 0.32, GRAV: 0.28, JUMP: 6.0, MAXFALL: 6.5, COYOTE: 6, BUFFER: 7 };

export function tileAt(lv, tx, ty) {
  if (tx < 0 || tx >= lv.w) return 1;
  if (ty < 0 || ty >= lv.h) return 0;
  return lv.tiles[ty * lv.w + tx];
}
export const solidAt = (lv, tx, ty) => tileAt(lv, tx, ty) === 1;
export const solidPx = (lv, x, y) => tileAt(lv, Math.floor(x / TS), Math.floor(y / TS)) === 1;
export function liquidAt(lv, x, y) {
  const tx = Math.floor(x / TS), ty = Math.floor(y / TS);
  if (tx < 0 || tx >= lv.w || ty < 0 || ty >= lv.h) return false;
  return lv.liquid[ty * lv.w + tx] === 1;
}

// Move body {x,y,w,h,vx,vy,drop} against the tile grid. Sets onGround/hitWall/hitCeil/onOneWay.
export function moveBody(lv, b) {
  b.onGround = false; b.hitWall = 0; b.hitCeil = false; b.onOneWay = false;
  // --- X ---
  if (b.vx !== 0) {
    let nx = b.x + b.vx;
    const y0 = Math.floor(b.y / TS), y1 = Math.floor((b.y + b.h - 0.01) / TS);
    if (b.vx > 0) {
      const tx = Math.floor((nx + b.w - 0.01) / TS);
      for (let ty = y0; ty <= y1; ty++) if (solidAt(lv, tx, ty)) { nx = tx * TS - b.w; b.hitWall = 1; b.vx = 0; break; }
    } else {
      const tx = Math.floor(nx / TS);
      for (let ty = y0; ty <= y1; ty++) if (solidAt(lv, tx, ty)) { nx = (tx + 1) * TS; b.hitWall = -1; b.vx = 0; break; }
    }
    b.x = nx;
  }
  // --- Y ---
  let ny = b.y + b.vy;
  const x0 = Math.floor(b.x / TS), x1 = Math.floor((b.x + b.w - 0.01) / TS);
  if (b.vy >= 0) {
    const ob = b.y + b.h, nb = ny + b.h;
    const ty = Math.floor((nb - 0.01) / TS);
    for (let tx = x0; tx <= x1; tx++) {
      const t = tileAt(lv, tx, ty);
      if (t === 1 || (t === 2 && !b.drop && ob <= ty * TS + 0.01)) {
        ny = ty * TS - b.h; b.vy = 0; b.onGround = true;
        if (t === 2) b.onOneWay = true;
      }
    }
    if (b.onGround) { // onOneWay only if no solid support
      for (let tx = x0; tx <= x1; tx++) if (tileAt(lv, tx, ty) === 1) b.onOneWay = false;
    }
  } else {
    const ty = Math.floor(ny / TS);
    for (let tx = x0; tx <= x1; tx++) if (solidAt(lv, tx, ty)) { ny = (ty + 1) * TS; b.vy = 0; b.hitCeil = true; break; }
  }
  b.y = ny;
}

export const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
