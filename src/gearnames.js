// Translated equipment / level names. gear_en.js is a frozen English list; each language file holds the same list in the same order.
// A name missing from the list (added later) simply falls back to English.
import EN from './gear_en.js';
const IDX = new Map(EN.map((s, i) => [s, i])); const GT = {};
export const addGear = (lang, arr) => { if (Array.isArray(arr) && arr.length === EN.length) GT[lang] = arr; };
export const trG = (en, lang) => { const a = GT[lang], i = IDX.get(en); return a && i !== undefined && a[i] ? a[i] : en; };
export const gearLangs = () => Object.keys(GT);
