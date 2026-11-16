// Studio look v2: procedural textures (galaxy wall, fluid-art screen, carbon fibre, cardboard) and detailed props
// (broadcast cameras, mixing console, boxes, crates, chest, figurine shelf, floor cables). No brand logos.
import * as THREE from 'three';
import { M, box, cyl, sph, tor } from './char.js';

const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const tex = (c, repeat) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); } return t; };
let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

const MOB = /iPhone|iPad|iPod|Android|Mobile|PiBrowser/i.test(navigator.userAgent);
export function galaxyTex() {
  const [c, x] = MOB ? canvas(1024, 512) : canvas(2048, 1024); if (MOB) x.scale(0.5, 0.5);
  const g = x.createLinearGradient(0, 0, 2048, 1024); g.addColorStop(0, '#07051a'); g.addColorStop(0.5, '#120a35'); g.addColorStop(1, '#05040f'); x.fillStyle = g; x.fillRect(0, 0, 2048, 1024);
  // nebula clouds
  for (let i = 0; i < 70; i++) {
    const cx = rnd() * 2048, cy = rnd() * 1024, r = 120 + rnd() * 380; const hue = [270, 285, 300, 250, 220][i % 5];
    const rg = x.createRadialGradient(cx, cy, 0, cx, cy, r); rg.addColorStop(0, `hsla(${hue},80%,55%,${0.08 + rnd() * 0.1})`); rg.addColorStop(1, 'hsla(0,0%,0%,0)');
    x.fillStyle = rg; x.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  // spiral galaxies
  [[1400, 380, 1], [1750, 640, 0.7], [600, 300, 0.55]].forEach(([gx, gy, s]) => {
    x.save(); x.translate(gx, gy); x.rotate(rnd() * 3); x.scale(1, 0.45);
    for (let k = 0; k < 2400; k++) { const a = k * 0.015, rr = (4 + a * 9) * s, arm = k % 2 ? Math.PI : 0; const px = Math.cos(a + arm) * rr + (rnd() - 0.5) * 14 * s, py = Math.sin(a + arm) * rr + (rnd() - 0.5) * 14 * s;
      x.fillStyle = `rgba(${200 + rnd() * 55},${170 + rnd() * 60},255,${0.25 + rnd() * 0.4})`; x.fillRect(px, py, 1.6, 1.6); }
    const core = x.createRadialGradient(0, 0, 0, 0, 0, 40 * s); core.addColorStop(0, 'rgba(255,240,220,.95)'); core.addColorStop(1, 'rgba(255,200,255,0)'); x.fillStyle = core; x.beginPath(); x.arc(0, 0, 40 * s, 0, 7); x.fill();
    x.restore();
  });
  // stars
  for (let i = 0; i < 4500; i++) { const b = rnd(); x.fillStyle = `rgba(255,255,255,${0.25 + b * 0.75})`; const s = b > 0.985 ? 2.6 : b > 0.93 ? 1.6 : 1; x.fillRect(rnd() * 2048, rnd() * 1024, s, s); }
  for (let i = 0; i < 40; i++) { const sx = rnd() * 2048, sy = rnd() * 1024, rg = x.createRadialGradient(sx, sy, 0, sx, sy, 10); rg.addColorStop(0, 'rgba(255,255,255,.9)'); rg.addColorStop(1, 'rgba(160,140,255,0)'); x.fillStyle = rg; x.fillRect(sx - 10, sy - 10, 20, 20); }
  return tex(c);
}

export function fluidTex() {
  const [c, x] = canvas(1024, 576); x.fillStyle = '#06030c'; x.fillRect(0, 0, 1024, 576);
  const cols = ['#ff2d95', '#ffb300', '#00c2ff', '#7c3aed', '#22c55e', '#ff5a1f', '#f43f5e', '#2563eb', '#facc15'];
  // big soft flowing ribbons: many overlapping wide strokes, blurred, then sharp highlights on top
  const ribbon = (blur, widthMul, alpha) => {
    x.filter = blur ? `blur(${blur}px)` : 'none';
    for (let i = 0; i < 28; i++) {
      const col = cols[(i * 5) % cols.length]; let px = rnd() * 1024, py = rnd() * 576, a = rnd() * 6.28; const w = (40 + rnd() * 70) * widthMul;
      x.strokeStyle = col; x.globalAlpha = alpha; x.lineCap = 'round'; x.lineJoin = 'round'; x.lineWidth = w;
      x.beginPath(); x.moveTo(px, py);
      for (let k = 0; k < 14; k++) { a += (rnd() - 0.5) * 1.3; const cx1 = px + Math.cos(a) * 60, cy1 = py + Math.sin(a) * 60; a += (rnd() - 0.5) * 1.3; px = cx1 + Math.cos(a) * 60; py = cy1 + Math.sin(a) * 60; x.quadraticCurveTo(cx1, cy1, px, py); }
      x.stroke();
    }
  };
  ribbon(22, 1.4, 0.55); ribbon(6, 0.6, 0.75); ribbon(0, 0.12, 0.6);
  x.filter = 'none'; x.globalAlpha = 1;
  const v = x.createRadialGradient(512, 288, 120, 512, 288, 620); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)'); x.fillStyle = v; x.fillRect(0, 0, 1024, 576);
  return tex(c);
}

export function monitorTex() {
  const [c, x] = canvas(512, 196); x.fillStyle = '#d9e6e2'; x.fillRect(0, 0, 512, 196);
  x.fillStyle = '#2b3a38'; x.fillRect(0, 0, 512, 22);
  [[8, 30], [134, 30], [260, 30], [386, 30]].forEach(([px, py], i) => {
    const g = x.createLinearGradient(px, py, px + 118, py + 76); g.addColorStop(0, ['#7aa','#a9c','#ca8','#8bc'][i]); g.addColorStop(1, '#556'); x.fillStyle = g; x.fillRect(px, py, 118, 76);
    x.strokeStyle = i === 0 ? '#e33' : '#9aa'; x.lineWidth = 3; x.strokeRect(px, py, 118, 76);
  });
  for (let i = 0; i < 24; i++) { x.fillStyle = `rgba(30,40,40,${0.25 + rnd() * 0.5})`; x.fillRect(10 + i * 21, 150 - rnd() * 30, 14, 36); }
  return tex(c);
}

export function carbonTex() {
  const [c, x] = canvas(256, 256); x.fillStyle = '#121216'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
    const g = x.createLinearGradient(i * 16, j * 16, i * 16 + 16, j * 16 + 16); const on = (i + j) % 2;
    g.addColorStop(0, on ? '#2a2a31' : '#18181d'); g.addColorStop(0.5, on ? '#3a3a44' : '#222229'); g.addColorStop(1, on ? '#1d1d22' : '#141418');
    x.fillStyle = g; x.fillRect(i * 16, j * 16, 16, 16);
  }
  return tex(c, [4, 2]);
}

export function emblemTex() {
  const [c, x] = canvas(256, 256); x.clearRect(0, 0, 256, 256);
  x.strokeStyle = '#e11d48'; x.lineWidth = 14; x.lineJoin = 'round';
  x.beginPath(); x.moveTo(40, 170); x.lineTo(128, 60); x.lineTo(216, 170); x.stroke();
  x.strokeStyle = '#f8fafc'; x.lineWidth = 8; x.beginPath(); x.moveTo(78, 190); x.lineTo(128, 128); x.lineTo(178, 190); x.stroke();
  return tex(c);
}

export function cardboardTex(label) {
  const [c, x] = canvas(256, 256); x.fillStyle = '#b98a55'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${90 + rnd() * 60},${60 + rnd() * 40},20,${0.05 + rnd() * 0.08})`; x.fillRect(rnd() * 256, rnd() * 256, 2 + rnd() * 6, 1); }
  x.fillStyle = 'rgba(210,190,150,.85)'; x.fillRect(0, 112, 256, 30);
  if (label) { x.fillStyle = '#f5f5f0'; x.fillRect(150, 160, 86, 54); x.fillStyle = '#222'; x.font = 'bold 15px system-ui'; x.fillText(label, 158, 186); x.fillRect(158, 196, 60, 3); }
  return tex(c);
}

const P = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; return m; };
const at = (o, x, y, z, parent) => { o.position.set(x, y, z); if (parent) parent.add(o); return o; };

// detailed broadcast camera on a tripod; returns { g, tally }
export function broadcastCam(n, labelTex) {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x2b2d33, roughness: 0.45, metalness: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.35, metalness: 0.5 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.85 });
  [0, 2.09, 4.19].forEach((a) => { const l = P(new THREE.CylinderGeometry(0.022, 0.03, 1.45, 12), metal); l.position.set(Math.sin(a) * 0.3, 0.68, Math.cos(a) * 0.3); l.rotation.set(Math.cos(a) * 0.4, 0, -Math.sin(a) * 0.4); g.add(l); });
  at(P(new THREE.CylinderGeometry(0.07, 0.09, 0.12, 24), dark), 0, 1.38, 0, g);
  const body = at(P(new THREE.BoxGeometry(0.34, 0.3, 0.56), metal), 0, 1.6, 0.02, g);
  at(P(new THREE.BoxGeometry(0.36, 0.06, 0.5), dark), 0, 1.78, 0.04, g);
  // viewfinder
  at(P(new THREE.BoxGeometry(0.22, 0.14, 0.18), dark), 0.02, 1.86, 0.22, g);
  const vf = at(new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.1), new THREE.MeshBasicMaterial({ color: 0x6fd3ff })), 0.02, 1.86, 0.312, g);
  // knobs on the side
  [[0.18, 1.62, 0.05], [0.18, 1.62, 0.18]].forEach(([kx, ky, kz]) => { const k = P(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 28), dark); k.rotation.z = Math.PI / 2; at(k, kx, ky, kz, g);
    for (let r = 0; r < 12; r++) { const t = P(new THREE.BoxGeometry(0.03, 0.008, 0.008), metal); const a = (r / 12) * Math.PI * 2; t.position.set(kx + 0.005, ky + Math.cos(a) * 0.045, kz + Math.sin(a) * 0.045); g.add(t); } });
  // lens: barrel + knurled grip rings + glass
  const lens = new THREE.Group(); lens.position.set(0, 1.6, -0.26); g.add(lens);
  const barrel = P(new THREE.CylinderGeometry(0.11, 0.12, 0.42, 40, 1), dark); barrel.rotation.x = Math.PI / 2; barrel.position.z = -0.21; lens.add(barrel);
  [-0.08, -0.2, -0.32].forEach((z, i) => { const ring = P(new THREE.CylinderGeometry(0.128, 0.128, 0.06, 64), rubber); ring.rotation.x = Math.PI / 2; ring.position.z = z; lens.add(ring);
    for (let r = 0; r < 36; r++) { const rib = P(new THREE.BoxGeometry(0.012, 0.012, 0.058), i === 1 ? metal : rubber); const a = (r / 36) * Math.PI * 2; rib.position.set(Math.cos(a) * 0.13, Math.sin(a) * 0.13, z); lens.add(rib); } });
  const hood = P(new THREE.CylinderGeometry(0.15, 0.125, 0.08, 40, 1, true), dark); hood.material = dark; hood.rotation.x = Math.PI / 2; hood.position.z = -0.45; lens.add(hood);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.11, 48), new THREE.MeshPhysicalMaterial({ color: 0x0a0f1c, roughness: 0.03, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.02, iridescence: 0.8, iridescenceIOR: 1.6 }));
  glass.position.z = -0.43; glass.rotation.y = Math.PI; lens.add(glass);
  // tally + number plates
  const tally = at(new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), new THREE.MeshStandardMaterial({ color: 0xff2038, emissive: 0xff2038, emissiveIntensity: 7 })), 0, 1.84, -0.18, g);
  [1, -1].forEach((s) => { const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), new THREE.MeshBasicMaterial({ map: labelTex, toneMapped: false })); lab.position.set(0.172 * s, 1.6, -0.08); lab.rotation.y = (Math.PI / 2) * s; g.add(lab); });
  // pan bar
  const bar = P(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 10), metal); bar.rotation.x = Math.PI / 2 - 0.3; at(bar, 0.12, 1.5, 0.45, g);
  return { g, tally };
}

// mixing console details on top of an existing desk (x,z = desk centre; y = top surface)
export function mixerTop(parent, cx, y, cz) {
  const grp = new THREE.Group(); grp.position.set(cx, y, cz); parent.add(grp);
  const panel = new THREE.MeshStandardMaterial({ color: 0x23242b, roughness: 0.5, metalness: 0.4 });
  at(P(new THREE.BoxGeometry(1.4, 0.03, 0.62), panel), 0, 0.015, 0, grp);
  const knobCols = [0xd94848, 0x2b6cb0, 0xd94848, 0x1f8a8a, 0xd97706];
  for (let i = 0; i < 6; i++) {
    const fx = -0.62 + i * 0.1;
    at(new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.004, 0.22), new THREE.MeshBasicMaterial({ color: 0x050505 })), fx, 0.033, 0.12, grp);
    at(P(new THREE.BoxGeometry(0.05, 0.035, 0.03), new THREE.MeshStandardMaterial({ color: 0xd8d8de, roughness: 0.35, metalness: 0.3 })), fx, 0.05, 0.06 + (i % 3) * 0.04, grp);
    const k = P(new THREE.CylinderGeometry(0.022, 0.026, 0.035, 24), new THREE.MeshStandardMaterial({ color: knobCols[i % 5], roughness: 0.4 })); at(k, fx, 0.05, -0.12, grp);
    const k2 = P(new THREE.CylinderGeometry(0.018, 0.022, 0.03, 24), new THREE.MeshStandardMaterial({ color: 0x18181c, roughness: 0.4 })); at(k2, fx, 0.048, -0.2, grp);
  }
  const btnCols = [0xe5e7eb, 0xe5e7eb, 0xef4444, 0x22c55e, 0x60a5fa, 0xe5e7eb];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
    const col = btnCols[(r * 6 + c * 5) % btnCols.length];
    const b = P(new THREE.BoxGeometry(0.06, 0.02, 0.045), new THREE.MeshStandardMaterial({ color: col === 0xe5e7eb ? 0xa9adb6 : col, roughness: 0.7, emissive: col === 0xef4444 || col === 0x22c55e ? col : 0, emissiveIntensity: 0.25 }));
    at(b, 0.1 + c * 0.075, 0.04, -0.17 + r * 0.075, grp);
  }
  const lcd = at(new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.07), new THREE.MeshBasicMaterial({ color: 0xbfe9ff, toneMapped: false })), -0.36, 0.034, -0.27, grp); lcd.rotation.x = -Math.PI / 2;
  return grp;
}

export function crate(color = 0x2563eb) {
  const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color, roughness: 0.55 });
  at(P(new THREE.BoxGeometry(0.62, 0.4, 0.44), m), 0, 0.2, 0, g);
  for (let i = 0; i < 4; i++) at(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.005), new THREE.MeshBasicMaterial({ color: 0x0b2a6f })), -0.18 + i * 0.12, 0.3, 0.223, g);
  return g;
}
export function chest() {
  const g = new THREE.Group(); const wood = new THREE.MeshStandardMaterial({ color: 0x5b3a1e, roughness: 0.7 }); const band = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.3, metalness: 0.85 });
  at(P(new THREE.BoxGeometry(0.8, 0.42, 0.5), wood), 0, 0.21, 0, g);
  const lid = P(new THREE.CylinderGeometry(0.25, 0.25, 0.8, 24, 1, false, 0, Math.PI), wood); lid.rotation.z = Math.PI / 2; lid.rotation.y = Math.PI / 2; at(lid, 0, 0.42, 0, g);
  [-0.28, 0.28].forEach((x) => { at(P(new THREE.BoxGeometry(0.05, 0.44, 0.52), band), x, 0.22, 0, g); });
  at(P(new THREE.BoxGeometry(0.09, 0.11, 0.03), band), 0, 0.36, 0.26, g);
  return g;
}
export function cardboard(w, h, d, label) {
  const mat = new THREE.MeshStandardMaterial({ map: cardboardTex(label), roughness: 0.9 });
  return P(new THREE.BoxGeometry(w, h, d), mat);
}
export function cableTo(parent, pts) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0.025, z)));
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.018, 8, false), new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.6 }));
  m.receiveShadow = true; parent.add(m); return m;
}
export const lab = (n) => { const [c, x] = canvas(128, 128); x.fillStyle = '#ffcf3f'; x.fillRect(0, 0, 128, 128); x.fillStyle = '#1a1300'; x.font = 'bold 96px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(n), 64, 70); return tex(c); };
