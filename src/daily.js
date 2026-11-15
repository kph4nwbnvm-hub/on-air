// Daily login rewards (free studio coins, never convertible to the app token).
// 30-day cycle: 20 coins a day, 100 on day 7, 150 on day 14, 200 on day 21, 500 + an exclusive item on day 30.
// Missing a day sends the player back to the first day of the week they are in; one grace day per 30-day cycle
// lets a single missed day pass without a reset.

export const CYCLE = 30;
export const rewardFor = (day) => ({ 7: 100, 14: 150, 21: 200, 30: 500 }[day] || 20);
export const isBig = (day) => day % 7 === 0 || day === CYCLE;

const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysBetween = (a, b) => Math.round((Date.UTC(...b.split('-').map((x, i) => (i === 1 ? x - 1 : +x))) - Date.UTC(...a.split('-').map((x, i) => (i === 1 ? x - 1 : +x)))) / 864e5);
const weekStart = (day) => Math.floor((day - 1) / 7) * 7 + 1;

// state: { last: 'YYYY-MM-DD' | null, day: last claimed day (0..30), cycle, graceUsed }
// Returns what today's claim would be, without changing anything: { due, day, note } where note is '', 'grace' or 'reset'.
export function preview(state, now = new Date()) {
  const today = dayKey(now);
  if (state.last === today) return { due: false, day: state.day, note: '' };
  if (!state.last) return { due: true, day: 1, note: '', newCycle: true };
  const gap = daysBetween(state.last, today);
  if (gap < 0) return { due: false, day: state.day, note: '' }; // clock moved back: wait
  const next = state.day >= CYCLE ? 1 : state.day + 1;
  const newCycle = state.day >= CYCLE;
  if (gap === 1) return { due: true, day: next, note: '', newCycle };
  if (gap === 2 && !state.graceUsed && !newCycle) return { due: true, day: next, note: 'grace', newCycle };
  return { due: true, day: newCycle ? 1 : weekStart(next), note: 'reset', newCycle };
}

export function claim(state, now = new Date()) {
  const p = preview(state, now);
  if (!p.due) return null;
  const s = { ...state, last: dayKey(now), day: p.day };
  if (p.newCycle) { s.cycle = (state.cycle || 0) + (state.last ? 1 : 0); s.graceUsed = false; }
  if (p.note === 'grace') s.graceUsed = true;
  return { state: s, day: p.day, coins: rewardFor(p.day), grand: p.day === CYCLE, note: p.note };
}
