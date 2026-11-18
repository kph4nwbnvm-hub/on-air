// Realistic characters (Quaternius Universal Base Characters + Universal Animation Library, CC0).
// The simple character (char.js) stays the source of truth for position and logic; when a realistic body is
// loaded it is attached to the same group and shown only for the nearest few characters (LOD), the simple
// body is shown everywhere else. Clothes are painted per body region (from the skin weights) plus a few
// cloth meshes: thobe skirt, ghutra + agal, bisht, cap.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { OPT } from './char.js';
import { makeShapes, applyShape, randomShape } from './shape.js';

const BASE = 'assets/chars/';
// hair styles by avatar index: g = model file, p = extra built piece (afro, spikes, ponytail); index 5 is bald
const HAIR = [{ g: 'hair_simpleparted' }, { g: 'hair_buzzed' }, { p: 'afro' }, { g: 'hair_buzzed', p: 'spiky' }, { g: 'hair_buzzedfemale' }, {}, { g: 'hair_long' }, { g: 'hair_buns' }, { g: 'hair_buzzedfemale', p: 'tail' }];
const SKIN_TINT = [1.0, 0.95, 0.82, 0.7, 0.55, 0.42];
const A = { ready: false, failed: false, male: null, female: null, hair: {}, clips: {} };
const LIST = []; // registered simple characters
let enabled = true, maxNear = 8, nearDist = 22;

export const realDebug = () => ({ ready: A.ready, failed: A.failed, n: LIST.length, withReal: LIST.filter((c) => c.real).length, shown: LIST.filter((c) => c.real && c.real.root.visible).length, clips: Object.keys(A.clips), det: LIST.map((c) => { c.g.getWorldPosition(tmp); let vis = true; for (let o = c.g; o; o = o.parent) if (!o.visible) { vis = false; break; } return [Math.round(tmp.x), Math.round(tmp.z), vis, c.real && c.real.root.visible, c.real && +c.real.root.scale.x.toFixed(2), c.simple && c.simple.length, c.real && c.real.cur]; }) });
export const realReady = () => A.ready || A.failed || !enabled || !veil; // ready, or nothing more to wait for
export function setRealEnabled(on) { enabled = on; if (!on) { unveil(); LIST.forEach((c) => showSimple(c, true)); } }
export function setRealBudget(n, dist) { maxNear = n; nearDist = dist; }

function load(loader, name) { return new Promise((res, rej) => loader.load(BASE + name + '.glb', res, undefined, rej)); }
export async function loadReal() {
  try {
    const L = new GLTFLoader(); L.setMeshoptDecoder(MeshoptDecoder);
    const [m, f, a, b] = await Promise.all([load(L, 'male'), load(L, 'female').catch(() => null), load(L, 'anim_a'), load(L, 'anim_b').catch(() => ({ animations: [] }))]);
    A.male = m.scene; prepBody(A.male); if (f) { A.female = f.scene; prepBody(A.female); A.female.traverse((o) => { if (o.userData.body) o.userData.female = true; }); }
    [...a.animations, ...b.animations].forEach((c) => { A.clips[c.name] = c; });
    for (const h of [...new Set([...HAIR.map((x) => x.g).filter(Boolean), 'hair_beard'])]) { try { A.hair[h] = (await load(L, h)).scene; } catch (_) {} }
    A.ready = true; veil = false; VEILED.forEach((c) => c.g.children.forEach((o) => { o.userData.veiled = false; })); VEILED.clear(); LIST.forEach((c) => { try { attach(c); } catch (e) { console.warn('attach failed', e && e.message, e && e.stack && e.stack.split('\n')[1]); } });
  } catch (e) { A.failed = true; unveil(); console.warn('real chars unavailable', e); }
}

// region of each vertex from its strongest bone: 0 skin, 1 top, 2 bottom, 3 shoes, 4 forearm, 5 calf, 6 neck
function region(name) {
  const n = name.toLowerCase();
  if (/hand|index|middle|ring|pinky|thumb|head|eye|jaw/.test(n)) return 0;
  if (/neck/.test(n)) return 6;
  if (/lowerarm/.test(n)) return 4;
  if (/spine|clavicle|upperarm/.test(n)) return 1;
  if (/calf/.test(n)) return 5;
  if (/foot|ball|toe/.test(n)) return 3;
  if (/pelvis|thigh|root/.test(n)) return 2;
  return 0;
}
function prepBody(root) {
  root.traverse((o) => {
    if (!o.isSkinnedMesh) return; o.frustumCulled = false; o.castShadow = true;
    if (!/superhero/i.test(o.name) && !/superhero/i.test(o.material.name)) return;
    const g = o.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, bones = o.skeleton.bones, n = si.count, r = new Float32Array(n), cw = new Float32Array(n * 3), rA = new Float32Array(n * 3), rB = new Float32Array(n * 3);
    const regs = bones.map((b) => region(b.name));
    for (let i = 0; i < n; i++) { let best = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k), j = si.getComponent(i, k), rg = regs[j]; if (w > bw) { bw = w; best = j; } if (rg === 1 || rg === 2) cw[i * 3] += w; else if (rg === 4) cw[i * 3 + 1] += w; else if (rg === 5) cw[i * 3 + 2] += w; }
      r[i] = regs[best];
      // cloth masks from the blended bone weights (not the single strongest bone), so hems follow a smooth line instead of the mesh's zig-zag triangles
      for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k), rg = regs[si.getComponent(i, k)]; if (rg === 1) rA[i * 3] += w; else if (rg === 4) rA[i * 3 + 1] += w; else if (rg === 6) rA[i * 3 + 2] += w; else if (rg === 2) rB[i * 3] += w; else if (rg === 5) rB[i * 3 + 1] += w; else if (rg === 3) rB[i * 3 + 2] += w; } }
    g.setAttribute('region', new THREE.BufferAttribute(r, 1)); g.setAttribute('clothw', new THREE.BufferAttribute(cw, 3)); g.setAttribute('regA', new THREE.BufferAttribute(rA, 3)); g.setAttribute('regB', new THREE.BufferAttribute(rB, 3));
    // smoothed normals shared by vertices at the same spot, so the cloth offset never opens cracks along UV seams
    const P = g.attributes.position, N = g.attributes.normal, sn = new Float32Array(n * 3), key = (i) => Math.round(P.getX(i) * 2000) + ',' + Math.round(P.getY(i) * 2000) + ',' + Math.round(P.getZ(i) * 2000), acc = new Map();
    for (let i = 0; i < n; i++) { const k = key(i), v = acc.get(k) || [0, 0, 0]; v[0] += N.getX(i); v[1] += N.getY(i); v[2] += N.getZ(i); acc.set(k, v); }
    for (let i = 0; i < n; i++) { const v = acc.get(key(i)), l = Math.hypot(v[0], v[1], v[2]) || 1; sn[i * 3] = v[0] / l; sn[i * 3 + 1] = v[1] / l; sn[i * 3 + 2] = v[2] / l; }
    g.setAttribute('snorm', new THREE.BufferAttribute(sn, 3)); o.userData.body = true;
  });
  root.updateMatrixWorld(true); try { makeShapes(root); } catch (e) { console.warn('shapes', e && e.message); }
}
// body material: skin texture, tinted; clothed regions painted with flat cloth colours
function bodyMat(src, look) {
  const m = src.clone(); m.color.setScalar(SKIN_TINT[look.skin] ?? 1); m.roughness = 0.8; m.metalness = 0;
  const u = { cTop: { value: new THREE.Color(look.top) }, cBot: { value: new THREE.Color(look.bottom) }, cShoe: { value: new THREE.Color(look.shoes) }, sleeves: { value: look.sleeves }, legs: { value: look.legs }, collar: { value: look.collar }, cLip: { value: new THREE.Color(look.lip ?? 0) }, lipOn: { value: look.lip != null ? 0.85 : 0 }, lipC: { value: look.female ? new THREE.Vector2(0.1836, 0.2637) : new THREE.Vector2(0.1855, 0.2656) }, lipH: { value: look.female ? new THREE.Vector2(0.036, 0.0155) : new THREE.Vector2(0.035, 0.0105) } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float region; attribute vec3 clothw; attribute vec3 snorm; attribute vec3 regA; attribute vec3 regB; varying vec3 vA; varying vec3 vB; varying float vReg; uniform float sleeves; uniform float legs;').replace('#include <begin_vertex>', `#include <begin_vertex>
vReg = region; vA = regA; vB = regB; float cwt = clothw.x + clothw.y * sleeves + clothw.z * legs; transformed += snorm * 0.012 * clamp(cwt, 0.0, 1.0);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vReg; varying vec3 vA; varying vec3 vB; uniform vec3 cTop; uniform vec3 cBot; uniform vec3 cShoe; uniform float sleeves; uniform float legs; uniform float collar; uniform vec3 cLip; uniform float lipOn; uniform vec2 lipC; uniform vec2 lipH;')
      .replace('#include <map_fragment>', `#include <map_fragment>
      float wT = clamp(vA.x + vA.y * sleeves + vA.z * collar, 0.0, 1.0), wB = clamp(vB.x + vB.y * legs, 0.0, 1.0), wS = clamp(vB.z, 0.0, 1.0);
      diffuseColor.rgb = mix(diffuseColor.rgb, cTop, smoothstep(0.35, 0.65, wT));
      diffuseColor.rgb = mix(diffuseColor.rgb, cBot, smoothstep(0.35, 0.65, wB));
      diffuseColor.rgb = mix(diffuseColor.rgb, cShoe, smoothstep(0.35, 0.65, wS));
      #ifdef USE_MAP
      if (lipOn > 0.0) { float ld = length((vMapUv - lipC) / lipH); float lm = (1.0 - smoothstep(0.55, 1.0, ld)) * lipOn; float lu = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)); diffuseColor.rgb = mix(diffuseColor.rgb, cLip * clamp(lu / 0.42, 0.5, 1.4), lm); }
      #endif`);
  };
  m.customProgramCacheKey = () => 'body-regions-lip';
  return m;
}
// eye colour: re-tint only the iris disc of the eye texture (centre of the UV square), keep pupil and highlight
function eyeMat(src, col) {
  const m = src.clone(); const u = { cEye: { value: new THREE.Color(col) } };
  m.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, u); sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 cEye;').replace('#include <map_fragment>', `#include <map_fragment>
    #ifdef USE_MAP
    { float d = length(vMapUv - vec2(0.498, 0.498)); float im = 1.0 - smoothstep(0.086, 0.103, d); float lu = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)); vec3 tn = cEye * clamp(lu * 2.4, 0.0, 1.3); im *= 1.0 - smoothstep(0.62, 0.85, lu); diffuseColor.rgb = mix(diffuseColor.rgb, tn, im); }
    #endif`); };
  m.customProgramCacheKey = () => 'eye-tint'; return m;
}
const clothM = (c, rough = 0.85) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: 0, side: THREE.DoubleSide });
function boneOf(root, rx) { let b = null; root.traverse((o) => { if (!b && o.isBone && rx.test(o.name)) b = o; }); return b; }

// cloth meshes are built in metres around the bone; the character is ~1.83 m tall
function addThobe(root, col, bisht) {
  const pelvis = boneOf(root, /^pelvis$/i); if (!pelvis) return;
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.42, 0.98, 20, 1, true), clothM(col)); skirt.position.set(0, -0.44, 0); skirt.castShadow = true;
  const holder = new THREE.Group(); holder.add(skirt); pelvis.add(holder); holder.userData.fixUp = true; // keep upright in world space
  if (bisht) { const cape = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.42, 1.25, 18, 1, true, Math.PI * 0.18, Math.PI * 1.64), clothM(bisht, 0.6)); cape.position.set(0, -0.28, 0); holder.add(cape);
    const trim = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.012, 6, 24, Math.PI * 1.64), clothM(0xd4af37, 0.35)); trim.rotation.set(Math.PI / 2, 0, Math.PI * 0.18 + Math.PI / 2); trim.position.set(0, 0.34, 0); holder.add(trim); }
}
function addGhutra(root, col) {
  const head = boneOf(root, /^head$/i); if (!head) return;
  const g = new THREE.Group(); head.add(g);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.125, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), clothM(col)); cap.position.set(0, 0.11, -0.005); g.add(cap);
  const drape = new THREE.Mesh(new THREE.CylinderGeometry(0.126, 0.165, 0.26, 18, 1, true, Math.PI * 0.62, Math.PI * 0.76), clothM(col)); drape.position.set(0, -0.01, 0); g.add(drape);
  const agal = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.014, 6, 24), clothM(0x111111, 0.5)); agal.rotation.x = Math.PI / 2; agal.position.set(0, 0.16, -0.01); g.add(agal);
}
// modest head covering (shayla / hijab): fitted cap over the hair and a drape around the neck, open at the face
function addShayla(root, col) {
  const head = boneOf(root, /^head$/i); if (!head) return; const g = new THREE.Group(); head.add(g); const m = clothM(col, 0.9);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.122, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.6), m); cap.position.set(0, 0.105, -0.012); cap.scale.set(1.04, 1.05, 1.08); g.add(cap);
  const side = new THREE.Mesh(new THREE.CylinderGeometry(0.124, 0.13, 0.17, 20, 1, true, Math.PI * 0.72, Math.PI * 1.56), m); side.position.set(0, 0.04, -0.012); g.add(side);
  const drape = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.24, 0.3, 22, 1, true, Math.PI * 0.62, Math.PI * 1.76), m); drape.position.set(0, -0.15, -0.01); g.add(drape);
  const chin = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.12, 20, 1, true), m); chin.position.set(0, -0.06, 0.0); g.add(chin);
}
function addCap(root, col) {
  const head = boneOf(root, /^head$/i); if (!head) return;
  const c = new THREE.Mesh(new THREE.SphereGeometry(0.122, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), clothM(col, 0.7)); c.position.set(0, 0.1, 0); head.add(c);
  const bill = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.012, 16, 1, false, -Math.PI / 2, Math.PI), clothM(col, 0.7)); bill.position.set(0, 0.1, 0.07); bill.scale.set(1, 1, 1.2); head.add(bill);
}
// beard styles from the one beard model: full, goatee (chin only) or mustache (upper lip only)
const BEARD_CUT = {};
function beardGeo(geo, mode) {
  const key = geo.uuid + mode; if (BEARD_CUT[key]) return BEARD_CUT[key]; geo.computeBoundingBox(); const b = geo.boundingBox, P = geo.attributes.position, I = geo.index, out = [], h = b.max.y - b.min.y;
  const keep = (x, y, z) => { const fy = (y - b.min.y) / h; return z > b.min.z + (b.max.z - b.min.z) * 0.45 && (mode === 2 ? Math.abs(x) < 0.03 && fy < 0.5 : Math.abs(x) < 0.036 && fy > 0.42 && fy < 0.72); };
  for (let i = 0; i < I.count; i += 3) { let x = 0, y = 0, z = 0; for (let k = 0; k < 3; k++) { const v = I.getX(i + k); x += P.getX(v); y += P.getY(v); z += P.getZ(v); } if (keep(x / 3, y / 3, z / 3)) out.push(I.getX(i), I.getX(i + 1), I.getX(i + 2)); }
  const g = geo.clone(); g.setIndex(out); BEARD_CUT[key] = g; return g;
}
function addHair(root, name, colHex, mode = 1) {
  const src = A.hair[name]; if (!src) return; const body = []; root.traverse((o) => { if (o.isSkinnedMesh && o.userData.body) body.push(o); }); if (!body.length) return;
  const sk = body[0].skeleton, byName = {}; sk.bones.forEach((b) => { byName[b.name] = b; });
  src.traverse((o) => { if (!o.isSkinnedMesh) return;
    const mat = o.material.clone(); mat.color.set(colHex).multiplyScalar(2.2); mat.roughness = 0.7;
    const m = new THREE.SkinnedMesh(mode > 1 ? beardGeo(o.geometry, mode) : o.geometry, mat); m.frustumCulled = false; m.castShadow = true;
    const bones = o.skeleton.bones.map((b) => byName[b.name] || sk.bones[0]); root.add(m); m.bind(new THREE.Skeleton(bones, o.skeleton.boneInverses), body[0].bindMatrix); });
}
function addPiece(root, kind, col) {
  const head = boneOf(root, /^head$/i); if (!head) return; const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(col).multiplyScalar(1.3), roughness: 0.95, metalness: 0 });
  if (kind === 'afro') { const g = new THREE.IcosahedronGeometry(0.135, 4), P = g.attributes.position; for (let i = 0; i < P.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(P, i), k = 1 + 0.06 * Math.sin(v.x * 90) * Math.sin(v.y * 80) * Math.sin(v.z * 70); P.setXYZ(i, v.x * k, v.y * k, v.z * k); } g.computeVertexNormals();
    const a = new THREE.Mesh(g, m); a.position.set(0, 0.175, -0.055); a.scale.set(1.12, 0.92, 1.0); a.castShadow = true; head.add(a); }
  if (kind === 'spiky') for (let i = 0; i < 15; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.085, 6), m), an = (i / 7) * Math.PI * 2, r = i === 0 ? 0 : i < 8 ? 0.06 : 0.032; c.position.set(Math.cos(an) * r, 0.19 - r * 0.25, Math.sin(an) * r - 0.01); c.rotation.set(Math.sin(an) * r * 6, 0, -Math.cos(an) * r * 6); head.add(c); }
  if (kind === 'tail') { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.012, 0.3, 10), m); t.position.set(0, 0.0, -0.15); t.rotation.x = 0.35; t.castShadow = true; head.add(t); const k = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), m); k.position.set(0, 0.12, -0.12); head.add(k); }
}
function addStyle(root, st, col) { if (st.g) addHair(root, st.g, col); if (st.p) addPiece(root, st.p, col); }
function lookOf(av) {
  const c = (i, d) => OPT.cloth[i ?? d] ?? 0xffffff; const dress = av.dress || '';
  const thobe = dress === 'thobe' || dress === 'bisht', modest = dress === 'abaya' || dress === 'hijab', female = (!!av.female || modest) && !!A.female;
  const abaya = dress === 'abaya' ? 0x141418 : 0;
  return { skin: av.skin ?? 1, top: abaya || (thobe ? 0xf4f2ec : c(av.topColor, 0)), bottom: abaya || (thobe ? 0xf4f2ec : c(av.bottomColor, 7)), hijab: modest ? (abaya || (OPT.cloth[av.capColor ?? 7] ?? 0x23233a)) : null, shoes: OPT.shoes[av.shoes ?? 0] ?? 0x222222,
    female, sleeves: thobe || female || av.top !== 0 ? 1 : 0, legs: av.bottom === 1 && !thobe && !female ? 0 : 1, collar: thobe || modest || av.top === 1 ? 1 : 0, thobe, bisht: dress === 'bisht' ? 0x3a2a1c : 0,
    hair: HAIR[av.hairStyle ?? 0], hairCol: OPT.hairColor[av.hairColor ?? 1] ?? 0x2a1c14, beard: av.beard ?? 0, cap: !!(av.acc && av.acc.cap), capCol: OPT.cloth[av.capColor ?? 1] ?? 0x2e7df6, eye: av.eye ? OPT.eye[av.eye] : null, lip: av.lip ? OPT.lip[av.lip] : null };
}
function build(av) {
  const look = lookOf(av), root = SkeletonUtils.clone(look.female ? A.female : A.male);
  root.traverse((o) => { if (o.isSkinnedMesh) { o.frustumCulled = false; o.castShadow = true; if (o.userData.body) o.material = bodyMat(o.material, look); else if (look.eye != null && /eye/i.test(o.material.name) && !/brow/i.test(o.name)) o.material = eyeMat(o.material, look.eye); else if (!/eye/i.test(o.material.name) || /brow/i.test(o.name)) { o.material = o.material.clone(); o.material.color.set(look.hairCol).multiplyScalar(1.6); } } });
  if (look.female) { addThobe(root, look.bottom, 0); if (look.hijab !== null) addShayla(root, look.hijab); else addStyle(root, look.hair || {}, look.hairCol); }
  else if (look.thobe) { addThobe(root, look.top, look.bisht); addGhutra(root, 0xf7f7f2); } else { if (look.cap) addCap(root, look.capCol); else addStyle(root, look.hair || {}, look.hairCol); }
  if (look.beard && !look.female) addHair(root, 'hair_beard', look.hairCol, look.beard);
  const mixer = new THREE.AnimationMixer(root), acts = {};
  Object.keys(A.clips).forEach((k) => { acts[k] = mixer.clipAction(A.clips[k]); });
  return { root, mixer, acts, cur: null };
}

// register every simple character; the realistic body is attached once the assets are loaded
// while the realistic models are still loading, the simple stand-ins stay hidden so players never see one style swap to the other;
// if loading fails (or takes over 15 s) the simple ones come back
let veil = true; const VEILED = new Set();
function unveil() { veil = false; VEILED.forEach((c) => { if (!c.real) c.g.children.forEach((o) => { if (o.userData.veiled) { o.visible = true; o.userData.veiled = false; } }); }); VEILED.clear(); }
setTimeout(() => { if (!A.ready) unveil(); }, 15000);
export function register(c, av, opts = {}) { if (opts.skip) return c; c.av = av; c.ropts = opts; c.real = null; if (!LIST.includes(c)) LIST.push(c);
  if (A.ready) attach(c); else if (veil && enabled && !A.failed && c.g) { c.g.children.forEach((o) => { if (o.visible) { o.visible = false; o.userData.veiled = true; } }); VEILED.add(c); }
  return c; }
function attach(c) {
  if (c.real || !c.g) return;
  const r = build(c.av || {}); c.real = r;
  // fit to the simple body's height
  const bb = new THREE.Box3().setFromObject(c.g), hs = Math.max(1.2, bb.max.y - bb.min.y || 1.7); r.root.scale.setScalar(Math.min(1.1, hs / 1.83));
  r.base = r.root.scale.x; reshape(c);
  r.root.visible = false; c.g.add(r.root); c.lastPos = new THREE.Vector3(); c.speed = 0;
  c.simple = c.g.children.filter((o) => o !== r.root);
}
// body/face shape: the avatar's own values, or a random natural shape for crowd characters
export function reshape(c) { if (!c.real) return; const av = c.av || {}; if (!av.body && !c.rshape) c.rshape = randomShape(); const sh = av.body ? av : c.rshape; applyShape(c.real.root, c.real.base, sh.body || {}, sh.face || {}); }
export function reshapeAll() { LIST.forEach(reshape); }
function showSimple(c, on) { if (!c.real) return; c.simple.forEach((o) => { o.visible = on; }); c.real.root.visible = !on; }
function play(c, name) { const r = c.real; if (!r || r.cur === name || !r.acts[name]) return; const a = r.acts[name]; const prev = r.cur && r.acts[r.cur]; a.reset().setEffectiveWeight(1).play(); if (prev) a.crossFadeFrom(prev, 0.25, false); r.cur = name; }

const tmp = new THREE.Vector3(), ranked = [];
export function realTick(dt, camera) {
  if (!A.ready || !enabled) return;
  ranked.length = 0;
  for (let i = LIST.length - 1; i >= 0; i--) {
    const c = LIST[i]; if (!c.g.parent) { LIST.splice(i, 1); continue; } if (!c.real) continue;
    let vis = true; for (let o = c.g; o; o = o.parent) if (!o.visible && o !== c.real.root) { vis = false; break; }
    c.g.getWorldPosition(tmp); const d = tmp.distanceTo(camera.position);
    const jump = tmp.distanceTo(c.lastPos), mv = jump > 1.5 ? 0 : jump / Math.max(dt, 1e-3); c.lastPos.copy(tmp); c.speed = jump > 1.5 ? 0 : c.speed * 0.6 + mv * 0.4;
    // a character that is already realistic keeps a small advantage, so two at similar distances never flip back and forth
    const keep = c.real.root.visible ? 0.85 : 1;
    if (vis && d * keep < nearDist) ranked.push([d * keep, c]); else showSimple(c, true);
  }
  ranked.sort((a, b) => a[0] - b[0]);
  ranked.forEach(([d, c], i) => {
    const near = i < maxNear; showSimple(c, !near); if (!near) return;
    const o = c.ropts || {}; let want = o.anim || 'Idle_Loop';
    if (!o.anim) { if (c.speed > 3) want = 'Jog_Fwd_Loop'; else if (c.speed > 0.5) want = 'Walk_Loop'; }
    play(c, want); c.real.mixer.update(i < 4 ? dt : dt * (Math.random() < 0.5 ? 2 : 0)); // far ones update every other frame
    if (!/Sitting/.test(want)) { armsIn(c.real); c.real.root.position.y = 0; c.real.root.position.z = 0; } else chairSit(c.real, o.seatY ?? 0.66);
    c.real.root.traverse((x) => { if (x.userData.fixUp) { x.parent.getWorldQuaternion(fq); c.g.getWorldQuaternion(gq); x.quaternion.copy(fq.invert()).multiply(gq); } });
  });
}
const fq = new THREE.Quaternion(), gq = new THREE.Quaternion();
// the base body has very wide shoulders, so the stock idle and walk hold the arms away from the body; bring them in a little
const ARM_IN = 0.2, aq = new THREE.Quaternion(), pq = new THREE.Quaternion(), fwd = new THREE.Vector3();
// chair sitting: the stock clip folds the legs under the body, so the legs are posed here (thighs level, shins down)
// and the body is lifted until the hips rest on the seat
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), dir = new THREE.Vector3(), tgt = new THREE.Vector3(), qw = new THREE.Quaternion(), qb = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
function aim(bone, child, target) {
  bone.getWorldPosition(v1); child.getWorldPosition(v2); dir.subVectors(v2, v1).normalize(); qw.setFromUnitVectors(dir, target);
  bone.getWorldQuaternion(qb); bone.parent.getWorldQuaternion(pq); bone.quaternion.copy(pq.invert().multiply(qw.multiply(qb))); bone.updateMatrixWorld(true);
}
function chairSit(r, seatY) {
  if (!r.legs) { const b = {}; r.root.traverse((o) => { if (o.isBone) b[o.name] = o; }); r.legs = ['l', 'r'].map((k) => [b['thigh_' + k], b['calf_' + k], b['foot_' + k]]).filter((l) => l.every(Boolean)); r.pelvis = b.pelvis; }
  r.root.updateMatrixWorld(true); r.root.getWorldQuaternion(gq); fwd.set(0, 0, 1).applyQuaternion(gq); fwd.y = 0; fwd.normalize();
  r.legs.forEach(([th, ca, ft]) => { tgt.copy(fwd).addScaledVector(up, -0.12).normalize(); aim(th, ca, tgt); tgt.copy(up).negate().addScaledVector(fwd, 0.12).normalize(); aim(ca, ft, tgt); });
  if (r.pelvis) { r.pelvis.getWorldPosition(v1); const sc = r.root.parent ? r.root.parent.getWorldScale(v2).y : 1; r.root.position.y += (seatY - v1.y) / Math.max(sc, 0.01); r.root.position.z = 0.24; }
}
function armsIn(r) {
  if (!r.arms) { r.arms = []; r.root.traverse((o) => { if (o.isBone && /^upperarm_[lr]$/i.test(o.name)) r.arms.push([o, /_l$/i.test(o.name) ? 1 : -1]); }); }
  r.root.getWorldQuaternion(gq); fwd.set(0, 0, 1).applyQuaternion(gq);
  r.arms.forEach(([b, s]) => { b.parent.getWorldQuaternion(pq); aq.setFromAxisAngle(fwd, -s * ARM_IN); b.quaternion.premultiply(pq.clone().invert().multiply(aq).multiply(pq)); });
}
