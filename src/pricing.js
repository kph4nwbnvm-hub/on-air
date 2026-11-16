// Store pricing (decided 16 Nov 2026).
// 1 Pi = 1,000 app tokens. Each rarity has two prices:
//   - mining price: what the item is worth in days of mining (0.1 / 0.2 / 0.4 / 1 / 2.5 Pi)
//   - dollar band: what game stores charge (0.5 / 1.5 / 2.5 / 4.5 / 7.5 USD)
// AUTO mode charges the lower of the two. While Pi is cheap, the mining price applies; if Pi's dollar price rises
// (above roughly $3-5), items automatically follow the dollar bands. To reprice, only PI_USD needs to change.

export const TOKENS_PER_PI = 1000;
export const PI_USD = 0.0634;          // Pi market price used for repricing (theblock, 15 Nov 2026). Update when it moves.
export const MODE = 'auto';            // 'auto' | 'mining' | 'usd'
// 15 levels on a geometric curve between the approved ends: 0.1 Pi (level 1) to 2.5 Pi (level 15); dollar band 0.5 to 7.5 USD.
export const MINING_PI = Array.from({ length: 15 }, (_, i) => Math.round(0.1 * Math.pow(25, i / 14) * 1000) / 1000);
export const USD_BAND = Array.from({ length: 15 }, (_, i) => Math.round(0.5 * Math.pow(15, i / 14) * 100) / 100);

const round7 = (x) => Math.round(x * 1e7) / 1e7;   // token amounts carry at most 7 decimals
export function tokenPrice(rarity) {
  const i = rarity - 1;
  const mining = MINING_PI[i] * TOKENS_PER_PI;
  const usd = (USD_BAND[i] / PI_USD) * TOKENS_PER_PI;
  const p = MODE === 'mining' ? mining : MODE === 'usd' ? usd : Math.min(mining, usd);
  return round7(p);
}
export const tokenToPi = (tok) => tok / TOKENS_PER_PI;
export function fmtTok(n) {
  if (n >= 100) return Math.round(n).toLocaleString('en-US');
  if (n >= 1) return String(Math.round(n * 100) / 100);
  return String(Number(n.toPrecision(3)));
}
