// Body and face shaping for the realistic characters. The free base models have no shape keys, so the
// shape keys are generated here once per model from the geometry itself: landmarks (eyes, nose tip, mouth,
// chin) are found on the head, and every key is a smooth offset that depends on position only, so vertices
// split along UV seams always move together (no cracks).
import * as THREE from 'three';

export const BODY_KEYS = ['h', 'w', 'm', 'sh', 'head'];
export const FACE_KEYS = ['face', 'jaw', 'chin', 'cheek', 'nose', 'noseW', 'lips', 'eyes', 'brow', 'browT'];
const BODY_T = ['fat', 'muscle', 'shoulders', 'faceL', 'jaw', 'chin', 'cheek', 'nose', 'noseW', 'lips'];

function cat(n) {
  n = n.toLowerCase();
  if (/head/.test(n)) return 'head'; if (/neck/.test(n)) return 'neck'; if (/clavicle/.test(n)) return 'clav'; if (/upperarm/.test(n)) return 'uarm';
  if (/lowerarm/.test(n)) return 'farm'; if (/hand|index|middle|ring|pinky|thumb/.test(n)) return 'hand'; if (/spine_03/.test(n)) return 'chest';
  if (/spine/.test(n)) return 'belly'; if (/pelvis|root/.test(n)) return 'hips'; if (/thigh/.test(n)) return 'thigh'; if (/calf/.test(n)) return 'calf'; return 'foot';
}
function weights(mesh) {
  const g = mesh.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, cats = mesh.skeleton.bones.map((b) => cat(b.name)), n = si.count, out = new Array(n);
  for (let i = 0; i < n; i++) { const w = {}; for (let k = 0; k < 4; k++) { const c = cats[si.getComponent(i, k)]; w[c] = (w[c] || 0) + sw.getComponent(i, k); } out[i] = w; }
  return out;
}
const gauss = (dx, dy, dz, rx, ry, rz) => Math.exp(-((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) + (dz * dz) / (rz * rz)));
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// landmarks on the head, in model space (metres, +Y up, face toward +Z)
function landmarks(P, W, eyeBox) {
  const E = { y: (eyeBox.min.y + eyeBox.max.y) / 2, z: eyeBox.max.z, x: (eyeBox.max.x - eyeBox.min.x) / 4 };
  let nose = null, mouth = null, chin = null, top = -1e9, hw = 0;
  for (let i = 0; i < P.count; i++) { if ((W[i].head || 0) < 0.5) continue; const x = P.getX(i), y = P.getY(i), z = P.getZ(i); top = Math.max(top, y); hw = Math.max(hw, Math.abs(x));
    if (Math.abs(x) < 0.006 && y < E.y - 0.01 && y > E.y - 0.09 && (!nose || z > nose.z)) nose = { y, z }; }
  if (!nose) nose = { y: E.y - 0.045, z: E.z + 0.04 };
  for (let i = 0; i < P.count; i++) { if ((W[i].head || 0) < 0.3) continue; const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    if (Math.abs(x) < 0.006 && y < nose.y - 0.015 && y > nose.y - 0.06 && (!mouth || z < mouth.z)) mouth = { y, z: z + 0.02 };
    if (Math.abs(x) < 0.006 && y < nose.y - 0.03 && z > E.z - 0.005 && (!chin || y < chin.y)) chin = { y, z }; }
  if (!mouth) mouth = { y: nose.y - 0.033, z: nose.z - 0.02 }; if (!chin) chin = { y: nose.y - 0.075, z: nose.z - 0.03 };
  return { E, nose, mouth, chin, top, hw };
}

export function makeShapes(root) {
  let body = null, eyes = null, brows = null;
  root.traverse((o) => { if (!o.isSkinnedMesh) return; if (o.userData.body) body = o; else if (/eye/i.test(o.material.name) && !/brow/i.test(o.name)) eyes = o; else brows = o; });
  if (!body || !eyes) return;
  eyes.geometry.computeBoundingBox(); const L = landmarks(body.geometry.attributes.position, weights(body), eyes.geometry.boundingBox);
  // body keys
  {
    const g = body.geometry, P = g.attributes.position, S = g.attributes.snorm, W = weights(body), n = P.count, T = BODY_T.map(() => new Float32Array(n * 3));
    for (let i = 0; i < n; i++) {
      const w = W[i], x = P.getX(i), y = P.getY(i), z = P.getZ(i), nx = S.getX(i), ny = S.getY(i), nz = S.getZ(i), sx = Math.sign(x) || 1, h = w.head || 0;
      const set = (k, dx, dy, dz) => { const a = T[k]; a[i * 3] += dx; a[i * 3 + 1] += dy; a[i * 3 + 2] += dz; };
      // fat: belly and hips most, limbs less, a little in the lower face
      const front = Math.max(0, nz), belly = (w.belly || 0) + (w.hips || 0) * 0.7;
      const f = belly * (0.035 + 0.05 * front * front) + (w.chest || 0) * 0.028 + (w.thigh || 0) * 0.03 + (w.uarm || 0) * 0.02 + (w.farm || 0) * 0.01 + (w.calf || 0) * 0.012 + (w.neck || 0) * 0.02 + (w.clav || 0) * 0.015
        + h * 0.012 * sstep(L.nose.y, L.chin.y, y) * (1 - sstep(0.02, 0.07, Math.abs(z - L.chin.z) - 0.04));
      set(0, nx * f, ny * f * 0.3, nz * f);
      // muscle: arms, chest, shoulders, thighs, calves, neck
      const m = (w.uarm || 0) * 0.02 + (w.farm || 0) * 0.012 + (w.chest || 0) * 0.016 * (0.4 + Math.max(0, nz)) + (w.clav || 0) * 0.02 + (w.thigh || 0) * 0.016 + (w.calf || 0) * 0.012 + (w.neck || 0) * 0.014;
      set(1, nx * m, ny * m * 0.3, nz * m);
      // shoulder width: the whole arm moves out
      const arm = (w.clav || 0) * 0.5 + (w.uarm || 0) + (w.farm || 0) + (w.hand || 0) + (w.chest || 0) * sstep(0.08, 0.2, Math.abs(x)) * 0.5;
      set(2, sx * 0.035 * arm, 0, 0);
      if (h < 0.05) continue;
      const dy0 = y - L.E.y, fr = sstep(-0.02, 0.06, z);
      // face length: lower face moves down
      set(3, 0, -0.018 * h * sstep(L.E.y - 0.01, L.chin.y, y), 0);
      // jaw width
      set(4, x * 0.3 * h * sstep(L.nose.y, L.chin.y + 0.01, y) * sstep(-0.06, 0.02, z), 0, 0);
      // chin: forward and down
      { const k = h * gauss(x, y - L.chin.y - 0.012, z - L.chin.z, 0.03, 0.02, 0.04); set(5, 0, -0.009 * k, 0.012 * k); }
      // cheeks
      { const k = h * gauss(Math.abs(x) - 0.048, y - (L.E.y - 0.035), z - (L.E.z - 0.005), 0.025, 0.025, 0.035) * fr; set(6, sx * 0.008 * k, 0, 0.006 * k); }
      // nose length / width
      { const k = h * gauss(x, y - L.nose.y, z - L.nose.z, 0.02, 0.022, 0.03) * sstep(L.nose.z - 0.04, L.nose.z - 0.01, z); set(7, 0, -0.003 * k, 0.014 * k); set(8, x * 0.6 * k, 0, 0); }
      // lips
      { const k = h * gauss(x, y - L.mouth.y, z - L.mouth.z, 0.028, 0.014, 0.025) * fr; set(9, x * 0.08 * k, (y - L.mouth.y) * 0.6 * k, 0.006 * k); }
      void dy0;
    }
    g.morphAttributes.position = T.map((a) => new THREE.BufferAttribute(a, 3)); g.morphTargetsRelative = true; body.morphTargetDictionary = {}; BODY_T.forEach((k, i) => { body.morphTargetDictionary[k] = i; }); body.morphTargetInfluences = BODY_T.map(() => 0);
  }
  // eyes: size around each eye's own centre
  {
    const g = eyes.geometry, P = g.attributes.position, n = P.count, t = new Float32Array(n * 3), c = [[0, 0, 0, 0], [0, 0, 0, 0]];
    for (let i = 0; i < n; i++) { const s = P.getX(i) < 0 ? 0 : 1; c[s][0] += P.getX(i); c[s][1] += P.getY(i); c[s][2] += P.getZ(i); c[s][3]++; }
    for (let i = 0; i < n; i++) { const s = P.getX(i) < 0 ? 0 : 1, q = c[s]; t[i * 3] = (P.getX(i) - q[0] / q[3]) * 0.22; t[i * 3 + 1] = (P.getY(i) - q[1] / q[3]) * 0.22; t[i * 3 + 2] = (P.getZ(i) - q[2] / q[3]) * 0.12; }
    g.morphAttributes.position = [new THREE.BufferAttribute(t, 3)]; g.morphTargetsRelative = true; eyes.morphTargetDictionary = { eyes: 0 }; eyes.morphTargetInfluences = [0];
  }
  // brows: height and thickness
  if (brows) {
    const g = brows.geometry, P = g.attributes.position, n = P.count, a = new Float32Array(n * 3), b = new Float32Array(n * 3); g.computeBoundingBox(); const cy = (g.boundingBox.min.y + g.boundingBox.max.y) / 2;
    for (let i = 0; i < n; i++) { a[i * 3 + 1] = 0.007; b[i * 3 + 1] = (P.getY(i) - cy) * 0.7; b[i * 3 + 2] = 0.0015; }
    g.morphAttributes.position = [new THREE.BufferAttribute(a, 3), new THREE.BufferAttribute(b, 3)]; g.morphTargetsRelative = true; brows.morphTargetDictionary = { brow: 0, browT: 1 }; brows.morphTargetInfluences = [0, 0];
  }
}

// random but natural-looking shape for crowd characters
export function randomShape(rnd = Math.random) {
  const r = (s = 1) => (rnd() * 2 - 1) * s, skew = () => { const v = rnd(); return v < 0.15 ? -0.8 + rnd() * 0.4 : v > 0.82 ? 0.5 + rnd() * 0.5 : r(0.4); };
  return { body: { h: r(0.7), w: skew(), m: r(0.7), sh: r(0.5), head: r(0.4) }, face: Object.fromEntries(FACE_KEYS.map((k) => [k, r(0.7)])) };
}

// apply avatar values (-1..1) to a built realistic character
export function applyShape(root, base, body = {}, face = {}) {
  const v = (o, k) => Math.max(-1, Math.min(1, +(o[k] || 0)));
  root.traverse((o) => {
    if (!o.isSkinnedMesh || !o.morphTargetDictionary) return; const d = o.morphTargetDictionary, I = o.morphTargetInfluences, s = (k, x) => { if (d[k] !== undefined) I[d[k]] = x; };
    const w = v(body, 'w'); s('fat', w > 0 ? w : w * 0.55); s('muscle', v(body, 'm')); s('shoulders', v(body, 'sh'));
    s('faceL', v(face, 'face')); s('jaw', v(face, 'jaw')); s('chin', v(face, 'chin')); s('cheek', v(face, 'cheek')); s('nose', v(face, 'nose')); s('noseW', v(face, 'noseW')); s('lips', v(face, 'lips'));
    s('eyes', v(face, 'eyes')); s('brow', v(face, 'brow')); s('browT', v(face, 'browT'));
    if (o.isBone) return;
  });
  root.traverse((o) => { if (o.isBone && /^head$/i.test(o.name)) o.scale.setScalar(1 + v(body, 'head') * 0.08); });
  const h = v(body, 'h'); root.scale.setScalar(base * (1 + h * (h < 0 ? 0.16 : 0.09)));
}
