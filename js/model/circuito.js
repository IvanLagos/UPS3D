/* Circuito eléctrico del tablero del rack: repartidores modulares, barra de tierra, borneras, el medidor domiciliario junto al rack
   y los cables con sus terminales (virolas aisladas y terminales de ojo). Es el mismo circuito del editor de tableros:
   medidor → repartidor RED → CB5 → repartidor ENTRADAS → CB1 / CB3 → UPS → CB2 / CB4 → repartidor SALIDAS → conmutador 1-0-2 → CB6 → carga,
   con neutro, tierra y los pilotos alimentados por el contacto auxiliar de cada automático.
   Los automáticos, pilotos, conmutador, borneras y medidor son los modelos del editor (tablero/modelos.js).
   Cada cable conserva su color (rojo, naranja, negro, azul, café, verde-amarillo); donde hay tensión solo brilla suavemente. */
import * as THREE from 'three';
import { scene, camera, controls, renderer, POZO } from '../core/scene.js';
import { view } from '../core/dom.js';
import { M, std } from '../core/materials.js';
import { box, labelPlane } from '../core/helpers.js';
import { markClick, toast } from '../core/interaction.js';
import { S, E } from '../state.js';
import { BREAKERS } from '../config.js';
import { panelGrp, breakerGroups, breakerPos, sinEsferas } from './breakerPanel.js';
import { pilotAnchors, pilotCover } from './boardCover.js';
import { build as buildPieza } from '../../tablero/modelos.js';
import { ORDEN } from './cablesOrden.js';

const LFV = 0.014, LFO = 0.016;                       // largo de la virola y del terminal de ojo
const GLOW = { amarillo: 0x3d2400, verde: 0x0a3d1e, azul: 0x0a2a55 };   // brillo suave: no cambia el color del cable

/* ---------- repartidores modulares azules (fase y neutro) ---------- */
const REP_Y = 1.855, REP_H = 0.05, REP_PITCH = 0.0115;
const REPS = [
  { id: 'RED', n: 3, tip: 'Repartidor RED · fase de la red, antes del general (CB5)' },
  { id: 'ENT', n: 7, tip: 'Repartidor ENTRADAS · fase después del general, alimenta CB1, CB3 y el conmutador bypass' },
  { id: 'SAL', n: 4, tip: 'Repartidor SALIDAS UPS · fase de las salidas de las UPS (CB2 y CB4) hacia el conmutador bypass' },
  { id: 'NA', n: 7, tip: 'Repartidor de NEUTRO 1 · medidor, UPS y carga' },
  { id: 'NB', n: 8, tip: 'Repartidor de NEUTRO 2 · pilotos · puenteado con el neutro 1' },
];
const REP_NAME = { RED: 'RED', ENT: 'ENTRADAS', SAL: 'SALIDAS', NA: 'NEUTRO 1', NB: 'NEUTRO 2' };      // etiquetas amarillas (sin la palabra «repartidor»)
const coverMats = {};                                  // un material translúcido por repartidor, para el brillo
const repX0 = {};
{
  let x = -0.2475;
  for (const r of REPS) {
    const w = 0.025 + r.n * REP_PITCH, cx = x + w / 2, g = new THREE.Group();
    repX0[r.id] = x;
    box(w, REP_H, 0.021, std(0x2a2d33, 0.3, 0.6), cx, REP_Y, 0.3195, g);                                      // base gris oscura
    const mat = new THREE.MeshPhysicalMaterial({ color: 0x2a6fff, transparent: true, opacity: 0.8, roughness: 0.25, metalness: 0, emissive: 0x000000 });
    const cov = new THREE.Mesh(new THREE.BoxGeometry(w - 0.002, REP_H - 0.004, 0.01), mat); cov.position.set(cx, REP_Y, 0.330); cov.castShadow = true; g.add(cov);
    coverMats[r.id] = mat;
    const tornillo = std(0xc9ced4, 0.9, 0.3);
    for (let k = 0; k < r.n; k++) {
      const hx = x + 0.0125 + k * REP_PITCH;
      for (const dy of [0.012, -0.004]) {                                                                         // dos filas de tornillos
        const s = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0042, 0.004, 12).rotateX(Math.PI / 2), tornillo); s.position.set(hx, REP_Y + dy, 0.337); g.add(s);
      }
      box(0.009, 0.003, 0.012, M.dark, hx, REP_Y - REP_H / 2 + 0.0015, 0.322, g);                                 // boca del cable
    }
    // todas las etiquetas del mismo tamaño (placa y letra), del ancho del repartidor más angosto
    const lab = labelPlane(REP_NAME[r.id], 0.066, 0.016, { w: 420, h: 102, size: 62, color: '#111111', bg: '#f2c200' });
    lab.position.set(cx, REP_Y + REP_H / 2 + 0.0115, 0.337); g.add(lab);
    g.userData.tip = r.tip;
    panelGrp.add(g); markClick(g, () => {});
    x += w + 0.01;
  }
}
/** Riel DIN horizontal de lado a lado del rack, atornillado a los rieles frontales con escuadras y con topes en los extremos del grupo de piezas. */
function rielDIN(y, x0, x1) {
  box(0.52, 0.035, 0.006, M.rail, 0, y, 0.311, panelGrp);                                  // riel
  box(0.5, 0.008, 0.0065, M.dark, 0, y, 0.311, panelGrp);                                  // canal central del riel
  for (const sx of [-1, 1]) box(0.014, 0.05, 0.02, M.rail, sx * 0.256, y, 0.318, panelGrp);   // escuadras de fijación
  for (const x of [x0, x1]) box(0.008, 0.04, 0.02, std(0x7c838c, 0.5, 0.5), x, y, 0.318, panelGrp);   // topes que impiden que las piezas se corran
}
rielDIN(REP_Y, -0.2535, 0.2535);

/* ---------- barra de tierra: cobre con terminales de ojo ---------- */
const PE_Y = 1.730, PE_X = [0.13, 0.156, 0.182, 0.208, 0.234];       // en el mismo riel que las borneras, a la derecha: UPS 1, UPS 2, carga, estructura del rack y tierra de servicio
{
  const g = new THREE.Group(), cu = std(0xd08a4a, 0.8, 0.4), cx = (PE_X[0] + PE_X[PE_X.length - 1]) / 2, w = PE_X[PE_X.length - 1] - PE_X[0] + 0.024;
  box(w, 0.014, 0.008, cu, cx, PE_Y, 0.322, g);                                         // barra de cobre
  box(w, 0.002, 0.0085, std(0xe8a868, 0.5, 0.5), cx, PE_Y + 0.0072, 0.322, g);          // canto brillante
  for (const sx of [-1, 1]) {
    const aisl = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.016, 16).rotateX(Math.PI / 2), std(0xc21a1a, 0.2, 0.5));
    aisl.position.set(cx + sx * (w / 2 - 0.006), PE_Y, 0.314); g.add(aisl);
  }
  for (const x of PE_X) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.005, 6).rotateX(Math.PI / 2), std(0xc9ced4, 0.9, 0.3)); t.position.set(x, PE_Y, 0.3305); g.add(t);
  }
  const lab = labelPlane('BARRA TIERRA', 0.07, 0.012, { w: 360, h: 62, size: 28, color: '#111111', bg: '#f2c200' });
  lab.position.set(cx, PE_Y + 0.017, 0.337); g.add(lab);
  g.userData.tip = 'Barra de tierra de protección (PE) de cobre · UPS 1, UPS 2, carga, estructura del rack y tierra de servicio';
  panelGrp.add(g); markClick(g, () => {});
}

/* ---------- borneras del editor sobre riel DIN: 6 grises (fase), 5 azules (neutro) y 3 verde-amarillo (tierra) ---------- */
const BORN_Y = 1.730, BORN_PITCH = 0.011, SCB = 0.5;
const BX = i => -0.0825 + i * BORN_PITCH;
const BORN = [
  ['Fase', 'UPS 1 · entrada (L)'], ['Fase', 'UPS 1 · salida (L)'], ['Fase', 'UPS 2 · entrada (L)'], ['Fase', 'UPS 2 · salida (L)'], ['Fase', 'CARGA (L)'], ['Fase', 'reserva'],
  ['Neutro', 'UPS 1 · entrada (N)'], ['Neutro', 'UPS 1 · salida (N)'], ['Neutro', 'UPS 2 · entrada (N)'], ['Neutro', 'UPS 2 · salida (N)'], ['Neutro', 'CARGA (N)'],
  ['Tierra', 'UPS 1 · tierra (PE)'], ['Tierra', 'UPS 2 · tierra (PE)'], ['Tierra', 'CARGA (PE)'],
  ['Fase', 'UPS 1 · contacto seco (señal auxiliar del CB7)'], ['Fase', 'UPS 1 · contacto seco (retorno)'],
];
rielDIN(BORN_Y, -0.0975, 0.0925);
const bornGroups = BORN.map(([tipo, tip], i) => {
  const g = buildPieza({ id: `B${i}`, type: 'bornera', name: `B${i}`, tipo }, undefined, { sinPlaca: true });
  g.scale.setScalar(SCB); g.position.set(BX(i), BORN_Y, 0.314); sinEsferas(g);
  g.userData.tip = `Bornera · ${tip} · el cable sigue hacia la UPS o la carga`;
  panelGrp.add(g); markClick(g, () => {});
  return g;
});
const dinLab = labelPlane('BORNERAS', 0.05, 0.011, { w: 240, h: 53, size: 28, color: '#ffffff', bg: '#101113' });
dinLab.position.set(-0.075, 1.7125, 0.333); panelGrp.add(dinLab);

/* ---------- terminales: puntos donde se conectan los cables ---------- */
/** id → { x, y, z, dir (+1 el cable sale hacia arriba, -1 hacia abajo), tipo: 'virola' | 'ojal' } */
const TERM = {};
const reg = (id, x, y, dir, z = 0.325, tipo = 'virola') => { TERM[id] = { x, y, z, dir, tipo }; return id; };
const lf = t => (t.tipo === 'ojal' ? LFO : LFV);
const endOf = id => { const t = TERM[id]; return { x: t.x, y: t.y + t.dir * lf(t) }; };

scene.updateMatrixWorld(true);
/** Registra los bornes de un grupo del editor: alias → clave del borne en el modelo. */
function regGrupo(G, alias) {
  for (const [a, key] of Object.entries(alias)) {
    const t = G.userData.terms.find(q => q.key === key), p = panelGrp.worldToLocal(G.localToWorld(t.pos.clone()));
    reg(a, p.x, p.y, Math.sign(t.dir.y), p.z);
  }
}
for (const { id } of BREAKERS) {
  // el contacto auxiliar va montado al revés: su borne inferior (13) sale al piloto por arriba
  regGrupo(breakerGroups[id], { [`${id}.top`]: '1', [`${id}.bot`]: '2', [`${id}.a14`]: '13', [`${id}.a13`]: '14' });
}
regGrupo(breakerGroups.SEL, { 'SEL.1': '1/1', 'SEL.2': '1/2', 'SEL.C': '1/C', 'SEL.2b': '2/2', 'SEL.Cb': '2/C' });
// configuración anterior: el interruptor CB7 del bypass de rodeo, en el mismo lugar, es un automático más (con su contacto auxiliar mirando hacia arriba)
regGrupo(breakerGroups.CB7, { 'CB7.top': '1', 'CB7.bot': '2', 'CB7.a14': '13', 'CB7.a13': '14' });
bornGroups.forEach((g, i) => regGrupo(g, { [`B${i}.top`]: '1', [`B${i}.bot`]: '2' }));
const repHole = (id, k) => reg(`${id}#${k}`, repX0[id] + 0.0125 + k * REP_PITCH, REP_Y - REP_H / 2 + 0.002, -1, 0.322);
for (const r of REPS) for (let k = 0; k < r.n; k++) repHole(r.id, k);
regGrupo(breakerGroups.AUX, { 'AUX.top': '1', 'AUX.bot': '2' });          // contacto auxiliar adelantado (automático delgado verde, a la izquierda del CB7): sus bornes son el contacto seco hacia la UPS 1
const peLug = k => reg(`PE@${k}`, PE_X[k], PE_Y, -1, 0.3305, 'ojal');   // terminal de ojo bajo el tornillo de la barra de tierra
PE_X.forEach((_, k) => peLug(k));

/* tierra de servicio: pica de cobre clavada junto al rack; y la estructura del rack, con un perno en la escuadra del riel */
const RACK_STUD = { x: 0.2565, y: PE_Y + 0.015 };
box(0.012, 0.012, 0.004, std(0xc9ced4, 0.9, 0.3), RACK_STUD.x, RACK_STUD.y, 0.330, panelGrp);          // arandela del perno de la estructura
{ const b = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.006, 6).rotateX(Math.PI / 2), std(0xb9bec4, 0.9, 0.3)); b.position.set(RACK_STUD.x, RACK_STUD.y, 0.334); panelGrp.add(b); }
reg('RACK', RACK_STUD.x, RACK_STUD.y, -1, 0.334, 'ojal');
const rodGrp = new THREE.Group(); rodGrp.position.set(POZO.x, 0, POZO.z); scene.add(rodGrp);
{
  const cuRod = std(0xc47a3d, 0.7, 0.45);
  const { r: rp, prof } = POZO;
  // paredes y fondo del pozo: capas de tierra (vegetal, arcilla, arena, grava)
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 512;
  {
    const g = cv.getContext('2d');
    const capas = [[0, 0.12, '#3b2a1c'], [0.12, 0.42, '#6b4a2e'], [0.42, 0.7, '#8a6a43'], [0.7, 1, '#7d7468']];
    for (const [a, b, c] of capas) { g.fillStyle = c; g.fillRect(0, a * 512, 256, (b - a) * 512 + 1); }
    let r = 7;                                                                    // ruido repetible
    const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
    for (let n = 0; n < 1400; n++) { const y = rnd() * 512, t = y / 512; g.fillStyle = `rgba(${t > 0.7 ? '170,165,155' : '30,20,12'},${0.15 + rnd() * 0.3})`; g.fillRect(rnd() * 256, y, 1 + rnd() * 4, 1 + rnd() * 3); }
    for (let n = 0; n < 60; n++) { g.fillStyle = `rgba(190,185,175,${0.5 + rnd() * 0.4})`; g.beginPath(); g.ellipse(rnd() * 256, 360 + rnd() * 150, 2 + rnd() * 5, 2 + rnd() * 4, 0, 0, 7); g.fill(); }
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping;
  const tierra = new THREE.Mesh(new THREE.CylinderGeometry(rp, rp, prof, 32), new THREE.MeshStandardMaterial({ map: tex, roughness: 1, side: THREE.BackSide }));
  tierra.position.y = -prof / 2; rodGrp.add(tierra);
  // brocal de hormigón alrededor del pozo
  const horm = new THREE.MeshStandardMaterial({ color: 0xb9b9b3, roughness: 0.95, metalness: 0 });
  const aro = new THREE.Mesh(new THREE.CylinderGeometry(rp + 0.025, rp + 0.025, 0.03, 32, 1, true), horm); aro.material.side = THREE.DoubleSide; aro.position.y = 0.015; rodGrp.add(aro);   // brocal redondo
  const aro2 = new THREE.Mesh(new THREE.RingGeometry(rp, rp + 0.025, 32).rotateX(-Math.PI / 2), horm); aro2.position.y = 0.03; rodGrp.add(aro2);
  const barra = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.14 + prof - 0.05, 14), cuRod); barra.position.y = (0.14 - (prof - 0.05)) / 2; barra.castShadow = true; rodGrp.add(barra);   // pica de cobre: enterrada casi hasta el fondo
  const abraz = new THREE.Mesh(new THREE.CylinderGeometry(0.0155, 0.0155, 0.04, 16), std(0x6b7a3a, 0.6, 0.4)); abraz.position.y = 0.11; rodGrp.add(abraz);        // abrazadera de bronce
  rodGrp.userData.tip = 'Pica de tierra de servicio (puesta a tierra del tablero)';
  markClick(rodGrp, () => {});
  scene.updateMatrixWorld(true); panelGrp.updateWorldMatrix(true, true);
  const p = panelGrp.worldToLocal(rodGrp.localToWorld(new THREE.Vector3(0, 0.13, 0.0165)));
  reg('PAT', p.x, p.y, 1, p.z, 'ojal');
}

/* medidor domiciliario junto al rack: la red entra por los bornes 1 y 3 y sale por 2 (fase) y 4 (neutro) */
const meterGrp = new THREE.Group(); meterGrp.position.set(-0.78, 1.5, 0.2); scene.add(meterGrp);
box(0.27, 0.34, 0.012, std(0xbfc3c8, 0.3, 0.5), 0, 0, -0.006, meterGrp);
const meter = buildPieza({ id: 'M', type: 'medidor', name: 'MEDIDOR' });
meter.scale.setScalar(1.5); meterGrp.add(meter);
box(0.03, 1.5, 0.03, M.rail, 0, -0.75 - 0.17, -0.02, meterGrp);                                        // poste que lo sostiene
sinEsferas(meter);
meterGrp.userData.tip = 'Medidor domiciliario · entrega la red eléctrica (fase y neutro) al tablero del rack';
markClick(meterGrp, () => {});
scene.updateMatrixWorld(true);
regGrupo(meter, { 'MED.L': '2', 'MED.N': '4' });

/* ---------- cables ---------- */
const COL = { rojo: 0xc62828, naranja: 0xe07a1f, negro: 0x1a1a1c, azul: 0x1f5fd6, cafe: 0x7a4a21, tierra: 'tierra' };
const VIROLA = { 1.5: 0x1a1a1a, 10: 0xd62828, 16: 0x1f5fd6 };
const wireR = mm2 => 0.0012 + 0.0002 * Math.sqrt(mm2);
const stripe = (() => {
  const c = document.createElement('canvas'); c.width = 64; c.height = 8;
  const g = c.getContext('2d'); g.fillStyle = '#f2c200'; g.fillRect(0, 0, 32, 8); g.fillStyle = '#1e9a3e'; g.fillRect(32, 0, 32, 8);
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
})();

const cables = new THREE.Group(); panelGrp.add(cables);
const wires = [];                                     // { net, mat, a, b, via, z, mm2, mesh, group, dyn, sel }
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
let idx = 0;
/** Capas de profundidad de los cables (delante de las piezas y detrás de la cubierta): separadas más que el grosor de dos cables. */
const CAPAS = [0.3365, 0.3413, 0.3461, 0.3509, 0.3317, 0.3269, 0.3221, 0.3173, 0.3125, 0.3077];   // plano delantero (donde cada cable hace su "guatita"); la última solo se usa si hace falta
const CAPAS_ATRAS = [0.298, 0.293, 0.288, 0.283, 0.278, 0.273, 0.268, 0.263, 0.258, 0.253];  // plano trasero: los cables corren DETRÁS de los rieles (que están en z 0,308 a 0,314)
const zTras = zf => CAPAS_ATRAS[CAPAS.indexOf(zf)];
const KEY = 'ups3d-cables-v1' + (window.__cliente && window.__cliente.id !== 'oxiquim' ? '-' + window.__cliente.id : '');   // OXIQUIM conserva su clave de siempre
let guardado = {};
try { guardado = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { guardado = {}; }
const clave = w => `${w.net}|${w.a}|${w.b}`;
const guardar = () => {
  const o = {};
  for (const w of wires) if (!w.dyn && JSON.stringify(w.via) !== JSON.stringify(w.via0)) o[clave(w)] = w.via;
  try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* sin almacenamiento */ }
};

/** Polilínea con esquinas redondeadas. */
function curva(pts, r = 0.006) {
  const q = pts.filter((p, i) => i === 0 || p.distanceTo(pts[i - 1]) > 1e-6);
  const path = new THREE.CurvePath(); let prev = q[0].clone();
  for (let i = 1; i < q.length - 1; i++) {
    const a = q[i - 1], p = q[i], b = q[i + 1], da = a.distanceTo(p), db = b.distanceTo(p), rr = Math.min(r, da * 0.45, db * 0.45);
    const p1 = p.clone().lerp(a, rr / da), p2 = p.clone().lerp(b, rr / db);
    if (prev.distanceTo(p1) > 1e-6) path.add(new THREE.LineCurve3(prev.clone(), p1));
    path.add(new THREE.QuadraticBezierCurve3(p1, p.clone(), p2)); prev = p2;
  }
  path.add(new THREE.LineCurve3(prev, q[q.length - 1].clone()));
  return path;
}

/** Terminal en el extremo de un cable: virola aislada, o terminal de ojo bajo el tornillo de la barra. */
function terminalVisual(t, mm2) {
  const g = new THREE.Group(), r = wireR(mm2) + 0.0007, mat = std(VIROLA[mm2] ?? 0xf2c200, 0.1, 0.5);
  const orient = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), V3(0, t.dir, 0));
  const cil = (len, desde) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), mat);
    c.quaternion.copy(orient); c.position.set(t.x, t.y + t.dir * (desde + len / 2), t.z); return c;
  };
  if (t.tipo === 'ojal') {
    const metal = std(0xcfd3d8, 0.9, 0.3, { side: THREE.DoubleSide });
    const aro = new THREE.Mesh(new THREE.RingGeometry(0.0035, 0.0088, 24), metal); aro.position.set(t.x, t.y, t.z); g.add(aro);
    const leng = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.01, 0.0012), metal); leng.position.set(t.x, t.y + t.dir * 0.009, t.z); g.add(leng);
    g.add(cil(0.012, 0.012 - 0.002));
  } else g.add(cil(LFV, 0));
  return g;
}

/** Puntos de cada extremo: borne, salida recta, «guatita» (un bucle de cable sobrante hacia un lado, donde cabe la tenaza amperimétrica)
 *  y la zambullida hacia el plano trasero, detrás del riel. */
const FA = 6;
function extremo(id, zf, zr) {
  const t = TERM[id], e = endOf(id), d = t.dir, s = Math.round(e.x / 0.0055) % 2 === 0 ? 1 : -1;   // los bucles de terminales vecinos se abren hacia lados opuestos
  return [V3(e.x, e.y, t.z), V3(e.x, e.y + d * 0.006, t.z), V3(e.x + s * 0.010, e.y + d * 0.012, zf), V3(e.x + s * 0.010, e.y + d * 0.020, zf), V3(e.x, e.y + d * 0.026, zf), V3(e.x, e.y + d * 0.031, zr)];
}
/** Recorrido en escuadra: del borne, por su guatita, hasta el plano trasero; por los puntos intermedios (x, y) detrás de los rieles y vuelta al otro borne. */
function trayecto(a, b, via, zf) {
  const zr = zTras(zf), A = extremo(a, zf, zr), B = extremo(b, zf, zr).reverse();
  return [...A, ...via.map(([x, y]) => V3(x, y, zr)), ...B];
}

/** Crea un cable entre dos terminales; `via` son los puntos intermedios. net: a qué parte del circuito pertenece (para iluminarlo). */
function S_(net, a, b, color, mm2, via = [], opts = {}) {
  const z = CAPAS[idx++ % 4];
  const col = COL[color], tierra = col === 'tierra';
  const mat = tierra ? new THREE.MeshStandardMaterial({ map: stripe.clone(), roughness: 0.55, emissive: 0x000000 }) : std(col, 0.1, 0.55, { emissive: 0x000000 });
  const w = { net, mat, a, b, via, via0: via.map(v => [...v]), z, mm2, tierra, mesh: null, sel: !!opts.sel, cb7: !!opts.cb7, aux: !!opts.aux, group: new THREE.Group(), dyn: opts.dyn || null, aj: { dy: 0 } };
  const o = ORDEN[`${net}|${a}|${b}`];                         // orden de fábrica (ya calculado)
  if (o) {
    if (o.via) { w.via = o.via.map(v => [...v]); w.via0 = o.via.map(v => [...v]); }
    if (o.k !== undefined) w.z = CAPAS[o.k];
    if (o.dy) w.aj.dy = o.dy;
  }
  const g = !opts.dyn && guardado[`${net}|${a}|${b}`];
  if (g) w.via = g;                                           // orden manual guardado
  if (a) w.group.add(terminalVisual(TERM[a], mm2));
  if (b) w.group.add(terminalVisual(TERM[b], mm2));          // los extremos que van a un piloto llevan su propia virola
  cables.add(w.group);
  construir(w);
  wires.push(w);
  return w;
}
function construir(w) {
  if (w.mesh) { w.group.remove(w.mesh); w.mesh.geometry.dispose(); }
  const pts = w.dyn ? w.dyn(w) : trayecto(w.a, w.b, w.via, w.z);
  const c = curva(pts), len = c.getLength();
  w.pts = pts; w.curve = c;
  if (w.tierra) { w.mat.map.needsUpdate = true; w.mat.map.repeat.set(len / 0.03, 1); }
  const m = new THREE.Mesh(new THREE.TubeGeometry(c, Math.min(300, Math.max(24, Math.round(len / 0.004))), wireR(w.mm2), 8, false), w.mat);
  m.castShadow = true; w.group.add(m); w.mesh = m;
}

/* pistas: cada cable de un mismo canal o troncal ocupa un lugar propio */
const cuenta = {};
const pista = (k, base, paso = 0.0048) => { const n = cuenta[k] = (cuenta[k] || 0) + 1, m = n - 1; return base + (m === 0 ? 0 : (m % 2 ? (m + 1) / 2 : -m / 2)) * paso; };
const yA = () => pista('A', 1.678, 0.0036), yC = () => pista('C', 1.548, 0.004);        // canal sobre los automáticos / bajo ellos
const yB1 = () => pista('B1', 1.7995, 0.0033), yB2 = () => pista('B2', 1.7745, 0.0033);   // canales bajo los repartidores
const xL = () => pista('L', -0.228, 0.0045), xR = () => pista('R', 0.228, 0.0045);      // troncales laterales
const tx = id => TERM[id].x;
const hole = (id, k) => `${id}#${k}`;

const x5 = tx('CB5.top'), x1 = tx('CB1.top'), x2 = tx('CB2.top'), x3 = tx('CB3.top'), x4 = tx('CB4.top'), x6 = tx('CB6.top');

// fase de la red → general → repartidor de entradas
S_('mains', 'CB5.top', hole('RED', 1), 'rojo', 16, (() => { const y = yB1(); return [[x5, y], [tx(hole('RED', 1)), y]]; })());
{ const c = yC(), l = xL(), y = yB1(); S_('ent', 'CB5.bot', hole('ENT', 0), 'rojo', 16, [[x5, c], [l, c], [l, y], [tx(hole('ENT', 0)), y]]); }
{ const y = yB1(); S_('ent', 'CB1.top', hole('ENT', 1), 'rojo', 10, [[x1, y], [tx(hole('ENT', 1)), y]]); }
{ const y = yB1(); S_('ent', 'CB3.top', hole('ENT', 2), 'rojo', 10, [[x3, y], [tx(hole('ENT', 2)), y]]); }
{ const y = yB1(); S_('ent', 'SEL.2', hole('ENT', 3), 'rojo', 16, [[tx('SEL.2'), y], [tx(hole('ENT', 3)), y]], { sel: true }); }
// entrada de cada UPS: CB1 / CB3 → bornera → (cable a la UPS)
{ const c = yC(), l = xL(), a = yA(); S_('u1in', 'CB1.bot', 'B0.bot', 'rojo', 10, [[x1, c], [l, c], [l, a], [tx('B0.bot'), a]]); }
{ const c = yC(), r = xR(), a = yA(); S_('u2in', 'CB3.bot', 'B2.bot', 'rojo', 10, [[x3, c], [r, c], [r, a], [tx('B2.bot'), a]]); }
// salida de cada UPS: bornera → CB2 / CB4 → repartidor de salidas
{ const a = yA(); S_('u1out', 'B1.bot', 'CB2.top', 'naranja', 10, [[tx('B1.bot'), a], [x2, a]]); }
{ const a = yA(); S_('u2out', 'B3.bot', 'CB4.top', 'naranja', 10, [[tx('B3.bot'), a], [x4, a]]); }
{ const c = yC(), l = xL(), y = yB2(); S_('u1dl', 'CB2.bot', hole('SAL', 0), 'naranja', 10, [[x2, c], [l, c], [l, y], [tx(hole('SAL', 0)), y]]); }
{ const c = yC(), r = xR(), y = yB2(); S_('u2dl', 'CB4.bot', hole('SAL', 1), 'naranja', 10, [[x4, c], [r, c], [r, y], [tx(hole('SAL', 1)), y]]); }
// conmutador bypass: 1 = UPS (repartidor de salidas), 2 = red (repartidor de entradas), C = hacia CB6 → carga
{ const y = yB2(); S_('sal', 'SEL.1', hole('SAL', 2), 'naranja', 16, [[tx('SEL.1'), y], [tx(hole('SAL', 2)), y]], { sel: true }); }
{ const c = yC(), r = xR(), a = yA(); S_('selc', 'SEL.C', 'CB6.top', 'negro', 16, [[tx('SEL.C'), c], [r, c], [r, a], [x6, a]], { sel: true }); }
{ const c = yC(), r = xR(), a = yA(); S_('load', 'CB6.bot', 'B4.bot', 'negro', 16, [[x6, c], [r, c], [r, a], [tx('B4.bot'), a]]); }
// neutro y tierra: de las borneras a sus repartidores / barra
for (let i = 6; i <= 10; i++) { const y = yB2(); S_('neu', `B${i}.top`, hole('NA', i - 5), 'azul', 10, [[tx(`B${i}.top`), y], [tx(hole('NA', i - 5)), y]]); }
// puente entre los dos repartidores de neutro, con virolas como los demás cables: del último agujero del neutro 1 a un agujero del neutro 2 lejos de las subidas de fase
{ const y = yB2(); S_('neu', hole('NA', 6), hole('NB', 4), 'azul', 10, [[tx(hole('NA', 6)), y], [tx(hole('NB', 4)), y]]); }
for (let i = 11; i <= 13; i++) { const y = pista('P', 1.6925, 0.003); S_('pe', `PE@${i - 11}`, `B${i}.bot`, 'tierra', 10, [[PE_X[i - 11], y], [tx(`B${i}.bot`), y]]); }
{ const y = pista('P', 1.6925, 0.003); S_('pe', 'PE@3', 'RACK', 'tierra', 16, [[PE_X[3], y], [RACK_STUD.x, y]]); }                    // estructura del rack
{ const y = pista('P', 1.6925, 0.003); S_('pe', 'PE@4', 'PAT', 'tierra', 16, [[PE_X[4], y], [0.268, y], [0.268, 2.12], [rodGrp.position.x + 0.03, 2.12], [rodGrp.position.x + 0.03, 0.3], [tx('PAT'), 0.3]]); }   // tierra de servicio: sube por el costado, pasa sobre el techo hasta el costado izquierdo, entre el medidor y el rack, y baja hasta la pica

// piloto de cada automático: 13 ← borne inferior del automático, 14 → piloto (solo conduce con el automático cerrado)
for (const { id } of BREAKERS) {
  const y = TERM[`${id}.bot`].y - LFV - 0.012;
  S_(`p${id}`, `${id}.bot`, `${id}.a13`, 'cafe', 1.5, [[tx(`${id}.bot`), y], [tx(`${id}.a13`), y]]);
}

/* medidor → repartidores RED y neutro 1: los cables suben por fuera del rack, entran por el techo y bajan hasta sus repartidores */
{
  const yT = 2.075, gl = -0.236;
  const ruta = (src, h, xo, yo, xg) => {
    const ys = endOf(h).y - 0.012;
    return [[TERM[src].x, TERM[src].y - 0.06 - yo], [xo, TERM[src].y - 0.06 - yo], [xo, yT + yo], [xg, yT + yo], [xg, ys], [TERM[h].x, ys]];
  };
  S_('mains', 'MED.L', hole('RED', 0), 'rojo', 16, ruta('MED.L', hole('RED', 0), -0.42, 0, gl));
  S_('neu', 'MED.N', hole('NA', 0), 'azul', 16, ruta('MED.N', hole('NA', 0), -0.435, 0.008, gl - 0.012));
}

/* neutro y alimentación de los pilotos: los 14 cables llegan por detrás del tablero a una boca fija junto a la bisagra y entran a una manguera
   flexible blanca; la manguera sigue pegada a la parte baja de la tapa de pilotos, de lado a lado, y desde ella cada cable sale directo
   hacia el borne de su piloto. La parte flexible se dobla sola al abrir la tapa; el resto va fijo a la tapa. */
const pilotIds = [...BREAKERS.map(b => b.id), 'SEL'];
const pilotEnd = (id, k) => { const p = new THREE.Vector3(); pilotAnchors[id][k].end.getWorldPosition(p); return panelGrp.worldToLocal(p); };
for (const id of pilotIds) for (const k of ['x1', 'x2']) {         // virolas en los bornes del piloto (viajan con la cubierta)
  pilotAnchors[id][k].a.add(terminalVisual({ x: 0, y: 0, z: 0, dir: -1, tipo: 'virola' }, 1.5));
}
const H0 = V3(-0.29, 1.7035, 0.300);                               // collar fijo junto a la bisagra (eje en z)
const HEL = V3(-0.268, 1.7035, 0.340);                            // extremo de la manguera pegada a la tapa (en el sistema de la tapa)
const MANGUERA_R = 0.011, COLLAR_R = 0.0125;
const collarMat = std(0xb9bec4, 0.6, 0.4);
const hoseTex = (() => {                                            // aros de la manguera corrugada
  const c = document.createElement('canvas'); c.width = 16; c.height = 8;
  const g = c.getContext('2d'); g.fillStyle = '#f7f8fa'; g.fillRect(0, 0, 10, 8); g.fillStyle = '#c9ced4'; g.fillRect(10, 0, 6, 8);
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const hoseMat = () => { const t = hoseTex.clone(); t.needsUpdate = true; return new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, metalness: 0 }); };
{
  const cf = new THREE.Mesh(new THREE.CylinderGeometry(COLLAR_R, COLLAR_R, 0.012, 20).rotateX(Math.PI / 2), collarMat); cf.position.copy(H0); panelGrp.add(cf);
  box(0.034, 0.012, 0.012, M.rail, H0.x + 0.016, H0.y, H0.z - 0.002, panelGrp);                  // escuadra que lo sujeta al montante
}
/** Posiciones de los 14 cables dentro de la boca de la manguera (un círculo): [dx, dy]. */
const BOCA = (() => {
  const o = [[0, 0]];
  for (let k = 0; k < 6; k++) { const a = k * Math.PI * 2 / 6; o.push([Math.cos(a) * 0.004, Math.sin(a) * 0.004]); }
  for (let k = 0; k < 8; k++) { const a = k * Math.PI * 2 / 8 + 0.2; o.push([Math.cos(a) * 0.0078, Math.sin(a) * 0.0078]); }
  return o;
})().sort((a, b) => a[1] - b[1]);                                   // de abajo hacia arriba

const manguera = new THREE.Mesh(new THREE.BufferGeometry(), hoseMat());                   // tramo flexible: del collar fijo a la tapa
manguera.castShadow = true; panelGrp.add(manguera);
/** Rehace el tramo flexible: sale hacia adelante del collar fijo y llega al extremo de la tapa, doblándose según donde esté la tapa. */
function armarManguera() {
  pilotCover.updateWorldMatrix(true, false);
  const he = panelGrp.worldToLocal(pilotCover.localToWorld(HEL.clone()));
  const T = V3(1, 0, 0).transformDirection(pilotCover.matrixWorld);               // hacia dónde sigue la manguera pegada a la tapa
  const p0 = V3(H0.x, H0.y, H0.z + 0.006), d = p0.distanceTo(he), h = Math.max(0.012, 0.4 * d);
  const c = new THREE.CubicBezierCurve3(p0, p0.clone().add(V3(0, 0, h)), he.clone().addScaledVector(T, -h), he);
  const geo = new THREE.TubeGeometry(c, 48, MANGUERA_R, 14, false);
  manguera.geometry.dispose(); manguera.geometry = geo;
  manguera.material.map.repeat.set(Math.max(1, c.getLength() / 0.0045), 1);
}

/* cables de pilotos: tramo fijo (por atrás, hasta la boca fija) + tramo corto de la manguera de la tapa a cada borne */
const dinamicos = [];
/* los 14 cables suben en orden y sin cruzarse entre ellos: a más a la derecha empiezan, más alto va su tramo horizontal, más a la izquierda su columna
   y más arriba su lugar en la boca. Los de la alimentación (13-14) van más abajo que los de los neutros. */
const x1s = [...pilotIds.map(id => ({ id, key: 'x1', start: id === 'SEL' ? 'SEL.Cb' : `${id}.a14`, net: id === 'SEL' ? 'pSEL' : `p${id}`, color: 'cafe', sel: id === 'SEL' })),
  { id: 'SEL', key: 'x1', start: 'CB7.a14', net: 'pCB7x', color: 'cafe', sel: false, cb7: true }]      // el piloto del rodeo, alimentado por el auxiliar del CB7 en la configuración anterior
  .sort((a, b) => TERM[a.start].x - TERM[b.start].x).map((g, i) => ({ ...g, tr: 1.70 + i * 0.005 }));
const holesNB = pilotIds.map(id => ({ id, x: pilotEnd(id, 'x2').x })).sort((p, q) => p.x - q.x).map(q => q.id);
const nbs = holesNB.map((id, k) => ({ id, key: 'x2', start: hole('NB', k < 4 ? k : k + 1), net: 'neu', color: 'azul', sel: false, tr: 1.785 + k * 0.005 }));
const grupos = [...x1s, ...nbs];
grupos.forEach((g, n) => {
  const [ox, oy] = BOCA[n], tronco = -0.19 - n * 0.004;
  const dn = w => {
    const e = endOf(g.start), zr = zTras(w.z), y = g.tr + w.aj.dy;
    return [...extremo(g.start, w.z, zr), V3(e.x, y, zr), V3(tronco, y, zr), V3(tronco, H0.y + oy, zr), V3(H0.x + ox, H0.y + oy, zr), V3(H0.x + ox, H0.y + oy, H0.z - 0.002)];
  };
  const w = S_(g.net, g.start, null, g.color, 1.5, [], { dyn: dn, sel: g.sel, cb7: g.cb7 });
  w.cap = [3, 4, 5, 6, 7, 8, 9];                                          // las capas traseras más profundas: así pasan por detrás del montante del rack
  if (!w.cap.includes(CAPAS.indexOf(w.z))) { w.z = CAPAS[3 + (n % 5)]; construir(w); }
  w.cfg = { ox, oy, d: pilotEnd(g.id, g.key) };
  dinamicos.push(w);
});
{
  // manguera pegada a la tapa: recorre la parte baja de lado a lado y de ella sale cada cable, derecho hacia arriba, hasta su piloto
  const xFin = Math.max(...dinamicos.map(w => w.cfg.d.x)) + 0.012, y0 = HEL.y, z0 = HEL.z;
  const largo = xFin - HEL.x;
  const recta = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(HEL.clone(), V3(xFin, y0, z0)), 40, MANGUERA_R, 14, false), hoseMat());
  recta.material.map.repeat.set(largo / 0.0045, 1); recta.castShadow = true; pilotCover.add(recta);
  const tope = new THREE.Mesh(new THREE.CylinderGeometry(MANGUERA_R + 0.0008, MANGUERA_R + 0.0008, 0.005, 14).rotateZ(Math.PI / 2), collarMat); tope.position.set(xFin + 0.0025, y0, z0); pilotCover.add(tope);
  const union = new THREE.Mesh(new THREE.CylinderGeometry(MANGUERA_R + 0.0017, MANGUERA_R + 0.0017, 0.006, 16).rotateZ(Math.PI / 2), collarMat); union.position.set(HEL.x, y0, z0); pilotCover.add(union);   // unión entre el tramo flexible y el de la tapa
  for (const w of dinamicos) {
    const { d } = w.cfg, ys = y0 + MANGUERA_R;
    const arandela = new THREE.Mesh(new THREE.CylinderGeometry(0.0034, 0.0034, 0.004, 12), collarMat); arandela.position.set(d.x, ys, z0); pilotCover.add(arandela);   // salida del cable
    const pts = [V3(d.x, ys - 0.002, z0), V3(d.x, ys + 0.006, z0), V3(d.x, d.y - 0.012, z0 + (d.z - z0) * 0.5), V3(d.x, d.y - 0.006, d.z), d];
    const m = new THREE.Mesh(new THREE.TubeGeometry(curva(pts, 0.004), 40, wireR(1.5), 8, false), w.mat);
    m.castShadow = true; pilotCover.add(m); w.meshC = m;
  }
}
armarManguera();
{ const y = yB1(); S_('pSELe', 'SEL.2b', hole('ENT', 4), 'cafe', 1.5, [[tx('SEL.2b'), y], [tx(hole('ENT', 4)), y]], { sel: true }); }

/* configuración anterior, con el interruptor CB7 (bypass de rodeo): la red va por CB7 directo a la barra de salidas, y esa barra alimenta a CB6 */
{ const y = yB1(); S_('ent', 'CB7.top', hole('ENT', 5), 'rojo', 16, [[tx('CB7.top'), y], [tx(hole('ENT', 5)), y]], { cb7: true }); }               // red (barra de entradas) → CB7
{ const c = yC(), r = xR(), y = yB2(); S_('rodeo', 'CB7.bot', hole('SAL', 3), 'rojo', 16, [[tx('CB7.bot'), c], [r, c], [r, y], [tx(hole('SAL', 3)), y]], { cb7: true }); }   // CB7 → barra de salidas
{ const y = yB2(); S_('salc', hole('SAL', 2), 'CB6.top', 'naranja', 16, [[tx(hole('SAL', 2)), y], [x6, y]], { cb7: true }); }                      // barra de salidas → CB6 (sin conmutador)
{ const ya = yA(); S_('auxsen', 'AUX.top', 'B14.bot', 'naranja', 1.5, [[tx('AUX.top'), ya], [tx('B14.bot'), ya]], { cb7: true, aux: true }); }   // señal adelantada → contacto seco de la UPS 1
{ const c = yC(), r = xR(), ya = yA(); S_('auxsen', 'AUX.bot', 'B15.bot', 'negro', 1.5, [[tx('AUX.bot'), c], [r, c], [r, ya], [tx('B15.bot'), ya]], { cb7: true, aux: true }); }
{ const y = TERM['CB7.bot'].y - LFV - 0.012; S_('pCB7', 'CB7.bot', 'CB7.a13', 'cafe', 1.5, [[tx('CB7.bot'), y], [tx('CB7.a13'), y]], { cb7: true }); }   // auxiliar del CB7 para su piloto

/* ---------- orden de los cables: que no se toquen ---------- */
const SEP = 0.0006;                                    // holgura mínima entre dos cables
function muestrasDe(pts) {                              // muestras sobre la polilínea (sin armar la curva): rápido
  const out = [], seg = pts.slice(1).map((p, k) => p.distanceTo(pts[k])), L = seg.reduce((a, d) => a + d, 0);
  let acc = 0;
  for (let k = 0; k < seg.length; k++) {
    const a = pts[k], b = pts[k + 1], d = seg[k], n = Math.max(1, Math.ceil(d / 0.003));
    for (let q = 0; q < n; q++) { const t = q / n, s = acc + t * d; if (s < 0.018 || s > L - 0.018) continue; out.push([a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t]); }   // se ignoran los extremos: allí se juntan en el mismo borne
    acc += d;
  }
  out.cells = new Map();                                // rejilla de 6 mm: solo se comparan muestras de casillas vecinas
  for (const q of out) { const k = Math.floor(q[0] / 0.006) + ',' + Math.floor(q[1] / 0.006); (out.cells.get(k) || out.cells.set(k, []).get(k)).push(q); }
  out.bb = out.length ? [Math.min(...out.map(q => q[0])), Math.min(...out.map(q => q[1])), Math.max(...out.map(q => q[0])), Math.max(...out.map(q => q[1]))] : [1, 1, 1, 1];
  return out;
}
const chocan = (A, B, lim) => {
  const m = Math.sqrt(lim);                             // descarte rápido: si las cajas que los contienen no se acercan, no se tocan
  if (A.bb[2] + m < B.bb[0] || B.bb[2] + m < A.bb[0] || A.bb[3] + m < B.bb[1] || B.bb[3] + m < A.bb[1]) return false;
  for (const a of A) {
    const ix = Math.floor(a[0] / 0.006), iy = Math.floor(a[1] / 0.006);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const lista = B.cells.get((ix + dx) + ',' + (iy + dy));
      if (lista) for (const b of lista) { const ex = a[0] - b[0], ey = a[1] - b[1]; if (ex * ex + ey * ey < lim) return true; }
    }
  }
  return false;
};
/**
 * Ordena los cables para que no se toquen: (1) reparte los cables en capas de profundidad, de modo que dos que se cruzan o
 * van muy juntos queden en capas distintas; (2) si aun así quedan pares en la misma capa, mueve de a poco sus tramos
 * (hacia un lado o el otro) hasta separarlos, uno por uno.
 */
function ordenarUna(avisar = false, armar = true) {
  const act = wires.filter(w => w.group.visible), n = act.length, r = act.map(w => wireR(w.mm2));
  const lim = (i, j) => (r[i] + r[j] + SEP) ** 2;
  const mu = act.map(w => muestrasDe(w.pts));
  const conf = () => {                                  // pares que se acercan, desde las muestras actuales
    const c = Array.from({ length: n }, () => new Set());
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (chocan(mu[i], mu[j], lim(i, j))) { c[i].add(j); c[j].add(i); }
    return c;
  };
  let cf = conf();
  const capa = new Array(n).fill(-1);
  const ok = (i, k) => !act[i].cap || act[i].cap.includes(k);       // algunos cables solo pueden ir en ciertas capas
  const cuenta = (i, k) => { let c = 0; for (const j of cf[i]) if (capa[j] === k) c++; return c; };
  const asignar = () => {
    const orden = [...Array(n).keys()].sort((a, b) => cf[b].size - cf[a].size);
    capa.fill(-1);
    for (const i of orden) { let mejor = 0, mc = Infinity; CAPAS.forEach((_, k) => { if (!ok(i, k)) return; const c = cuenta(i, k); if (c < mc) { mc = c; mejor = k; } }); capa[i] = capa[i] < 0 || ok(i, mejor) ? mejor : 0; }
    for (let it = 0; it < 6; it++) for (const i of orden) { let mejor = capa[i], mc = cuenta(i, capa[i]); CAPAS.forEach((_, k) => { if (!ok(i, k)) return; const c = cuenta(i, k); if (c < mc) { mc = c; mejor = k; } }); capa[i] = mejor; }
  };
  const pares = () => { let t = 0; for (let i = 0; i < n; i++) t += cuenta(i, capa[i]); return t / 2; };
  asignar();
  let juntos = pares();
  const total = cf.reduce((a, s) => a + s.size, 0) / 2;
  if (window.__totalCables === undefined || avisar !== 'seguir') window.__totalCables = total;

  // (2) separar a mano, de a un cable, los que siguen tocándose
  for (let pasada = 0; pasada < 4 && juntos > 0; pasada++) {
    for (let i = 0; i < n && juntos > 0; i++) {
      const w = act[i];
      if (cuenta(i, capa[i]) === 0) continue;
      const base = w.pts.map(p => ({ x: p.x, y: p.y }));
      let mejor = null, mejorC = cuenta(i, capa[i]);
      if (w.dyn) {                                       // cables de los pilotos: se prueba subir o bajar su tramo horizontal
        const dy0 = w.aj.dy;
        for (const d of [0.004, -0.004, 0.008, -0.008, 0.012, -0.012, 0.016, -0.016, 0.02, -0.02, 0.024, -0.024]) {
          w.aj.dy = dy0 + d;
          const m = muestrasDe(w.dyn(w)), nuevos = new Set();
          for (let j = 0; j < n; j++) if (j !== i && chocan(m, mu[j], lim(i, j))) nuevos.add(j);
          let mk = capa[i], mc = Infinity;
          CAPAS.forEach((_, kk) => { if (!ok(i, kk)) return; let c = 0; for (const j of nuevos) if (capa[j] === kk) c++; if (c < mc) { mc = c; mk = kk; } });
          if (mc < mejorC) { mejorC = mc; mejor = { dy: dy0 + d, m, nuevos, capa: mk }; }
        }
        w.aj.dy = dy0;
      }
      for (let k = FA - 1; !w.dyn && k < base.length - FA; k++) {
        const a = base[k], b = base[k + 1];
        const o = Math.abs(a.y - b.y) < 1e-6 ? 'h' : Math.abs(a.x - b.x) < 1e-6 ? 'v' : null;
        if (!o || (Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6)) continue;
        const c0 = o === 'h' ? a.y : a.x;
        for (const d of [0.0045, -0.0045, 0.009, -0.009, 0.0135, -0.0135, 0.018, -0.018, 0.0225, -0.0225, 0.027, -0.027]) {
          const via = viaDeSeccion(base, k, o, c0 + d);
          const m = muestrasDe(trayecto(w.a, w.b, via, w.z));
          const nuevos = new Set();
          for (let j = 0; j < n; j++) if (j !== i && chocan(m, mu[j], lim(i, j))) nuevos.add(j);
          let mk = capa[i], mc = Infinity;
          CAPAS.forEach((_, kk) => { if (!ok(i, kk)) return; let c = 0; for (const j of nuevos) if (capa[j] === kk) c++; if (c < mc) { mc = c; mk = kk; } });
          if (mc < mejorC) { mejorC = mc; mejor = { via, m, nuevos, capa: mk }; }
        }
      }
      if (mejor) {                                       // se aplica el movimiento que más separa
        if (mejor.dy !== undefined) w.aj.dy = mejor.dy; else w.via = mejor.via;
        mu[i] = mejor.m;
        for (const j of cf[i]) cf[j].delete(i);
        cf[i] = mejor.nuevos; for (const j of mejor.nuevos) cf[j].add(i);
        capa[i] = mejor.capa;
        juntos = pares();
      }
    }
  }
  act.forEach((w, i) => { w.z = CAPAS[capa[i]]; w.pts = w.dyn ? w.dyn(w) : trayecto(w.a, w.b, w.via, w.z); if (armar) construir(w); });
  window.__paresCables = [];                            // para depurar: pares que siguen tocándose
  for (let i = 0; i < n; i++) for (const j of cf[i]) if (j > i && capa[j] === capa[i]) window.__paresCables.push(`${act[i].a}>${act[i].b} ~ ${act[j].a}>${act[j].b}`);
  if (avisar) toast(juntos ? `Cables ordenados: ${total} cruces o cercanías resueltos; quedan ${juntos} pares que se tocan (arrastre un cable para separarlos)` : `Cables ordenados: ${total} cruces o cercanías resueltos, ninguno se toca`);
  return juntos;
}

/** Repite el orden hasta que ningún par se toque (o no mejore más). */
export function ordenarCables(avisar = false) {
  let juntos = ordenarUna(false, false), total = window.__totalCables;
  for (let i = 0, ant = juntos + 1; i < 3 && juntos > 0 && juntos < ant; i++) { ant = juntos; juntos = ordenarUna(false, false); }
  wires.forEach(w => { if (w.group.visible) construir(w); });
  if (avisar) toast(juntos ? `Cables ordenados: ${total} cruces o cercanías resueltos; quedan ${juntos} par(es) que se tocan (arrastre un cable para separarlos)` : `Cables ordenados: ${total} cruces o cercanías resueltos, ninguno se toca`);
  return juntos;
}

/* orden a mano: se toma un cable por la sección que se quiera y se arrastra; esa sección se desplaza y sus esquinas la siguen */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const esCable = o => { for (; o; o = o.parent) if (o === cables) return true; return false; };
const visible = o => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
function puntero(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
}
const distSeg = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};
/** Nuevos puntos de paso al desplazar el tramo i de `base` a la coordenada c (y si es horizontal, x si es vertical). */
function viaDeSeccion(base, i, o, c) {
  const n = base.length, R = [], mov = p => (o === 'h' ? { x: p.x, y: c } : { x: c, y: p.y });
  base.forEach((p, k) => {
    if (k === i) { if (i === FA - 1) R.push({ ...p }, mov(p)); else R.push(mov(p)); }
    else if (k === i + 1) { if (i + 1 === n - FA) R.push(mov(p), { ...p }); else R.push(mov(p)); }
    else R.push({ ...p });
  });
  const via = [];
  for (const p of R.slice(FA, R.length - FA)) {
    const q = [+p.x.toFixed(4), +p.y.toFixed(4)], u = via[via.length - 1] || [+R[FA - 1].x.toFixed(4), +R[FA - 1].y.toFixed(4)];
    if (q[0] !== u[0] || q[1] !== u[1]) via.push(q);
  }
  return via;
}
let sg = null;
view.addEventListener('pointerdown', e => {
  if (e.button !== 0 || e.ctrlKey || e.altKey || e.shiftKey || e.target !== renderer.domElement) return;
  puntero(e);
  // el cable más cercano al puntero en pantalla (los cables son finos: se admite un margen de 8 px)
  const rc = renderer.domElement.getBoundingClientRect();
  let w = null, pl = null, dmin2 = 64, dcam = 0;
  for (const q of wires) {
    if (q.dyn || !visible(q.group)) continue;
    const L = q.curve.getLength(), N = Math.max(8, Math.round(L / 0.004));
    for (let k = 0; k <= N; k++) {
      const pp = q.curve.getPointAt(k / N), pw = panelGrp.localToWorld(pp.clone()), v = pw.clone().project(camera);
      if (v.z > 1) continue;
      const sx = (v.x + 1) / 2 * rc.width + rc.left, sy = (1 - v.y) / 2 * rc.height + rc.top, d2 = (sx - e.clientX) ** 2 + (sy - e.clientY) ** 2;
      if (d2 < dmin2) { dmin2 = d2; w = q; pl = pp; dcam = camera.position.distanceTo(pw); }
    }
  }
  if (!w) return;
  const delante = ray.intersectObjects(scene.children, true).find(h => h.object.isMesh && visible(h.object));
  if (delante && !esCable(delante.object) && delante.distance < dcam - 0.003) return;           // algo tapa el cable (una cubierta, una puerta)
  const base = w.pts.map(p => ({ x: p.x, y: p.y }));
  let mejor = -1, dmin = Infinity;
  for (let i = FA - 1; i < base.length - FA; i++) {
    const a = base[i], b = base[i + 1];
    if (Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6) continue;
    const d = distSeg(pl, a, b); if (d < dmin) { dmin = d; mejor = i; }
  }
  if (mejor < 0 || dmin > 0.012) return;                                  // el puntero no está sobre un tramo que se pueda mover (la guatita no se mueve)
  const a = base[mejor], b = base[mejor + 1], o = Math.abs(a.y - b.y) < 1e-6 ? 'h' : Math.abs(a.x - b.x) < 1e-6 ? 'v' : null;
  if (!o) return;
  sg = { w, base, i: mejor, o, z: zTras(w.z), ini: { x: e.clientX, y: e.clientY }, mov: false, k: null };
  controls.enabled = false;
  window.addEventListener('pointermove', moverCable); window.addEventListener('pointerup', soltarCable);
}, true);
function moverCable(e) {
  if (!sg) return;
  if (!sg.mov && Math.hypot(e.clientX - sg.ini.x, e.clientY - sg.ini.y) < 5) return;
  sg.mov = true;
  puntero(e);
  const pw = new THREE.Vector3();
  if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -sg.z), pw)) return;
  const p = panelGrp.worldToLocal(pw);
  const c = Math.round((sg.o === 'h' ? p.y : p.x) / 0.0015) * 0.0015;          // ajuste de 1,5 mm
  if (c === sg.k) return;
  sg.k = c;
  sg.w.via = viaDeSeccion(sg.base, sg.i, sg.o, c);
  construir(sg.w);
  renderer.domElement.style.cursor = 'grabbing';
}
function soltarCable() {
  window.removeEventListener('pointermove', moverCable); window.removeEventListener('pointerup', soltarCable);
  controls.enabled = true; renderer.domElement.style.cursor = '';
  if (sg && sg.mov) { ordenarCables(); guardar(); }
  sg = null;
}
document.getElementById('btnOrdenarCables')?.addEventListener('click', () => ordenarCables(true));
document.getElementById('btnRestCables')?.addEventListener('click', () => {
  for (const w of wires) if (!w.dyn) w.via = w.via0.map(v => [...v]);
  try { localStorage.removeItem(KEY); } catch (e) { /* sin almacenamiento */ }
  ordenarCables(true);
});
/* si ya hay un orden de fábrica para todos los cables no hace falta calcularlo al abrir la demo */
if (wires.some(w => !ORDEN[`${w.net}|${w.a}|${w.b}`])) ordenarCables();

/** Solo para regenerar cablesOrden.js: orden actual de todos los cables. */
window.__exportarOrden = () => JSON.stringify(Object.fromEntries(wires.map(w => [`${w.net}|${w.a}|${w.b}`, { via: w.dyn ? undefined : w.via, k: CAPAS.indexOf(w.z), dy: w.dyn ? +w.aj.dy.toFixed(4) : undefined }])));

/** Los cables de los pilotos se rehacen mientras la cubierta se mueve. */
let ultimoAngulo = null;
export function updateCircuito() {
  const ang = pilotCover.userData.hinge.rotation.y;
  if (ang === ultimoAngulo) return;
  ultimoAngulo = ang;
  armarManguera();
}
/** Para volver a ordenar los cables cuando termina de moverse la cubierta. */
export const reordenar = () => ordenarCables();

/* ---------- iluminación según el estado ---------- */
/** Brilla suavemente donde hay tensión; el color del cable no cambia. */
function glow(mat, on, hex) {
  mat.emissive.setHex(on ? hex : 0x000000);
  mat.emissiveIntensity = on ? 1 : 0;
}

export function applyCircuito() {
  const { units, gen, out } = E;
  const delInv = E.del.some(x => x.mode === 'normal' || x.mode === 'bateria');
  const outG = delInv ? GLOW.verde : GLOW.amarillo;          // en bypass o por el rodeo la salida va con la red (amarillo)
  const busOut = E.del.length > 0 || E.rodeo;
  const unitOut = u => ['normal', 'bateria', 'bypass'].includes(units[u].mode);
  const gU = u => (units[u].mode === 'bypass' ? GLOW.amarillo : GLOW.verde);
  const lamp = { CB1: units[0].inAvail, CB2: units[0].deliver, CB3: units[1].inAvail, CB4: units[1].deliver, CB5: gen, CB6: out, SEL: E.rodeo };
  const neutro = S.mains || out || E.inv;
  const Y = GLOW.amarillo;
  const net = {
    mains: [S.mains, Y], ent: [gen, Y], u1in: [units[0].inAvail, Y], u2in: [units[1].inAvail, Y],
    u1out: [unitOut(0), gU(0)], u2out: [unitOut(1), gU(1)], u1dl: [units[0].deliver, gU(0)], u2dl: [units[1].deliver, gU(1)],
    sal: [busOut, outG], selc: [busOut, outG], load: [out, outG], neu: [neutro, GLOW.azul], pe: [false, 0],
    pSELe: [gen, Y], pSEL: [E.rodeo, Y],
    rodeo: [E.rodeo, Y], salc: [busOut, outG], pCB7: [E.rodeo, Y], pCB7x: [E.rodeo, Y], auxsen: [S.auxSenal, Y],      // bypass de rodeo con el interruptor CB7
  };
  for (const id of Object.keys(lamp)) net[`p${id}`] = [!!lamp[id], Y];
  const conm = S.bypassMode === 'conmutador';
  for (const w of wires) {
    w.group.visible = (w.cb7 ? !conm : (!w.sel || conm)) && (!w.aux || S.auxRodeo);     // el conmutador y su cableado solo en su modo; el CB7 y el suyo, solo en la configuración anterior
    if (w.meshC) w.meshC.visible = w.group.visible;
    const [on, hex] = net[w.net] || [false, 0];
    glow(w.mat, on, hex);
  }
  breakerGroups.AUX.visible = !conm && S.auxRodeo;
  glow(coverMats.RED, S.mains, Y); glow(coverMats.ENT, gen, Y); glow(coverMats.SAL, busOut, outG);
  glow(coverMats.NA, neutro, GLOW.azul); glow(coverMats.NB, neutro, GLOW.azul);
}

