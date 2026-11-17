import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { LANGS, STR } from './i18n.js';
import { piSignIn, PiState } from './pi.js';
import { M, box, cyl, sph, cap, tor, makeChar, sit, OPT, DEFAULT_AVATAR } from './char.js';
import { carModel, loadCars, loadKit, cityKit } from './city3d.js';
import { randomShape, BODY_KEYS, FACE_KEYS } from './shape.js';
import { reshape, register, loadReal, realTick, setRealEnabled, setRealBudget, realDebug } from './real.js';
const mk = (av, o) => register(makeChar(av), av, o);
import { makeShop, wornIds, price, reqLevel, PACKS, roundXp, xpFor, MAX_LEVEL, isExclusive, EXCLUSIVE } from './shop.js';
import { makeStore, TOKEN } from './store.js';
import { tokenPrice } from './pricing.js';
import * as SFX from './studiofx.js';
import * as ADS from './ads.js';
import * as ROOM from './room.js';
import { CATS } from './catalog.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { preview as dailyPreview, claim as dailyClaim, rewardFor, isBig, CYCLE } from './daily.js';

/* ---------- storage, i18n, sound ---------- */
const store = { get(k, d) { try { const v = localStorage.getItem('onair_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('onair_' + k, JSON.stringify(v)); } catch (e) {} } };
// first visit: take the language the player's phone / Pi app is set to; a manual pick in settings wins afterwards
function detectLang() {
  const codes = LANGS.map((l) => l.code); const list = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en']);
  for (const raw of list) {
    const tag = String(raw || '').toLowerCase(); const base = tag.split(/[-_]/)[0];
    if (base === 'zh') return /hant|tw|hk|mo/.test(tag) ? 'zh-Hant' : 'zh-Hans';
    const alias = { tl: 'fil', nb: 'no', nn: 'no', iw: 'he', in: 'id', ckb: 'ku', kmr: 'ku' }[base] || base;
    if (codes.includes(alias)) return alias;
  }
  return 'en';
}
let lang = store.get('lang', null) || detectLang();
let soundOn = store.get('sound', true);
const IS_MOBILE = /iPhone|iPad|iPod|Android|Mobile|PiBrowser/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 900);
// phones default to the light pipeline; a previous GPU crash forces it
const cfg = { real: store.get('real', true), voice: store.get('voice', true), vibe: store.get('vibe', true), quality: store.get('gpu_lost', false) ? 'low' : store.get('quality', IS_MOBILE ? 'low' : 'high') };
const stats = { rounds: 0, wins: 0, best: 0, since: Date.now(), ...store.get('stats', {}) }; if (!store.get('stats', null)) store.set('stats', stats);
let licence = store.get('licence', 0); const LIC = [null, { fans: 20, coins: 300, ads: 15 }, { fans: 150, coins: 1500, ads: 35 }, { fans: 600, coins: 5000, ads: 60 }];
const skills = { steady: 0, charm: 0, deals: 0, learn: 0, ...store.get('skills', {}) };
const VERSION = '1.9.1';
const buzz = (p) => { if (cfg.vibe && navigator.vibrate) try { navigator.vibrate(p); } catch (e) {} };
let avatar = { ...DEFAULT_AVATAR, ...store.get('avatar', {}) }; avatar.acc = { ...(avatar.acc || {}) };
const t = (k) => (STR[lang] && STR[lang][k]) || STR.en[k] || k;
const shop = makeShop(store);
// One-time migration: keep whatever an existing player already wears.
if (!store.get('shopv1', false)) { shop.grant(wornIds(avatar)); store.set('shopv1', true); }
// Put back any worn item the player does not own (used after previewing in the creator).
function stripUnowned() {
  const d = DEFAULT_AVATAR;
  ['hairStyle', 'hairColor', 'beard', 'top', 'bottom', 'shoes'].forEach((k) => { if (!shop.has(k + ':' + avatar[k])) avatar[k] = d[k]; });
  ['topColor', 'bottomColor', 'capColor'].forEach((k) => { if (!shop.has('cloth:' + avatar[k])) avatar[k] = d[k]; });
  Object.keys(avatar.acc).forEach((k) => { if (avatar.acc[k] && !shop.has('acc:' + k)) avatar.acc[k] = false; });
}
const $ = (id) => document.getElementById(id);
function applyLang() {
  const L = LANGS.find((l) => l.code === lang) || LANGS[0];
  document.documentElement.lang = L.code; document.documentElement.dir = L.rtl ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t(el.dataset.t); });
  try { syncSignText(); syncLogoSign(); ADS.setTr(t); } catch (_) {} try { syncSoon(); } catch (_) {} try { syncCity(); } catch (_) {}
  $('langBtn').textContent = '🌐 ' + L.name; $('bProfile').textContent = '👤 ' + t('profile'); $('bSettings').textContent = '⚙️ ' + t('settings'); $('bStore').textContent = '🛍️ ' + t('st_store');
  if (!$('settings').hidden) buildSettings(); if (!$('profile').hidden) buildProfile(); if (!$('storeS').hidden) cs.render(); if (!$('storeS').hidden) cs.render();
}
let AC = null;
function tone(f, dur, type = 'sine', when = 0, vol = 0.12) {
  if (!soundOn) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume();
    const o = AC.createOscillator(), g = AC.createGain(), t0 = AC.currentTime + when;
    o.type = type; o.frequency.value = f; g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(AC.destination); o.start(t0); o.stop(t0 + dur + 0.02);
  } catch (e) {}
}
const sfx = {
  click: () => tone(700, 0.06, 'triangle'), prank: () => { tone(520, 0.14, 'square', 0, 0.07); tone(390, 0.2, 'square', 0.13, 0.07); },
  fix: () => { tone(660, 0.09); tone(990, 0.14, 'sine', 0.08); }, good: () => { tone(784, 0.1); tone(1046, 0.18, 'sine', 0.1); },
  bad: () => { tone(300, 0.2, 'sawtooth', 0, 0.07); tone(220, 0.3, 'sawtooth', 0.16, 0.07); }, door: () => { tone(330, 0.12, 'triangle'); tone(495, 0.2, 'triangle', 0.1); },
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', i * 0.12)), lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.3, 'sawtooth', i * 0.18, 0.06)),
  seg: () => { tone(880, 0.1); tone(880, 0.1, 'sine', 0.18); },
};
// Device voices: pick the most natural voice the device offers for the current language,
// and give each speaker their own pitch/rate so the sponsor, director and guests sound different.
let VOICES = [];
function loadVoices() { try { VOICES = speechSynthesis.getVoices() || []; } catch (e) { VOICES = []; } }
if (window.speechSynthesis) { loadVoices(); try { speechSynthesis.addEventListener('voiceschanged', loadVoices); } catch (e) {} }
const ttsLang = () => (lang === 'zh-Hans' ? 'zh-CN' : lang === 'zh-Hant' ? 'zh-TW' : lang === 'fil' ? 'fil-PH' : lang === 'no' ? 'nb-NO' : lang);
function bestVoice() {
  const want = ttsLang().toLowerCase(), base = want.split('-')[0];
  const pref = { ar: 'ar-sa', en: 'en-us', es: 'es-es', fr: 'fr-fr', pt: 'pt-br', 'zh-cn': 'zh-cn', 'zh-tw': 'zh-tw' }[want] || want;
  let best = null, top = -1;
  VOICES.forEach((v) => {
    const vl = (v.lang || '').replace('_', '-').toLowerCase(); if (vl.split('-')[0] !== base) return;
    if ((want === 'zh-cn' || want === 'zh-tw') && !vl.startsWith(want)) return;
    let sc = 1; const n = v.name || '';
    if (/natural|neural|premium|enhanced|siri|wavenet|online/i.test(n)) sc += 6; if (/google/i.test(n)) sc += 3;
    if (/compact|eloquence|espeak/i.test(n)) sc -= 4; if (vl === pref) sc += 2; if (v.localService === false) sc += 1;
    if (sc > top) { top = sc; best = v; }
  });
  return best;
}
const VOICE_STYLE = [{ pitch: 0.82, rate: 0.98 }, { pitch: 1.08, rate: 1.04 }, { pitch: 0.95, rate: 1.0 }, { pitch: 1.2, rate: 1.06 }, { pitch: 0.9, rate: 1.02 }];
function speak(text, who) {
  if (!soundOn || !cfg.voice || !window.speechSynthesis) return;
  try {
    const m = text.match(/^([^:：]{1,28})[:：]\s*/); const name = who || (m ? m[1] : 'guest'); const body = m ? text.slice(m[0].length) : text;
    const v = bestVoice(); if (!v && VOICES.length) return; // no voice for this language: stay silent rather than read it wrongly
    let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0; const st = VOICE_STYLE[h % VOICE_STYLE.length];
    speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(body); u.lang = ttsLang(); if (v) u.voice = v; u.pitch = st.pitch; u.rate = st.rate; speechSynthesis.speak(u);
  } catch (e) {}
}

/* ---------- renderer ---------- */
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
const pixelRatio = () => (cfg.quality === 'low' ? Math.min(window.devicePixelRatio || 1, IS_MOBILE ? 1.6 : 1) : Math.min(window.devicePixelRatio || 1, IS_MOBILE ? 1.5 : 2));
renderer.setPixelRatio(pixelRatio());
renderer.shadowMap.enabled = !store.get('gpu_lost', false); renderer.shadowMap.type = IS_MOBILE ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
// surface shader compile/link failures on screen (phones hide the console)
renderer.debug.onShaderError = (gl, program, vs, fs) => { const log = (gl.getProgramInfoLog(program) || '') + ' ' + (gl.getShaderInfoLog(fs) || '') + ' ' + (gl.getShaderInfoLog(vs) || ''); try { showDiag('SHADER ' + log.trim().slice(0, 220)); errShown = 99; } catch (_) {} };
// if the phone's GPU drops the WebGL context (black screen), fall back to the light pipeline and reload once
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault(); store.set('gpu_lost', true); store.set('quality', 'low'); try { showDiag('GPU context lost — reloading in light mode'); } catch (_) {}
  const last = store.get('gpu_reload', 0); if (Date.now() - last > 60000) { store.set('gpu_reload', Date.now()); setTimeout(() => location.reload(), 400); }
}, false);
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
{ const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.55; }
const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 110);
const feedCam = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 40);

/* ---------- builders ---------- */
const ZG = { studio: new THREE.Group(), street: new THREE.Group(), event: new THREE.Group() };
Object.values(ZG).forEach((g) => scene.add(g));
let cur = ZG.studio;
function put(m, x, y, z, parent) { m.position.set(x, y, z); (parent || cur).add(m); return m; }
const shadow = (o) => { o.traverse((m) => { if (m.isMesh) m.castShadow = true; }); return o; };
function slab(w, h, d, r, c, o) {
  const s = new THREE.Shape(); const x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 });
  g.rotateX(-Math.PI / 2); g.translate(0, -h, 0); return new THREE.Mesh(g, M(c, o));
}
const UI_FONT = "'Tajawal','Noto Kufi Arabic','Noto Sans Arabic',system-ui,sans-serif";
const _mx = document.createElement('canvas').getContext('2d');
function fitFont(txt, weight, size, maxW) { let s = size; do { _mx.font = `${weight} ${s}px ${UI_FONT}`; s -= 2; } while (s > 12 && _mx.measureText(txt).width > maxW); return _mx.font; }
function textTex(txt, bg, fg, w = 512, h = 160, font = 'bold 104px system-ui, sans-serif') {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = fg; x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, w / 2, h / 2 + 6);
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; return tx;
}
function gradTex(c1, c2, c3) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256; const x = cv.getContext('2d');
  const g = x.createLinearGradient(0, 0, 256, 256); g.addColorStop(0, c1); g.addColorStop(0.55, c2); g.addColorStop(1, c3); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  x.fillStyle = 'rgba(255,255,255,.16)'; for (let i = 0; i < 9; i++) { x.beginPath(); x.arc(30 + i * 28, 200 - (i % 3) * 60, 16 + (i % 4) * 9, 0, 7); x.fill(); }
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; return tx;
}
const signPlane = (txt, bg, fg, w, h, tw, th, font) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: textTex(txt, bg, fg, tw || 512, th || 160, font) }));
const ground = (w, d, c, x, z) => { const g = put(new THREE.Mesh(new THREE.PlaneGeometry(w, d), M(c, { rough: 0.38, metal: 0.08 })), x, 0, z); g.rotation.x = -Math.PI / 2; g.receiveShadow = true; return g; };
function armchair(c) {
  const g = new THREE.Group();
  put(slab(0.95, 0.3, 0.9, 0.12, c), 0, 0.5, 0, g); put(slab(0.95, 0.8, 0.24, 0.1, c), 0, 1.15, -0.4, g);
  put(slab(0.2, 0.5, 0.86, 0.08, c), -0.52, 0.72, 0, g); put(slab(0.2, 0.5, 0.86, 0.08, c), 0.52, 0.72, 0, g);
  [[-0.38, 0.33], [0.38, 0.33], [-0.38, -0.33], [0.38, -0.33]].forEach(([x, z]) => put(cyl(0.035, 0.03, 0.2, 0x2b2b2b), x, 0.1, z, g));
  return shadow(g);
}
function tripodCam(n) {
  const g = new THREE.Group();
  [0, 2.09, 4.19].forEach((a) => { const l = cyl(0.025, 0.025, 1.45, 0x222222); l.position.set(Math.sin(a) * 0.28, 0.68, Math.cos(a) * 0.28); l.rotation.set(Math.cos(a) * 0.38, 0, -Math.sin(a) * 0.38); g.add(l); });
  put(cyl(0.05, 0.05, 0.2, 0x333333), 0, 1.4, 0, g); put(box(0.3, 0.26, 0.5, 0x3a3a46), 0, 1.62, 0, g);
  const lens = cyl(0.1, 0.12, 0.26, 0x16161c); lens.rotation.x = Math.PI / 2; put(lens, 0, 1.62, -0.36, g);
  const glass = cyl(0.085, 0.085, 0.02, 0x3a6cff, { emissive: 0x1a2f80 }); glass.rotation.x = Math.PI / 2; put(glass, 0, 1.62, -0.5, g);
  const tally = put(sph(0.05, 0xff2038, { emissive: 0xff2038, emissiveIntensity: 2 }), 0, 1.8, -0.2, g);
  [1, -1].forEach((s) => { const lab = signPlane(String(n), '#ffcf3f', '#2a1c00', 0.2, 0.2, 128, 128, 'bold 96px system-ui'); lab.position.set(0.16 * s, 1.62, 0); lab.rotation.y = (Math.PI / 2) * s; g.add(lab); });
  return { g: shadow(g), tally };
}
function softbox(x, z, ry) {
  const g = new THREE.Group();
  put(cyl(0.03, 0.03, 2.3, 0x1c1c1c), 0, 1.15, 0, g);
  [0, 2.09, 4.19].forEach((a) => { const l = cyl(0.02, 0.02, 0.7, 0x1c1c1c); l.position.set(Math.sin(a) * 0.25, 0.2, Math.cos(a) * 0.25); l.rotation.set(Math.cos(a) * 0.8, 0, -Math.sin(a) * 0.8); g.add(l); });
  put(box(0.9, 0.7, 0.25, 0x1c1c1c), 0, 2.4, 0, g); shadow(g);
  const face = put(new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.62, 0.02), new THREE.MeshBasicMaterial({ color: 0xfff3d6 })), 0, 2.4, 0.135, g);
  g.position.set(x, 0, z); g.rotation.y = ry; cur.add(g); return face;
}
function plant(x, z, s = 1) {
  put(cyl(0.22 * s, 0.17 * s, 0.4 * s, 0xd9d2c5), x, 0.2 * s, z).castShadow = true;
  [[0, 0.75, 0, 0.32], [0.14, 0.62, 0.08, 0.22], [-0.13, 0.66, -0.06, 0.24]].forEach(([dx, y, dz, r]) => { const l = sph(r * s, 0x2f9e5b); l.scale.y = 1.35; put(l, x + dx * s, y * s, z + dz * s).castShadow = true; });
}
// street tree: tapered trunk, a few branches and lumpy leaf clusters in several greens (all baked with the street)
function leafClump(r, seed) { const g = new THREE.IcosahedronGeometry(r, 1), P = g.attributes.position; for (let i = 0; i < P.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(P, i), k = 1 + 0.16 * Math.sin(v.x * 9 + seed) * Math.cos(v.y * 7 + seed * 2) + 0.08 * Math.sin(v.z * 13 + seed); P.setXYZ(i, v.x * k, v.y * k * 0.85, v.z * k); } g.computeVertexNormals(); return g; }
function tree(x, z) {
  const sd = (x * 12.9898 + z * 78.233) % 6.28, hk = 0.9 + 0.25 * Math.abs(Math.sin(sd));
  put(cyl(0.11, 0.2, 2.6 * hk, 0x5a3f2a, { rough: 0.95 }), x, 1.3 * hk, z).castShadow = true;
  [[0.5, 0.6], [-0.45, 0.5]].forEach(([a, b], i) => { const br = put(cyl(0.04, 0.07, 1.0, 0x5a3f2a, { rough: 0.95 }), x + a * 0.5, 2.0 * hk, z + (i ? -0.2 : 0.2)); br.rotation.z = -a * 1.2; });
  [[0, 3.0, 0, 1.05, 0x2f6b35], [0.75, 2.6, 0.3, 0.8, 0x3b7d3b], [-0.7, 2.7, -0.25, 0.85, 0x356f37], [0.15, 2.45, -0.75, 0.7, 0x447f3e], [-0.2, 2.5, 0.7, 0.72, 0x2f6b35]].forEach(([dx, y, dz, r, c], i) => {
    put(new THREE.Mesh(leafClump(r * hk, sd + i), M(c, { rough: 0.9 })), x + dx, y * hk, z + dz).castShadow = true; });
}
// real-world surfaces for the city (CC0 textures): mapped in world space when the street is baked, so any box size tiles correctly
const TEXL = new THREE.TextureLoader(), TEXC = {}, WALLM = {};
const cityTex = (n) => TEXC[n] || (TEXC[n] = (() => { const t = TEXL.load('assets/city/' + n + '.jpg'); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; })());
const WALL_TILE = { asphalt: 7, concrete: 2.6, brick: 1.7 };
function wallMat(n, tint) { const k = n + tint; return WALLM[k] || (WALLM[k] = Object.assign(new THREE.MeshStandardMaterial({ map: cityTex(n), color: tint, roughness: n === 'asphalt' ? 0.92 : 0.85, metalness: 0 }), { userData: { wall: n } })); }
const soften = (c, k = 0.45) => new THREE.Color(c).lerp(new THREE.Color(0xffffff), k).getHex();
const wall = (m, n, tint = 0xffffff) => { m.material.dispose(); m.material = wallMat(n, tint); return m; };
// street lamp: tapered pole, arm and a flat lamp head with a lit lens underneath (dir: +1 arm towards +z)
function streetLamp(x, z, dir) {
  put(cyl(0.12, 0.14, 0.4, 0x2b2e35, { rough: 0.6, metal: 0.4 }), x, 0.2, z); put(cyl(0.055, 0.085, 4.6, 0x2b2e35, { rough: 0.5, metal: 0.5 }), x, 2.3, z).castShadow = true;
  put(box(0.06, 0.06, 1.1, 0x2b2e35, { rough: 0.5, metal: 0.5 }), x, 4.55, z + dir * 0.5); put(box(0.34, 0.1, 0.55, 0x2b2e35, { rough: 0.5, metal: 0.5 }), x, 4.52, z + dir * 1.05);
  put(box(0.26, 0.02, 0.44, 0xfff3d0, { emissive: 0xfff3d0, emissiveIntensity: 0.9 }), x, 4.46, z + dir * 1.05);
}
function building(x, z, w, h, c, wc) {
  wall(put(box(w, h, 4, c), x, h / 2, z), 'brick', soften(c, 0.55)).castShadow = true; put(box(w + 0.3, 0.25, 4.3, 0xe8e4dc), x, h + 0.12, z); wc = 0x2c3e52;
  const cols = Math.floor(w / 1.6), rows = Math.floor((h - 2.6) / 1.5);
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { const wx = x - ((cols - 1) * 1.6) / 2 + i * 1.6, wy = 3.4 + j * 1.5; put(box(1.02, 1.02, 0.05, 0xe8e4dc), wx, wy, z + 2.01); put(box(0.9, 0.9, 0.06, wc, { rough: 0.15, metal: 0.4 }), wx, wy, z + 2.03); put(box(1.1, 0.07, 0.16, 0xd6d0c4), wx, wy - 0.5, z + 2.08); }
}
const COLL = { studio: [], street: [], event: [] }; const RECTS = { studio: [], street: [], event: [] };
const IT = []; // interactables
function interact(zone, x, z, r, key, icon, cond, run) { const ringM = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.58, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, side: THREE.DoubleSide })); ringM.rotation.x = -Math.PI / 2; ringM.position.set(x, 0.035, z); ZG[zone].add(ringM); const it = { zone, x, z, r, key, icon, cond, run, ring: ringM }; IT.push(it); return it; }
const NPCS = [];
function npc(zone, x, z, face, av, name, lines) { const ch = mk(av); ch.g.position.set(x, 0, z); ch.g.rotation.y = face; ZG[zone].add(ch.g); COLL[zone].push([x, z, 0.4]); const n = { ch, x, z, face, name, lines, i: 0, zone }; NPCS.push(n); return n; }

// decor that appears as the studio grows: [minLevel, firstChild, endChild) of the studio group
const STAGE_R = [];
// everyone starts in the same plain outfit; looks change only through what the player earns or buys
const UNI = { top: 0, topColor: 11, bottom: 0, bottomColor: 7, shoes: 1, acc: {} };
const design = store.get('design', { on: false, top: 11, bot: 7 }); if (design.on) { UNI.topColor = design.top; UNI.bottomColor = design.bot; }
const fit = { lv: store.get('fit', 0) }; const cafe = { on: store.get('coffee', false) };
const upg = { room: 0, pc: 0, desk: 0, ...store.get('upg', {}) }; const applySlots = () => CATS.forEach((c) => { if (c.id === 'furniture' || c.id === 'decor') c.slots = 3 + upg.room; }); applySlots();
const uni = (av) => ({ ...av, ...UNI, acc: {} });
/* ================= STUDIO ================= */
cur = ZG.studio;
ground(26, 22, 0x2f2552, 0, 1);
const rugA = put(new THREE.Mesh(new THREE.CircleGeometry(2.5, 48), M(0xe0563b)), -2.5, 0.012, -1.7); rugA.rotation.x = -Math.PI / 2; rugA.receiveShadow = true;
const rugB = put(new THREE.Mesh(new THREE.CircleGeometry(2.2, 48), M(0x2a8f8a)), 3, 0.012, -1.8); rugB.rotation.x = -Math.PI / 2; rugB.receiveShadow = true;
const WALLS = [put(box(15, 6, 0.3, 0x2c2470), 0, 3, -4.2), put(box(0.3, 6, 14, 0x281f66), -7.3, 3, 2.6), put(box(0.3, 6, 14, 0x281f66), 7.3, 3, 2.6)]; const WALL_C = [0x2c2470, 0x281f66, 0x281f66];
const backdrop = put(new THREE.Mesh(new THREE.PlaneGeometry(14.4, 5.9), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })), 0, 3, -4.03); backdrop.visible = false;
const _m0 = cur.children.length;
{ const gt = SFX.galaxyTex(); const gm = new THREE.MeshBasicMaterial({ map: gt, toneMapped: false });
  const gw = put(new THREE.Mesh(new THREE.PlaneGeometry(14, 6), gm), 7.14, 3, 2.6); gw.rotation.y = -Math.PI / 2;
  const gt2 = gt.clone(); gt2.needsUpdate = true; gt2.repeat.set(0.35, 1); gt2.offset.set(0.62, 0); gt2.wrapS = THREE.RepeatWrapping;
  put(new THREE.Mesh(new THREE.PlaneGeometry(2.7, 6), new THREE.MeshBasicMaterial({ map: gt2, toneMapped: false })), 5.95, 3, -4.04); }
for (let i = 0; i < 4; i++) put(box(1.15, 3, 0.08, i % 2 ? 0x5a3fc0 : 0x6c4fe0, { emissive: i % 2 ? 0x1c0f60 : 0x26157a, emissiveIntensity: 0.9 }), -4.4 + i * 1.27, 2.1, -3.98);
put(box(15, 0.07, 0.07, 0xffcf3f, { emissive: 0xffcf3f }), 0, 0.35, -4.0); put(box(15, 0.06, 0.06, 0x7fe9ff, { emissive: 0x4cc9f0, emissiveIntensity: 2 }), 0, 4.6, -4.0); put(box(0.06, 0.06, 14, 0x7fe9ff, { emissive: 0x4cc9f0, emissiveIntensity: 2 }), -7.1, 4.6, 2.6);
const _m1 = cur.children.length;
const sign = put(signPlane('ON AIR', '#ff2a40', '#ffffff', 2.2, 0.7), 0, 4.0, -3.9);
// real studio on-air lamp: off while roaming, lit while broadcasting, blinking while a prank is live
const signLabel = () => (lang === 'ar' ? 'على الهوا' : t('live'));
let signTxt = '';
function syncSignText() { const l = signLabel(); if (l === signTxt) return; signTxt = l; const old = sign.material.map; sign.material.map = textTex(l, '#ff2a40', '#ffffff', 512, 160, fitFont(l, 900, 96, 470)); sign.material.needsUpdate = true; if (old) old.dispose(); }
const SIGN_OFF = new THREE.Color(0x2a2328), SIGN_ON = new THREE.Color(0xffffff), SIGN_DIM = new THREE.Color(0x8a6a72);
function updateSign(tt) {
  const live = G.on && G.zone === 'studio'; const prank = live && ['product', 'camera', 'light', 'confetti'].some(isActive);
  sign.material.color.copy(!live ? SIGN_OFF : prank && Math.sin(tt * 10) < 0 ? SIGN_DIM : SIGN_ON);
} put(box(2.4, 0.9, 0.12, 0x8a1220), 0, 4.0, -3.98);
const screenMat = new THREE.MeshBasicMaterial({ map: SFX.fluidTex(), toneMapped: false });
// wall screen ad rotation — Naif's own companies only
const AD_LIST = ['ccmedia', 'elva', 'cc', 'lslco'].map((id) => ADS.adCardTex(id)); let screenI = 0;
screenMat.map = AD_LIST[0];
// two big street screens beside the studio entrance show the next ads in the rotation
const gateMatL = new THREE.MeshBasicMaterial({ map: AD_LIST[1], toneMapped: false }), gateMatR = new THREE.MeshBasicMaterial({ map: AD_LIST[2], toneMapped: false });
setInterval(() => { screenI = (screenI + 1) % AD_LIST.length; const n = AD_LIST.length; [[screenMat, 0], [gateMatL, 1], [gateMatR, 2]].forEach(([m, o]) => { m.map = AD_LIST[(screenI + o) % n]; m.needsUpdate = true; }); }, 9000);
const _m2 = cur.children.length;
put(box(3.5, 2.1, 0.12, 0x2a2b30, { rough: 0.35, metal: 0.6 }), 3, 2.25, -3.98); put(new THREE.Mesh(new THREE.PlaneGeometry(3.38, 1.98), screenMat), 3, 2.25, -3.91);
const _m3 = cur.children.length;
put(box(13, 0.14, 0.14, 0x1c1c22), 0, 5.2, -0.5); put(box(13, 0.14, 0.14, 0x1c1c22), 0, 5.2, 0.1);
for (let i = 0; i < 14; i++) { const b = box(0.06, 0.06, 0.62, 0x1c1c22); b.rotation.y = i % 2 ? 0.7 : -0.7; put(b, -6 + i * 0.92, 5.2, -0.2); }
[-4.2, -1.4, 1.4, 4.2].forEach((x, i) => { const c = cyl(0.16, 0.22, 0.4, 0x16161a, { metal: 0.6, rough: 0.4 }); c.rotation.x = 0.5; put(c, x, 4.95, -0.2); const col = [0xff4fa8, 0x22d3ee, 0x34f59a, 0xa855f7][i]; put(sph(0.13, col, { emissive: col, emissiveIntensity: 4 }), x, 4.8, -0.12); });
const _m4 = cur.children.length;
// sponsor desk + product
const DESK = { x: -2.5, z: -2 };
{ const gl = (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.28, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.08 });
  const top = put(slab(3.3, 0.12, 1.25, 0.18, 0xf6efe2), DESK.x, 1.06, DESK.z); top.castShadow = true; top.material = gl(0xf6efe2);
  const front = put(slab(3.0, 0.9, 0.16, 0.06, 0xe0563b), DESK.x, 0.94, DESK.z + 0.5); front.castShadow = true;
  front.material = new THREE.MeshPhysicalMaterial({ map: SFX.carbonTex(), roughness: 0.32, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.06 });
  top.material = new THREE.MeshPhysicalMaterial({ map: SFX.carbonTex(), color: 0x9a9aa8, roughness: 0.3, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 });
  put(new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.6), new THREE.MeshBasicMaterial({ map: ADS.plaqueTex('cc'), transparent: true, toneMapped: false })), DESK.x, 0.92, DESK.z + 0.69); }
{ const cm = new THREE.MeshPhysicalMaterial({ map: SFX.carbonTex(), roughness: 0.32, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.06 }); put(slab(0.16, 0.9, 1.0, 0.06, 0xc9432c), DESK.x - 1.45, 0.94, DESK.z).material = cm; put(slab(0.16, 0.9, 1.0, 0.06, 0xc9432c), DESK.x + 1.45, 0.94, DESK.z).material = cm; }
put(box(2.4, 0.05, 0.03, 0xffcf3f, { emissive: 0xffcf3f }), DESK.x, 0.55, DESK.z + 0.6);
put(cyl(0.09, 0.1, 0.03, 0x222222), DESK.x - 0.9, 1.08, DESK.z + 0.2); put(cyl(0.015, 0.015, 0.3, 0x222222), DESK.x - 0.9, 1.22, DESK.z + 0.2); put(cap(0.045, 0.08, 0x3a3a3a), DESK.x - 0.9, 1.42, DESK.z + 0.2);
const PX = DESK.x + 0.8, PZ = DESK.z + 0.1;
put(cyl(0.36, 0.4, 0.07, 0xffffff), PX, 1.1, PZ).castShadow = true;
const gold = new THREE.Group(); const GM = { emissive: 0x9a6a00, emissiveIntensity: 0.5 };
[[-0.15, 0.08], [0.15, 0.08], [0, -0.12]].forEach(([bx, bz]) => { const b = ADS.bottle('elva', 0.56); b.position.set(bx, 0, bz); b.rotation.y = -Math.PI / 2; gold.add(b); });
{ const st = ADS.stand('elva', 0.62); st.position.set(DESK.x - 0.35, 1.12, DESK.z + 0.25); cur.add(st); }
put(shadow(gold), PX, 1.14, PZ);
const cleaner = new THREE.Group();
put(cyl(0.17, 0.19, 0.42, 0x2fbf71), 0, 0.21, 0, cleaner); put(cyl(0.07, 0.17, 0.12, 0x2fbf71), 0, 0.48, 0, cleaner); put(cyl(0.06, 0.06, 0.1, 0xffffff), 0, 0.58, 0, cleaner);
put(box(0.22, 0.07, 0.08, 0xff8a3d), 0.07, 0.66, 0, cleaner); put(box(0.05, 0.14, 0.05, 0xff8a3d), 0.12, 0.58, 0, cleaner); put(box(0.26, 0.18, 0.01, 0xffffff), 0, 0.22, 0.185, cleaner); put(box(0.2, 0.04, 0.012, 0x2a6bd9), 0, 0.25, 0.19, cleaner);
put(shadow(cleaner), PX, 1.14, PZ);
// interview set
const IV = { x: 3, z: -2 };
const chairHost = armchair(0x3554c9); chairHost.position.set(IV.x - 0.95, 0, IV.z - 0.15); chairHost.rotation.y = 0.45; cur.add(chairHost);
const chairGuest = armchair(0xd98a2b); chairGuest.position.set(IV.x + 0.95, 0, IV.z - 0.15); chairGuest.rotation.y = -0.45; cur.add(chairGuest);
put(cyl(0.34, 0.34, 0.04, 0xf6efe2), IV.x, 0.62, IV.z + 0.35).castShadow = true; put(cyl(0.04, 0.04, 0.6, 0x222222), IV.x, 0.3, IV.z + 0.35); put(cyl(0.2, 0.22, 0.03, 0x222222), IV.x, 0.02, IV.z + 0.35);
{ const b = ADS.bottle('elva', 0.36); b.position.set(IV.x - 0.12, 0.64, IV.z + 0.33); b.rotation.y = -Math.PI / 2; cur.add(b); } put(cyl(0.05, 0.04, 0.12, 0xffffff), IV.x + 0.12, 0.7, IV.z + 0.4);
const GUEST_AV = { skin: 3, hairStyle: 1, hairColor: 0, beard: 1 };
const guest = mk(uni(GUEST_AV), { anim: 'Sitting_Idle_Loop' });
sit(guest); guest.g.position.set(IV.x + 0.95, -0.14, IV.z - 0.05); guest.g.rotation.y = -0.45; cur.add(guest.g);
put(sph(0.16, 0xffffff), IV.x + 1.75, 0.16, IV.z + 0.5).castShadow = true; plant(IV.x + 2.0, IV.z - 1.3); plant(DESK.x - 2.4, DESK.z - 1.2);
// storage corner (camera 3)
put(box(1.7, 2.3, 0.5, 0x7a5a3a), 6.2, 1.15, -3.6).castShadow = true;
for (let i = 0; i < 3; i++) put(box(1.6, 0.06, 0.54, 0x5a4028), 6.2, 0.55 + i * 0.7, -3.58);
put(box(0.5, 0.4, 0.4, 0xd9a05b), 5.8, 0.8, -3.5); put(box(0.4, 0.5, 0.4, 0x4fb3d9), 6.6, 1.55, -3.5); put(box(0.6, 0.3, 0.4, 0xff4d6d), 6.3, 2.15, -3.5);
put(box(0.9, 0.7, 0.7, 0xc98f4e), 6.5, 0.35, -2.4).castShadow = true; put(box(0.7, 0.5, 0.6, 0xb57f42), 6.5, 0.95, -2.4).castShadow = true;
const CREW_AV = { skin: 0, hairStyle: 0, hairColor: 2 };
const crew = mk(uni({ skin: 0, hairStyle: 0, hairColor: 2, top: 0, topColor: 4, bottom: 0, bottomColor: 7, shoes: 1, capColor: 1, acc: { cap: true } }), { anim: 'Idle_TalkingPhone_Loop' });
crew.g.position.set(5.5, 0, -2.9); cur.add(crew.g);
const SHOTS = [{ p: [DESK.x + 0.25, 1.62, 1.7], l: [DESK.x + 0.3, 1.2, DESK.z] }, { p: [IV.x, 1.5, 1.6], l: [IV.x, 1.05, IV.z] }, { p: [4.6, 1.62, 0.3], l: [6.1, 1.0, -3.2] }];
const tripods = SHOTS.map((s, i) => { const tp = SFX.broadcastCam(i + 1, SFX.lab(i + 1)); tp.g.position.set(s.p[0], 0, s.p[2] + 0.55); tp.g.rotation.y = Math.atan2(-(s.l[0] - s.p[0]), -(s.l[2] - s.p[2])); cur.add(tp.g); return tp; });
const CON = { x: 0, z: 2.0 };
put(slab(1.5, 0.1, 0.7, 0.08, 0x3a3a48), CON.x, 0.98, CON.z).castShadow = true; put(box(1.3, 0.9, 0.5, 0x2a2a36), CON.x, 0.45, CON.z).castShadow = true;
SFX.mixerTop(cur, CON.x, 1.03, CON.z - 0.02);
const conBtns = [0, 1, 2].map((i) => put(box(0.12, 0.04, 0.09, 0x666666, { emissive: 0xffcf3f, emissiveIntensity: 0 }), CON.x - 0.55 + i * 0.16, 1.07, CON.z + 0.27));
put(box(1.2, 0.5, 0.05, 0x111118), CON.x, 1.32, CON.z - 0.28).rotation.x = -0.2;
const conScreen = put(new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.42), new THREE.MeshBasicMaterial({ color: 0x3ddc97, map: SFX.monitorTex() })), CON.x, 1.32, CON.z - 0.245); conScreen.rotation.x = -0.2;
const BRK = { x: -6.9, z: 1 };
put(box(0.16, 0.9, 0.7, 0x8d99a6), -7.08, 1.45, BRK.z); const lever = put(box(0.08, 0.34, 0.1, 0xff3b4e), -6.97, 1.5, BRK.z);
const bulb = put(new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), new THREE.MeshBasicMaterial({ color: 0x3ddc97 })), -6.98, 1.82, BRK.z); put(box(0.02, 0.2, 0.3, 0xffcf3f), -6.99, 1.15, BRK.z);
const sbFaces = [softbox(-5.2, 1.2, 1.0), softbox(0.3, -3.3, 0), softbox(5.6, 1.6, -1.1)];
{ // props corner (back right) and floor cables
  const b1 = put(SFX.cardboard(0.8, 0.6, 0.6, 'FRAGILE'), 6.4, 0.3, -3.55); b1.rotation.y = 0.1; b1.material.map = ADS.boxTex('lslco');
  { const b2 = put(SFX.cardboard(0.7, 0.5, 0.55, 'STUDIO'), 6.45, 0.85, -3.55); b2.rotation.y = -0.15; b2.material.map = ADS.boxTex('lslco'); }
  put(SFX.cardboard(0.55, 0.45, 0.5), 6.5, 1.32, -3.5).rotation.y = 0.2;
  { const b4 = put(SFX.cardboard(0.75, 0.55, 0.6, 'GEAR'), 6.5, 0.275, -2.55); b4.rotation.y = -0.1; b4.material.map = ADS.boxTex('lslco'); }
  const _m5 = cur.children.length;
  const cr = SFX.crate(0x2563eb); cr.position.set(6.45, 0, -1.8); cr.rotation.y = -0.3; cur.add(cr);
  const cr2 = SFX.crate(0xd9d9de); cr2.position.set(6.4, 0.55, -2.55); cr2.scale.setScalar(0.8); cur.add(cr2);
  const ch = SFX.chest(); ch.position.set(6.3, 0, -0.9); ch.rotation.y = -Math.PI / 2; cur.add(ch);
  put(box(1.5, 0.06, 0.4, 0x2a2b32, { rough: 0.4, metal: 0.5 }), 5.1, 3.1, -3.85);
  [[4.6, 0], [5.0, 2], [5.4, 4], [5.75, 6]].forEach(([fx, k]) => { const f = makeChar({ skin: k % 4, hairStyle: k % 3, hairColor: k % 5, top: k % 2, topColor: k % 7, bottom: 0, bottomColor: (k + 3) % 8, shoes: k % 5 }); f.g.scale.setScalar(0.17); f.g.position.set(fx, 3.13, -3.85); cur.add(f.g); });
  const _m6 = cur.children.length; STAGE_R.push([2, _m0, _m1], [2, _m2, _m3], [3, _m3, _m4], [4, _m5, _m6]);
  SFX.cableTo(cur, [[SHOTS[0].p[0], SHOTS[0].p[2] + 0.55], [-1.5, 2.6], [CON.x - 0.6, CON.z + 0.4]]);
  SFX.cableTo(cur, [[SHOTS[1].p[0], SHOTS[1].p[2] + 0.55], [1.8, 2.8], [CON.x + 0.6, CON.z + 0.4]]);
  SFX.cableTo(cur, [[SHOTS[2].p[0], SHOTS[2].p[2] + 0.55], [3.6, 1.2], [2.2, 2.4], [CON.x + 0.7, CON.z + 0.1]]);
  COLL.studio.push([6.45, -3.5, 0.55], [6.45, -2.55, 0.5], [6.45, -1.8, 0.45], [6.3, -0.9, 0.5]);
}
// exit door
put(box(0.2, 2.6, 1.5, 0x23233a), 7.1, 1.3, 3.4); put(box(0.22, 2.3, 1.2, 0x4cc9f0, { emissive: 0x4cc9f0, emissiveIntensity: 0.5 }), 7.08, 1.2, 3.4);
const exitSign = put(signPlane('EXIT', '#19a05e', '#ffffff', 0.9, 0.32, 256, 96, 'bold 70px system-ui'), 6.98, 2.85, 3.4); exitSign.rotation.y = -Math.PI / 2;
COLL.studio.push([DESK.x - 1.1, DESK.z, 0.85], [DESK.x, DESK.z, 0.85], [DESK.x + 1.1, DESK.z, 0.85], [IV.x - 0.95, IV.z - 0.15, 0.7], [IV.x + 0.95, IV.z - 0.15, 0.7], [IV.x, IV.z + 0.35, 0.42],
  [CON.x - 0.4, CON.z, 0.6], [CON.x + 0.4, CON.z, 0.6], [6.3, -3.2, 1.3], [5.5, -2.9, 0.45], [-5.2, 1.2, 0.4], [0.3, -3.3, 0.4], [5.6, 1.6, 0.4], ...SHOTS.map((s) => [s.p[0], s.p[2] + 0.55, 0.42]));

/* ================= STREET ================= */
cur = ZG.street; const SX = 100;
wall(ground(124, 84, 0x6a7080, SX, 10), 'asphalt', 0xb8bcc4);
wall(put(box(40, 0.14, 5.2, 0xd8d2c4), SX, 0.07, -5.6), 'concrete', 0xe8e4dc).receiveShadow = true; wall(put(box(40, 0.14, 3, 0xd8d2c4), SX, 0.07, 7.6), 'concrete', 0xe8e4dc).receiveShadow = true;
for (let i = -6; i <= 6; i++) put(box(1.6, 0.02, 0.18, 0xffffff), SX + i * 3, 0.02, 1.6);
building(SX, -10.2, 9, 6.5, 0x7a57e6, 0xbfe3ff); building(SX - 10.5, -10.2, 9, 5, 0xffcf3f, 0xffffff); building(SX + 10.5, -10.2, 9, 7.5, 0x4cc9f0, 0xfff3b0);
put(box(1.7, 2.7, 0.2, 0x23233a), SX, 1.35, -8.15); put(box(1.4, 2.4, 0.1, 0xff8a3d, { emissive: 0xff8a3d, emissiveIntensity: 0.3 }), SX, 1.25, -8.08);
// storefront: the game's own logo sign (waves + red dot + «على الهوا» / ON AIR STUDIO)
function logoSignTex() {
  const W = 1024, H = 300, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#3a2a7a'); g.addColorStop(1, '#1a1440'); x.fillStyle = g; x.beginPath(); x.roundRect(0, 0, W, H, 46); x.fill();
  x.strokeStyle = '#ffcf3f'; x.lineWidth = 8; x.beginPath(); x.roundRect(10, 10, W - 20, H - 20, 38); x.stroke();
  const cx = 160, cy = 190; x.strokeStyle = '#ffcf3f'; x.lineCap = 'round'; x.lineWidth = 18;
  [44, 82, 120].forEach((r) => { x.beginPath(); x.arc(cx, cy, r, -Math.PI * 0.78, -Math.PI * 0.22); x.stroke(); });
  x.fillStyle = '#ff2a40'; x.beginPath(); x.arc(cx, cy, 22, 0, 7); x.fill();
  x.fillStyle = '#ff2a40'; x.beginPath(); x.roundRect(310, 52, 670, 140, 30); x.fill();
  const big = lang === 'ar' ? 'على الهوا' : t('title'), small = lang === 'ar' ? 'ON AIR STUDIO' : t('tagline');
  x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = fitFont(big, 900, 104, 620); x.fillText(big, 645, 126);
  x.fillStyle = '#ffcf3f'; x.font = fitFont(small, 800, 52, 680); x.fillText(small, 645, 245);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; return tex;
}
put(box(3.9, 1.25, 0.14, 0x15102e), SX, 3.35, -8.16);
[[-3.05, gateMatL], [3.05, gateMatR]].forEach(([dx, m]) => { put(box(3.0, 1.78, 0.16, 0x15102e, { rough: 0.4, metal: 0.5 }), SX + dx, 1.75, -8.14); put(new THREE.Mesh(new THREE.PlaneGeometry(2.84, 1.6), m), SX + dx, 1.75, -8.05); put(box(3.0, 0.06, 0.18, 0xffcf3f, { emissive: 0xffcf3f }), SX + dx, 2.67, -8.14); });
const logoSign = put(new THREE.Mesh(new THREE.PlaneGeometry(3.8, 1.11), new THREE.MeshBasicMaterial({ map: logoSignTex(), transparent: true, toneMapped: false })), SX, 3.35, -8.08);
let logoLang = lang;
function syncLogoSign() { if (logoLang === lang) return; logoLang = lang; const o = logoSign.material.map; logoSign.material.map = logoSignTex(); logoSign.material.needsUpdate = true; o.dispose(); }
put(box(4, 0.12, 1.4, 0xd9342b), SX - 10.5, 2.7, -7.6); put(signPlane('SHAWARMA', '#ffffff', '#d9342b', 3.4, 0.7, 640, 130, 'bold 90px system-ui'), SX - 10.5, 3.3, -8.15);
[-12, -4, 4, 12].forEach((dx) => tree(SX + dx, 7.4));
[-7, 0, 7].forEach((dx) => streetLamp(SX + dx, -3.5, 1));
// shawarma cart
put(box(2.2, 0.9, 1.1, 0xffffff), SX - 8, 0.65, -4.6).castShadow = true; put(box(2.24, 0.25, 1.14, 0xd9342b), SX - 8, 0.9, -4.6); put(box(2.5, 0.1, 1.5, 0xd9342b), SX - 8, 2.2, -4.6).castShadow = true;
[-1, 1].forEach((s) => { put(cyl(0.03, 0.03, 1.3, 0x555555), SX - 8 + s, 1.6, -4.1); put(cyl(0.25, 0.25, 0.1, 0x222222), SX - 8 + s * 0.8, 0.25, -4.0).rotation.x = Math.PI / 2; });
put(cyl(0.13, 0.2, 0.7, 0x8a4a22), SX - 8.4, 1.5, -4.6); put(cyl(0.02, 0.02, 1.0, 0x999999), SX - 8.4, 1.6, -4.6);
// bench + parked car
put(box(1.8, 0.1, 0.5, 0x8a5a2b), SX + 3, 0.5, -3.6).castShadow = true; put(box(1.8, 0.5, 0.08, 0x8a5a2b), SX + 3, 0.85, -3.85); [-0.7, 0.7].forEach((d) => put(box(0.1, 0.5, 0.45, 0x30303a), SX + 3 + d, 0.25, -3.6));
const car = new THREE.Group(); put(slab(3.6, 0.6, 1.7, 0.3, 0xff4d6d), 0, 0.95, 0, car); put(slab(2.0, 0.55, 1.5, 0.3, 0xffffff), -0.2, 1.5, 0, car);
[[-1.1, 0.86], [1.1, 0.86], [-1.1, -0.86], [1.1, -0.86]].forEach(([x, z]) => { const w = cyl(0.34, 0.34, 0.22, 0x1c1c22); w.rotation.x = Math.PI / 2; put(w, x, 0.34, z, car); });
put(sph(0.1, 0xfff3b0, { emissive: 0xfff3b0 }), 1.78, 0.75, 0.55, car); put(sph(0.1, 0xfff3b0, { emissive: 0xfff3b0 }), 1.78, 0.75, -0.55, car);
car.position.set(SX - 3, 0, 5.2); cur.add(shadow(car)); carModel(car, 2, 4.2);
// awards arch
[-2.4, 2.4].forEach((z) => put(box(0.6, 4.2, 0.6, 0xffcf3f), SX + 13.4, 2.1, z).castShadow = true); put(box(0.7, 0.9, 5.6, 0xc81e2d), SX + 13.4, 4.4, 0);
const archSign = put(signPlane('★ AWARDS ★', '#c81e2d', '#ffcf3f', 5, 0.8, 640, 110, 'bold 80px system-ui'), SX + 13.04, 4.4, 0); archSign.rotation.y = -Math.PI / 2;
put(box(6, 0.03, 3.6, 0xc81e2d), SX + 11.5, 0.02, 0);
put(sph(0.2, 0xff8a3d), SX + 6.9, 0.34, 7.9).castShadow = true;
COLL.street.push([SX - 8.6, -4.6, 0.9], [SX - 7.4, -4.6, 0.9], [SX + 2.5, -3.7, 0.6], [SX + 3.5, -3.7, 0.6], [SX - 4, 5.2, 1.2], [SX - 2, 5.2, 1.2], [SX + 13.4, -2.4, 0.6], [SX + 13.4, 2.4, 0.6], ...[-7, 0, 7].map((d) => [SX + d, -3.5, 0.25]));
npc('street', SX - 3.5, -3.7, 0.4, { skin: 2, hairStyle: 2, hairColor: 0, top: 0, topColor: 8, bottom: 1, bottomColor: 0, shoes: 0, acc: { glasses: true } }, 'n_fan', ['n_fan1', 'n_fan2']);
npc('street', SX - 8, -5.7, 0, { skin: 4, hairStyle: 5, hairColor: 0, beard: 3, top: 0, topColor: 6, bottom: 0, bottomColor: 7, shoes: 1, capColor: 1, acc: { cap: true } }, 'n_vendor', ['n_vendor1', 'n_vendor2']);
const kid = npc('street', SX + 6.2, 7.5, 3.4, { skin: 1, hairStyle: 3, hairColor: 1, top: 0, topColor: 3, bottom: 1, bottomColor: 1, shoes: 4, body: { head: 1, m: -1, w: -0.3, sh: -0.8 }, face: { eyes: 0.6, nose: -0.6, jaw: -0.6, chin: -0.5 } }, 'n_kid', ['n_kid1', 'n_kid2']); kid.ch.g.scale.setScalar(0.72);
npc('street', SX + 8.6, -3.8, -0.6, { skin: 0, hairStyle: 4, hairColor: 6, top: 2, topColor: 7, bottom: 0, bottomColor: 5, shoes: 2, acc: { headphones: true, chain: true } }, 'n_rival', ['n_rival1', 'n_rival2']);

// ───────── city district: the street grows ~10× — two streets, four cross lanes, shops, a park and ad buildings for our own brands ─────────
const citySigns = [];
function shopSignTex(icon, text, bg) {
  const W = 1024, H = 256, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
  x.fillStyle = bg; x.beginPath(); x.roundRect(0, 0, W, H, 40); x.fill(); x.strokeStyle = '#ffffff'; x.lineWidth = 8; x.beginPath(); x.roundRect(10, 10, W - 20, H - 20, 32); x.stroke();
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '150px system-ui'; x.fillText(icon, 150, 138); x.fillStyle = '#ffffff'; x.font = fitFont(text, 900, 120, 700); x.fillText(text, 620, 132);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; return tex;
}
// a shop whose front faces north (towards -z); name() is re-read when the language changes
function shopFront(dx, zf, w, h, c, c2, icon, name, run, key) {
  const x = SX + dx; wall(put(box(w, h, 6, c), x, h / 2, zf + 3), 'concrete', soften(c, 0.4)).castShadow = true; put(box(w + 0.4, 0.3, 6.4, 0xe8e4dc), x, h + 0.15, zf + 3);
  put(box(w, 0.16, 1.3, c2), x, 2.95, zf - 0.6); put(box(1.5, 2.4, 0.12, 0x23233a), x, 1.2, zf - 0.04);
  [-1, 1].forEach((s) => put(box(w * 0.28, 1.5, 0.08, 0xbfe3ff, { emissive: 0xbfe3ff, emissiveIntensity: 0.25 }), x + s * w * 0.3, 1.55, zf - 0.03));
  const sg = put(new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w - 1, 7), Math.min(w - 1, 7) / 4), new THREE.MeshBasicMaterial({ map: shopSignTex(icon, name(), '#' + c2.toString(16).padStart(6, '0')), transparent: true, toneMapped: false })), x, 4.05, zf - 0.08); sg.rotation.y = Math.PI;
  citySigns.push({ m: sg, icon, name, bg: '#' + c2.toString(16).padStart(6, '0') }); RECTS.street.push([x - w / 2, x + w / 2, zf, zf + 6]);
  interact('street', x, zf - 1.3, 1.3, key, icon, () => roam(), run || (() => { sfx.click(); gToast(icon + ' ' + name() + ' · ' + t('sh_soon')); }));
}
function adBuilding(dx, zf, w, h, c, id) {
  const x = SX + dx; wall(put(box(w, h, 6, c), x, h / 2, zf + 3), 'brick', soften(c, 0.5)).castShadow = true; put(box(w + 0.4, 0.3, 6.4, 0xe8e4dc), x, h + 0.15, zf + 3); RECTS.street.push([x - w / 2, x + w / 2, zf, zf + 6]);
  put(box(8.3, 4.8, 0.2, 0x15102e), x, 3.4, zf - 0.1); const p = put(new THREE.Mesh(new THREE.PlaneGeometry(8, 4.5), new THREE.MeshBasicMaterial({ map: ADS.adCardTex(id), toneMapped: false })), x, 3.4, zf - 0.22); p.rotation.y = Math.PI;
}
let cityLang = lang;
function syncCity() { if (cityLang === lang) return; cityLang = lang; citySigns.forEach((s) => { const o = s.m.material.map; s.m.material.map = shopSignTex(s.icon, s.name(), s.bg); s.m.material.needsUpdate = true; o.dispose(); }); }
{
  // pavements: longer main-street sidewalks, block pads, second street
  [-36, 36].forEach((dx) => { wall(put(box(32, 0.14, 5.2, 0xd8d2c4), SX + dx, 0.07, -5.6), 'concrete', 0xe8e4dc).receiveShadow = true; wall(put(box(32, 0.14, 3, 0xd8d2c4), SX + dx, 0.07, 7.6), 'concrete', 0xe8e4dc).receiveShadow = true; });
  [-40, -20, 0, 20, 40].forEach((dx) => { wall(put(box(17, 0.14, 10, 0xd8d2c4), SX + dx, 0.07, 14.1), 'concrete', 0xe8e4dc).receiveShadow = true; });
  wall(put(box(104, 0.14, 8, 0xd8d2c4), SX, 0.07, 30.5), 'concrete', 0xe8e4dc).receiveShadow = true;
  wall(put(box(104, 0.14, 1.8, 0xd8d2c4), SX, 0.07, 20.0), 'concrete', 0xe8e4dc).receiveShadow = true; wall(put(box(104, 0.14, 1.6, 0xd8d2c4), SX, 0.07, 25.7), 'concrete', 0xe8e4dc).receiveShadow = true; // second-street pavements
  for (let i = -16; i <= 16; i++) { if (Math.abs(i) > 6) put(box(1.6, 0.02, 0.18, 0xffffff), SX + i * 3, 0.02, 1.6); put(box(1.6, 0.02, 0.18, 0xffffff), SX + i * 3, 0.02, 22.8); }
  // north row: more city buildings beside the studio
  // north row: real city buildings (Downtown City MegaKit, CC0), loaded after start; plain blocks only if loading fails
  const NORTH = [[-21, 6, 0xff8a5c], [-31.5, 8, 0x5fbf8f], [-42, 5.5, 0xb48cf2], [-52.5, 7, 0xffcf3f], [21, 5.5, 0xf2788c], [31.5, 8.5, 0x6f8cf2], [42, 6, 0x4cc9a0], [52.5, 7.5, 0xff8a3d]];
  cityKit.north = NORTH.map(([dx], i) => ({ x: SX + dx, z: -8.2, type: [0, 1, 2, 1, 2, 0, 1, 2][i] }));
  cityKit.fallback = () => { const pc = cur; cur = ZG.street; NORTH.forEach(([dx, h, c]) => building(SX + dx, -10.2, 9, h, c, 0)); cur = pc; };
  [-56, 56].forEach((dx) => wall(put(box(6, 7, 46, 0x8a93a6), SX + dx, 3.5, 10), 'concrete', 0xd0d0d0)); // end caps
  // row A (between the two streets): gym, café, the store, park, clothes
  shopFront(-40, 12, 15, 5.5, 0x3b4a6b, 0xd9342b, '🏋️', () => t('sh_gym'), () => openPanel('gym'), 'sh_gym');
  shopFront(-20, 12, 15, 5, 0x8a5a3a, 0x5a3a22, '☕', () => t('sh_cafe'), () => openPanel('cafe'), 'sh_cafe');
  shopFront(0, 12, 15, 6, 0x0f9d76, 0x0b6f55, '🛍️', () => ADS.WORLD.souq[lang === 'ar' ? 'ar' : 'en'], () => $('hudStore').onclick(), 'sh_market');
  shopFront(40, 12, 15, 5, 0xe86aa6, 0xb0347a, '👕', () => t('sh_clothes'), () => { $('hudStore').onclick(); if (!$('storeS').hidden) { cs.setCat('skins'); cs.render(); } }, 'sh_clothes');
  // park (open block): grass, trees, fountain, benches
  { const px = SX + 20, pz = 14.1; const gr = put(new THREE.Mesh(new THREE.PlaneGeometry(16, 9), M(0x57b86a, { rough: 0.9 })), px, 0.15, pz); gr.rotation.x = -Math.PI / 2; gr.receiveShadow = true;
    [[-6.5, -3], [6.5, -3], [-6.5, 3], [6.5, 3], [-3, 3.4], [3, 3.4]].forEach(([a, b]) => { tree(px + a, pz + b); COLL.street.push([px + a, pz + b, 0.35]); });
    put(cyl(1.3, 1.4, 0.4, 0xbfc5cf), px, 0.35, pz).castShadow = true; put(cyl(1.15, 1.15, 0.06, 0x4cc9f0, { emissive: 0x1c7fa8, emissiveIntensity: 0.6 }), px, 0.55, pz); put(cyl(0.14, 0.2, 1.1, 0xbfc5cf), px, 0.95, pz); put(sph(0.2, 0x9fe6ff, { emissive: 0x4cc9f0, emissiveIntensity: 0.8 }), px, 1.6, pz); COLL.street.push([px, pz, 1.4]);
    [-4, 4].forEach((a) => { put(box(1.8, 0.1, 0.5, 0x8a5a2b), px + a, 0.6, pz - 1).castShadow = true; put(box(1.8, 0.5, 0.08, 0x8a5a2b), px + a, 0.95, pz - 0.75); COLL.street.push([px + a - 0.5, pz - 1, 0.5], [px + a + 0.5, pz - 1, 0.5]); });
    const sg = put(new THREE.Mesh(new THREE.PlaneGeometry(4, 1), new THREE.MeshBasicMaterial({ map: shopSignTex('🌳', t('sh_park'), '#2f8f4e'), transparent: true, toneMapped: false })), px, 2.6, pz - 4.6); sg.rotation.y = Math.PI; citySigns.push({ m: sg, icon: '🌳', name: () => t('sh_park'), bg: '#2f8f4e' });
    [-1.9, 1.9].forEach((a) => put(cyl(0.07, 0.07, 3.1, 0x30303a), px + a, 1.55, pz - 4.6)); }
  // row B (south side of the second street): clothes, designer, and ad buildings for our own companies
  shopFront(-40, 27, 15, 5, 0x4a6fd9, 0x2a3f8f, '🧥', () => t('sh_clothes'), () => { $('hudStore').onclick(); if (!$('storeS').hidden) { cs.setCat('skins'); cs.render(); } }, 'sh_clothes');
  shopFront(-20, 27, 15, 6.5, 0x2a2233, 0xd4af37, '✂️', () => t('sh_designer'), () => openPanel('designer'), 'sh_designer');
  adBuilding(0, 27, 15, 7, 0x5b3aa6, 'elva'); adBuilding(20, 27, 15, 7, 0x1f6fb2, 'lslco'); adBuilding(40, 27, 15, 7, 0xc46b78, 'ccmedia');
  // street lamps and trees along the second street
  [-45, -30, -10, 10, 30, 45].forEach((dx) => { streetLamp(SX + dx, 20.2, 1); COLL.street.push([SX + dx, 20.2, 0.25]); });
  [-30, -10, 10, 30].forEach((dx) => { tree(SX + dx, 25.6); COLL.street.push([SX + dx, 25.6, 0.35]); }); [-34, -26, 22, 30, 38, 46].forEach((dx) => tree(SX + dx, 7.4));
  // more people to interview around the district
  npc('street', SX - 23.5, 7.2, 2.6, { skin: 3, hairStyle: 1, hairColor: 2, top: 1, topColor: 2, bottom: 0, bottomColor: 3, shoes: 2 }, 'n_fan', ['n_fan1', 'n_fan2']);
  npc('street', SX - 38, 10.2, 0, { skin: 1, hairStyle: 4, hairColor: 0, top: 2, topColor: 5, bottom: 1, bottomColor: 0, shoes: 3, acc: { headphones: true } }, 'n_rival', ['n_rival1', 'n_rival2']);
  npc('street', SX + 17, 16.5, -1, { skin: 2, hairStyle: 3, hairColor: 3, top: 0, topColor: 1, bottom: 1, bottomColor: 6, shoes: 0 }, 'n_fan', ['n_fan1', 'n_fan2']);
  npc('street', SX + 34.5, 7.3, -2.6, { skin: 4, hairStyle: 0, hairColor: 0, beard: 2, top: 0, topColor: 7, bottom: 0, bottomColor: 2, shoes: 1, acc: { glasses: true } }, 'n_vendor', ['n_vendor1', 'n_vendor2']);
  npc('street', SX - 4, 19.7, 2.6, { skin: 0, hairStyle: 2, hairColor: 5, top: 1, topColor: 4, bottom: 0, bottomColor: 1, shoes: 4 }, 'n_fan', ['n_fan1', 'n_fan2']);
  npc('street', SX + 33, 26.1, 3.1, { skin: 3, hairStyle: 5, hairColor: 1, top: 2, topColor: 0, bottom: 1, bottomColor: 5, shoes: 2, capColor: 3, acc: { cap: true } }, 'n_rival', ['n_rival1', 'n_rival2']);
}
// parked cars along both kerbs of the main street (merged into a couple of meshes once the models load)
cityKit.parked = [[-16, 5.0, 0], [-29, 5.0, 1], [-41, 5.0, 2], [19, 5.0, 3], [33, 5.0, 4], [46, 5.0, 2], [-15, -2.0, 3], [-31, -2.1, 4], [-47, -2.0, 1], [24, -2.0, 0], [38, -2.1, 2], [50, -2.0, 3]]
  .map(([dx, z, m], i) => { COLL.street.push([SX + dx - 1.2, z, 1.0], [SX + dx + 1.2, z, 1.0]); return { x: SX + dx, z, m, ry: i % 2 ? Math.PI : 0 }; });
// bollards on the north kerb (kept clear of the studio front, lamps and the cart)
cityKit.bollards = []; for (let dx = -53; dx <= 53; dx += 3.5) { if (Math.abs(dx) < 13 || [-7, 0, 7].some((l) => Math.abs(dx - l) < 1)) continue; cityKit.bollards.push([SX + dx, -3.25]); COLL.street.push([SX + dx, -3.25, 0.2]); }
// traffic on the second street: cars loop along two lanes and brake for the player
const traffic = [];
[[21.8, 1, 0xd9342b, -40], [21.8, 1, 0x2e7df6, 12], [24.1, -1, 0xffcf3f, 30], [24.1, -1, 0xffffff, -18]].forEach(([z, dir, c, x0]) => { const g = new THREE.Group();
  const add = (o, x, y, zz) => { o.position.set(x, y, zz); o.castShadow = true; g.add(o); }; add(box(3.4, 0.7, 1.6, c), 0, 0.65, 0); add(box(1.8, 0.6, 1.4, 0xbfe3ff), -0.2, 1.25, 0);
  [[-1.1, 0.8], [1.1, 0.8], [-1.1, -0.8], [1.1, -0.8]].forEach(([a, b]) => { const w = cyl(0.34, 0.34, 0.24, 0x1a1a22); w.rotation.x = Math.PI / 2; add(w, a, 0.34, b); });
  add(sph(0.12, 0xfff3b0, { emissive: 0xfff3b0 }), 1.7, 0.7, 0.5); add(sph(0.12, 0xfff3b0, { emissive: 0xfff3b0 }), 1.7, 0.7, -0.5);
  g.position.set(SX + x0, 0, z); g.rotation.y = dir > 0 ? 0 : Math.PI; cur.add(g); carModel(g, traffic.length + 1); traffic.push({ g, dir, v: 6 }); });
function trafficTick(dt) { traffic.forEach((c) => { const p = c.g.position, ahead = (G.px - p.x) * c.dir, near = Math.abs(G.pz - p.z) < 1.7 && ahead > -1.8 && ahead < 5.5; c.v += ((near ? 0 : 6) - c.v) * Math.min(1, dt * 4); p.x += c.dir * c.v * dt; if (p.x > SX + 56) p.x = SX - 56; if (p.x < SX - 56) p.x = SX + 56; c.g.visible = Math.abs(p.x - G.px) < 48; }); }
// police officer for the chase (filming without a StudioLab licence)
const cop = mk({ skin: 2, hairStyle: 0, hairColor: 0, beard: 1, top: 0, topColor: 4, bottom: 0, bottomColor: 7, shoes: 1, capColor: 4, acc: { cap: true } });
const copLamp = put(sph(0.13, 0xff2a40, { emissive: 0xff2a40, emissiveIntensity: 2 }), 0, 2.05, 0, cop.g); cop.g.visible = false; cur.add(cop.g);

// bake the static street scenery into two meshes (lit + glowing) so the big district costs a handful of draw calls
{
  const litC = {}, glowC = {}, gone = [], texC = new Map();
  // textured surfaces: world-space box mapping, grouped per material
  ZG.street.children.forEach((o) => { const mt = o.material; if (!o.isMesh || !mt || !mt.userData || !mt.userData.wall) return;
    o.updateMatrix(); const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g.applyMatrix4(o.matrix); const P = g.attributes.position, N = g.attributes.normal, n = P.count, uv = new Float32Array(n * 2), tl = WALL_TILE[mt.userData.wall] || 3;
    for (let i = 0; i < n; i++) { const ax = Math.abs(N.getX(i)), ay = Math.abs(N.getY(i)), az = Math.abs(N.getZ(i)), x = P.getX(i), y = P.getY(i), z = P.getZ(i);
      if (ay >= ax && ay >= az) { uv[i * 2] = x / tl; uv[i * 2 + 1] = z / tl; } else if (ax >= az) { uv[i * 2] = z / tl; uv[i * 2 + 1] = y / tl; } else { uv[i * 2] = x / tl; uv[i * 2 + 1] = y / tl; } }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); Object.keys(g.attributes).forEach((k) => { if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); });
    if (!texC.has(mt)) texC.set(mt, []); texC.get(mt).push([g, o.castShadow]); gone.push(o); });
  texC.forEach((L, mt) => { [true, false].forEach((sh) => { const G2 = L.filter((e) => e[1] === sh).map((e) => e[0]); if (!G2.length) return; const ms = new THREE.Mesh(mergeGeometries(G2), mt); ms.castShadow = sh; ms.receiveShadow = true; ZG.street.add(ms); G2.forEach((g) => g.dispose()); }); });
  ZG.street.children.forEach((o) => { const mt = o.material; if (!o.isMesh || !mt || !mt.isMeshStandardMaterial || mt.map || mt.transparent || gone.includes(o)) return;
    o.updateMatrix(); const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g.applyMatrix4(o.matrix); const em = mt.emissive.getHex() !== 0, c = em ? mt.emissive : mt.color, n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(col, 3)); Object.keys(g.attributes).forEach((k) => { if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k); });
    const key = Math.floor(o.position.x / 24) + ',' + Math.floor((o.position.z + 8) / 18), B = em ? glowC : litC; (B[key] = B[key] || []).push(g); gone.push(o); });
  gone.forEach((o) => { ZG.street.remove(o); o.geometry.dispose(); if (!o.material.userData.wall) o.material.dispose(); });
  const litM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.05 }), glowM = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  Object.values(litC).forEach((L) => { const ms = new THREE.Mesh(mergeGeometries(L), litM); ms.castShadow = true; ms.receiveShadow = true; ZG.street.add(ms); L.forEach((g) => g.dispose()); });
  Object.values(glowC).forEach((L) => { ZG.street.add(new THREE.Mesh(mergeGeometries(L), glowM)); L.forEach((g) => g.dispose()); });
}

/* ================= AWARDS NIGHT ================= */
cur = ZG.event; const EX = 200;
ground(60, 40, 0x2a2052, EX, 0);
put(box(22, 0.04, 3.4, 0xc81e2d), EX - 3.5, 0.02, 0).receiveShadow = true;
[-1.75, 1.75].forEach((z) => put(box(22, 0.05, 0.08, 0xffcf3f, { emissive: 0xffcf3f, emissiveIntensity: 0.6 }), EX - 3.5, 0.04, z));
for (let i = 0; i < 9; i++) [-2.3, 2.3].forEach((z) => { const x = EX - 13.5 + i * 2.5; put(cyl(0.05, 0.07, 1.0, 0xffcf3f), x, 0.5, z).castShadow = true; put(sph(0.09, 0xffcf3f), x, 1.03, z); if (i < 8) put(box(2.5, 0.06, 0.06, 0xc81e2d), x + 1.25, 0.88, z); });
put(box(6, 0.9, 13, 0x1c1c26), EX + 11, 0.45, 0).castShadow = true; put(box(1, 0.3, 3.4, 0x2a2a36), EX + 7.6, 0.15, 0); put(box(0.6, 0.6, 3.4, 0x2a2a36), EX + 8.0, 0.3, 0);
put(box(0.3, 6, 12, 0x15151c), EX + 13.6, 3.6, 0); const evScreen = put(new THREE.Mesh(new THREE.PlaneGeometry(11, 5), new THREE.MeshBasicMaterial({ map: gradTex('#ffcf3f', '#ff4d6d', '#7a3fd9') })), EX + 13.4, 3.8, 0); evScreen.rotation.y = -Math.PI / 2;
const evSign = put(signPlane('★ BEST PLAYER ★', '#15151c', '#ffcf3f', 8, 1, 900, 120, 'bold 84px system-ui'), EX + 13.38, 6.9, 0); evSign.rotation.y = -Math.PI / 2;
const trophy = new THREE.Group(); put(cyl(0.5, 0.6, 0.3, 0x30303a), 0, 0.15, 0, trophy); put(cyl(0.12, 0.2, 0.7, 0xffcf3f, GM), 0, 0.65, 0, trophy);
const cup = put(sph(0.55, 0xffcf3f, GM), 0, 1.45, 0, trophy); cup.scale.set(1, 1.15, 1); [-1, 1].forEach((s) => { const h = tor(0.3, 0.06, 0xffcf3f); h.position.set(0, 1.5, 0.62 * s); h.rotation.y = Math.PI / 2; trophy.add(h); });
put(sph(0.2, 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.6 }), 0, 2.25, 0, trophy); trophy.position.set(EX + 10, 0.9, 0); cur.add(shadow(trophy));
[-4.5, 4.5].forEach((z) => { const beam = new THREE.Mesh(new THREE.ConeGeometry(1.6, 12, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, opacity: 0.12, side: THREE.DoubleSide })); beam.position.set(EX + 11, 6.9, z); beam.rotation.z = z > 0 ? 0.25 : -0.25; cur.add(beam); put(cyl(0.3, 0.4, 0.5, 0x30303a), EX + 11, 1.15, z); });
// media barrier
put(box(0.2, 1.0, 3.4, 0x30303a), EX + 6.9, 0.5, 0); const mediaSign = put(signPlane('MEDIA', '#ffcf3f', '#15151c', 1.8, 0.5, 400, 110, 'bold 84px system-ui'), EX + 6.78, 0.62, 0); mediaSign.rotation.y = -Math.PI / 2;
// crowd
const crowd = [];
[-9, -4, 1].forEach((dx, i) => [-3.2, 3.2].forEach((z, j) => { const ch = makeChar({ skin: (i * 2 + j) % 6, hairStyle: (i + j * 3) % 6, hairColor: (i * 3 + j) % 6, top: (i + j) % 3, topColor: (i * 2 + j * 5 + 1) % 10, bottom: j, bottomColor: (i + 7) % 10, shoes: i % 5, acc: { glasses: i === 1, cap: i === 2 && j === 0 } }); ch.g.position.set(EX + dx + j * 1.2, 0, z); ch.g.rotation.y = z > 0 ? Math.PI : 0; cur.add(ch.g); crowd.push(ch); }));
const starS = npc('event', EX - 5, -0.5, -Math.PI / 2, { female: true, skin: 1, hairStyle: 4, hairColor: 6, top: 2, topColor: 8, bottom: 0, bottomColor: 5, shoes: 3, acc: { earring: true, chain: true } }, 'star_s', []);
const starT = npc('event', EX + 1.5, 0.5, -Math.PI / 2, { skin: 3, hairStyle: 0, hairColor: 0, beard: 2, top: 2, topColor: 7, bottom: 0, bottomColor: 7, shoes: 1, acc: { glasses: true, watch: true } }, 'star_t', []);
npc('event', EX + 6.0, 1.3, -Math.PI / 2, { skin: 4, hairStyle: 1, hairColor: 0, beard: 1, top: 2, topColor: 7, bottom: 0, bottomColor: 7, shoes: 1, acc: { glasses: true } }, 'n_guard', ['n_guard1', 'n_guard2']);
STAR_SETUP();
function STAR_SETUP() { starS.set = [0, 1, 2].map((i) => ({ q: 'qs' + i, a: 'as' + i, v: 1 - i })); starT.set = [0, 1, 2].map((i) => ({ q: 'qt' + i, a: 'at' + i, v: 1 - i })); starS.star = starT.star = true; }

/* ---------- player, lights, confetti ---------- */
// the player's own clothes stay plain until the studio reaches level 2
// outfit cards map to looks the character model can show (colours and cut; not full 3D costumes yet)
const OUTFIT = {
  thobe: { top: 2, topColor: 6, bottom: 0, bottomColor: 6, shoes: 1, dress: 'thobe' }, bisht: { top: 2, topColor: 10, bottom: 0, bottomColor: 6, shoes: 5, dress: 'bisht' }, tux: { top: 2, topColor: 7, bottom: 0, bottomColor: 7, shoes: 1 },
  astro: { top: 1, topColor: 6, bottom: 0, bottomColor: 11, shoes: 0 }, chef: { top: 0, topColor: 6, bottom: 0, bottomColor: 7, shoes: 0, acc: { cap: true }, capColor: 6 }, pilot: { top: 2, topColor: 0, bottom: 0, bottomColor: 7, shoes: 1, acc: { cap: true }, capColor: 7 },
  sport: { top: 0, topColor: 2, bottom: 1, bottomColor: 6, shoes: 3 }, ninja: { top: 1, topColor: 7, bottom: 0, bottomColor: 7, shoes: 1 }, detective: { top: 2, topColor: 4, bottom: 0, bottomColor: 7, shoes: 1, acc: { glasses: true } },
  wizard: { top: 1, topColor: 5, bottom: 0, bottomColor: 5, shoes: 5 }, cowboy: { top: 2, topColor: 4, bottom: 0, bottomColor: 0, shoes: 2, acc: { cap: true }, capColor: 4 }, diver: { top: 0, topColor: 9, bottom: 1, bottomColor: 9, shoes: 4 },
  inventor: { top: 2, topColor: 6, bottom: 0, bottomColor: 0, shoes: 1, acc: { glasses: true } }, knight: { top: 2, topColor: 11, bottom: 0, bottomColor: 11, shoes: 5 },
};
const wear = (av, fam) => (fam && OUTFIT[fam] ? { ...av, ...OUTFIT[fam], acc: { ...(OUTFIT[fam].acc || {}) } } : uni(av));
// the player wears the equipped outfit card; otherwise plain clothes until level 2
const look = () => { const f = cs.equippedFam('skins'); return f && OUTFIT[f] ? wear(avatar, f) : shop.level < 2 ? uni(avatar) : avatar; };
let player = mk(shop.level < 2 ? uni(avatar) : avatar); scene.add(player.g);
function rebuildPlayer() { const pos = player.g.position.clone(), ry = player.g.rotation.y; scene.remove(player.g); player = mk(look()); player.g.position.copy(pos); player.g.rotation.y = ry; scene.add(player.g); }
const amb = new THREE.HemisphereLight(0xdfe6ff, 0x3a3060, 0.9); scene.add(amb);
const stageA = new THREE.PointLight(0xa463ff, 6, 12, 1.6); stageA.position.set(-5.5, 3.2, -2.5); scene.add(stageA);
const stageB = new THREE.PointLight(0x3ad4ff, 6, 12, 1.6); stageB.position.set(5.5, 3.2, -2.5); scene.add(stageB);
const key = new THREE.SpotLight(0xfff2d6, 220, 24, 0.8, 0.6, 1.3); key.position.set(0.5, 8.5, 5.5); key.target.position.set(0.3, 0.5, -1.6); key.castShadow = true;
key.shadow.mapSize.set(IS_MOBILE ? 1024 : 2048, IS_MOBILE ? 1024 : 2048); key.shadow.bias = -0.0008; key.shadow.radius = 4; key.shadow.camera.near = 2; key.shadow.camera.far = 24; scene.add(key); scene.add(key.target);
const rim = new THREE.DirectionalLight(0x9db4ff, 0.7); rim.position.set(-5, 6, -2); scene.add(rim);
const sun = new THREE.DirectionalLight(0xffffff, 0); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.002;
Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 60 }); scene.add(sun); scene.add(sun.target);
// atmosphere: volumetric light beams and floating dust in the studio
const beamTex = (() => { const cv = document.createElement('canvas'); cv.width = 4; cv.height = 128; const x = cv.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 4, 128); const tx = new THREE.CanvasTexture(cv); return tx; })();
const beams = [[-4.2, -1.8, 0xff4fa8], [-1.4, -2.4, 0x22d3ee], [1.4, -2.4, 0x34f59a], [4.2, -1.8, 0xa855f7]].map(([x, z, c]) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 1.3, 5.2, 32, 1, true), new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(c) }, uIntensity: { value: 0.5 } },
    vertexShader: 'varying vec3 vN; varying vec3 vW; varying vec2 vUv; void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'uniform vec3 uColor; uniform float uIntensity; varying vec3 vN; varying vec3 vW; varying vec2 vUv; void main(){ vec3 v = normalize(cameraPosition - vW); float edge = pow(abs(dot(normalize(vN), v)), 1.8); float fall = pow(vUv.y, 2.2); gl_FragColor = vec4(uColor * edge * fall * uIntensity, 1.0); }',
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
  m.position.set(x, 3.0, z); m.rotation.z = x * 0.04; ZG.studio.add(m); return m;
});
const dust = (() => { const n = 260, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 13; pos[i * 3 + 1] = Math.random() * 5; pos[i * 3 + 2] = -3.4 + Math.random() * 8; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ map: (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 32; const x = cv.getContext('2d'); const g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(cv); })(), color: 0xfff4dd, size: 0.06, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); ZG.studio.add(pts); return pts; })();
function atmos(dt, tt) { const a = dust.geometry.attributes.position; for (let i = 0; i < a.count; i++) { let y = a.getY(i) + dt * 0.08; if (y > 5) y = 0; a.setY(i, y); a.setX(i, a.getX(i) + Math.sin(tt * 0.3 + i) * dt * 0.02); } a.needsUpdate = true; beams.forEach((b, i) => { b.material.uniforms.uIntensity.value = (G.light ? 0.55 : 0.12) + Math.sin(tt * 0.8 + i) * 0.08; }); }
const CONF_N = 90; const confetti = []; const confCols = [0xff4d6d, 0xffd23f, 0x3ddc97, 0x4cc9f0, 0xb388ff, 0xff9f1c];
for (let i = 0; i < CONF_N; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.14), new THREE.MeshBasicMaterial({ color: confCols[i % 6], side: THREE.DoubleSide })); m.visible = false; ZG.studio.add(m); confetti.push({ m, ty: 0, vy: 0 }); }
const mess = { x: 0, z: 0 };
function dropConfetti(cx, cz) {
  mess.x = cx; mess.z = cz + 0.9;
  confetti.forEach((c, i) => { const x = cx - 1.7 + Math.random() * 3.4, z = cz - 0.6 + Math.random() * 2.4; c.m.visible = true; c.m.position.set(x, 3.2 + Math.random() * 2.5, z);
    const onDesk = cx === DESK.x && Math.abs(x - DESK.x) < 1.6 && Math.abs(z - DESK.z) < 0.6; c.ty = (onDesk ? 1.08 : 0.03) + (i % 5) * 0.004; c.vy = 2 + Math.random() * 2.2; c.m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3); });
}

/* ---------- state ---------- */
const ZONES = {
  studio: { ox: 0, bx: [-6.6, 6.6], bz: [-3.4, 4.8], cx: [-6.9, 6.9], cz: [-3.8, 9.5], bg: 0x140f26, fog: [16, 34] },
  street: { ox: SX, bx: [-50, 50], bz: [-6.9, 26.5], cx: [-58, 58], cz: [-7.6, 34], bg: 0x8fd3ff, fog: [45, 100] },
  event: { ox: EX, bx: [-13.6, 6.1], bz: [-1.5, 1.5], cx: [-22, 12], cz: [-9, 9], bg: 0x1d1440, fog: [30, 80] },
};
let ROUND = 180, SEG = 90, PASS = 0.7;
// challenge ladder: each passed challenge unlocks the next one — one new prank type at a time, then faster pace and a higher bar
const CH = [ // t = round length in seconds: early challenges are short and lively, later ones longer and harder
  { t: 60, k: ['product', 'camera'], pace: 0.6, pass: 0.5 }, { t: 75, k: ['product', 'camera', 'light'], pace: 0.7, pass: 0.55 }, { t: 90, pace: 0.8, pass: 0.6 },
  { t: 105, pace: 0.85, pass: 0.6 }, { t: 120, pace: 0.9, pass: 0.65 }, { t: 150, pace: 0.9, pass: 0.7 }, { t: 180, pace: 0.85, pass: 0.7 },
  { t: 180, pace: 0.75, pass: 0.75 }, { t: 180, pace: 0.7, pass: 0.75 }, { t: 180, pace: 0.6, pass: 0.8 },
];
let chDone = Math.min(CH.length, store.get('ch', 0));
const chNow = () => CH[Math.min(chDone, CH.length - 1)];
const QSETS = [0, 1, 2].map((r) => [0, 1, 2].map((i) => ({ q: 'q' + r + i, a: 'a' + r + i, v: 1 - i })));
const G = { on: false, zone: 'studio', coins: store.get('coins', 0), time: 0, good: 0, bonus: 0, product: true, feed: 0, light: true, mess: 0, pranks: [], next: 0, asked: [], askCd: 0, asking: false, grace: 0, px: 0, pz: 3.3, face: Math.PI, walk: 0, moving: false };
const seg = () => (G.time < SEG ? 0 : 1);
const needCam = () => (G.on ? seg() : 0);
const productOk = () => seg() === 1 || G.product;
const allGood = () => productOk() && (G.feed === needCam() || G.grace > 0) && G.light && G.mess === 0;
const isActive = (k) => (k === 'product' ? !G.product : k === 'camera' ? G.feed !== needCam() : k === 'light' ? !G.light : G.mess > 0);
const trustNow = () => Math.max(0, Math.min(100, (G.time > 0.5 ? (G.good / G.time) * 100 : 100) + G.bonus));
function addCoins(n) { G.coins += n; store.set('coins', G.coins); $('coinN').textContent = G.coins; if ($('crCoins')) $('crCoins').textContent = '🪙 ' + G.coins; }

let lastStage = 0;
function applyStage() { const lv = shop.level, ch = ZG.studio.children; STAGE_R.forEach(([min, a, b]) => { for (let i = a; i < b; i++) ch[i].visible = lv >= min; }); beams.forEach((b) => { b.visible = lv >= 3 && !ruin.visible; }); if (cs.equippedFam('sets')) { const [, a, b] = STAGE_R[0]; for (let i = a; i < b; i++) ch[i].visible = false; } if (lastStage && lv > lastStage && lv <= 4) rebuildPlayer(); lastStage = lv; }
function syncScene() {
  applyStage();
  const Z = ZONES[G.zone], st = G.zone === 'studio', lit = !st || G.light;
  Object.keys(ZG).forEach((k) => { ZG[k].visible = k === G.zone; });
  scene.background = new THREE.Color(st && !G.light ? 0x07050f : Z.bg); scene.fog = new THREE.Fog(scene.background.getHex(), Z.fog[0], Z.fog[1]);
  key.intensity = st && G.light ? 150 : 0; rim.intensity = st ? (G.light ? 0.9 : 0.2) : 0; stageA.intensity = stageB.intensity = st ? (G.light ? 6 : 2.5) : 0; scene.environmentIntensity = st ? (G.light ? 0.45 : 0.12) : 0.6;
  amb.intensity = st ? (G.light ? 0.7 : 0.22) : G.zone === 'street' ? 1.2 : 0.75;
  sun.intensity = st ? 0 : G.zone === 'street' ? 2.2 : 1.2; sun.color.set(G.zone === 'event' ? 0xc9b8ff : 0xffffff);
  sun.position.set(Z.ox + 8, 16, 9); sun.target.position.set(Z.ox, 0, 0);
  gold.visible = G.product; cleaner.visible = !G.product;
  sbFaces.forEach((f) => { f.material.color.set(lit ? 0xfff3d6 : 0x222222); }); screenMat.color.set(lit ? 0xffffff : 0x333333);
  lever.position.y = G.light ? 1.5 : 1.36; bulb.material.color.set(G.light ? 0x3ddc97 : 0xff3b4e);
  tripods.forEach((tp, i) => { tp.tally.visible = i === G.feed; }); conBtns.forEach((b, i) => { b.material.emissiveIntensity = i === G.feed ? 7 : 0; });
  const s = SHOTS[G.feed]; feedCam.position.set(...s.p); feedCam.lookAt(...s.l); conScreen.material.color.set(G.feed === needCam() ? 0x3ddc97 : 0xff8a3d);
  $('hud').className = 'screen ' + (G.on ? 'round' : 'roam'); $('coinN').textContent = G.coins;
}
function flashPip() { const f = $('pipFlash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
function say(text, kind, quiet) { const b = $('bubble'); b.textContent = text; b.className = 'bubble show ' + (kind || ''); clearTimeout(say.h); say.h = setTimeout(() => { b.className = 'bubble'; }, 5200); if (!quiet) speak(text); }
function enterZone(z, x, zz, face) { G.zone = z; G.px = ZONES[z].ox + x; G.pz = zz; G.face = face; sfx.door(); syncScene(); snapCam = true; }

/* ---------- round ---------- */
function firePrank() {
  const allow = chNow().k; const pool = (seg() === 0 ? ['product', 'camera', 'light', 'confetti'] : ['camera', 'light', 'confetti']).filter((k) => !isActive(k) && (!allow || allow.includes(k))); if (!pool.length) return;
  const k = pool[Math.floor(Math.random() * pool.length)];
  if (k === 'product') G.product = false; if (k === 'camera') { G.feed = (G.feed + 1 + Math.floor(Math.random() * 2)) % 3; G.grace = 0; flashPip(); }
  if (k === 'light') G.light = false; if (k === 'confetti') { G.mess = 3; const c = seg() === 0 ? DESK : IV; dropConfetti(c.x, c.z); }
  G.pranks.push({ k, at: G.time, fixed: null, told: false }); sfx.prank(); syncScene();
}
function markFixed(k) { const p = G.pranks.slice().reverse().find((x) => x.k === k && x.fixed === null); if (p) { p.fixed = G.time; G.bonus += cs.bonuses().fix; sfx.fix(); say(t('sp_ok'), 'ok', true); } }
const selfPrank = (k) => G.pranks.push({ k, at: G.time, fixed: null, told: true, self: true });
function startRound() {
  lastAct = 0; Object.assign(G, { on: true, zone: 'studio', time: 0, good: 0, bonus: 0, product: true, feed: 0, light: true, mess: 0, pranks: [], next: 9, asked: [], askCd: 0, asking: false, grace: 0, px: 0, pz: 3.3, face: Math.PI });
  confetti.forEach((c) => { c.m.visible = false; }); $('qSheet').hidden = true; show('hud'); syncScene(); resize(); snapCam = true; sfx.seg();
  const c = chNow(); PASS = c.pass; ROUND = c.t; SEG = ROUND / 2; G.next = ROUND <= 90 ? 5 : 9; const prev = chDone > 0 && chDone < CH.length ? CH[chDone - 1].k : null; const allK = ['product', 'camera', 'light', 'confetti'], kNow = c.k || allK, kPrev = chDone > 0 ? CH[chDone - 1].k || allK : []; const fresh = chDone < CH.length ? kNow.filter((k) => !kPrev.includes(k)) : [];
  say((chDone < CH.length ? '🎯 ' + t('ch_title').replace('{n}', chDone + 1) + ' · ' : '') + t('ch_goal').replace('{p}', Math.round(PASS * 100)) + (fresh.length ? ' · ' + t('ch_new') + ': ' + fresh.map((k) => t('p_' + k)).join(' + ') : ''), '', true);
  G.bonus += cs.bonuses().trust + upg.desk * 3 + (cafe.on ? 5 : 0); if (cafe.on) { cafe.on = false; store.set('coffee', false); }
}
function endRound() {
  G.on = false; G.asking = false; $('qSheet').hidden = true; const missed = Math.max(0, (SEG >= 75 ? 3 : SEG >= 45 ? 2 : 1) - G.asked.length); G.bonus -= missed * 6;
  const BN = cs.bonuses();
  const trust = Math.max(0, Math.min(100, (G.good / ROUND) * 100 + G.bonus)) / 100; const pass = trust >= PASS; const coins = Math.round((pass ? 100 + trust * 150 : trust * 60) * (1 + BN.coins / 100));
  let chMsg = ''; const coinsX = (1 + Math.min(chDone, CH.length - 1) * 0.1) * (1 + skills.deals * 0.04) * (1 + (licence ? LIC[licence].ads : 0) / 100);
  if (pass && chDone < CH.length) { chDone++; store.set('ch', chDone); chMsg = chDone < CH.length ? '🎯 ' + t('ch_next').replace('{n}', chDone + 1) : '🏆 ' + t('ch_done'); }
  addCoins(Math.round(coins * coinsX)); (pass ? sfx.win : sfx.lose)(); buzz(pass ? [60, 40, 120] : 200);
  stats.rounds++; if (pass) stats.wins++; stats.best = Math.max(stats.best, Math.round(trust * 100)); store.set('stats', stats);
  if (trust > 0) { const clips = store.get('interviews', []); clips.push({ q: Math.round(trust * 100), at: Date.now(), clip: true }); store.set('interviews', clips.slice(-30)); }
  const xp = Math.round(roundXp(trust, pass) * (1 + BN.xp / 100) * (1 + skills.learn * 0.05)), up = shop.addXp(xp); showLevel();
  let drop = null; if (Math.random() * 100 < 4 + BN.luck) drop = cs.grantRandom(cs.dropLevel(trust)); cs.consumeBoosts();
  $('rXp').textContent = '+' + xp + ' ' + t('xp') + ' · ' + t('lvl') + ' ' + shop.level; $('rUp').hidden = !up && !drop && !chMsg; $('rUp').textContent = [chMsg, up ? '⭐ ' + t('level_up') : '', drop ? '🎁 ' + t('st_drop') + ': ' + drop.fam.icon + ' ' + cs.nameOf(drop) : ''].filter(Boolean).join('  ·  ');
  $('rTitle').textContent = t(pass ? 'r_pass' : 'r_fail'); $('rTitle').className = pass ? 'pass' : 'fail';
  $('rTrust').textContent = Math.round(trust * 100) + '%'; $('rAir').textContent = fmt(G.good) + ' / ' + fmt(ROUND); $('rCoins').textContent = '+' + Math.round(coins * coinsX);
  const line = t(trust >= 0.85 ? 'sp_end_great' : pass ? 'sp_end_ok' : 'sp_end_bad'); $('rSponsor').textContent = line; speak(line);
  const row = (ul, a, b, c, bad) => { const li = document.createElement('li'); li.innerHTML = '<b></b><span></span><i></i>'; li.children[0].textContent = a; li.children[1].textContent = b; li.children[2].textContent = c; if (bad) li.className = 'bad'; ul.appendChild(li); };
  const ul = $('rList'); ul.innerHTML = ''; if (!G.pranks.length) row(ul, '', t('r_none'), '');
  G.pranks.forEach((p) => row(ul, fmt(p.at), t('p_' + p.k) + (p.self ? ' — ' + t('r_self') : ''), p.fixed === null ? t('r_unfixed') : t('r_fixed') + ' ' + (p.fixed - p.at).toFixed(1) + t('sec'), p.fixed === null));
  const iv = $('rIv'); iv.innerHTML = ''; G.asked.forEach((q) => row(iv, q.v > 0 ? '+4' : q.v < 0 ? '−4' : '0', t(q.q), t(q.v > 0 ? 'iv_good' : q.v < 0 ? 'iv_bad' : 'iv_meh'), q.v < 0));
  for (let i = 0; i < missed; i++) row(iv, '−6', t('r_noq'), '', true);
  G.product = true; G.light = true; G.mess = 0; G.feed = 0; confetti.forEach((c) => { c.m.visible = false; }); syncScene(); show('report');
}
const fmt = (s) => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
function openQuestions(set, onPick) {
  G.asking = true; const list = set.slice().sort(() => Math.random() - 0.5); const el = $('qList'); el.innerHTML = '';
  list.forEach((q, i) => { const b = document.createElement('button'); b.textContent = (i + 1) + '. ' + t(q.q); b.onclick = () => { if (!G.asking) return; G.asking = false; $('qSheet').hidden = true; (q.v > 0 ? sfx.good : q.v < 0 ? sfx.bad : sfx.click)(); onPick(q); }; el.appendChild(b); });
  $('qSheet').hidden = false;
}

/* ---------- interactables ---------- */
const roam = () => !G.on;
interact('studio', PX, PZ + 1.25, 1.15, 'a_product', '📦', () => G.on, () => { const was = isActive('product'); G.product = !G.product; if (G.product) markFixed('product'); else if (!was && seg() === 0) selfPrank('product'); });
const itCon = interact('studio', CON.x, CON.z + 0.95, 1.15, 'a_console', '🎥', () => true, () => {
  if (!G.on) { if (!pcS.fixed) { sfx.bad(); say('🎯 ' + t(objKey() || 'locked_hint'), 'warn', true); return; } startRound(); return; }
  const was = isActive('camera'); G.feed = (G.feed + 1) % 3; G.grace = 0; flashPip(); if (!isActive('camera')) markFixed('camera'); else if (!was) selfPrank('camera');
});
interact('studio', BRK.x + 0.75, BRK.z, 1.15, 'a_light', '💡', () => true, () => { G.light = !G.light; if (G.on) { if (G.light) markFixed('light'); else selfPrank('light'); } });
interact('studio', IV.x, IV.z + 1.3, 1.3, 'a_ask', '🎤', () => G.on && seg() === 1 && G.asked.length < 3 && G.askCd <= 0, () => openQuestions(QSETS[G.asked.length], (q) => {
  G.asked.push(q); G.askCd = 4.5; G.bonus += q.v * 4; say(t('guest') + ': ' + t(q.a), q.v > 0 ? 'ok' : q.v < 0 ? 'warn' : ''); guest.head.rotation.x = q.v < 0 ? 0.35 : -0.15; setTimeout(() => { guest.head.rotation.x = 0; }, 1800);
}));
interact('studio', 6.2, 3.4, 1.1, 'a_exit', '🚪', roam, () => enterZone('street', 0, -6.3, 0));
interact('street', SX, -6.9, 1.1, 'a_enter', '🚪', roam, () => enterZone('studio', 5.6, 3.4, -Math.PI / 2));
interact('street', SX + 12.2, 0, 1.3, 'a_event', '🏆', roam, () => enterZone('event', -12.6, 0, Math.PI / 2));
interact('event', EX - 13.2, 0, 1.2, 'a_back', '🚪', roam, () => enterZone('street', 11, 0, -Math.PI / 2));
NPCS.forEach((n) => {
  const fx = n.x + Math.sin(n.face) * 1.1, fz = n.z + Math.cos(n.face) * 1.1;
  if (n.star) interact(n.zone, fx, fz, 1.3, 'a_interview', '🎤', () => roam() && !n.done, () => openQuestions(n.set, (q) => { n.done = true; const rw = q.v > 0 ? 60 : q.v === 0 ? 20 : 0; addCoins(rw); say(t(n.name) + ': ' + t(q.a), q.v > 0 ? 'ok' : q.v < 0 ? 'warn' : ''); $('coinBox').classList.remove('pop'); void $('coinBox').offsetWidth; if (rw) $('coinBox').classList.add('pop'); }));
  else if (n.zone === 'street') interact(n.zone, fx, fz, 1.3, 'a_interview', '🎤', () => roam() && !ivOn && !storyOn && !chase.on, () => startInterview(n));
  else interact(n.zone, fx, fz, 1.3, 'a_talk', '💬', roam, () => { sfx.click(); say(t(n.name) + ': ' + t(n.lines[n.i++ % n.lines.length])); });
});
function currentAction() {
  if (G.asking) return null; let best = null, bd = 99;
  if (G.on && G.mess > 0) { const d = Math.hypot(G.px - mess.x, G.pz - mess.z); if (d < 1.9) { best = 'clean'; bd = d + 0.25; } }
  IT.forEach((it) => { if (it.zone !== G.zone || !it.cond()) return; const d = Math.hypot(G.px - it.x, G.pz - it.z); if (d < it.r && d < bd) { best = it; bd = d; } });
  return best;
}
function act() {
  const a = currentAction(); if (!a) return;
  if (a === 'clean') { G.mess--; const keep = Math.round((CONF_N * G.mess) / 3); confetti.forEach((c, i) => { if (i >= keep) c.m.visible = false; }); sfx.click(); if (G.mess === 0) markFixed('confetti'); }
  else { if (a.key !== 'a_talk' && a.key !== 'a_ask' && a.key !== 'a_interview') sfx.click(); a.run(); }
  player.armR.rotation.x = -1.6; setTimeout(() => { player.armR.rotation.x = 0; }, 260); syncScene(); lastAct = 0;
}

/* ---------- input ---------- */
const keys = {}; const joy = { on: false, id: null, cx: 0, cy: 0, x: 0, y: 0 };
window.addEventListener('keydown', (e) => { keys[e.code] = true; if ((e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter') && !$('hud').hidden) { e.preventDefault(); act(); }
  if (G.asking && /^(Digit|Numpad)[123]$/.test(e.code)) { const b = $('qList').children[+e.code.slice(-1) - 1]; if (b) b.click(); } });
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
const pad = $('joy'), knob = $('knob');
pad.addEventListener('pointerdown', (e) => { joy.on = true; joy.id = e.pointerId; const r = pad.getBoundingClientRect(); joy.cx = r.left + r.width / 2; joy.cy = r.top + r.height / 2; try { pad.setPointerCapture(e.pointerId); } catch (x) {} moveJoy(e); });
pad.addEventListener('pointermove', (e) => { if (joy.on && e.pointerId === joy.id) moveJoy(e); });
const endJoy = (e) => { if (e.pointerId === joy.id) { joy.on = false; joy.x = joy.y = 0; knob.style.transform = 'translate(0,0)'; } };
pad.addEventListener('pointerup', endJoy); pad.addEventListener('pointercancel', endJoy);
function moveJoy(e) { let dx = e.clientX - joy.cx, dy = e.clientY - joy.cy; const m = Math.hypot(dx, dy), R = 46; if (m > R) { dx *= R / m; dy *= R / m; } joy.x = dx / R; joy.y = dy / R; knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; }
$('actBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); act(); });

function movePlayer(dt) {
  let turn = joy.x + (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
  let fwd = -joy.y + (keys.ArrowUp || keys.KeyW ? 1 : 0) - (keys.ArrowDown || keys.KeyS ? 1 : 0);
  if (G.asking) turn = fwd = 0;
  if (Math.abs(turn) < 0.18) turn = 0; if (Math.abs(fwd) < 0.18) fwd = 0;
  turn = Math.max(-1, Math.min(1, turn)); fwd = Math.max(-1, Math.min(1, fwd));
  G.face -= turn * 2.5 * dt; G.moving = fwd !== 0;
  if (G.moving) { const sp = (fwd > 0 ? 4.0 : 2.2) * fwd * (1 + fit.lv * 0.06); G.px += Math.sin(G.face) * sp * dt; G.pz += Math.cos(G.face) * sp * dt; G.walk += dt * 11 * Math.abs(fwd); }
  const Z = ZONES[G.zone];
  COLL[G.zone].forEach(([x, z, r]) => { const dx = G.px - x, dz = G.pz - z, d = Math.hypot(dx, dz), R = r + 0.3; if (d < R && d > 0.0001) { G.px = x + (dx / d) * R; G.pz = z + (dz / d) * R; } });
  RECTS[G.zone].forEach(([a, b, c, d]) => { const k = 0.3; if (G.px > a - k && G.px < b + k && G.pz > c - k && G.pz < d + k) { const l = G.px - (a - k), r = b + k - G.px, u = G.pz - (c - k), w = d + k - G.pz, mn = Math.min(l, r, u, w); if (mn === l) G.px = a - k; else if (mn === r) G.px = b + k; else if (mn === u) G.pz = c - k; else G.pz = d + k; } });
  if (G.zone === 'street') { sun.position.set(G.px + 8, 16, G.pz + 9); sun.target.position.set(G.px, 0, G.pz); }
  G.px = Math.max(Z.ox + Z.bx[0], Math.min(Z.ox + Z.bx[1], G.px)); G.pz = Math.max(Z.bz[0], Math.min(Z.bz[1], G.pz));
  player.g.position.set(G.px, G.moving ? Math.abs(Math.sin(G.walk)) * 0.05 : 0, G.pz); player.g.rotation.y = G.face;
  const sw = G.moving ? Math.sin(G.walk) * 0.8 : 0; player.legL.rotation.x = sw; player.legR.rotation.x = -sw; player.armL.rotation.x = -sw * 0.8; if (Math.abs(player.armR.rotation.x) < 1.2) player.armR.rotation.x = sw * 0.8;
}
let snapCam = true; const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3();
function followCam(dt) {
  const Z = ZONES[G.zone], portrait = window.innerWidth < window.innerHeight, dist = portrait ? 4.6 : 4.2, fx = Math.sin(G.face), fz = Math.cos(G.face);
  const want = new THREE.Vector3(G.px - fx * dist, portrait ? 3.1 : 2.7, G.pz - fz * dist);
  want.x = Math.max(Z.ox + Z.cx[0], Math.min(Z.ox + Z.cx[1], want.x)); want.z = Math.max(Z.cz[0], Math.min(Z.cz[1], want.z));
  const tgt = new THREE.Vector3(G.px + fx * 2.2, 1.25, G.pz + fz * 2.2);
  if (snapCam) { camPos.copy(want); camTgt.copy(tgt); snapCam = false; } else { const k = Math.min(1, dt * 7); camPos.lerp(want, k); camTgt.lerp(tgt, k); }
  cam.position.copy(camPos); cam.lookAt(camTgt);
}

/* ---------- screens ---------- */
let pip = { x: 0, y: 0, w: 0, h: 0 };
let composer = null, bloom = null;
function setupFX() {
  if (cfg.quality === 'low' || IS_MOBILE) { composer = null; return; }
  const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: IS_MOBILE ? 0 : 4 });
  composer = new EffectComposer(renderer, rt); composer.addPass(new RenderPass(scene, cam));
  bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.45, 2.6); composer.addPass(bloom); composer.addPass(new OutputPass());
}
function resize() { const w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h, false); if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); } const r = $('pip').getBoundingClientRect(); pip = { x: r.left, y: h - r.bottom, w: r.width, h: r.height }; }
window.addEventListener('resize', resize);
function show(id) { ['menu', 'hud', 'report', 'how', 'langs', 'creator', 'profile', 'settings', 'storeS', 'tour'].forEach((s) => { $(s).hidden = s !== id; }); if (id === 'menu') checkDaily(); }
function buildLangs() { const g = $('langGrid'); g.innerHTML = ''; LANGS.forEach((l) => { const b = document.createElement('button'); b.textContent = l.name; b.dir = l.rtl ? 'rtl' : 'ltr'; if (l.code === lang) b.className = 'sel'; b.onclick = () => { lang = l.code; store.set('lang', lang); applyLang(); show('settings'); buildSettings(); }; g.appendChild(b); }); }
function enterRoam() { lastAct = 0; G.on = false; G.zone = 'studio'; G.px = 0; G.pz = 3.3; G.face = Math.PI; player.armR.rotation.set(0, 0, 0); show('hud'); resize(); syncScene(); snapCam = true; say(t('roam_hint'), '', true); }
// character creator
let tab = 'skin'; const hv = new THREE.Vector3();
function showLevel() {
  const lv = shop.level, a = xpFor(lv), b = xpFor(Math.min(MAX_LEVEL, lv + 1));
  const pct = lv >= MAX_LEVEL ? 100 : Math.round(((shop.xp - a) / (b - a)) * 100);
  $('lvlBox').textContent = '⭐ ' + lv; $('crLvl').textContent = '⭐ ' + t('lvl') + ' ' + lv; $('crXp').style.width = pct + '%'; $('crCoins').textContent = '🪙 ' + G.coins;
}
function toast(msg) { const el = $('crToast'); el.textContent = msg; el.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => { el.hidden = true; }, 2200); }
function buildCreator() {
  showLevel();
  const tabs = $('crTabs'); tabs.innerHTML = ''; (shop.level < 2 ? ['skin', 'body', 'face', 'hair'] : ['skin', 'body', 'face', 'hair', 'clothes', 'acc', 'packs']).forEach((k) => { const b = document.createElement('button'); b.textContent = t('t_' + k); if (k === tab) b.className = 'sel'; b.onclick = () => { tab = k; sfx.click(); buildCreator(); }; tabs.appendChild(b); });
  const body = $('crBody'); body.innerHTML = '';
  const row = (label) => { const h = document.createElement('h4'); h.textContent = label; body.appendChild(h); const d = document.createElement('div'); d.className = 'opts'; body.appendChild(d); return d; };
  const changed = () => { store.set('avatar', avatar); rebuildPlayer(); sfx.click(); buildCreator(); };
  // Locked (level too low): explain. Available but not owned: preview it; the buy bar appears.
  const gate = (id, apply) => () => { if (!shop.available(id) && isExclusive(id)) { sfx.bad(); toast('👑 ' + t('d_excl')); return; } if (!shop.available(id)) { sfx.bad(); toast(t('need_lvl').replace('{n}', reqLevel(id))); return; } apply(); changed(); };
  const mark = (b, id) => { if (shop.has(id)) return; const tag = document.createElement('i'); tag.className = 'tag'; if (isExclusive(id)) { tag.textContent = '👑30'; b.classList.add('locked'); } else if (shop.available(id)) tag.textContent = '🪙' + price(id); else { tag.textContent = '🔒' + reqLevel(id); b.classList.add('locked'); } b.appendChild(tag); };
  const swatches = (label, cols, k, field) => { const d = row(label); cols.forEach((c, i) => { const id = (field || k) + ':' + i; const b = document.createElement('button'); b.className = 'sw' + (avatar[k] === i ? ' sel' : ''); b.style.background = '#' + c.toString(16).padStart(6, '0'); b.onclick = gate(id, () => { avatar[k] = i; }); if (k !== 'skin') mark(b, id); d.appendChild(b); }); };
  const chips = (label, names, k) => { const d = row(label); names.forEach((n, i) => { const id = k + ':' + i; const b = document.createElement('button'); b.className = 'chip' + (avatar[k] === i ? ' sel' : ''); b.textContent = n; b.onclick = gate(id, () => { avatar[k] = i; }); mark(b, id); d.appendChild(b); }); };
  // body and face sliders: free for everyone, applied live to the realistic character
  const slider = (grp, k, label) => { const d = row(label); d.className = 'opts sl'; const inp = document.createElement('input'); inp.type = 'range'; inp.min = -100; inp.max = 100; inp.step = 5; inp.value = Math.round(((avatar[grp] || {})[k] || 0) * 100);
    inp.oninput = () => { avatar[grp] = { ...(avatar[grp] || {}), [k]: +inp.value / 100 }; player.av = look(); reshape(player); }; inp.onchange = () => { store.set('avatar', avatar); sfx.click(); }; d.appendChild(inp); };
  const shapeBtns = (keys, grp) => { const d = row(''); [['🎲 ' + t('c_random'), () => { const r = randomShape(); avatar[grp] = r[grp]; }], ['↺ ' + t('c_reset'), () => { avatar[grp] = {}; }]].forEach(([n, f]) => { const b = document.createElement('button'); b.className = 'chip'; b.textContent = n; b.onclick = () => { f(); store.set('avatar', avatar); player.av = look(); reshape(player); sfx.click(); buildCreator(); }; d.appendChild(b); }); void keys; };
  if (tab === 'body') { const d = row(t('b_type')); [['o_male', false], ['o_female', true]].forEach(([n, f]) => { const b = document.createElement('button'); b.className = 'chip' + (!!avatar.female === f ? ' sel' : ''); b.textContent = t(n); b.onclick = () => { avatar.female = f; if (f && avatar.beard) avatar.beard = 0; const fem = [4, 6, 7, 8]; if (f && !fem.includes(avatar.hairStyle)) avatar.hairStyle = 6; if (!f && fem.includes(avatar.hairStyle)) avatar.hairStyle = 0; changed(); }; d.appendChild(b); });
    BODY_KEYS.forEach((k) => slider('body', k, t('b_' + k))); shapeBtns(BODY_KEYS, 'body'); }
  if (tab === 'face') { FACE_KEYS.forEach((k) => slider('face', k, t('f_' + k))); shapeBtns(FACE_KEYS, 'face'); }
  if (tab === 'skin') swatches(t('c_color'), OPT.skin, 'skin');
  if (tab === 'hair') { chips(t('c_style'), Array.from({ length: OPT.hairStyle }, (_, i) => String(i + 1)), 'hairStyle'); swatches(t('c_color'), OPT.hairColor, 'hairColor'); chips(t('c_beard'), OPT.beard.map((b) => t('o_' + b)), 'beard'); }
  if (tab === 'clothes') { chips(t('c_top'), OPT.top.map((b) => t('o_' + b)), 'top'); swatches(t('c_color'), OPT.cloth, 'topColor', 'cloth'); chips(t('c_bottom'), OPT.bottom.map((b) => t('o_' + b)), 'bottom'); swatches(t('c_color'), OPT.cloth, 'bottomColor', 'cloth'); swatches(t('c_shoes'), OPT.shoes, 'shoes'); }
  if (tab === 'acc') { const d = row(t('t_acc')); OPT.acc.forEach((n) => { const id = 'acc:' + n; const b = document.createElement('button'); b.className = 'chip' + (avatar.acc[n] ? ' sel' : ''); b.textContent = t('o_' + n); b.onclick = gate(id, () => { avatar.acc[n] = !avatar.acc[n]; }); mark(b, id); d.appendChild(b); }); swatches(t('c_cap'), OPT.cloth, 'capColor', 'cloth'); }
  if (tab === 'packs') PACKS.forEach((p) => {
    const card = document.createElement('div'); card.className = 'pack'; const own = shop.packOwned(p), open = shop.level >= p.level;
    const names = p.items.map((id) => { const [f, v] = id.split(':'); return f === 'acc' ? t('o_' + v) : f === 'cloth' ? '🎨' : f === 'top' ? t('o_' + OPT.top[v]) : f === 'bottom' ? t('o_' + OPT.bottom[v]) : f === 'shoes' ? '👟' : f === 'beard' ? t('o_' + OPT.beard[v]) : '💇'; });
    const worth = p.items.reduce((s, id) => s + price(id), 0);
    card.innerHTML = '<b></b><small></small><button></button>'; card.children[0].textContent = t('pk_' + p.id); card.children[1].textContent = names.join(' · ') + '  —  ' + p.items.length + ' ' + t('pk_items');
    const btn = card.children[2];
    if (own) { btn.textContent = '✓ ' + t('owned'); btn.disabled = true; }
    else if (!open) { btn.textContent = '🔒 ' + t('lvl') + ' ' + p.level; btn.onclick = () => { sfx.bad(); toast(t('need_lvl').replace('{n}', p.level)); }; }
    else { btn.innerHTML = '<s></s> 🪙 <span></span>'; btn.children[0].textContent = worth; btn.children[1].textContent = p.cost; btn.onclick = () => { if (G.coins < p.cost) { sfx.bad(); toast(t('no_coins')); return; } addCoins(-p.cost); shop.grant(p.items); sfx.win(); toast('🎉 ' + t('bought')); buildCreator(); }; }
    body.appendChild(card);
  });
  // Buy bar: total for the previewed items the player does not own yet.
  const unowned = wornIds(avatar).filter((id) => !shop.has(id)), total = unowned.reduce((s, id) => s + price(id), 0), bb = $('crBuy');
  bb.hidden = !unowned.length; if (unowned.length) { bb.textContent = t('buy_all') + ' 🪙 ' + total; bb.className = 'big' + (G.coins < total ? ' poor' : ''); bb.onclick = () => { if (G.coins < total) { sfx.bad(); toast(t('no_coins')); return; } addCoins(-total); shop.grant(unowned); store.set('avatar', avatar); sfx.win(); toast('🎉 ' + t('bought')); buildCreator(); }; }
  $('crHint').hidden = !unowned.length;
}
// daily login reward
let dailyState = store.get('daily', { last: null, day: 0, cycle: 0, graceUsed: false });
function checkDaily() {
  if (tourI >= 0 || storyOn || afterCreator || !store.get('story_done', false)) return;
  const p = dailyPreview(dailyState); if (!p.due) return;
  $('dDay').textContent = t('d_day').replace('{n}', p.day);
  const g = $('dGrid'); g.innerHTML = '';
  for (let d = 1; d <= CYCLE; d++) { const c = document.createElement('i'); c.textContent = d === CYCLE ? '👑' : isBig(d) ? '🎁' : d; c.className = (isBig(d) ? 'gift ' : '') + (d < p.day ? 'done' : d === p.day ? 'now' : ''); g.appendChild(c); }
  const note = $('dNote'); note.hidden = !p.note; if (p.note) note.textContent = t('d_' + p.note);
  $('dReward').textContent = '🪙 ' + rewardFor(p.day) + (p.day === CYCLE ? ' + 👑' : '');
  $('daily').hidden = false;
}
$('dClaim').onclick = () => {
  const r = dailyClaim(dailyState); $('daily').hidden = true; if (!r) return;
  dailyState = r.state; store.set('daily', dailyState); addCoins(r.coins); sfx.win();
  if ([7, 14, 21].includes(r.day)) cs.grantRandom(r.day === 21 ? 2 : 1);
  if (r.grand) {
    const id = shop.nextExclusive(); if (id) shop.grant([id]); else addCoins(500);
    $('dGrid').innerHTML = ''; $('dNote').hidden = false; $('dNote').textContent = '👑 ' + t('d_grand'); $('daily').hidden = false;
    $('dClaim').hidden = true; setTimeout(() => { $('daily').hidden = true; $('dClaim').hidden = false; }, 3500);
  }
};
function showPiUser() { const el = $('piUser'); el.hidden = !PiState.user; if (PiState.user) el.textContent = 'π ' + PiState.user; }
piSignIn().then(showPiUser); showLevel();
$('bPlay').onclick = () => { sfx.click(); enterRoam(); }; $('bAgain').onclick = startRound; $('bMenu').onclick = enterRoam;
$('bHow').onclick = () => show('how'); $('bHowBack').onclick = () => show('menu'); $('langBtn').onclick = () => { buildLangs(); show('langs'); }; $('bLangBack').onclick = () => { show('settings'); buildSettings(); };
$('bChar').onclick = () => { sfx.click(); G.zone = 'studio'; G.light = true; syncScene(); buildCreator(); show('creator'); }; $('bCharDone').onclick = () => { sfx.click(); stripUnowned(); store.set('avatar', avatar); rebuildPlayer(); if (afterCreator) { afterCreator = false; startStory(); } else show('menu'); };
// app-token store
function gToast(msg) { const el = $('gToast'); el.textContent = msg; el.hidden = false; clearTimeout(gToast.h); gToast.h = setTimeout(() => { el.hidden = true; }, 2200); }
const cs = makeStore({ store, t, getLang: () => lang, sfx, toast: gToast, $ });
$('bStore').onclick = () => { sfx.click(); storeFrom = 'menu'; cs.closeSheet(); cs.render(); show('storeS'); };
$('stBack').onclick = () => { sfx.click(); cs.closeSheet(); rebuildPlayer(); Object.keys(STAFF).forEach(restyle); applyRoom(); if (cs.needsReady()) { pcFromStore(); return; } if (storeFrom === 'hud') { storeFrom = 'menu'; storePause = false; show('hud'); resize(); syncScene(); } else show('menu'); };

// ───────── opening story (shown once per player, never repeated) ─────────
// scenes 1–3: father's will → Uncle Saleh at the door → abandoned studio → cleaning. Later scenes hook in as their features land.
const ruin = new THREE.Group(); ruin.visible = false; ZG.studio.add(ruin);
const DUST = []; const dustM = new THREE.MeshStandardMaterial({ color: 0x5e4d3a, roughness: 1 }), sheetM = new THREE.MeshStandardMaterial({ color: 0xd9d4c8, roughness: 0.95 });
function dustPile(x, z) { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), dustM); m.scale.set(1.15, 0.16, 0.85); m.position.y = 0.05; g.add(m);
  for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.12 + Math.random() * 0.15, 0.04, 0.1 + Math.random() * 0.12), dustM); b.position.set((Math.random() - 0.5) * 0.9, 0.06, (Math.random() - 0.5) * 0.7); b.rotation.y = Math.random() * 3; g.add(b); }
  g.position.set(x, 0, z); ruin.add(g); return g; }
function sheet(x, z, w, h, d) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), sheetM); m.position.set(x, h / 2, z); m.castShadow = true; ruin.add(m); return m; }
[[-3.6, 1.4], [1.3, 2.6], [3.9, 0.9], [-0.9, -0.6], [5.0, -0.9], [-5.0, -0.2]].forEach(([x, z]) => DUST.push({ m: dustPile(x, z), x, z, done: false }));
[[DESK.x, DESK.z + 0.9, 3.5, 1.5, 1.6], [CON.x, CON.z + 0.4, 1.8, 1.5, 1.3], [IV.x, IV.z + 0.1, 3.3, 1.15, 1.6]].forEach(([x, z, w, h, d]) => DUST.push({ m: sheet(x, z, w, h, d), x, z: z + d / 2 + 0.3, done: false }));
let storyOn = false, cleaning = false, SI = -1, afterCreator = false;
const salehAv = { skin: 2, hairStyle: 1, hairColor: 5, beard: 1, top: 2, topColor: 6, bottom: 0, bottomColor: 6, shoes: 1, dress: 'thobe' };
const salehSt = mk(uni(salehAv)); salehSt.g.visible = false; ZG.street.add(salehSt.g);
const salehIn = mk(uni(salehAv)); salehIn.g.visible = false; ZG.studio.add(salehIn.g);
DUST.forEach((d) => interact('studio', d.x, d.z, 1.05, 'a_clean', '🧹', () => cleaning && !d.done, () => cleanOne(d)));
function ruinGear(on) { tripods.forEach((tp) => { tp.g.visible = !on; }); beams.forEach((b) => { if (b && b.isObject3D) b.visible = !on; }); }
function cleanOne(d) { d.done = true; d.m.visible = false; sfx.fix(); const left = DUST.filter((x) => !x.done).length; if (left) say('🧹 ' + left, '', true); else { cleaning = false; ruin.visible = false; ruinGear(false); applyRoom(); G.light = true; syncScene(); sfx.win(); storyNext(); } }
const STORY = [
  { who: 'sn_father', k: 's1a', black: true }, { who: 'sn_father', k: 's1b', black: true }, { k: 's1c', black: true },
  { act: 'street' }, { who: 'sn_saleh', k: 's2a' }, { who: 'sn_me', k: 's2b' },
  { act: 'enter' }, { k: 's2c' }, { who: 'sn_me', k: 's2d' }, { who: 'sn_saleh', k: 's2e' },
  { k: 's3a' }, { who: 'sn_saleh', k: 's3b' }, { act: 'clean' },
  { k: 's3c', act: 'xp' }, { who: 'sn_saleh', k: 's3d' }, { act: 'end' },
];
function faceTo(ch, x, z) { ch.g.rotation.y = Math.atan2(x - ch.g.position.x, z - ch.g.position.z); }
function storyNext() {
  SI++; const st = STORY[SI]; const box = $('story'); if (!st) return;
  if (st.act === 'street') { enterZone('street', 0.6, -4.4, Math.PI); salehSt.g.position.set(SX - 0.9, 0, -6.2); faceTo(salehSt, G.px, G.pz); salehSt.g.visible = true; show('hud'); return storyNext(); }
  if (st.act === 'enter') { salehSt.g.visible = false; ruin.visible = true; roomG.visible = false; ruinGear(true); G.light = false; enterZone('studio', 5.2, 3.4, -Math.PI / 2); salehIn.g.position.set(6.0, 0, 2.2); faceTo(salehIn, G.px, G.pz); salehIn.g.visible = true; syncScene(); return storyNext(); }
  if (st.act === 'clean') { box.hidden = true; cleaning = true; say(t('s3a'), '', true); return; }
  if (st.act === 'end') { box.hidden = true; storyOn = false; salehIn.g.visible = false; store.set('story_done', true); store.set('tour_done', true); say(t('roam_hint'), '', true); return; }
  if (st.act === 'xp') { const up = shop.addXp(10); showLevel(); if (up) say('⭐ ' + t('level_up'), '', true); }
  box.hidden = false; box.classList.toggle('black', !!st.black);
  $('sWho').textContent = st.who ? t(st.who) : ''; $('sText').textContent = t(st.k); $('sNext').textContent = t('tu_next');
  speak(t(st.k), st.who ? t(st.who) : 'guest');
}
function startStory() { storyOn = true; SI = -1; G.on = false; G.zone = 'studio'; syncScene(); storyNext(); }
$('sNext').onclick = () => { sfx.click(); if (dq) dlgNext(); else storyNext(); };

// ───────── street interviews: keep the person in frame while the primitive camera shakes ─────────
let ivOn = false, ivT = 0, ivPos = 0.5, ivStep = 0, ivHits = 0, ivNpc = null, ivZoneW = 0.24, ivSpeed = 2.2, dq = null;
const gearLv = (fam) => Math.max(0, ...(cs.S.equip.equip || []).filter((id) => id.startsWith('equip.' + fam + '.')).map((id) => +id.split('.')[2]));
// small dialogue queue shown in the story box: [{who, k}], then done()
function dlg(lines, done) { dq = { lines, i: -1, done }; dlgNext(); }
function dlgNext() { const d = dq; d.i++; const l = d.lines[d.i]; const box = $('story');
  if (!l) { box.hidden = true; dq = null; d.done && d.done(); return; }
  box.hidden = false; box.classList.remove('black'); $('sWho').textContent = l.who ? (l.raw ? l.who : t(l.who)) : ''; $('sText').textContent = t(l.k); $('sNext').textContent = t('tu_next'); speak(t(l.k), l.who || 'guest'); }
function startInterview(n) {
  ivNpc = n; ivOn = true; G.asking = true;
  if (!store.get('story4_done', false)) dlg([{ who: 'sn_me', k: 's4a' }, { who: t(n.name), raw: true, k: 's4b' }, { k: 's4c' }], openIv); else openIv();
}
function openIv() {
  const cam = Math.max(1, gearLv('cam')); ivZoneW = Math.min(0.6, 0.2 + cam * 0.028); ivZoneW = Math.min(0.7, ivZoneW + skills.steady * 0.02); ivSpeed = Math.max(0.6, 1.9 - cam * 0.08 - skills.steady * 0.1); ivStep = 0; ivHits = 0; ivT = Math.random() * 6;
  $('ivZone').style.width = (ivZoneW * 100) + '%'; $('ivHint').textContent = t('iv_keep'); $('ivQ').textContent = t('iq1'); ivStat(); $('iv').hidden = false;
}
function ivStat() { const mic = Math.max(1, gearLv('mic')); $('ivStat').textContent = t('iv_q') + ': ' + Math.round((ivHits / 3) * 100) + '%  ·  ' + t('iv_noise') + ': ' + Math.max(0, 70 - mic * 5) + '%'; }
function ivTick(dt) { if ($('iv').hidden) return; ivT += dt * ivSpeed; ivPos = 0.5 + Math.sin(ivT) * 0.36 + Math.sin(ivT * 2.7) * 0.1; $('ivDot').style.left = (Math.min(0.97, Math.max(0.03, ivPos)) * 100) + '%'; }
$('ivGo').onclick = () => {
  if ($('iv').hidden) return; const hit = Math.abs(ivPos - 0.5) < ivZoneW / 2; if (hit) { ivHits++; sfx.good(); } else sfx.bad();
  ivStep++; $('ivQ').textContent = (hit ? '✅ ' : '📉 ') + t(ivNpc.name) + ': ' + t('ia' + ivStep); ivStat();
  if (ivStep >= 3) { $('ivGo').disabled = true; setTimeout(finishIv, 1400); } else setTimeout(() => { if (!$('iv').hidden) $('ivQ').textContent = t('iq' + (ivStep + 1)); }, 1300);
};
// police chase: an interview filmed without licence 1 brings an officer; reach the studio (or outrun him) to keep the clip
const chase = { on: false, t: 0, mark: 0 };
function startChase() {
  chase.on = true; chase.t = 25; chase.mark = 25; const Z = ZONES.street, dir = G.px > Z.ox ? -1 : 1;
  cop.g.position.set(Math.max(Z.ox + Z.bx[0], Math.min(Z.ox + Z.bx[1], G.px + dir * 13)), 0, G.pz); cop.g.visible = true; sfx.bad(); buzz(200); say('🚓 ' + t('pol_run'), 'warn', true);
}
function endChase(caught) {
  chase.on = false; cop.g.visible = false;
  if (!caught) { sfx.win(); say('✅ ' + t('pol_safe'), 'ok', true); return; }
  const fine = Math.min(G.coins, 30 + Math.round(G.coins * 0.1)); addCoins(-fine); const list = store.get('interviews', []); for (let i = list.length - 1; i >= 0; i--) if (!list[i].clip) { list.splice(i, 1); break; } store.set('interviews', list);
  sfx.lose(); buzz([120, 60, 120]); say('🚓 ' + t('pol_fine') + (fine ? ' · 🪙 -' + fine : ''), 'warn', true);
}
function chaseTick(dt, tt) {
  if (!chase.on) return; if (G.zone !== 'street') return endChase(false); chase.t -= dt; if (chase.t <= 0) return endChase(false);
  const p = cop.g.position, dx = G.px - p.x, dz = G.pz - p.z, d = Math.hypot(dx, dz); if (d < 0.9) return endChase(true);
  p.x += (dx / d) * 3.5 * dt; p.z += (dz / d) * 3.5 * dt; RECTS.street.forEach(([a, b, c, e]) => { const k = 0.3; if (p.x > a - k && p.x < b + k && p.z > c - k && p.z < e + k) { const l = p.x - (a - k), r = b + k - p.x, u = p.z - (c - k), w = e + k - p.z, mn = Math.min(l, r, u, w); if (mn === u || mn === w) { p.z = mn === u ? c - k : e + k; p.x += Math.sign(dx || 1) * 3.5 * dt; } else { p.x = mn === l ? a - k : b + k; p.z += Math.sign(dz || 1) * 3.5 * dt; } } }); cop.g.rotation.y = Math.atan2(dx, dz); const sw = Math.sin(tt * 12) * 0.8; cop.legL.rotation.x = sw; cop.legR.rotation.x = -sw; cop.armL.rotation.x = -sw * 0.8; cop.armR.rotation.x = sw * 0.8;
  copLamp.material.color.set(Math.floor(tt * 6) % 2 ? 0xff2a40 : 0x2a6bff); copLamp.material.emissive.copy(copLamp.material.color);
  if (chase.t < chase.mark - 5) { chase.mark -= 5; say('🚓 ' + Math.ceil(chase.t) + ' · ' + t('pol_run'), 'warn', true); }
}
function finishIv() {
  $('ivGo').disabled = false; $('iv').hidden = true; const mic = Math.max(1, gearLv('mic'));
  const q = Math.round(Math.min(100, (ivHits / 3) * 70 + (ivHits ? Math.min(30, (gearLv('cam') + mic) * 1.0) : 0)));
  // XP follows performance: nothing for a fully missed shoot, and the story only moves on after a usable first interview (2+ good answers)
  const first = !store.get('story4_done', false), okFirst = first && ivHits >= 2;
  const xp = Math.round((ivHits === 0 ? 0 : first ? ivHits * 5 : ivHits + Math.round(q / 25)) * (1 + skills.learn * 0.05));
  if (ivHits > 0) { const list = store.get('interviews', []); list.push({ q, at: Date.now(), who: ivNpc.name }); store.set('interviews', list.slice(-30)); stats.ivs = (stats.ivs || 0) + 1; store.set('stats', stats); }
  const up = xp > 0 && shop.addXp(xp); showLevel();
  const end = () => { ivOn = false; G.asking = false; const fail = ivHits === 0 || (first && !okFirst);
    say((fail ? '📉 ' + t('iv_keep') + ' · ' : '') + (ivHits ? t('iv_saved').replace('{q}', q) + ' · ' : '') + '+' + xp + ' ' + t('xp') + (up ? '  ⭐ ' + t('level_up') : ''), fail ? 'warn' : 'ok', true); if (!first && ivHits > 0 && licence < 1) setTimeout(startChase, 1800); };
  if (okFirst) { store.set('story4_done', true); dlg([{ who: 'sn_me', k: 's4d' }, { who: 'sn_saleh', k: 's4e' }].concat(xp === 15 ? [{ k: 's4f' }] : []), end); } else end();
}

// ───────── father's broken office PC: the player diagnoses it, buys the parts in the store and installs them ─────────
const PCX = -5.7, PCZ = 3.6;
const pcScreenM = new THREE.MeshBasicMaterial({ color: 0x0a0a10, toneMapped: false }); const pcUp = {};
{ const g = new THREE.Group(); g.position.set(PCX, 0, PCZ); g.rotation.y = Math.PI / 2; ZG.studio.add(g);
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.8 }), grey = new THREE.MeshStandardMaterial({ color: 0xcfc9b8, roughness: 0.7 }), dark = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.6 });
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  add(new THREE.BoxGeometry(1.5, 0.07, 0.75), wood, 0, 0.78, 0); [[-0.68, -0.3], [0.68, -0.3], [-0.68, 0.3], [0.68, 0.3]].forEach(([x, z]) => add(new THREE.BoxGeometry(0.07, 0.78, 0.07), wood, x, 0.39, z));
  add(new THREE.BoxGeometry(0.62, 0.46, 0.4), grey, -0.1, 1.1, -0.1); add(new THREE.BoxGeometry(0.3, 0.08, 0.28), grey, -0.1, 0.84, -0.1);
  const scr = add(new THREE.PlaneGeometry(0.5, 0.36), pcScreenM, -0.1, 1.11, 0.105); scr.castShadow = false;
  add(new THREE.BoxGeometry(0.22, 0.5, 0.5), grey, 0.5, 1.06, -0.05); add(new THREE.BoxGeometry(0.5, 0.03, 0.18), dark, -0.12, 0.83, 0.24);
  pcUp.mon = add(new THREE.BoxGeometry(0.5, 0.34, 0.04), dark, -0.62, 1.1, 0.0); pcUp.scr = add(new THREE.PlaneGeometry(0.44, 0.28), new THREE.MeshBasicMaterial({ color: 0x2f7bff, toneMapped: false }), -0.62, 1.1, 0.025); pcUp.rgb = add(new THREE.BoxGeometry(1.5, 0.03, 0.03), new THREE.MeshBasicMaterial({ color: 0xff4fa8, toneMapped: false }), 0, 0.83, 0.36);
  [pcUp.mon, pcUp.scr, pcUp.rgb].forEach((o) => { o.castShadow = false; });
  COLL.studio.push([PCX, PCZ, 0.75]); }
const deskTrim = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.05, 0.06), new THREE.MeshBasicMaterial({ color: 0xd4af37, toneMapped: false })); deskTrim.position.set(DESK.x, 1.02, DESK.z + 0.62); ZG.studio.add(deskTrim);
function applyUpg() { pcUp.mon.visible = pcUp.scr.visible = upg.pc >= 1 && pcS.fixed; pcUp.rgb.visible = upg.pc >= 2 && pcS.fixed; deskTrim.visible = upg.desk >= 1 && !ruin.visible; deskTrim.material.color.set(upg.desk >= 2 ? 0x7fe9ff : 0xd4af37); }
const PC_ALL = ['psu', 'board', 'ram', 'disk', 'fan'], PC_BAD = ['psu', 'ram', 'fan'], PC_ICON = { psu: '🔌', board: '🟩', ram: '🧠', disk: '💽', fan: '🌀' };
const pcS = store.get('pc', { seen: false, checked: {}, installed: {}, gift: false, fixed: false });
const pcSave = () => store.set('pc', pcS);
// straight from the store to the PC once every needed part is bought
function pcFromStore() { cs.closeSheet(); storeFrom = 'menu'; storePause = false; if (G.on) return; if (G.zone !== 'studio') enterZone('studio', PCX + 1.15, PCZ, -Math.PI / 2); else { G.px = PCX + 1.15; G.pz = PCZ; G.face = -Math.PI / 2; } show('hud'); resize(); syncScene(); snapCam = true; pcOpen(); }
cs.setNeeds(() => (pcS.gift && !pcS.fixed ? PC_BAD.filter((k) => !pcS.installed[k]) : []), () => { sfx.click(); pcFromStore(); });
const pcLit = () => { pcScreenM.color.set(pcS.fixed ? 0x2f7bff : 0x0a0a10); try { applyUpg(); } catch (_) {} };
pcLit();
let storeFrom = 'menu', storePause = false;
// store button inside play: opens the store any time; a running broadcast is paused while shopping
$('hudStore').onclick = () => { if (!UNLOCK.bStore()) { sfx.bad(); gToast(t('locked_hint')); return; } if (storyOn || ivOn || G.asking) return; sfx.click(); storeFrom = 'hud'; storePause = G.on; cs.closeSheet(); cs.render(); $('storeS').hidden = false; $('hud').hidden = true; };
function pcOpen() { G.asking = true; pcBuild(); $('pc').hidden = false; }
function pcClose() { $('pc').hidden = true; G.asking = false; panelMode = null; }
let panelMode = null; function openPanel(k) { sfx.click(); panelMode = k; pcOpen(); }
function pcBuild() {
  if (panelMode === 'edit' && ed) return edBuild();
  if (panelMode === 'cafe') return cafeBuild();
  if (panelMode === 'gym') return gymBuild(); if (panelMode === 'designer') return designBuild();
  if (pcS.fixed) return pcTab === 'skills' ? skBuild() : pcTab === 'lab' ? labBuild() : pcTab === 'up' ? upBuild() : pubBuild();
  $('pcTitle').textContent = '🖥️ ' + t('pc_title'); const L = $('pcList'); L.innerHTML = '';
  PC_ALL.forEach((k) => {
    const row = document.createElement('div'); row.className = 'pcrow'; const bad = PC_BAD.includes(k), chk = pcS.checked[k], inst = pcS.installed[k];
    const mk = (cls, txt) => { const e = document.createElement('span'); e.className = cls; e.textContent = txt; row.appendChild(e); return e; };
    const btn = (txt, fn) => { const b = document.createElement('button'); b.className = 'big'; b.textContent = txt; b.onclick = fn; row.appendChild(b); };
    mk('ic', PC_ICON[k]); mk('nm', t('p_' + k));
    if (!chk) btn(t('pc_check'), () => { pcS.checked[k] = true; pcSave(); bad ? sfx.bad() : sfx.good(); pcBuild(); pcAfterCheck(); });
    else if (!bad) mk('st ok', '✅ ' + t('pc_ok'));
    else if (inst) mk('st ok', '✅ ' + t('pc_installed'));
    else if (cs.partId(k)) { mk('st bad', '❌ ' + t('pc_bad')); btn(t('pc_install'), () => { if (cs.usePart(k)) { pcS.installed[k] = true; pcSave(); sfx.fix(); pcBuild(); pcAfterInstall(); } }); }
    else mk('st bad', '❌ ' + t('pc_bad') + ' · ' + t('pc_need'));
    L.appendChild(row);
  });
  $('pcStore').hidden = !PC_ALL.every((k) => pcS.checked[k]) || pcS.fixed || cs.needsReady(); $('pcStore').textContent = '🛍️ ' + t('pc_store');
}
// ───────── publishing: once the computer works, interviews are posted to the in-game platforms for followers and coins ─────────
const PLAT = { shoofni: { ic: '📺', fans: 1, coin: 0.25 }, laqta: { ic: '🎬', fans: 1.5, coin: 0.12 }, sada: { ic: '💬', fans: 0.6, coin: 0.08 } };
const fans = store.get('fans', { shoofni: 0, laqta: 0, sada: 0 });
const platName = (k) => ADS.WORLD[k][lang === 'ar' ? 'ar' : 'en'];
function pubBuild() {
  $('pcTitle').textContent = '🖥️ ' + t('pub_title'); $('pcStore').hidden = true; const L = $('pcList'); L.innerHTML = ''; pcTabs(L);
  const head = document.createElement('div'); head.className = 'pubhead';
  Object.keys(PLAT).forEach((k) => { const c = document.createElement('div'); c.innerHTML = '<i>' + PLAT[k].ic + '</i><b></b><span></span>'; c.querySelector('b').textContent = platName(k); c.querySelector('span').textContent = '👥 ' + fans[k] + ' ' + t('pub_fans'); head.appendChild(c); });
  L.appendChild(head);
  // followers pay a small income once a day
  { const tot = fans.shoofni + fans.laqta + fans.sada, day = new Date().toISOString().slice(0, 10), paid = store.get('fan_pay', '') === day, n = Math.floor(tot / 2);
    const b = document.createElement('button'); b.className = paid || n < 1 ? 'ghost pubpay' : 'big pubpay'; b.disabled = paid || n < 1; b.textContent = '💰 ' + t('pub_income') + (paid ? ' ✅' : ' · 🪙 +' + n);
    b.onclick = () => { store.set('fan_pay', day); addCoins(n); sfx.win(); gToast('💰 🪙 +' + n); pubBuild(); }; L.appendChild(b); }
  const list = store.get('interviews', []);
  if (!list.length) { const e = document.createElement('p'); e.className = 'pubempty'; e.textContent = '🎤 ' + t('pub_empty'); L.appendChild(e); return; }
  list.slice().reverse().forEach((iv) => {
    const row = document.createElement('div'); row.className = 'pcrow'; const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = (iv.clip ? '🎥 ' + t('pub_clip') : '🎤 ' + (iv.who ? t(iv.who) || iv.who : '')) + ' · ' + t('pub_q') + ' ' + Math.round(iv.q) + '%'; row.appendChild(nm);
    if (!iv.cut && !(iv.pub && Object.keys(iv.pub).length)) { const e = document.createElement('button'); e.className = 'ghost'; e.textContent = '✂️'; e.onclick = () => { sfx.click(); edOpen(iv, list); }; row.appendChild(e); }
    Object.keys(PLAT).forEach((k) => { const b = document.createElement('button'); const done = iv.pub && iv.pub[k]; b.className = done ? 'ghost' : 'big'; b.textContent = done ? '✅' : PLAT[k].ic; b.disabled = !!done;
      b.onclick = () => { const f = Math.max(1, Math.round((iv.q / 10) * PLAT[k].fans * (1 + skills.charm * 0.1) * (1 + upg.pc * 0.2))), c = Math.max(1, Math.round(iv.q * PLAT[k].coin * (1 + skills.deals * 0.04) * (1 + upg.pc * 0.2))); iv.pub = { ...(iv.pub || {}), [k]: true }; store.set('interviews', list);
        fans[k] += f; store.set('fans', fans); addCoins(c); const up = shop.addXp(2); showLevel(); sfx.good(); gToast(PLAT[k].ic + ' ' + platName(k) + ' · 👥 +' + f + ' · 🪙 +' + c); if (up) say('⭐ ' + t('level_up'), 'ok', true); pubBuild(); };
      row.appendChild(b); });
    L.appendChild(row);
  });
}
// tabs on the working computer: publishing | skill tree
let pcTab = 'pub';
function pcTabs(L) { const w = document.createElement('div'); w.className = 'pctabs'; [['pub', '📡'], ['skills', '🌳'], ['lab', '🪪'], ['up', '🛠️']].forEach(([k, txt]) => { const b = document.createElement('button'); b.className = pcTab === k ? 'big' : 'ghost'; b.textContent = txt; b.onclick = () => { sfx.click(); pcTab = k; pcBuild(); }; w.appendChild(b); }); L.appendChild(w); }
// skill tree: 5 stages per skill, stage n costs n points; points come from levels, filmed interviews and challenge wins
const SKILLS = { steady: ['🎥', (n) => '🎯 +' + n * 8 + '%'], charm: ['✨', (n) => '👥 +' + n * 10 + '%'], deals: ['🤝', (n) => '🪙 +' + n * 4 + '%'], learn: ['📚', (n) => '⭐ +' + n * 5 + '%'] };
const skEarned = () => (shop.level - 1) * 2 + (stats.wins || 0) + (stats.ivs || 0);
const skSpent = () => Object.keys(SKILLS).reduce((a, k) => a + (skills[k] * (skills[k] + 1)) / 2, 0);
function skBuild() {
  $('pcTitle').textContent = '🖥️ ' + t('sk_title'); $('pcStore').hidden = true; const L = $('pcList'); L.innerHTML = ''; pcTabs(L); const free = skEarned() - skSpent();
  const p = document.createElement('p'); p.className = 'skpts'; p.textContent = '🔹 ' + t('sk_pts') + ': ' + free; L.appendChild(p);
  Object.keys(SKILLS).forEach((k) => { const lv = skills[k], row = document.createElement('div'); row.className = 'pcrow';
    row.innerHTML = '<span class="ic"></span><span class="nm"><b></b><small></small></span>'; row.children[0].textContent = SKILLS[k][0]; row.querySelector('b').textContent = t('sk_' + k); row.querySelector('small').textContent = '●'.repeat(lv) + '○'.repeat(5 - lv) + '  ' + SKILLS[k][1](lv);
    const b = document.createElement('button'); if (lv >= 5) { b.className = 'ghost'; b.textContent = '✅'; b.disabled = true; } else { const cost = lv + 1; b.className = free >= cost ? 'big' : 'ghost'; b.disabled = free < cost; b.textContent = '⬆ 🔹' + cost;
      b.onclick = () => { skills[k]++; store.set('skills', skills); sfx.win(); gToast(SKILLS[k][0] + ' ' + t('sk_' + k) + ' ' + SKILLS[k][1](skills[k])); skBuild(); }; }
    row.appendChild(b); L.appendChild(row); });
  const h = document.createElement('p'); h.className = 'pubempty'; h.textContent = 'ℹ️ ' + t('sk_hint'); L.appendChild(h);
}
// StudioLab: three licence tiers, bought in order; each needs followers and coins and raises ad income from broadcasts
function labBuild() {
  $('pcTitle').textContent = '🪪 StudioLab'; $('pcStore').hidden = true; const L = $('pcList'); L.innerHTML = ''; pcTabs(L); const tot = fans.shoofni + fans.laqta + fans.sada;
  const p = document.createElement('p'); p.className = 'skpts'; p.textContent = '👥 ' + tot + ' ' + t('pub_fans') + '  ·  🪙 ' + G.coins; L.appendChild(p);
  [1, 2, 3].forEach((n) => { const c = LIC[n], row = document.createElement('div'); row.className = 'pcrow';
    row.innerHTML = '<span class="ic">🪪</span><span class="nm"><b></b><small></small></span>'; row.querySelector('b').textContent = t('lab_lic') + ' ' + n + ' · 📢 🪙 +' + c.ads + '%'; row.querySelector('small').textContent = t('lab_d' + n);
    const b = document.createElement('button'); if (licence >= n) { b.className = 'ghost'; b.textContent = '✅'; b.disabled = true; } else { const ok = licence === n - 1 && tot >= c.fans && G.coins >= c.coins; b.className = ok ? 'big' : 'ghost'; b.disabled = !ok; b.textContent = (licence < n - 1 ? '🔒 ' : '') + '👥 ' + c.fans + ' · 🪙 ' + c.coins;
      b.onclick = () => { addCoins(-c.coins); licence = n; store.set('licence', n); sfx.win(); gToast('🪪 ' + t('lab_lic') + ' ' + n + ' ✅'); labBuild(); }; }
    row.appendChild(b); L.appendChild(row); });
}
// gym: paid fitness training, 5 stages, each makes the player 6% faster (handy against the police)
function gymBuild() {
  $('pcTitle').textContent = '🏋️ ' + t('sh_gym'); $('pcStore').hidden = true; const L = $('pcList'); L.innerHTML = ''; const lv = fit.lv, row = document.createElement('div'); row.className = 'pcrow';
  const p = document.createElement('p'); p.className = 'skpts'; p.textContent = '🪙 ' + G.coins; L.appendChild(p);
  row.innerHTML = '<span class="ic">🏃</span><span class="nm"><b></b><small></small></span>'; row.querySelector('b').textContent = '⚡ +' + lv * 6 + '%'; row.querySelector('small').textContent = '●'.repeat(lv) + '○'.repeat(5 - lv);
  const b = document.createElement('button'); if (lv >= 5) { b.className = 'ghost'; b.textContent = '✅'; b.disabled = true; } else { const cost = 150 * (lv + 1); b.className = G.coins >= cost ? 'big' : 'ghost'; b.disabled = G.coins < cost; b.textContent = '⬆ 🪙 ' + cost;
    b.onclick = () => { addCoins(-cost); fit.lv++; store.set('fit', fit.lv); sfx.win(); gToast('🏃 ⚡ +' + fit.lv * 6 + '%'); gymBuild(); }; }
  row.appendChild(b); L.appendChild(row);
}
// café: one coffee = +5 trust at the start of the next broadcast (one cup at a time)
function cafeBuild() {
  $('pcTitle').textContent = '☕ ' + t('sh_cafe'); $('pcStore').hidden = true; const L = $('pcList'); L.innerHTML = ''; const row = document.createElement('div'); row.className = 'pcrow';
  const p = document.createElement('p'); p.className = 'skpts'; p.textContent = '🪙 ' + G.coins; L.appendChild(p);
  row.innerHTML = '<span class="ic">☕</span><span class="nm"><b></b><small></small></span>'; row.querySelector('b').textContent = '🔴 📈 +5'; row.querySelector('small').textContent = cafe.on ? '●' : '○';
  const b = document.createElement('button'); if (cafe.on) { b.className = 'ghost'; b.textContent = '✅'; b.disabled = true; } else { b.className = G.coins >= 25 ? 'big' : 'ghost'; b.disabled = G.coins < 25; b.textContent = '🪙 25';
    b.onclick = () => { addCoins(-25); cafe.on = true; store.set('coffee', true); sfx.good(); gToast('☕ 📈 +5'); cafeBuild(); }; }
  row.appendChild(b); L.appendChild(row);
}
// fashion designer: an expensive one-time fee unlocks a custom studio uniform — pick the top and bottom colours for the whole team
const DESIGN_FEE = 1500;
function designBuild() {
  $('pcTitle').textContent = '✂️ ' + t('sh_designer'); $('pcStore').hidden = true; const L = $('pcList'); L.innerHTML = '';
  const p = document.createElement('p'); p.className = 'skpts'; p.textContent = '🪙 ' + G.coins; L.appendChild(p);
  if (!design.on) { const b = document.createElement('button'); b.className = G.coins >= DESIGN_FEE ? 'big pubpay' : 'ghost pubpay'; b.disabled = G.coins < DESIGN_FEE; b.textContent = '✂️ 👔 🪙 ' + DESIGN_FEE;
    b.onclick = () => { addCoins(-DESIGN_FEE); design.on = true; store.set('design', design); sfx.win(); designBuild(); }; L.appendChild(b); return; }
  [['👕', 'top', 'topColor'], ['👖', 'bot', 'bottomColor']].forEach(([ic, k, uk]) => { const row = document.createElement('div'); row.className = 'pcrow swrow'; const i = document.createElement('span'); i.className = 'ic'; i.textContent = ic; row.appendChild(i);
    OPT.cloth.forEach((c, n) => { const s = document.createElement('button'); s.className = 'sw' + (design[k] === n ? ' on' : ''); s.style.background = '#' + new THREE.Color(c).getHexString(); s.onclick = () => { design[k] = n; UNI[uk] = n; store.set('design', design); sfx.click(); rebuildPlayer(); Object.keys(STAFF).forEach(restyle); designBuild(); }; row.appendChild(s); });
    L.appendChild(row); });
}
// upgrades tab: studio expansion (needs a licence, adds furniture/decor slots), computer (publishing reach), anchor desk (starting trust)
const UPG = { room: { ic: '🏗️', cost: [3000, 8000], lic: [1, 2], fx: (n) => '🛋️ +' + n + ' · 🪴 +' + n }, pc: { ic: '🖥️', cost: [800, 2500], fx: (n) => '👥 🪙 +' + n * 20 + '%' }, desk: { ic: '🎙️', cost: [600, 2000], fx: (n) => '📈 +' + n * 3 } };
function upBuild() {
  $('pcTitle').textContent = '🛠️ ' + t('up_room'); $('pcStore').hidden = true; const L = $('pcList'); L.innerHTML = ''; pcTabs(L);
  const p = document.createElement('p'); p.className = 'skpts'; p.textContent = '🪙 ' + G.coins; L.appendChild(p);
  Object.keys(UPG).forEach((k) => { const U = UPG[k], lv = upg[k], row = document.createElement('div'); row.className = 'pcrow';
    row.innerHTML = '<span class="ic"></span><span class="nm"><b></b><small></small></span>'; row.children[0].textContent = U.ic; row.querySelector('b').textContent = t('up_' + k); row.querySelector('small').textContent = '●'.repeat(lv) + '○'.repeat(2 - lv) + '  ' + U.fx(lv);
    const b = document.createElement('button'); if (lv >= 2) { b.className = 'ghost'; b.textContent = '✅'; b.disabled = true; } else { const cost = U.cost[lv], need = U.lic ? U.lic[lv] : 0, ok = G.coins >= cost && licence >= need; b.className = ok ? 'big' : 'ghost'; b.disabled = !ok; b.textContent = (licence < need ? '🔒 🪪' + need + ' · ' : '⬆ ') + '🪙 ' + cost;
      b.onclick = () => { addCoins(-cost); upg[k]++; store.set('upg', upg); applySlots(); applyUpg(); sfx.win(); gToast(U.ic + ' ' + t('up_' + k) + ' · ' + U.fx(upg[k])); upBuild(); }; }
    row.appendChild(b); L.appendChild(row); });
}
// easy editor: five shots per clip, tap the bad ones away and save — each right cut adds quality, each wrong cut costs some
const ED_GOOD = ['🎯', '😀', '🎤', '👍', '✨'], ED_BAD = ['😵', '🤧', '📉', '🫨', '🙈']; let ed = null;
function edOpen(iv, list) { const shots = []; let bad = 0; for (let i = 0; i < 5; i++) { const b = Math.random() < 0.45 && bad < 3; if (b) bad++; shots.push({ b, cut: false, ic: (b ? ED_BAD : ED_GOOD)[Math.floor(Math.random() * 5)] }); } if (!bad) { shots[2].b = true; shots[2].ic = ED_BAD[0]; } ed = { iv, list, shots }; panelMode = 'edit'; pcBuild(); }
function edBuild() {
  $('pcTitle').textContent = '✂️ ' + t('ed_title'); $('pcStore').hidden = true; const L = $('pcList'); L.innerHTML = '';
  const h = document.createElement('p'); h.className = 'pubempty'; h.textContent = t('ed_hint'); L.appendChild(h);
  const row = document.createElement('div'); row.className = 'edrow'; ed.shots.forEach((s) => { const b = document.createElement('button'); b.className = 'edshot' + (s.cut ? ' cut' : ''); b.textContent = s.ic; b.onclick = () => { s.cut = !s.cut; sfx.click(); edBuild(); }; row.appendChild(b); }); L.appendChild(row);
  const sv = document.createElement('button'); sv.className = 'big pubpay'; sv.textContent = '💾 ' + t('ed_save');
  sv.onclick = () => { let d = 0; ed.shots.forEach((s) => { if (s.cut) d += s.b ? 5 + Math.floor(gearLv('edit') / 3) : -5; }); const q0 = ed.iv.q; ed.iv.q = Math.max(1, Math.min(100, q0 + d)); ed.iv.cut = true; store.set('interviews', ed.list); (d > 0 ? sfx.win : sfx.bad)(); gToast('✂️ ' + t('pub_q') + ' ' + Math.round(q0) + '% ➜ ' + Math.round(ed.iv.q) + '%'); ed = null; panelMode = null; pcBuild(); };
  L.appendChild(sv);
}
// once everything is diagnosed, Uncle Saleh hands over exactly the price of the broken parts (level 1 each)
function pcAfterCheck() {
  if (pcS.gift || !PC_ALL.every((k) => pcS.checked[k])) return;
  pcS.gift = true; pcSave(); const n = Math.round(tokenPrice(1) * PC_BAD.length * 1e7) / 1e7; cs.give(n);
  $('pc').hidden = true; dlg([{ who: 'sn_saleh', k: 'pc_gift' }], () => { gToast('💠 +' + n); sfx.win(); pcBuild(); $('pc').hidden = false; });
}
function pcAfterInstall() {
  if (pcS.fixed || !PC_BAD.every((k) => pcS.installed[k])) return;
  pcS.fixed = true; pcSave(); pcLit(); $('pc').hidden = true; const up = shop.addXp(20); showLevel(); sfx.win();
  dlg([{ k: 'pc_boot' }, { k: 'pc_done' }], () => { G.asking = false; if (up) say('⭐ ' + t('level_up'), 'ok', true); });
}
$('pcClose').onclick = () => { sfx.click(); pcClose(); };
$('pcStore').onclick = () => { sfx.click(); $('pc').hidden = true; G.asking = false; storeFrom = 'hud'; cs.setCat('parts'); cs.closeSheet(); cs.render(); show('storeS'); };
interact('studio', PCX + 1.15, PCZ, 1.25, 'a_pc', '🖥️', () => roam() && !storyOn && !ivOn, () => {
  if (pcS.fixed) { sfx.click(); pcOpen(); return; }
  if (!pcS.seen) { pcS.seen = true; pcSave(); G.asking = true; dlg([{ who: 'sn_me', k: 's5a' }, { who: 'sn_saleh', k: 's5b' }], pcOpen); } else pcOpen();
});

// ───────── simple start: features unlock step by step, with one clear objective on screen ─────────
const objKey = () => (!store.get('story_done', false) ? '' : !store.get('story4_done', false) ? 'obj_iv' : !pcS.fixed ? (cs.needsReady() ? 'obj_pc2' : 'obj_pc') : chDone === 0 ? 'obj_live' : fans.shoofni + fans.laqta + fans.sada === 0 ? 'obj_pub' : skSpent() === 0 && skEarned() > 0 ? 'obj_skill' : licence < 1 ? 'obj_lic' : upg.room < 1 ? 'obj_grow' : '');
const UNLOCK = { bStore: () => pcS.gift || pcS.fixed || cs.S.tokens > 0, bChar: () => shop.level >= 2, bProfile: () => store.get('story4_done', false) };
function applyLocks() { Object.entries(UNLOCK).forEach(([id, ok]) => { $(id).classList.toggle('locked', !ok()); }); }
setInterval(() => { const k = objKey(), el = $('objBar'); const on = !!k && !G.on && !storyOn && !ivOn && !$('hud').hidden && $('pc').hidden && $('story').hidden; el.hidden = !on; if (on) el.textContent = '🎯 ' + t(k); if (!$('menu').hidden) applyLocks(); $('hudStore').classList.toggle('locked', !UNLOCK.bStore()); $('hudStore').hidden = storyOn || ivOn; }, 500);

// ───────── wardrobe: one studio outfit for the whole crew, or a different outfit per person ─────────
const STAFF = { crew: { ch: crew, av: CREW_AV, post: null, ropts: { anim: 'Idle_TalkingPhone_Loop' } }, guest: { ch: guest, av: GUEST_AV, post: (c) => sit(c), ropts: { anim: 'Sitting_Idle_Loop' } } };
const looks = store.get('looks', { all: null, crew: null, guest: null });
function restyle(key) {
  const st = STAFF[key], fam = looks[key] || looks.all; const nav = wear(st.av, cs.ownedFams('skins').includes(fam) ? fam : null), n = makeChar(nav); if (st.post) st.post(n);
  const o = st.ch.g, par = o.parent; n.g.position.copy(o.position); n.g.rotation.copy(o.rotation); n.g.scale.copy(o.scale); n.g.visible = o.visible; par.remove(o); par.add(n.g); Object.assign(st.ch, n); register(st.ch, nav, st.ropts);
}
let drKey = 'crew';
function drBuild() {
  $('drTitle').textContent = '👔 ' + t('dr_title'); const L = $('drList'); L.innerHTML = ''; const fams = cs.ownedFams('skins').filter((f) => OUTFIT[f]); const cur = looks[drKey] || looks.all;
  const add = (icon, name, fam) => { const b = document.createElement('button'); b.className = 'ghost' + ((fam || null) === (cur || null) ? ' sel' : ''); b.innerHTML = '<span></span><b></b>'; b.children[0].textContent = icon; b.children[1].textContent = name;
    b.onclick = () => { sfx.click(); if ($('drAll').checked) { looks.all = fam; looks.crew = null; looks.guest = null; Object.keys(STAFF).forEach(restyle); } else { looks[drKey] = fam; if (!fam && looks.all) looks[drKey] = null; restyle(drKey); } store.set('looks', looks); drBuild(); }; L.appendChild(b); };
  add('👕', t('dr_plain'), null); fams.forEach((f) => { const i = cs.famInfo('skins', f); add(i.icon, i.name, f); });
  if (!fams.length) { const p = document.createElement('p'); p.textContent = t('dr_none'); L.appendChild(p); }
  $('drAllT').textContent = t('dr_all'); $('drStore').textContent = '🛍️ ' + t('pc_store');
}
function drOpen(key) { drKey = key; G.asking = true; $('drAll').checked = false; drBuild(); $('dress').hidden = false; }
$('drClose').onclick = () => { sfx.click(); $('dress').hidden = true; G.asking = false; };
$('drStore').onclick = () => { if (!UNLOCK.bStore()) { sfx.bad(); gToast(t('locked_hint')); return; } sfx.click(); $('dress').hidden = true; G.asking = false; storeFrom = 'hud'; cs.setCat('skins'); cs.closeSheet(); cs.render(); show('storeS'); };
interact('studio', 5.5, -1.75, 1.1, 'a_dress', '👔', () => roam() && !storyOn && !ivOn, () => drOpen('crew'));
interact('studio', IV.x + 0.95, IV.z + 1.25, 1.1, 'a_dress', '👔', () => roam() && !storyOn && !ivOn, () => drOpen('guest'));
Object.keys(STAFF).forEach((k) => { if (looks[k] || looks.all) restyle(k); });
rebuildPlayer();

// ───────── studio customisation: equipped furniture, decor and set cards change the room itself ─────────
const roomG = new THREE.Group(); ZG.studio.add(roomG); let roomSpin = [];
const R_SLOTS = {
  floor: [[-5.3, 0, -0.9, Math.PI / 2], [3.4, 0, 4.0, Math.PI], [-2.8, 0, 4.1, Math.PI], [0.4, 0, 4.2, Math.PI], [5.6, 0, 0.9, -Math.PI / 2]], wall: [[-7.1, 2.9, -2.6, Math.PI / 2], [-7.1, 2.9, -0.6, Math.PI / 2], [7.05, 2.9, 1.2, -Math.PI / 2], [7.05, 2.9, -0.8, -Math.PI / 2], [-7.1, 2.9, 3.4, Math.PI / 2]],
  deco: [[-6.3, 0, -3.2, 0], [4.6, 0, 4.3, 0], [-4.3, 0, 4.5, 0], [1.9, 0, 4.4, 0], [-6.3, 0, 4.4, 0]], hang: [[-2.5, 4.7, 1.0, 0], [2.5, 4.7, 1.0, 0], [0, 4.7, 3.2, 0], [-4.5, 4.7, 3.0, 0], [4.5, 4.7, 3.0, 0]],
};
function applyRoom() {
  roomG.clear(); roomSpin = []; const used = { floor: 0, wall: 0, deco: 0, hang: 0 };
  ['furniture', 'decor'].forEach((cat) => (cs.S.equip[cat] || []).forEach((id) => { const [, fam, lv] = id.split('.'), kind = ROOM.KIND[fam]; if (!kind) return; const sl = R_SLOTS[kind][used[kind]++]; if (!sl) return;
    const g = ROOM.buildProp(fam, +lv); g.position.set(sl[0], sl[1], sl[2]); g.rotation.y = sl[3]; roomG.add(g); if (g.userData.spin) roomSpin.push(g.userData.spin); }));
  const setF = cs.equippedFam('sets'), wc = setF && ROOM.setWall(setF);
  WALLS.forEach((w, i) => w.material.color.set(wc ? wc : WALL_C[i])); backdrop.visible = !!wc; if (wc) { backdrop.material.map = ROOM.backdropTex(setF); backdrop.material.needsUpdate = true; }
  roomG.visible = !ruin.visible; applyStage(); applyUpg();
}
applyRoom();

// first-time guided tour: the camera flies to each part of the studio and explains it
const TOUR = [
  { p: [0.5, 3.4, 8.5], l: [0.5, 1.4, -1.5] }, { p: [DESK.x + 0.3, 2.2, DESK.z + 3.1], l: [DESK.x, 1.1, DESK.z] },
  { p: [1.5, 2.4, 4.4], l: [SHOTS[1].p[0], 1.4, SHOTS[1].p[2] + 0.5] }, { p: [CON.x + 0.6, 2.1, CON.z + 2.0], l: [CON.x, 1.1, CON.z] },
  { p: [IV.x - 0.5, 2.0, IV.z + 3.2], l: [IV.x, 1.0, IV.z] }, { p: [3.6, 2.2, 0.6], l: [5.5, 1.2, -2.9] },
  { p: [-4.3, 2.0, 2.2], l: [-6.98, 1.5, BRK.z] }, { p: [4.4, 2.0, 3.6], l: [7.1, 1.4, 3.4] },
  { p: [0, 3.0, 7.2], l: [0, 2.6, -2] }, { p: [5.0, 2.4, 1.6], l: [6.4, 0.9, -2.8] }, { p: [-1.5, 2.6, 6.5], l: [0, 1.4, 3.3] }, { p: [0.5, 3.4, 8.5], l: [0.5, 1.4, -1.5] },
];
let tourI = -1; const tourCam = { p: new THREE.Vector3(), l: new THREE.Vector3(), lt: new THREE.Vector3() };
function tourStep() {
  const st = TOUR[tourI]; $('tText').textContent = t('tu_' + (tourI + 1));
  $('tNext').textContent = tourI === TOUR.length - 1 ? t('tu_done') : t('tu_next');
  const d = $('tDots'); d.innerHTML = ''; TOUR.forEach((_, i) => { const e = document.createElement('i'); if (i === tourI) e.className = 'on'; d.appendChild(e); });
  tourCam.p.set(...st.p); tourCam.lt.set(...st.l); sfx.click(); speak && speak(t('tu_' + (tourI + 1)), 'host');
}
function startTour() { if (!G.light) { G.light = true; syncScene(); } tourI = 0; cam.position.set(...TOUR[0].p); tourCam.l.set(...TOUR[0].l); show('tour'); tourStep(); }
function endTour() { tourI = -1; store.set('tour_done', true); show('menu'); }
$('tNext').onclick = () => { if (tourI >= TOUR.length - 1) endTour(); else { tourI++; tourStep(); } };
$('tSkip').onclick = () => endTour();
// profile & settings
function buildProfile() {
  const n = $('pName'); n.value = store.get('name', '') || PiState.user || ''; n.placeholder = PiState.user || t('p_guest');
  $('pPi').textContent = PiState.user ? 'π ' + PiState.user + ' · ' + t('p_pi_on') : t('p_pi_off');
  const lv = shop.level, a = xpFor(lv), b = xpFor(Math.min(MAX_LEVEL, lv + 1));
  $('pLvl').textContent = '⭐ ' + t('lvl') + ' ' + lv + '   🪙 ' + G.coins; $('pXp').style.width = (lv >= MAX_LEVEL ? 100 : Math.round(((shop.xp - a) / (b - a)) * 100)) + '%';
  const owned = store.get('owned', []).length, excl = EXCLUSIVE.filter((id) => shop.has(id)).length;
  let since = ''; try { since = new Date(stats.since).toLocaleDateString(lang, { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { since = new Date(stats.since).toISOString().slice(0, 10); }
  const cells = [[stats.rounds, 'p_rounds'], [stats.wins, 'p_wins'], [stats.best + '%', 'p_best'], [owned, 'p_items'], [excl + '/' + EXCLUSIVE.length, 'p_excl'], [(dailyState.day || 0) + '/30', 'p_streak']];
  const g = $('pStats'); g.innerHTML = ''; cells.forEach(([v, k]) => { const d = document.createElement('div'); d.innerHTML = '<b></b><small></small>'; d.children[0].textContent = v; d.children[1].textContent = t(k); g.appendChild(d); });
  const sd = document.createElement('div'); sd.style.gridColumn = '1 / -1'; sd.innerHTML = '<small></small>'; sd.children[0].textContent = t('p_since') + ' ' + since; g.appendChild(sd);
}
$('pName').addEventListener('change', () => { const v = $('pName').value.replace(/[<>]/g, '').trim().slice(0, 16); $('pName').value = v; store.set('name', v); });
// features that need the hosting server: the buttons are in place, and for now they answer with a small "coming soon" note
function soonNote() { const n = $('soonNote'); n.textContent = '🚧 Coming Soon'; n.hidden = false; sfx.click(); clearTimeout(soonNote.h); soonNote.h = setTimeout(() => { n.hidden = true; }, 1800); }
function syncSoon() { document.querySelectorAll('button.soon').forEach((b) => { b.textContent = b.dataset.ic + ' ' + t(b.dataset.soon); b.onclick = soonNote; }); }
function buildSettings() {
  const rows = $('setRows'); rows.innerHTML = '';
  const row = (icon, label, val, fn) => { const b = document.createElement('button'); b.className = 'srow'; b.innerHTML = '<span></span><span></span>'; b.children[0].textContent = icon + ' ' + label; b.children[1].textContent = val; b.onclick = () => { fn(); sfx.click(); buildSettings(); }; rows.appendChild(b); };
  row(soundOn ? '🔊' : '🔇', t('sound'), t(soundOn ? 'on' : 'off'), () => { soundOn = !soundOn; store.set('sound', soundOn); if (!soundOn && window.speechSynthesis) speechSynthesis.cancel(); });
  row('🗣️', t('s_voice'), t(cfg.voice ? 'on' : 'off'), () => { cfg.voice = !cfg.voice; store.set('voice', cfg.voice); if (!cfg.voice && window.speechSynthesis) speechSynthesis.cancel(); });
  row('📳', t('s_vibe'), t(cfg.vibe ? 'on' : 'off'), () => { cfg.vibe = !cfg.vibe; store.set('vibe', cfg.vibe); buzz(80); });
  { const b = document.createElement('button'); b.className = 'srow'; b.innerHTML = '<span></span><span></span>'; b.children[0].textContent = '☁️ ' + t('sv_cloud'); b.children[1].textContent = '🔒 Coming Soon'; b.onclick = soonNote; rows.appendChild(b); }
  row('🧍', t('s_real'), t(cfg.real ? 'on' : 'off'), () => { cfg.real = !cfg.real; store.set('real', cfg.real); setRealEnabled(cfg.real); if (cfg.real) loadReal(); });
  row('🖥️', t('s_quality'), t(cfg.quality === 'low' ? 'q_low' : 'q_high'), () => { cfg.quality = cfg.quality === 'low' ? 'high' : 'low'; store.set('quality', cfg.quality); renderer.setPixelRatio(pixelRatio()); setupFX(); resize(); });
  $('setVer').textContent = t('s_version') + ' ' + VERSION; const r = $('bReset'); r.classList.remove('armed'); r.textContent = t('s_reset');
}
$('bReset').onclick = () => {
  const r = $('bReset');
  if (!r.classList.contains('armed')) { r.classList.add('armed'); r.textContent = t('s_reset_confirm'); sfx.bad(); return; }
  try { Object.keys(localStorage).filter((k) => k.startsWith('onair_') && k !== 'onair_lang').forEach((k) => localStorage.removeItem(k)); } catch (e) {}
  location.reload();
};
$('bProfile').onclick = () => { sfx.click(); buildProfile(); show('profile'); }; $('bProfBack').onclick = () => { $('pName').dispatchEvent(new Event('change')); show('menu'); };
$('bSettings').onclick = () => { sfx.click(); buildSettings(); show('settings'); }; $('bSetBack').onclick = () => show('menu');
$('bHome').onclick = () => { if (G.on) return; G.zone = 'studio'; syncScene(); show('menu'); };

/* ---------- loop ---------- */
let last = performance.now(), tt = 0, lastAct = 0;
function frameBody(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; tt += dt; const w = window.innerWidth, h = window.innerHeight;
  gold.rotation.y = tt * 0.7; guest.head.rotation.y = Math.sin(tt * 0.8) * 0.25; guest.armR.rotation.x = -0.5 + Math.sin(tt * 2) * 0.12;
  crew.g.rotation.y = Math.sin(tt * 1.1) * 0.9 - 0.6; crew.armL.rotation.x = -1.2 + Math.sin(tt * 3) * 0.3; crew.armR.rotation.x = -1.0 + Math.cos(tt * 3) * 0.3;
  crowd.forEach((c, i) => { c.g.position.y = Math.abs(Math.sin(tt * 3 + i * 1.3)) * 0.12; c.armL.rotation.x = c.armR.rotation.x = -2.7 + Math.sin(tt * 6 + i) * 0.3; });
  trophy.rotation.y = tt * 0.5; if (G.zone === 'studio') atmos(dt, tt); updateSign(tt); ivTick(dt); chaseTick(dt, tt); if (G.zone === 'street') trafficTick(dt); if (G.zone === 'street') { const L = NPCS.filter((n) => n.zone === 'street').map((n) => [Math.hypot(n.ch.g.position.x - G.px, n.ch.g.position.z - G.pz), n]).sort((p, q) => p[0] - q[0]); L.forEach(([d, n], i) => { n.ch.g.visible = i < 4 && d < 32; }); } roomSpin.forEach((b) => { b.rotation.y += dt * 0.8; });
  NPCS.forEach((n, i) => { const d = Math.hypot(G.px - n.x, G.pz - n.z); const want = d < 3.5 && n.zone === G.zone ? Math.atan2(G.px - n.x, G.pz - n.z) : n.face; let dr = want - n.ch.g.rotation.y; while (dr > Math.PI) dr -= 6.283; while (dr < -Math.PI) dr += 6.283; n.ch.g.rotation.y += dr * Math.min(1, dt * 5); n.ch.armR.rotation.x = Math.sin(tt * 1.5 + i) * 0.12; n.ch.head.rotation.x = Math.sin(tt * 1.1 + i * 2) * 0.05; });
  IT.forEach((it, i) => { it.ring.visible = it.zone === G.zone && it.cond(); it.ring.material.opacity = 0.25 + Math.sin(tt * 3 + i) * 0.12; });
  confetti.forEach((c) => { if (c.m.visible && c.m.position.y > c.ty) { c.m.position.y = Math.max(c.ty, c.m.position.y - c.vy * dt); c.m.rotation.x += dt * 6; c.m.rotation.z += dt * 4; if (c.m.position.y === c.ty) c.m.rotation.set(-Math.PI / 2, 0, c.m.rotation.z); } });

  const playing = !$('hud').hidden, creating = !$('creator').hidden;
  if (playing) {
    if (G.on) {
      const wasSeg = seg(); if (!storePause) G.time += dt;
      if (wasSeg === 0 && seg() === 1) { G.grace = 8; G.next = Math.max(G.next, G.time + 9); sfx.seg(); say(t('sp_seg2')); syncScene(); }
      if (G.grace > 0) G.grace -= dt; if (G.askCd > 0) G.askCd -= dt;
      if (allGood()) G.good += dt;
      if (G.time >= G.next && G.time < ROUND - 7 && !(G.time > SEG - 7 && G.time < SEG)) { firePrank(); const pace = (G.time < 60 ? 15 : G.time < 120 ? 12 : 9.5) * chNow().pace; G.next = G.time + pace * (0.75 + Math.random() * 0.5); }
      const late = G.pranks.find((p) => p.fixed === null && !p.told && G.time - p.at > 6 && isActive(p.k)); if (late) { late.told = true; say(t('sp_' + late.k), 'warn'); }
      const tr = trustNow(); $('timer').textContent = fmt(ROUND - G.time + 0.99); $('trustFill').style.width = Math.round(tr) + '%'; $('trustFill').className = tr >= PASS * 100 ? '' : 'low';
      $('trustPct').textContent = Math.round(tr) + '%'; $('live').className = allGood() ? 'live' : 'live off';
      { // say exactly what is wrong right now and where to fix it, so the player knows why trust is dropping
        const bad = ['product', 'light', 'confetti', 'camera'].find(isActive), FIX = { product: ['📦', 'a_product'], camera: ['🎥', 'a_console'], light: ['💡', 'a_light'], confetti: ['🧹', 'a_clean'] };
        const el = $('segName'); el.classList.toggle('warn', !!bad);
        el.textContent = bad ? '⚠️ ' + t('p_' + bad) + '  ➜  ' + FIX[bad][0] + ' ' + t(FIX[bad][1]) : '✅ ' + t(seg() === 0 ? 'seg1' : 'seg2') + ' · ' + t('need') + ' ' + (needCam() + 1); }
      $('pipLabel').textContent = t('feed') + ' · ' + t('cam') + ' ' + (G.feed + 1); $('pip').className = G.feed === needCam() || G.grace > 0 ? '' : 'wrong';
    } else { $('segName').classList.remove('warn'); $('segName').textContent = t('z_' + G.zone); }
    movePlayer(dt); followCam(dt);
    const a = currentAction();
    if (a !== lastAct || a === 'clean') { lastAct = a; const b = $('actBtn'); b.hidden = !a; if (a === 'clean') { $('actIcon').textContent = '🧹'; $('actLabel').textContent = t('a_clean') + ' ×' + G.mess; } else if (a) { $('actIcon').textContent = a === itCon && !G.on ? '🔴' : a.icon; $('actLabel').textContent = t(a === itCon && !G.on ? 'a_start' : a.key); } }
    if (G.on && G.time >= ROUND) endRound();
  } else if (creating) {
    player.g.position.set(0, 0, 3.3); player.g.rotation.y = Math.sin(tt * 0.7) * 0.9; player.legL.rotation.x = player.legR.rotation.x = player.armL.rotation.x = 0; player.armR.rotation.set(0, 0, 0);
    if (tab === 'face') { player.g.rotation.y *= 0.4; let hy = 1.62; if (player.real && player.real.root.visible) { if (!player.real.headB) player.real.root.traverse((o) => { if (o.isBone && /^head$/i.test(o.name)) player.real.headB = o; }); if (player.real.headB) { player.real.headB.getWorldPosition(hv); hy = hv.y + 0.07; } }
      cam.position.set(0, hy + 0.08, 3.3 + 1.4); cam.lookAt(0, hy - 0.05, 3.3); } else { cam.position.set(0, 1.45, 6.9); cam.lookAt(0, 1.0, 3.3); }
  } else {
    if (tourI >= 0) { cam.position.lerp(tourCam.p, Math.min(1, dt * 2.2)); tourCam.l.lerp(tourCam.lt, Math.min(1, dt * 2.6)); cam.lookAt(tourCam.l); } else {
    cam.position.set(Math.sin(tt * 0.2) * 3.5, 4.4, 10.5); cam.lookAt(0.3, 1.2, -1.2); if (window.__shot) { cam.position.set(...window.__shot.p); cam.lookAt(...window.__shot.l); } }
    player.g.position.set(0, 0, 3.3); player.g.rotation.y = Math.sin(tt * 0.6) * 0.5; player.armR.rotation.x = -2.6 + Math.sin(tt * 5) * 0.3; player.legL.rotation.x = player.legR.rotation.x = player.armL.rotation.x = 0;
  }
  // render: the creator shows the character in the top half only
  const vh = creating ? Math.round(h * 0.46) : h, vy = h - vh; const fov = creating ? 34 : w < h ? 72 : 58;
  if (cam.aspect !== w / vh || cam.fov !== fov) { cam.aspect = w / vh; cam.fov = fov; cam.updateProjectionMatrix(); }
  renderer.setScissorTest(false); renderer.setViewport(0, 0, w, h); renderer.clear();
  if (composer && !creating) composer.render(); else { renderer.setViewport(0, vy, w, vh); renderer.render(scene, cam); }
  if (playing && G.on && pip.w > 0) {
    renderer.setScissorTest(true); renderer.setScissor(pip.x, pip.y, pip.w, pip.h); renderer.setViewport(pip.x, pip.y, pip.w, pip.h);
    IT.forEach((it) => { it.ring.visible = false; }); renderer.render(scene, feedCam); renderer.setScissorTest(false);
  }
}
// never let one bad frame kill the render loop; show the error so a phone screenshot tells us what broke
let errShown = 0;
function showDiag(msg) { let d = document.getElementById('diag'); if (!d) { d = document.createElement('div'); d.id = 'diag'; d.onclick = () => { if (++perf.taps >= 5) { perf.taps = 0; perfShow(!perf.el); } }; d.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:99;max-width:70vw;font:11px/1.3 monospace;color:#ff8080;background:rgba(0,0,0,.6);padding:4px 6px;border-radius:6px;direction:ltr;text-align:left;pointer-events:none'; document.body.appendChild(d); } d.textContent = VERSION + ' · ' + msg; }
// performance guard: a hidden FPS counter (?fps in the URL, or tap the version label 5 times) and an automatic drop to light mode
const perf = { n: 0, t0: 0, fps: 60, low: 0, el: null, taps: 0, done: false };
function perfShow(on) { if (on && !perf.el) { perf.el = document.createElement('div'); perf.el.style.cssText = 'position:fixed;right:6px;top:6px;z-index:99;font:12px monospace;background:rgba(0,0,0,.6);color:#7fe9ff;padding:3px 6px;border-radius:6px;pointer-events:none'; document.body.appendChild(perf.el); } if (!on && perf.el) { perf.el.remove(); perf.el = null; } }
if (/[?&]fps\b/.test(location.search)) perfShow(true);
function perfTick(now) {
  if (!perf.t0) perf.t0 = now; perf.n++; const span = now - perf.t0; if (span < 2000) return;
  perf.fps = (perf.n * 1000) / span; perf.n = 0; perf.t0 = now;
  if (perf.el) { const i = renderer.info.render; perf.el.textContent = Math.round(perf.fps) + ' fps · ' + i.calls + ' dc · ' + Math.round(i.triangles / 1000) + 'k tri · ' + cfg.quality; }
  if (document.hidden || perf.done) return; perf.low = perf.fps < 28 ? perf.low + 1 : 0;
  if (perf.low >= 3) { perf.done = true; perf.low = 0; setRealBudget(8, 30); if (cfg.quality !== 'low') { cfg.quality = 'low'; store.set('quality', 'low'); renderer.setPixelRatio(pixelRatio()); try { setupFX(); } catch (_) {} } else renderer.setPixelRatio(Math.max(0.75, renderer.getPixelRatio() * 0.8)); try { gToast('⚡ ' + t('perf_lite')); } catch (_) {} }
}
let realT = 0;
function frame(now) {
  try { perfTick(now); } catch (_) {}
  try { const d = Math.min(0.05, (now - (realT || now)) / 1000); realT = now; if (cfg.real) realTick(d, cam); } catch (e) { console.warn(e); }
  try { frameBody(now); } catch (e) { if (errShown++ < 3) { console.error(e); showDiag('ERR ' + (e && e.message ? e.message : e)); } }
  requestAnimationFrame(frame);
}

// hook for automated checks only
window.__onair = { player: () => player, setAv: (c) => { Object.assign(avatar, c); rebuildPlayer(); }, realDebug, R: renderer, openPanel, sign, chase, startChase, cop, applyRoom, dr: { open: drOpen, looks }, crewRef: crew, pc: { S: pcS, open: pcOpen }, cs, iv: { start: (i) => startInterview(NPCS.filter((n) => n.zone === 'street' && !n.star)[i]), pos: () => ivPos, zone: () => ivZoneW }, story: { DUST, clean: (i) => cleanOne(DUST[i]), step: () => SI }, PiState, G, IT, NPCS, act, startRound, endRound, firePrank, enterZone, mess, go: (x, z) => { G.px = x; G.pz = z; }, skip: (s) => { G.time += s; G.good += s; } };

scene.traverse((o) => { if (!o.isMesh || !o.material) return; const m = o.material; if (m.isMeshBasicMaterial) m.toneMapped = false; if (m.isMeshStandardMaterial && m.emissive && m.emissive.getHex() !== 0) m.emissiveIntensity *= 3.5; });
Object.keys(UNLOCK).forEach((id) => { const run = $(id).onclick; $(id).onclick = (e) => { if (!UNLOCK[id]()) { sfx.bad(); gToast(t('locked_hint')); return; } run(e); }; });
applyLocks();
setupFX(); applyLang(); syncScene();
// a brand-new player goes straight to the character creator, so the start menu never flashes first
if (!store.get('story_done', false)) { afterCreator = true; G.zone = 'studio'; G.light = true; syncScene(); buildCreator(); show('creator'); } else show('menu');
resize();
showDiag(IS_MOBILE ? 'mobile · ' + cfg.quality : cfg.quality); setTimeout(() => { const d = document.getElementById('diag'); if (d && !errShown) d.remove(); }, 6000);
requestAnimationFrame(frame);
// realistic characters load after the game is up, so the first screen never waits for them
setTimeout(() => { loadCars(); loadKit(ZG.street); }, 700);
if (cfg.real) setTimeout(() => { if (IS_MOBILE) setRealBudget(10, 40); else setRealBudget(14, 50); loadReal(); }, 1200);
