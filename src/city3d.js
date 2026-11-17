// Real low-poly car models (Designersoup, CC0) swapped in for the box cars once loaded.
// The box cars stay as the fallback, so nothing breaks if loading fails or is slow.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

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
  }, undefined, () => {});
}
