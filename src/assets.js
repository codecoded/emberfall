import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';

const FILES = ['hero', 'skeleton', 'sorcerer', 'merchant', 'creatures', 'props'];
export const Assets = { gltf: {}, props: {} };

const EMISSIVE = { glow: 2.6, crystal: 0.85, heart: 1.1, shrine_gem: 0.15, portal_rune: 0.2, lava_rock: 2 };

function fix(g) {
  const seen = new Set();
  g.scene.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = !o.isSkinnedMesh;
    o.frustumCulled = !o.isSkinnedMesh;
    const geo = o.geometry;
    if (!seen.has(geo)) {
      seen.add(geo);
      const c = geo.attributes.color;
      if (c) { // Blender byte colours arrive sRGB-encoded
        const out = new Float32Array(c.count * 3), col = new THREE.Color();
        for (let i = 0; i < c.count; i++) { col.setRGB(c.getX(i), c.getY(i), c.getZ(i), THREE.SRGBColorSpace); out[i * 3] = col.r; out[i * 3 + 1] = col.g; out[i * 3 + 2] = col.b; }
        geo.setAttribute('color', new THREE.BufferAttribute(out, 3));
      }
    }
    const m = o.material;
    if (!seen.has(m)) {
      seen.add(m);
      m.flatShading = !/slime|cloud/.test(o.name + (o.parent ? o.parent.name : ''));
      for (const k in EMISSIVE) if (m.name.startsWith(k)) m.emissiveIntensity = EMISSIVE[k];
      if (m.name === 'metal') { m.metalness = 0.55; m.roughness = 0.4; m.envMapIntensity = 1.4; }
    }
  });
  for (const clip of g.animations) {
    let t0 = Infinity;
    for (const tr of clip.tracks) t0 = Math.min(t0, tr.times[0]);
    for (const tr of clip.tracks) for (let i = 0; i < tr.times.length; i++) tr.times[i] -= t0;
    clip.tracks = clip.tracks.filter((tr) => !tr.name.endsWith('.scale'));
    clip.resetDuration();
  }
}

export async function loadAssets(onProgress) {
  const loader = new GLTFLoader();
  let n = 0;
  await Promise.all(FILES.map(async (f) => {
    const g = await loader.loadAsync(new URL(`../assets/${f}.glb`, location.href).href);
    fix(g);
    Assets.gltf[f] = g;
    onProgress(++n / FILES.length);
  }));
  for (const f of ['creatures', 'props']) for (const c of Assets.gltf[f].scene.children) Assets.props[c.name] = c;
}

/** Clone of a static prop, origin at its base. `keepPivot` preserves the authored pivot offset. */
export function makeProp(name, keepPivot = false) {
  const src = Assets.props[name];
  if (!src) throw new Error('missing prop ' + name);
  const o = src.clone();
  if (!keepPivot) o.position.set(0, 0, 0);
  return o;
}

export function ownMaterials(root) {
  const map = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (!map.has(o.material)) map.set(o.material, o.material.clone());
    o.material = map.get(o.material);
  });
  return [...map.values()];
}

export function makeCharacter(key) {
  const g = Assets.gltf[key];
  const model = skeletonClone(g.scene);
  return { model, clips: g.animations };
}

/** One InstancedMesh per sub-mesh of the named prop. items: [{x,y,z,s,ry,rx,sx,sy,sz}] */
export function instanced(name, items, opts = {}) {
  const src = Assets.props[name];
  const group = new THREE.Group();
  if (!src || !items.length) return group;
  const meshes = [];
  src.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
  for (const mesh of meshes) {
    const im = new THREE.InstancedMesh(mesh.geometry, mesh.material, items.length);
    items.forEach((it, i) => {
      e.set(it.rx || 0, it.ry || 0, it.rz || 0);
      q.setFromEuler(e);
      p.set(it.x, it.y, it.z);
      const k = it.s ?? 1;
      s.set(k * (it.sx ?? 1), k * (it.sy ?? 1), k * (it.sz ?? 1));
      im.setMatrixAt(i, m4.compose(p, q, s));
      if (it.tint) im.setColorAt(i, it.tint);
    });
    im.castShadow = opts.castShadow ?? true;
    im.receiveShadow = opts.receiveShadow ?? false;
    im.frustumCulled = false;
    group.add(im);
  }
  return group;
}
