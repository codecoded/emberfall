// On-screen touch controls: a thumb pad on the left, jump / sword buttons on the right, pause up top.
// Self-contained (injects its own DOM + CSS) so both versions of the game can share it.
// api: { set(action, held), tap(action), isPlaying(), onActive?() }
const CSS = `
#touch { position: fixed; inset: 0; z-index: 50; pointer-events: none; display: none; touch-action: none;
  -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; font-family: system-ui, sans-serif; }
#touch.on.play { display: block; }
#touch .pad, #touch .btn { position: absolute; pointer-events: auto; touch-action: none; -webkit-tap-highlight-color: transparent; }
#touch .pad { left: calc(env(safe-area-inset-left) + 2vmin); bottom: calc(env(safe-area-inset-bottom) + 3vmin); width: 46vmin; height: 46vmin; max-width: 230px; max-height: 230px; }
#touch .ring { position: absolute; inset: 14%; border-radius: 50%; background: rgba(20, 12, 30, .28); border: 2px solid rgba(255, 236, 200, .32); }
#touch .knob { position: absolute; left: 50%; top: 50%; width: 34%; height: 34%; margin: -17% 0 0 -17%; border-radius: 50%; background: rgba(255, 236, 200, .38); border: 2px solid rgba(255, 236, 200, .6); }
#touch .arrow { position: absolute; color: rgba(255, 236, 200, .55); font-size: 5vmin; line-height: 1; }
#touch .arrow.l { left: 18%; top: 50%; transform: translateY(-50%); } #touch .arrow.r { right: 18%; top: 50%; transform: translateY(-50%); }
#touch .arrow.u { top: 17%; left: 50%; transform: translateX(-50%); } #touch .arrow.d { bottom: 17%; left: 50%; transform: translateX(-50%); }
#touch .arrow.lit { color: #ffd36a; }
#touch .btn { display: grid; place-items: center; border-radius: 50%; color: rgba(255, 244, 220, .9); font-weight: 700; letter-spacing: .08em;
  background: rgba(20, 12, 30, .34); border: 2px solid rgba(255, 236, 200, .45); }
#touch .btn.held { background: rgba(255, 190, 90, .5); border-color: #ffd36a; }
#touch .jump { right: calc(env(safe-area-inset-right) + 4vmin); bottom: calc(env(safe-area-inset-bottom) + 5vmin); width: 23vmin; height: 23vmin; max-width: 112px; max-height: 112px; font-size: 3.4vmin; }
#touch .attack { right: calc(env(safe-area-inset-right) + min(29vmin, 140px)); bottom: calc(env(safe-area-inset-bottom) + min(16vmin, 80px)); width: 21vmin; height: 21vmin; max-width: 104px; max-height: 104px; font-size: 3.2vmin; }
#touch .pause { left: 50%; top: calc(env(safe-area-inset-top) + 1.5vmin); width: 10vmin; height: 10vmin; max-width: 52px; max-height: 52px; margin-left: min(-5vmin, -26px); margin-left: -5vmin; font-size: 3.6vmin; opacity: .8; }
`;

export function initTouch(api) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const root = document.createElement('div'); root.id = 'touch';
  root.innerHTML = `<div class="pad"><div class="ring"></div><span class="arrow l">◀</span><span class="arrow r">▶</span><span class="arrow u">▲</span><span class="arrow d">▼</span><div class="knob"></div></div>
    <div class="btn attack" data-a="attack">SWORD</div><div class="btn jump" data-a="jump">JUMP</div><div class="btn pause" data-a="pause">II</div>`;
  document.body.appendChild(root);
  const pad = root.querySelector('.pad'), knob = root.querySelector('.knob');
  const arrows = { left: root.querySelector('.l'), right: root.querySelector('.r'), up: root.querySelector('.u'), down: root.querySelector('.d') };
  let active = false;
  const activate = () => { if (active) return; active = true; root.classList.add('on'); document.documentElement.classList.add('touch'); if (api.onActive) api.onActive(); };
  if (matchMedia('(pointer: coarse)').matches && matchMedia('(hover: none)').matches) activate();

  // thumb pad: direction comes from where the thumb sits relative to the pad centre, so it can slide between them
  const dirs = { left: false, right: false, up: false, down: false };
  let padId = null;
  const setDirs = (n) => { for (const k in dirs) if (dirs[k] !== !!n[k]) { dirs[k] = !!n[k]; api.set(k, dirs[k]); arrows[k].classList.toggle('lit', dirs[k]); } };
  const padMove = (e) => {
    const r = pad.getBoundingClientRect(), R = r.width / 2;
    let dx = (e.clientX - (r.left + R)) / R, dy = (e.clientY - (r.top + R)) / R;
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    knob.style.transform = `translate(${dx * R * 0.62}px, ${dy * R * 0.62}px)`;
    setDirs({ left: dx < -0.22, right: dx > 0.22, up: dy < -0.62, down: dy > 0.55 });
  };
  const padEnd = (e) => { if (e.pointerId !== padId) return; padId = null; knob.style.transform = ''; setDirs({}); };
  pad.addEventListener('pointerdown', (e) => { e.preventDefault(); activate(); padId = e.pointerId; pad.setPointerCapture(e.pointerId); padMove(e); });
  pad.addEventListener('pointermove', (e) => { if (e.pointerId === padId) padMove(e); });
  pad.addEventListener('pointerup', padEnd); pad.addEventListener('pointercancel', padEnd);

  for (const b of root.querySelectorAll('.btn')) {
    const a = b.dataset.a;
    const up = (e) => { if (!b.classList.contains('held')) return; b.classList.remove('held'); api.set(a, false); };
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); activate(); b.setPointerCapture(e.pointerId); b.classList.add('held'); api.set(a, true); });
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
  }

  // outside of play, a tap anywhere means "continue"
  addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') activate();
    if (e.pointerType === 'mouse' && !active) return;
    if (e.target.closest && e.target.closest('#touch .pad, #touch .btn, a, [data-tap]')) return;
    if (!api.isPlaying()) api.tap('start');
  });
  // no pinch / double-tap zoom, no long-press menu
  for (const ev of ['gesturestart', 'gesturechange', 'contextmenu']) addEventListener(ev, (e) => { if (active) e.preventDefault(); });
  addEventListener('touchmove', (e) => { if (active) e.preventDefault(); }, { passive: false });
  let lastEnd = 0;
  addEventListener('touchend', (e) => { const n = Date.now(); if (n - lastEnd < 320 && !(e.target.closest && e.target.closest('a'))) e.preventDefault(); lastEnd = n; }, { passive: false });

  setInterval(() => {
    const p = !!api.isPlaying();
    if (p !== root.classList.contains('play')) { root.classList.toggle('play', p); if (!p) { setDirs({}); knob.style.transform = ''; } }
  }, 120);
  return { get active() { return active; } };
}
