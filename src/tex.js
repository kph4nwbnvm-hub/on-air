// Procedural real-world surface textures (drawn once on a canvas, cached): wood grain, upholstery fabric and acoustic wall panels.
import * as THREE from 'three';
const C = {};
const mk = (key, size, draw, rep = 1) => C[key] || (C[key] = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = size; draw(cv.getContext('2d'), size); const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; })());
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
// light grey base so the material colour tints it
export const woodTex = () => mk('wood', 512, (x, S) => {
  x.fillStyle = '#c9c9c9'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 140; i++) { const y = rnd() * S, a = 0.05 + rnd() * 0.12, w = 1 + rnd() * 3; x.strokeStyle = `rgba(60,60,60,${a})`; x.lineWidth = w; x.beginPath(); x.moveTo(0, y);
    for (let px = 0; px <= S; px += 16) x.lineTo(px, y + Math.sin(px / (40 + rnd() * 30) + i) * (2 + rnd() * 4)); x.stroke(); }
  for (let i = 0; i < 6; i++) { const cx = rnd() * S, cy = rnd() * S, r = 4 + rnd() * 9; const g = x.createRadialGradient(cx, cy, 0, cx, cy, r * 2.5); g.addColorStop(0, 'rgba(50,50,50,0.35)'); g.addColorStop(1, 'rgba(50,50,50,0)'); x.fillStyle = g; x.beginPath(); x.ellipse(cx, cy, r * 2.5, r, 0, 0, 7); x.fill(); }
});
export const fabricTex = () => mk('fabric', 256, (x, S) => {
  x.fillStyle = '#d4d4d4'; x.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 2) { x.fillStyle = `rgba(0,0,0,${0.05 + (y % 4 ? 0.03 : 0)})`; x.fillRect(0, y, S, 1); }
  for (let px = 0; px < S; px += 2) { x.fillStyle = 'rgba(255,255,255,0.05)'; x.fillRect(px, 0, 1, S); }
  for (let i = 0; i < 4000; i++) { x.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${0.04 + rnd() * 0.05})`; x.fillRect(rnd() * S, rnd() * S, 1, 1); }
}, 4);
// acoustic panels: soft fabric squares with dark seams, 1 tile = 1.2 m
export const panelTex = () => mk('panel', 512, (x, S) => {
  x.fillStyle = '#1a1a1a'; x.fillRect(0, 0, S, S); const n = 2, p = S / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const g = x.createLinearGradient(i * p, j * p, i * p + p, j * p + p); g.addColorStop(0, '#d8d8d8'); g.addColorStop(1, '#bdbdbd'); x.fillStyle = g; x.fillRect(i * p + 5, j * p + 5, p - 10, p - 10);
    for (let k = 0; k < 1800; k++) { x.fillStyle = `rgba(0,0,0,${0.03 + rnd() * 0.05})`; x.fillRect(i * p + 5 + rnd() * (p - 10), j * p + 5 + rnd() * (p - 10), 1, 1); } }
});
const WOOD = new Set([0x5a4028, 0x6b4a2e, 0x4a2e20, 0x5a3a2a, 0x8a5a2b, 0x7a5230, 0xc98f4e]);
export const isWood = (c) => WOOD.has(c);
