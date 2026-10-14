// All sound is synthesised: a tiny tracker-style sequencer plus one-shot SFX.
let ctx = null, master, musicBus, sfxBus, delay, noiseBuf;
let muted = false, song = null, timer = null, step = 0, nextT = 0;

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function init() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.8;
  const comp = ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination);
  musicBus = ctx.createGain(); musicBus.gain.value = 0.5; musicBus.connect(master);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.7; sfxBus.connect(master);
  delay = ctx.createDelay(1); delay.delayTime.value = 0.33;
  const fb = ctx.createGain(); fb.gain.value = 0.38;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
  const wet = ctx.createGain(); wet.gain.value = 0.32;
  delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(wet); wet.connect(musicBus);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  if (song) start(song);
}

function tone({ type = 'square', f0, f1, dur = 0.15, vol = 0.2, t = 0, bus = sfxBus, attack = 0.005, cutoff, echo = 0, vib = 0 }) {
  if (!ctx) return;
  const t0 = Math.max(ctx.currentTime, t || ctx.currentTime);
  const o = ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  if (vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 5.5; lg.gain.value = vib; l.connect(lg); lg.connect(o.frequency); l.start(t0); l.stop(t0 + dur + 0.05); }
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
  let out = o;
  if (cutoff) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = 2; o.connect(f); out = f; }
  out.connect(g); g.connect(bus);
  if (echo) { const e = ctx.createGain(); e.gain.value = echo; g.connect(e); e.connect(delay); }
  o.start(t0); o.stop(t0 + dur + 0.05);
}

function noise({ dur = 0.1, vol = 0.2, t = 0, bus = sfxBus, type = 'bandpass', f0 = 2000, f1, q = 1 }) {
  if (!ctx) return;
  const t0 = Math.max(ctx.currentTime, t || ctx.currentTime);
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t0);
  if (f1) f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
  s.connect(f); f.connect(g); g.connect(bus);
  s.start(t0, Math.random()); s.stop(t0 + dur + 0.02);
}

const SFX = {
  jump: () => tone({ type: 'triangle', f0: 260, f1: 620, dur: 0.16, vol: 0.22 }),
  land: () => noise({ dur: 0.09, vol: 0.2, type: 'lowpass', f0: 500, f1: 120 }),
  slash: () => { noise({ dur: 0.13, vol: 0.26, f0: 5200, f1: 1100, q: 1.4 }); tone({ type: 'sawtooth', f0: 900, f1: 240, dur: 0.09, vol: 0.05 }); },
  hit: () => { noise({ dur: 0.1, vol: 0.34, type: 'lowpass', f0: 2600, f1: 300 }); tone({ type: 'square', f0: 210, f1: 70, dur: 0.12, vol: 0.2 }); },
  kill: () => { noise({ dur: 0.25, vol: 0.3, type: 'lowpass', f0: 1800, f1: 200 }); tone({ type: 'square', f0: 330, f1: 55, dur: 0.28, vol: 0.2 }); },
  coin: () => { const t = ctx.currentTime; tone({ f0: 1319, dur: 0.07, vol: 0.12, t }); tone({ f0: 1976, dur: 0.22, vol: 0.12, t: t + 0.06 }); },
  gem: () => { const t = ctx.currentTime;[1047, 1319, 1568, 2093].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.18, vol: 0.16, t: t + i * 0.05 })); },
  heart: () => { const t = ctx.currentTime;[523, 659, 784].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.2, vol: 0.2, t: t + i * 0.07 })); },
  hurt: () => { tone({ type: 'sawtooth', f0: 320, f1: 70, dur: 0.32, vol: 0.26 }); noise({ dur: 0.15, vol: 0.2, type: 'lowpass', f0: 1200 }); },
  die: () => { const t = ctx.currentTime;[440, 392, 330, 262, 196, 131].forEach((f, i) => tone({ type: 'square', f0: f, dur: 0.22, vol: 0.2, t: t + i * 0.13, cutoff: 1800 })); },
  chest: () => { const t = ctx.currentTime; noise({ dur: 0.12, vol: 0.25, type: 'lowpass', f0: 900 });[392, 523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.22, vol: 0.18, t: t + 0.08 + i * 0.06 })); },
  shrine: () => { const t = ctx.currentTime;[330, 440, 554, 659, 880].forEach((f, i) => tone({ type: 'sine', f0: f, dur: 0.6, vol: 0.2, t: t + i * 0.09 })); },
  rune: () => { const t = ctx.currentTime;[294, 370, 440, 587, 740, 880, 1175].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.7, vol: 0.18, t: t + i * 0.08 })); },
  buy: () => { const t = ctx.currentTime;[784, 988, 1175, 1568].forEach((f, i) => tone({ f0: f, dur: 0.12, vol: 0.13, t: t + i * 0.06 })); },
  deny: () => { const t = ctx.currentTime; tone({ f0: 160, dur: 0.12, vol: 0.2, t }); tone({ f0: 120, dur: 0.2, vol: 0.2, t: t + 0.12 }); },
  select: () => tone({ type: 'triangle', f0: 700, dur: 0.05, vol: 0.14 }),
  portal: () => { tone({ type: 'sine', f0: 110, f1: 880, dur: 1.4, vol: 0.28 }); noise({ dur: 1.4, vol: 0.14, f0: 400, f1: 6000, q: 3 }); },
  fire: () => noise({ dur: 0.35, vol: 0.26, type: 'lowpass', f0: 2400, f1: 200 }),
  spit: () => tone({ type: 'square', f0: 520, f1: 150, dur: 0.14, vol: 0.14 }),
  wave: () => { tone({ type: 'sawtooth', f0: 220, f1: 990, dur: 0.22, vol: 0.12, cutoff: 3000 }); noise({ dur: 0.2, vol: 0.14, f0: 3000, f1: 800 }); },
  boom: () => { noise({ dur: 0.7, vol: 0.5, type: 'lowpass', f0: 1400, f1: 60 }); tone({ type: 'sine', f0: 120, f1: 30, dur: 0.7, vol: 0.5 }); },
  warp: () => tone({ type: 'sine', f0: 1400, f1: 200, dur: 0.3, vol: 0.16 }),
};

// ---- music ---------------------------------------------------------------
const m = [0, 3, 7], M = [0, 4, 7];
const SONGS = {
  title: { bpm: 84, chords: [[57, m], [53, M], [48, M], [55, M], [57, m], [53, M], [55, M], [52, M]], drums: 0, lead: [
    [76, 0, 81, 0, 79, 76, 0, 74], [72, 0, 77, 0, 76, 72, 0, 69], [76, 0, 79, 0, 84, 0, 83, 79], [74, 0, 0, 71, 74, 0, 79, 0],
    [81, 0, 84, 0, 83, 81, 0, 76], [77, 0, 81, 0, 79, 77, 0, 72], [79, 0, 83, 0, 86, 0, 83, 79], [76, 0, 0, 0, 80, 0, 83, 0]] },
  woods: { bpm: 108, chords: [[57, m], [53, M], [48, M], [55, M], [57, m], [53, M], [55, M], [52, M]], drums: 1, lead: [
    [76, 0, 81, 0, 79, 76, 0, 74], [72, 0, 77, 0, 76, 72, 0, 69], [76, 0, 79, 0, 84, 0, 83, 79], [74, 0, 0, 71, 74, 0, 79, 0],
    [81, 0, 84, 0, 83, 81, 0, 76], [77, 0, 81, 0, 79, 77, 0, 72], [79, 0, 83, 0, 86, 0, 83, 79], [76, 0, 0, 0, 80, 0, 83, 0]] },
  hollow: { bpm: 92, chords: [[50, m], [46, M], [43, m], [45, M], [50, m], [46, M], [48, M], [45, M]], drums: 2, lead: [
    [74, 0, 0, 77, 0, 0, 81, 0], [77, 0, 0, 74, 0, 70, 0, 0], [79, 0, 0, 0, 74, 0, 70, 0], [73, 0, 76, 0, 0, 0, 69, 0],
    [81, 0, 0, 77, 0, 0, 74, 0], [82, 0, 0, 0, 77, 0, 74, 0], [79, 0, 76, 0, 72, 0, 76, 0], [73, 0, 0, 0, 0, 0, 0, 0]] },
  keep: { bpm: 124, chords: [[52, m], [48, M], [50, M], [47, M], [52, m], [48, M], [45, m], [47, M]], drums: 3, lead: [
    [76, 0, 76, 79, 0, 83, 0, 79], [76, 0, 72, 0, 79, 0, 76, 0], [78, 0, 78, 81, 0, 86, 0, 81], [75, 0, 0, 78, 0, 83, 0, 0],
    [88, 0, 86, 83, 0, 79, 0, 76], [84, 0, 79, 0, 76, 0, 72, 0], [81, 0, 76, 0, 72, 0, 69, 0], [75, 0, 78, 0, 83, 0, 87, 0]] },
  boss: { bpm: 148, chords: [[52, m], [53, M], [52, m], [50, m], [52, m], [53, M], [55, M], [53, M]], drums: 3, lead: [
    [76, 76, 0, 79, 0, 76, 83, 0], [77, 77, 0, 81, 0, 77, 84, 0], [76, 76, 0, 79, 0, 76, 88, 0], [74, 0, 77, 0, 81, 0, 86, 0],
    [88, 0, 86, 0, 83, 0, 79, 0], [89, 0, 84, 0, 81, 0, 77, 0], [91, 0, 86, 0, 83, 0, 79, 0], [89, 0, 0, 84, 0, 81, 77, 0]] },
};

function schedule(s, i, t) {
  const spb = 60 / s.bpm / 4;
  const bar = Math.floor(i / 16), pos = i % 16, n = s.chords.length;
  const pass = Math.floor(bar / n) % 4;
  const [root, ch] = s.chords[bar % n];
  // bass
  const bp = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0][pos];
  if (bp) tone({ type: 'triangle', f0: mtof(root - 12 + (pos === 11 ? 12 : pos === 13 ? 7 : 0)), dur: spb * 2.6, vol: 0.3, t, bus: musicBus });
  // arpeggio
  const arp = [0, 1, 2, 1, 3, 2, 1, 2][pos % 8];
  const note = root + 12 + (arp === 3 ? 12 : ch[arp]);
  if (pass !== 0 || pos % 2 === 0) tone({ type: 'square', f0: mtof(note), dur: spb * 1.4, vol: 0.055, t, bus: musicBus, cutoff: 1500 + 900 * Math.sin(bar * 0.7), echo: 0.5 });
  // lead on later passes
  if (pass >= 1 && pos % 2 === 0) {
    const l = s.lead[bar % n][pos / 2];
    if (l) tone({ type: pass === 3 ? 'sawtooth' : 'triangle', f0: mtof(l - (pass === 2 ? 12 : 0)), dur: spb * 3.2, vol: pass === 3 ? 0.07 : 0.13, t, bus: musicBus, cutoff: 3200, echo: 0.6, vib: 4, attack: 0.02 });
  }
  if (s.drums) {
    if (pos % 8 === 0) tone({ type: 'sine', f0: 130, f1: 38, dur: 0.2, vol: 0.42, t, bus: musicBus });
    if (s.drums >= 3 && (pos === 6 || pos === 10)) tone({ type: 'sine', f0: 120, f1: 38, dur: 0.16, vol: 0.3, t, bus: musicBus });
    if (pos % 8 === 4 && s.drums !== 2) noise({ dur: 0.14, vol: 0.16, t, bus: musicBus, type: 'highpass', f0: 1800 });
    if (pos % 2 === 0) noise({ dur: 0.035, vol: s.drums === 2 ? 0.035 : 0.06, t, bus: musicBus, type: 'highpass', f0: 7000 });
    if (s.drums === 2 && pos === 12) tone({ type: 'sine', f0: 1760, dur: 0.5, vol: 0.05, t, bus: musicBus, echo: 0.9 });
  }
}

function start(name) {
  song = name;
  if (!ctx) return;
  clearInterval(timer);
  const s = SONGS[name];
  if (!s) return;
  step = 0; nextT = ctx.currentTime + 0.08;
  delay.delayTime.setValueAtTime(60 / s.bpm * 0.75, ctx.currentTime);
  timer = setInterval(() => {
    const spb = 60 / s.bpm / 4;
    while (nextT < ctx.currentTime + 0.25) { schedule(s, step++, nextT); nextT += spb; }
  }, 60);
}

export const Sound = {
  init,
  play(name) { if (ctx && !muted && SFX[name]) SFX[name](); },
  music(name) { if (name === song && timer) return; if (!name) { clearInterval(timer); timer = null; song = null; return; } start(name); },
  toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.8; return muted; },
  duck(on) { if (musicBus) musicBus.gain.setTargetAtTime(on ? 0.2 : 0.5, ctx.currentTime, 0.1); },
};
