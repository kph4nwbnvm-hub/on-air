// Extra languages added on top of Pi's 53: each file is the whole interface, in the order of ui_keys.js.
import KEYS from './ui_keys.js';
import mr from './tr_x_mr.js';
const mk = (arr) => { const o = {}; if (arr.length === KEYS.length) KEYS.forEach((k, i) => { if (arr[i]) o[k] = arr[i]; }); return o; };
export const EXTRA_LANGS = [{ code: 'mr', name: 'मराठी' }];
export const EXTRA = { mr: mk(mr) };
