// Studio customisation: equipped furniture / decor cards appear as objects in the studio, set cards repaint the walls.
import * as THREE from 'three';

const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: o.rough ?? 0.7, metalness: o.metal ?? 0.05, emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1 });
const box = (g, w, h, d, c, x, y, z, o) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(c, o)); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
const cyl = (g, r1, r2, h, c, x, y, z, o) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, 20), M(c, o)); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
const sph = (g, r, c, x, y, z, o) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), M(c, o)); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
// trim colour improves with the card level: wood → steel → gold → glowing
const trim = (lv) => (lv >= 13 ? { c: 0x7fe9ff, o: { emissive: 0x2ab8ff, ei: 1.2, metal: 0.6, rough: 0.3 } } : lv >= 9 ? { c: 0xd4af37, o: { metal: 0.8, rough: 0.3 } } : lv >= 5 ? { c: 0xb8bcc8, o: { metal: 0.7, rough: 0.35 } } : { c: 0x6b4a2e, o: {} });

// where each family goes: floor (furniture), wall, deco (floor decor), hang (ceiling)
export const KIND = {
  sofa: 'floor', anchor: 'floor', desk: 'floor', meeting: 'floor', shelf: 'floor', rug: 'floor', majlis: 'floor', bed: 'floor', wardrobe: 'floor', coffeetable: 'floor', gaming: 'floor', beanbag: 'floor',
  neon: 'wall', painting: 'wall', clock: 'wall', awards: 'wall', curtain: 'wall', led: 'wall', plants: 'deco', palm: 'deco', fountain: 'deco', statue: 'deco', lantern: 'hang', disco: 'hang',
};

export function buildProp(fam, lv) {
  const g = new THREE.Group(), T = trim(lv), t = T.c, to = T.o;
  switch (fam) {
    case 'sofa': box(g, 1.7, 0.4, 0.75, 0x5a3a2a, 0, 0.3, 0); box(g, 1.7, 0.55, 0.2, 0x4a2e20, 0, 0.72, -0.28); box(g, 0.2, 0.5, 0.75, 0x4a2e20, -0.85, 0.5, 0); box(g, 0.2, 0.5, 0.75, 0x4a2e20, 0.85, 0.5, 0); box(g, 1.8, 0.08, 0.8, t, 0, 0.06, 0, to); break;
    case 'anchor': cyl(g, 0.28, 0.28, 0.08, t, 0, 0.05, 0, to); cyl(g, 0.04, 0.04, 0.4, 0x333333, 0, 0.28, 0); box(g, 0.55, 0.1, 0.55, 0x23233a, 0, 0.52, 0); box(g, 0.55, 0.75, 0.1, 0x23233a, 0, 0.92, -0.23); break;
    case 'desk': box(g, 1.8, 0.1, 0.8, t, 0, 0.92, 0, to); box(g, 1.7, 0.85, 0.1, 0x1f3a6b, 0, 0.45, 0.3); box(g, 0.1, 0.85, 0.7, 0x1f3a6b, -0.8, 0.45, 0); box(g, 0.1, 0.85, 0.7, 0x1f3a6b, 0.8, 0.45, 0); break;
    case 'meeting': cyl(g, 0.8, 0.8, 0.07, t, 0, 0.75, 0, to); cyl(g, 0.1, 0.25, 0.72, 0x333333, 0, 0.37, 0); [[-1.05, 0], [1.05, 0], [0, 1.05]].forEach(([x, z]) => { box(g, 0.4, 0.07, 0.4, 0x555a66, x, 0.45, z); box(g, 0.04, 0.45, 0.04, 0x333333, x, 0.22, z); }); break;
    case 'shelf': box(g, 1.2, 2.0, 0.35, 0x5a4028, 0, 1.0, 0); for (let i = 0; i < 4; i++) { box(g, 1.1, 0.04, 0.36, t, 0, 0.3 + i * 0.5, 0.01, to); for (let k = 0; k < 5; k++) box(g, 0.1, 0.3, 0.22, [0xd9342b, 0x2e7df6, 0x19a05e, 0xffcf3f, 0x8a63f0][(i + k) % 5], -0.4 + k * 0.2, 0.47 + i * 0.5, 0.05); } break;
    case 'rug': { const r = new THREE.Mesh(new THREE.CircleGeometry(1.3, 40), M(0x8a1f3a)); r.rotation.x = -Math.PI / 2; r.position.y = 0.016; g.add(r); const r2 = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.2, 40), M(t, to)); r2.rotation.x = -Math.PI / 2; r2.position.y = 0.02; g.add(r2); break; }
    case 'majlis': box(g, 2.2, 0.25, 0.7, 0x8a1f3a, 0, 0.13, 0); box(g, 2.2, 0.45, 0.18, 0x6f1830, 0, 0.47, -0.27); [-0.8, 0, 0.8].forEach((x) => box(g, 0.5, 0.2, 0.3, t, x, 0.35, 0.05, to)); break;
    case 'bed': box(g, 1.2, 0.35, 2.0, 0x5a4028, 0, 0.18, 0); box(g, 1.15, 0.2, 1.9, 0xf2f2f2, 0, 0.45, 0); box(g, 1.2, 0.8, 0.1, t, 0, 0.6, -1.0, to); box(g, 0.5, 0.12, 0.3, 0xcfe0ff, 0, 0.6, -0.7); break;
    case 'wardrobe': box(g, 1.3, 2.1, 0.55, 0x5a4028, 0, 1.05, 0); box(g, 0.02, 2.0, 0.02, 0x222222, 0, 1.05, 0.28); [-0.12, 0.12].forEach((x) => box(g, 0.04, 0.3, 0.04, t, x, 1.05, 0.3, to)); break;
    case 'coffeetable': cyl(g, 0.5, 0.5, 0.06, t, 0, 0.42, 0, to); cyl(g, 0.06, 0.2, 0.4, 0x333333, 0, 0.2, 0); cyl(g, 0.09, 0.07, 0.18, 0xd4af37, 0.12, 0.54, 0, { metal: 0.8, rough: 0.3 }); cyl(g, 0.04, 0.03, 0.06, 0xffffff, -0.15, 0.48, 0.1); break;
    case 'gaming': cyl(g, 0.3, 0.3, 0.06, 0x222222, 0, 0.05, 0); cyl(g, 0.04, 0.04, 0.4, 0x333333, 0, 0.27, 0); box(g, 0.55, 0.12, 0.55, 0x111111, 0, 0.52, 0); box(g, 0.55, 0.95, 0.12, 0x111111, 0, 1.02, -0.22); box(g, 0.1, 0.9, 0.13, t === 0x6b4a2e ? 0xd9342b : t, 0, 1.02, -0.215, to); break;
    case 'beanbag': { const b = sph(g, 0.55, t === 0x6b4a2e ? 0xff8a3d : t, 0, 0.35, 0, to); b.scale.set(1, 0.65, 1); const b2 = sph(g, 0.35, 0xffa45c, 0, 0.62, -0.2); b2.scale.set(1.1, 0.8, 0.8); break; }
    // wall pieces face +z; the caller rotates them onto the wall
    case 'neon': box(g, 1.5, 0.6, 0.06, 0x15102e, 0, 0, 0); box(g, 1.3, 0.08, 0.04, 0xff4fa8, 0, 0.15, 0.04, { emissive: 0xff4fa8, ei: 1.6 }); box(g, 0.9, 0.08, 0.04, 0x22d3ee, 0, -0.1, 0.04, { emissive: 0x22d3ee, ei: 1.6 }); break;
    case 'painting': box(g, 1.2, 0.9, 0.06, t, 0, 0, 0, to); box(g, 1.05, 0.75, 0.02, 0x2e7df6, 0, 0, 0.035); box(g, 1.05, 0.3, 0.02, 0xffcf3f, 0, -0.22, 0.04); sph(g, 0.12, 0xff8a3d, 0.25, 0.15, 0.03); break;
    case 'clock': { const c = cyl(g, 0.4, 0.4, 0.06, 0xffffff, 0, 0, 0); c.rotation.x = Math.PI / 2; const r = cyl(g, 0.44, 0.44, 0.04, t, 0, 0, -0.01, to); r.rotation.x = Math.PI / 2; box(g, 0.03, 0.26, 0.02, 0x111111, 0, 0.11, 0.04); box(g, 0.18, 0.03, 0.02, 0x111111, 0.08, 0, 0.04); break; }
    case 'awards': box(g, 1.4, 0.06, 0.25, t, 0, -0.3, 0.1, to); [-0.45, 0, 0.45].forEach((x, i) => { cyl(g, 0.06, 0.09, 0.08, 0x222222, x, -0.23, 0.1); cyl(g, 0.09, 0.04, 0.22, 0xd4af37, x, -0.08, 0.1, { metal: 0.9, rough: 0.25 }); if (i === 1) sph(g, 0.07, 0xd4af37, x, 0.08, 0.1, { metal: 0.9, rough: 0.25 }); }); break;
    case 'curtain': for (let i = 0; i < 7; i++) box(g, 0.24, 2.4, 0.1 + (i % 2) * 0.06, i % 2 ? 0x8a1220 : 0xa3182a, -0.75 + i * 0.25, 0, 0.05); box(g, 1.9, 0.12, 0.2, t, 0, 1.22, 0.05, to); break;
    case 'led': [0xff4fa8, 0x22d3ee, 0x34f59a, 0xffcf3f].forEach((c, i) => box(g, 1.6, 0.05, 0.04, c, 0, 0.45 - i * 0.3, 0, { emissive: c, ei: 1.8 })); break;
    case 'plants': cyl(g, 0.25, 0.2, 0.45, t === 0x6b4a2e ? 0xd9d2c5 : t, 0, 0.22, 0, to); [[0, 0.85, 0, 0.38], [0.18, 0.7, 0.1, 0.26], [-0.16, 0.74, -0.08, 0.28]].forEach(([x, y, z, r]) => sph(g, r, 0x2f9e5b, x, y, z)); break;
    case 'palm': cyl(g, 0.12, 0.18, 2.2, 0x7a5230, 0, 1.1, 0); for (let i = 0; i < 6; i++) { const l = box(g, 1.1, 0.04, 0.26, 0x2f9e5b, 0, 2.25, 0); l.rotation.y = (i / 6) * Math.PI * 2; l.rotation.z = -0.45; l.translateX(0.5); } cyl(g, 0.3, 0.26, 0.3, t === 0x6b4a2e ? 0xc98f4e : t, 0, 0.15, 0, to); break;
    case 'fountain': cyl(g, 0.7, 0.75, 0.3, 0xbfc5cf, 0, 0.15, 0); cyl(g, 0.6, 0.6, 0.05, 0x4cc9f0, 0, 0.3, 0, { emissive: 0x1c7fa8, ei: 0.6 }); cyl(g, 0.1, 0.14, 0.7, t, 0, 0.6, 0, to); cyl(g, 0.3, 0.1, 0.1, 0xbfc5cf, 0, 0.95, 0); sph(g, 0.1, 0x9fe6ff, 0, 1.1, 0, { emissive: 0x4cc9f0, ei: 0.8 }); break;
    case 'statue': box(g, 0.6, 0.5, 0.6, t, 0, 0.25, 0, to); cyl(g, 0.16, 0.2, 0.7, 0xd9d9de, 0, 0.85, 0); sph(g, 0.2, 0xd9d9de, 0, 1.38, 0); box(g, 0.5, 0.12, 0.14, 0xd9d9de, 0, 1.05, 0); break;
    case 'lantern': cyl(g, 0.01, 0.01, 0.6, 0x333333, 0, 0.3, 0); cyl(g, 0.16, 0.22, 0.42, 0xffb347, 0, -0.2, 0, { emissive: 0xff8a1c, ei: 1.5 }); cyl(g, 0.12, 0.2, 0.12, t === 0x6b4a2e ? 0xd4af37 : t, 0, 0.06, 0, { metal: 0.8, rough: 0.3 }); cyl(g, 0.2, 0.1, 0.1, 0xd4af37, 0, -0.46, 0, { metal: 0.8, rough: 0.3 }); break;
    case 'disco': cyl(g, 0.01, 0.01, 0.5, 0x333333, 0, 0.25, 0); { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 1), new THREE.MeshStandardMaterial({ color: 0xe8eef8, metalness: 0.55, roughness: 0.45, flatShading: true })); b.position.y = -0.3; g.add(b); g.userData.spin = b; } break;
    default: box(g, 0.5, 0.5, 0.5, t, 0, 0.25, 0, to);
  }
  g.scale.setScalar(1 + Math.min(14, lv - 1) * 0.012);
  return g;
}

// painted backdrop for a "set" card: sky gradient + simple silhouettes
const SETS = {
  desert: ['#1b1440', '#e08a4a', 'dunes', '#8a4a1c'], skyline: ['#10183a', '#f08a5d', 'city', '#0b1024'], space: ['#05030f', '#2a1466', 'stars', '#ffffff'], beach: ['#4cc9f0', '#ffe9a8', 'waves', '#1c8fc0'],
  forest: ['#0f3a24', '#8fd19e', 'trees', '#0a2616'], mountain: ['#6fa8dc', '#e6eef7', 'peaks', '#4a5a70'], ocean: ['#04304f', '#1c9bbd', 'waves', '#0b6a8c'], stadium: ['#0f2a14', '#3aa655', 'city', '#e8f5e8'],
  souq: ['#5a2e12', '#e0a35a', 'city', '#3a1c0a'], gala: ['#3a0612', '#b01a34', 'stars', '#ffd76a'],
};
export const setWall = (fam) => (SETS[fam] ? new THREE.Color(SETS[fam][0]) : null);
const TEXC = {};
export function backdropTex(fam) {
  if (TEXC[fam]) return TEXC[fam]; const [a, b, kind, c] = SETS[fam]; const W = 1024, H = 420, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, a); g.addColorStop(1, b); x.fillStyle = g; x.fillRect(0, 0, W, H); x.fillStyle = c; let s = 7; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  if (kind === 'stars') for (let i = 0; i < 220; i++) { x.globalAlpha = 0.4 + rnd() * 0.6; x.beginPath(); x.arc(rnd() * W, rnd() * H, 0.6 + rnd() * 2.2, 0, 7); x.fill(); }
  if (kind === 'dunes') [[0.75, 60], [0.86, 40]].forEach(([y, amp], k) => { x.globalAlpha = 0.7 + k * 0.3; x.beginPath(); x.moveTo(0, H); for (let i = 0; i <= W; i += 16) x.lineTo(i, H * y + Math.sin(i / 130 + k * 2) * amp); x.lineTo(W, H); x.fill(); });
  if (kind === 'waves') [0.7, 0.8, 0.9].forEach((y, k) => { x.globalAlpha = 0.5 + k * 0.2; x.beginPath(); x.moveTo(0, H); for (let i = 0; i <= W; i += 10) x.lineTo(i, H * y + Math.sin(i / 40 + k * 1.7) * 10); x.lineTo(W, H); x.fill(); });
  if (kind === 'city') for (let i = 0; i < W; i += 46) { const h = 80 + rnd() * 190; x.globalAlpha = 0.95; x.fillRect(i, H - h, 40, h); }
  if (kind === 'trees') for (let i = 0; i < W; i += 60) { const h = 150 + rnd() * 130; x.beginPath(); x.moveTo(i, H); x.lineTo(i + 35, H - h); x.lineTo(i + 70, H); x.fill(); }
  if (kind === 'peaks') for (let i = -80; i < W; i += 170) { const h = 180 + rnd() * 140; x.globalAlpha = 0.9; x.beginPath(); x.moveTo(i, H); x.lineTo(i + 130, H - h); x.lineTo(i + 260, H); x.fill(); }
  x.globalAlpha = 1; const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return (TEXC[fam] = t);
}
