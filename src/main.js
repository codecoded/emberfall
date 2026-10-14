import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import '@fontsource/cinzel/400.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/cinzel-decorative/700.css';
import '@fontsource/cinzel-decorative/900.css';
import './style.css';
import { loadAssets } from './assets.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { FX } from './fx.js';
import { createUI } from './ui.js';
import { Game } from './game.js';

const ui = createUI(document.getElementById('ui'));
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;
const camera = new THREE.PerspectiveCamera(28, 16 / 9, 1, 600);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.7, 0.88);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const fx = new FX(scene);

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h); composer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  fx.resize(h * renderer.getPixelRatio());
}
addEventListener('resize', resize);
resize();

function applyTheme(T) {
  [bloom.strength, bloom.radius, bloom.threshold] = T.bloom;
  renderer.toneMappingExposure = T.exposure;
  scene.environmentIntensity = T.cave ? 0.25 : 0.4;
}

await loadAssets((f) => ui.loading(f * 0.9));
const game = new Game({ scene, camera, fx, ui, applyTheme });
window.__game = game;
Input.onAny(() => Sound.init());
ui.loading(1);

const STEP = 1 / 60;
let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(0.1, (now - last) / 1000); last = now;
  let n = 0;
  while (!window.__freeze && acc >= STEP && n++ < 4) { Input.update(); game.update(STEP); acc -= STEP; }
  if (n >= 4) acc = 0;
  composer.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// debug helper: advance the simulation without waiting for frames
window.__step = (frames = 60) => { for (let i = 0; i < frames; i++) { Input.update(); game.update(STEP); } composer.render(); };

window.__key = (code, down = true) => dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
window.__tap = (code, frames = 2) => { window.__key(code, true); window.__step(frames); window.__key(code, false); window.__step(1); };
