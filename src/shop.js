// Progression and shop: player levels unlock a mix of items; unlocked items are bought with studio coins.
// Item ids: "<field>:<index>" for indexed options (cloth:<i> covers top, bottom and cap colours) and "acc:<name>".

// Items that are free from the start.
const FREE = new Set([
  'hairStyle:0', 'hairStyle:1', 'hairStyle:2', 'hairColor:0', 'hairColor:1', 'hairColor:2', 'beard:0',
  'top:0', 'top:1', 'bottom:0', 'cloth:0', 'cloth:1', 'cloth:2', 'cloth:3', 'cloth:7', 'shoes:0', 'shoes:1',
]);

// Each level unlocks a mix of items from every category; higher levels unlock more.
export const LEVEL_ITEMS = {
  2: ['hairStyle:3', 'cloth:4', 'acc:cap'],
  3: ['hairColor:3', 'beard:1', 'bottom:1', 'acc:glasses'],
  4: ['top:2', 'shoes:2', 'cloth:5', 'acc:headphones'],
  5: ['hairStyle:4', 'hairColor:4', 'beard:2', 'cloth:6', 'acc:watch'],
  6: ['shoes:3', 'hairColor:5', 'cloth:8', 'acc:chain', 'acc:earring', 'beard:3'],
  7: ['hairStyle:5', 'hairColor:6', 'hairColor:7', 'shoes:4', 'cloth:9', 'acc:bracelet', 'acc:bag'],
};
export const MAX_LEVEL = 7;

// Exclusive items: never sold; one is granted with each day-30 daily grand prize, in this order.
export const EXCLUSIVE = ['cloth:10', 'shoes:5', 'cloth:11', 'hairColor:8'];
const EXCL = new Set(EXCLUSIVE);
export const isExclusive = (id) => EXCL.has(id);

const REQ = {};
Object.entries(LEVEL_ITEMS).forEach(([lv, ids]) => ids.forEach((id) => { REQ[id] = +lv; }));
export const reqLevel = (id) => REQ[id] || 1;
export const price = (id) => (FREE.has(id) ? 0 : 30 * reqLevel(id) + (id.startsWith('acc:') ? 20 : 0));

// Bundles: sold at a discount; a pack grants its items even before the player reaches their level.
export const PACKS = [
  { id: 'street', level: 2, cost: 250, items: ['acc:cap', 'bottom:1', 'cloth:4', 'shoes:2'] },
  { id: 'star', level: 4, cost: 390, items: ['top:2', 'acc:glasses', 'acc:watch', 'cloth:6'] },
  { id: 'night', level: 6, cost: 690, items: ['acc:headphones', 'acc:earring', 'acc:chain', 'acc:bag', 'cloth:9'] },
];

// XP needed to reach a level (cumulative): L2 100, L3 300, L4 600, L5 1000, L6 1500, L7 2100.
export const xpFor = (lv) => 50 * lv * (lv - 1);
export function levelOf(xp) { let lv = 1; while (lv < MAX_LEVEL && xp >= xpFor(lv + 1)) lv++; return lv; }
export const roundXp = (trust, pass) => Math.round(20 + trust * 60 + (pass ? 40 : 0));

export function makeShop(store) {
  const owned = new Set(store.get('owned', []));
  const S = {
    xp: store.get('xp', 0),
    get level() { return levelOf(S.xp); },
    has: (id) => FREE.has(id) || owned.has(id),
    available: (id) => S.has(id) || (!EXCL.has(id) && S.level >= reqLevel(id)),
    nextExclusive: () => EXCLUSIVE.find((id) => !S.has(id)) || null,
    grant(ids) { ids.forEach((id) => owned.add(id)); store.set('owned', [...owned]); },
    addXp(n) { const before = S.level; S.xp += n; store.set('xp', S.xp); return S.level > before; },
    packOwned: (p) => p.items.every((id) => S.has(id)),
  };
  return S;
}

// Ids of every item the avatar is wearing.
export function wornIds(a) {
  const ids = [`hairStyle:${a.hairStyle}`, `hairColor:${a.hairColor}`, `beard:${a.beard}`, `top:${a.top}`, `bottom:${a.bottom}`,
    `cloth:${a.topColor}`, `cloth:${a.bottomColor}`, `shoes:${a.shoes}`];
  Object.keys(a.acc || {}).forEach((k) => { if (a.acc[k]) ids.push('acc:' + k); });
  if (a.acc && a.acc.cap) ids.push(`cloth:${a.capColor}`);
  return [...new Set(ids)];
}
