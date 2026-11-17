// Voices: every character gets a voice that fits their gender and age, and two people talking never sound alike.
// The device's own voices are used (no server). Voices are matched by name to a gender; if the device has only one
// voice for a language, pitch and speed still separate men, women, children and elders.
const FEMALE = /samantha|karen|victoria|zira|moira|tessa|fiona|veena|kate|serena|susan|allison|ava|joanna|salli|kendra|kimberly|ivy|amelie|audrey|aurelie|marie|julie|anna|petra|helena|paulina|monica|sara|laila|mariam|hoda|salma|amira|zeina|nora|ellen|alice|carmit|damayanti|ioana|kanya|kyoko|lekha|luciana|meijia|mei-jia|melina|milena|sin-ji|tingting|ting-ting|yuna|yelda|zuzana|mariska|joana|sabina|alva|catarina|satu|female|woman|frau|femme|mujer|hazel|heera|haruka|huihui|yaoyao|sabina|elsa|hedda|katja|denise|lucia|elena|irina|sylvie|caroline|heami|kalpana|kalinda|ewa|paola|chiara|jenny|aria|sonia|libby|natasha|zira/i;
const MALE = /\balex\b|daniel|fred|\btom\b|aaron|arthur|gordon|rishi|thomas|jorge|juan|diego|luca|maged|tarik|majed|naayf|hamed|xander|yuri|oliver|reed|rocko|grandpa|eddy|ralph|albert|bruce|junior|david|mark|george|james|male|\bman\b|hattori|otoya|ichiro|kangkang|danny|stefan|pablo|raul|paul|hans|markus|guy|ryan|eric|guy|andrew|brian|christopher|liam|william|jacob|naveen|ravi|pavel|dmitri|ahmet|filip|jan\b/i;
const AGE = { kid: { pitch: 1.45, rate: 1.08 }, young: { pitch: 1.12, rate: 1.04 }, adult: { pitch: 1, rate: 1 }, old: { pitch: 0.78, rate: 0.9 } };
// the player's own voice choices: gender × tone
export const MY_VOICES = [['m', 'low'], ['m', 'mid'], ['m', 'high'], ['f', 'low'], ['f', 'mid'], ['f', 'high']];
const TONE = { low: 0.82, mid: 1, high: 1.18 };
// every country (ISO 3166-1 alpha-2); names come from the device in the player's language
export const COUNTRIES = 'SA AE KW QA BH OM YE IQ JO SY LB PS EG SD LY TN DZ MA MR SO DJ KM TR IR AF PK IN BD LK NP BT MV MM TH LA KH VN MY SG BN ID PH TL CN HK MO TW KR KP JP MN KZ UZ TM KG TJ AZ AM GE RU UA BY MD PL CZ SK HU RO BG RS HR SI BA ME MK AL GR CY MT IT SM VA ES PT AD FR MC BE NL LU DE AT CH LI DK NO SE FI IS IE GB EE LV LT US CA MX GT BZ SV HN NI CR PA CU JM HT DO BS BB TT GD LC VC AG DM KN CO VE GY SR EC PE BO BR PY UY AR CL NG GH CI SN ML BF NE TD CM CF GA CG CD AO ZM ZW MW MZ TZ KE UG RW BI ET ER SS ZA NA BW LS SZ MG MU SC CV GM GN GW SL LR TG BJ GQ ST AU NZ PG FJ SB VU WS TO KI TV NR FM MH PW'.split(' ');
export const flagOf = (cc) => (cc && cc.length === 2 ? String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0))) : '🏳️');
export function countryName(cc, lang) {
  try { const dn = new Intl.DisplayNames([lang === 'zh-Hans' ? 'zh-CN' : lang === 'zh-Hant' ? 'zh-TW' : lang, 'en'], { type: 'region' }); return dn.of(cc) || cc; } catch (e) { return cc; }
}

export function makeVoices() {
  const profiles = {}; let last = null;
  const setProfile = (name, p) => { if (name) profiles[name] = p; };
  const genderOf = (v) => (FEMALE.test(v.name || '') ? 'f' : MALE.test(v.name || '') ? 'm' : '');
  const hash = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  // pick a device voice and settings for one speaker; `voices` are the device voices for the current language
  function pick(name, voices, best) {
    const p = profiles[name] || { g: hash(name) % 2 ? 'f' : 'm', age: 'adult' };
    const pool = voices.filter((v) => genderOf(v) === p.g);
    const v = pool.length ? pool[hash(name) % pool.length] : best;
    const a = AGE[p.age] || AGE.adult; let pitch = a.pitch * (p.tone || 1), rate = a.rate;
    if (!v || genderOf(v) !== p.g) pitch *= p.g === 'f' ? 1.22 : 0.86; // no matching voice: let the pitch carry the gender
    pitch += ((hash(name) % 7) - 3) * 0.025; // small personal colour, so two people of the same kind still differ
    if (last && last.name !== name && last.voice === (v && v.name) && Math.abs(last.pitch - pitch) < 0.1) pitch += pitch > 1 ? -0.14 : 0.14;
    pitch = Math.max(0.5, Math.min(1.9, pitch)); last = { name, voice: v && v.name, pitch };
    return { voice: v, pitch, rate };
  }
  return { setProfile, pick, profiles, TONE };
}
