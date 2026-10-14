// Game rules: player, enemies, pickups, projectiles, camera and mode flow.
import * as THREE from 'three';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { buildLevel, TILE, LEVEL_COUNT } from './levels.js';
import { buildWorld } from './world.js';
import { makeProp, ownMaterials } from './assets.js';
import { Humanoid, SlimeView, BatView, PlantView, WispView, glowSprite, makePortalSwirl } from './actors.js';
import { makeSlash } from './fx.js';

const GRAV = 58, JUMP = 21, RUN = 7.6;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = (a, b) => a + Math.random() * (b - a);

export const SWORDS = [
  { name: "Knight's Blade", reach: 1.8, dmg: 1, color: '#fff4e0', prop: 'sword_1' },
  { name: 'Rune Blade', reach: 2.1, dmg: 2, color: '#7fe8ff', prop: 'sword_2' },
  { name: 'Flame Blade', reach: 2.35, dmg: 2, color: '#ffa040', prop: 'sword_3', wave: true },
];
export const ARMORS = [
  { name: 'Steel Plate', tint: [1, 1, 1] },
  { name: 'Sunsteel Plate', tint: [1.7, 1.25, 0.5] },
  { name: 'Ember Aegis', tint: [1.9, 0.5, 0.38] },
];
const SLIME_TINT = { woods: '#58e06a', hollow: '#4ac8ff', keep: '#ff6a3a' };
const LOOT = { slime: 2, bat: 2, plant: 3, skel: 5, wisp: 3, boss: 0 };

// ------------------------------------------------------------------ player
class Player {
  constructor(game) {
    this.g = game;
    this.view = new Humanoid('hero', 1.15);
    for (const m of this.view.mats) m.envMapIntensity = 2.2;
    this.hw = 0.3; this.h = 1.5;
    this.slash = makeSlash();
    this.slash.position.set(0, 1.2, 0.45);
    this.view.root.add(this.slash);
    this.metal = this.view.mats.find((m) => m.name === 'metal');
    this.metalBase = this.metal.color.clone();
    this.swordObj = null;
    this.reset(0, 0);
  }
  reset(x, y) {
    Object.assign(this, { x, y, vx: 0, vy: 0, face: 1, ground: false, coy: 0, buf: 0, atkT: -1, atkCd: 0, hurtT: 0, inv: 0, dead: false, deadT: 0,
      crouch: false, swing: 0, drop: 0, ride: null, exitT: -1, hitWall: 0 });
    this.view.root.visible = true;
    this.view.root.scale.setScalar(1);
    this.view.play('Idle', { force: true });
  }
  equip() {
    const s = this.g.stats;
    if (this.swordObj) this.swordObj.removeFromParent();
    this.swordObj = makeProp(SWORDS[s.sword].prop);
    this.view.bones.grip_R.add(this.swordObj);
    const t = ARMORS[s.armor].tint;
    this.metal.color.copy(this.metalBase).multiply(new THREE.Color(t[0], t[1], t[2]));
    this.slash.material.uniforms.uColor.value.set(SWORDS[s.sword].color);
  }
  hurt(dmg, fromX) {
    const g = this.g;
    if (this.inv > 0 || this.dead || this.exitT >= 0 || g.mode !== 'play') return;
    g.stats.hp -= dmg;
    this.inv = 1.3; this.hurtT = 0.28; this.atkT = -1;
    this.vx = (this.x < fromX ? -1 : 1) * 7.5; this.vy = 11; this.ground = false; this.ride = null;
    this.view.flash(0.15, 0xff4030);
    g.shake = 0.35; g.hitstop = 0.06;
    g.fx.burst(this.x, this.y + 0.9, 12, [1, 0.3, 0.2], { speed: 7 });
    Sound.play('hurt');
    if (g.stats.hp <= 0) this.die();
    else this.view.play('Hurt', { once: true, force: true, fade: 0.05 });
  }
  die() {
    if (this.dead) return;
    this.dead = true; this.deadT = 0; this.atkT = -1; this.slash.visible = false;
    this.g.stats.hp = 0;
    this.view.play('Die', { once: true, force: true, fade: 0.08 });
    Sound.play('die');
    this.g.shake = 0.5;
  }
  update(dt) {
    const g = this.g, L = g.level, fx = g.fx;
    if (this.dead) {
      this.deadT += dt;
      this.vx *= Math.exp(-4 * dt); this.vy = Math.max(-30, this.vy - GRAV * dt);
      if (this.y > L.liquidY - 1.2) g.moveBody(this, dt);
      this.sync(dt);
      if (this.deadT > 1.9) g.onPlayerDead();
      return;
    }
    if (this.exitT >= 0) { // stepping through the portal
      this.exitT += dt;
      this.x += (this.exitX - this.x) * Math.min(1, dt * 5);
      this.view.root.scale.setScalar(Math.max(0.001, 1 - this.exitT * 1.1));
      this.view.root.rotation.y += dt * 9;
      this.view.root.position.set(this.x, this.y + this.exitT * 1.2, -this.exitT * 0.8);
      this.view.update(dt, this.face);
      if (Math.random() < 0.8) fx.burst(this.x, this.y + 1.3, 2, [0.5, 0.9, 1], { speed: 4, grav: -3, life: 0.6 });
      if (this.exitT > 1.1) g.levelCleared();
      return;
    }
    const ax = (Input.down('right') ? 1 : 0) - (Input.down('left') ? 1 : 0);
    const attacking = this.atkT >= 0;
    this.crouch = this.ground && Input.down('down') && !attacking;
    this.h = this.crouch ? 0.95 : 1.5;
    let target = ax * RUN;
    if (this.crouch) target = 0;
    if (attacking && this.ground) target *= 0.25;
    if (this.hurtT > 0) this.hurtT -= dt;
    else {
      const acc = (this.ground ? 85 : 55) * dt;
      this.vx += clamp(target - this.vx, -acc, acc);
      if (ax && !attacking) this.face = ax;
    }
    const onOneWay = this.ground && L.tile(Math.floor(this.x), Math.floor(this.y - 0.05)) === TILE.ONEWAY;
    if (Input.pressed('jump') || (Input.pressed('up') && !g.nearMerchant)) this.buf = 0.12; else this.buf -= dt;
    this.coy = this.ground ? 0.1 : this.coy - dt;
    if (this.buf > 0 && this.coy > 0 && this.hurtT <= 0) {
      if (Input.down('down') && (onOneWay || this.ride)) { this.drop = 0.2; this.y -= 0.08; }
      else { this.vy = JUMP; Sound.play('jump'); fx.puff(this.x, this.y, 5); }
      this.buf = 0; this.coy = 0; this.ground = false; this.ride = null;
    }
    if (!(Input.down('jump') || Input.down('up')) && this.vy > 7 && !this.ground) this.vy -= 95 * dt;
    this.vy = Math.max(-32, this.vy - GRAV * dt);
    this.drop -= dt;
    if (this.ride) { this.x += this.ride.dx; this.y = this.ride.y; }
    const wasGround = this.ground, vy0 = this.vy;
    g.moveBody(this, dt);
    if (this.ground && !wasGround && vy0 < -9) { Sound.play('land'); fx.puff(this.x, this.y, 7); }
    if (this.ground && Math.abs(this.vx) > 5 && Math.random() < 0.25) fx.puff(this.x - this.face * 0.3, this.y, 1, undefined, { alpha: 0.3 });
    this.x = clamp(this.x, L.minX + 0.4, L.maxX - 0.4);

    // sword
    this.atkCd -= dt;
    const sword = SWORDS[g.stats.sword];
    if (Input.pressed('attack') && this.atkT < 0 && this.atkCd <= 0 && this.hurtT <= 0) {
      this.atkT = 0; this.swing++; this.waveFired = false;
      Sound.play('slash');
      this.view.play('Attack', { once: true, force: true, fade: 0.04, speed: this.view.duration('Attack') / 0.4 });
    }
    if (this.atkT >= 0) {
      this.atkT += dt;
      if (this.atkT > 0.08 && this.atkT < 0.24) g.playerStrike(this, sword);
      if (sword.wave && !this.waveFired && this.atkT > 0.13) { this.waveFired = true; g.spawnShot('wave', this.x + this.face * 0.8, this.y + 0.95, this.face * 17, 0); Sound.play('wave'); }
      const p = (this.atkT - 0.05) / 0.2;
      this.slash.visible = p > 0 && p < 1.25;
      if (this.slash.visible) {
        const e = Math.min(1, p); const ease = 1 - (1 - e) * (1 - e);
        this.slash.scale.set(this.face * sword.reach / 1.9, sword.reach / 1.9, 1);
        this.slash.material.uniforms.uHead.value = 2.25 - 3.1 * ease;
        this.slash.material.uniforms.uFade.value = p < 1 ? Math.min(1, p * 4) : Math.max(0, 1 - (p - 1) * 4);
      }
      if (this.atkT > 0.38) { this.atkT = -1; this.atkCd = 0.04; this.slash.visible = false; }
    }

    // hazards
    this.inv -= dt;
    if (L.tile(Math.floor(this.x), Math.floor(this.y + 0.15)) === TILE.SPIKE && this.y - Math.floor(this.y + 0.15) < 0.5) this.hurt(1, this.x + this.face);
    const col = L.cols[clamp(Math.floor(this.x), 0, L.W - 1)];
    if (col.pit && this.y < L.liquidY - 0.35) {
      const hot = L.theme === 'keep';
      fx.burst(this.x, L.liquidY, 30, hot ? [1, 0.6, 0.1] : [0.6, 0.9, 1], { speed: 9, up: 6, grav: 18, life: 0.8 });
      Sound.play(hot ? 'fire' : 'land');
      this.die();
    }

    // animation
    const v = this.view;
    if (this.hurtT > 0) { /* Hurt already playing */ }
    else if (this.atkT >= 0) { /* Attack playing */ }
    else if (!this.ground) v.play(this.vy > 0 ? 'Jump' : 'Fall', { fade: 0.1 });
    else if (this.crouch) v.play('Crouch', { fade: 0.08 });
    else if (Math.abs(this.vx) > 0.8) v.play('Run', { speed: 0.55 + Math.abs(this.vx) / RUN * 0.75, fade: 0.1 });
    else v.play('Idle', { fade: 0.15 });
    this.sync(dt);
    this.view.root.visible = this.inv <= 0 || Math.floor(this.inv * 18) % 2 === 0;
  }
  sync(dt) {
    this.view.update(dt, this.face);
    this.view.root.position.set(this.x, this.y, 0);
  }
}

// -------------------------------------------------------------------- game
export class Game {
  constructor({ scene, camera, fx, ui, applyTheme }) {
    Object.assign(this, { scene, camera, fx, ui, applyTheme });
    this.layer = new THREE.Group();
    scene.add(this.layer);
    this.stats = { hp: 3, maxHp: 3, coins: 0, lives: 3, sword: 0, armor: 0, rune: false };
    this.player = new Player(this);
    scene.add(this.player.view.root);
    this.playerLight = new THREE.PointLight('#fff', 0, 12, 1.5);
    scene.add(this.playerLight);
    this.cam = { x: 0, y: 8, floor: 6 };
    this.mode = 'title';
    this.time = 0; this.shake = 0; this.hitstop = 0;
    this.levelIndex = 0;
    this.shopSel = 0;
    this.loadLevel(0);
    ui.title(true);
    ui.onShopPick((i) => { if (this.mode === 'shop') this.shopPick = i; });
  }

  // ---------------------------------------------------------- level setup
  loadLevel(index) {
    if (this.world) { this.scene.remove(this.world.root); this.world.dispose(); }
    this.layer.clear();
    this.fx.clear();
    this.levelIndex = index;
    const L = this.level = buildLevel(index);
    this.world = buildWorld(L);
    this.scene.add(this.world.root);
    this.scene.fog = this.world.fog;
    this.applyTheme(this.world.theme);
    const pl = this.world.theme.playerLight || ['#ffe8cc', 9, 7];
    this.playerLight.intensity = pl[1]; this.playerLight.color.set(pl[0]); this.playerLight.distance = pl[2];
    this.enemies = []; this.pickups = []; this.shots = []; this.objects = []; this.movers = []; this.marks = [];
    this.boss = null; this.nearMerchant = null; this.hintText = '';
    this.stats.rune = false;
    this.checkpoint = { ...L.start };
    for (const m of L.movers) {
      const view = makeProp('movplat');
      view.scale.x = m.w;
      this.layer.add(view);
      this.movers.push({ ...m, x: m.x0, y: m.y0, dx: 0, py: m.y0, view });
    }
    for (const e of L.ents) this.spawn(e);
    this.player.reset(L.start.x, L.start.y);
    this.player.equip();
    this.cam.x = L.start.x + 6; this.cam.y = L.start.y + 3; this.cam.floor = L.start.y;
    this.levelCoins = 0; this.levelKills = 0;
  }

  spawn(e) {
    const L = this.level;
    const add = (v) => { this.layer.add(v); return v; };
    switch (e.type) {
      case 'coin': case 'gem': case 'heart': case 'rune': case 'life': this.addPickup(e.type, e.x, e.y); break;
      case 'chest': {
        const g = new THREE.Group(), base = makeProp('chest_base'), lid = makeProp('chest_lid', true), glow = makeProp('chest_glow');
        glow.visible = false; g.add(base, lid, glow); g.position.set(e.x, e.y, -0.2); g.rotation.y = 0.25; add(g);
        this.objects.push({ type: 'chest', x: e.x, y: e.y, open: false, view: g, lid, glow, t: 0 });
        break;
      }
      case 'shrine': {
        const v = add(makeProp('shrine')); v.position.set(e.x, e.y, -1.1);
        const mats = ownMaterials(v); const gem = mats.find((m) => m.name === 'shrine_gem');
        const halo = glowSprite('#59e8ff', 3.5, 0); halo.position.set(e.x, e.y + 1.8, -0.9); add(halo);
        this.objects.push({ type: 'shrine', x: e.x, y: e.y, active: false, view: v, gem, halo });
        break;
      }
      case 'merchant': {
        const stall = add(makeProp('stall')); stall.position.set(e.x + 0.6, e.y, -2.2);
        const h = new Humanoid('merchant'); h.root.position.set(e.x - 1.6, e.y, -1.0); h.play('Float'); add(h.root);
        const lamp = glowSprite('#ffa238', 2.6, 0.5); lamp.position.set(e.x + 1.7, e.y + 1.45, -1.4); add(lamp);
        this.world.glows.push({ x: e.x + 1.2, y: e.y + 1.6, z: -1.2, color: '#ffa238' });
        this.objects.push({ type: 'merchant', x: e.x - 1.2, y: e.y, view: h });
        break;
      }
      case 'portal': {
        const v = add(makeProp('portal')); v.position.set(e.x, e.y, -0.9);
        const mats = ownMaterials(v); const runes = mats.find((m) => m.name === 'portal_rune');
        const swirl = makePortalSwirl(); swirl.position.set(e.x, e.y + 1.95, -0.9); add(swirl);
        this.objects.push({ type: 'portal', x: e.x, y: e.y, view: v, runes, swirl, power: 0 });
        break;
      }
      case 'sign': {
        const v = add(makeProp('sign')); v.position.set(e.x, e.y, -1.0);
        this.objects.push({ type: 'sign', x: e.x, y: e.y, text: e.text, touchText: e.touchText });
        break;
      }
      default: this.addEnemy(e.type, e.x, e.y);
    }
  }

  addEnemy(type, x, y) {
    const tier = Math.min(2, this.levelIndex);
    const e = { type, x, y, vx: 0, vy: 0, face: -1, ground: false, t: Math.random() * 2, state: 'idle', inv: 0, dead: false, deadT: 0, grav: true, home: x, homeY: y, drop: 0, hitWall: 0 };
    if (type === 'slime') { Object.assign(e, { hw: 0.42, h: 0.7, hp: 2 + tier }); e.view = new SlimeView(SLIME_TINT[this.level.theme]); }
    else if (type === 'bat') { Object.assign(e, { hw: 0.35, h: 0.6, hp: 1 + (tier > 1 ? 1 : 0), grav: false, state: 'hang' }); e.view = new BatView(); }
    else if (type === 'plant') { Object.assign(e, { hw: 0.42, h: 1.5, hp: 3 + tier, t: 1 + Math.random() }); e.view = new PlantView(); e.view.root.position.z = -0.25; }
    else if (type === 'skel') { Object.assign(e, { hw: 0.32, h: 1.55, hp: 4 + tier * 2, state: 'patrol', face: Math.random() < 0.5 ? 1 : -1 }); e.view = new Humanoid('skeleton'); e.view.play('Walk'); }
    else if (type === 'wisp') { Object.assign(e, { hw: 0.38, h: 0.76, hp: 2, grav: false }); e.view = new WispView(); }
    else if (type === 'boss') {
      Object.assign(e, { hw: 0.7, h: 2.5, hp: 26, maxHp: 26, grav: false, state: 'intro', t: 0, side: 1, cycle: 0, y: y + 9, baseY: y, fired: false });
      e.view = new Humanoid('sorcerer', 1.5); e.view.play('Float');
      e.aura = glowSprite('#b56bff', 6, 0.35); e.view.root.add(e.aura); e.aura.position.y = 1.8;
      this.boss = e;
    } else return null;
    e.maxHp = e.maxHp || e.hp;
    if (type === 'bat') { // roost on a ceiling when there is one overhead, otherwise hover in place
      for (let ty = Math.floor(y) + 1; ty < Math.min(this.level.H, y + 9); ty++) if (this.level.solid(Math.floor(x), ty)) { e.y = e.homeY = ty - 0.95; e.roost = true; break; }
    }
    e.view.root.position.x = e.x; e.view.root.position.y = e.y;
    this.layer.add(e.view.root);
    this.enemies.push(e);
    return e;
  }

  addPickup(type, x, y, phys) {
    const prop = { coin: 'coin', gem: 'gem', heart: 'heart', rune: 'rune', life: 'potion' }[type];
    const view = makeProp(prop);
    if (type === 'coin') { view.scale.setScalar(0.85); view.traverse((o) => { if (o.isMesh) o.material = (this.coinMat ||= Object.assign(o.material.clone(), { emissive: new THREE.Color('#ff9a10'), emissiveIntensity: 0.55 })); }); }
    if (type === 'rune') { view.scale.setScalar(1.15); const halo = glowSprite('#ffd85a', 3.2, 0.55); view.add(halo); }
    if (type === 'heart') view.scale.setScalar(1.1);
    view.traverse((o) => { o.castShadow = false; });
    this.layer.add(view);
    const p = { type, x, y, vx: 0, vy: 0, phys: !!phys, rest: false, t: Math.random() * 6, view, age: 0 };
    if (phys) { p.vx = phys.vx; p.vy = phys.vy; }
    this.pickups.push(p);
    return p;
  }

  spawnShot(kind, x, y, vx, vy) {
    const cfg = {
      seed: { r: 0.2, grav: 30, color: '#b8ff5a', size: 0.9, enemy: true, life: 4 },
      fire: { r: 0.3, grav: 0, color: '#ff7a2a', size: 1.7, enemy: true, life: 5 },
      rain: { r: 0.35, grav: 0, color: '#ff5a2a', size: 2.0, enemy: true, life: 4 },
      wave: { r: 0.6, grav: 0, color: SWORDS[this.stats.sword].color, size: 2.4, enemy: false, life: 0.5 },
    }[kind];
    const view = glowSprite(cfg.color, cfg.size);
    view.position.set(x, y, 0.3);
    this.layer.add(view);
    const s = { kind, x, y, vx, vy, ...cfg, view, hits: new Set() };
    this.shots.push(s);
    return s;
  }

  // -------------------------------------------------------------- physics
  moveBody(e, dt) {
    const L = this.level;
    e.hitWall = 0;
    e.x += e.vx * dt;
    let y0 = Math.floor(e.y + 0.02), y1 = Math.floor(e.y + e.h - 0.02);
    if (e.vx > 0) { const tx = Math.floor(e.x + e.hw); for (let ty = y0; ty <= y1; ty++) if (L.solid(tx, ty)) { e.x = tx - e.hw - 0.001; e.vx = 0; e.hitWall = 1; break; } }
    else if (e.vx < 0) { const tx = Math.floor(e.x - e.hw); for (let ty = y0; ty <= y1; ty++) if (L.solid(tx, ty)) { e.x = tx + 1 + e.hw + 0.001; e.vx = 0; e.hitWall = -1; break; } }
    const prevY = e.y;
    e.y += e.vy * dt;
    e.ground = false;
    const x0 = Math.floor(e.x - e.hw + 0.02), x1 = Math.floor(e.x + e.hw - 0.02);
    if (e.vy <= 0) {
      const ty = Math.floor(e.y);
      for (let tx = x0; tx <= x1; tx++) {
        const t = L.tile(tx, ty);
        if (t === TILE.SOLID || (t === TILE.ONEWAY && !(e.drop > 0) && prevY >= ty + 1 - 0.001)) { e.y = ty + 1; e.vy = 0; e.ground = true; break; }
      }
      let ride = null;
      if (!e.ground && !(e.drop > 0)) for (const m of this.movers) {
        if (e.x + e.hw > m.x && e.x - e.hw < m.x + m.w && prevY >= m.py - 0.12 && e.y <= m.y + 0.02) { e.y = m.y; e.vy = 0; e.ground = true; ride = m; break; }
      }
      e.ride = ride;
    } else {
      e.ride = null;
      const ty = Math.floor(e.y + e.h);
      for (let tx = x0; tx <= x1; tx++) if (L.solid(tx, ty)) { e.y = ty - e.h - 0.001; e.vy = 0; break; }
    }
  }

  overlap(a, bx0, by0, bx1, by1) { return a.x + a.hw > bx0 && a.x - a.hw < bx1 && a.y + a.h > by0 && a.y < by1; }

  // --------------------------------------------------------------- combat
  playerStrike(p, sword) {
    const x0 = p.face > 0 ? p.x - 0.3 : p.x - sword.reach, x1 = p.face > 0 ? p.x + sword.reach : p.x + 0.3;
    const y0 = p.y - 0.1, y1 = p.y + 2.5;
    for (const e of this.enemies) {
      if (e.dead || e.swingHit === p.swing || !this.overlap(e, x0, y0, x1, y1)) continue;
      e.swingHit = p.swing;
      this.hitEnemy(e, sword.dmg, p.face);
    }
    for (const o of this.objects) if (o.type === 'chest' && !o.open && o.x > x0 - 0.4 && o.x < x1 + 0.4 && o.y + 0.8 > y0 && o.y < y1) this.openChest(o);
    for (const s of this.shots) if (s.enemy && s.kind !== 'rain' && s.x > x0 - s.r && s.x < x1 + s.r && s.y > y0 && s.y < y1) { s.life = 0; this.fx.spark(s.x, s.y); Sound.play('hit'); }
  }

  hitEnemy(e, dmg, dir) {
    if (e.dead || e.state === 'intro' || e.state === 'gone') return;
    e.hp -= dmg;
    e.view.flash(0.12);
    this.fx.spark(e.x, e.y + e.h * 0.6);
    this.hitstop = 0.055; this.shake = Math.max(this.shake, 0.16);
    if (e.type !== 'boss' && e.type !== 'plant') { e.vx = dir * (e.type === 'skel' ? 5 : 7); if (e.grav) { e.vy = 6; e.ground = false; } e.stun = 0.25; }
    if (e.type === 'bat' && e.state === 'hang') e.state = 'chase';
    if (e.hp <= 0) this.killEnemy(e); else Sound.play('hit');
  }

  killEnemy(e) {
    e.dead = true; e.deadT = 0;
    this.levelKills++;
    Sound.play(e.type === 'boss' ? 'boom' : 'kill');
    const col = { slime: [0.4, 1, 0.5], bat: [0.7, 0.4, 1], plant: [1, 0.4, 0.6], skel: [1, 0.95, 0.8], wisp: [1, 0.6, 0.2], boss: [0.8, 0.5, 1] }[e.type];
    this.fx.burst(e.x, e.y + e.h * 0.5, 26, col, { speed: 8, life: 0.7 });
    this.fx.puff(e.x, e.y + 0.3, 8, [0.9, 0.9, 0.9], { size: 0.5 });
    const n = LOOT[e.type];
    for (let i = 0; i < n; i++) this.addPickup('coin', e.x, e.y + e.h * 0.5, { vx: rnd(-4, 4), vy: rnd(8, 14) });
    if (e.type !== 'boss' && Math.random() < 0.14) this.addPickup('heart', e.x, e.y + e.h * 0.5, { vx: rnd(-2, 2), vy: 12 });
    if (e.type === 'skel') e.view.play('Die', { once: true, force: true, fade: 0.05 });
    if (e.type === 'boss') { e.view.play('Hurt', { once: true, force: true }); this.shake = 1; for (const s of this.shots) s.life = 0; this.marks.length = 0; Sound.music(null); }
  }

  openChest(o) {
    o.open = true; o.t = 0; o.glow.visible = true;
    Sound.play('chest');
    this.fx.burst(o.x, o.y + 0.6, 24, [1, 0.85, 0.3], { speed: 7, up: 4, life: 0.8 });
    for (let i = 0; i < 9; i++) this.addPickup('coin', o.x, o.y + 0.7, { vx: rnd(-4.5, 4.5), vy: rnd(10, 17) });
    this.addPickup('gem', o.x, o.y + 0.7, { vx: rnd(-2, 2), vy: 16 });
  }

  // -------------------------------------------------------------- enemies
  updateEnemy(e, dt) {
    const p = this.player, L = this.level, fx = this.fx;
    const dx = p.x - e.x, dy = (p.y + 0.8) - (e.y + e.h * 0.5), adx = Math.abs(dx);
    if (e.dead) {
      e.deadT += dt;
      if (e.type === 'skel') { e.view.update(dt, e.face); if (e.deadT > 1.2) e.view.root.position.y -= dt * 1.2; if (e.deadT > 2.4) return false; return true; }
      if (e.type === 'boss') return this.bossDeath(e, dt);
      const s = Math.max(0, 1 - e.deadT * 5);
      e.view.root.scale.setScalar(s);
      return e.deadT < 0.22;
    }
    if (adx > 34 && e.type !== 'boss') { return true; } // asleep off-screen
    e.t += dt;
    e.stun = (e.stun || 0) - dt;
    switch (e.type) {
      case 'slime': {
        if (e.ground) {
          e.vx *= Math.exp(-12 * dt);
          if (e.t > 1.1 && e.stun <= 0) {
            let dir = adx < 9 && Math.abs(dy) < 4 ? Math.sign(dx) || 1 : e.face;
            if (Math.abs(e.x + dir * 3 - e.home) > 7 && !(adx < 9)) dir = -dir;
            const ahead = L.groundAt(e.x + dir * 3.2);
            if (ahead === 0 || Math.abs(ahead - e.y) > 2.5 || L.tile(Math.floor(e.x + dir * 2), Math.floor(e.y)) === TILE.SPIKE) dir = -dir;
            e.face = dir; e.vx = dir * 4.4; e.vy = 12.5; e.ground = false; e.t = Math.random() * 0.3;
          }
        }
        e.vy -= GRAV * dt; this.moveBody(e, dt);
        e.view.update(dt, e.face, this.time + e.home, !e.ground, e.vy);
        break;
      }
      case 'bat': {
        if (e.state === 'hang') { if (adx < 7.5 && dy > -9 && dy < 1) { e.state = 'chase'; e.t = 0; } }
        else {
          const tx = e.state === 'flee' ? e.x - Math.sign(dx) * 3 : p.x, ty = e.state === 'flee' ? e.homeY + 1 : p.y + 1.0 + Math.sin(e.t * 5) * 0.8;
          const ax2 = clamp(tx - e.x, -1, 1) * 22, ay = clamp(ty - (e.y + 0.3), -1, 1) * 20;
          if (e.stun <= 0) { e.vx += ax2 * dt; e.vy += ay * dt; }
          const sp = Math.hypot(e.vx, e.vy), max = 6.2;
          if (sp > max) { e.vx *= max / sp; e.vy *= max / sp; }
          e.x += e.vx * dt; e.y += e.vy * dt;
          const floor = L.groundAt(e.x) + 0.3; if (e.y < floor) { e.y = floor; e.vy = Math.abs(e.vy) * 0.5; }
          if (e.state === 'flee' && e.t > 1.1) { e.state = 'chase'; e.t = 0; }
          if (dx) e.face = Math.sign(e.vx) || 1;
        }
        if (e.state === 'hang' && !e.roost) e.y = e.homeY + Math.sin(e.t * 2.4) * 0.25;
        e.view.update(dt, e.face, this.time + e.home, e.state === 'hang' && e.roost);
        break;
      }
      case 'plant': {
        e.face = dx > 0 ? 1 : -1;
        const charge = adx < 12 ? clamp((e.t - 1.6) / 0.8, 0, 1) : 0;
        if (adx < 12 && e.t > 2.4) {
          e.t = 0; e.view.spit(); Sound.play('spit');
          const T = clamp(adx / 9, 0.55, 1.1), sx = e.x + e.face * 0.6, sy = e.y + 1.35;
          this.spawnShot('seed', sx, sy, (p.x - sx) / T, ((p.y + 0.9) - sy + 0.5 * 30 * T * T) / T);
        } else if (adx >= 12 && e.t > 1.5) e.t = 1.5;
        e.view.update(dt, e.face, this.time + e.home, charge);
        break;
      }
      case 'skel': {
        const v = e.view;
        const sees = adx < 9 && Math.abs(p.y - e.y) < 2.6;
        if (e.state === 'attack') {
          e.vx *= Math.exp(-10 * dt);
          if (!e.fired && e.t > 0.5) { e.fired = true; e.vx = e.face * 6; Sound.play('slash'); }
          if (e.t > 0.5 && e.t < 0.72 && this.overlap(p, e.face > 0 ? e.x : e.x - 2.1, e.y, e.face > 0 ? e.x + 2.1 : e.x, e.y + 2)) p.hurt(1, e.x);
          if (e.t > 1.15) { e.state = 'patrol'; e.t = 0; }
        } else if (e.stun <= 0) {
          if (sees) e.face = dx > 0 ? 1 : -1;
          else if (Math.abs(e.x - e.home) > 6) e.face = e.x > e.home ? -1 : 1;
          const speed = sees ? 3.3 : 1.7;
          const ahead = L.groundAt(e.x + e.face * 0.7);
          const blocked = ahead === 0 || ahead < e.y - 0.5 || ahead > e.y + 0.5 || L.tile(Math.floor(e.x + e.face * 0.9), Math.floor(e.y)) === TILE.SPIKE;
          if (blocked && !sees) e.face = -e.face;
          e.vx = blocked && sees ? 0 : e.face * speed;
          if (e.hitWall) e.face = -e.face;
          if (sees && adx < 1.9 && e.ground) { e.state = 'attack'; e.t = 0; e.fired = false; e.vx = 0; v.play('Attack', { once: true, force: true, speed: v.duration('Attack') / 1.15, fade: 0.1 }); }
          else if (Math.abs(e.vx) > 0.2) v.play(sees ? 'Run' : 'Walk', { speed: sees ? 0.85 : 1 }); else v.play('Idle');
        }
        e.vy -= GRAV * dt; this.moveBody(e, dt);
        v.update(dt, e.face, 9);
        break;
      }
      case 'wisp': {
        if (adx < 14 && e.stun <= 0) { const d = Math.hypot(dx, dy) || 1; e.vx += (dx / d * 2.7 - e.vx) * dt * 2; e.vy += (dy / d * 2.7 - e.vy) * dt * 2; }
        else { e.vx *= Math.exp(-2 * dt); e.vy *= Math.exp(-2 * dt); }
        e.x += e.vx * dt; e.y += (e.vy + Math.sin(e.t * 3) * 0.6) * dt;
        if (Math.random() < 0.6) fx.flame(e.x, e.y + 0.4, 0.3, 0.6);
        e.view.update(dt, e.face, this.time);
        break;
      }
      case 'boss': this.updateBoss(e, dt, dx, adx); break;
    }
    e.view.root.position.x = e.x; e.view.root.position.y = e.y;
    if (e.y < L.liquidY - 0.6 && e.grav) { e.hp = 0; this.killEnemy(e); return true; }
    // touching the player hurts
    if (!e.dead && e.state !== 'intro' && e.state !== 'gone' && this.overlap(p, e.x - e.hw + 0.08, e.y + 0.08, e.x + e.hw - 0.08, e.y + e.h - 0.08)) {
      p.hurt(1, e.x);
      if (e.type === 'bat') { e.state = 'flee'; e.t = 0; }
    }
    return true;
  }

  updateBoss(e, dt, dx, adx) {
    const p = this.player, L = this.level, fx = this.fx, v = e.view;
    const rage = e.hp <= e.maxHp / 2;
    const lo = L.minX + 6, hi = L.maxX - 6;
    const hoverY = e.baseY - 0.2 + Math.sin(this.time * 1.7) * 0.45;
    const fireAt = (n, spread, speed) => {
      const sx = e.x + e.face * 1.1, sy = e.y + 2.6, a0 = Math.atan2(p.y + 0.9 - sy, p.x - sx);
      for (let i = 0; i < n; i++) { const a = a0 + (i - (n - 1) / 2) * spread; this.spawnShot('fire', sx, sy, Math.cos(a) * speed, Math.sin(a) * speed); }
      Sound.play('fire'); fx.burst(sx, sy, 14, [0.8, 0.5, 1], { speed: 6 });
    };
    e.face = dx > 0 ? 1 : -1;
    switch (e.state) {
      case 'intro':
        e.y += (hoverY - e.y) * Math.min(1, dt * 1.6);
        if (e.t > 2.6) { e.state = 'hover'; e.t = 0; this.ui.banner('Malgrim, the Ashen Sorcerer'); }
        break;
      case 'hover': {
        const tx = clamp(p.x + e.side * 6.5, lo, hi);
        e.x += clamp(tx - e.x, -1, 1) * Math.min(Math.abs(tx - e.x), (rage ? 6 : 4.2) * dt);
        e.y += (hoverY - e.y) * Math.min(1, dt * 3);
        if (e.t > (rage ? 1.15 : 1.9)) {
          const seq = ['volley', 'rain', 'dive', 'volley', 'teleport', 'rain', 'dive'];
          e.state = seq[e.cycle++ % seq.length]; e.t = 0; e.fired = false;
          if (e.state !== 'dive' && e.state !== 'teleport') v.play('Cast', { once: true, force: true, fade: 0.1 });
          if (e.state === 'dive') { e.dir = e.x < p.x ? 1 : -1; e.x0 = e.x; e.x1 = clamp(e.x + e.dir * 22, lo, hi); Sound.play('warp'); }
        }
        break;
      }
      case 'volley':
        if (!e.fired && e.t > 0.5) { e.fired = true; fireAt(rage ? 5 : 3, 0.24, rage ? 10.5 : 8.5); }
        if (rage && e.fired === true && e.t > 0.85) { e.fired = 2; fireAt(2, 0.5, 9); }
        if (e.t > 1.15) { e.state = 'hover'; e.t = 0; v.play('Float'); }
        break;
      case 'rain':
        if (!e.fired && e.t > 0.45) {
          e.fired = true; Sound.play('warp');
          const n = rage ? 7 : 5;
          for (let i = 0; i < n; i++) this.marks.push({ x: clamp(p.x + (i - (n - 1) / 2) * 2.4 + rnd(-0.4, 0.4), L.minX + 5, L.maxX - 5), y: e.baseY - 3.5, t: 0.75 + i * 0.09 });
        }
        if (e.t > 1.3) { e.state = 'hover'; e.t = 0; v.play('Float'); }
        break;
      case 'dive': {
        if (e.t < 0.55) { e.y += dt * 2.2; if (Math.random() < 0.7) fx.burst(e.x, e.y + 1.5, 2, [0.8, 0.4, 1], { speed: 5, life: 0.4 }); }
        else {
          const k = clamp((e.t - 0.55) / 1.25, 0, 1);
          e.x = e.x0 + (e.x1 - e.x0) * k;
          e.y = hoverY + 1.2 - Math.sin(k * Math.PI) * 4.4;
          e.face = e.dir;
          fx.flame(e.x, e.y + 1.2, 0.3, 1.6, [0.8, 0.45, 1], [0.4, 0.1, 0.8]);
          if (k >= 1) { e.state = 'hover'; e.t = 0; e.side = -e.side; }
        }
        break;
      }
      case 'teleport': {
        const s = e.t < 0.35 ? 1 - e.t / 0.35 : (e.t - 0.35) / 0.35;
        if (!e.fired && e.t >= 0.35) { e.fired = true; e.side = -e.side; e.x = clamp(p.x + e.side * 7, lo, hi); Sound.play('warp'); fx.burst(e.x, e.y + 1.5, 24, [0.8, 0.5, 1], { speed: 8 }); }
        v.root.scale.setScalar(clamp(s, 0.001, 1));
        if (e.t > 0.7) { v.root.scale.setScalar(1); e.state = 'volley'; e.t = 0.2; e.fired = false; v.play('Cast', { once: true, force: true }); }
        break;
      }
    }
    e.aura.material.opacity = 0.3 + Math.sin(this.time * 4) * 0.08 + (rage ? 0.25 : 0);
    if (rage && Math.random() < 0.4) fx.flame(e.x + rnd(-0.6, 0.6), e.y + rnd(0.2, 2.6), 0.4, 0.8, [0.9, 0.4, 1], [0.5, 0.1, 0.9]);
    v.update(dt, e.face, 8);
  }

  bossDeath(e, dt) {
    const fx = this.fx;
    e.view.update(dt, e.face);
    e.view.root.position.x = e.x + Math.sin(e.deadT * 60) * 0.08;
    if (Math.random() < 0.5) { fx.burst(e.x + rnd(-1, 1), e.y + rnd(0.3, 3), 12, Math.random() < 0.5 ? [1, 0.7, 0.3] : [0.8, 0.5, 1], { speed: 8, life: 0.7 }); }
    if (Math.floor(e.deadT * 5) !== Math.floor((e.deadT - dt) * 5)) { Sound.play('kill'); this.shake = 0.4; }
    if (e.deadT > 2.4) {
      fx.burst(e.x, e.y + 1.5, 120, [1, 0.9, 0.6], { speed: 16, life: 1.4, size: 0.5 });
      Sound.play('boom'); this.shake = 1.2;
      this.endT = 0;
      return false;
    }
    return true;
  }

  // --------------------------------------------------------------- update
  update(dt) {
    this.time += dt;
    const ui = this.ui;
    if (Input.pressed('mute')) ui.toast(Sound.toggleMute() ? 'Sound off' : 'Sound on');
    if (Input.pressed('full')) { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.().catch(() => {}); }
    switch (this.mode) {
      case 'title':
        this.ambient(dt);
        this.cam.x = this.level.start.x + 9 + Math.sin(this.time * 0.12) * 5; this.cam.y = this.level.start.y + 3.2;
        if (Input.pressed('start') || Input.pressed('jump')) { Sound.init(); Sound.play('select'); this.mode = 'story'; ui.title(false); ui.story(true); Sound.music('title'); }
        break;
      case 'story':
        this.ambient(dt);
        this.cam.x += dt * 0.6;
        if (Input.pressed('start') || Input.pressed('jump') || Input.pressed('attack')) { ui.story(false); this.begin(0, true); }
        break;
      case 'play': this.play(dt); break;
      case 'shop': this.ambient(dt); this.shop(); break;
      case 'pause':
        if (Input.pressed('pause') || Input.pressed('start')) { this.mode = 'play'; ui.pause(false); Sound.duck(false); }
        break;
      case 'clear':
        this.ambient(dt);
        if (Input.pressed('start') || Input.pressed('jump')) { ui.clear(null); this.begin(this.levelIndex + 1, false); }
        break;
      case 'gameover':
        this.ambient(dt);
        if (Input.pressed('start') || Input.pressed('jump')) {
          ui.gameover(false);
          Object.assign(this.stats, { lives: 3, hp: this.stats.maxHp, coins: Math.floor(this.stats.coins / 2) });
          this.begin(this.levelIndex, false);
        }
        break;
      case 'ending':
        this.ambient(dt);
        this.player.view.update(dt, this.player.face);
        if (Input.pressed('start')) location.reload();
        break;
    }
    this.updateCamera(dt);
    ui.hud(this.stats, this.mode === 'play' || this.mode === 'shop' || this.mode === 'pause');
  }

  begin(index, fresh) {
    if (fresh) Object.assign(this.stats, { hp: 3, maxHp: 3, coins: 0, lives: 3, sword: 0, armor: 0 });
    this.loadLevel(index);
    this.mode = 'play';
    this.ui.boss(null); this.ui.clear(null); this.ui.gameover(false); this.ui.ending(false); this.ui.shop(null);
    this.endT = undefined;
    this.ui.banner(this.level.name, this.level.arena ? 'Final Battle' : `Realm ${index + 1}`);
    Sound.music(this.level.music);
  }

  ambient(dt) {
    this.fx.update(dt);
    this.world.update(dt, this.time, this.cam, this.fx, this.camera.aspect);
    for (const o of this.objects) if (o.type === 'merchant') o.view.update(dt, 1);
    if (this.mode === 'title' || this.mode === 'story') this.player.view.update(dt, 1);
  }

  play(dt) {
    const p = this.player, L = this.level, fx = this.fx, ui = this.ui;
    if (Input.pressed('pause')) { this.mode = 'pause'; ui.pause(true); Sound.duck(true); return; }
    if (this.hitstop > 0) { this.hitstop -= dt; fx.update(dt * 0.2); return; }

    for (const m of this.movers) {
      const k = Math.sin(this.time * m.speed * 0.5) * 0.5 + 0.5, px = m.x; m.py = m.y;
      if (m.axis === 'x') m.x = m.x0 + k * m.range; else m.y = m.y0 + k * m.range;
      m.dx = m.x - px;
      m.view.position.set(m.x + m.w / 2, m.y, 0);
    }
    p.update(dt);
    this.enemies = this.enemies.filter((e) => { const keep = this.updateEnemy(e, dt); if (!keep) this.layer.remove(e.view.root); return keep; });

    // boss arena flow
    if (this.boss) {
      ui.boss(this.boss.state === 'intro' ? null : Math.max(0, this.boss.hp / this.boss.maxHp));
      if (this.endT !== undefined) { this.endT += dt; if (this.endT > 2.2) { this.endT = undefined; this.boss = null; ui.boss(null); this.finish(); } }
    }
    // telegraphed flame rain
    this.marks = this.marks.filter((m) => {
      m.t -= dt;
      fx.glow.spawn({ x: m.x + rnd(-0.4, 0.4), y: m.y + 3.6, z: 0.3, vy: 2, life: 0.3, size: 0.45, color: [1, 0.4, 0.1] });
      if (m.t <= 0) { this.spawnShot('rain', m.x, m.y + 17, 0, -19); return false; }
      return true;
    });

    // projectiles
    this.shots = this.shots.filter((s) => {
      s.life -= dt; s.vy -= s.grav * dt; s.x += s.vx * dt; s.y += s.vy * dt;
      s.view.position.set(s.x, s.y, 0.3);
      if (s.kind === 'fire' || s.kind === 'rain') fx.flame(s.x, s.y, 0.3, 0.9, s.kind === 'fire' ? [0.9, 0.5, 1] : undefined, s.kind === 'fire' ? [1, 0.3, 0.1] : undefined);
      if (s.kind === 'wave') { s.view.scale.set(1.3, 3.2 * Math.min(1, s.life * 4), 1); fx.glow.spawn({ x: s.x, y: s.y + rnd(-1, 1), z: 0.3, life: 0.25, size: 0.35, color: [1, 0.7, 0.3] }); }
      let dead = s.life <= 0;
      if (!dead && s.kind !== 'wave' && L.solid(Math.floor(s.x), Math.floor(s.y))) { dead = true; fx.burst(s.x, s.y + 0.3, 10, s.kind === 'seed' ? [0.7, 1, 0.4] : [1, 0.6, 0.2], { speed: 5 }); }
      if (!dead && s.enemy && this.overlap(p, s.x - s.r, s.y - s.r, s.x + s.r, s.y + s.r)) { p.hurt(1, s.x - s.vx); dead = p.inv > 1.2; }
      if (!dead && !s.enemy) for (const e of this.enemies) if (!e.dead && !s.hits.has(e) && this.overlap(e, s.x - s.r, s.y - 1.2, s.x + s.r, s.y + 1.2)) { s.hits.add(e); this.hitEnemy(e, 1, Math.sign(s.vx)); }
      if (dead) this.layer.remove(s.view);
      return !dead;
    });

    // pickups
    const pcx = p.x, pcy = p.y + 0.8;
    this.pickups = this.pickups.filter((k) => {
      k.t += dt; k.age += dt;
      if (k.phys && !k.rest) {
        k.vy -= 40 * dt; k.x += k.vx * dt; k.y += k.vy * dt;
        if (L.solid(Math.floor(k.x + Math.sign(k.vx) * 0.25), Math.floor(k.y))) { k.x -= k.vx * dt; k.vx *= -0.5; }
        const t = L.tile(Math.floor(k.x), Math.floor(k.y - 0.3));
        if (k.vy < 0 && (t === TILE.SOLID || t === TILE.ONEWAY)) { k.y = Math.floor(k.y - 0.3) + 1.3; k.vy *= -0.45; k.vx *= 0.7; if (Math.abs(k.vy) < 2) { k.rest = true; k.vy = 0; } }
        if (k.y < L.liquidY - 1) { this.layer.remove(k.view); return false; }
      }
      const d = Math.hypot(k.x - pcx, k.y - pcy);
      if (!p.dead && k.age > 0.35 && d < 2.6 && k.type !== 'rune') { k.rest = false; k.phys = false; k.x += (pcx - k.x) * Math.min(1, dt * 9); k.y += (pcy - k.y) * Math.min(1, dt * 9); }
      const bob = k.phys ? 0 : Math.sin(k.t * 3) * 0.12;
      k.view.position.set(k.x, k.y + bob, 0);
      k.view.rotation.y = k.type === 'rune' ? Math.sin(k.t * 1.5) * 0.4 : k.t * 3.2;
      if (k.type === 'rune' && Math.random() < 0.3) fx.burst(k.x, k.y, 1, [1, 0.85, 0.35], { speed: 1.5, grav: -2, life: 0.9, size: 0.2 });
      if (!p.dead && k.age > 0.35 && d < (k.type === 'rune' ? 1.2 : 0.75)) { this.collect(k); this.layer.remove(k.view); return false; }
      return true;
    });

    // interactive objects
    this.nearMerchant = null;
    let hint = '';
    for (const o of this.objects) {
      const d = Math.abs(o.x - p.x), dy = Math.abs(o.y - p.y);
      if (o.type === 'chest' && o.open) { o.t += dt; o.lid.rotation.x = -Math.min(1.9, o.t * 9) * (1 - 0.15 * Math.exp(-o.t * 6) * Math.cos(o.t * 20)); o.glow.visible = o.t < 1.2; }
      else if (o.type === 'shrine') {
        if (!o.active && d < 1.3 && dy < 2) {
          for (const s of this.objects) if (s.type === 'shrine' && s.active) { s.active = false; s.gem.emissiveIntensity = 0.15; s.halo.material.opacity = 0; }
          o.active = true; o.gem.emissiveIntensity = 3; this.checkpoint = { x: o.x, y: o.y };
          Sound.play('shrine'); ui.toast('Shrine awakened — checkpoint');
          fx.burst(o.x, o.y + 1.8, 40, [0.4, 0.9, 1], { speed: 7, grav: -3, life: 1 });
          if (this.stats.hp < this.stats.maxHp) this.stats.hp++;
        }
        if (o.active) { o.halo.material.opacity = 0.5 + Math.sin(this.time * 3) * 0.12; if (Math.random() < 0.15) fx.burst(o.x, o.y + 1.8, 1, [0.4, 0.9, 1], { speed: 1.2, grav: -3, life: 1.2, size: 0.2 }); }
      } else if (o.type === 'merchant') {
        o.view.update(dt, p.x > o.x ? 1 : -1, 5);
        if (d < 2.2 && dy < 1.5) { this.nearMerchant = o; hint = document.documentElement.classList.contains('touch') ? '▲  Push the pad up to trade' : '↑  Trade with the merchant'; }
      } else if (o.type === 'sign') { if (d < 1.6 && dy < 2) hint = (this.touch ??= document.documentElement.classList.contains('touch')) && o.touchText ? o.touchText : o.text; }
      else if (o.type === 'portal') {
        const want = this.stats.rune ? 1 : 0;
        o.power += (want - o.power) * Math.min(1, dt * 2);
        o.swirl.material.uniforms.time.value = this.time; o.swirl.material.uniforms.power.value = o.power;
        o.runes.emissiveIntensity = 0.2 + o.power * 3;
        if (want && Math.random() < 0.4) fx.burst(o.x + rnd(-1, 1), o.y + rnd(0.5, 3), 1, [0.5, 0.9, 1], { speed: 1.5, grav: -3, life: 1, size: 0.22 });
        if (d < 3 && dy < 3 && !this.stats.rune) hint = 'The portal is sealed. Find the Rune Stone.';
        if (d < 0.8 && dy < 1.5 && this.stats.rune && p.exitT < 0 && !p.dead && p.ground) { p.exitT = 0; p.exitX = o.x; p.vx = 0; p.slash.visible = false; Sound.play('portal'); }
      }
    }
    if (this.nearMerchant && Input.pressed('up') && p.ground && !p.dead) { this.mode = 'shop'; this.shopSel = 0; Sound.play('select'); ui.shop(this.shopItems(), 0, this.stats.coins); hint = ''; }
    ui.hint(hint);

    this.playerLight.position.set(p.x + p.face * 0.6, p.y + 1.9, 2.4);
    fx.update(dt);
    this.world.update(dt, this.time, this.cam, fx, this.camera.aspect);
  }

  collect(k) {
    const s = this.stats, fx = this.fx;
    switch (k.type) {
      case 'coin': s.coins++; this.levelCoins++; Sound.play('coin'); fx.burst(k.x, k.y, 5, [1, 0.9, 0.4], { speed: 3, life: 0.35, size: 0.2 }); break;
      case 'gem': s.coins += 5; this.levelCoins += 5; Sound.play('gem'); fx.burst(k.x, k.y, 14, [1, 0.4, 0.8], { speed: 5 }); break;
      case 'heart': s.hp = Math.min(s.maxHp, s.hp + 1); Sound.play('heart'); fx.burst(k.x, k.y, 14, [1, 0.3, 0.4], { speed: 5 }); break;
      case 'life': s.lives++; Sound.play('gem'); break;
      case 'rune': s.rune = true; Sound.play('rune'); this.ui.toast('The Rune Stone! The portal stirs…'); fx.burst(k.x, k.y, 60, [1, 0.85, 0.35], { speed: 10, life: 1.1, grav: 2 }); this.shake = 0.3; break;
    }
  }

  // ------------------------------------------------------------------ shop
  shopItems() {
    const s = this.stats;
    return [
      { id: 'potion', name: 'Healing Draught', desc: 'Restores every heart.', cost: 15, off: s.hp >= s.maxHp ? 'Full health' : '' },
      s.armor < 2 ? { id: 'armor', name: ARMORS[s.armor + 1].name, desc: 'Reforged armour: +1 maximum heart.', cost: [40, 90][s.armor] } : { id: 'armor', name: ARMORS[2].name, desc: 'The finest armour in the realm.', off: 'Owned' },
      s.sword < 2 ? { id: 'sword', name: SWORDS[s.sword + 1].name, desc: s.sword === 0 ? 'Longer reach and twice the bite.' : 'Every swing hurls a wave of fire.', cost: [50, 120][s.sword] } : { id: 'sword', name: SWORDS[2].name, desc: 'A blade of living flame.', off: 'Owned' },
      { id: 'life', name: 'Phoenix Feather', desc: 'Grants an extra life.', cost: 75 },
      { id: 'leave', name: 'Farewell', desc: 'Return to the road.' },
    ];
  }

  shop() {
    const items = this.shopItems(), s = this.stats, ui = this.ui;
    let redraw = false, picked = false;
    if (this.shopPick !== undefined) { this.shopSel = this.shopPick; this.shopPick = undefined; picked = true; }
    if (Input.pressed('down')) { this.shopSel = (this.shopSel + 1) % items.length; redraw = true; Sound.play('select'); }
    if (Input.pressed('up')) { this.shopSel = (this.shopSel + items.length - 1) % items.length; redraw = true; Sound.play('select'); }
    const close = () => { this.mode = 'play'; ui.shop(null); };
    if (Input.pressed('pause')) return close();
    if (picked || Input.pressed('start') || Input.pressed('jump') || Input.pressed('attack')) {
      const it = items[this.shopSel];
      if (it.id === 'leave') return close();
      if (it.off || s.coins < it.cost) Sound.play('deny');
      else {
        s.coins -= it.cost; Sound.play('buy');
        if (it.id === 'potion') s.hp = s.maxHp;
        if (it.id === 'armor') { s.armor++; s.maxHp++; s.hp = s.maxHp; }
        if (it.id === 'sword') s.sword++;
        if (it.id === 'life') s.lives++;
        this.player.equip();
        this.fx.burst(this.player.x, this.player.y + 1, 30, [1, 0.9, 0.5], { speed: 6, grav: -2, life: 0.9 });
      }
      redraw = true;
    }
    if (redraw) ui.shop(this.shopItems(), this.shopSel, s.coins);
  }

  // ------------------------------------------------------------------ flow
  onPlayerDead() {
    const s = this.stats;
    s.lives--;
    if (s.lives < 0) { this.mode = 'gameover'; this.ui.gameover(true); Sound.music(null); return; }
    s.hp = s.maxHp;
    this.player.reset(this.checkpoint.x, this.checkpoint.y);
    this.player.inv = 2;
    for (const sh of this.shots) this.layer.remove(sh.view);
    this.shots = []; this.marks = [];
    this.cam.x = this.checkpoint.x; this.cam.floor = this.checkpoint.y;
  }

  levelCleared() {
    const next = this.levelIndex + 1;
    this.mode = 'clear';
    this.ui.clear({ name: this.level.name, coins: this.levelCoins, kills: this.levelKills, next: next < LEVEL_COUNT - 1 ? `Realm ${next + 1}` : 'the Sanctum' });
    Sound.play('rune');
  }

  finish() { this.mode = 'ending'; this.ui.ending(true, this.stats); Sound.music('title'); this.player.view.play('Idle'); }

  updateCamera(dt) {
    const p = this.player, L = this.level, cam = this.camera, c = this.cam;
    const dist = 24.5, halfW = Math.tan(cam.fov * Math.PI / 360) * dist * cam.aspect;
    if (this.mode === 'play' || this.mode === 'shop') {
      if (p.ground || p.y < c.floor - 0.5 || p.y > c.floor + 4) c.floor += (p.y - c.floor) * Math.min(1, dt * (p.ground ? 5 : 3));
      const tx = p.x + p.face * 2.4, ty = c.floor + 2.7;
      c.x += (tx - c.x) * Math.min(1, dt * 3.5); c.y += (ty - c.y) * Math.min(1, dt * 4);
    }
    const lo = L.minX + halfW - 4, hi = L.maxX - halfW + 4;
    c.x = lo < hi ? clamp(c.x, lo, hi) : (L.minX + L.maxX) / 2;
    c.y = Math.max(c.y, L.liquidY + 4.4);
    this.shake = Math.max(0, this.shake - dt * 1.8);
    const sx = (Math.random() - 0.5) * this.shake * 0.7, sy = (Math.random() - 0.5) * this.shake * 0.7;
    cam.position.set(c.x + sx, c.y + 1.5 + sy, dist);
    cam.lookAt(c.x + sx, c.y - 0.2 + sy, 0);
  }
}
