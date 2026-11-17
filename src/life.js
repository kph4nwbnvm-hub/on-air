// Player's daily life: hunger, thirst, energy and sleep; a home; friends made in the city; and life shops.
// Needs drop with play time and broadcasts; low needs lower performance. Shops, cafés and sleep restore them.
export const NEEDS = [
  { k: 'h', icon: '🍔', key: 'lf_hunger', per: 1.2 }, // drop per minute of play
  { k: 't', icon: '💧', key: 'lf_thirst', per: 1.8 },
  { k: 'e', icon: '⚡', key: 'lf_energy', per: 0.8 },
  { k: 's', icon: '😴', key: 'lf_sleep', per: 0.6 },
];
// life shops on the north side of the main street: [id, icon, items]; item: [key, icon, price, effect]
// effects: h/t/e/s add to a need; home: home level; perm: a lasting item; fresh: +trust next broadcast
export const LIFE_SHOPS = [
  { id: 'super', icon: '🛒', bg: '#2f8f4e', items: [['it_water', '💧', 5, { t: 35 }], ['it_juice', '🧃', 9, { t: 30, h: 8 }], ['it_sandwich', '🥪', 12, { h: 30 }], ['it_groceries', '🧺', 45, { h: 60, t: 45 }]] },
  { id: 'rest', icon: '🍽️', bg: '#c0392b', items: [['it_kabsa', '🍛', 32, { h: 85, e: 10 }], ['it_burger', '🍔', 20, { h: 55 }], ['it_salad', '🥗', 16, { h: 35, e: 8 }], ['it_tea', '🫖', 6, { t: 25, e: 5 }]] },
  { id: 'pharm', icon: '💊', bg: '#16a085', items: [['it_vitamins', '💊', 22, { e: 30 }], ['it_energy', '🥤', 15, { e: 35, s: -10 }]] },
  { id: 'barber', icon: '💈', bg: '#8e44ad', items: [['it_haircut', '💈', 30, { fresh: 4 }], ['it_shave', '🪒', 18, { fresh: 2 }]] },
  { id: 'phone', icon: '📱', bg: '#2c3e50', items: [['it_phone', '📱', 300, { perm: 'phone' }]] },
  { id: 'furn', icon: '🛋️', bg: '#a0522d', items: [['it_bed', '🛏️', 260, { perm: 'bed', needHome: 1 }], ['it_couch', '🛋️', 180, { perm: 'couch', needHome: 1 }]] },
  { id: 'estate', icon: '🏠', bg: '#d35400', items: [['it_room', '🚪', 120, { home: 1 }], ['it_flat', '🏢', 480, { home: 2 }], ['it_villa', '🏡', 2600, { home: 3 }]] },
  { id: 'bank', icon: '🏦', bg: '#1f3a93', items: [['it_save', '💰', 100, { save: 100 }]] },
];
// first names for the people of the city (proper names stay as they are in every language)
const NAMES_M = ['Fahad', 'Omar', 'Khalid', 'Yousef', 'Ali', 'Saad', 'Noah', 'Leo', 'Ravi', 'Kenji', 'Mateo', 'Hamza'];
const NAMES_F = ['Sara', 'Noura', 'Lina', 'Maya', 'Reem', 'Huda', 'Emma', 'Aisha', 'Mei', 'Sofia', 'Layla', 'Dana'];
export const personName = (i, female) => (female ? NAMES_F : NAMES_M)[i % 12];

export function makeLife(d) {
  const { store, t, sfx, toast, getCoins, addCoins } = d;
  const S = Object.assign({ h: 90, t: 90, e: 90, s: 90, at: Date.now(), home: 0, perm: [], friends: {}, met: {}, fresh: 0, bank: 0, bankAt: 0, warned: {} }, store.get('life', {}));
  const save = () => store.set('life', S);
  const clamp = (v) => Math.max(0, Math.min(100, v));
  // time away: needs drift down slowly, but never below 35 so returning players are not punished
  { const away = (Date.now() - (S.at || Date.now())) / 3600000; if (away > 0.2) NEEDS.forEach((n) => { S[n.k] = Math.max(Math.min(S[n.k], 35), S[n.k] - away * 6); }); S.at = Date.now(); save(); }
  let acc = 0;
  function warn() {
    NEEDS.forEach((n) => { const low = S[n.k] < 25; if (low && !S.warned[n.k]) { S.warned[n.k] = 1; sfx.bad(); toast(n.icon + ' ' + t('lf_low').replace('{n}', t(n.key))); } if (S[n.k] > 40) S.warned[n.k] = 0; });
  }
  // play-time decay; called every frame with dt (seconds) while the game screen is open
  function tick(dt) {
    acc += dt; if (acc < 5) return; const m = acc / 60; acc = 0;
    NEEDS.forEach((n) => { S[n.k] = clamp(S[n.k] - n.per * m); }); S.at = Date.now(); warn(); save(); paint();
  }
  const roundCost = () => { S.h = clamp(S.h - 3); S.t = clamp(S.t - 5); S.e = clamp(S.e - 7); S.s = clamp(S.s - 3); warn(); save(); paint(); };
  // performance: 1 = normal, lower when a need is low
  const worst = () => Math.min(...NEEDS.map((n) => S[n.k]));
  const mult = () => (worst() < 10 ? 0.75 : worst() < 25 ? 0.9 : 1);
  const friendCount = () => Object.keys(S.friends).length;
  // trust bonus at the start of a broadcast: friends (max +5), a fresh haircut, minus tiredness
  function roundBonus() { const b = Math.min(5, friendCount()) + S.fresh - Math.round((1 - mult()) * 30); S.fresh = 0; save(); return b; }
  function apply(fx) { ['h', 't', 'e', 's'].forEach((k) => { if (fx[k]) S[k] = clamp(S[k] + fx[k]); }); }
  function buy(item) {
    const [key, icon, price, fx] = item;
    if (fx.home && S.home >= fx.home) return;
    if (fx.perm && S.perm.includes(fx.perm)) return;
    if (fx.needHome && !S.home) { sfx.bad(); toast('🏠 ' + t('lf_nohome')); return; }
    if (getCoins() < price) { sfx.bad(); toast('🪙 ' + t('lf_nocoins')); return; }
    addCoins(-price); apply(fx);
    if (fx.home) S.home = fx.home; if (fx.perm) S.perm.push(fx.perm); if (fx.fresh) S.fresh = Math.max(S.fresh, fx.fresh);
    if (fx.save) { S.bank += fx.save; S.bankAt = S.bankAt || Date.now(); }
    save(); sfx.win(); toast(icon + ' ' + t(key) + ' ✅'); paint(); d.onEvent && d.onEvent('life_buy');
  }
  // bank: savings grow 2% per day, collected any time
  const bankGrowth = () => (S.bank ? Math.floor(S.bank * 0.02 * ((Date.now() - S.bankAt) / 86400000)) : 0);
  function collect() { const g = bankGrowth(); const tot = S.bank + g; if (!tot) return; addCoins(tot); S.bank = 0; S.bankAt = 0; save(); sfx.win(); toast('🏦 +' + tot); }
  function sleep() {
    if (S.s > 85) { toast('😴 ' + t('lf_notsleepy')); return; }
    const full = S.home > 0; const bed = S.perm.includes('bed');
    S.s = full ? 100 : Math.max(S.s, 60); S.e = clamp(S.e + (full ? 45 + S.home * 5 + (bed ? 10 : 0) : 20)); S.h = clamp(S.h - 8); S.t = clamp(S.t - 10);
    save(); paint(); d.fade && d.fade(); sfx.good(); toast('🌙 ' + t(full ? 'lf_slept' : 'lf_slept_sofa')); d.onEvent && d.onEvent('sleep');
  }
  // friends: talk to the same person three times and they become a friend
  function met(id, name, icon) {
    if (S.friends[id]) return false; S.met[id] = (S.met[id] || 0) + 1;
    if (S.met[id] >= 3) { S.friends[id] = { name, icon: icon || '🙂', at: Date.now() }; save(); sfx.win(); toast('🤝 ' + t('lf_friend_new').replace('{n}', name)); d.onEvent && d.onEvent('friend'); return true; }
    save(); return false;
  }
  // café coffee now also wakes the player up
  const coffee = () => { S.e = clamp(S.e + 20); S.t = clamp(S.t + 10); save(); paint(); };

  // ---------- HUD chip ----------
  function paint() {
    const el = d.$('needs'); if (!el) return;
    el.innerHTML = ''; NEEDS.forEach((n) => { const s = document.createElement('span'); const v = Math.round(S[n.k]); s.className = v < 10 ? 'crit' : v < 25 ? 'low' : ''; s.innerHTML = '<i></i><b><u></u></b>'; s.children[0].textContent = n.icon; s.querySelector('u').style.width = v + '%'; el.appendChild(s); });
  }
  // ---------- panels (drawn inside the shared panel box) ----------
  const row = (L, icon, title, sub, btnLabel, enabled, fn) => {
    const r = document.createElement('div'); r.className = 'pcrow'; r.innerHTML = '<span class="ic"></span><span class="nm"><b></b><small></small></span>';
    r.children[0].textContent = icon; r.querySelector('b').textContent = title; r.querySelector('small').textContent = sub || '';
    if (btnLabel != null) { const b = document.createElement('button'); b.className = enabled ? 'big' : 'ghost'; b.disabled = !enabled; b.textContent = btnLabel; b.onclick = fn; r.appendChild(b); }
    L.appendChild(r); return r;
  };
  const note = (L, txt) => { const p = document.createElement('p'); p.className = 'pnote'; p.textContent = txt; L.appendChild(p); };
  function buildMe() {
    d.$('pcTitle').textContent = '🧍 ' + t('lf_title'); d.$('pcStore').hidden = true; const L = d.$('pcList'); L.innerHTML = '';
    note(L, t('lf_explain'));
    NEEDS.forEach((n) => { const v = Math.round(S[n.k]); const r = row(L, n.icon, t(n.key) + ' · ' + v + '%', '█'.repeat(Math.round(v / 10)) + '░'.repeat(10 - Math.round(v / 10))); if (v < 25) r.classList.add('bad'); });
    const homeName = S.home ? t(['', 'it_room', 'it_flat', 'it_villa'][S.home]) : t('lf_nohome');
    row(L, '🏠', t('lf_home'), homeName, '🌙 ' + t('lf_sleepbtn'), true, () => { sleep(); buildMe(); });
    const g = bankGrowth(); if (S.bank) row(L, '🏦', t('ls_bank'), '💰 ' + S.bank + ' + ' + g, '🪙 +' + (S.bank + g), true, () => { collect(); buildMe(); });
    const fr = Object.values(S.friends);
    const fh = document.createElement('p'); fh.className = 'skpts'; fh.textContent = '🤝 ' + t('lf_friends') + ' (' + fr.length + ') · 📈 +' + Math.min(5, fr.length); L.appendChild(fh);
    if (!fr.length) note(L, t('lf_nofriends')); fr.forEach((f) => row(L, f.icon, f.name, ''));
    note(L, '🗺️ ' + t('lf_where'));
  }
  function buildShop(id) {
    const sh = LIFE_SHOPS.find((x) => x.id === id); d.$('pcTitle').textContent = sh.icon + ' ' + t('ls_' + id); d.$('pcStore').hidden = true; const L = d.$('pcList'); L.innerHTML = '';
    const p = document.createElement('p'); p.className = 'skpts'; p.textContent = '🪙 ' + getCoins() + '   ' + NEEDS.map((n) => n.icon + Math.round(S[n.k])).join(' '); L.appendChild(p);
    note(L, t('lsx_' + id));
    sh.items.forEach((it) => {
      const [key, icon, price, fx] = it; const eff = ['h', 't', 'e', 's'].filter((k) => fx[k]).map((k) => NEEDS.find((n) => n.k === k).icon + (fx[k] > 0 ? '+' : '') + fx[k]).join(' ');
      const owned = (fx.home && S.home >= fx.home) || (fx.perm && S.perm.includes(fx.perm));
      const sub = eff || (fx.fresh ? '📈 +' + fx.fresh : fx.save ? '🏦 +2%/' + t('lf_day') : fx.home ? '🏠 ' + '★'.repeat(fx.home) : '');
      row(L, icon, t(key), sub, owned ? '✅' : '🪙 ' + price, !owned && getCoins() >= price, () => { buy(it); buildShop(id); });
    });
    if (id === 'bank' && S.bank) row(L, '💰', t('lf_collect'), S.bank + ' + ' + bankGrowth(), '🪙 +' + (S.bank + bankGrowth()), true, () => { collect(); buildShop(id); });
  }
  return { S, tick, roundCost, mult, roundBonus, met, coffee, sleep, paint, buildMe, buildShop, friendCount };
}
