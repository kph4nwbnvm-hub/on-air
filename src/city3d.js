// Real low-poly car models (Designersoup, CC0) swapped in for the box cars once loaded.
// The box cars stay as the fallback, so nothing breaks if loading fails or is slow.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const cityKit = { north: [], parked: [], bollards: [], fallback: null, group: null, done: false };

const MODELS = []; const WAIT = [];
function fit(src, len) {
  const m = src.clone(true); const b = new THREE.Box3().setFromObject(m); const s = new THREE.Vector3(); b.getSize(s);
  const k = len / Math.max(s.x, 0.01); m.scale.setScalar(k); const c = new THREE.Vector3(); b.getCenter(c);
  m.position.set(-c.x * k, -b.min.y * k, -c.z * k);
  m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; const mt = o.material; if (mt) { mt.metalness = Math.min(mt.metalness ?? 0, 0.3); mt.roughness = Math.max(mt.roughness ?? 1, 0.45); } } });
  const w = new THREE.Group(); w.add(m); return w;
}
function apply(g, i, len) {
  if (!MODELS.length || g.userData.realCar) return;
  g.children.forEach((o) => { if (!o.userData.keep) o.visible = false; });
  const car = fit(MODELS[i % MODELS.length], len); g.add(car); g.userData.realCar = car;
}
// register a box-car group; it gets a real model as soon as the models are ready
export function carModel(g, i, len = 3.9) { if (MODELS.length) apply(g, i, len); else WAIT.push([g, i, len]); }
export function loadCars() {
  const L = new GLTFLoader(); L.setMeshoptDecoder(MeshoptDecoder);
  L.load('assets/city/cars.glb', (gl) => {
    (gl.scenes && gl.scenes.length ? gl.scenes : [gl.scene]).forEach((sc) => { const r = sc.children.length === 1 ? sc.children[0] : sc; MODELS.push(r); });
    WAIT.splice(0).forEach(([g, i, len]) => apply(g, i, len));
    if (cityKit.group) parkCars(cityKit.group);
  }, undefined, () => {});
}

// merge every parked car into one mesh per material (a couple of draw calls for the whole street)
function parkCars(group) {
  if (cityKit.parkedDone || !MODELS.length) return; cityKit.parkedDone = true; const byMat = new Map(), m4 = new THREE.Matrix4();
  const hued = new Map(), hueMat = (mt, h) => { if (!h || !mt.map || /glass|black/i.test(mt.name)) return mt; const k = mt.uuid + h; if (!hued.has(k)) { const m = mt.clone(); m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      { vec3 c = diffuseColor.rgb; const vec3 k = vec3(0.57735); float a = ${h.toFixed(3)}; diffuseColor.rgb = c * cos(a) + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - cos(a)); }`); }; m.customProgramCacheKey = () => 'hue' + h; hued.set(k, m); } return hued.get(k); };
  cityKit.parked.forEach((p, pi) => { const car = fit(MODELS[p.m % MODELS.length], 4.1); const hue = [0, 2.1, 4.2, 1.0][pi % 4]; car.position.set(p.x, 0, p.z); car.rotation.y = p.ry; car.updateMatrixWorld(true);
    car.traverse((o) => { if (!o.isMesh) return; const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((mt0, gi) => { const mt = hueMat(mt0, hue); let g = o.geometry; if (mats.length > 1) { const gr = g.groups[gi]; if (!gr) return; g = g.clone(); g.setIndex(g.index.array.slice(gr.start, gr.start + gr.count)); g.clearGroups(); } else g = g.clone();
        g = g.index ? g.toNonIndexed() : g; m4.copy(o.matrixWorld); g.applyMatrix4(m4); Object.keys(g.attributes).forEach((k) => { if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); });
        if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); if (!g.attributes.normal) g.computeVertexNormals();
        if (!byMat.has(mt)) byMat.set(mt, []); byMat.get(mt).push(g); }); }); });
  byMat.forEach((L, mt) => { const ms = new THREE.Mesh(mergeGeometries(L), mt); ms.castShadow = true; ms.receiveShadow = true; group.add(ms); L.forEach((g) => g.dispose()); });
}

// real buildings and street props, drawn with GPU instancing (one draw per material per building type)
const TYPES = [/small/i, /medium/i, /large/i];
function instanced(src, mats, group, shadow) {
  src.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(src.matrixWorld).invert();
  src.traverse((o) => { if (!o.isMesh) return; const rel = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const im = new THREE.InstancedMesh(o.geometry, o.material, mats.length); mats.forEach((m, i) => im.setMatrixAt(i, new THREE.Matrix4().multiplyMatrices(m, rel)));
    im.instanceMatrix.needsUpdate = true; im.castShadow = shadow; im.receiveShadow = true; im.computeBoundingSphere(); group.add(im); });
}
export function loadKit(group) {
  cityKit.group = group; parkCars(group);
  const L = new GLTFLoader(); L.setMeshoptDecoder(MeshoptDecoder);
  L.load('assets/city/kit.glb', (gl) => {
    const roots = []; (gl.scenes && gl.scenes.length ? gl.scenes : [gl.scene]).forEach((sc) => sc.children.forEach((c) => roots.push(c)));
    const find = (rx) => roots.find((r) => rx.test(r.name)); const box = new THREE.Box3(), size = new THREE.Vector3();
    roots.forEach((r) => r.traverse((o) => { if (o.isMesh && o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { if (m.metalness > 0.5) m.metalness = 0.5; }); } }));
    TYPES.forEach((rx, ti) => {
      const src = find(rx); if (!src) return; const list = cityKit.north.filter((n) => n.type === ti); if (!list.length) return;
      src.position.set(0, 0, 0); src.rotation.set(0, 0, 0); src.scale.set(1, 1, 1); src.updateMatrixWorld(true); box.setFromObject(src); box.getSize(size);
      const s = 10.2 / size.x, cx = (box.min.x + box.max.x) / 2;
      instanced(src, list.map((n) => new THREE.Matrix4().compose(new THREE.Vector3(n.x - cx * s, 0, n.z - box.max.z * s), new THREE.Quaternion(), new THREE.Vector3(s, s, s))), group, false);
    });
    const bol = find(/bollard/i); if (bol && cityKit.bollards.length) { bol.position.set(0, 0, 0); instanced(bol, cityKit.bollards.map(([x, z]) => new THREE.Matrix4().makeTranslation(x, 0, z)), group, false); }
    cityKit.done = true;
  }, undefined, () => { if (cityKit.fallback) cityKit.fallback(); });
}
