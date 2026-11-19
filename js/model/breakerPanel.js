/* Tablero de automáticos (CB1…CB6) y conmutador bypass 1-0-2: 7 elementos en una línea, montados en un riel DIN bajo el techo.
   Los cuerpos quedan detrás de la cubierta (boardCover.js) y solo asoma el interruptor de cada uno. */
import * as THREE from 'three';
import { M, std } from '../core/materials.js';
import { box } from '../core/helpers.js';
import { markClick } from '../core/interaction.js';
import { actions } from '../core/bus.js';
import { BREAKERS, SELECTOR } from '../config.js';
import { rack } from './rack.js';
import { S } from '../state.js';
import { build as buildPieza } from '../../tablero/modelos.js';

export const panelGrp = new THREE.Group(); panelGrp.position.y = -0.01; rack.add(panelGrp);

/* sin lata trasera: todos los automáticos se montan en un riel DIN atornillado a los rieles frontales del rack */
const RAIL_Y = 1.609;
box(0.52, 0.035, 0.006, M.rail, 0, RAIL_Y, 0.311, panelGrp);          // riel
box(0.5, 0.008, 0.0065, M.dark, 0, RAIL_Y, 0.311, panelGrp);          // canal central del riel
for (const sx of [-1, 1]) box(0.014, 0.05, 0.02, M.rail, sx * 0.256, RAIL_Y, 0.318, panelGrp);   // escuadras de fijación
for (const x of [-0.2, 0.2]) box(0.008, 0.04, 0.02, std(0x7c838c, 0.5, 0.5), x, RAIL_Y, 0.318, panelGrp);   // topes que impiden que las piezas se corran

/** Partes móviles de cada automático, por id: { lever (la palanca que gira), pilot (el piloto de la cubierta), y }. */
export const breakers = {};
let selectorGroup = null, cb7Group = null, auxGroup = null;   // los dos modelos posibles del último lugar del riel
/** Posición de cada automático en el tablero: x, altura del centro y altura superior del cuerpo. */
export const breakerPos = {};
/** Grupo 3D (el mismo modelo del editor de tableros) de cada automático y del conmutador: de aquí salen las posiciones de sus bornes. */
export const breakerGroups = {};

const PITCH = 0.054, ROW_X = -0.01, ROW_Y = RAIL_Y;   // separación, centro horizontal y altura de la línea
export const SC = 0.55;                                // escala de los modelos del editor al tamaño del rack
export const MOD = 2;                                  // los automáticos son del doble de grosor que el modelo base del editor
const AW = 0.009;                                      // ancho del contacto auxiliar en el modelo del editor

/** Quita las esferas invisibles de clic de los bornes (son del editor de tableros). */
export function sinEsferas(g) {
  const quitar = [];
  g.traverse(o => { if (o.userData && o.userData.term) quitar.push(o); });
  quitar.forEach(o => o.parent.remove(o));
}

/** Palanca azul que gira en vertical sobre un eje horizontal (arriba = cerrado): brazo corto y punta ancha que asoma por la ranura. */
export const LEVER_ANGLE = 0.6;
function makeLever(mat, x, r, parent) {
  const lever = new THREE.Group(); lever.position.set(x, r, 0.350);
  box(0.008, 0.007, 0.022, mat, 0, 0, 0.011, lever);                    // brazo
  box(0.022, 0.012, 0.006, mat, 0, 0, 0.0215, lever);                   // punta ancha
  lever.rotation.x = -LEVER_ANGLE;                                      // arranca cerrado
  parent.add(lever);
  return lever;
}

/* los automáticos son los del editor de tableros: cuerpo blanco, palanca azul, contacto auxiliar a la derecha y bornes con virolas.
   Quedan detrás de la cubierta y solo asoma la palanca */
BREAKERS.forEach(({ id }, i) => {
  const x = ROW_X + (i - 3) * PITCH, r = ROW_Y;
  const G = buildPieza({ id, type: 'breaker', name: id, poles: 1, amp: 'C40', on: true, aux: true, mod: MOD }, undefined, { sinPlaca: true });
  G.scale.setScalar(SC); G.position.set(x + AW / 2 * SC, r, 0.314);
  sinEsferas(G);
  panelGrp.add(G);
  markClick(G, () => actions.toggleBreaker(id));
  breakers[id] = { lever: G.userData.pivote, y: r };
  breakerPos[id] = { x, r, top: r + 0.033 };
  breakerGroups[id] = G;
});

/* conmutador bypass (1-0-2) de 2 polos en el último lugar del riel: el cuerpo queda detrás de la cubierta
   y solo asoma la perilla por la ranura */
{
  const x = ROW_X + (BREAKERS.length - 3) * PITCH, r = ROW_Y;
  const G = selectorGroup = buildPieza({ id: 'SEL', type: 'selector', name: 'SEL', poles: 2, pos: 1 }, undefined, { sinPlaca: true });
  G.scale.setScalar(SC); G.position.set(x, r, 0.322);
  G.userData.tip = 'Conmutador bypass 1-0-2 · clic para girarlo (1 = UPS, 0 = corte, 2 = red)';
  sinEsferas(G);
  panelGrp.add(G);
  markClick(G, () => actions.cycleSelector());
  breakers[SELECTOR.id] = { handle: G.userData.knob, y: r };
  breakerPos[SELECTOR.id] = { x, r, top: r + 0.036 };
  breakerGroups[SELECTOR.id] = G;
}

/* configuración anterior: en el mismo lugar, un interruptor CB7 de bypass de rodeo: el mismo automático del editor que los demás (solo asoma su palanca) */
{
  const { r } = breakerPos[SELECTOR.id], x = breakerPos[SELECTOR.id].x + 0.012;      // el CB7 va corrido a la derecha para que quepa el papelito del contacto auxiliar
  const G = cb7Group = buildPieza({ id: 'CB7', type: 'breaker', name: 'CB7', poles: 1, amp: 'C63', on: false, aux: true, mod: MOD }, undefined, { sinPlaca: true });
  G.scale.setScalar(SC); G.position.set(x + AW / 2 * SC, r, 0.314);
  sinEsferas(G);
  panelGrp.add(G);
  markClick(G, () => actions.toggleBreaker('CB7'));
  breakers.CB7 = { lever: G.userData.pivote, y: r };
  breakerGroups.CB7 = G;
  breakerPos.CB7 = { x, r, top: r + 0.033 };

  /* contacto auxiliar adelantado: un automático delgado (un módulo) pegado al lado izquierdo del CB7, con palanca verde. La palanca azul del CB7 se
     engancha a la verde con una grapa: al subir el rodeo arrastra al contacto, que ya cerró unas milésimas antes */
  const wCB7 = 0.027 * MOD * SC, wAux = 0.027 * SC, xA = x - wCB7 / 2 - wAux / 2;
  const A = auxGroup = buildPieza({ id: 'AUX', type: 'breaker', name: 'AUX', poles: 1, amp: 'C6', on: false, aux: false, verde: true }, undefined, { sinPlaca: true });
  A.scale.setScalar(SC); A.position.set(xA, r, 0.314);
  A.userData.tip = 'Contacto auxiliar adelantado del CB7 (palanca verde): cierra unas milésimas antes que el rodeo y avisa a la UPS 1 (esta a la UPS 2) para pasar a bypass estático';
  sinEsferas(A);
  panelGrp.add(A);
  markClick(A, () => actions.toggleBreaker('CB7'));
  breakers.AUX = { lever: A.userData.pivote, y: r };
  breakerGroups.AUX = A;
  breakerPos.AUX = { x: xA, r, top: r + 0.033, w: wAux };
}

/** Muestra el conmutador 1-0-2 (true) o el interruptor CB7 de la configuración anterior (false). */
export function showBypassModel(conm) {
  selectorGroup.visible = conm;
  cb7Group.visible = !conm;
  auxGroup.visible = !conm && S.auxRodeo;
}
