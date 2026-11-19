/* Escena 3D: renderizador, cámara, controles, luces y piso. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { view } from './dom.js';

export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
view.prepend(renderer.domElement);

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb3b8bd);
scene.fog = new THREE.Fog(0xb3b8bd, 9, 20);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

export const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 50);
camera.position.set(2.4, 1.7, 3.6);

export const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0.2, 1.0, 0);
controls.enableDamping = true;
controls.zoomToCursor = true;   // el zoom se acerca hacia donde apunta el mouse
controls.maxPolarAngle = Math.PI * 0.495;
controls.minDistance = 0.05;     // se puede acercar hasta casi tocar las piezas
controls.maxDistance = 9;
/* zoom controlado: se hace más suave cuanto más cerca está la cámara (lejos avanza rápido, cerca de a poco) y cada giro de rueda se limita:
   algunos ratones y paneles táctiles envían saltos enormes por giro, y eso hacía que el acercamiento se pasara de largo. */
let reenvio = false;
/** Cercanía mínima (m) a la superficie de cualquier pieza sobre la que apunta el mouse: el zoom no se acerca más que eso. */
const CERCANIA_MIN = 0.09;
const rayo = new THREE.Raycaster(), ndc = new THREE.Vector2();
const visible = o => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
export function demasiadoCerca(e) {                    // e: { clientX, clientY } del puntero (o del centro de la vista)
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  rayo.setFromCamera(ndc, camera);
  const h = rayo.intersectObjects(scene.children, true).find(q => q.object.isMesh && visible(q.object) && q.object.material && q.object.material.visible !== false);
  return !!h && h.distance < CERCANIA_MIN;
}
renderer.domElement.addEventListener('wheel', e => {
  if (reenvio) return;
  if (e.deltaY < 0 && demasiadoCerca(e)) { e.stopImmediatePropagation(); e.preventDefault(); return; }   // no se acerca más a lo que ya está cerca
  controls.zoomSpeed = THREE.MathUtils.clamp(camera.position.distanceTo(controls.target) / 5, 0.15, 0.8);
  if (Math.abs(e.deltaY) > 100) {                       // se reemplaza por un giro normal de la misma dirección
    e.stopImmediatePropagation(); e.preventDefault();
    reenvio = true;
    renderer.domElement.dispatchEvent(new WheelEvent('wheel', { deltaY: Math.sign(e.deltaY) * 100, deltaMode: 0, clientX: e.clientX, clientY: e.clientY, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, bubbles: true, cancelable: true }));
    reenvio = false;
  }
}, { capture: true, passive: false });

const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(3, 5, 4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 14 });
scene.add(sun, new THREE.HemisphereLight(0xbfd8ff, 0x1a222b, 0.5));

/** Pozo redondo abierto en el piso para ver la pica de tierra enterrada: centro (x, z), radio y profundidad. */
export const POZO = { x: -0.55, z: 0.26, r: 0.09, prof: 0.9 };
const piso = new THREE.Shape(); piso.absarc(0, 0, 8, 0, Math.PI * 2, false);
{
  const h = new THREE.Path(); h.absarc(POZO.x, -POZO.z, POZO.r, 0, Math.PI * 2, true); piso.holes.push(h);   // al girar el piso, la z del mundo es -y de la forma
}
const floor = new THREE.Mesh(new THREE.ShapeGeometry(piso, 64), new THREE.MeshStandardMaterial({ color: 0xa2a7ac, roughness: 0.9 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
{
  // cuadrícula del piso (cada 0,5 m), cortada donde está el pozo
  const normal = [], centro = [], R = 8, { x: px, z: pz, r: pr } = POZO;
  const tramo = (arr, a, b) => arr.push(...a, ...b);
  for (let k = -R; k <= R; k += 0.5) {
    const arr = k === 0 ? centro : normal;
    if (Math.abs(k - px) < pr) { const h = Math.sqrt(pr * pr - (k - px) ** 2); tramo(arr, [k, 0, -R], [k, 0, pz - h]); tramo(arr, [k, 0, pz + h], [k, 0, R]); } else tramo(arr, [k, 0, -R], [k, 0, R]);   // línea x = k
    if (Math.abs(k - pz) < pr) { const h = Math.sqrt(pr * pr - (k - pz) ** 2); tramo(arr, [-R, 0, k], [px - h, 0, k]); tramo(arr, [px + h, 0, k], [R, 0, k]); } else tramo(arr, [-R, 0, k], [R, 0, k]);   // línea z = k
  }
  for (const [arr, col] of [[normal, 0x9aa0a6], [centro, 0x8f959b]]) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: col })));
  }
}

/** Ajusta el lienzo al tamaño del contenedor. */
export function resize() {
  const w = view.clientWidth, h = view.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
