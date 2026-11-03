/* Módulos del rack: 2 UPS de 10 kVA (con pantalla y botones INV/BYP/TRAS/BAT) y 2 bancos de baterías bajo cada una. */
import * as THREE from 'three';
import { M, std } from '../core/materials.js';
import { box, labelPlane, textTex } from '../core/helpers.js';
import { markClick } from '../core/interaction.js';
import { actions } from '../core/bus.js';
import { rack } from './rack.js';

const BODY_D = 0.62;
export const Z = { in: 0, out: 0.55, away: 2.2 };   // posición en profundidad: instalado, extraído, retirado
const btnGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.012, 16).rotateX(Math.PI / 2);

/** Materiales de los botones de cada UPS, para iluminarlos según el estado. */
export const upsBtns = { inv: [], byp: [], tr: [], bat: [] };

const BUTTONS = [
  { id: 'inv', x: 0.04, color: 0x2fd27a, txt: 'INV', tip: 'INV · Pasar el sistema a inversor (las UPS están comunicadas)' },
  { id: 'byp', x: 0.1, color: 0xf0b429, txt: 'BYP', tip: 'BYP · Pasar el sistema a bypass estático' },
  { id: 'tr', x: 0.16, color: 0x4aa3ff, txt: 'TRAS', tip: 'TRAS · Traspasar la carga a la otra UPS y dejar ésta en stand by' },
  { id: 'bat', x: 0.22, color: 0xb98cff, txt: 'BAT', tip: 'BAT · Elegir cuántos bancos de baterías usa esta UPS (1 o 2)' },
];

function makeUps(i, y) {
  const g = new THREE.Group(); g.position.set(0, y, 0);
  box(0.5, 0.15, BODY_D, M.module, 0, 0, 0, g);
  box(0.5, 0.15, 0.02, M.face, 0, 0, 0.32, g);
  const cv = document.createElement('canvas'); cv.width = 300; cv.height = 100;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.0733), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  screen.position.set(-0.12, 0, 0.332); g.add(screen);
  const lab = labelPlane(`UPS ${i + 1} · 10 kVA`, 0.2, 0.05, { size: 28, color: '#d5dae0' });
  lab.position.set(0.125, 0.04, 0.332); g.add(lab);
  box(0.04, 0.012, 0.012, M.blue, -0.1, -0.066, 0.335, g);                                          // pestillo azul
  const ledMat = std(0x222222, 0.2, 0.4, { emissive: 0x000000 });
  box(0.016, 0.016, 0.008, ledMat, 0.0, -0.058, 0.332, g);
  g.userData = { kind: 'power', unit: i, state: 'in', ledMat, scr: { ctx: cv.getContext('2d'), tex } };
  rack.add(g);
  markClick(g, e => actions.toggleModule(g, e));
  // botones de la UPS (se marcan después para que no los pise el clic de la UPS)
  for (const { id, x, color, txt, tip } of BUTTONS) {
    const bg = new THREE.Group();
    const mat = std(color, 0.3, 0.4, { emissive: color, emissiveIntensity: 0.15 });
    const bt = new THREE.Mesh(btnGeo, mat); bt.position.set(x, -0.015, 0.335); bg.add(bt);
    const l = labelPlane(txt, 0.058, 0.0243, { h: 106, size: 82, color: '#eef2f6' }); l.position.set(x, -0.052, 0.332); bg.add(l);
    bg.userData.tip = tip;
    g.add(bg);
    markClick(bg, () => (id === 'tr' ? actions.setTransfer(i) : id === 'bat' ? actions.setBanks(i) : actions.setUnitBypass(i, id === 'byp')));
    upsBtns[id].push(mat);
  }
  return g;
}

/** Banco de baterías `n` (0 = arriba, 1 = abajo) de la UPS `u`. */
function makeBank(u, n, y) {
  const g = new THREE.Group(); g.position.set(0, y, 0);
  box(0.5, 0.15, BODY_D, M.batt, 0, 0, 0, g);
  box(0.5, 0.15, 0.02, M.battFace, 0, 0, 0.32, g);
  box(0.2, 0.014, 0.03, M.handle, -0.08, -0.05, 0.345, g);
  const ledMat = std(0x222222, 0.2, 0.4, { emissive: 0x000000 });
  box(0.016, 0.016, 0.008, ledMat, -0.21, 0.05, 0.332, g);
  const lab = labelPlane(`UPS ${u + 1} · BANCO ${n + 1}\n10×12 V`, 0.24, 0.06, { size: 22, color: '#d5dae0' });
  lab.position.set(0.03, 0.005, 0.332); g.add(lab);
  g.userData = { kind: 'battery', unit: u, n, state: 'in', ledMat };
  rack.add(g);
  markClick(g, e => actions.toggleModule(g, e));
  return g;
}

export const powerMods = [makeUps(0, 1.445), makeUps(1, 0.965)];   // UPS 1 arriba, UPS 2 abajo
export const battMods = [makeBank(1, 1, 0.645), makeBank(1, 0, 0.805), makeBank(0, 1, 1.125), makeBank(0, 0, 1.285)];   // banco 1 arriba, banco 2 abajo
export const allMods = [...battMods, ...powerMods];
export const unitBanks = u => battMods.filter(m => m.userData.unit === u);

/* tapa ciega crema bajo el último banco: solo la placa frontal, como una UPS más */
box(0.5, 0.15, 0.02, M.frame, 0, 0.485, 0.32, rack);

/* etiqueta amarilla de advertencia */
const warn = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.04), new THREE.MeshBasicMaterial({ map: textTex('⚠', { w: 64, h: 64, size: 44, bg: '#f2c200', color: '#111' }), toneMapped: false }));
warn.position.set(-0.265, 0.5, 0.342);   // sobre el riel, junto a la zona libre inferior
rack.add(warn);
