// Daily guide: for the first week a companion walks the player through one short lesson a day, step by step.
// Steps tick themselves off when the game reports the matching event. The player can stop the guide at any time.
export const DAYS = [
  [['move', 'g1a'], ['street', 'g1b'], ['talk', 'g1c'], ['life', 'g1d']],
  [['interview', 'g2a'], ['live', 'g2b'], ['round', 'g2c']],
  [['store', 'g3a'], ['buy', 'g3b'], ['equip', 'g3c']],
  [['life_buy', 'g4a'], ['cafe', 'g4b'], ['sleep', 'g4c']],
  [['pc', 'g5a'], ['publish', 'g5b'], ['skill', 'g5c']],
  [['gym', 'g6a'], ['dress', 'g6b'], ['friend', 'g6c']],
  [['daily', 'g7a'], ['profile', 'g7b'], ['round', 'g7c']],
];
const today = () => new Date().toISOString().slice(0, 10);

export function makeGuide(d) {
  const { store, t, sfx, toast, addCoins, $ } = d;
  const S = Object.assign({ on: true, day: 0, done: [], date: '', fin: false, open: false }, store.get('guide', {}));
  const save = () => store.set('guide', S);
  const steps = () => DAYS[S.day] || [];
  const dayDone = () => steps().every(([e]) => S.done.includes(e));
  // a new calendar day opens the next lesson once the current one is finished
  function roll() {
    if (S.fin || !S.on) return;
    if (!S.date) { S.date = today(); save(); }
    if (dayDone() && S.date !== today()) { if (S.day >= DAYS.length - 1) { S.fin = true; } else { S.day++; S.done = []; S.date = today(); } save(); }
  }
  function hit(e) {
    if (!S.on || S.fin || !d.ready()) return; roll();
    if (!steps().some(([x]) => x === e) || S.done.includes(e)) return;
    S.done.push(e); sfx.good();
    if (dayDone()) { const r = 50 * (S.day + 1); addCoins(r); toast('📘 ' + t('g_daydone').replace('{n}', S.day + 1) + ' · 🪙 +' + r); if (S.day >= DAYS.length - 1) S.fin = true; }
    else toast('✅ ' + t(steps().find(([x]) => x === e)[1]));
    save(); paint();
  }
  function stop() { S.on = false; save(); paint(); toast('📘 ' + t('g_stopped')); }
  function setOn(v) { S.on = v; if (v) { S.fin = S.fin && S.day >= DAYS.length - 1 && dayDone(); roll(); } save(); paint(); }
  function paint() {
    const el = $('guide'); if (!el) return; roll();
    const show = S.on && !S.fin && d.ready() && d.visible();
    el.hidden = !show; if (!show) return;
    const st = steps(), n = st.filter(([e]) => S.done.includes(e)).length, cur = st.find(([e]) => !S.done.includes(e));
    el.innerHTML = '';
    const ob = d.objective && d.objective(); if (ob) { const o = document.createElement('div'); o.className = 'gobj'; o.textContent = ob; el.appendChild(o); }
    const head = document.createElement('button'); head.className = 'ghd';
    head.textContent = '📘 ' + t('g_day').replace('{n}', S.day + 1) + ' · ' + n + '/' + st.length + '  ' + (cur ? '— ' + t(cur[1]) : '✅ ' + t('g_tomorrow'));
    head.onclick = () => { S.open = !S.open; save(); sfx.click(); paint(); }; el.appendChild(head);
    if (!S.open) return;
    const ul = document.createElement('ul'); st.forEach(([e, k]) => { const li = document.createElement('li'); li.textContent = (S.done.includes(e) ? '✅ ' : '⬜ ') + t(k); if (cur && cur[0] === e) li.className = 'cur'; ul.appendChild(li); }); el.appendChild(ul);
    const sb = document.createElement('button'); sb.className = 'gstop'; sb.textContent = '⏹ ' + t('g_stop'); sb.onclick = (ev) => { ev.stopPropagation(); stop(); }; el.appendChild(sb);
  }
  return { S, hit, paint, stop, setOn };
}
