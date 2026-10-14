// DOM overlay: HUD, banners, title, shop and end screens.
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const HEART = '<svg viewBox="0 0 24 22"><path d="M12 21 2.4 11.2A5.8 5.8 0 0 1 12 4.3a5.8 5.8 0 0 1 9.6 6.9Z"/></svg>';

export function createUI(root) {
  root.innerHTML = '';
  let touch = false, onPick = null;
  const go = () => (touch ? 'Tap' : 'Press Enter');
  const hud = el('div', 'hud');
  const hearts = el('div', 'hearts');
  const right = el('div', 'hud-right');
  const rune = el('div', 'rune', '<span>ᚱ</span>');
  const coins = el('div', 'coins', '<i></i><b>0</b>');
  const lives = el('div', 'lives', '<i></i><b>3</b>');
  right.append(rune, coins, lives);
  hud.append(hearts, right);
  const banner = el('div', 'banner');
  const hint = el('div', 'hint');
  const toast = el('div', 'toast');
  const boss = el('div', 'boss', '<span>Malgrim, the Ashen Sorcerer</span><div><i></i></div>');
  const title = el('div', 'screen title', `
    <div class="logo"><h1>Emberfall</h1><h2>Legend of the Rune Knight</h2></div>
    <p class="rotate">↻ Turn your device sideways for a wider view</p>
    <p class="press">Press Enter</p>
    <p class="keys"><b>←→</b> move &nbsp; <b>Space</b> jump &nbsp; <b>X</b> sword &nbsp; <b>↓</b> crouch &nbsp; <b>↑</b> trade &nbsp; <b>P</b> pause &nbsp; <b>M</b> mute &nbsp; <b>F</b> fullscreen</p>
    <a class="alt" href="../">◂ choose version</a>`);
  const story = el('div', 'screen story', `
    <p>When the Ember Crown was stolen, the sun over Valdris stopped rising.</p>
    <p>Malgrim, the Ashen Sorcerer, hides beyond three realms, each sealed by a portal that answers only to its <em>Rune Stone</em>.</p>
    <p>You are the last of the Rune Knights. Find the stones. Cross the realms. Bring back the dawn.</p>
    <p class="press">Press Enter</p>`);
  const pause = el('div', 'screen pause', '<h3>Paused</h3><p class="press">Press P to resume</p>');
  const shop = el('div', 'shop');
  const clear = el('div', 'screen clear');
  const over = el('div', 'screen over', '<h3>You have fallen</h3><p>The realms grow darker… but a Rune Knight rises again.</p><p class="press">Press Enter to continue</p>');
  const ending = el('div', 'screen ending');
  const loading = el('div', 'screen loading show', '<h3>Emberfall</h3><div class="bar"><i></i></div>');
  const vignette = el('div', 'vignette');
  root.append(vignette, hud, banner, hint, toast, boss, shop, title, story, pause, clear, over, ending, loading);

  let last = '', bannerT = 0, toastT = 0, hintText = '';
  const show = (e, on) => e.classList.toggle('show', !!on);
  shop.addEventListener('pointerdown', (e) => { const it = e.target.closest('.item'); if (it && onPick) onPick(+it.dataset.i); });
  return {
    touchMode() { touch = true; for (const p of root.querySelectorAll('.press')) p.textContent = p.textContent.replace('Press Enter', 'Tap').replace('Press P to resume', 'Tap II to resume'); },
    onShopPick(fn) { onPick = fn; },
    loading(f) { if (f >= 1) show(loading, false); else loading.querySelector('i').style.width = Math.round(f * 100) + '%'; },
    hud(s, visible) {
      const key = [s.hp, s.maxHp, s.coins, s.lives, s.rune, visible].join();
      if (key === last) return;
      last = key;
      show(hud, visible);
      hearts.innerHTML = Array.from({ length: s.maxHp }, (_, i) => `<span class="${i < s.hp ? 'on' : ''}">${HEART}</span>`).join('');
      coins.querySelector('b').textContent = s.coins;
      lives.querySelector('b').textContent = Math.max(0, s.lives);
      rune.classList.toggle('on', !!s.rune);
    },
    banner(text, sub = '') {
      banner.innerHTML = `<small>${sub}</small><h3>${text}</h3><hr>`;
      banner.classList.remove('show'); void banner.offsetWidth; banner.classList.add('show');
      clearTimeout(bannerT); bannerT = setTimeout(() => banner.classList.remove('show'), 3600);
    },
    hint(text) { if (text === hintText) return; hintText = text; if (text) hint.textContent = text; show(hint, !!text); },
    toast(text) { toast.textContent = text; show(toast, true); clearTimeout(toastT); toastT = setTimeout(() => show(toast, false), 2600); },
    boss(f) { show(boss, f !== null); if (f !== null) boss.querySelector('i').style.width = (f * 100).toFixed(1) + '%'; },
    title(on) { show(title, on); },
    story(on) { show(story, on); },
    pause(on) { show(pause, on); },
    gameover(on) { show(over, on); },
    shop(items, sel, gold) {
      show(shop, !!items);
      if (!items) return;
      shop.innerHTML = `<h3>The Wandering Merchant</h3><div class="gold"><i></i>${gold}</div>` + items.map((it, i) => `
        <div data-tap data-i="${i}" class="item ${i === sel ? 'sel' : ''} ${it.off || (it.cost && it.cost > gold) ? 'dim' : ''}">
          <b>${it.name}</b><span>${it.off ? it.off : it.cost ? it.cost + ' <i></i>' : ''}</span><p>${it.desc}</p></div>`).join('') + `<small>${touch ? 'Tap an item to buy' : '↑↓ choose · Space buy · Esc leave'}</small>`;
    },
    clear(d) {
      show(clear, !!d);
      if (d) clear.innerHTML = `<small>Realm cleared</small><h3>${d.name}</h3><hr><p>Gold gathered <b>${d.coins}</b> &nbsp;·&nbsp; Foes felled <b>${d.kills}</b></p><p class="press">${go()} for ${d.next}</p>`;
    },
    ending(on, s) {
      show(ending, on);
      if (on) ending.innerHTML = `<h1>Dawn Returns</h1><p>Malgrim is undone. The Ember Crown burns once more above Valdris, and the long night lifts from the three realms.</p><p>You finished with <b>${s.coins}</b> gold and <b>${Math.max(0, s.lives)}</b> lives to spare.</p><p class="press">${go()} to play again</p>`;
    },
  };
}
