// Builds the 3D world for a level: sky, terrain mesh, rolling backdrop, scattered props, liquid, lights and ambience.
import * as THREE from 'three';
import { TILE } from './levels.js';
import { instanced, makeProp } from './assets.js';
import { softTexture } from './fx.js';

const C = (h) => new THREE.Color(h);
export const ZF = 1.5, ZB = -7;

export const THEMES = {
  woods: {
    sky: ['#ffd9a0', '#ff9668', '#c44f7c', '#55308a', '#1a1546'], sun: { pos: [0.7, 0.34], color: '#fff0c8', size: 0.05 }, stars: 0.9, clouds: 0.55,
    fog: ['#e8958c', 0.0072], hemi: ['#ffd2b4', '#3d2b5e', 1.15], key: ['#ffc88e', 3.0, [-0.55, 0.62, 0.6]], rim: ['#ff7a8a', 1.1],
    top: ['#63c24c', '#93da5c', '#409c4b'], lip: '#2f7f42', dirt: ['#8c5c3d', '#6b4131'], rock: ['#5b4b60', '#372e47'], grass: true,
    liquid: { shallow: '#4fc3d0', deep: '#1c4a8c', spark: '#fff2d0', glow: 1.0, opacity: 0.86 },
    trees: ['tree_green1', 'tree_green2', 'tree_autumn', 'tree_blossom', 'tree_green1', 'pine'], farTrees: ['tree_green1', 'tree_green2', 'tree_autumn', 'pine', 'pine', 'tree_blossom'],
    mountains: ['mountain_a', 'mountain_b'], cloudTint: '#ffb9a4', bloom: [0.5, 0.7, 0.88], exposure: 1.0, mist: '#ffb89a',
    backTop: ['#58b04c', '#86cf5a', '#3f8f4c'], backRock: '#6a5670',
  },
  hollow: {
    sky: ['#0d2236', '#0a1a2e', '#070f20', '#050914', '#03050c'], sun: { pos: [0.5, 0.6], color: '#000000', size: 0.01 }, stars: 0, clouds: 0,
    fog: ['#0b2136', 0.017], hemi: ['#5f8fd0', '#0a0a1e', 0.62], key: ['#8fbcff', 1.25, [-0.4, 0.75, 0.55]], rim: ['#59e8ff', 0.7],
    top: ['#2f8a7a', '#43b08c', '#256a6c'], lip: '#1c5f62', dirt: ['#3d4c80', '#2b3564'], rock: ['#242b56', '#131733'], grass: false,
    liquid: { shallow: '#3ff0dc', deep: '#0a3c60', spark: '#c8fff4', glow: 0.95, opacity: 0.9 },
    trees: ['shroom_giant', 'crystal_cyan', 'crystal_violet', 'stalagmite', 'stalagmite'], farTrees: ['stalagmite', 'crystal_cyan', 'shroom_giant', 'crystal_violet'],
    mountains: [], cave: true, playerLight: ['#ffdcae', 26, 13], bloom: [0.5, 0.7, 0.86], exposure: 1.15, mist: '#2a7fb0',
    backTop: ['#27706c', '#35907c', '#1f5560'], backRock: '#1c2248',
  },
  keep: {
    sky: ['#ff8a3c', '#d43b2a', '#6a1634', '#220c22', '#07030b'], sun: { pos: [0.3, 0.3], color: '#ff6a30', size: 0.11 }, stars: 0.6, clouds: 0.8,
    fog: ['#5e1d27', 0.0085], hemi: ['#ffa27e', '#1d0a15', 0.85], key: ['#ffb486', 2.5, [-0.5, 0.62, 0.62]], rim: ['#ff4a2a', 1.3],
    top: ['#5c566b', '#736d86', '#474153'], lip: '#373144', dirt: ['#3c2d39', '#2c2030'], rock: ['#1f1722', '#120c15'], grass: false,
    liquid: { shallow: '#ffb02e', deep: '#e0260c', spark: '#fff6a0', glow: 2.4, opacity: 1.0 },
    trees: ['tree_dead', 'tree_ember', 'pillar', 'pillar_broken', 'tree_dead'], farTrees: ['tree_dead', 'tree_ember', 'tree_dead', 'rock_dark'],
    mountains: ['mountain_dark', 'volcano'], cloudTint: '#7a2a30', bloom: [0.7, 0.75, 0.8], exposure: 1.0, mist: '#b03a2a',
    backTop: ['#4a4456', '#5c566b', '#3a3446'], backRock: '#241a26',
  },
};

// ---------------------------------------------------------------- noise
function h3(a, b, c) {
  let h = (Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ Math.imul(c | 0, 83492791)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, s = 7) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = h3(xi, yi, s), b = h3(xi + 1, yi, s), c = h3(xi, yi + 1, s), d = h3(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

class Geo {
  constructor() { this.p = []; this.c = []; }
  tri(a, b, c, col, vary = 0.07) {
    const k = 1 + (h3(a.x * 31 + b.y * 17, c.z * 13 + a.y * 7, b.x * 5 + c.y * 3) - 0.5) * 2 * vary;
    this.p.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let i = 0; i < 3; i++) this.c.push(col.r * k, col.g * k, col.b * k);
  }
  mesh(mat) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeVertexNormals();
    return new THREE.Mesh(g, mat);
  }
}

// --------------------------------------------------------------- terrain
function buildTerrain(L, T) {
  const geo = new Geo();
  const top = T.top.map(C), lip = C(T.lip), dirt = T.dirt.map(C), rock = T.rock.map(C);
  const solid = (x, y) => L.tile(Math.max(0, Math.min(L.W - 1, x)), y) === TILE.SOLID;
  const thin = (x, y) => x >= 0 && x < L.W && y >= 0 && y < L.H && L.thin[y * L.W + x] === 1;
  const tmp = new THREE.Color();
  const jv = (x, y, z) => {
    const a = Math.round(x * 2), b = Math.round(y * 2), c = Math.round(z * 10);
    const front = z >= ZF - 0.01;
    return new THREE.Vector3(x + (h3(a, b, c) - 0.5) * 0.14, y + (h3(a + 91, b, c) - 0.5) * 0.12, z + (h3(a, b + 57, c) - 0.5) * (front ? 0.5 : 0.22));
  };
  const grid = (P, us, vs, colFn) => {
    for (let i = 0; i < us.length - 1; i++) for (let j = 0; j < vs.length - 1; j++) {
      const a = jv(...P(us[i], vs[j])), b = jv(...P(us[i + 1], vs[j])), c = jv(...P(us[i + 1], vs[j + 1])), d = jv(...P(us[i], vs[j + 1]));
      const col = colFn((us[i] + us[i + 1]) / 2, (vs[j] + vs[j + 1]) / 2);
      if (h3(i + a.x * 9, j + a.y * 9, 3) > 0.5) { geo.tri(a, b, c, col); geo.tri(a, c, d, col); } else { geo.tri(a, b, d, col); geo.tri(b, c, d, col); }
    }
  };
  const topY = (x, y) => { let t = y; while (t < L.H && solid(x, t)) t++; return t; };
  const sideCol = (x, yy, ty, isCeil) => {
    const depth = ty - yy;
    if (!isCeil && depth < 0.5) return tmp.copy(lip).lerp(top[2], vnoise(x * 1.7, yy * 1.7)).clone();
    const n = vnoise(x * 0.9, yy * 1.3, 11);
    if (!isCeil && depth < 2.4) return tmp.copy(dirt[0]).lerp(dirt[1], n * 0.7 + depth * 0.12).clone();
    return tmp.copy(rock[0]).lerp(rock[1], Math.min(1, n * 0.6 + Math.max(0, depth - 2.4) * 0.09)).clone();
  };
  const HALF = [0, 0.5, 1];
  for (let x = 0; x < L.W; x++) for (let y = 0; y < L.H; y++) {
    if (!solid(x, y)) continue;
    const th = thin(x, y), zb = th ? -1.5 : ZB;
    const zs = th ? [ZF, 0.5, -0.5, -1.5] : [ZF, 0.7, -0.7, -2.4, -4.6, ZB];
    const zu = zs.map((z) => (z - ZF) / (zb - ZF));
    const ty = topY(x, y), isCeil = ty >= L.H && !th;
    const up = !solid(x, y + 1), dn = y > 0 && !solid(x, y - 1), lf = !solid(x - 1, y), rt = !solid(x + 1, y);
    grid((u, v) => [x + u, y + v, ZF], HALF, HALF, (u, v) => sideCol(x + u, y + v, ty, isCeil));
    if (up) {
      grid((u, v) => [x + u, y + 1, ZF + (zb - ZF) * v], HALF, zu, (u, v) => {
        const z = ZF + (zb - ZF) * v, n = vnoise((x + u) * 0.45, z * 0.45, 3), n2 = vnoise((x + u) * 1.9, z * 1.9, 5);
        return tmp.copy(top[0]).lerp(top[1], n).lerp(top[2], n2 * 0.45).clone();
      });
      if (T.grass) for (let k = 0; k < 3; k++) { // little overhanging tufts along the front lip
        const u0 = k / 3 + h3(x, y, k) * 0.1, w = 0.18 + h3(x, y, k + 9) * 0.14, len = 0.14 + h3(x, k, y) * 0.3;
        const a = new THREE.Vector3(x + u0, y + 1.02, ZF + 0.26), b = new THREE.Vector3(x + u0 + w, y + 1.02, ZF + 0.26), c = new THREE.Vector3(x + u0 + w / 2, y + 1 - len, ZF + 0.3);
        geo.tri(a, c, b, top[k % 3], 0.1);
      }
    }
    if (rt) grid((u, v) => [x + 1, y + v, ZF + (zb - ZF) * u], zu, HALF, (u, v) => sideCol(x + 1, y + v, ty, isCeil).multiplyScalar(0.8));
    if (lf) grid((u, v) => [x, y + v, zb + (ZF - zb) * u], zu.map((t) => 1 - t).reverse(), HALF, (u, v) => sideCol(x, y + v, ty, isCeil).multiplyScalar(0.92));
    if (dn) grid((u, v) => [x + u, y, zb + (ZF - zb) * v], HALF, zu.map((t) => 1 - t).reverse(), () => tmp.copy(rock[1]).multiplyScalar(0.8).clone());
  }
  const mesh = geo.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 }));
  mesh.receiveShadow = true; mesh.castShadow = true;
  return mesh;
}

// -------------------------------------------------------------- backdrop
function makeProfile(L) {
  const raw = L.cols.map((c) => (c.pit ? L.liquidY - 1.8 : c.g));
  return (x) => {
    let s = 0, n = 0;
    for (let i = -3; i <= 3; i++) { const k = Math.max(0, Math.min(L.W - 1, Math.round(x) + i)); s += raw[k]; n++; }
    return s / n;
  };
}

function buildBackdrop(L, T, heightAt, depth) {
  const geo = new Geo();
  const top = T.backTop.map(C), rock = C(T.backRock), tmp = new THREE.Color();
  const x0 = -44, x1 = L.W + 44, NZ = 26;
  const zs = [];
  for (let k = 0; k <= NZ; k++) zs.push(ZB + 0.6 - depth * Math.pow(k / NZ, 1.7));
  const P = (x, k) => new THREE.Vector3(x + (h3(x, k, 1) - 0.5) * 0.5, heightAt(x, zs[k]) + (k === 0 ? -0.5 : 0), zs[k] + (k ? (h3(x, k, 2) - 0.5) * 0.6 : 0));
  for (let x = x0; x < x1; x += 2) for (let k = 0; k < NZ; k++) {
    const a = P(x, k), b = P(x + 2, k), c = P(x + 2, k + 1), d = P(x, k + 1);
    const slope = Math.abs(a.y - c.y) + Math.abs(b.y - d.y);
    const n = vnoise(x * 0.11, zs[k] * 0.11, 21);
    const col = tmp.copy(top[0]).lerp(top[1], n).lerp(top[2], vnoise(x * 0.4, zs[k] * 0.4, 22) * 0.5);
    if (slope > 3.4) col.lerp(rock, Math.min(1, (slope - 3.4) * 0.5));
    if ((a.y + c.y) / 2 < L.liquidY + 0.5) col.lerp(rock, 0.6);
    const cc = col.clone();
    geo.tri(a, b, c, cc); geo.tri(a, c, d, cc);
  }
  const mesh = geo.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
  mesh.receiveShadow = true;
  return mesh;
}

function buildCaveShell(L, T, depth) {
  const geo = new Geo();
  const rock = T.rock.map(C), tmp = new THREE.Color();
  const zBack = ZB - depth;
  const ceil = (x) => { const c = L.cols[Math.max(0, Math.min(L.W - 1, Math.round(x)))]; return L.H - c.c; };
  // ceiling sweeping back and down into the back wall
  for (let x = -44; x < L.W + 44; x += 2) {
    const rows = 9;
    for (let k = 0; k < rows; k++) {
      const P = (xx, kk) => {
        const t = kk / rows, z = ZB + 0.4 - depth * t;
        const y = ceil(xx) + 0.6 - t * t * 5 + (vnoise(xx * 0.2, z * 0.2, 31) - 0.5) * 3.2 * (kk ? 1 : 0);
        return new THREE.Vector3(xx + (h3(xx, kk, 4) - 0.5), y, z);
      };
      const a = P(x, k), b = P(x + 2, k), c = P(x + 2, k + 1), d = P(x, k + 1);
      const col = tmp.copy(rock[0]).lerp(rock[1], vnoise(x * 0.2, k * 0.6, 33)).clone();
      geo.tri(a, c, b, col); geo.tri(a, d, c, col);
    }
    // back wall
    for (let j = 0; j < 9; j++) {
      const P = (xx, jj) => new THREE.Vector3(xx + (h3(xx, jj, 6) - 0.5), jj * 3.4 - 2, zBack + (vnoise(xx * 0.15, jj * 0.5, 35) - 0.5) * 6);
      const a = P(x, j), b = P(x + 2, j), c = P(x + 2, j + 1), d = P(x, j + 1);
      const col = tmp.copy(rock[0]).lerp(rock[1], vnoise(x * 0.17, j * 0.7, 37)).multiplyScalar(0.8).clone();
      geo.tri(a, b, c, col); geo.tri(a, c, d, col);
    }
  }
  const mesh = geo.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
  mesh.receiveShadow = true;
  return mesh;
}

// -------------------------------------------------------------------- sky
function makeSky(T) {
  const mat = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, fog: false,
    uniforms: {
      c0: { value: C(T.sky[0]) }, c1: { value: C(T.sky[1]) }, c2: { value: C(T.sky[2]) }, c3: { value: C(T.sky[3]) }, c4: { value: C(T.sky[4]) },
      sunCol: { value: C(T.sun.color) }, sunPos: { value: new THREE.Vector2(...T.sun.pos) }, sunSize: { value: T.sun.size },
      stars: { value: T.stars }, cloudAmt: { value: T.clouds }, time: { value: 0 }, aspect: { value: 1.78 }, off: { value: new THREE.Vector2() },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      varying vec2 vUv; uniform vec3 c0,c1,c2,c3,c4,sunCol; uniform vec2 sunPos, off; uniform float sunSize, stars, cloudAmt, time, aspect;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*noise(p); p*=2.03; a*=.5; } return s; }
      void main(){
        float y = clamp(vUv.y + off.y, 0., 1.);
        vec3 col = y<.25? mix(c0,c1,y/.25) : y<.5? mix(c1,c2,(y-.25)/.25) : y<.75? mix(c2,c3,(y-.5)/.25) : mix(c3,c4,(y-.75)/.25);
        vec2 p = vec2((vUv.x-.5)*aspect, vUv.y);
        vec2 sp = vec2((sunPos.x-.5)*aspect - off.x, sunPos.y + off.y*0.6);
        float d = distance(p, sp);
        col += sunCol * (exp(-d*d/(sunSize*sunSize*22.))*0.5 + exp(-d*d/(sunSize*sunSize*160.))*0.22);
        col = mix(col, sunCol*2.2, smoothstep(sunSize, sunSize*0.94, d));
        float cl = fbm(vec2(p.x*1.3 + off.x*3. + time*0.006, y*8.0 + 3.));
        cl = smoothstep(.5,.8,cl) * smoothstep(0.12,0.4,y) * smoothstep(1.0,0.55,y);
        col = mix(col, col*0.55 + c1*0.75, cl*cloudAmt);
        vec2 g = floor(vec2(p.x + off.x*0.5, y)*190.); float h = hash(g);
        col += vec3(step(0.997, h) * smoothstep(.5,.95,y) * (0.55+0.45*sin(time*2.5+h*90.))) * stars;
        gl_FragColor = vec4(col, 1.);
      }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  m.frustumCulled = false; m.renderOrder = -1000;
  return m;
}

function makeLiquid(L, T) {
  const q = T.liquid;
  const uniforms = {
    time: { value: 0 }, shallow: { value: C(q.shallow) }, deep: { value: C(q.deep) }, spark: { value: C(q.spark) },
    fogColor: { value: C(T.fog[0]) }, fogDensity: { value: T.fog[1] }, glow: { value: q.glow }, opacity: { value: q.opacity }, wall: { value: 0 },
  };
  const mk = (wall) => new THREE.ShaderMaterial({
    transparent: q.opacity < 1, depthWrite: q.opacity >= 1,
    uniforms: { ...uniforms, wall: { value: wall } },
    vertexShader: `varying vec3 vW; varying float vDepth; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; vec4 mv = viewMatrix*w; vDepth = -mv.z; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `
      varying vec3 vW; varying float vDepth; uniform float time, fogDensity, glow, opacity, wall; uniform vec3 shallow, deep, spark, fogColor;
      void main(){
        vec2 p = mix(vW.xz, vec2(vW.x, vW.y*2.5), wall);
        float w = sin(p.x*1.1 + time*1.1 + sin(p.y*0.8 + time*0.7)*1.6)*0.5+0.5;
        float w2 = sin(p.x*2.7 - time*1.6 + p.y*2.1)*0.5+0.5;
        float far = smoothstep(2.0, -50.0, vW.z);
        vec3 col = mix(deep, shallow, clamp(w*0.4 + far*0.55 + w2*0.12, 0., 1.));
        col = mix(col, deep*0.55, wall*0.75);
        col += spark * pow(w*w2, 5.0) * (1.4 - wall);
        col *= glow;
        float f = 1.0 - exp(-fogDensity*fogDensity*vDepth*vDepth);
        col = mix(col, fogColor, f * (1.0 - 0.5*step(1.5, glow)));
        gl_FragColor = vec4(col, opacity);
      }`,
  });
  const g = new THREE.Group();
  const w = L.W + 200;
  const surf = new THREE.Mesh(new THREE.PlaneGeometry(w, 110), mk(0));
  surf.rotation.x = -Math.PI / 2; surf.position.set(L.W / 2, L.liquidY, ZF + 0.6 - 55);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(w, L.liquidY + 4), mk(1));
  front.position.set(L.W / 2, (L.liquidY - 4) / 2, ZF + 0.6);
  g.add(surf, front);
  g.userData.uniforms = [surf.material.uniforms, front.material.uniforms];
  return g;
}

// ------------------------------------------------------------------ build
export function buildWorld(L) {
  const T = THEMES[L.theme];
  const R = rng(1234 + L.index * 97);
  const root = new THREE.Group();
  const owned = [];
  const add = (o) => { root.add(o); owned.push(o); return o; };
  const emitters = [], glows = [];

  const sky = add(makeSky(T));
  const terrain = add(buildTerrain(L, T));

  const profile = makeProfile(L);
  const depth = T.cave ? 20 : 78;
  const base = L.cols.reduce((s, c) => s + c.g, 0) / L.W;
  const heightAt = (x, z) => {
    const d = ZB - z;
    const t = smooth(0, T.cave ? 7 : 12, d);
    const hills = base - 1 + (vnoise(x * 0.045, z * 0.045, 41) - 0.5) * (T.cave ? 5 : 9) + (vnoise(x * 0.16, z * 0.16, 43) - 0.5) * 2.5 + d * (T.cave ? 0.05 : 0.035);
    return (profile(x) - 0.15) * (1 - t) + hills * t;
  };
  add(buildBackdrop(L, T, heightAt, depth));
  if (T.cave) add(buildCaveShell(L, T, depth));
  const liquid = add(makeLiquid(L, T));

  // ---- scatter props
  const bag = {};
  const put = (name, x, y, z, s = 1, ry = R() * 6.28, extra) => { (bag[name] ||= []).push({ x, y, z, s, ry, ...extra }); };
  const pick = (arr) => arr[Math.floor(R() * arr.length)];
  const flowers = ['flower_white', 'flower_red', 'flower_blue', 'flower_gold'];
  const reserved = new Set();
  for (const e of L.ents) if (['merchant', 'portal', 'shrine', 'chest', 'sign'].includes(e.type)) { const w = e.type === 'merchant' ? 5 : 2; for (let i = -w; i <= w; i++) reserved.add(Math.floor(e.x) + i); }

  for (let x = 0; x < L.W; x++) {
    const col = L.cols[x];
    if (col.pit) {
      if (L.theme === 'woods' && R() < 0.5) put('lilypad', x + R(), L.liquidY + 0.02, -1 - R() * 5, 0.8 + R() * 0.6);
      continue;
    }
    const y = col.g, free = !reserved.has(x);
    const headroom = col.c ? L.H - col.c - y : 99;
    if (R() < (T.cave ? 0.2 : 0.17)) {
      const name = pick(T.trees), z = (free ? -2.4 : -4.2) - R() * (free ? 4 : 2.4);
      const big = /tree|pine|shroom_giant|pillar/.test(name);
      let s = big ? 0.85 + R() * 0.5 : 0.8 + R() * 0.9;
      if (name === 'shroom_giant' && headroom < 7) s = 0.6;
      if (big && !free && z > -3.4) s *= 0.8;
      put(name, x + R(), y - 0.05, z, s, /pillar/.test(name) ? 0 : undefined);
      if (/crystal/.test(name)) glows.push({ x: x + 0.5, y: y + 0.8, z, color: name.includes('cyan') ? '#59e8ff' : '#b56bff' });
    }
    if (L.theme === 'woods') {
      if (R() < 0.2) put(pick(['bush_a', 'bush_b', 'bush_berry']), x + R(), y, -1.2 - R() * 1.2, 0.7 + R() * 0.5);
      if (R() < 0.1) put(pick(['rock_a', 'rock_b', 'rock_moss', 'rock_c']), x + R(), y - 0.05, R() < 0.3 ? 1.0 : -1.3 - R() * 4, 0.5 + R() * 0.7);
      if (R() < 0.42) put(pick(flowers), x + R(), y, R() < 0.3 ? 0.85 + R() * 0.4 : -0.85 - R() * 1.6, 0.8 + R() * 0.5);
      if (R() < 0.12) put('fern', x + R(), y, -1 - R() * 3, 0.9 + R() * 0.6);
      if (R() < 0.07) put('mushroom_red', x + R(), y, R() < 0.4 ? 1.0 : -1 - R() * 2, 0.6 + R() * 0.5);
      if (R() < 0.035 && free) put('stump', x + 0.5, y, -1.6 - R(), 0.8 + R() * 0.3);
      if (x % 23 === 11 && free) { put('lantern_post', x + 0.5, y, -1.25, 1, 0); emitters.push({ x: x + 1.05, y: y + 2.02, z: -1.25, kind: 'lamp' }); glows.push({ x: x + 1.05, y: y + 2, z: -1.0, color: '#ffa238' }); }
      if (x % 31 === 5 && free) put('fence', x + 1, y, -1.9, 1, 0);
      for (let k = 0; k < 4; k++) { const z = k < 3 ? -0.7 - R() * 5.8 : 0.75 + R() * 0.6; put('grass', x + R(), y, z, 0.7 + R() * 0.6); }
    } else if (L.theme === 'hollow') {
      if (R() < 0.16) { const n = pick(['mushroom_glow', 'mushroom_violet']); const z = R() < 0.3 ? 1.0 : -1 - R() * 3; put(n, x + R(), y, z, 0.7 + R() * 0.8); }
      if (R() < 0.12) put(pick(['rock_ice', 'rock_b', 'rock_a']), x + R(), y - 0.05, R() < 0.3 ? 1.0 : -1.3 - R() * 4, 0.5 + R() * 0.8);
      if (R() < 0.1 && free) { const z = -1.1 - R() * 1.5; const n = pick(['crystal_cyan', 'crystal_violet', 'crystal_pink']); put(n, x + R(), y, z, 0.5 + R() * 0.5); glows.push({ x: x + 0.5, y: y + 0.6, z, color: n.includes('cyan') ? '#59e8ff' : n.includes('pink') ? '#ff6ad5' : '#b56bff' }); }
      if (col.c && R() < 0.5) put('stalactite', x + R(), L.H - col.c + 0.1, 1.2 - R() * 8, 0.7 + R() * 1.4);
      if (col.c && R() < 0.07) { const z = -1 - R() * 3; put('crystal_cyan', x + R(), L.H - col.c + 0.1, z, 0.7 + R() * 0.5, R() * 6, { rx: Math.PI }); }
    } else {
      if (R() < 0.12) put(pick(['rock_dark', 'rock_c']), x + R(), y - 0.05, R() < 0.3 ? 1.0 : -1.3 - R() * 4, 0.5 + R() * 0.8);
      if (R() < 0.06) put('skulls', x + R(), y, R() < 0.4 ? 1.0 : -1 - R() * 2, 0.8 + R() * 0.4);
      if (x % 13 === 6 && free) { put('torch', x + 0.5, y, -1.3, 1.15, 0); emitters.push({ x: x + 0.5, y: y + 1.95, z: -1.3, kind: 'torch' }); glows.push({ x: x + 0.5, y: y + 2.1, z: -1.0, color: '#ff8a30' }); }
      if (x % 29 === 17 && free) put('banner', x + 0.5, y, -2.0, 1.1, 0);
      if (x % 41 === 20) put('arch', x + 0.5, y - 0.1, -4.2, 1.25, 0);
      if (R() < 0.03) put('crate', x + R(), y, -1.4 - R(), 1);
    }
  }
  // tops of floating platforms + vines beneath
  for (const p of L.plats) {
    if (p.type === 'solid') {
      for (let i = 0; i < p.w; i++) {
        if (T.grass) { for (let k = 0; k < 3; k++) put('grass', p.x + i + R(), p.y, -1.3 + R() * 2.4, 0.8 + R() * 0.5); if (R() < 0.5) put(pick(flowers), p.x + i + R(), p.y, -0.8 - R() * 0.5, 0.8); }
        if (L.theme === 'woods' && R() < 0.7) put('vine', p.x + i + R(), p.y - 1.05, 1.2 - R() * 2.4, 0.7 + R() * 0.7);
        if (L.theme === 'hollow' && R() < 0.5) put('stalactite', p.x + i + R(), p.y - 1, R() * 2 - 1, 0.4 + R() * 0.4);
      }
    } else for (let i = 0; i < p.w; i++) put('plank', p.x + i + 0.5, p.y, 0, 1, 0);
  }
  for (const s of L.spikes) put('spikes', s.x + 0.5, s.y, 0, 1, 0);
  // rolling backdrop
  const far = Math.floor((L.W + 80) * (T.cave ? 0.7 : 0.75));
  for (let i = 0; i < far; i++) {
    const x = -40 + R() * (L.W + 80), dz = Math.pow(R(), 1.5) * (depth - 6), z = ZB - 1.5 - dz, y = heightAt(x, z);
    if (y < L.liquidY + 0.4) continue;
    const name = pick(T.farTrees);
    put(name, x, y - 0.25, z, (/tree|pine/.test(name) ? 0.9 : 0.8) + R() * 0.9 + dz * 0.012);
    if (L.theme === 'woods' && R() < 0.3) put(pick(['bush_a', 'bush_b', 'rock_a', 'rock_moss']), x + 2, heightAt(x + 2, z + 1) - 0.1, z + 1, 1 + R());
    if (T.cave && /crystal/.test(name) && dz < 8) glows.push({ x, y: y + 1, z, color: name.includes('cyan') ? '#59e8ff' : '#b56bff' });
  }
  if (L.theme === 'keep') for (let i = 0; i < 9; i++) {
    const x = -20 + (L.W + 40) * (i + R() * 0.6) / 9, z = -22 - R() * 34;
    put(R() < 0.6 ? 'tower' : 'castle_wall', x, heightAt(x, z) - 0.8, z, 1.3 + R() * 1.1, R() * 0.6 - 0.3);
  }
  if (L.theme === 'woods') { const x = L.W * 0.62, z = -58; put('tower', x, heightAt(x, z) - 1, z, 3.2, 0.3); put('tower', x + 9, heightAt(x + 9, z) - 1, z - 3, 2.2, 0.1); put('castle_wall', x + 4.5, heightAt(x + 4, z) - 1, z - 1, 2.4, 0); }
  for (const m of T.mountains) for (let i = 0; i < 9; i++) {
    const x = -90 + (L.W + 180) * (i + R()) / 9, z = -105 - R() * 80, w = 55 + R() * 45;
    put(m, x, -6, z, 1, R() * 6.28, { sx: w, sz: w, sy: 20 + R() * 24 + (m === 'volcano' ? -6 : 0) });
  }
  if (T.cloudTint) for (let i = 0; i < 16; i++) put(R() < 0.5 ? 'cloud_a' : 'cloud_b', -80 + R() * (L.W + 160), 24 + R() * 26, -95 - R() * 70, 3.5 + R() * 5, 0);

  for (const name in bag) {
    const small = /grass|flower|fern|lilypad|cloud|mountain|volcano|vine/.test(name);
    const g = instanced(name, bag[name], { castShadow: !small, receiveShadow: /mountain|volcano|pillar|arch|tower|wall|plank/.test(name) });
    if (/cloud/.test(name)) g.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.set(T.cloudTint); o.material.emissive = C(T.cloudTint); o.material.emissiveIntensity = 0.6; o.material.flatShading = false; } });
    add(g);
  }

  // ---- atmosphere: mist cards and light shafts
  const soft = softTexture();
  const mistMat = new THREE.SpriteMaterial({ map: soft, color: T.mist, transparent: true, opacity: T.cave ? 0.2 : 0.3, depthWrite: false, fog: false, blending: T.cave ? THREE.AdditiveBlending : THREE.NormalBlending });
  for (let i = 0; i < Math.floor(L.W / 9); i++) {
    const s = new THREE.Sprite(mistMat);
    const z = -9 - R() * (T.cave ? 10 : 40);
    s.position.set(R() * L.W, base + 1 + R() * 4, z); s.scale.set(26 + R() * 30, 5 + R() * 6, 1);
    add(s);
  }
  const shaftCanvas = document.createElement('canvas'); shaftCanvas.width = 32; shaftCanvas.height = 128;
  { const g = shaftCanvas.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    const gx = g.createLinearGradient(0, 0, 32, 0); gx.addColorStop(0, 'rgba(255,255,255,0)'); gx.addColorStop(0.5, 'rgba(255,255,255,1)'); gx.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 128); g.globalCompositeOperation = 'destination-in'; g.fillStyle = gx; g.fillRect(0, 0, 32, 128); }
  const shaftTex = new THREE.CanvasTexture(shaftCanvas);
  const shaftMat = new THREE.MeshBasicMaterial({ map: shaftTex, color: T.cave ? '#7fd8ff' : L.theme === 'keep' ? '#ff6a3a' : '#ffe0a0', transparent: true, opacity: T.cave ? 0.16 : 0.1, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const shafts = [];
  for (let i = 0; i < Math.floor(L.W / 14); i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.5 + R() * 3, 26), shaftMat);
    m.position.set(R() * L.W, base + 11, -2.5 - R() * 9); m.rotation.z = -0.35 + R() * 0.12;
    shafts.push(m); add(m);
  }

  // ---- lights
  const hemi = add(new THREE.HemisphereLight(T.hemi[0], T.hemi[1], T.hemi[2]));
  const key = new THREE.DirectionalLight(T.key[0], T.key[1]);
  const kd = new THREE.Vector3(...T.key[2]).normalize();
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const sc = key.shadow.camera; sc.left = -26; sc.right = 26; sc.top = 22; sc.bottom = -16; sc.near = 1; sc.far = 110;
  key.shadow.bias = -0.0005; key.shadow.normalBias = 0.05;
  add(key); add(key.target);
  const rim = add(new THREE.DirectionalLight(T.rim[0], T.rim[1]));
  rim.position.set(0.6, 0.35, -0.75);
  // a small pool of point lights hops to the nearest glowing props
  const pool = [];
  for (let i = 0; i < (T.cave ? 5 : 3); i++) { const p = new THREE.PointLight('#fff', 0, T.cave ? 13 : 9, 1.6); add(p); pool.push(p); }

  const tmpC = new THREE.Color();
  return {
    root, theme: T, emitters, glows, hemi, key,
    fog: new THREE.FogExp2(T.fog[0], T.fog[1]),
    update(dt, time, cam, fx, aspect) {
      const su = sky.material.uniforms;
      su.time.value = time; su.aspect.value = aspect; su.off.value.set(cam.x * 0.0016, -(cam.y - 9) * 0.006);
      for (const u of liquid.userData.uniforms) u.time.value = time;
      key.target.position.set(cam.x, cam.y - 2, 0);
      key.position.copy(key.target.position).addScaledVector(kd, 48);
      shafts.forEach((s, i) => { s.material.opacity = (T.cave ? 0.16 : 0.1) * (0.8 + 0.2 * Math.sin(time * 0.6 + i)); });
      // nearest glows get the pooled lights
      const near = glows.filter((g) => Math.abs(g.x - cam.x) < 20).sort((a, b) => Math.abs(a.x - cam.x) - Math.abs(b.x - cam.x));
      pool.forEach((p, i) => {
        const g = near[i];
        if (!g) { p.intensity = 0; return; }
        p.position.set(g.x, g.y, g.z + 0.6); p.color.set(g.color);
        p.intensity = (T.cave ? 22 : 12) * (0.85 + 0.15 * Math.sin(time * 9 + i * 2.1) * (g.color === '#ffa238' || g.color === '#ff8a30' ? 1 : 0.3));
      });
      for (const e of emitters) {
        if (Math.abs(e.x - cam.x) > 22) continue;
        if (e.kind === 'torch') { fx.flame(e.x, e.y, e.z, 1); if (Math.random() < 0.5) fx.flame(e.x, e.y, e.z, 0.7, [1, 0.85, 0.3], [1, 0.3, 0.05]); }
        else if (Math.random() < 0.4) fx.flame(e.x, e.y, e.z, 0.42, [1, 0.75, 0.3], [1, 0.4, 0.1]);
      }
      // ambient motes
      const rx = () => cam.x + (Math.random() - 0.5) * 34, ry = () => cam.y + (Math.random() - 0.5) * 16;
      if (L.theme === 'woods') {
        if (Math.random() < 0.5) fx.glow.spawn({ x: rx(), y: ry() - 2, z: -5 + Math.random() * 7, life: 3 + Math.random() * 3, size: 0.26, size1: 0.2, color: [0.85, 1.0, 0.35], wob: 0.9, fadeIn: 0.8, alpha: 0.95 });
        if (Math.random() < 0.22) { tmpC.set(['#ff9a4a', '#ffd36a', '#ff8fb0'][Math.floor(Math.random() * 3)]); fx.dust.spawn({ x: rx(), y: cam.y + 9, z: -4 + Math.random() * 6, vx: -1.2, vy: -1.6, life: 8, size: 0.16, size1: 0.16, color: [tmpC.r, tmpC.g, tmpC.b], wob: 1.4, alpha: 0.95 }); }
      } else if (L.theme === 'hollow') {
        if (Math.random() < 0.6) fx.glow.spawn({ x: rx(), y: ry(), z: -6 + Math.random() * 8, vy: 0.25, life: 4 + Math.random() * 3, size: 0.2, size1: 0.1, color: Math.random() < 0.7 ? [0.35, 0.9, 1] : [0.75, 0.45, 1], wob: 0.5, fadeIn: 1, alpha: 0.9 });
      } else {
        if (Math.random() < 0.8) fx.glow.spawn({ x: rx(), y: cam.y - 8 + Math.random() * 6, z: -5 + Math.random() * 7, vx: 0.6, vy: 1.6 + Math.random() * 2, life: 3 + Math.random() * 2.5, size: 0.2, size1: 0.05, color: [1, 0.55, 0.15], color1: [1, 0.15, 0.05], wob: 1.1, fadeIn: 0.4 });
        if (Math.random() < 0.15) fx.dust.spawn({ x: rx(), y: cam.y + 9, z: -3 + Math.random() * 5, vx: 0.8, vy: -1.1, life: 9, size: 0.12, size1: 0.12, color: [0.25, 0.2, 0.22], wob: 1, alpha: 0.8 });
      }
    },
    dispose() {
      root.traverse((o) => {
        if (o.isInstancedMesh) { o.dispose(); return; }
        if (o.isMesh && o.geometry && (o === terrain || o.geometry.type !== 'BufferGeometry' || o.userData.own)) o.geometry.dispose();
      });
      terrain.geometry.dispose();
    },
  };
}
