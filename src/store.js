// App-token store: buy, equip, use, merge cards; smart browsing (category, rarity, search, sort); collections.
import { CATS, CARDS, RARITY, EFFECTS, COLLECTIONS, card, value, priceOf, catOf, tierOf, isGear, buyable, info, note, MAX_LV, BUY_MAX, FAMILIES } from './catalog.js';
import { HUB_OF, supports, signalOf } from './levels.js';
import { fmtTok } from './pricing.js';

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
  const fmtEff = (k, v) => { const s = t('e_' + k); return v < 0 ? s.replace('+{v}', String(v)).replace('{v}', String(v)) : s.replace('{v}', v); };
  const famName = (c) => (c.fam.cat === 'parts' ? t('p_' + c.fam.id) : c.fam.name[getLang()] || c.fam.name.en);
  const nameOf = (c) => { const i = info(c); const st = getLang() === 'ar' ? i.ar : i.en; return i.full ? st : famName(c) + ' · ' + st; };
  const color = (c) => RARITY[tierOf(c.r) - 1].color;
  // starter gear: level-1 broadcast kit with its flaws, so players feel every upgrade
  if (!store.get('starter', false)) {
    ['equip.cam.1', 'equip.mic.1', 'equip.light.1', 'equip.mixer.1', 'equip.switcher.1', 'equip.lightdesk.1', 'cables.rca.1', 'cables.trs.1'].forEach((id) => { S.cards[id] = (S.cards[id] || 0) + 1; });
    S.equip.equip = [...new Set([...(S.equip.equip || []), 'equip.cam.1', 'equip.mic.1', 'equip.light.1', 'equip.mixer.1', 'equip.switcher.1', 'equip.lightdesk.1'])].slice(0, 8);
    store.set('starter', true); store.set('cards', S.cards); store.set('equip', S.equip);
  }
  const ownsCable = (conn) => Object.keys(S.cards).some((id) => id.startsWith('cables.' + conn + '.') && S.cards[id] > 0);
  const hubLevel = (hub) => Math.max(0, ...equipped().filter((id) => id.startsWith('equip.' + hub + '.')).map((id) => +id.split('.')[2]));
  // what a device needs to work: a hub supporting its connector, and the matching cable
  function compat(c) {
    const sig = signalOf(c.fam.cat, c.fam.id); const conn = info(c).conn; if (!sig || !conn) return { ok: true, need: [] };
    const hub = HUB_OF[sig]; const hl = hubLevel(hub); const need = [];
    if (!hl || !supports(hub, hl, conn)) need.push({ kind: 'hub', hub, conn });
    if (!ownsCable(conn)) need.push({ kind: 'cable', conn });
    return { ok: !need.length, need };
  }
  const CONN_NAME = { rca: 'RCA', trs: 'TRS', xlr: 'XLR', sdi: 'SDI', hdmi: 'HDMI', dmx: 'DMX', usbc: 'USB-C', ethernet: 'Ethernet', fiber: 'Fiber', wireless: 'Wireless' };
  const needText = (n) => n.kind === 'hub' ? t('st_needs_hub').replace('{hub}', famName(card('equip.' + n.hub + '.1'))).replace('{c}', CONN_NAME[n.conn]) : t('st_needs_cable').replace('{c}', CONN_NAME[n.conn]);
  const effText = (c) => fmtEff(c.fam.effect, value(c));

  function bonuses() {
    const b = Object.fromEntries(Object.keys(EFFECTS).map((k) => [k, 0]));
    [...equipped(), ...S.boosts].forEach((id) => { const c = card(id); if (!c || catOf(c.fam.cat).kind === 'future') return; const v = value(c); if (v > 0 && !compat(c).ok) return; b[c.fam.effect] += v; });
    const fams = new Set(equipped().map((id) => { const [c, f] = id.split('.'); return c + '.' + f; }));
    COLLECTIONS.forEach((col) => { if (col.fams.every((f) => fams.has(f))) Object.entries(col.bonus).forEach(([k, v]) => { b[k] += v; }); });
    Object.keys(b).forEach((k) => { b[k] = Math.max(-EFFECTS[k].cap / 3, Math.min(b[k], EFFECTS[k].cap)); });
    return b;
  }
  function consumeBoosts() { const had = S.boosts.length; S.boosts = []; save(); return had; }
  // drop level: better rounds can drop better cards; high levels stay rare
  function dropLevel(trust = 0.5, cap = 12) { const top = Math.min(cap, 2 + Math.floor(trust * 10)); let lv = 1; while (lv < top && Math.random() < 0.55) lv++; return lv; }
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
    [0, 1, 2, 3, 4, 5].forEach((r) => { const b = document.createElement('button'); b.textContent = r ? t('r' + r) + ' ' + ((r - 1) * 3 + 1) + '–' + r * 3 : t('st_all'); if (r) b.style.borderColor = RARITY[r - 1].color; if (view.rarity === r) b.className = 'sel'; b.onclick = () => { view.rarity = r; view.limit = 60; sfx.click(); render(); }; rr.appendChild(b); });
    const so = $('stSort'); so.innerHTML = ''; [['cheap', t('st_cheap')], ['rare', t('st_rare')]].forEach(([v, l]) => { const o = document.createElement('option'); o.value = v; o.textContent = l; so.appendChild(o); }); so.value = view.sort;
    $('stSearch').placeholder = t('st_search'); $('stTest').textContent = t('st_test').replace('+50', '+' + TEST_GRANT.toLocaleString('en-US'));
  }
  function list() {
    const q = view.q.trim().toLowerCase(); const lang = getLang();
    let L = CARDS.filter((c) => {
      if (view.cat === 'owned' && !count(c.id)) return false;
      if (view.cat === 'equipped' && !isEquipped(c.id)) return false;
      if (!['all', 'owned', 'equipped'].includes(view.cat) && c.fam.cat !== view.cat) return false;
      if (view.rarity && tierOf(c.r) !== view.rarity) return false;
      if (q) { const i = info(c); const hay = [c.fam.name.ar, c.fam.name.en, c.fam.name[lang] || '', i.ar, i.en, i.era, i.conn || '', t('c_' + c.fam.cat), t('r' + tierOf(c.r)), effText(c)].join(' ').toLowerCase(); if (!hay.includes(q)) return false; }
      return true;
    });
    const ci = (c) => CATS.findIndex((x) => x.id === c.fam.cat); L = L.sort((a, b) => (isNeed(b) - isNeed(a)) || (view.sort === 'cheap' ? a.r - b.r : b.r - a.r) || ci(a) - ci(b));
    return L;
  }
  // shopping list set by the game (e.g. the broken PC parts): shown on top of the store and pinned first
  let needsFn = () => [], needsGo = null; const ownsPart = (fam) => Object.keys(S.cards).some((id) => id.startsWith('parts.' + fam + '.') && S.cards[id] > 0);
  const isNeed = (c) => c.fam.cat === 'parts' && c.r === 1 && needsFn().includes(c.fam.id) && !ownsPart(c.fam.id);
  function tile(c) {
    const el = document.createElement('button'); el.className = 'card r' + tierOf(c.r); el.style.setProperty('--rc', color(c));
    el.innerHTML = '<span class="ic"></span><i class="lv"></i><b></b><small></small><em></em>';
    el.children[0].textContent = c.fam.icon; el.children[1].textContent = 'Lv ' + c.r; el.children[2].textContent = nameOf(c); el.children[3].textContent = effText(c);
    el.children[4].textContent = buyable(c) ? TOKEN + ' ' + fmtTok(priceOf(c)) : '🏆';
    if (isNeed(c)) { el.classList.add('need'); el.children[1].textContent = '📌 Lv ' + c.r; }
    if (count(c.id) && !compat(c).ok) el.classList.add('bad');
    const n = count(c.id); if (n) { const k = document.createElement('i'); k.className = 'cnt'; k.textContent = '×' + n; el.appendChild(k); }
    if (isEquipped(c.id)) el.classList.add('on');
    el.onclick = () => { sfx.click(); openSheet(c.id); };
    return el;
  }
  function renderBonuses() {
    const b = bonuses(); const box = $('stBonus');
    const parts = Object.entries(b).filter(([, v]) => v).map(([k, v]) => fmtEff(k, Math.round(v * 10) / 10));
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
    chips(); $('stTok').textContent = TOKEN + ' ' + fmtTok(S.tokens); renderBonuses(); renderCollections();
    const nd = needsFn(), nb = $('stNeed'); nb.hidden = !nd.length; const ready = nd.length && nd.every(ownsPart); nb.classList.toggle('go', !!ready); nb.onclick = ready && needsGo ? () => needsGo() : null;
    if (nd.length) nb.textContent = ready ? '✅ ' + t('obj_pc2') + '  ▶' : '🖥️ ' + t('pc_title') + ' — ' + t('pc_need') + ':  ' + nd.map((f) => (ownsPart(f) ? '✅ ' : '❌ ') + t('p_' + f)).join('  ·  ');
    const g = $('stGrid'); g.innerHTML = ''; const L = list();
    if (!L.length) { const p = document.createElement('p'); p.className = 'empty'; p.textContent = t('st_empty'); g.appendChild(p); }
    L.slice(0, view.limit).forEach((c) => g.appendChild(tile(c)));
    $('stMore').hidden = L.length <= view.limit; $('stMore').textContent = '⬇ ' + (L.length - view.limit);
    if (sheetId) openSheet(sheetId);
  }
  function openSheet(id) {
    sheetId = id; const c = card(id); const cat = catOf(c.fam.cat); const n = count(id); const sh = $('stSheet'); const inf = info(c); const nt = note(c); const cp = compat(c);
    sh.hidden = false; sh.style.setProperty('--rc', color(c));
    $('shIc').textContent = c.fam.icon; $('shName').textContent = nameOf(c);
    $('shMeta').textContent = t('st_lv') + ' ' + c.r + '/' + MAX_LV + ' · ' + t('r' + tierOf(c.r)) + ' · ' + cat.icon + ' ' + t('c_' + cat.id) + (inf.era ? ' · ' + (inf.era === 'future' ? t('st_future_era') : inf.era) : '') + (n ? ' · ' + t('st_have').replace('{n}', n) : '');
    $('shUse').textContent = t('st_use_lbl') + ': ' + effText(c) + (cat.kind === 'future' ? ' (' + t('st_future') + ')' : '') + (nt ? ' · ' + (nt.kind === 'flaw' ? '⚠️ ' : '🤖 ') + t(nt.key) : '');
    $('shGoal').textContent = t('st_goal_lbl') + ': ' + t('g_' + cat.id);
    const cpx = $('shCompat'); const conn = inf.conn;
    cpx.hidden = !conn; if (conn) { cpx.className = cp.ok ? 'ok' : 'no'; cpx.textContent = t('st_conn') + ': ' + CONN_NAME[conn] + ' · ' + (cp.ok ? '✅ ' + t('st_compat_ok') : '⛔ ' + t('st_compat_no') + ' — ' + cp.need.map(needText).join(' + ')); }
    const acts = $('shActs'); acts.innerHTML = '';
    const btn = (label, cls, fn) => { const b = document.createElement('button'); b.className = cls; b.textContent = label; b.onclick = fn; acts.appendChild(b); };
    if (!buyable(c)) { const p = document.createElement('p'); p.className = 'earn'; p.textContent = '🏆 ' + t('st_earn_only'); acts.appendChild(p); }
    else btn(t('st_buy') + '  ' + TOKEN + ' ' + fmtTok(priceOf(c)), 'big' + (S.tokens < priceOf(c) ? ' poor' : ''), () => {
      if (S.tokens < priceOf(c)) { sfx.bad(); toast(t('st_no_tokens')); return; }
      S.tokens = Math.round((S.tokens - priceOf(c)) * 1e7) / 1e7; add(id); save(); sfx.win(); toast('🎉 ' + t('st_bought')); render();
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
    if (n >= 3 && c.r < MAX_LV) btn(t('st_merge'), 'ghost merge', () => {
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
  const TEST_GRANT = 5000;
  $('stTest').onclick = () => { S.tokens += TEST_GRANT; save(); sfx.win(); render(); };

  // office-PC helpers: starter money for parts, check/consume an owned part, jump to a category
  const give = (n) => { S.tokens = Math.round((S.tokens + n) * 1e7) / 1e7; save(); };
  const partId = (fam) => Object.keys(S.cards).filter((id) => id.startsWith('parts.' + fam + '.') && S.cards[id] > 0).sort((a, b) => +b.split('.')[2] - +a.split('.')[2])[0];
  const usePart = (fam) => { const id = partId(fam); if (!id) return 0; add(id, -1); save(); return +id.split('.')[2]; };
  // wardrobe helpers: which outfit families the player owns, and their display info
  const ownedFams = (cat) => [...new Set(Object.keys(S.cards).filter((id) => id.startsWith(cat + '.') && S.cards[id] > 0).map((id) => id.split('.')[1]))];
  const famInfo = (cat, fam) => { const f = FAMILIES.find((x) => x.cat === cat && x.id === fam); return f ? { icon: f.icon, name: f.name[getLang()] || f.name.en } : null; };
  const equippedFam = (cat) => { const id = (S.equip[cat] || [])[0]; return id ? id.split('.')[1] : null; };
  const setNeeds = (fn, go) => { needsFn = fn; needsGo = go; };
  const needsReady = () => { const nd = needsFn(); return nd.length > 0 && nd.every(ownsPart); };
  const setCat = (c) => { view.cat = c; view.rarity = 0; view.q = ''; view.limit = 60; };
  return { S, bonuses, consumeBoosts, grantRandom, dropLevel, render, closeSheet, nameOf, give, partId, usePart, setCat, setNeeds, needsReady, ownedFams, famInfo, equippedFam };
}
