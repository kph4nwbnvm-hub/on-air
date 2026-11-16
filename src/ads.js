// Ad slots + sponsors. Real brands: ONLY Naif's own companies. Everything else in the world is fictional.
import * as THREE from 'three';
import IMG from './brandimg.js';

// Naif's companies (logos cropped from his posters until clean files arrive; LSLCO has no logo yet -> wordmark)
export const SPONSORS = {
  cc: { name: 'Creative Codes', ar: 'أكواد الإبداع', tag: 'ad_cc', sub: '=creative-codes.sa', bg: '#fbf7f1', ink: '#1d1d1f', accent: '#f08a1c', logo: 'cc' },
  ccmedia: { name: 'CC Media Solutions', ar: 'سي سي ميديا', tag: 'ad_ccm', sub: 'ad_ccm2', bg: '#fbf1f1', ink: '#2a2226', accent: '#c46b78', logo: 'ccmedia' },
  elva: { name: 'ELVA water', ar: 'مياه إلفا', tag: 'ad_elva', sub: '=elva.sa', bg: '#f6f2fb', ink: '#3b2770', accent: '#5b3aa6', logo: 'elva' },
  lslco: { name: 'LSLCO', ar: 'LSLCO للخدمات اللوجستية', tag: 'ad_lslco', sub: '=', bg: '#eef3f8', ink: '#0f2a44', accent: '#1f6fb2', logo: null },
};

// Every place an ad can live in the game (used by the ad study and the booking system later)
export const SLOTS = [
  { id: 'wall_screen', ar: 'الشاشة الكبيرة في الاستوديو', type: 'video/rotating', size: '16:9', now: ['ccmedia', 'cc', 'elva'] },
  { id: 'desk_front', ar: 'واجهة طاولة الراعي («برعاية»)', type: 'logo', size: '4:3', now: ['cc'] },
  { id: 'product', ar: 'منتج الراعي على الطاولة', type: 'product placement', size: '3D', now: ['elva'] },
  { id: 'guest_table', ar: 'طاولة الضيف', type: 'product placement', size: '3D', now: ['elva'] },
  { id: 'boxes', ar: 'كراتين الشحن في زاوية الاستوديو', type: 'label', size: '3D', now: ['lslco'] },
];

// Fictional world brands (original names, marks and colours — not modelled on any real company)
export const WORLD = {
  souq: { ar: 'سوق الهوا', en: 'SOUQ ALHAWA', role: 'المتجر الإلكتروني', c1: '#0f9d76', c2: '#ffd166', mark: 'bag' },
  shoofni: { ar: 'شوفني', en: 'SHOOFNI', role: 'منصة الفيديو', c1: '#ff5a5f', c2: '#1fd1c1', mark: 'eye' },
  laqta: { ar: 'لقطة', en: 'LAQTA', role: 'منصة المقاطع القصيرة', c1: '#111111', c2: '#b6f23a', mark: 'frame' },
  sada: { ar: 'صدى', en: 'SADA', role: 'منصة المنشورات', c1: '#ff8a00', c2: '#fff4e0', mark: 'arcs' },
  ghaima: { ar: 'طيران غيمة', en: 'GHAIMA AIR', role: 'شركة طيران', c1: '#3aa0ff', c2: '#ffffff', mark: 'cloud' },
  mawja: { ar: 'موجة 101', en: 'MAWJA 101', role: 'إذاعة', c1: '#0b3d5c', c2: '#2ee6c5', mark: 'wave' },
  nabd: { ar: 'نبض', en: 'NABD NEWS', role: 'قناة أخبار', c1: '#0b5d3b', c2: '#ffffff', mark: 'pulse' },
};

const AR_FONT = "'Tajawal','Noto Kufi Arabic','Noto Sans Arabic','Segoe UI',system-ui,sans-serif";
const cnv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const rr = (x, X, Y, W, H, R) => { x.beginPath(); x.roundRect(X, Y, W, H, R); };
let T = (k) => k; const REDRAW = [];
// keys starting with '=' are literal (web addresses)
const tx = (k) => (k.startsWith('=') ? k.slice(1) : T(k));
export function setTr(fn) { T = fn; REDRAW.forEach((f) => f()); }
// shrink a font until the text fits maxW
function fit(x, txt, weight, size, maxW) { let s = size; do { x.font = `${weight} ${s}px ${AR_FONT}`; s -= 2; } while (s > 10 && x.measureText(txt).width > maxW); }
const imgs = {}; const TEXC = {}; const cached = (k, f) => TEXC[k] || (TEXC[k] = f());
const MOB = /iPhone|iPad|iPod|Android|Mobile|PiBrowser/i.test(navigator.userAgent);
function img(key) { if (!imgs[key]) { const i = new Image(); i.src = IMG[key]; imgs[key] = i; } return imgs[key]; }
function mk(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
// draw into a canvas texture; redraw once the logo image has decoded
function live(w, h, draw, key) {
  const [c, x] = cnv(w, h); const t = mk(c); const go = () => { x.clearRect(0, 0, w, h); draw(x, w, h); t.needsUpdate = true; };
  go(); REDRAW.push(go); if (key) { const i = img(key); if (!i.complete) i.addEventListener('load', go, { once: true }); }
  return t;
}
function logo(x, key, cx, cy, maxW, maxH) {
  const i = img(key); if (!i.complete || !i.naturalWidth) return;
  const s = Math.min(maxW / i.naturalWidth, maxH / i.naturalHeight); const w = i.naturalWidth * s, h = i.naturalHeight * s; x.drawImage(i, cx - w / 2, cy - h / 2, w, h);
}
function wordmark(x, s, cx, cy, size) { x.fillStyle = s.ink; x.font = `900 ${size}px ${AR_FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(s.name, cx, cy); }

// full-screen ad card for the wall screen (16:9)
export function adCardTex(id) { return cached('adCardTex' + id, () => _adCardTex(id)); }
function _adCardTex(id) {
  const s = SPONSORS[id];
  return live(MOB ? 768 : 1280, MOB ? 432 : 720, (x, W, H) => { x.save(); x.scale(W / 1280, H / 720); W = 1280; H = 720;
    const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, s.bg); g.addColorStop(1, '#ffffff'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.fillStyle = s.accent; x.globalAlpha = 0.12; x.beginPath(); x.arc(W * 0.85, H * 0.2, 340, 0, 7); x.fill(); x.beginPath(); x.arc(W * 0.1, H * 0.95, 260, 0, 7); x.fill(); x.globalAlpha = 1;
    if (s.logo) logo(x, s.logo, W / 2, H * 0.38, W * 0.5, H * 0.42); else wordmark(x, s, W / 2, H * 0.38, 150);
    x.direction = 'inherit'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = s.ink; fit(x, tx(s.tag), 800, 64, W * 0.9); x.fillText(tx(s.tag), W / 2, H * 0.72);
    x.fillStyle = s.accent; fit(x, tx(s.sub), 600, 36, W * 0.9); x.fillText(tx(s.sub), W / 2, H * 0.84);
    x.fillStyle = s.accent; x.fillRect(W / 2 - 60, H * 0.62, 120, 6); x.restore();
  }, s.logo);
}
// "برعاية" plaque for the sponsor desk front (4:3)
export function plaqueTex(id) { return cached('plaqueTex' + id, () => _plaqueTex(id)); }
function _plaqueTex(id) {
  const s = SPONSORS[id];
  return live(512, 384, (x, W, H) => {
    x.fillStyle = 'rgba(0,0,0,.35)'; rr(x, 10, 14, W - 16, H - 18, 34); x.fill();
    x.fillStyle = s.bg; rr(x, 4, 4, W - 16, H - 18, 34); x.fill();
    x.textAlign = 'center'; x.fillStyle = s.ink; fit(x, T('ad_by'), 700, 40, W * 0.8); x.fillText(T('ad_by'), W / 2 - 6, 62);
    if (s.logo) logo(x, s.logo, W / 2 - 6, H / 2 + 34, W * 0.72, H * 0.55); else wordmark(x, s, W / 2 - 6, H / 2 + 30, 70);
  }, s.logo);
}
// bottle label band (wraps a cylinder)
export function labelTex(id) { return cached('labelTex' + id, () => _labelTex(id)); }
function _labelTex(id) {
  const s = SPONSORS[id];
  return live(1024, 256, (x, W, H) => {
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H); x.fillStyle = s.bg; x.fillRect(0, 0, W, H);
    x.strokeStyle = s.accent; x.lineWidth = 6; x.beginPath(); x.moveTo(0, 18); x.lineTo(W, 18); x.moveTo(0, H - 18); x.lineTo(W, H - 18); x.stroke();
    for (const cx of [W * 0.25, W * 0.75]) if (s.logo) logo(x, s.logo, cx, H / 2, 300, 170); else wordmark(x, s, cx, H / 2, 60);
  }, s.logo);
}
// shipping label for cardboard boxes
export function boxTex(id) { return cached('boxTex' + id, () => _boxTex(id)); }
function _boxTex(id) {
  const s = SPONSORS[id];
  return live(256, 256, (x, W, H) => {
    x.fillStyle = '#b98a55'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 700; i++) { x.fillStyle = `rgba(${90 + Math.random() * 60},${60 + Math.random() * 40},20,${0.05 + Math.random() * 0.08})`; x.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 6, 1); }
    x.fillStyle = 'rgba(210,190,150,.85)'; x.fillRect(0, 112, W, 30);
    x.fillStyle = '#f7f7f2'; x.fillRect(38, 150, 180, 92); x.fillStyle = s.accent; x.fillRect(38, 150, 180, 26);
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; fit(x, T('ad_ship'), 800, 17, 170); x.fillText(T('ad_ship'), 128, 164);
    x.fillStyle = s.ink; x.font = `900 44px ${AR_FONT}`; x.fillText(s.name, 128, 212);
    x.fillStyle = s.ink; x.font = `900 34px ${AR_FONT}`; x.fillText(s.name, 128, 60);
  }, s.logo);
}

// ELVA bottle: clear PET body, label band, white cap
export function bottle(id = 'elva', h = 0.28) {
  const g = new THREE.Group(); const r = h * 0.2;
  const glass = new THREE.MeshStandardMaterial({ color: 0xeaf4ff, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.45 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h * 0.72, 24), glass); body.position.y = h * 0.36; g.add(body);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.38, r, h * 0.18, 24), glass); neck.position.y = h * 0.81; g.add(neck);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.42, r * 0.42, h * 0.07, 20), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })); cap.position.y = h * 0.93; g.add(cap);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r * 0.92, h * 0.62, 24), new THREE.MeshStandardMaterial({ color: 0xcfe6ff, roughness: 0.05, transparent: true, opacity: 0.3 })); water.position.y = h * 0.32; g.add(water);
  const label = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.01, r * 1.01, h * 0.3, 32, 1, true), new THREE.MeshStandardMaterial({ map: labelTex(id), roughness: 0.5, side: THREE.DoubleSide })); label.position.y = h * 0.38; g.add(label);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// original marks for the fictional world brands
export function worldLogoTex(id, w = 512, h = 512) {
  const b = WORLD[id];
  return live(w, h, (x, W, H) => drawWorld(x, b, W, H));
}
export function drawWorld(x, b, W, H) {
  x.fillStyle = b.c1; rr(x, 0, 0, W, H, W * 0.18); x.fill();
  const cx = W / 2, cy = H * 0.4, u = W / 10; x.strokeStyle = b.c2; x.fillStyle = b.c2; x.lineWidth = u * 0.55; x.lineCap = 'round'; x.lineJoin = 'round';
  if (b.mark === 'bag') { rr(x, cx - 2 * u, cy - 1.2 * u, 4 * u, 3 * u, u * 0.5); x.fill(); x.beginPath(); x.arc(cx, cy - 1.2 * u, u, Math.PI, 0); x.stroke(); x.strokeStyle = b.c1; x.lineWidth = u * 0.4; x.beginPath(); x.moveTo(cx - 1.3 * u, cy + 0.4 * u); x.quadraticCurveTo(cx - 0.6 * u, cy - 0.3 * u, cx, cy + 0.4 * u); x.quadraticCurveTo(cx + 0.6 * u, cy + 1.1 * u, cx + 1.3 * u, cy + 0.4 * u); x.stroke(); }
  if (b.mark === 'eye') { x.beginPath(); x.moveTo(cx - 2.6 * u, cy); x.quadraticCurveTo(cx, cy - 2.4 * u, cx + 2.6 * u, cy); x.quadraticCurveTo(cx, cy + 2.4 * u, cx - 2.6 * u, cy); x.fill(); x.fillStyle = b.c1; x.beginPath(); x.moveTo(cx - 0.5 * u, cy - 0.8 * u); x.lineTo(cx + 0.9 * u, cy); x.lineTo(cx - 0.5 * u, cy + 0.8 * u); x.fill(); }
  if (b.mark === 'frame') { const d = 2 * u, k = 0.9 * u; [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => { x.beginPath(); x.moveTo(cx + sx * d, cy + sy * (d - k)); x.lineTo(cx + sx * d, cy + sy * d); x.lineTo(cx + sx * (d - k), cy + sy * d); x.stroke(); }); x.beginPath(); x.arc(cx, cy, 0.7 * u, 0, 7); x.fill(); }
  if (b.mark === 'arcs') { x.beginPath(); x.arc(cx - 1.6 * u, cy, 0.6 * u, 0, 7); x.fill(); [1.4, 2.5, 3.6].forEach((r) => { x.beginPath(); x.arc(cx - 1.6 * u, cy, r * u, -0.75, 0.75); x.stroke(); }); }
  if (b.mark === 'cloud') { x.beginPath(); x.arc(cx - 1.2 * u, cy + 0.3 * u, 1.1 * u, 0, 7); x.arc(cx + 0.2 * u, cy - 0.4 * u, 1.5 * u, 0, 7); x.arc(cx + 1.6 * u, cy + 0.4 * u, 1 * u, 0, 7); x.fill(); rr(x, cx - 2.3 * u, cy + 0.3 * u, 4.9 * u, 1.1 * u, 0.5 * u); x.fill(); x.strokeStyle = b.c1; x.lineWidth = u * 0.3; x.beginPath(); x.moveTo(cx - 2.8 * u, cy + 2 * u); x.lineTo(cx + 2.8 * u, cy + 1.2 * u); x.stroke(); }
  if (b.mark === 'wave') { [-1, 0, 1].forEach((k) => { x.beginPath(); for (let i = -2.6; i <= 2.6; i += 0.1) { const yy = cy + k * 1.1 * u + Math.sin(i * 2.2 + k) * 0.45 * u; i === -2.6 ? x.moveTo(cx + i * u, yy) : x.lineTo(cx + i * u, yy); } x.stroke(); }); }
  if (b.mark === 'pulse') { x.beginPath(); x.moveTo(cx - 2.8 * u, cy); x.lineTo(cx - 1.1 * u, cy); x.lineTo(cx - 0.5 * u, cy - 1.8 * u); x.lineTo(cx + 0.3 * u, cy + 1.6 * u); x.lineTo(cx + 0.9 * u, cy); x.lineTo(cx + 2.8 * u, cy); x.stroke(); }
  x.fillStyle = b.c2; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
  x.font = `900 ${W * 0.13}px ${AR_FONT}`; x.fillText(b.ar, cx, H * 0.74);
  x.direction = 'ltr'; x.font = `800 ${W * 0.06}px ${AR_FONT}`; x.globalAlpha = 0.85; x.fillText(b.en, cx, H * 0.87); x.globalAlpha = 1;
}
