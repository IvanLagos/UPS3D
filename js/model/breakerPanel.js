/* Tablero de automáticos (CB1…CB6) y conmutador bypass 1-0-2: 7 elementos en una línea, montados en un riel DIN bajo el techo.
   Los cuerpos quedan detrás de la cubierta (boardCover.js) y solo asoma el interruptor de cada uno. */
import * as THREE from 'three';
import { M, std } from '../core/materials.js';
import { box } from '../core/helpers.js';
import { markClick } from '../core/interaction.js';
import { actions } from '../core/bus.js';
import { BREAKERS, SELECTOR } from '../config.js';
import { rack } from './rack.js';

export const panelGrp = new THREE.Group(); panelGrp.position.y = -0.01; rack.add(panelGrp);

/* sin lata trasera: todos los automáticos se montan en un riel DIN atornillado a los rieles frontales del rack */
const RAIL_Y = 1.609;
box(0.52, 0.035, 0.006, M.rail, 0, RAIL_Y, 0.311, panelGrp);          // riel
box(0.5, 0.008, 0.0065, M.dark, 0, RAIL_Y, 0.311, panelGrp);          // canal central del riel
for (const sx of [-1, 1]) box(0.014, 0.05, 0.02, M.rail, sx * 0.256, RAIL_Y, 0.318, panelGrp);   // escuadras de fijación

/** Partes móviles/luminosas de cada automático, por id: { lever, leverMat, lampMat, y }. */
export const breakers = {};
let selectorGroup = null, cb7Group = null;   // los dos modelos posibles del último lugar del riel
/** Posición de cada automático en el tablero: x, altura del centro y altura superior del cuerpo (donde llega su cable). */
export const breakerPos = {};

const PITCH = 0.054, ROW_X = -0.01, ROW_Y = RAIL_Y;   // separación, centro horizontal y altura de la línea

BREAKERS.forEach(({ id, pilot }, i) => {
  const x = ROW_X + (i - 3) * PITCH, r = ROW_Y;
  const g = new THREE.Group();
  box(0.046, 0.06, 0.035, M.white, x, r, 0.33, g);          // cuerpo blanco: queda detrás de la cubierta
  const leverMat = std(0x888f99, 0.3, 0.5, { emissive: 0x000000 });
  const lever = box(0.016, 0.03, 0.03, leverMat, x, r, 0.358, g);   // solo el interruptor asoma por la cubierta
  // piloto de encendido/apagado: va montado en la cubierta de pilotos (ver boardCover.js)
  const red = pilot.color === 'red';
  const lampMat = std(red ? 0x560c0c : 0x0a5222, 0.2, 0.4, { emissive: 0x000000, emissiveIntensity: 1 });
  lampMat.toneMapped = false;
  panelGrp.add(g);
  markClick(g, () => actions.toggleBreaker(id));
  breakers[id] = { lever, leverMat, lampMat, y: r };
  breakerPos[id] = { x, r, top: r + 0.03 };
});

/* conmutador bypass (1-0-2) en el último lugar del riel: el cuerpo queda detrás de la cubierta
   y solo asoma la manija por un orificio redondo */
{
  const x = ROW_X + (BREAKERS.length - 3) * PITCH, r = ROW_Y;
  const g = selectorGroup = new THREE.Group();
  g.userData.tip = 'Conmutador bypass 1-0-2 · clic para girarlo (1 = UPS, 0 = corte, 2 = red)';
  box(0.046, 0.06, 0.035, M.white, x, r, 0.33, g);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.046, 20).rotateX(Math.PI / 2), M.dark);
  shaft.position.set(x, r, 0.352); g.add(shaft);
  const handle = new THREE.Group(); handle.position.set(x, r, 0.378);
  handle.rotation.z = Math.PI / 4;                                   // arranca en la posición 1
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.0135, 0.0135, 0.01, 20).rotateX(Math.PI / 2), M.dark);
  handle.add(hub);
  box(0.014, 0.034, 0.008, M.dark, 0, 0.012, 0, handle);             // manija
  box(0.004, 0.012, 0.0085, M.white, 0, 0.024, 0.0005, handle);      // marca blanca en la punta
  g.add(handle);
  const lampMat = std(0x560c0c, 0.2, 0.4, { emissive: 0x000000, emissiveIntensity: 1 });
  lampMat.toneMapped = false;
  panelGrp.add(g);
  markClick(g, () => actions.cycleSelector());
  breakers[SELECTOR.id] = { handle, lampMat, y: r };
  breakerPos[SELECTOR.id] = { x, r, top: r + 0.03 };
}

/* configuración anterior: en el mismo lugar, un interruptor CB7 de bypass de rodeo (solo asoma su palanca) */
{
  const { x, r } = breakerPos[SELECTOR.id];
  const g = cb7Group = new THREE.Group();
  box(0.046, 0.06, 0.035, M.white, x, r, 0.33, g);
  const leverMat = std(0x888f99, 0.3, 0.5, { emissive: 0x000000 });
  const lever = box(0.016, 0.03, 0.03, leverMat, x, r, 0.358, g);
  panelGrp.add(g);
  markClick(g, () => actions.toggleBreaker('CB7'));
  breakers.CB7 = { lever, leverMat, y: r };
}

/** Muestra el conmutador 1-0-2 (true) o el interruptor CB7 de la configuración anterior (false). */
export function showBypassModel(conm) {
  selectorGroup.visible = conm;
  cb7Group.visible = !conm;
}
