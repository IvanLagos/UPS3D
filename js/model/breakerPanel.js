/* Tablero de automáticos (CB1…CB7): una lata crema bajo el techo con los 7 interruptores en una línea,
   placa negra de texto arriba y pilotos verde/rojo debajo de cada uno. */
import * as THREE from 'three';
import { M, std } from '../core/materials.js';
import { box, labelPlane } from '../core/helpers.js';
import { markClick } from '../core/interaction.js';
import { actions } from '../core/bus.js';
import { BREAKERS } from '../config.js';
import { rack } from './rack.js';

const panelGrp = new THREE.Group(); panelGrp.position.y = -0.01; rack.add(panelGrp);
box(0.5, 0.4, 0.03, M.frame, 0, 1.74, 0.3, panelGrp);   // lata del tablero, crema

/** Partes móviles/luminosas de cada automático, por id: { lever, leverMat, lampMat, redMat, y }. */
export const breakers = {};

const lampGeo = new THREE.CylinderGeometry(0.0115, 0.0115, 0.014, 16).rotateX(Math.PI / 2);
const PITCH = 0.054, ROW_X = -0.01, ROW_Y = 1.609;   // separación, centro horizontal y altura de la línea

BREAKERS.forEach(({ id, label }, i) => {
  const x = ROW_X + (i - 3) * PITCH, r = ROW_Y;
  const g = new THREE.Group();
  box(0.046, 0.06, 0.035, M.white, x, r, 0.33, g);
  const leverMat = std(0x888f99, 0.3, 0.5, { emissive: 0x000000 });
  const lever = box(0.016, 0.03, 0.03, leverMat, x, r, 0.358, g);
  const lampMat = std(0x0a5222, 0.2, 0.4, { emissive: 0x000000, emissiveIntensity: 1 });
  lampMat.toneMapped = false;
  const redMat = std(0x560c0c, 0.2, 0.4, { emissive: 0x000000, emissiveIntensity: 1 });
  redMat.toneMapped = false;
  const lg = new THREE.Mesh(lampGeo, lampMat); lg.position.set(x - 0.012, r - 0.04, 0.34); lg.scale.setScalar(0.78); g.add(lg);
  const lr = new THREE.Mesh(lampGeo, redMat); lr.position.set(x + 0.012, r - 0.04, 0.34); lr.scale.setScalar(0.78); g.add(lr);
  const lab = labelPlane(`${id}-${label}`, 0.052, 0.028, { w: 260, h: 140, size: 36, color: '#ffffff', bg: '#101113' });
  lab.position.set(x, r + 0.065, 0.318); g.add(lab);
  panelGrp.add(g);
  markClick(g, () => actions.toggleBreaker(id));
  breakers[id] = { lever, leverMat, lampMat, redMat, y: r };
});
