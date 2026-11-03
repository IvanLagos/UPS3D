/* Interacción con el 3D: clic, hover con globo informativo y avisos (toast). */
import * as THREE from 'three';
import { $ } from './dom.js';
import { renderer, scene, camera } from './scene.js';

const clickMeshes = [];

/** Hace clicable a todo el grupo `root`; `fn` recibe el evento del puntero. */
export function markClick(root, fn) {
  root.traverse(m => { if (m.isMesh) { m.userData.click = fn; m.userData.root = root; clickMeshes.push(m); } });
}

/* ---------- avisos ---------- */
let toastTimer;
export function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------- hover y clic ---------- */
const hoverBox = new THREE.BoxHelper(new THREE.Object3D(), 0x2fd27a);
hoverBox.visible = false; scene.add(hoverBox);
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();

function pick(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(clickMeshes, false)[0];
  return hit ? hit.object : null;
}

let downPos = null;
const cv = renderer.domElement;
cv.addEventListener('pointerdown', e => { downPos = { x: e.clientX, y: e.clientY }; });
cv.addEventListener('pointerup', e => {
  if (downPos && Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) < 5) {
    const m = pick(e); if (m) m.userData.click(e);
  }
  downPos = null;
});
cv.addEventListener('pointermove', e => {
  if (e.buttons) return;
  const m = pick(e);
  hoverBox.visible = !!m;
  cv.style.cursor = m ? 'pointer' : 'grab';
  if (m) hoverBox.setFromObject(m.userData.root);
  const tip = m && m.userData.root.userData.tip, tt = $('#tip');
  tt.style.display = tip ? 'block' : 'none';
  if (tip) { tt.textContent = tip; tt.style.left = e.clientX + 14 + 'px'; tt.style.top = e.clientY + 16 + 'px'; }
});
cv.addEventListener('pointerleave', () => { hoverBox.visible = false; $('#tip').style.display = 'none'; });

/** Mantiene el recuadro de hover pegado al objeto mientras se anima. */
export function updateHover() {
  if (hoverBox.visible) hoverBox.update();
}
