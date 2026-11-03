/* Puertas del rack. La frontal lleva ventana de vidrio ahumado con goma negra, logo, placa informativa
   y rejilla con ventilador (visible por ambas caras); la trasera lleva una tapa de ventilación discreta. */
import * as THREE from 'three';
import { M } from '../core/materials.js';
import { box, roundedRect } from '../core/helpers.js';
import { markClick } from '../core/interaction.js';
import { actions } from '../core/bus.js';
import { rack, makeFan } from './rack.js';

export const OPEN_ANGLE = -Math.PI * 0.62;

function addLouver(parent, cx, cy, w, h, n, dz) {
  const gap = h / n;
  for (let i = 0; i < n; i++) {
    const s = box(w, gap * 0.45, 0.01, M.steel, cx, cy - h / 2 + gap * (i + 0.5), 0.035 * dz, parent);
    s.rotation.x = -0.45 * dz;
  }
}

/** Ventana de vidrio con esquinas redondeadas, goma negra que la rodea y marco que rellena cada esquina. */
function addGlassWindow(pivot) {
  const R = 0.05, ww = 0.43, wh = 1.12, hx = ww / 2, hy = wh / 2;
  const cx = 0.29, cy = 1.18;                                   // centro de la ventana en la puerta

  const shape = new THREE.Shape(); roundedRect(shape, hx, hy, R);
  const glass = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.01, bevelEnabled: false }).translate(0, 0, -0.005), M.smoke);
  glass.position.set(cx, cy, 0);
  glass.renderOrder = 10;   // se dibuja siempre después de lo que hay detrás (textos y placas transparentes), vean desde donde se vea
  pivot.add(glass);

  // goma negra aislante que rodea todo el vidrio, por dentro y por fuera de la puerta
  const gom = new THREE.Shape(); roundedRect(gom, hx + 0.014, hy + 0.014, R + 0.014);
  const hole = new THREE.Path(); roundedRect(hole, hx - 0.008, hy - 0.008, R - 0.008); gom.holes.push(hole);
  const gasket = new THREE.Mesh(new THREE.ExtrudeGeometry(gom, { depth: 0.028, bevelEnabled: false }).translate(0, 0, -0.014), M.rubber);
  gasket.position.set(cx, cy, 0); gasket.castShadow = true; pivot.add(gasket);

  // el marco rellena cada esquina con un cuarto de círculo
  for (const [px, py, sx, sy] of [[0.075, 0.62, 1, 1], [0.505, 0.62, -1, 1], [0.075, 1.74, 1, -1], [0.505, 1.74, -1, -1]]) {
    const f = new THREE.Shape(), a0 = Math.atan2(-sy, 0), a1 = Math.atan2(0, -sx);
    f.moveTo(0, 0); f.lineTo(sx * R, 0);
    f.absarc(sx * R, sy * R, R, a0, a1, Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0)) < 0);
    f.lineTo(0, 0);
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(f, { depth: 0.02, bevelEnabled: false }).translate(0, 0, -0.01), M.frame);
    m.position.set(px, py, 0); m.castShadow = true; pivot.add(m);
  }
}

/** Cabecera de la puerta: logo de Fernández Fica a la izquierda y placa informativa negra a la derecha. */
function addHeader(pivot) {
  const logoTex = new THREE.TextureLoader().load('assets/logo-fernandez-fica.png');
  logoTex.colorSpace = THREE.SRGBColorSpace; logoTex.anisotropy = 8;
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.27, 0.27 / 3.85), new THREE.MeshBasicMaterial({ map: logoTex, transparent: true, toneMapped: false }));
  logo.position.set(0.165, 1.855, 0.0115); pivot.add(logo);

  const pc = document.createElement('canvas'); pc.width = 500; pc.height = 280;
  const g = pc.getContext('2d');
  g.fillStyle = '#0d0e10'; g.fillRect(0, 0, 500, 280);
  g.strokeStyle = '#3a3d42'; g.lineWidth = 4; g.strokeRect(6, 6, 488, 268);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#e8eef4'; g.font = '600 34px system-ui, sans-serif';
  g.fillText('UPS modular 2 × 10 kVA', 250, 70);
  g.fillText('Potencia total 20 kW', 250, 140);
  g.fillText('220–240 VAC · 240 VDC', 250, 210);
  const plateTex = new THREE.CanvasTexture(pc); plateTex.colorSpace = THREE.SRGBColorSpace; plateTex.anisotropy = 8;
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.125, 0.07), new THREE.MeshBasicMaterial({ map: plateTex, toneMapped: false }));
  plate.position.set(0.52, 1.855, 0.0115); pivot.add(plate);
}

function makeDoor(side) {
  const front = side === 'front';
  const dir = front ? 1 : -1;
  const pivot = new THREE.Group();
  pivot.position.set(front ? -0.3 : 0.3, 0, front ? 0.41 : -0.41);
  const cx = dir * 0.3;
  const leaf = (w, h, x, y) => box(w, h, 0.02, M.frame, dir * x, y, 0, pivot);
  if (front) {
    leaf(0.6, 0.47, 0.3, 0.385);           // panel inferior con ventilación
    leaf(0.6, 0.23, 0.3, 1.855);           // franja superior
    leaf(0.075, 1.12, 0.0375, 1.18);       // lado bisagra
    leaf(0.095, 1.12, 0.5525, 1.18);       // lado cerradura
    addGlassWindow(pivot);
    addHeader(pivot);
    // rejilla con ventilador: atraviesa la puerta, se ve por fuera y por dentro
    box(0.32, 0.3, 0.01, M.dark, cx, 0.385, 0.012, pivot);
    const f = makeFan(0.12); f.position.set(cx, 0.385, 0.022); pivot.add(f);
    addLouver(pivot, cx, 0.385, 0.3, 0.28, 9, 1);
    box(0.32, 0.3, 0.01, M.dark, cx, 0.385, -0.012, pivot);
    const fi = makeFan(0.12); fi.position.set(cx, 0.385, -0.022); fi.scale.x = -1; pivot.add(fi);
    addLouver(pivot, cx, 0.385, 0.3, 0.28, 9, -1);
  } else {
    box(0.6, 1.81, 0.02, M.frame, cx, 1.055, 0, pivot);
    // tapa de ventilación grande y discreta (crema con ranuras finas, sin ventilador) que atraviesa la puerta
    for (const sz of [-1, 1]) {
      box(0.46, 0.4, 0.01, M.frame, cx, 0.385, sz * 0.015, pivot);
      for (let i = 0; i < 13; i++) box(0.38, 0.008, 0.004, M.dark, cx, 0.385 - 0.168 + i * 0.028, sz * 0.021, pivot);
    }
  }
  box(0.025, 0.14, 0.03, M.handle, dir * 0.56, 1.0, 0.03 * dir, pivot);   // cerradura
  pivot.userData = { open: false, side };
  rack.add(pivot);
  markClick(pivot, () => actions.toggleDoor(pivot));
  return pivot;
}

export const doorF = makeDoor('front');
export const doorR = makeDoor('rear');

/* placa para una foto de referencia, sobre el panel inferior de la puerta frontal */
export const photoPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.12), new THREE.MeshBasicMaterial({ transparent: true }));
photoPlane.position.set(0.3, 0.535, 0.021);
photoPlane.visible = false;
doorF.add(photoPlane);
