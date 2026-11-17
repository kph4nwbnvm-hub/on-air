// App-token store: buy, equip, use, merge cards; smart browsing (category, rarity, search, sort); collections.
import { trG } from './gearnames.js';
import './tr_gear.js';
import { CATS, CARDS, RARITY, EFFECTS, COLLECTIONS, card, value, priceOf, catOf, tierOf, isGear, buyable, info, note, MAX_LV, BUY_MAX, FAMILIES } from './catalog.js';
import { HUB_OF, supports, signalOf } from './levels.js';
import { fmtTok } from './pricing.js';

export const TOKEN = '💠';

export function makeStore(deps) {
  const { store, t, getLang, sfx, toast, $ } = deps; const onEv = (e) => deps.onEvent && deps.onEvent(e);
  const S = {
    tokens: store.get('tok', 0),
    cards: store.get('cards', {}),
    equip: store.get('equip', {}),
    boosts: store.get('boosts', []),
    wear: store.get('wear', {}),     // rounds used by the equipped copy of each card
    unused: store.get('unused', {}), // bought and never used: { id: { n, ts } } → can be returned within 7 days
    listed: store.get('listed', []), // my used-market listings
  };
  const save = () => { store.set('tok', S.tokens); store.set('cards', S.cards); store.set('equip', S.equip); store.set('boosts', S.boosts); store.set('wear', S.wear); store.set('unused', S.unused); store.set('listed', S.listed); };
  const count = (id) => S.cards[id] || 0;
  const add = (id, n = 1) => { S.cards[id] = count(id) + n; if (S.cards[id] <= 0) delete S.cards[id]; };
  const equipped = () => Object.values(S.equip).flat();
  const isEquipped = (id) => equipped().includes(id);
  const fmtEff = (k, v) => { const s = t('e_' + k); return v < 0 ? s.replace('+{v}', String(v)).replace('{v}', String(v)) : s.replace('{v}', v); };
  const famName = (c) => (c.fam.cat === 'parts' ? t('p_' + c.fam.id) : (getLang() === 'ar' ? c.fam.name.ar : trG(c.fam.name.en, getLang())));
  const nameOf = (c) => { const i = info(c); const st = getLang() === 'ar' ? i.ar : trG(i.en, getLang()); return i.full ? st : famName(c) + ' · ' + st; };
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
  // ---- lifetime: every piece works for a number of broadcasts, then wears out like real gear ----
  const WEARS = (cat) => !['use', 'future'].includes(catOf(cat).kind);
  const lifeOf = (c) => 20 + c.r * 6; // broadcasts
  const lifePct = (id) => { const c = card(id); if (!c || !WEARS(c.fam.cat)) return 100; return Math.max(0, Math.round(100 * (1 - (S.wear[id] || 0) / lifeOf(c)))); };
  const wearMult = (id) => { const p = lifePct(id); return p <= 0 ? 0 : p <= 15 ? 0.35 : p <= 20 ? 0.6 : 1; };
  const lifeBar = (p) => (p <= 0 ? '⛔ ' : p <= 15 ? '🟥 ' : p <= 20 ? '🟧 ' : '🟩 ') + p + '%';
  // one broadcast done: every equipped piece (and the cables it uses) ages; a worn-out piece is swapped for a spare if there is one
  function wearRound() {
    const ids = new Set(equipped()); equipped().forEach((id) => { const conn = info(card(id) || {}).conn; if (conn) { const cid = Object.keys(S.cards).find((x) => x.startsWith('cables.' + conn + '.') && S.cards[x] > 0); if (cid) ids.add(cid); } });
    const msgs = [];
    ids.forEach((id) => { const c = card(id); if (!c || !WEARS(c.fam.cat)) return; const before = lifePct(id); S.wear[id] = (S.wear[id] || 0) + 1; const p = lifePct(id);
      if (p <= 0) { if (count(id) > 1) { add(id, -1); S.wear[id] = 0; msgs.push('🔁 ' + nameOf(c) + ' — ' + t('st_spare')); } else if (before > 0) msgs.push('⛔ ' + nameOf(c) + ' — ' + t('st_broken')); else S.wear[id] = lifeOf(c); }
      else if (p <= 15 && before > 15) msgs.push('🟥 ' + nameOf(c) + ' — ' + t('st_fault2'));
      else if (p <= 20 && before > 20) msgs.push('🟧 ' + nameOf(c) + ' — ' + t('st_fault1')); });
    save(); return msgs;
  }
  // during a broadcast an aged piece can fail for a moment: returns a message, or '' when all is fine
  function faultCheck() {
    const weak = equipped().filter((id) => lifePct(id) <= 20); if (!weak.length) return '';
    const id = weak[Math.floor(Math.random() * weak.length)]; const p = lifePct(id); if (Math.random() > (p <= 15 ? 0.6 : 0.3)) return '';
    return (p <= 0 ? '⛔ ' : '⚠️ ') + nameOf(card(id)) + ' — ' + t(p <= 0 ? 'st_broken' : p <= 15 ? 'st_fault2' : 'st_fault1');
  }
  const markUsed = (id) => { if (S.unused[id]) { delete S.unused[id]; } };
  const refundable = (id) => { const u = S.unused[id]; return !!u && u.n > 0 && count(id) > 0 && Date.now() - u.ts < 7 * 86400000 && !isEquipped(id); };
  // used value: the new price, scaled by the life left and a 40% second-hand cut; a listing may ask at most 20% more
  const usedValue = (id) => { const c = card(id); return Math.max(0.0001, Math.round(priceOf(c) * (lifePct(id) / 100) * 0.6 * 1e4) / 1e4); };
  const usedCap = (id) => Math.round(usedValue(id) * 1.2 * 1e4) / 1e4;

  function bonuses() {
    const b = Object.fromEntries(Object.keys(EFFECTS).map((k) => [k, 0]));
    [...equipped(), ...S.boosts].forEach((id) => { const c = card(id); if (!c || catOf(c.fam.cat).kind === 'future') return; let v = value(c); if (v > 0 && !compat(c).ok) return; if (v > 0) v *= wearMult(id); b[c.fam.effect] += v; });
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
    mk('all', '🗂️ ' + t('st_all')); mk('owned', '🎒 ' + t('st_owned')); mk('equipped', '✅ ' + t('st_equipped')); mk('used', '♻️ ' + t('st_used'));
    CATS.forEach((c) => mk(c.id, c.icon + ' ' + t('c_' + c.id)));
    const rr = $('stRar'); rr.innerHTML = '';
    [0, 1, 2, 3, 4, 5].forEach((r) => { const b = document.createElement('button'); b.textContent = r ? t('r' + r) + ' ' + ((r - 1) * 3 + 1) + '–' + r * 3 : t('st_all'); if (r) b.style.borderColor = RARITY[r - 1].color; if (view.rarity === r) b.className = 'sel'; b.onclick = () => { view.rarity = r; view.limit = 60; sfx.click(); render(); }; rr.appendChild(b); });
    const so = $('stSort'); so.innerHTML = ''; [['cheap', t('st_cheap')], ['rare', t('st_rare')]].forEach(([v, l]) => { const o = document.createElement('option'); o.value = v; o.textContent = l; so.appendChild(o); }); so.value = view.sort;
    $('stSearch').placeholder = t('st_search'); $('stTest').textContent = t('st_test').replace('+50', '+' + TEST_GRANT.toLocaleString('en-US'));
  }
  function list() {
    const q = view.q.trim().toLowerCase(); const lang = getLang();
    let L = CARDS.filter((c) => {
      if (view.cat === 'used') return false; if (view.cat === 'owned' && !count(c.id)) return false;
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
    if (count(c.id) && S.wear[c.id]) { const lp = lifePct(c.id); const w = document.createElement('i'); w.className = 'life' + (lp <= 20 ? ' low' : ''); w.textContent = lifeBar(lp); el.appendChild(w); }
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
    const g = $('stGrid'); g.innerHTML = ''; if (view.cat === 'used') { $('stMore').hidden = true; renderUsed(g); return; } const L = list();
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
      S.tokens = Math.round((S.tokens - priceOf(c)) * 1e7) / 1e7; add(id); const u = S.unused[id] || { n: 0, ts: 0 }; S.unused[id] = { n: u.n + 1, ts: Date.now() }; save(); sfx.win(); toast('🎉 ' + t('st_bought')); onEv('buy'); render();
    });
    if (n && cat.kind === 'equip') {
      if (isEquipped(id)) btn(t('st_unequip'), 'ghost', () => { S.equip[cat.id] = (S.equip[cat.id] || []).filter((x) => x !== id); save(); sfx.click(); render(); });
      else btn(t('st_equip'), 'ghost', () => {
        const slot = S.equip[cat.id] || []; if (slot.length >= cat.slots) { sfx.bad(); toast(t('st_slots')); return; }
        S.equip[cat.id] = [...slot, id]; markUsed(id); save(); sfx.win(); onEv('equip'); render();
      });
    }
    if (n && cat.kind === 'use') btn(t('st_use'), 'ghost', () => {
      if (isEquippedBoost(id)) return; add(id, -1); markUsed(id); S.boosts.push(id); save(); sfx.win(); toast('⚡ ' + t('st_active')); render();
    });
    if (n >= 3 && c.r < MAX_LV) btn(t('st_merge'), 'ghost merge', () => {
      markUsed(id); add(id, -3); if (!count(id)) S.equip[cat.id] = (S.equip[cat.id] || []).filter((x) => x !== id);
      add(`${c.fam.cat}.${c.fam.id}.${c.r + 1}`); save(); sfx.win(); toast('✨ ' + t('st_merged')); openSheet(`${c.fam.cat}.${c.fam.id}.${c.r + 1}`); render();
    });
    // lifetime of the owned piece
    if (n && WEARS(c.fam.cat)) { const lp = lifePct(id); const p = document.createElement('p'); p.className = 'earn'; p.textContent = '🔧 ' + t('st_life') + ': ' + lifeBar(lp) + ' · ' + Math.max(0, lifeOf(c) - (S.wear[id] || 0)) + '/' + lifeOf(c) + ' ' + t('st_rounds') + (lp <= 20 ? ' · ' + t(lp <= 0 ? 'st_broken' : lp <= 15 ? 'st_fault2' : 'st_fault1') : ''); acts.appendChild(p); }
    // links to the matching hub and cable, and to the full working set
    if (inf.conn) {
      cp.need.forEach((nd) => { const tid = nd.kind === 'hub' ? hubFor(nd.hub, nd.conn) : 'cables.' + nd.conn + '.1'; if (!tid) return; const tc = card(tid);
        btn('🔗 ' + t('st_goto') + ': ' + tc.fam.icon + ' ' + nameOf(tc), 'ghost link', () => { sfx.click(); openSheet(tid); }); });
      const set = setFor(c); if (set.length > 1) btn('📦 ' + t('st_fullset') + ' (' + set.length + ')', 'ghost link', () => { sfx.click(); openSet(c); });
    }
    if (refundable(id)) btn('↩️ ' + t('st_return') + '  ' + TOKEN + ' ' + fmtTok(priceOf(c)), 'ghost', () => {
      const u = S.unused[id]; add(id, -1); u.n--; if (u.n <= 0) delete S.unused[id]; S.tokens = Math.round((S.tokens + priceOf(c)) * 1e7) / 1e7; save(); sfx.good(); toast('↩️ ' + t('st_returned')); render();
    });
    if (n && !isEquipped(id) && buyable(c) && catOf(c.fam.cat).kind !== 'use') btn('🏷️ ' + t('st_sell'), 'ghost', () => { sfx.click(); openSell(id); });
  }
  // the lowest hub level that takes this connector
  function hubFor(hub, conn) { for (let lv = 1; lv <= BUY_MAX; lv++) if (supports(hub, lv, conn)) return 'equip.' + hub + '.' + lv; return null; }
  // everything a device needs to work: the device, a hub that supports its connector, and the cable
  function setFor(c) { const inf = info(c); const sig = signalOf(c.fam.cat, c.fam.id); if (!sig || !inf.conn) return [c.id]; const hub = HUB_OF[sig]; const out = [c.id];
    if (!(hubLevel(hub) && supports(hub, hubLevel(hub), inf.conn)) && !(c.fam.cat === 'equip' && c.fam.id === hub)) { const h = hubFor(hub, inf.conn); if (h) out.push(h); }
    if (!ownsCable(inf.conn)) out.push('cables.' + inf.conn + '.1'); return out; }
  function openSet(c) {
    const ids = setFor(c); const acts = $('shActs'); acts.innerHTML = ''; const toBuy = ids.filter((x) => !count(x)); const total = toBuy.reduce((a, x) => a + priceOf(card(x)), 0);
    const h = document.createElement('p'); h.className = 'earn'; h.textContent = '📦 ' + t('st_fullset_h'); acts.appendChild(h);
    ids.forEach((x) => { const xc = card(x); const b = document.createElement('button'); b.className = 'ghost link'; b.textContent = xc.fam.icon + ' ' + nameOf(xc) + '  ' + TOKEN + ' ' + fmtTok(priceOf(xc)) + (count(x) ? '  ✅' : ''); b.onclick = () => openSheet(x); acts.appendChild(b); });
    if (!toBuy.length) return; const all = document.createElement('button'); all.className = 'big' + (S.tokens < total ? ' poor' : ''); all.textContent = t('st_buyset') + '  ' + TOKEN + ' ' + fmtTok(total);
    all.onclick = () => { if (S.tokens < total) { sfx.bad(); toast(t('st_no_tokens')); return; } toBuy.forEach((x) => { S.tokens = Math.round((S.tokens - priceOf(card(x))) * 1e7) / 1e7; add(x); const u = S.unused[x] || { n: 0, ts: 0 }; S.unused[x] = { n: u.n + 1, ts: Date.now() }; }); save(); sfx.win(); toast('🎉 ' + t('st_bought')); onEv('buy'); openSheet(c.id); render(); };
    acts.appendChild(all);
  }
  // sell a used piece on the players' market: the price can go up to 20% above its estimated used value
  function openSell(id) {
    const c = card(id); const acts = $('shActs'); acts.innerHTML = ''; const est = usedValue(id), cap = usedCap(id);
    const h = document.createElement('p'); h.className = 'earn'; h.textContent = '🏷️ ' + t('st_sell_h').replace('{l}', lifePct(id) + '%').replace('{v}', fmtTok(est)).replace('{m}', fmtTok(cap)); acts.appendChild(h);
    const r = document.createElement('input'); r.type = 'range'; r.min = Math.round(est * 0.5 * 1e4); r.max = Math.round(cap * 1e4); r.value = Math.round(est * 1e4); r.className = 'sellr'; acts.appendChild(r);
    const go = document.createElement('button'); go.className = 'big'; const lbl = () => { go.textContent = t('st_list') + '  ' + TOKEN + ' ' + fmtTok(+r.value / 1e4); }; lbl(); r.oninput = lbl;
    go.onclick = async () => { const price = Math.min(cap, +r.value / 1e4); const ok = await market.list(id, lifePct(id), price); if (!ok) { sfx.bad(); toast('🌐 ' + t('st_market_off')); return; } add(id, -1); delete S.wear[id]; markUsed(id); S.listed.push({ id, price, life: lifePct(id), ts: Date.now(), lid: ok }); save(); sfx.win(); toast('🏷️ ' + t('st_listed')); closeSheet(); render(); };
    acts.appendChild(go);
  }
  // used market (other players' listings) — served by the game server
  const market = deps.market || { list: async () => null, browse: async () => [], buy: async () => null };
  async function renderUsed(g) {
    const p = document.createElement('p'); p.className = 'empty'; p.textContent = '⏳'; g.appendChild(p);
    const L = await market.browse(); g.innerHTML = '';
    const head = document.createElement('p'); head.className = 'colh'; head.textContent = '♻️ ' + t('st_used_h'); g.appendChild(head);
    if (!L) { const e = document.createElement('p'); e.className = 'empty'; e.textContent = '🌐 ' + t('st_market_off'); g.appendChild(e); return; }
    if (!L.length) { const e = document.createElement('p'); e.className = 'empty'; e.textContent = t('st_used_none'); g.appendChild(e); }
    L.forEach((it) => { const c = card(it.card); if (!c) return; const el = tile(c); el.onclick = null; el.children[3].textContent = '🔧 ' + lifeBar(it.life) + (it.mine ? ' · ' + t('st_mine') : ''); el.children[4].textContent = TOKEN + ' ' + fmtTok(it.price);
      el.onclick = async () => { if (it.mine) return; if (S.tokens < it.price) { sfx.bad(); toast(t('st_no_tokens')); return; } const ok = await market.buy(it.lid); if (!ok) { sfx.bad(); toast('🌐 ' + t('st_market_off')); return; }
        S.tokens = Math.round((S.tokens - it.price) * 1e7) / 1e7; add(it.card); S.wear[it.card] = Math.round(lifeOf(c) * (1 - it.life / 100)); save(); sfx.win(); toast('🎉 ' + t('st_bought')); render(); };
      g.appendChild(el); });
  }
  // credits from my listings that other players bought
  async function collectSales() { const got = await market.collect?.(); if (got && got.total > 0) { S.tokens = Math.round((S.tokens + got.total) * 1e7) / 1e7; S.listed = S.listed.filter((x) => !got.ids.includes(x.lid)); save(); toast('💰 ' + t('st_sold').replace('{v}', fmtTok(got.total))); } }
  const isEquippedBoost = (id) => false;
  function closeSheet() { sheetId = null; $('stSheet').hidden = true; }

  $('stSearch').addEventListener('input', (e) => { view.q = e.target.value; view.limit = 60; render(); });
  $('stSort').addEventListener('change', (e) => { view.sort = e.target.value; render(); });
  $('stMore').onclick = () => { view.limit += 60; render(); };
  $('shClose').onclick = () => { sfx.click(); closeSheet(); };
  $('stSheet').addEventListener('click', (e) => { if (e.target.id === 'stSheet') closeSheet(); });
  const TEST_GRANT = 5000;
  $('stTest').onclick = () => { S.tokens += TEST_GRANT; save(); sfx.win(); render(); };
  // the free test balance exists only on the Testnet site and local builds, never on Mainnet
  if (!/kph4nwbnvm-hub|localhost|127\.0\.0\.1/.test(location.hostname)) $('stTest').remove();

  // office-PC helpers: starter money for parts, check/consume an owned part, jump to a category
  const give = (n) => { S.tokens = Math.round((S.tokens + n) * 1e7) / 1e7; save(); };
  const partId = (fam) => Object.keys(S.cards).filter((id) => id.startsWith('parts.' + fam + '.') && S.cards[id] > 0).sort((a, b) => +b.split('.')[2] - +a.split('.')[2])[0];
  const usePart = (fam) => { const id = partId(fam); if (!id) return 0; add(id, -1); save(); return +id.split('.')[2]; };
  // wardrobe helpers: which outfit families the player owns, and their display info
  const ownedFams = (cat) => [...new Set(Object.keys(S.cards).filter((id) => id.startsWith(cat + '.') && S.cards[id] > 0).map((id) => id.split('.')[1]))];
  const famInfo = (cat, fam) => { const f = FAMILIES.find((x) => x.cat === cat && x.id === fam); return f ? { icon: f.icon, name: getLang() === 'ar' ? f.name.ar : trG(f.name.en, getLang()) } : null; };
  const equippedFam = (cat) => { const id = (S.equip[cat] || [])[0]; return id ? id.split('.')[1] : null; };
  const setNeeds = (fn, go) => { needsFn = fn; needsGo = go; };
  const needsReady = () => { const nd = needsFn(); return nd.length > 0 && nd.every(ownsPart); };
  const setCat = (c) => { view.cat = c; view.rarity = 0; view.q = ''; view.limit = 60; };
  return { S, wearRound, faultCheck, collectSales, lifePct, bonuses, consumeBoosts, grantRandom, dropLevel, render, closeSheet, nameOf, give, partId, usePart, setCat, setNeeds, needsReady, ownedFams, famInfo, equippedFam };
}
