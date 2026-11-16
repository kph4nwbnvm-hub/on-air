// App-token store: buy, equip, use, merge cards; smart browsing (category, rarity, search, sort); collections.
import { CATS, CARDS, RARITY, EFFECTS, COLLECTIONS, card, value, priceOf, catOf } from './catalog.js';

export const TOKEN = '💠';

export function makeStore(deps) {
  const { store, t, getLang, sfx, toast, $ } = deps;
  const S = {
    tokens: store.get('tok', 0),
    cards: store.get('cards', {}),
    equip: store.get('equip', {}),
    boosts: store.get('boosts', []),
  };
  const save = () => { store.set('tok', S.tokens); store.set('cards', S.cards); store.set('equip', S.equip); store.set('boosts', S.boosts); };
  const count = (id) => S.cards[id] || 0;
  const add = (id, n = 1) => { S.cards[id] = count(id) + n; if (S.cards[id] <= 0) delete S.cards[id]; };
  const equipped = () => Object.values(S.equip).flat();
  const isEquipped = (id) => equipped().includes(id);
  const nameOf = (c) => c.fam.name[getLang()] || c.fam.name.en;
  const effText = (c) => t('e_' + c.fam.effect).replace('{v}', value(c));

  function bonuses() {
    const b = Object.fromEntries(Object.keys(EFFECTS).map((k) => [k, 0]));
    [...equipped(), ...S.boosts].forEach((id) => { const c = card(id); if (c && catOf(c.fam.cat).kind !== 'future') b[c.fam.effect] += value(c); });
    const fams = new Set(equipped().map((id) => { const [c, f] = id.split('.'); return c + '.' + f; }));
    COLLECTIONS.forEach((col) => { if (col.fams.every((f) => fams.has(f))) Object.entries(col.bonus).forEach(([k, v]) => { b[k] += v; }); });
    Object.keys(b).forEach((k) => { b[k] = Math.min(b[k], EFFECTS[k].cap); });
    return b;
  }
  function consumeBoosts() { const had = S.boosts.length; S.boosts = []; save(); return had; }
  function grantRandom(rarity = 1) {
    const pool = CARDS.filter((c) => c.r === rarity && catOf(c.fam.cat).kind !== 'future');
    const c = pool[Math.floor(Math.random() * pool.length)]; add(c.id); save(); return c;
  }

  // ---------- UI ----------
  const view = { cat: 'all', rarity: 0, q: '', sort: 'cheap', limit: 60 };
  let sheetId = null;

  function chips() {
    const row = $('stCats'); row.innerHTML = '';
    const mk = (id, label) => { const b = document.createElement('button'); b.textContent = label; if (view.cat === id) b.className = 'sel'; b.onclick = () => { view.cat = id; view.limit = 60; sfx.click(); render(); }; row.appendChild(b); };
    mk('all', '🗂️ ' + t('st_all')); mk('owned', '🎒 ' + t('st_owned')); mk('equipped', '✅ ' + t('st_equipped'));
    CATS.forEach((c) => mk(c.id, c.icon + ' ' + t('c_' + c.id)));
    const rr = $('stRar'); rr.innerHTML = '';
    [0, 1, 2, 3, 4, 5].forEach((r) => { const b = document.createElement('button'); b.textContent = r ? t('r' + r) : t('st_all'); if (r) b.style.borderColor = RARITY[r - 1].color; if (view.rarity === r) b.className = 'sel'; b.onclick = () => { view.rarity = r; view.limit = 60; sfx.click(); render(); }; rr.appendChild(b); });
    const so = $('stSort'); so.innerHTML = ''; [['cheap', t('st_cheap')], ['rare', t('st_rare')]].forEach(([v, l]) => { const o = document.createElement('option'); o.value = v; o.textContent = l; so.appendChild(o); }); so.value = view.sort;
    $('stSearch').placeholder = t('st_search');
  }
  function list() {
    const q = view.q.trim().toLowerCase(); const lang = getLang();
    let L = CARDS.filter((c) => {
      if (view.cat === 'owned' && !count(c.id)) return false;
      if (view.cat === 'equipped' && !isEquipped(c.id)) return false;
      if (!['all', 'owned', 'equipped'].includes(view.cat) && c.fam.cat !== view.cat) return false;
      if (view.rarity && c.r !== view.rarity) return false;
      if (q) { const hay = [c.fam.name.ar, c.fam.name.en, c.fam.name[lang] || '', t('c_' + c.fam.cat), t('r' + c.r), effText(c)].join(' ').toLowerCase(); if (!hay.includes(q)) return false; }
      return true;
    });
    const ci = (c) => CATS.findIndex((x) => x.id === c.fam.cat); L = L.sort((a, b) => (view.sort === 'cheap' ? a.r - b.r : b.r - a.r) || ci(a) - ci(b));
    return L;
  }
  function tile(c) {
    const el = document.createElement('button'); el.className = 'card r' + c.r; el.style.setProperty('--rc', RARITY[c.r - 1].color);
    el.innerHTML = '<span class="ic"></span><b></b><small></small><em></em>';
    el.children[0].textContent = c.fam.icon; el.children[1].textContent = nameOf(c); el.children[2].textContent = effText(c);
    el.children[3].textContent = TOKEN + ' ' + priceOf(c);
    const n = count(c.id); if (n) { const k = document.createElement('i'); k.className = 'cnt'; k.textContent = '×' + n; el.appendChild(k); }
    if (isEquipped(c.id)) el.classList.add('on');
    el.onclick = () => { sfx.click(); openSheet(c.id); };
    return el;
  }
  function renderBonuses() {
    const b = bonuses(); const box = $('stBonus');
    const parts = Object.entries(b).filter(([, v]) => v).map(([k, v]) => t('e_' + k).replace('{v}', Math.round(v * 10) / 10));
    box.hidden = !parts.length; box.textContent = parts.length ? t('st_bonus') + ': ' + parts.join(' · ') : '';
  }
  function renderCollections() {
    const box = $('stCols'); box.innerHTML = '';
    if (view.cat !== 'equipped') { box.hidden = true; return; } box.hidden = false;
    const h = document.createElement('p'); h.className = 'colh'; h.textContent = '🧩 ' + t('st_collections') + ': ' + t('st_col_hint'); box.appendChild(h);
    const fams = new Set(equipped().map((id) => id.split('.').slice(0, 2).join('.')));
    COLLECTIONS.forEach((col) => {
      const d = document.createElement('div'); d.className = 'col'; const done = col.fams.filter((f) => fams.has(f)).length;
      const icons = col.fams.map((f) => { const c = CARDS.find((x) => x.id.startsWith(f + '.')); return (fams.has(f) ? '' : '·') + c.fam.icon; }).join(' ');
      const bon = Object.entries(col.bonus).map(([k, v]) => t('e_' + k).replace('{v}', v)).join(' · ');
      d.innerHTML = '<b></b><span></span><small></small>'; d.children[0].textContent = t('k_' + col.id) + ' ' + done + '/' + col.fams.length; d.children[1].textContent = icons; d.children[2].textContent = bon;
      if (done === col.fams.length) d.classList.add('ok'); box.appendChild(d);
    });
  }
  function render() {
    chips(); $('stTok').textContent = TOKEN + ' ' + S.tokens; renderBonuses(); renderCollections();
    const g = $('stGrid'); g.innerHTML = ''; const L = list();
    if (!L.length) { const p = document.createElement('p'); p.className = 'empty'; p.textContent = t('st_empty'); g.appendChild(p); }
    L.slice(0, view.limit).forEach((c) => g.appendChild(tile(c)));
    $('stMore').hidden = L.length <= view.limit; $('stMore').textContent = '⬇ ' + (L.length - view.limit);
    if (sheetId) openSheet(sheetId);
  }
  function openSheet(id) {
    sheetId = id; const c = card(id); const cat = catOf(c.fam.cat); const n = count(id); const sh = $('stSheet');
    sh.hidden = false; sh.style.setProperty('--rc', RARITY[c.r - 1].color);
    $('shIc').textContent = c.fam.icon; $('shName').textContent = nameOf(c);
    $('shMeta').textContent = t('r' + c.r) + ' · ' + cat.icon + ' ' + t('c_' + cat.id) + (n ? ' · ' + t('st_have').replace('{n}', n) : '');
    $('shUse').textContent = t('st_use_lbl') + ': ' + effText(c) + (cat.kind === 'future' ? ' (' + t('st_future') + ')' : '');
    $('shGoal').textContent = t('st_goal_lbl') + ': ' + t('g_' + cat.id);
    const acts = $('shActs'); acts.innerHTML = '';
    const btn = (label, cls, fn) => { const b = document.createElement('button'); b.className = cls; b.textContent = label; b.onclick = fn; acts.appendChild(b); };
    btn(t('st_buy') + '  ' + TOKEN + ' ' + priceOf(c), 'big' + (S.tokens < priceOf(c) ? ' poor' : ''), () => {
      if (S.tokens < priceOf(c)) { sfx.bad(); toast(t('st_no_tokens')); return; }
      S.tokens -= priceOf(c); add(id); save(); sfx.win(); toast('🎉 ' + t('st_bought')); render();
    });
    if (n && cat.kind === 'equip') {
      if (isEquipped(id)) btn(t('st_unequip'), 'ghost', () => { S.equip[cat.id] = (S.equip[cat.id] || []).filter((x) => x !== id); save(); sfx.click(); render(); });
      else btn(t('st_equip'), 'ghost', () => {
        const slot = S.equip[cat.id] || []; if (slot.length >= cat.slots) { sfx.bad(); toast(t('st_slots')); return; }
        S.equip[cat.id] = [...slot, id]; save(); sfx.win(); render();
      });
    }
    if (n && cat.kind === 'use') btn(t('st_use'), 'ghost', () => {
      if (isEquippedBoost(id)) return; add(id, -1); S.boosts.push(id); save(); sfx.win(); toast('⚡ ' + t('st_active')); render();
    });
    if (n >= 3 && c.r < 5) btn(t('st_merge'), 'ghost merge', () => {
      add(id, -3); if (!count(id)) S.equip[cat.id] = (S.equip[cat.id] || []).filter((x) => x !== id);
      add(`${c.fam.cat}.${c.fam.id}.${c.r + 1}`); save(); sfx.win(); toast('✨ ' + t('st_merged')); openSheet(`${c.fam.cat}.${c.fam.id}.${c.r + 1}`); render();
    });
  }
  const isEquippedBoost = (id) => false;
  function closeSheet() { sheetId = null; $('stSheet').hidden = true; }

  $('stSearch').addEventListener('input', (e) => { view.q = e.target.value; view.limit = 60; render(); });
  $('stSort').addEventListener('change', (e) => { view.sort = e.target.value; render(); });
  $('stMore').onclick = () => { view.limit += 60; render(); };
  $('shClose').onclick = () => { sfx.click(); closeSheet(); };
  $('stSheet').addEventListener('click', (e) => { if (e.target.id === 'stSheet') closeSheet(); });
  $('stTest').onclick = () => { S.tokens += 50; save(); sfx.win(); render(); };

  return { S, bonuses, consumeBoosts, grantRandom, render, closeSheet, nameOf };
}
