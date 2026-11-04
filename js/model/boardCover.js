/* Cubiertas del tablero: dos placas crema atornilladas a los rieles frontales.
   - Cubierta de pilotos (arriba): 7 luces de encendido/apagado: 3 rojas (general, salida, rodeo) y 4 verdes (entradas y salidas de las UPS).
   - Cubierta de automáticos (abajo): ranuras por las que solo asoma el interruptor de cada uno, con su placa de texto.
   Detrás quedan el riel con los cuerpos de los automáticos, las barras, las borneras y los cables.
   Cada cubierta es una tapa con bisagra en el borde izquierdo: se abre hacia afuera (no se retira) con la puerta frontal
   abierta, con un clic en ella o con el interruptor del panel para ambas. */
import * as THREE from 'three';
import { M, std } from '../core/materials.js';
import { box, labelPlane, textTex } from '../core/helpers.js';
import { markClick } from '../core/interaction.js';
import { tween } from '../core/tween.js';
import { actions } from '../core/bus.js';
import { BREAKERS, RAIL_ITEMS, SELECTOR, BYPASS_BREAKER } from '../config.js';
import { panelGrp, breakerPos, breakers, showBypassModel } from './breakerPanel.js';

const COVER_W = 0.55, COVER_Z = 0.357, T = 0.008;   // ancho, profundidad (centro) y espesor de las placas
const FACE_Z = COVER_Z + T / 2;                     // cara exterior
const OPEN_ANGLE = -1.75;                           // giro al abrirla (≈100° hacia afuera) sobre la bisagra del borde izquierdo

/** Placa crema entre las alturas y0..y1, con ranuras opcionales (`holes`: rectangulares { x, y, hw, hh } o redondas { x, y, r }) y 4 tornillos. */
function makeCover(y0, y1, tip, holes = []) {
  const g = new THREE.Group(), h = y1 - y0, cy = (y0 + y1) / 2;
  g.userData.tip = tip;
  const plate = new THREE.Shape();
  plate.moveTo(-COVER_W / 2, -h / 2); plate.lineTo(COVER_W / 2, -h / 2); plate.lineTo(COVER_W / 2, h / 2); plate.lineTo(-COVER_W / 2, h / 2); plate.closePath();
  for (const s of holes) {
    const p = new THREE.Path(), y = s.y - cy;
    if (s.r) p.absarc(s.x, y, s.r, 0, Math.PI * 2, false);     // orificio redondo (conmutador)
    else { p.moveTo(s.x - s.hw, y - s.hh); p.lineTo(s.x - s.hw, y + s.hh); p.lineTo(s.x + s.hw, y + s.hh); p.lineTo(s.x + s.hw, y - s.hh); p.closePath(); }
    plate.holes.push(p);
  }
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(plate, { depth: T, bevelEnabled: false }).translate(0, 0, -T / 2), M.frame);
  body.position.set(0, cy, COVER_Z); body.castShadow = true; body.receiveShadow = true;
  g.add(body);
  const screwGeo = new THREE.CylinderGeometry(0.0065, 0.0065, 0.006, 14).rotateX(Math.PI / 2);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const x = sx * 0.262, y = cy + sy * (h / 2 - 0.017);
    const s = new THREE.Mesh(screwGeo, std(0xc9ced4, 0.85, 0.3));
    s.position.set(x, y, FACE_Z + 0.003); g.add(s);
    box(0.01, 0.0015, 0.0015, M.dark, x, y, FACE_Z + 0.0062, g).rotation.z = Math.PI / 4;
  }
  g.userData.open = false;
  markClick(g, () => actions.toggleCover(g));
  // bisagra en el borde izquierdo: el contenido (g) cuelga de ella y la tapa gira al cambiar su ángulo
  const hinge = new THREE.Group(); hinge.position.set(-COVER_W / 2, 0, COVER_Z);
  g.position.set(COVER_W / 2, 0, -COVER_Z);
  hinge.add(g); g.userData.hinge = hinge;
  panelGrp.add(hinge);
  return g;
}

/* ---------- cubierta de pilotos (arriba) ---------- */
export const pilotCover = makeCover(1.72, 1.935, 'Cubierta de pilotos · clic para abrirla o cerrarla (con la puerta frontal abierta)');
const lampGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.014, 20).rotateX(Math.PI / 2);

/* 7 pilotos de encendido/apagado: 3 rojos arriba (general, salida, bypass de rodeo) y 4 verdes abajo (entradas y salidas de las UPS) */
const ROWS = { red: { n: 3, lamp: 1.876, tag: 1.846 }, green: { n: 4, lamp: 1.806, tag: 1.776 } };
const PILOT_X = -0.01, PILOT_PITCH = 0.1;
for (const { id, pilot } of RAIL_ITEMS) {
  const row = ROWS[pilot.color];
  const x = PILOT_X + (pilot.col - (row.n - 1) / 2) * PILOT_PITCH;
  const lamp = new THREE.Mesh(lampGeo, breakers[id].lampMat); lamp.position.set(x, row.lamp, FACE_Z + 0.004); pilotCover.add(lamp);
  const tag = labelPlane(pilot.text, 0.092, 0.015, { w: 400, h: 65, size: 44, color: '#ffffff', bg: '#101113' });
  tag.position.set(x, row.tag, FACE_Z + 0.0005); pilotCover.add(tag);
}
// advertencia
const warn = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.04), new THREE.MeshBasicMaterial({ map: textTex('⚠', { w: 64, h: 64, size: 46, bg: '#f2c200', color: '#111' }), toneMapped: false }));
warn.position.set(0.232, 1.84, FACE_Z + 0.0005); pilotCover.add(warn);

/* ---------- cubierta de automáticos (abajo) ---------- */
// ranura algo mayor que el interruptor y su recorrido
const slots = RAIL_ITEMS.map(({ id }) => (id === SELECTOR.id
  ? { x: breakerPos[id].x, y: breakerPos[id].r, hw: 0.0175, hh: 0.028 }   // ranura algo más ancha: sirve a la manija del conmutador y a la palanca del CB7
  : { x: breakerPos[id].x, y: breakerPos[id].r, hw: 0.014, hh: 0.028 }));
export const breakerCover = makeCover(1.545, 1.715, 'Cubierta de automáticos · clic para abrirla o cerrarla (con la puerta frontal abierta)', slots);
const plateOpts = { w: 260, h: 140, size: 36, color: '#ffffff', bg: '#101113' };
let selPlate = null, cb7Plate = null, selNumbers = null;     // elementos propios de cada configuración del último lugar
for (const { id, label } of RAIL_ITEMS) {
  const { x, r } = breakerPos[id], isSel = id === SELECTOR.id;
  const g = new THREE.Group();
  const lab = labelPlane(isSel ? label : `${id}-${label}`, 0.052, 0.028, plateOpts);
  lab.position.set(x, r + 0.05, FACE_Z + 0.0005); g.add(lab);
  breakerCover.add(g);
  markClick(g, () => (isSel ? actions.cycleSelector() : actions.toggleBreaker(id)));    // también se opera desde su placa
  if (isSel) {
    selPlate = g;
    // placa del interruptor CB7 (configuración anterior), en el mismo lugar
    const g7 = new THREE.Group();
    const l7 = labelPlane(`${BYPASS_BREAKER.id}-${BYPASS_BREAKER.label}`, 0.052, 0.028, plateOpts);
    l7.position.set(x, r + 0.05, FACE_Z + 0.0005); g7.add(l7);
    breakerCover.add(g7);
    markClick(g7, () => actions.toggleBreaker('CB7'));
    cb7Plate = g7;
  }
}
// posiciones del conmutador, grabadas en la cubierta alrededor de la manija: 1 (arriba a la izquierda), 0 (arriba), 2 (arriba a la derecha)
{
  const { x, r } = breakerPos[SELECTOR.id];
  selNumbers = new THREE.Group();
  for (const [t, dx, dy] of [['1', -0.022, 0.018], ['0', 0, 0.027], ['2', 0.022, 0.018]]) {
    const n = labelPlane(t, 0.012, 0.012, { w: 64, h: 64, size: 58, color: '#1b1c1f' });
    n.position.set(x + dx, r + dy, FACE_Z + 0.0005); selNumbers.add(n);
  }
  breakerCover.add(selNumbers);
}

/** Muestra lo propio de cada configuración del bypass de rodeo: conmutador 1-0-2 (true) o interruptor CB7 (false). */
export function applyBypassMode(conm) {
  showBypassModel(conm);
  selPlate.visible = selNumbers.visible = conm;
  cb7Plate.visible = !conm;
}

export const covers = [pilotCover, breakerCover];
export const isCoverOpen = c => c.userData.open;

/** Abre (true) o cierra (false) una cubierta girándola sobre su bisagra. */
export function moveCover(c, open) {
  c.userData.open = open;
  tween(c.userData.hinge.rotation, 'y', open ? OPEN_ANGLE : 0, 0.9);
}
