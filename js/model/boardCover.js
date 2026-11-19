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
import { panelGrp, breakerPos, breakerGroups, breakers, showBypassModel, sinEsferas, SC, MOD } from './breakerPanel.js';
import { build as buildPieza, P as POLO } from '../../tablero/modelos.js';

const COVER_W = 0.55, COVER_Z = 0.357, T = 0.008;   // ancho, profundidad (centro) y espesor de las placas
const FACE_Z = COVER_Z + T / 2;                     // cara exterior
const OPEN_ANGLE = -1.75;                           // giro al abrirla (≈100° hacia afuera) sobre la bisagra del borde izquierdo

/** Placa crema entre las alturas y0..y1, con ranuras opcionales (`holes`: rectangulares { x, y, hw, hh } o redondas { x, y, r }) y 4 tornillos. */
function makeCover(y0, y1, tip, holes = []) {
  const g = new THREE.Group(), h = y1 - y0, cy = (y0 + y1) / 2;
  g.userData.tip = tip;
  /** Placa de la tapa con las ranuras indicadas. */
  const placa = ranuras => {
    const plate = new THREE.Shape();
    plate.moveTo(-COVER_W / 2, -h / 2); plate.lineTo(COVER_W / 2, -h / 2); plate.lineTo(COVER_W / 2, h / 2); plate.lineTo(-COVER_W / 2, h / 2); plate.closePath();
    for (const s of ranuras) {
      const p = new THREE.Path(), y = s.y - cy;
      if (s.r) p.absarc(s.x, y, s.r, 0, Math.PI * 2, false);     // orificio redondo
      else { p.moveTo(s.x - s.hw, y - s.hh); p.lineTo(s.x - s.hw, y + s.hh); p.lineTo(s.x + s.hw, y + s.hh); p.lineTo(s.x + s.hw, y - s.hh); p.closePath(); }
      plate.holes.push(p);
    }
    return new THREE.ExtrudeGeometry(plate, { depth: T, bevelEnabled: false }).translate(0, 0, -T / 2);
  };
  const body = new THREE.Mesh(placa(holes), M.frame);
  body.position.set(0, cy, COVER_Z); body.castShadow = true; body.receiveShadow = true;
  g.add(body);
  g.userData.ranuras = ranuras => { body.geometry.dispose(); body.geometry = placa(ranuras); };   // cambia las ranuras de la propia tapa
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

/* tapa ciega fija sobre las cubiertas, hasta el marco superior del rack */
box(COVER_W, 0.03, T, M.frame, 0, 1.92, COVER_Z, panelGrp);
for (const sx of [-1, 1]) {
  const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0065, 0.006, 14).rotateX(Math.PI / 2), std(0xc9ced4, 0.85, 0.3));
  sc.position.set(sx * 0.262, 1.92, FACE_Z + 0.003); panelGrp.add(sc);
}

/* ---------- cubierta de pilotos (arriba) ---------- */
export const pilotCover = makeCover(1.692, 1.905, 'Cubierta de pilotos · clic para abrirla o cerrarla (con la puerta frontal abierta)');
/** Puntos de conexión de cada piloto, por detrás de la cubierta (se mueven con ella al abrirla): { x1: { a, end }, x2: { a, end } } */
export const pilotAnchors = {};
const PS = 0.72;                                              // escala del piloto del editor al tamaño del rack
const LFV = 0.014;                                            // largo de la virola (mismas unidades del piloto)

/* 7 pilotos de encendido/apagado: 3 rojos arriba (general, salida, bypass de rodeo) y 4 verdes abajo (entradas y salidas de las UPS) */
const ROWS = { red: { n: 3, lamp: 1.865, tag: 1.835 }, green: { n: 4, lamp: 1.795, tag: 1.765 } };
const PILOT_X = -0.01, PILOT_PITCH = 0.1;
for (const { id, pilot } of RAIL_ITEMS) {
  const row = ROWS[pilot.color];
  const x = PILOT_X + (pilot.col - (row.n - 1) / 2) * PILOT_PITCH;
  // el mismo piloto del editor: cuerpo detrás de la cubierta y la lente asomando por delante
  const pg = buildPieza({ id: `P${id}`, type: 'piloto', name: id, color: pilot.color === 'red' ? 'Rojo' : 'Verde', on: false }, undefined, { sinPlaca: true });
  pg.scale.setScalar(PS);
  pg.position.set(x, row.lamp - 0.022 * PS, COVER_Z - T / 2 - 0.04 * PS + 0.003);
  sinEsferas(pg);
  pilotCover.add(pg);
  breakers[id].pilot = pg;
  const an = {};
  for (const t of pg.userData.terms) {
    const a = new THREE.Object3D(); a.position.copy(t.pos); pg.add(a);
    const e = new THREE.Object3D(); e.position.set(0, -LFV, 0); a.add(e);          // extremo de la virola, donde empieza el cable
    an[t.key.toLowerCase()] = { a, end: e };
  }
  pilotAnchors[id] = an;
  const tag = labelPlane(pilot.text, 0.092, 0.015, { w: 400, h: 65, size: 44, color: '#ffffff', bg: '#101113' });
  tag.position.set(x, row.tag, FACE_Z + 0.0005); pilotCover.add(tag);
}
// advertencia
const warn = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.04), new THREE.MeshBasicMaterial({ map: textTex('⚠', { w: 64, h: 64, size: 46, bg: '#f2c200', color: '#111' }), toneMapped: false }));
warn.position.set(0.232, 1.83, FACE_Z + 0.0005); pilotCover.add(warn);

/* ---------- cubierta de automáticos (abajo) ---------- */
// cada ranura es justo del tamaño del automático: la tapa deja ver solo los automáticos, sin espacio de sobra
panelGrp.updateWorldMatrix(true, true);
const slots = RAIL_ITEMS.map(({ id }) => {
  const bb = new THREE.Box3().setFromObject(breakerGroups[id]);               // contorno del modelo del automático (o del conmutador)
  const a = panelGrp.worldToLocal(bb.min.clone()), b = panelGrp.worldToLocal(bb.max.clone()), m = 0.0008;   // 0,8 mm de holgura
  // los automáticos: solo el cuerpo del automático (un polo), sin el contacto auxiliar que va a su lado; el conmutador: todo su frente
  if (id !== SELECTOR.id) return { x: breakerPos[id].x, y: (a.y + b.y) / 2, hw: POLO * MOD * SC / 2 + m, hh: (b.y - a.y) / 2 + m };
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, hw: (b.x - a.x) / 2 + m, hh: (b.y - a.y) / 2 + m };
});
export const breakerCover = makeCover(1.531, 1.69, 'Cubierta de automáticos · clic para abrirla o cerrarla (con la puerta frontal abierta)', slots);
/* con el interruptor CB7 (configuración anterior) la ranura del último lugar se hace del tamaño de un automático: solo cambia la forma de la tapa */
const iSel = RAIL_ITEMS.findIndex(q => q.id === SELECTOR.id);
const slotsConm = slots;
const slotsCB7 = slots.map((q, i) => (i === iSel ? { ...slots[0], x: breakerPos.CB7.x } : q));                    // CB7 solo
{                                                                                                      // CB7 con su contacto auxiliar pegado a la izquierda: una sola ranura para los dos
  const a = breakerPos.AUX, c = slots[0], x0 = a.x - a.w / 2 - 0.0008, x1 = breakerPos.CB7.x + c.hw;
  var slotsCB7Aux = slots.map((q, i) => (i === iSel ? { ...c, x: (x0 + x1) / 2, hw: (x1 - x0) / 2 } : q));
}
const plateOpts = { w: 260, h: 140, size: 36, color: '#ffffff', bg: '#101113' };
let selPlate = null, cb7Plate = null, selNumbers = null, auxPlate = null;     // elementos propios de cada configuración del último lugar
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
    const l7 = labelPlane(`${BYPASS_BREAKER.id}-${BYPASS_BREAKER.label}`, 0.046, 0.028, plateOpts);
    l7.position.set(breakerPos.CB7.x + 0.0155, r + 0.05, FACE_Z + 0.0005); g7.add(l7);
    // papelito del contacto auxiliar, sobre su módulo
    const gA = new THREE.Group();
    const lA = labelPlane('CONT'+String.fromCharCode(10)+'AUX', 0.028, 0.028, { w: 140, h: 140, size: 40, color: '#ffffff', bg: '#101113' });
    lA.position.set(breakerPos.AUX.x, r + 0.05, FACE_Z + 0.0005); gA.add(lA);
    breakerCover.add(gA);
    markClick(gA, () => actions.toggleBreaker('CB7'));
    auxPlate = gA;
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
let ultimaTapa = '';
export function applyBypassMode(conm, aux = true) {
  showBypassModel(conm);
  selPlate.visible = selNumbers.visible = conm;
  cb7Plate.visible = !conm;
  auxPlate.visible = !conm && aux;
  const k = conm ? 'c' : aux ? 'a' : 'b';
  if (k !== ultimaTapa) { ultimaTapa = k; breakerCover.userData.ranuras(conm ? slotsConm : aux ? slotsCB7Aux : slotsCB7); }
}

export const covers = [pilotCover, breakerCover];
export const isCoverOpen = c => c.userData.open;

/** Abre (true) o cierra (false) una cubierta girándola sobre su bisagra. */
export function moveCover(c, open) {
  c.userData.open = open;
  tween(c.userData.hinge.rotation, 'y', open ? OPEN_ANGLE : 0, 0.9);
}
