/* Parte eléctrica del tablero: barras de distribución (RED, ENTRADAS, SALIDA, neutro y tierra), borneras sobre riel DIN
   y los cables que bajan de cada barra a su automático. Barras y cables se iluminan donde hay tensión. */
import * as THREE from 'three';
import { M, std } from '../core/materials.js';
import { box, labelPlane } from '../core/helpers.js';
import { markClick } from '../core/interaction.js';
import { RAIL_ITEMS } from '../config.js';
import { panelGrp, breakerPos } from './breakerPanel.js';

const Z_BAR = 0.322;       // las barras van sujetas por soportes verticales
const Z_WIRE = 0.342;      // los cables pasan por delante de barras y borneras
const BAR_X = 0.44;        // largo de las barras

const copper = () => std(0xb87333, 0.85, 0.35, { emissive: 0x000000 });
const insulation = () => std(0x2a2a2d, 0.2, 0.6, { emissive: 0x000000 });

/** Barras de distribución, de arriba hacia abajo. `live`: las que se iluminan según haya tensión. */
const BARS = [
  { id: 'RED', y: 1.905, tip: 'Barra RED · fase de la red, antes del general (CB5)', mat: copper() },
  { id: 'ENT', y: 1.878, tip: 'Barra ENTRADAS · fase después del general, alimenta CB1, CB3 y el conmutador bypass', mat: copper() },
  { id: 'SAL', y: 1.851, tip: 'Barra SALIDA · fase hacia la carga (salidas de las UPS y rodeo) y CB6', mat: copper() },
  { id: 'N', y: 1.824, tip: 'Barra de neutro (N)', mat: std(0x4a7fd0, 0.7, 0.4) },
  { id: 'PE', y: 1.797, tip: 'Barra de tierra de protección (PE)', mat: std(0x4fb04f, 0.7, 0.4) },
];

export const bars = {};
for (const b of BARS) {
  const g = new THREE.Group();
  box(BAR_X, 0.012, 0.012, b.mat, 0, b.y, Z_BAR, g);
  for (const sx of [-1, 1]) box(0.018, 0.02, 0.016, M.white, sx * 0.2, b.y, Z_BAR - 0.002, g);   // aisladores de los extremos
  g.userData.tip = b.tip;
  panelGrp.add(g);
  markClick(g, () => {});    // sin acción: solo muestra el globo informativo al pasar el mouse
  bars[b.id] = b.mat;
}
bars.PE.emissive.setHex(0x1b3d1b);
// la tierra lleva una franja amarilla, como se ve en la realidad
for (let i = 0; i < 6; i++) box(0.03, 0.0125, 0.0125, std(0xf2d21a, 0.4, 0.5), -0.15 + i * 0.06, 1.797, Z_BAR, panelGrp);

/* soportes verticales que sujetan los aisladores de las barras y el riel de borneras, colgados del marco superior */
for (const sx of [-1, 1]) {
  box(0.03, 0.2, 0.004, M.rail, sx * 0.2, 1.828, 0.313, panelGrp);
  box(0.03, 0.02, 0.02, M.rail, sx * 0.2, 1.915, 0.325, panelGrp);
}

/* borneras sobre riel DIN: grises (fase), azules (neutro) y verde-amarillo (tierra) */
box(BAR_X, 0.012, 0.008, M.rail, 0, 1.745, 0.322, panelGrp);
const TERMS = [...Array(6).fill(0xb9bec4), ...Array(4).fill(0x3a78d8), ...Array(4).fill(0x6fbf4a)];
TERMS.forEach((c, i) => {
  const x = -0.2 + i * (0.4 / (TERMS.length - 1));
  const t = new THREE.Group();
  box(0.024, 0.028, 0.02, std(c, 0.2, 0.6), x, 1.745, 0.326, t);
  const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.004, 12).rotateX(Math.PI / 2), std(0x2b2d30, 0.6, 0.4));
  screw.position.set(x, 1.745, 0.338); t.add(screw);
  if (i >= 10) box(0.024, 0.006, 0.0205, std(0xf2d21a, 0.4, 0.5), x, 1.755, 0.326, t);   // franja amarilla de tierra
  panelGrp.add(t);
});
const dinLab = labelPlane('BORNERAS', 0.06, 0.012, { w: 260, h: 52, size: 30, color: '#ffffff', bg: '#101113' });
dinLab.position.set(-0.19, 1.724, 0.326); panelGrp.add(dinLab);

/* cables de cada automático: salen de la barra que lo alimenta y bajan hasta su placa */
const FEED_BAR = { CB5: 'RED', CB1: 'ENT', CB3: 'ENT', SEL: 'ENT', CB2: 'SAL', CB4: 'SAL', CB6: 'SAL' };
export const wires = {};
for (const { id } of RAIL_ITEMS) {
  const { x, top } = breakerPos[id];
  const yBar = BARS.find(b => b.id === FEED_BAR[id]).y;
  const mat = insulation();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, yBar - top, 8), mat);
  m.position.set(x, (yBar + top) / 2, Z_WIRE); m.castShadow = true;
  panelGrp.add(m);
  // terminal de la barra
  const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.006, 12).rotateX(Math.PI / 2), std(0xc9ced4, 0.8, 0.3));
  dot.position.set(x, yBar, Z_WIRE - 0.014); panelGrp.add(dot);
  wires[id] = mat;
}

/** Ilumina un conductor (barra o cable) cuando tiene tensión: `hex` es el color de la energía (amarillo red, verde inversor). */
export function setLive(mat, on, hex, intensity = 0.9) {
  mat.emissive.setHex(on ? hex : 0x000000);
  mat.emissiveIntensity = on ? intensity : 0;
}
