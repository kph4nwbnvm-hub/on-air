import * as THREE from 'three';

// Physically based materials (lit by the studio environment map): metals for gold/chrome, soft plastics, fabric.
const GOLD = new Set([0xffcf3f, 0xd4af37, 0xffd23f]);
const lum = (c) => (((c >> 16) & 255) * 0.299 + ((c >> 8) & 255) * 0.587 + (c & 255) * 0.114) / 255;
export const M = (c, o = {}) => {
  const gold = GOLD.has(c), dark = lum(c) < 0.12;
  return new THREE.MeshStandardMaterial({
    color: c, roughness: o.rough ?? (gold ? 0.32 : dark ? 0.5 : 0.66), metalness: o.metal ?? (gold ? 0.8 : 0.0),
    emissive: o.emissive || 0x000000, emissiveIntensity: o.emissiveIntensity === undefined ? 1 : o.emissiveIntensity,
    transparent: !!o.transparent, opacity: o.opacity === undefined ? 1 : o.opacity,
  });
};
export const box = (w, h, d, c, o) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(c, o));
export const cyl = (r1, r2, h, c, o, seg = 24) => new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, Math.max(seg, 32)), M(c, o));
export const sph = (r, c, o) => new THREE.Mesh(new THREE.SphereGeometry(r, 36, 26), M(c, o));
export const cap = (r, l, c, o) => new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 10, 24), M(c, o));
export const tor = (r, t, c, arc = Math.PI * 2) => new THREE.Mesh(new THREE.TorusGeometry(r, t, 12, 40, arc), M(c));
export function at(m, x, y, z, parent) { m.position.set(x, y, z); if (parent) parent.add(m); return m; }

export const OPT = {
  skin: [0xf6d3b3, 0xf0c8a0, 0xd9a877, 0xc68e62, 0x9a6a44, 0x6b4630],
  hairColor: [0x1c130d, 0x2a1c14, 0x5a3a1c, 0x8a5a2b, 0xd9b36a, 0xb0b0b8, 0xd9342b, 0x3a6cff, 0xeae6df],
  hairStyle: 6, beard: ['none', 'full', 'goatee', 'mustache'],
  top: ['tshirt', 'hoodie', 'jacket'], bottom: ['pants', 'shorts'],
  cloth: [0x2e7df6, 0xd9342b, 0x19a05e, 0xffcf3f, 0xff8a3d, 0x8a63f0, 0xffffff, 0x23233a, 0xff6fa8, 0x2ab8b0, 0xd4af37, 0xc8ccd6],
  shoes: [0xffffff, 0x222222, 0xd9342b, 0xffcf3f, 0x2e7df6, 0xd4af37],
  acc: ['cap', 'glasses', 'headphones', 'earring', 'chain', 'bracelet', 'watch', 'bag'],
};
export const DEFAULT_AVATAR = { skin: 1, hairStyle: 0, hairColor: 1, beard: 0, top: 1, topColor: 0, bottom: 0, bottomColor: 7, shoes: 0, capColor: 1, acc: {} };

export function makeChar(a) {
  a = { ...DEFAULT_AVATAR, ...a, acc: { ...(a.acc || {}) } };
  const skin = OPT.skin[a.skin], hairC = OPT.hairColor[a.hairColor], topC = OPT.cloth[a.topColor], botC = OPT.cloth[a.bottomColor];
  const top = OPT.top[a.top], bottom = OPT.bottom[a.bottom];
  const g = new THREE.Group(); const p = {};
  const pivot = (x, y) => { const v = new THREE.Group(); v.position.set(x, y, 0); g.add(v); return v; };
  // legs
  [-1, 1].forEach((s) => {
    const L = pivot(0.13 * s, 0.62);
    if (bottom === 'pants') at(cap(0.095, 0.42, botC), 0, -0.25, 0, L);
    else { at(cap(0.105, 0.14, botC), 0, -0.1, 0, L); at(cap(0.08, 0.3, skin), 0, -0.36, 0, L); }
    { const sh = at(cap(0.085, 0.16, OPT.shoes[a.shoes], { rough: 0.45 }), 0, -0.6, 0.06, L); sh.rotation.x = Math.PI / 2; sh.scale.set(1.05, 1, 0.7); at(box(0.17, 0.025, 0.32, 0xd9d9d9, { rough: 0.85 }), 0, -0.655, 0.06, L); }
    p[s < 0 ? 'legL' : 'legR'] = L;
  });
  // torso
  at(cap(0.25, 0.42, topC), 0, 0.98, 0, g);
  if (top === 'tshirt') at(cyl(0.07, 0.07, 0.02, 0xffffff), 0, 1.08, 0.245, g).rotation.x = Math.PI / 2;
  if (top === 'hoodie') {
    const hood = at(sph(0.2, topC), 0, 1.4, -0.17, g); hood.scale.set(1.25, 0.8, 0.9);
    at(box(0.28, 0.13, 0.03, topC), 0, 0.84, 0.25, g);
    at(cyl(0.01, 0.01, 0.16, 0xffffff), -0.05, 1.2, 0.25, g); at(cyl(0.01, 0.01, 0.16, 0xffffff), 0.05, 1.2, 0.25, g);
  }
  if (top === 'jacket') { at(box(0.1, 0.56, 0.02, 0xffffff), 0, 1.0, 0.25, g); at(box(0.34, 0.06, 0.3, topC), 0, 1.3, 0, g); }
  // arms
  [-1, 1].forEach((s) => {
    const A = pivot(0.33 * s, 1.28);
    if (top === 'tshirt') { at(cap(0.07, 0.4, skin), 0, -0.24, 0, A); at(cap(0.09, 0.1, topC), 0, -0.08, 0, A); } else at(cap(0.08, 0.4, topC), 0, -0.24, 0, A);
    at(sph(0.085, skin), 0, -0.56, 0, A);
    if (s < 0 && a.acc.bracelet) at(tor(0.085, 0.02, 0xffcf3f), 0, -0.46, 0, A).rotation.x = Math.PI / 2;
    if (s > 0 && a.acc.watch) { at(tor(0.085, 0.018, 0x222222), 0, -0.46, 0, A).rotation.x = Math.PI / 2; at(box(0.07, 0.05, 0.03, 0x4cc9f0), 0, -0.46, 0.085, A); }
    p[s < 0 ? 'armL' : 'armR'] = A;
  });
  at(cyl(0.09, 0.1, 0.1, skin), 0, 1.42, 0, g);
  if (a.acc.chain) { const c = at(tor(0.13, 0.014, 0xffcf3f), 0, 1.36, 0.06, g); c.rotation.x = Math.PI / 2 - 0.5; }
  if (a.acc.bag) { at(box(0.38, 0.44, 0.17, 0x8a5a2b), 0, 1.02, -0.3, g); at(box(0.3, 0.12, 0.03, 0x6b4520), 0, 0.95, -0.39, g); at(box(0.05, 0.5, 0.5, 0x6b4520), -0.17, 1.1, -0.05, g); at(box(0.05, 0.5, 0.5, 0x6b4520), 0.17, 1.1, -0.05, g); }
  // head
  const head = at(sph(0.25, skin), 0, 1.66, 0, g); p.head = head;
  [-0.09, 0.09].forEach((x) => {
    const w = at(sph(0.05, 0xffffff, { rough: 0.15 }), x, 0.02, 0.205, head); w.scale.set(1, 1.1, 0.6);
    at(sph(0.032, 0x3b2414, { rough: 0.1 }), x, 0.018, 0.232, head); at(sph(0.017, 0x050505, { rough: 0.05 }), x, 0.018, 0.249, head);
    at(sph(0.009, 0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.6 }), x + 0.012, 0.034, 0.258, head);
    const br = at(cap(0.012, 0.06, hairC), x, 0.1, 0.228, head); br.rotation.z = Math.PI / 2 + (x < 0 ? 0.12 : -0.12);
    const ch = at(sph(0.04, 0xff8a8a, { transparent: true, opacity: 0.28 }), x * 1.55, -0.06, 0.2, head); ch.scale.set(1, 0.6, 0.4);
  });
  const nose = at(sph(0.034, skin), 0, -0.025, 0.245, head); nose.scale.set(0.9, 1, 1.1);
  { const mo = at(tor(0.045, 0.011, 0x8a3b2e, Math.PI), 0, -0.088, 0.228, head); mo.rotation.z = Math.PI; }
  at(sph(0.05, skin), -0.245, 0, 0, head); at(sph(0.05, skin), 0.245, 0, 0, head);
  const dome = (r) => new THREE.Mesh(new THREE.SphereGeometry(r, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2.05), M(hairC));
  const hs = a.acc.cap && a.hairStyle !== 5 && a.hairStyle !== 4 ? 1 : a.hairStyle;
  if (hs === 0) { const h = dome(0.268); h.rotation.x = -0.2; head.add(h); }
  if (hs === 1) { const h = dome(0.256); h.rotation.x = -0.12; head.add(h); }
  if (hs === 2) { const h = at(sph(0.33, hairC), 0, 0.12, -0.05, head); h.scale.set(1.05, 0.9, 1); }
  if (hs === 3) { const h = dome(0.262); h.rotation.x = -0.2; head.add(h); for (let i = 0; i < 8; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 8), M(hairC)); const ang = (i / 8) * 6.28; at(c, Math.sin(ang) * 0.12, 0.27, Math.cos(ang) * 0.12 - 0.02, head); c.rotation.set(Math.cos(ang) * 0.5, 0, -Math.sin(ang) * 0.5); } at(new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.24, 8), M(hairC)), 0, 0.31, -0.02, head); }
  if (hs === 4) { const h = dome(0.27); h.rotation.x = -0.2; head.add(h); const b = at(cap(0.2, 0.3, hairC), 0, -0.14, -0.13, head); b.scale.set(1.15, 1, 0.6); }
  const bd = OPT.beard[a.beard];
  if (bd === 'full') { const b = new THREE.Mesh(new THREE.SphereGeometry(0.257, 20, 12, 0, Math.PI * 2, Math.PI / 1.75, Math.PI / 2.4), M(hairC)); b.position.z = 0.02; head.add(b); }
  if (bd === 'goatee') { const b = at(sph(0.07, hairC), 0, -0.2, 0.17, head); b.scale.set(1, 1.2, 0.8); }
  if (bd === 'full' || bd === 'mustache' || bd === 'goatee') at(box(0.15, 0.03, 0.03, hairC), 0, -0.065, 0.238, head);
  if (a.acc.cap) { const cc = OPT.cloth[a.capColor]; at(cyl(0.262, 0.272, 0.12, cc), 0, 0.17, 0, head); at(sph(0.262, cc), 0, 0.2, 0, head).scale.y = 0.45; at(box(0.28, 0.03, 0.22, cc), 0, 0.12, 0.3, head); }
  if (a.acc.glasses) { [-0.09, 0.09].forEach((x) => at(tor(0.062, 0.012, 0x111111), x, 0.02, 0.245, head)); at(box(0.06, 0.012, 0.012, 0x111111), 0, 0.03, 0.25, head); }
  if (a.acc.headphones) { const b = at(tor(0.275, 0.025, 0x222222, Math.PI), 0, 0.02, 0, head); at(cyl(0.08, 0.08, 0.06, 0xd9342b), -0.27, 0, 0, head).rotation.z = Math.PI / 2; at(cyl(0.08, 0.08, 0.06, 0xd9342b), 0.27, 0, 0, head).rotation.z = Math.PI / 2; b.rotation.y = 0; }
  if (a.acc.earring) at(sph(0.03, 0xffcf3f), -0.265, -0.07, 0.02, head);
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return { g, ...p };
}
export function sit(ch) { ch.legL.rotation.x = ch.legR.rotation.x = -1.45; ch.armL.rotation.x = ch.armR.rotation.x = -0.5; }
