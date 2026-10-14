// EMBERFALL Classic — WebAudio: tracker-style sequencer + synthesized SFX.

let ac = null, master, musicBus, sfxBus, echoIn, noiseBuf;
let muted = false;
let cur = null, timer = null, nextT = 0, step = 0;

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

// Tune format: 8th-note lead tokens per bar (semitones above root+24; '.'=hold, '-'=rest),
// chords per bar [semitone offset from root, 'm'|'M'], 16-step drum/bass patterns.
const TUNES = {
  title: {
    bpm: 92, root: 45, arpVol: 0.5, leadWave: 'triangle',
    chords: [[0, 'm'], [-4, 'M'], [3, 'M'], [-2, 'M'], [0, 'm'], [-4, 'M'], [7, 'M'], [7, 'M']],
    lead: ['7 . . 12 . 10 8 7', '8 . . 12 . 8 7 5', '7 . . 10 . 7 5 3', '5 . . 2 . 5 7 .',
      '12 . . 15 . 14 12 10', '12 . 8 . 5 . 8 .', '11 . . 14 . 11 8 7', '7 . . . 11 . 8 .'],
    bass: 'x.....x.x.....o.', k: 'x.......x.......', s: '....x.......x...', h: '..x...x...x...x.',
  },
  woods: {
    bpm: 108, root: 38, arpVol: 0.55, leadWave: 'square',
    chords: [[0, 'm'], [-4, 'M'], [3, 'M'], [-2, 'M'], [0, 'm'], [5, 'm'], [7, 'M'], [7, 'M']],
    lead: ['0 3 7 . 5 3 2 3', '8 . 7 5 3 . 5 .', '7 10 12 . 10 7 5 7', '5 . 2 . -2 . . .',
      '12 . 10 12 15 . 12 .', '10 . 8 7 5 . 7 8', '7 . 11 . 14 . 11 .', '14 . 11 . 7 . . .'],
    bass: 'x..x..x.x..x..o.', k: 'x.....x.x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.xx',
  },
  cave: {
    bpm: 84, root: 40, arpVol: 0.7, leadWave: 'triangle',
    chords: [[0, 'm'], [0, 'm'], [-4, 'M'], [-2, 'M'], [0, 'm'], [5, 'm'], [7, 'M'], [7, 'M']],
    lead: ['7 . . . 3 . . .', '2 . 3 . 7 . . .', '8 . . . 3 . . .', '2 . 5 . 10 . . .',
      '12 . . . 10 . 7 .', '8 . 5 . 0 . . .', '11 . . . 2 . . .', '7 . . . - . . .'],
    bass: 'x.......x.....x.', k: 'x.........x.....', s: '........x.......', h: '....x.......x.x.',
  },
  keep: {
    bpm: 120, root: 36, arpVol: 0.5, leadWave: 'sawtooth',
    chords: [[0, 'm'], [0, 'm'], [-4, 'M'], [-2, 'M'], [0, 'm'], [5, 'm'], [7, 'M'], [7, 'M']],
    lead: ['0 . 0 3 7 . 3 .', '8 7 3 . 2 . 0 .', '8 . 8 12 15 . 12 .', '14 . 10 . 5 . 10 .',
      '12 . 12 15 19 . 15 .', '17 . 15 12 8 . 12 .', '14 . 11 . 7 . 11 .', '14 . . . 11 . 7 .'],
    bass: 'x.x.o.x.x.x.o.xx', k: 'x...x...x...x.x.', s: '....x.......x...', h: 'x.xxx.xxx.xxx.xx',
  },
  boss: {
    bpm: 140, root: 38, arpVol: 0.45, leadWave: 'sawtooth',
    chords: [[0, 'm'], [0, 'm'], [-4, 'M'], [7, 'M'], [0, 'm'], [0, 'm'], [5, 'm'], [7, 'M']],
    lead: ['0 12 0 12 3 12 0 12', '0 12 0 12 5 12 3 12', '8 12 8 12 10 12 8 12', '7 11 7 11 14 11 7 .',
      '12 . 15 . 14 12 10 12', '15 . 17 . 19 . . .', '17 15 12 . 15 12 10 .', '13 . 11 . 9 . 7 .'],
    bass: 'x.xxo.xxx.xxo.xx', k: 'x..x..x.x..x..x.', s: '....x.......x..x', h: 'xxxxxxxxxxxxxxxx',
  },
  ending: {
    bpm: 100, root: 43, arpVol: 0.6, leadWave: 'triangle',
    chords: [[0, 'M'], [5, 'M'], [-3, 'm'], [7, 'M'], [0, 'M'], [5, 'M'], [7, 'M'], [0, 'M']],
    lead: ['4 . 7 . 12 . 11 12', '9 . 12 . 17 . 16 .', '12 . 9 . 4 . 7 9', '11 . 7 . 2 . . .',
      '16 . 14 12 11 . 12 .', '9 . 12 . 17 . 21 .', '19 . 14 . 11 . 14 .', '12 . . . 12 . . .'],
    bass: 'x.....x.x...o...', k: 'x.......x.....x.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.',
  },
};
for (const k in TUNES) TUNES[k].leadSteps = TUNES[k].lead.map((b) => b.split(' '));

function env(g, t, a, d, peak, sus = 0.0001) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sus), t + a + d);
}
function tone(type, f, t, dur, vol, dest, opt = {}) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (opt.to) o.frequency.exponentialRampToValueAtTime(Math.max(20, opt.to), t + dur);
  if (opt.vib) {
    const l = ac.createOscillator(), lg = ac.createGain();
    l.frequency.value = 5.5; lg.gain.value = f * 0.012;
    l.connect(lg); lg.connect(o.frequency); l.start(t + 0.08); l.stop(t + dur + 0.05);
  }
  env(g, t, opt.a ?? 0.005, dur, vol);
  let node = o;
  if (opt.lp) { const f2 = ac.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = opt.lp; f2.Q.value = opt.q || 1; o.connect(f2); node = f2; }
  node.connect(g); g.connect(dest);
  o.start(t); o.stop(t + dur + 0.05);
}
function noise(t, dur, vol, dest, opt = {}) {
  const s = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
  s.buffer = noiseBuf; s.loop = true;
  f.type = opt.type || 'highpass'; f.frequency.setValueAtTime(opt.f || 4000, t); f.Q.value = opt.q || 0.7;
  if (opt.to) f.frequency.exponentialRampToValueAtTime(opt.to, t + dur);
  env(g, t, opt.a ?? 0.002, dur, vol);
  s.connect(f); f.connect(g); g.connect(dest);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}

function schedule() {
  if (!ac || !cur) return;
  const T = TUNES[cur], spb = 60 / T.bpm / 4; // seconds per 16th
  while (nextT < ac.currentTime + 0.14) {
    const bar = Math.floor(step / 16) % T.chords.length, s = step % 16, t = nextT;
    const [off, kind] = T.chords[bar];
    const root = T.root + off;
    const chord = [0, kind === 'm' ? 3 : 4, 7, 12, 7, kind === 'm' ? 3 : 4];
    // bass
    const b = T.bass[s];
    if (b !== '.') tone('sawtooth', midi(root + (b === 'o' ? 12 : 0)), t, spb * 1.8, 0.2, musicBus, { lp: 520, q: 3 });
    // arpeggio
    tone('square', midi(root + 24 + chord[step % chord.length]), t, spb * 0.9, 0.045 * T.arpVol, echoIn, { lp: 2600 });
    // lead (8th-note grid)
    if (s % 2 === 0) {
      const ls = T.leadSteps[bar], i = s / 2, tok = ls[i];
      if (tok !== '.' && tok !== '-') {
        let len = 1;
        while (i + len < 8 && ls[i + len] === '.') len++;
        tone(T.leadWave, midi(T.root + 24 + parseInt(tok, 10)), t, spb * 2 * len * 0.95, T.leadWave === 'triangle' ? 0.13 : 0.06, echoIn, { vib: len > 1, a: 0.012, lp: 3200 });
      }
    }
    // drums
    if (T.k[s] === 'x') tone('sine', 130, t, 0.16, 0.38, musicBus, { to: 38 });
    if (T.s[s] === 'x') { noise(t, 0.14, 0.14, musicBus, { type: 'bandpass', f: 1800, q: 0.6 }); tone('triangle', 190, t, 0.08, 0.1, musicBus, { to: 110 }); }
    if (T.h[s] === 'x') noise(t, 0.035, 0.035, musicBus, { f: 7000 });
    nextT += spb; step++;
  }
}

const SFX = {
  jump: (t) => tone('square', 260, t, 0.13, 0.09, sfxBus, { to: 620 }),
  land: (t) => { tone('sine', 110, t, 0.09, 0.2, sfxBus, { to: 50 }); noise(t, 0.05, 0.05, sfxBus, { type: 'lowpass', f: 900 }); },
  slash: (t) => noise(t, 0.12, 0.16, sfxBus, { type: 'bandpass', f: 5200, to: 900, q: 1.5 }),
  hit: (t) => { noise(t, 0.09, 0.2, sfxBus, { type: 'bandpass', f: 1400, q: 0.8 }); tone('square', 220, t, 0.1, 0.12, sfxBus, { to: 70 }); },
  kill: (t) => { noise(t, 0.2, 0.18, sfxBus, { type: 'lowpass', f: 2600, to: 300 }); tone('square', 330, t, 0.2, 0.1, sfxBus, { to: 55 }); },
  coin: (t) => { tone('square', 988, t, 0.06, 0.08, sfxBus); tone('square', 1319, t + 0.06, 0.16, 0.08, sfxBus); },
  gem: (t) => { [1047, 1319, 1568, 2093].forEach((f, i) => tone('triangle', f, t + i * 0.045, 0.12, 0.12, sfxBus)); },
  heart: (t) => { [523, 659, 784].forEach((f, i) => tone('triangle', f, t + i * 0.07, 0.16, 0.14, sfxBus)); },
  hurt: (t) => { tone('sawtooth', 420, t, 0.28, 0.14, sfxBus, { to: 90 }); noise(t, 0.1, 0.1, sfxBus, { type: 'lowpass', f: 1500 }); },
  death: (t) => { [392, 330, 262, 196, 147, 98].forEach((f, i) => tone('square', f, t + i * 0.11, 0.18, 0.11, sfxBus)); },
  chest: (t) => { [262, 330, 392, 523, 659].forEach((f, i) => tone('square', f, t + i * 0.055, 0.12, 0.08, sfxBus)); },
  checkpoint: (t) => { [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, t + i * 0.09, 0.5, 0.12, echoIn)); },
  buy: (t) => { tone('square', 659, t, 0.08, 0.09, sfxBus); tone('square', 988, t + 0.08, 0.2, 0.09, sfxBus); },
  deny: (t) => { tone('sawtooth', 110, t, 0.12, 0.13, sfxBus); tone('sawtooth', 98, t + 0.12, 0.16, 0.13, sfxBus); },
  select: (t) => tone('square', 660, t, 0.04, 0.06, sfxBus),
  portal: (t) => { tone('sawtooth', 110, t, 1.2, 0.12, echoIn, { to: 1760, lp: 3000 }); tone('triangle', 220, t, 1.2, 0.12, echoIn, { to: 2640 }); },
  rune: (t) => { [392, 494, 587, 784, 988, 1175].forEach((f, i) => tone('triangle', f, t + i * 0.08, 0.6, 0.12, echoIn)); },
  fireball: (t) => { noise(t, 0.25, 0.13, sfxBus, { type: 'lowpass', f: 2400, to: 300 }); tone('sawtooth', 300, t, 0.2, 0.06, sfxBus, { to: 90 }); },
  spit: (t) => tone('square', 500, t, 0.09, 0.07, sfxBus, { to: 180 }),
  warn: (t) => { tone('square', 880, t, 0.07, 0.07, sfxBus); tone('square', 880, t + 0.12, 0.07, 0.07, sfxBus); },
  teleport: (t) => tone('triangle', 1400, t, 0.3, 0.1, echoIn, { to: 200 }),
  boom: (t) => { noise(t, 0.6, 0.3, sfxBus, { type: 'lowpass', f: 1800, to: 120 }); tone('sine', 90, t, 0.5, 0.3, sfxBus, { to: 30 }); },
  wave: (t) => noise(t, 0.2, 0.1, sfxBus, { type: 'bandpass', f: 1200, to: 4000, q: 2 }),
  clear: (t) => { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone('square', f, t + i * 0.12, 0.22, 0.09, echoIn)); },
  gameover: (t) => { [330, 311, 294, 247, 196, 165].forEach((f, i) => tone('triangle', f, t + i * 0.22, 0.4, 0.16, echoIn)); },
};

export const audio = {
  get ready() { return !!ac; },
  get muted() { return muted; },
  current: null,
  init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ac = new AC(); } catch (e) { return; }
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.8;
    const comp = ac.createDynamicsCompressor();
    master.connect(comp); comp.connect(ac.destination);
    musicBus = ac.createGain(); musicBus.gain.value = 0.55; musicBus.connect(master);
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master);
    // feedback delay — the Amiga MOD echo
    echoIn = ac.createGain(); echoIn.connect(musicBus);
    const dl = ac.createDelay(1.0), fb = ac.createGain(), lp = ac.createBiquadFilter();
    dl.delayTime.value = 0.33; fb.gain.value = 0.36; lp.type = 'lowpass'; lp.frequency.value = 2400;
    echoIn.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl);
    const wet = ac.createGain(); wet.gain.value = 0.5; lp.connect(wet); wet.connect(musicBus);
    this._delay = dl;
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    timer = setInterval(schedule, 30);
    if (this.current) { const c = this.current; this.current = null; this.music(c); }
  },
  music(name) {
    if (this.current === name) return;
    this.current = name;
    if (!ac) return;
    cur = name && TUNES[name] ? name : null;
    step = 0; nextT = ac.currentTime + 0.08;
    if (cur) this._delay.delayTime.setValueAtTime((60 / TUNES[cur].bpm / 4) * 3, ac.currentTime);
  },
  sfx(name) {
    if (!ac || muted || !SFX[name]) return;
    try { SFX[name](ac.currentTime + 0.005); } catch (e) { /* ignore */ }
  },
  toggleMute() {
    muted = !muted;
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.8, ac.currentTime, 0.02);
    return muted;
  },
};
