import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { LANGS, STR } from './i18n.js';
import { piSignIn, PiState } from './pi.js';
import { M, box, cyl, sph, cap, tor, makeChar, sit, OPT, DEFAULT_AVATAR } from './char.js';
import { makeShop, wornIds, price, reqLevel, PACKS, roundXp, xpFor, MAX_LEVEL, isExclusive, EXCLUSIVE } from './shop.js';
import { makeStore, TOKEN } from './store.js';
import * as SFX from './studiofx.js';
import { preview as dailyPreview, claim as dailyClaim, rewardFor, isBig, CYCLE } from './daily.js';

/* ---------- storage, i18n, sound ---------- */
const store = { get(k, d) { try { const v = localStorage.getItem('onair_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('onair_' + k, JSON.stringify(v)); } catch (e) {} } };
let lang = store.get('lang', 'ar');
let soundOn = store.get('sound', true);
const cfg = { voice: store.get('voice', true), vibe: store.get('vibe', true), quality: store.get('quality', 'high') };
const stats = { rounds: 0, wins: 0, best: 0, since: Date.now(), ...store.get('stats', {}) }; if (!store.get('stats', null)) store.set('stats', stats);
const VERSION = '1.3.0';
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
const pixelRatio = () => (cfg.quality === 'low' ? 1 : Math.min(window.devicePixelRatio || 1, 2));
renderer.setPixelRatio(pixelRatio());
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
function tree(x, z) { put(cyl(0.16, 0.22, 1.8, 0x7a5230), x, 0.9, z).castShadow = true; [[0, 2.5, 0, 1.0], [0.6, 2.1, 0.2, 0.7], [-0.55, 2.2, -0.2, 0.75]].forEach(([dx, y, dz, r]) => { put(sph(r, 0x3fae5e), x + dx, y, z + dz).castShadow = true; }); }
function building(x, z, w, h, c, wc) {
  put(box(w, h, 4, c), x, h / 2, z).castShadow = true; put(box(w + 0.3, 0.25, 4.3, 0xffffff), x, h + 0.12, z);
  const cols = Math.floor(w / 1.6), rows = Math.floor((h - 2.6) / 1.5);
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) put(box(0.9, 0.9, 0.06, wc, { emissive: wc, emissiveIntensity: 0.25 }), x - ((cols - 1) * 1.6) / 2 + i * 1.6, 3.4 + j * 1.5, z + 2.02);
}
const COLL = { studio: [], street: [], event: [] };
const IT = []; // interactables
function interact(zone, x, z, r, key, icon, cond, run) { const ringM = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.58, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, side: THREE.DoubleSide })); ringM.rotation.x = -Math.PI / 2; ringM.position.set(x, 0.035, z); ZG[zone].add(ringM); const it = { zone, x, z, r, key, icon, cond, run, ring: ringM }; IT.push(it); return it; }
const NPCS = [];
function npc(zone, x, z, face, av, name, lines) { const ch = makeChar(av); ch.g.position.set(x, 0, z); ch.g.rotation.y = face; ZG[zone].add(ch.g); COLL[zone].push([x, z, 0.4]); const n = { ch, x, z, face, name, lines, i: 0, zone }; NPCS.push(n); return n; }

/* ================= STUDIO ================= */
cur = ZG.studio;
ground(26, 22, 0x2f2552, 0, 1);
const rugA = put(new THREE.Mesh(new THREE.CircleGeometry(2.5, 48), M(0xe0563b)), -2.5, 0.012, -1.7); rugA.rotation.x = -Math.PI / 2; rugA.receiveShadow = true;
const rugB = put(new THREE.Mesh(new THREE.CircleGeometry(2.2, 48), M(0x2a8f8a)), 3, 0.012, -1.8); rugB.rotation.x = -Math.PI / 2; rugB.receiveShadow = true;
put(box(15, 6, 0.3, 0x2c2470), 0, 3, -4.2); put(box(0.3, 6, 14, 0x281f66), -7.3, 3, 2.6); put(box(0.3, 6, 14, 0x281f66), 7.3, 3, 2.6);
{ const gt = SFX.galaxyTex(); const gm = new THREE.MeshBasicMaterial({ map: gt, toneMapped: false });
  const gw = put(new THREE.Mesh(new THREE.PlaneGeometry(14, 6), gm), 7.14, 3, 2.6); gw.rotation.y = -Math.PI / 2;
  const gt2 = gt.clone(); gt2.needsUpdate = true; gt2.repeat.set(0.35, 1); gt2.offset.set(0.62, 0); gt2.wrapS = THREE.RepeatWrapping;
  put(new THREE.Mesh(new THREE.PlaneGeometry(2.7, 6), new THREE.MeshBasicMaterial({ map: gt2, toneMapped: false })), 5.95, 3, -4.04); }
for (let i = 0; i < 4; i++) put(box(1.15, 3, 0.08, i % 2 ? 0x5a3fc0 : 0x6c4fe0, { emissive: i % 2 ? 0x1c0f60 : 0x26157a, emissiveIntensity: 0.9 }), -4.4 + i * 1.27, 2.1, -3.98);
put(box(15, 0.07, 0.07, 0xffcf3f, { emissive: 0xffcf3f }), 0, 0.35, -4.0); put(box(15, 0.06, 0.06, 0x7fe9ff, { emissive: 0x4cc9f0, emissiveIntensity: 2 }), 0, 4.6, -4.0); put(box(0.06, 0.06, 14, 0x7fe9ff, { emissive: 0x4cc9f0, emissiveIntensity: 2 }), -7.1, 4.6, 2.6);
const sign = put(signPlane('ON AIR', '#ff2a40', '#ffffff', 2.2, 0.7), 0, 4.0, -3.9); put(box(2.4, 0.9, 0.12, 0x8a1220), 0, 4.0, -3.98);
const screenMat = new THREE.MeshBasicMaterial({ map: SFX.fluidTex(), toneMapped: false });
put(box(3.5, 2.1, 0.12, 0x2a2b30, { rough: 0.35, metal: 0.6 }), 3, 2.25, -3.98); put(new THREE.Mesh(new THREE.PlaneGeometry(3.38, 1.98), screenMat), 3, 2.25, -3.91);
put(box(13, 0.14, 0.14, 0x1c1c22), 0, 5.2, -0.5); put(box(13, 0.14, 0.14, 0x1c1c22), 0, 5.2, 0.1);
for (let i = 0; i < 14; i++) { const b = box(0.06, 0.06, 0.62, 0x1c1c22); b.rotation.y = i % 2 ? 0.7 : -0.7; put(b, -6 + i * 0.92, 5.2, -0.2); }
[-4.2, -1.4, 1.4, 4.2].forEach((x, i) => { const c = cyl(0.16, 0.22, 0.4, 0x16161a, { metal: 0.6, rough: 0.4 }); c.rotation.x = 0.5; put(c, x, 4.95, -0.2); const col = [0xff4fa8, 0x22d3ee, 0x34f59a, 0xa855f7][i]; put(sph(0.13, col, { emissive: col, emissiveIntensity: 4 }), x, 4.8, -0.12); });
// sponsor desk + product
const DESK = { x: -2.5, z: -2 };
{ const gl = (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.28, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.08 });
  const top = put(slab(3.3, 0.12, 1.25, 0.18, 0xf6efe2), DESK.x, 1.06, DESK.z); top.castShadow = true; top.material = gl(0xf6efe2);
  const front = put(slab(3.0, 0.9, 0.16, 0.06, 0xe0563b), DESK.x, 0.94, DESK.z + 0.5); front.castShadow = true;
  front.material = new THREE.MeshPhysicalMaterial({ map: SFX.carbonTex(), roughness: 0.32, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.06 });
  top.material = new THREE.MeshPhysicalMaterial({ map: SFX.carbonTex(), color: 0x9a9aa8, roughness: 0.3, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 });
  put(new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshBasicMaterial({ map: SFX.emblemTex(), transparent: true, toneMapped: false })), DESK.x, 0.92, DESK.z + 0.585); }
{ const cm = new THREE.MeshPhysicalMaterial({ map: SFX.carbonTex(), roughness: 0.32, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.06 }); put(slab(0.16, 0.9, 1.0, 0.06, 0xc9432c), DESK.x - 1.45, 0.94, DESK.z).material = cm; put(slab(0.16, 0.9, 1.0, 0.06, 0xc9432c), DESK.x + 1.45, 0.94, DESK.z).material = cm; }
put(box(2.4, 0.05, 0.03, 0xffcf3f, { emissive: 0xffcf3f }), DESK.x, 0.55, DESK.z + 0.6);
put(cyl(0.09, 0.1, 0.03, 0x222222), DESK.x - 0.9, 1.08, DESK.z + 0.2); put(cyl(0.015, 0.015, 0.3, 0x222222), DESK.x - 0.9, 1.22, DESK.z + 0.2); put(cap(0.045, 0.08, 0x3a3a3a), DESK.x - 0.9, 1.42, DESK.z + 0.2);
const PX = DESK.x + 0.8, PZ = DESK.z + 0.1;
put(cyl(0.36, 0.4, 0.07, 0xffffff), PX, 1.1, PZ).castShadow = true;
const gold = new THREE.Group(); const GM = { emissive: 0x9a6a00, emissiveIntensity: 0.5 };
put(slab(0.44, 0.46, 0.44, 0.06, 0xf5c542, GM), 0, 0.46, 0, gold); put(slab(0.48, 0.1, 0.48, 0.06, 0xffe08a, GM), 0, 0.58, 0, gold);
put(box(0.09, 0.6, 0.46, 0xd9342b), 0, 0.3, 0, gold); put(box(0.46, 0.6, 0.09, 0xd9342b), 0, 0.3, 0, gold);
[-1, 1].forEach((s) => { const b = tor(0.08, 0.03, 0xd9342b); b.position.set(0.08 * s, 0.64, 0); b.rotation.y = -0.6 * s; gold.add(b); });
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
put(cyl(0.05, 0.04, 0.12, 0xffffff), IV.x - 0.1, 0.7, IV.z + 0.35); put(cyl(0.05, 0.04, 0.12, 0xffffff), IV.x + 0.12, 0.7, IV.z + 0.4);
const guest = makeChar({ skin: 3, hairStyle: 1, hairColor: 0, beard: 1, top: 0, topColor: 2, bottom: 1, bottomColor: 6, shoes: 3 });
sit(guest); guest.g.position.set(IV.x + 0.95, -0.14, IV.z - 0.05); guest.g.rotation.y = -0.45; cur.add(guest.g);
put(sph(0.16, 0xffffff), IV.x + 1.75, 0.16, IV.z + 0.5).castShadow = true; plant(IV.x + 2.0, IV.z - 1.3); plant(DESK.x - 2.4, DESK.z - 1.2);
// storage corner (camera 3)
put(box(1.7, 2.3, 0.5, 0x7a5a3a), 6.2, 1.15, -3.6).castShadow = true;
for (let i = 0; i < 3; i++) put(box(1.6, 0.06, 0.54, 0x5a4028), 6.2, 0.55 + i * 0.7, -3.58);
put(box(0.5, 0.4, 0.4, 0xd9a05b), 5.8, 0.8, -3.5); put(box(0.4, 0.5, 0.4, 0x4fb3d9), 6.6, 1.55, -3.5); put(box(0.6, 0.3, 0.4, 0xff4d6d), 6.3, 2.15, -3.5);
put(box(0.9, 0.7, 0.7, 0xc98f4e), 6.5, 0.35, -2.4).castShadow = true; put(box(0.7, 0.5, 0.6, 0xb57f42), 6.5, 0.95, -2.4).castShadow = true;
const crew = makeChar({ skin: 0, hairStyle: 0, hairColor: 2, top: 0, topColor: 4, bottom: 0, bottomColor: 7, shoes: 1, capColor: 1, acc: { cap: true } });
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
  const b1 = put(SFX.cardboard(0.8, 0.6, 0.6, 'FRAGILE'), 6.4, 0.3, -3.55); b1.rotation.y = 0.1;
  put(SFX.cardboard(0.7, 0.5, 0.55, 'STUDIO'), 6.45, 0.85, -3.55).rotation.y = -0.15;
  put(SFX.cardboard(0.55, 0.45, 0.5), 6.5, 1.32, -3.5).rotation.y = 0.2;
  put(SFX.cardboard(0.75, 0.55, 0.6, 'GEAR'), 6.5, 0.275, -2.55).rotation.y = -0.1;
  const cr = SFX.crate(0x2563eb); cr.position.set(6.45, 0, -1.8); cr.rotation.y = -0.3; cur.add(cr);
  const cr2 = SFX.crate(0xd9d9de); cr2.position.set(6.4, 0.55, -2.55); cr2.scale.setScalar(0.8); cur.add(cr2);
  const ch = SFX.chest(); ch.position.set(6.3, 0, -0.9); ch.rotation.y = -Math.PI / 2; cur.add(ch);
  put(box(1.5, 0.06, 0.4, 0x2a2b32, { rough: 0.4, metal: 0.5 }), 5.1, 3.1, -3.85);
  [[4.6, 0], [5.0, 2], [5.4, 4], [5.75, 6]].forEach(([fx, k]) => { const f = makeChar({ skin: k % 4, hairStyle: k % 3, hairColor: k % 5, top: k % 2, topColor: k % 7, bottom: 0, bottomColor: (k + 3) % 8, shoes: k % 5 }); f.g.scale.setScalar(0.17); f.g.position.set(fx, 3.13, -3.85); cur.add(f.g); });
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
ground(60, 40, 0x6a7080, SX, 0);
put(box(40, 0.14, 5.2, 0xd8d2c4), SX, 0.07, -5.6).receiveShadow = true; put(box(40, 0.14, 3, 0xd8d2c4), SX, 0.07, 7.6).receiveShadow = true;
for (let i = -6; i <= 6; i++) put(box(1.6, 0.02, 0.18, 0xffffff), SX + i * 3, 0.02, 1.6);
building(SX, -10.2, 9, 6.5, 0x7a57e6, 0xbfe3ff); building(SX - 10.5, -10.2, 9, 5, 0xffcf3f, 0xffffff); building(SX + 10.5, -10.2, 9, 7.5, 0x4cc9f0, 0xfff3b0);
put(box(1.7, 2.7, 0.2, 0x23233a), SX, 1.35, -8.15); put(box(1.4, 2.4, 0.1, 0xff8a3d, { emissive: 0xff8a3d, emissiveIntensity: 0.3 }), SX, 1.25, -8.08);
put(signPlane('STUDIO', '#ff2a40', '#ffffff', 3.2, 0.9), SX, 3.3, -8.1);
put(box(4, 0.12, 1.4, 0xd9342b), SX - 10.5, 2.7, -7.6); put(signPlane('SHAWARMA', '#ffffff', '#d9342b', 3.4, 0.7, 640, 130, 'bold 90px system-ui'), SX - 10.5, 3.3, -8.15);
[-12, -4, 4, 12].forEach((dx) => tree(SX + dx, 7.4));
[-7, 0, 7].forEach((dx) => { put(cyl(0.07, 0.09, 3.6, 0x30303a), SX + dx, 1.8, -3.5).castShadow = true; put(box(0.9, 0.08, 0.14, 0x30303a), SX + dx + 0.4, 3.6, -3.5); put(sph(0.16, 0xfff3b0, { emissive: 0xfff3b0 }), SX + dx + 0.8, 3.5, -3.5); });
// shawarma cart
put(box(2.2, 0.9, 1.1, 0xffffff), SX - 8, 0.65, -4.6).castShadow = true; put(box(2.24, 0.25, 1.14, 0xd9342b), SX - 8, 0.9, -4.6); put(box(2.5, 0.1, 1.5, 0xd9342b), SX - 8, 2.2, -4.6).castShadow = true;
[-1, 1].forEach((s) => { put(cyl(0.03, 0.03, 1.3, 0x555555), SX - 8 + s, 1.6, -4.1); put(cyl(0.25, 0.25, 0.1, 0x222222), SX - 8 + s * 0.8, 0.25, -4.0).rotation.x = Math.PI / 2; });
put(cyl(0.13, 0.2, 0.7, 0x8a4a22), SX - 8.4, 1.5, -4.6); put(cyl(0.02, 0.02, 1.0, 0x999999), SX - 8.4, 1.6, -4.6);
// bench + parked car
put(box(1.8, 0.1, 0.5, 0x8a5a2b), SX + 3, 0.5, -3.6).castShadow = true; put(box(1.8, 0.5, 0.08, 0x8a5a2b), SX + 3, 0.85, -3.85); [-0.7, 0.7].forEach((d) => put(box(0.1, 0.5, 0.45, 0x30303a), SX + 3 + d, 0.25, -3.6));
const car = new THREE.Group(); put(slab(3.6, 0.6, 1.7, 0.3, 0xff4d6d), 0, 0.95, 0, car); put(slab(2.0, 0.55, 1.5, 0.3, 0xffffff), -0.2, 1.5, 0, car);
[[-1.1, 0.86], [1.1, 0.86], [-1.1, -0.86], [1.1, -0.86]].forEach(([x, z]) => { const w = cyl(0.34, 0.34, 0.22, 0x1c1c22); w.rotation.x = Math.PI / 2; put(w, x, 0.34, z, car); });
put(sph(0.1, 0xfff3b0, { emissive: 0xfff3b0 }), 1.78, 0.75, 0.55, car); put(sph(0.1, 0xfff3b0, { emissive: 0xfff3b0 }), 1.78, 0.75, -0.55, car);
car.position.set(SX - 3, 0, 5.2); cur.add(shadow(car));
// awards arch
[-2.4, 2.4].forEach((z) => put(box(0.6, 4.2, 0.6, 0xffcf3f), SX + 13.4, 2.1, z).castShadow = true); put(box(0.7, 0.9, 5.6, 0xc81e2d), SX + 13.4, 4.4, 0);
const archSign = put(signPlane('★ AWARDS ★', '#c81e2d', '#ffcf3f', 5, 0.8, 640, 110, 'bold 80px system-ui'), SX + 13.04, 4.4, 0); archSign.rotation.y = -Math.PI / 2;
put(box(6, 0.03, 3.6, 0xc81e2d), SX + 11.5, 0.02, 0);
put(sph(0.2, 0xff8a3d), SX + 4.6, 0.2, 2.6).castShadow = true;
COLL.street.push([SX - 8.6, -4.6, 0.9], [SX - 7.4, -4.6, 0.9], [SX + 2.5, -3.7, 0.6], [SX + 3.5, -3.7, 0.6], [SX - 4, 5.2, 1.2], [SX - 2, 5.2, 1.2], [SX + 13.4, -2.4, 0.6], [SX + 13.4, 2.4, 0.6], ...[-7, 0, 7].map((d) => [SX + d, -3.5, 0.25]));
npc('street', SX - 3.5, -1.5, 0.4, { skin: 2, hairStyle: 2, hairColor: 0, top: 0, topColor: 8, bottom: 1, bottomColor: 0, shoes: 0, acc: { glasses: true } }, 'n_fan', ['n_fan1', 'n_fan2']);
npc('street', SX - 8, -5.7, 0, { skin: 4, hairStyle: 5, hairColor: 0, beard: 3, top: 0, topColor: 6, bottom: 0, bottomColor: 7, shoes: 1, capColor: 1, acc: { cap: true } }, 'n_vendor', ['n_vendor1', 'n_vendor2']);
const kid = npc('street', SX + 4, 2.2, 3.4, { skin: 1, hairStyle: 3, hairColor: 1, top: 0, topColor: 3, bottom: 1, bottomColor: 1, shoes: 4 }, 'n_kid', ['n_kid1', 'n_kid2']); kid.ch.g.scale.setScalar(0.72);
npc('street', SX + 8.5, -2.6, -0.6, { skin: 0, hairStyle: 4, hairColor: 6, top: 2, topColor: 7, bottom: 0, bottomColor: 5, shoes: 2, acc: { headphones: true, chain: true } }, 'n_rival', ['n_rival1', 'n_rival2']);

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
const starS = npc('event', EX - 5, -0.5, -Math.PI / 2, { skin: 1, hairStyle: 4, hairColor: 6, top: 2, topColor: 8, bottom: 0, bottomColor: 5, shoes: 3, acc: { earring: true, chain: true } }, 'star_s', []);
const starT = npc('event', EX + 1.5, 0.5, -Math.PI / 2, { skin: 3, hairStyle: 0, hairColor: 0, beard: 2, top: 2, topColor: 7, bottom: 0, bottomColor: 7, shoes: 1, acc: { glasses: true, watch: true } }, 'star_t', []);
npc('event', EX + 6.0, 1.3, -Math.PI / 2, { skin: 4, hairStyle: 1, hairColor: 0, beard: 1, top: 2, topColor: 7, bottom: 0, bottomColor: 7, shoes: 1, acc: { glasses: true } }, 'n_guard', ['n_guard1', 'n_guard2']);
STAR_SETUP();
function STAR_SETUP() { starS.set = [0, 1, 2].map((i) => ({ q: 'qs' + i, a: 'as' + i, v: 1 - i })); starT.set = [0, 1, 2].map((i) => ({ q: 'qt' + i, a: 'at' + i, v: 1 - i })); starS.star = starT.star = true; }

/* ---------- player, lights, confetti ---------- */
let player = makeChar(avatar); scene.add(player.g);
function rebuildPlayer() { const pos = player.g.position.clone(), ry = player.g.rotation.y; scene.remove(player.g); player = makeChar(avatar); player.g.position.copy(pos); player.g.rotation.y = ry; scene.add(player.g); }
const amb = new THREE.HemisphereLight(0xdfe6ff, 0x3a3060, 0.9); scene.add(amb);
const stageA = new THREE.PointLight(0xa463ff, 6, 12, 1.6); stageA.position.set(-5.5, 3.2, -2.5); scene.add(stageA);
const stageB = new THREE.PointLight(0x3ad4ff, 6, 12, 1.6); stageB.position.set(5.5, 3.2, -2.5); scene.add(stageB);
const key = new THREE.SpotLight(0xfff2d6, 220, 24, 0.8, 0.6, 1.3); key.position.set(0.5, 8.5, 5.5); key.target.position.set(0.3, 0.5, -1.6); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0008; key.shadow.radius = 4; key.shadow.camera.near = 2; key.shadow.camera.far = 24; scene.add(key); scene.add(key.target);
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
  street: { ox: SX, bx: [-13.6, 12.7], bz: [-6.9, 5.8], cx: [-22, 22], cz: [-7.6, 14], bg: 0x8fd3ff, fog: [45, 100] },
  event: { ox: EX, bx: [-13.6, 6.1], bz: [-1.5, 1.5], cx: [-22, 12], cz: [-9, 9], bg: 0x1d1440, fog: [30, 80] },
};
const ROUND = 180, SEG = 90, PASS = 0.7;
const QSETS = [0, 1, 2].map((r) => [0, 1, 2].map((i) => ({ q: 'q' + r + i, a: 'a' + r + i, v: 1 - i })));
const G = { on: false, zone: 'studio', coins: store.get('coins', 0), time: 0, good: 0, bonus: 0, product: true, feed: 0, light: true, mess: 0, pranks: [], next: 0, asked: [], askCd: 0, asking: false, grace: 0, px: 0, pz: 3.3, face: Math.PI, walk: 0, moving: false };
const seg = () => (G.time < SEG ? 0 : 1);
const needCam = () => (G.on ? seg() : 0);
const productOk = () => seg() === 1 || G.product;
const allGood = () => productOk() && (G.feed === needCam() || G.grace > 0) && G.light && G.mess === 0;
const isActive = (k) => (k === 'product' ? !G.product : k === 'camera' ? G.feed !== needCam() : k === 'light' ? !G.light : G.mess > 0);
const trustNow = () => Math.max(0, Math.min(100, (G.time > 0.5 ? (G.good / G.time) * 100 : 100) + G.bonus));
function addCoins(n) { G.coins += n; store.set('coins', G.coins); $('coinN').textContent = G.coins; if ($('crCoins')) $('crCoins').textContent = '🪙 ' + G.coins; }

function syncScene() {
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
  const pool = (seg() === 0 ? ['product', 'camera', 'light', 'confetti'] : ['camera', 'light', 'confetti']).filter((k) => !isActive(k)); if (!pool.length) return;
  const k = pool[Math.floor(Math.random() * pool.length)];
  if (k === 'product') G.product = false; if (k === 'camera') { G.feed = (G.feed + 1 + Math.floor(Math.random() * 2)) % 3; G.grace = 0; flashPip(); }
  if (k === 'light') G.light = false; if (k === 'confetti') { G.mess = 3; const c = seg() === 0 ? DESK : IV; dropConfetti(c.x, c.z); }
  G.pranks.push({ k, at: G.time, fixed: null, told: false }); sfx.prank(); syncScene();
}
function markFixed(k) { const p = G.pranks.slice().reverse().find((x) => x.k === k && x.fixed === null); if (p) { p.fixed = G.time; G.bonus += cs.bonuses().fix; sfx.fix(); say(t('sp_ok'), 'ok', true); } }
const selfPrank = (k) => G.pranks.push({ k, at: G.time, fixed: null, told: true, self: true });
function startRound() {
  lastAct = 0; Object.assign(G, { on: true, zone: 'studio', time: 0, good: 0, bonus: 0, product: true, feed: 0, light: true, mess: 0, pranks: [], next: 9, asked: [], askCd: 0, asking: false, grace: 0, px: 0, pz: 3.3, face: Math.PI });
  confetti.forEach((c) => { c.m.visible = false; }); $('qSheet').hidden = true; show('hud'); syncScene(); resize(); snapCam = true; sfx.seg(); say(t('sp_start'));
  G.bonus += cs.bonuses().trust;
}
function endRound() {
  G.on = false; G.asking = false; $('qSheet').hidden = true; const missed = 3 - G.asked.length; G.bonus -= missed * 6;
  const BN = cs.bonuses();
  const trust = Math.max(0, Math.min(100, (G.good / ROUND) * 100 + G.bonus)) / 100; const pass = trust >= PASS; const coins = Math.round((pass ? 100 + trust * 150 : trust * 60) * (1 + BN.coins / 100));
  addCoins(coins); (pass ? sfx.win : sfx.lose)(); buzz(pass ? [60, 40, 120] : 200);
  stats.rounds++; if (pass) stats.wins++; stats.best = Math.max(stats.best, Math.round(trust * 100)); store.set('stats', stats);
  const xp = Math.round(roundXp(trust, pass) * (1 + BN.xp / 100)), up = shop.addXp(xp); showLevel();
  let drop = null; if (Math.random() * 100 < 4 + BN.luck) drop = cs.grantRandom(1); cs.consumeBoosts();
  $('rXp').textContent = '+' + xp + ' ' + t('xp') + ' · ' + t('lvl') + ' ' + shop.level; $('rUp').hidden = !up && !drop; $('rUp').textContent = [up ? '⭐ ' + t('level_up') : '', drop ? '🎁 ' + t('st_drop') + ': ' + drop.fam.icon + ' ' + cs.nameOf(drop) : ''].filter(Boolean).join('  ·  ');
  $('rTitle').textContent = t(pass ? 'r_pass' : 'r_fail'); $('rTitle').className = pass ? 'pass' : 'fail';
  $('rTrust').textContent = Math.round(trust * 100) + '%'; $('rAir').textContent = fmt(G.good) + ' / ' + fmt(ROUND); $('rCoins').textContent = '+' + coins;
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
  if (!G.on) { startRound(); return; }
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
  if (G.moving) { const sp = (fwd > 0 ? 4.0 : 2.2) * fwd; G.px += Math.sin(G.face) * sp * dt; G.pz += Math.cos(G.face) * sp * dt; G.walk += dt * 11 * Math.abs(fwd); }
  const Z = ZONES[G.zone];
  COLL[G.zone].forEach(([x, z, r]) => { const dx = G.px - x, dz = G.pz - z, d = Math.hypot(dx, dz), R = r + 0.3; if (d < R && d > 0.0001) { G.px = x + (dx / d) * R; G.pz = z + (dz / d) * R; } });
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
  if (cfg.quality === 'low') { composer = null; return; }
  const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: 4 });
  composer = new EffectComposer(renderer, rt); composer.addPass(new RenderPass(scene, cam));
  bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.45, 2.6); composer.addPass(bloom); composer.addPass(new OutputPass());
}
function resize() { const w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h, false); if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); } const r = $('pip').getBoundingClientRect(); pip = { x: r.left, y: h - r.bottom, w: r.width, h: r.height }; }
window.addEventListener('resize', resize);
function show(id) { ['menu', 'hud', 'report', 'how', 'langs', 'creator', 'profile', 'settings', 'storeS'].forEach((s) => { $(s).hidden = s !== id; }); if (id === 'menu') checkDaily(); }
function buildLangs() { const g = $('langGrid'); g.innerHTML = ''; LANGS.forEach((l) => { const b = document.createElement('button'); b.textContent = l.name; b.dir = l.rtl ? 'rtl' : 'ltr'; if (l.code === lang) b.className = 'sel'; b.onclick = () => { lang = l.code; store.set('lang', lang); applyLang(); show('settings'); buildSettings(); }; g.appendChild(b); }); }
function enterRoam() { lastAct = 0; G.on = false; G.zone = 'studio'; G.px = 0; G.pz = 3.3; G.face = Math.PI; player.armR.rotation.set(0, 0, 0); show('hud'); resize(); syncScene(); snapCam = true; say(t('roam_hint'), '', true); }
// character creator
let tab = 'skin';
function showLevel() {
  const lv = shop.level, a = xpFor(lv), b = xpFor(Math.min(MAX_LEVEL, lv + 1));
  const pct = lv >= MAX_LEVEL ? 100 : Math.round(((shop.xp - a) / (b - a)) * 100);
  $('lvlBox').textContent = '⭐ ' + lv; $('crLvl').textContent = '⭐ ' + t('lvl') + ' ' + lv; $('crXp').style.width = pct + '%'; $('crCoins').textContent = '🪙 ' + G.coins;
}
function toast(msg) { const el = $('crToast'); el.textContent = msg; el.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => { el.hidden = true; }, 2200); }
function buildCreator() {
  showLevel();
  const tabs = $('crTabs'); tabs.innerHTML = ''; ['skin', 'hair', 'clothes', 'acc', 'packs'].forEach((k) => { const b = document.createElement('button'); b.textContent = t('t_' + k); if (k === tab) b.className = 'sel'; b.onclick = () => { tab = k; sfx.click(); buildCreator(); }; tabs.appendChild(b); });
  const body = $('crBody'); body.innerHTML = '';
  const row = (label) => { const h = document.createElement('h4'); h.textContent = label; body.appendChild(h); const d = document.createElement('div'); d.className = 'opts'; body.appendChild(d); return d; };
  const changed = () => { store.set('avatar', avatar); rebuildPlayer(); sfx.click(); buildCreator(); };
  // Locked (level too low): explain. Available but not owned: preview it; the buy bar appears.
  const gate = (id, apply) => () => { if (!shop.available(id) && isExclusive(id)) { sfx.bad(); toast('👑 ' + t('d_excl')); return; } if (!shop.available(id)) { sfx.bad(); toast(t('need_lvl').replace('{n}', reqLevel(id))); return; } apply(); changed(); };
  const mark = (b, id) => { if (shop.has(id)) return; const tag = document.createElement('i'); tag.className = 'tag'; if (isExclusive(id)) { tag.textContent = '👑30'; b.classList.add('locked'); } else if (shop.available(id)) tag.textContent = '🪙' + price(id); else { tag.textContent = '🔒' + reqLevel(id); b.classList.add('locked'); } b.appendChild(tag); };
  const swatches = (label, cols, k, field) => { const d = row(label); cols.forEach((c, i) => { const id = (field || k) + ':' + i; const b = document.createElement('button'); b.className = 'sw' + (avatar[k] === i ? ' sel' : ''); b.style.background = '#' + c.toString(16).padStart(6, '0'); b.onclick = gate(id, () => { avatar[k] = i; }); if (k !== 'skin') mark(b, id); d.appendChild(b); }); };
  const chips = (label, names, k) => { const d = row(label); names.forEach((n, i) => { const id = k + ':' + i; const b = document.createElement('button'); b.className = 'chip' + (avatar[k] === i ? ' sel' : ''); b.textContent = n; b.onclick = gate(id, () => { avatar[k] = i; }); mark(b, id); d.appendChild(b); }); };
  if (tab === 'skin') swatches(t('c_color'), OPT.skin, 'skin');
  if (tab === 'hair') { chips(t('c_style'), ['1', '2', '3', '4', '5', '6'], 'hairStyle'); swatches(t('c_color'), OPT.hairColor, 'hairColor'); chips(t('c_beard'), OPT.beard.map((b) => t('o_' + b)), 'beard'); }
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
$('bChar').onclick = () => { sfx.click(); G.zone = 'studio'; G.light = true; syncScene(); buildCreator(); show('creator'); }; $('bCharDone').onclick = () => { sfx.click(); stripUnowned(); store.set('avatar', avatar); rebuildPlayer(); show('menu'); };
// app-token store
function gToast(msg) { const el = $('gToast'); el.textContent = msg; el.hidden = false; clearTimeout(gToast.h); gToast.h = setTimeout(() => { el.hidden = true; }, 2200); }
const cs = makeStore({ store, t, getLang: () => lang, sfx, toast: gToast, $ });
$('bStore').onclick = () => { sfx.click(); cs.closeSheet(); cs.render(); show('storeS'); };
$('stBack').onclick = () => { sfx.click(); cs.closeSheet(); show('menu'); };
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
function buildSettings() {
  const rows = $('setRows'); rows.innerHTML = '';
  const row = (icon, label, val, fn) => { const b = document.createElement('button'); b.className = 'srow'; b.innerHTML = '<span></span><span></span>'; b.children[0].textContent = icon + ' ' + label; b.children[1].textContent = val; b.onclick = () => { fn(); sfx.click(); buildSettings(); }; rows.appendChild(b); };
  row(soundOn ? '🔊' : '🔇', t('sound'), t(soundOn ? 'on' : 'off'), () => { soundOn = !soundOn; store.set('sound', soundOn); if (!soundOn && window.speechSynthesis) speechSynthesis.cancel(); });
  row('🗣️', t('s_voice'), t(cfg.voice ? 'on' : 'off'), () => { cfg.voice = !cfg.voice; store.set('voice', cfg.voice); if (!cfg.voice && window.speechSynthesis) speechSynthesis.cancel(); });
  row('📳', t('s_vibe'), t(cfg.vibe ? 'on' : 'off'), () => { cfg.vibe = !cfg.vibe; store.set('vibe', cfg.vibe); buzz(80); });
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
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; tt += dt; const w = window.innerWidth, h = window.innerHeight;
  gold.rotation.y = tt * 0.7; guest.head.rotation.y = Math.sin(tt * 0.8) * 0.25; guest.armR.rotation.x = -0.5 + Math.sin(tt * 2) * 0.12;
  crew.g.rotation.y = Math.sin(tt * 1.1) * 0.9 - 0.6; crew.armL.rotation.x = -1.2 + Math.sin(tt * 3) * 0.3; crew.armR.rotation.x = -1.0 + Math.cos(tt * 3) * 0.3;
  crowd.forEach((c, i) => { c.g.position.y = Math.abs(Math.sin(tt * 3 + i * 1.3)) * 0.12; c.armL.rotation.x = c.armR.rotation.x = -2.7 + Math.sin(tt * 6 + i) * 0.3; });
  trophy.rotation.y = tt * 0.5; if (G.zone === 'studio') atmos(dt, tt);
  NPCS.forEach((n, i) => { const d = Math.hypot(G.px - n.x, G.pz - n.z); const want = d < 3.5 && n.zone === G.zone ? Math.atan2(G.px - n.x, G.pz - n.z) : n.face; let dr = want - n.ch.g.rotation.y; while (dr > Math.PI) dr -= 6.283; while (dr < -Math.PI) dr += 6.283; n.ch.g.rotation.y += dr * Math.min(1, dt * 5); n.ch.armR.rotation.x = Math.sin(tt * 1.5 + i) * 0.12; n.ch.head.rotation.x = Math.sin(tt * 1.1 + i * 2) * 0.05; });
  IT.forEach((it, i) => { it.ring.visible = it.zone === G.zone && it.cond(); it.ring.material.opacity = 0.25 + Math.sin(tt * 3 + i) * 0.12; });
  confetti.forEach((c) => { if (c.m.visible && c.m.position.y > c.ty) { c.m.position.y = Math.max(c.ty, c.m.position.y - c.vy * dt); c.m.rotation.x += dt * 6; c.m.rotation.z += dt * 4; if (c.m.position.y === c.ty) c.m.rotation.set(-Math.PI / 2, 0, c.m.rotation.z); } });

  const playing = !$('hud').hidden, creating = !$('creator').hidden;
  if (playing) {
    if (G.on) {
      const wasSeg = seg(); G.time += dt;
      if (wasSeg === 0 && seg() === 1) { G.grace = 8; G.next = Math.max(G.next, G.time + 9); sfx.seg(); say(t('sp_seg2')); syncScene(); }
      if (G.grace > 0) G.grace -= dt; if (G.askCd > 0) G.askCd -= dt;
      if (allGood()) G.good += dt;
      if (G.time >= G.next && G.time < ROUND - 7 && !(G.time > SEG - 7 && G.time < SEG)) { firePrank(); const pace = G.time < 60 ? 15 : G.time < 120 ? 12 : 9.5; G.next = G.time + pace * (0.75 + Math.random() * 0.5); }
      const late = G.pranks.find((p) => p.fixed === null && !p.told && G.time - p.at > 6 && isActive(p.k)); if (late) { late.told = true; say(t('sp_' + late.k), 'warn'); }
      const tr = trustNow(); $('timer').textContent = fmt(ROUND - G.time + 0.99); $('trustFill').style.width = Math.round(tr) + '%'; $('trustFill').className = tr >= PASS * 100 ? '' : 'low';
      $('trustPct').textContent = Math.round(tr) + '%'; $('live').className = allGood() ? 'live' : 'live off';
      $('segName').textContent = t(seg() === 0 ? 'seg1' : 'seg2') + ' · ' + t('need') + ' ' + (needCam() + 1);
      $('pipLabel').textContent = t('feed') + ' · ' + t('cam') + ' ' + (G.feed + 1); $('pip').className = G.feed === needCam() || G.grace > 0 ? '' : 'wrong';
    } else $('segName').textContent = t('z_' + G.zone);
    movePlayer(dt); followCam(dt);
    const a = currentAction();
    if (a !== lastAct || a === 'clean') { lastAct = a; const b = $('actBtn'); b.hidden = !a; if (a === 'clean') { $('actIcon').textContent = '🧹'; $('actLabel').textContent = t('a_clean') + ' ×' + G.mess; } else if (a) { $('actIcon').textContent = a === itCon && !G.on ? '🔴' : a.icon; $('actLabel').textContent = t(a === itCon && !G.on ? 'a_start' : a.key); } }
    if (G.on && G.time >= ROUND) endRound();
  } else if (creating) {
    player.g.position.set(0, 0, 3.3); player.g.rotation.y = Math.sin(tt * 0.7) * 0.9; player.legL.rotation.x = player.legR.rotation.x = player.armL.rotation.x = 0; player.armR.rotation.set(0, 0, 0);
    cam.position.set(0, 1.45, 6.9); cam.lookAt(0, 1.0, 3.3);
  } else {
    cam.position.set(Math.sin(tt * 0.2) * 3.5, 4.4, 10.5); cam.lookAt(0.3, 1.2, -1.2); if (window.__shot) { cam.position.set(...window.__shot.p); cam.lookAt(...window.__shot.l); }
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
  requestAnimationFrame(frame);
}

// hook for automated checks only
window.__onair = { PiState, G, IT, NPCS, act, startRound, endRound, firePrank, enterZone, mess, go: (x, z) => { G.px = x; G.pz = z; }, skip: (s) => { G.time += s; G.good += s; } };

scene.traverse((o) => { if (!o.isMesh || !o.material) return; const m = o.material; if (m.isMeshBasicMaterial) m.toneMapped = false; if (m.isMeshStandardMaterial && m.emissive && m.emissive.getHex() !== 0) m.emissiveIntensity *= 3.5; });
setupFX(); applyLang(); syncScene(); show('menu'); resize();
requestAnimationFrame(frame);
