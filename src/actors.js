// Visual wrappers around the Blender-built models.
import * as THREE from 'three';
import { makeCharacter, makeProp, ownMaterials } from './assets.js';
import { softTexture } from './fx.js';

const YAW = Math.PI / 2 - 0.38; // models face +Z; turn them side-on but slightly toward the camera
let SOFT = null;
const soft = () => (SOFT ||= softTexture());

class Flasher {
  constructor(mats) {
    this.mats = mats.filter((m) => m.emissive && !/^(glow|crystal|heart)/.test(m.name));
    this.base = this.mats.map((m) => ({ c: m.emissive.clone(), i: m.emissiveIntensity }));
    this.t = 0; this.on = false;
  }
  flash(t = 0.12, color = 0xffffff) { this.t = t; this.color = color; }
  update(dt) {
    if (this.t > 0) {
      this.t -= dt;
      if (!this.on) { this.on = true; for (const m of this.mats) { m.emissive.set(this.color); m.emissiveIntensity = 1.6; } }
    } else if (this.on) {
      this.on = false;
      this.mats.forEach((m, i) => { m.emissive.copy(this.base[i].c); m.emissiveIntensity = this.base[i].i; });
    }
  }
}

export class Humanoid {
  constructor(key, scale = 1) {
    const { model, clips } = makeCharacter(key);
    this.root = new THREE.Group();
    this.pivot = new THREE.Group();
    this.root.add(this.pivot);
    this.pivot.add(model);
    model.scale.setScalar(scale);
    this.model = model;
    this.mats = ownMaterials(model);
    this.flasher = new Flasher(this.mats);
    this.mixer = new THREE.AnimationMixer(model);
    this.actions = {};
    for (const c of clips) this.actions[c.name] = this.mixer.clipAction(c);
    this.bones = {};
    model.traverse((o) => { if (o.isBone) this.bones[o.name] = o; });
    this.cur = null; this.curName = '';
    this.yaw = YAW;
    this.pivot.rotation.y = this.yaw;
  }
  duration(name) { return this.actions[name].getClip().duration; }
  play(name, { fade = 0.12, once = false, speed = 1, force = false } = {}) {
    if (this.curName === name && !force) { this.cur.timeScale = speed; return; }
    const a = this.actions[name];
    a.reset();
    a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    a.clampWhenFinished = once;
    a.timeScale = speed;
    a.play();
    if (this.cur && this.cur !== a) a.crossFadeFrom(this.cur, fade, false);
    this.cur = a; this.curName = name;
  }
  flash(t, c) { this.flasher.flash(t, c); }
  update(dt, face, turnSpeed = 14) {
    this.mixer.update(dt);
    const target = face > 0 ? YAW : -YAW;
    this.yaw += (target - this.yaw) * Math.min(1, dt * turnSpeed);
    this.pivot.rotation.y = this.yaw;
    this.flasher.update(dt);
  }
}

export class SlimeView {
  constructor(tint) {
    this.root = new THREE.Group();
    this.body = makeProp('slime');
    this.root.add(this.body);
    const mats = ownMaterials(this.body);
    for (const m of mats) {
      if (m.name === 'gloss') { m.color.set(tint); m.transparent = true; m.opacity = 0.88; m.roughness = 0.15; m.emissive.set(tint); m.emissiveIntensity = 0.18; }
      if (m.name === 'glow_white') { m.emissive.set(tint); m.emissiveIntensity = 1.2; }
    }
    this.flasher = new Flasher(mats);
    this.sq = 0; this.yaw = 0.5;
  }
  flash(t) { this.flasher.flash(t); }
  update(dt, face, time, air, vy) {
    const idle = Math.sin(time * 4) * 0.06;
    const target = air ? Math.max(-0.3, Math.min(0.35, vy * 0.03)) : idle;
    this.sq += (target - this.sq) * Math.min(1, dt * 16);
    this.body.scale.set(1 - this.sq * 0.6, 1 + this.sq, 1 - this.sq * 0.6);
    this.yaw += ((face > 0 ? 0.9 : -0.9) - this.yaw) * Math.min(1, dt * 8);
    this.body.rotation.y = this.yaw;
    this.flasher.update(dt);
  }
}

export class BatView {
  constructor() {
    this.root = new THREE.Group();
    this.g = new THREE.Group();
    this.root.add(this.g);
    this.body = makeProp('bat_body');
    this.wl = makeProp('bat_wingL', true);
    this.wr = makeProp('bat_wingR', true);
    this.g.add(this.body, this.wl, this.wr);
    this.g.position.y = 0.3;
    this.g.scale.setScalar(0.95);
    this.flasher = new Flasher(ownMaterials(this.g));
  }
  flash(t) { this.flasher.flash(t); }
  update(dt, face, time, hanging) {
    if (hanging) {
      this.g.rotation.set(0, 0, Math.PI);
      this.wl.rotation.z = 1.25; this.wr.rotation.z = -1.25;
    } else {
      const f = Math.sin(time * 22) * 0.85;
      this.g.rotation.set(0.15, face * 0.6, 0);
      this.wl.rotation.z = f; this.wr.rotation.z = -f;
    }
    this.flasher.update(dt);
  }
}

export class PlantView {
  constructor() {
    this.root = new THREE.Group();
    this.g = new THREE.Group();
    this.root.add(this.g);
    this.stem = makeProp('plant_stem');
    this.head = makeProp('plant_head', true);
    this.g.add(this.stem, this.head);
    this.g.scale.setScalar(1.15);
    this.flasher = new Flasher(ownMaterials(this.g));
    this.yaw = 1; this.pulse = 0;
  }
  flash(t) { this.flasher.flash(t); }
  spit() { this.pulse = 1; }
  update(dt, face, time, charge) {
    this.yaw += ((face > 0 ? 1.15 : -1.15) - this.yaw) * Math.min(1, dt * 6);
    this.g.rotation.y = this.yaw;
    this.pulse = Math.max(0, this.pulse - dt * 4);
    const s = 1 + charge * 0.25 - this.pulse * 0.25 + Math.sin(time * 3) * 0.03;
    this.head.scale.set(s, s, s + this.pulse * 0.5);
    this.head.rotation.x = -0.25 + Math.sin(time * 2.2) * 0.08 - charge * 0.3;
    this.stem.rotation.z = Math.sin(time * 1.7) * 0.04;
    this.flasher.update(dt);
  }
}

export function glowSprite(color, size, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  s.scale.setScalar(size);
  s.renderOrder = 25;
  return s;
}

export class WispView {
  constructor() {
    this.root = new THREE.Group();
    this.core = glowSprite('#ffe9b0', 0.9);
    this.halo = glowSprite('#ff5a2a', 2.3, 0.75);
    this.root.add(this.halo, this.core);
    this.root.position.z = 0.3;
    this.ft = 0;
  }
  flash() { this.ft = 0.12; }
  update(dt, face, time) {
    this.ft -= dt;
    const k = 1 + Math.sin(time * 9) * 0.12;
    this.core.scale.setScalar((this.ft > 0 ? 1.6 : 0.9) * k);
    this.halo.scale.setScalar(2.3 * k);
    this.core.material.color.set(this.ft > 0 ? '#ffffff' : '#ffe9b0');
  }
}

/** Swirling doorway that fills the stone portal arch. */
export function makePortalSwirl() {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { time: { value: 0 }, power: { value: 0 }, colA: { value: new THREE.Color('#59e8ff') }, colB: { value: new THREE.Color('#b56bff') } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec2 vUv; uniform float time, power; uniform vec3 colA, colB;
      void main(){
        vec2 p = (vUv - 0.5) * vec2(2.0, 2.0); p.y = p.y * 1.25 + 0.2;
        float r = length(p), a = atan(p.y, p.x);
        float sw = sin(a*3.0 + r*9.0 - time*3.0)*0.5+0.5;
        float sw2 = sin(a*5.0 - r*6.0 + time*2.0)*0.5+0.5;
        float mask = smoothstep(1.0, 0.75, r);
        vec3 col = mix(colA, colB, sw2) * (0.35 + sw*1.5) + vec3(1.0)*smoothstep(0.35,0.0,r)*1.2;
        float al = mask * (0.12 + power*0.9) * (0.5 + sw*0.5);
        gl_FragColor = vec4(col*al*(0.4+power*1.3), al);
      }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 3.3), mat);
  m.renderOrder = 15;
  return m;
}
