import * as THREE from 'three';

// ---------------------------------------------------------------- particles
const VERT = `
attribute float size; attribute vec4 pcolor;
varying vec4 vColor;
uniform float uScale;
void main(){
  vColor = pcolor;
  vec4 mv = modelViewMatrix * vec4(position,1.0);
  gl_PointSize = size * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = `
varying vec4 vColor; uniform float uSoft;
void main(){
  vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0;
  float a = mix(step(r, 1.0), pow(max(0.0, 1.0 - r), 1.6), uSoft);
  if (a * vColor.a < 0.01) discard;
  gl_FragColor = vec4(vColor.rgb, vColor.a * a);
}`;

export class Particles {
  constructor(scene, cap, additive) {
    this.cap = cap; this.n = 0;
    this.p = new Float32Array(cap * 3); this.c = new Float32Array(cap * 4); this.s = new Float32Array(cap);
    this.d = [];
    for (let i = 0; i < cap; i++) this.d.push({ life: 0 });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
    g.setAttribute('pcolor', new THREE.BufferAttribute(this.c, 4));
    g.setAttribute('size', new THREE.BufferAttribute(this.s, 1));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uScale: { value: 600 }, uSoft: { value: additive ? 1 : 0.35 } },
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 20 : 10;
    scene.add(this.points);
    this.cursor = 0;
  }
  /** o: {x,y,z,vx,vy,vz,life,size,size1,color:[r,g,b],color1,alpha,grav,drag,wob} */
  spawn(o) {
    const d = this.d[this.cursor]; this.cursor = (this.cursor + 1) % this.cap;
    d.x = o.x; d.y = o.y; d.z = o.z || 0; d.vx = o.vx || 0; d.vy = o.vy || 0; d.vz = o.vz || 0;
    d.life = d.max = o.life || 1; d.s0 = o.size || 0.2; d.s1 = o.size1 ?? d.s0 * 0.2;
    d.c0 = o.color; d.c1 = o.color1 || o.color; d.a = o.alpha ?? 1; d.g = o.grav || 0; d.drag = o.drag || 0; d.wob = o.wob || 0; d.ph = Math.random() * 6.28;
    d.fadeIn = o.fadeIn || 0;
  }
  update(dt, time) {
    const { p, c, s } = this;
    let n = 0;
    for (let i = 0; i < this.cap; i++) {
      const d = this.d[i];
      if (d.life <= 0) continue;
      d.life -= dt;
      d.vy -= d.g * dt;
      if (d.drag) { const k = Math.exp(-d.drag * dt); d.vx *= k; d.vy *= k; d.vz *= k; }
      d.x += (d.vx + (d.wob ? Math.sin(time * 2.1 + d.ph) * d.wob : 0)) * dt;
      d.y += (d.vy + (d.wob ? Math.cos(time * 1.7 + d.ph * 1.3) * d.wob * 0.6 : 0)) * dt;
      d.z += d.vz * dt;
      const t = 1 - Math.max(0, d.life) / d.max;
      p[n * 3] = d.x; p[n * 3 + 1] = d.y; p[n * 3 + 2] = d.z;
      c[n * 4] = d.c0[0] + (d.c1[0] - d.c0[0]) * t; c[n * 4 + 1] = d.c0[1] + (d.c1[1] - d.c0[1]) * t; c[n * 4 + 2] = d.c0[2] + (d.c1[2] - d.c0[2]) * t;
      let a = d.a * (1 - t * t);
      if (d.fadeIn) a *= Math.min(1, (d.max - d.life) / d.fadeIn);
      c[n * 4 + 3] = a;
      s[n] = d.s0 + (d.s1 - d.s0) * t;
      n++;
    }
    const g = this.points.geometry;
    g.setDrawRange(0, n);
    g.attributes.position.needsUpdate = true; g.attributes.pcolor.needsUpdate = true; g.attributes.size.needsUpdate = true;
  }
  resize(h) { this.mat.uniforms.uScale.value = h * 0.95; }
  clear() { for (const d of this.d) d.life = 0; }
}

export class FX {
  constructor(scene) {
    this.glow = new Particles(scene, 1400, true);
    this.dust = new Particles(scene, 500, false);
    this.time = 0;
  }
  update(dt) { this.time += dt; this.glow.update(dt, this.time); this.dust.update(dt, this.time); }
  resize(h) { this.glow.resize(h); this.dust.resize(h); }
  clear() { this.glow.clear(); this.dust.clear(); }

  burst(x, y, n, color, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, sp = (o.speed || 5) * (0.3 + Math.random() * 0.7);
      this.glow.spawn({ x, y, z: o.z ?? 0.3, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + (o.up || 0), vz: (Math.random() - 0.5) * 2, life: (o.life || 0.5) * (0.5 + Math.random() * 0.6),
        size: o.size || 0.3, color, color1: o.color1, grav: o.grav ?? 6, drag: o.drag ?? 2, alpha: o.alpha ?? 1 });
    }
  }
  puff(x, y, n, color = [0.8, 0.75, 0.65], o = {}) {
    for (let i = 0; i < n; i++) {
      this.dust.spawn({ x: x + (Math.random() - 0.5) * 0.5, y: y + Math.random() * 0.15, z: 0.4, vx: (Math.random() - 0.5) * (o.speed || 3), vy: Math.random() * 1.5 + 0.3, life: 0.45 + Math.random() * 0.3,
        size: o.size || 0.3, size1: (o.size || 0.3) * 1.8, color, alpha: o.alpha ?? 0.5, drag: 3 });
    }
  }
  flame(x, y, z, scale = 1, color = [1.0, 0.5, 0.12], color1 = [0.9, 0.08, 0.02]) {
    this.glow.spawn({ x: x + (Math.random() - 0.5) * 0.14 * scale, y, z, vx: (Math.random() - 0.5) * 0.5, vy: (1.2 + Math.random() * 1.4) * scale, life: 0.35 + Math.random() * 0.3,
      size: 0.5 * scale, size1: 0.08, color, color1, alpha: 0.9 });
  }
  spark(x, y, color = [1, 0.95, 0.7]) { this.burst(x, y, 10, color, { speed: 9, life: 0.3, size: 0.22, grav: 14 }); }
}

// ------------------------------------------------------------- sword slash
export function makeSlash() {
  const geo = new THREE.RingGeometry(0.75, 2.05, 40, 1, 0, Math.PI * 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uHead: { value: 0 }, uFade: { value: 0 }, uColor: { value: new THREE.Color(1, 1, 1) } },
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec2 vP; uniform float uHead, uFade; uniform vec3 uColor;
      void main(){
        float ang = atan(vP.y, vP.x); float r = length(vP);
        float d = ang - uHead; d = mod(d + 3.14159, 6.28318) - 3.14159;   // trail lies at angles ahead (counter-clockwise) of the head
        float trail = smoothstep(2.1, 0.0, d) * step(0.0, d);
        float edge = smoothstep(0.75, 1.5, r) * smoothstep(2.05, 1.85, r);
        float core = smoothstep(1.55, 1.95, r);
        float a = trail * (0.35 + 0.65*trail) * edge * uFade;
        gl_FragColor = vec4(uColor * (0.7 + core * 2.2) * a, a);
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 30; m.visible = false; m.frustumCulled = false;
  return m;
}

// --------------------------------------------------------------- textures
export function softTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, inner); gr.addColorStop(0.4, inner.replace(/[\d.]+\)$/, '0.35)')); gr.addColorStop(1, outer);
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
