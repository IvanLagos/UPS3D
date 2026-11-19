/* Editor de tablero eléctrico: se eligen cuántos automáticos, borneras, barras, llaves selectoras y pilotos hay,
   se acomodan solos sobre rieles DIN y se conectan con cables haciendo clic de borne a borne. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { M, std } from '../js/core/materials.js';
import { box } from '../js/core/helpers.js';
import { build, sizeOf, COLORES_PILOTO } from './modelos.js';

const $ = s => document.querySelector(s);
const view = $('#view');

/* ---------- catálogo de componentes ---------- */
const USOS = ['Fase', 'Neutro', 'Tierra'];
const TIPOS = {
  breaker: { nombre: 'Automático', pref: 'Q', def: { poles: 1, amp: 'C16', on: true, aux: false },
    campos: [{ k: 'poles', label: 'Polos', opts: [1, 2, 3, 4], fmt: v => `${v}P` }, { k: 'amp', label: 'Calibre', opts: ['C6', 'C10', 'C16', 'C20', 'C25', 'C32', 'C40', 'C50', 'C63'] },
      { k: 'aux', label: 'Contacto auxiliar', opts: [false, true], fmt: v => (v ? 'Sí' : 'No') }] },
  bornera: { nombre: 'Bornera', pref: 'X', def: { tipo: 'Fase' }, campos: [{ k: 'tipo', label: 'Tipo', opts: USOS }] },
  barra: { nombre: 'Barra de distribución', pref: 'B', def: { n: 8, uso: 'Neutro' },
    campos: [{ k: 'n', label: 'Terminales', opts: Array.from({ length: 23 }, (_, i) => i + 2) }, { k: 'uso', label: 'Uso', opts: USOS }] },
  selector: { nombre: 'Llave selectora 1-0-2', pref: 'S', def: { poles: 1, pos: 1 }, campos: [{ k: 'poles', label: 'Polos', opts: [1, 2, 3, 4], fmt: v => `${v}P` }] },
  piloto: { nombre: 'Luz piloto', pref: 'H', def: { color: 'Verde', on: true }, campos: [{ k: 'color', label: 'Color', opts: Object.keys(COLORES_PILOTO) }] },
  medidor: { nombre: 'Medidor domiciliario', pref: 'M', def: {}, campos: [] },
  ups: { nombre: 'Módulo UPS', pref: 'U', def: { bat: 2 }, campos: [{ k: 'bat', label: 'Bancos de baterías', opts: [0, 1, 2] }] },
  lampara: { nombre: 'Luz de carga', pref: 'C', def: {}, campos: [] },
};
const COLORES_CABLE = [
  { n: 'Rojo', c: 0xd62828 }, { n: 'Negro', c: 0x18181a }, { n: 'Azul', c: 0x1f5fd6 }, { n: 'Tierra (verde/amarillo)', c: 'tierra' },
  { n: 'Café', c: 0x7a4a21 }, { n: 'Blanco', c: 0xeeeeee }, { n: 'Gris', c: 0x8b9097 }, { n: 'Naranja', c: 0xf08a24 },
];
const SECCIONES = [1.5, 2.5, 4, 6, 10, 16, 25];
const ANCHOS = [0.5, 0.6, 0.8, 1.0, 1.2, 1.5];
const KEY = 'ups3d-tablero-v1';

/* ---------- escena ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
view.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a3139);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 30);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.zoomToCursor = true; controls.minDistance = 0.12; controls.maxDistance = 6;
let reenvio = false;                                         // zoom controlado: más suave de cerca y con un tope por giro de rueda
renderer.domElement.addEventListener('wheel', e => {
  if (reenvio) return;
  controls.zoomSpeed = THREE.MathUtils.clamp(camera.position.distanceTo(controls.target) / 1.5, 0.15, 0.8);
  if (Math.abs(e.deltaY) > 100) {
    e.stopImmediatePropagation(); e.preventDefault();
    reenvio = true;
    renderer.domElement.dispatchEvent(new WheelEvent('wheel', { deltaY: Math.sign(e.deltaY) * 100, deltaMode: 0, clientX: e.clientX, clientY: e.clientY, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, bubbles: true, cancelable: true }));
    reenvio = false;
  }
}, { capture: true, passive: false });
const sun = new THREE.DirectionalLight(0xffffff, 1.3);
sun.position.set(1.2, 2.5, 3); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -1.2, right: 1.2, top: 1.2, bottom: -1.2, near: 0.5, far: 8 });
sun.shadow.bias = -0.0004;
scene.add(sun, new THREE.HemisphereLight(0xdfe9ff, 0x20262c, 0.5));

const boardG = new THREE.Group(), compsG = new THREE.Group(), wiresG = new THREE.Group(), tiesG = new THREE.Group(), handlesG = new THREE.Group();
scene.add(boardG, compsG, wiresG, tiesG, handlesG);

function resize() {
  const w = view.clientWidth, h = view.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(view);
resize();

/* ---------- estado ---------- */
const cabDef = () => ({ modo: 'peinado', amarras: true, sep: 0.06 });
let st = cargar() || ejemplo();
st.cab = { ...cabDef(), ...st.cab };
st.comps.forEach(c => { if (c.type === 'ups' && c.bat == null) c.bat = 2; });     // tableros guardados antes del respaldo de baterias
let addTipo = 'breaker';
const addOpts = Object.fromEntries(Object.entries(TIPOS).map(([k, t]) => [k, { ...t.def }]));
let addQty = 1;
let colorCable = 0, mmCable = 2.5;
let selComp = null, selWire = null, pending = null, hover = null;
let TERM = {};                  // id|borne → { pos, dir, mesh, name, comp }
let boardInfo = null, plan = null, sim = null;                  // plan: trazado peinado vigente (curvas, amarras y manijas)
const angPalanca = new Map();   // ángulo actual de la palanca de cada automático, para animar el giro entre reconstrucciones
const wireLen = {};

function cargar() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && Array.isArray(s.comps) && Array.isArray(s.wires)) return s;
  } catch (e) { /* sin almacenamiento */ }
  return null;
}
function guardar() { try { localStorage.setItem(KEY, JSON.stringify(st, (k, v) => (k[0] === '_' ? undefined : v))); } catch (e) { /* sin almacenamiento */ } }

function vacio() { return { boardW: 0.8, comps: [], wires: [], nextId: 1, nextWire: 1, cab: cabDef() }; }
/**
 * Tablero de la UPS modular (el del rack), cableado completo:
 * medidor domiciliario → barra RED → CB5 general → barra ENT → CB1/CB3 → UPS 1 y 2 → CB2/CB4 → barra SAL →
 * conmutador bypass 1-0-2 (1 = UPS desde SAL, 2 = red directa desde ENT) → CB6 → carga; neutro, tierra y los 7 pilotos.
 */
function ejemplo() {
  const s = vacio(); s.boardW = 1.5;
  const mk = (type, o, row, x) => { const c = nuevo(s, type, o); c.man = { row, x }; s.comps.push(c); return c; };
  const t = (c, k) => `${c.id}|${k}`;
  const cable = (a, b, color, mm2, ruta) => s.wires.push({ id: s.nextWire++, a, b, color, mm2, ...(ruta ? { ruta } : {}) });
  const ROJO = 0, NEGRO = 1, AZUL = 2, TIERRA = 3, CAFE = 4, NARANJA = 7;

  // fila 0: medidor y barras de distribución
  const med = mk('medidor', { name: 'MEDIDOR' }, 0, 0);
  const red = mk('barra', { name: 'RED', n: 4, uso: 'Fase' }, 0, 0.17);
  const ent = mk('barra', { name: 'ENT', n: 6, uso: 'Fase' }, 0, 0.31);
  const sal = mk('barra', { name: 'SAL', n: 4, uso: 'Fase' }, 0, 0.5);
  const neu = mk('barra', { name: 'N', n: 14, uso: 'Neutro' }, 0, 0.64);
  const tie = mk('barra', { name: 'PE', n: 6, uso: 'Tierra' }, 0, 0.99);
  // fila 1: automáticos, conmutador y pilotos
  const cb5 = mk('breaker', { name: 'CB5 GENERAL', poles: 1, amp: 'C63', aux: true }, 1, 0);
  const cb1 = mk('breaker', { name: 'CB1 ENT UPS1', poles: 1, amp: 'C40', aux: true }, 1, 0.045);
  const cb3 = mk('breaker', { name: 'CB3 ENT UPS2', poles: 1, amp: 'C40', aux: true }, 1, 0.09);
  const sel = mk('selector', { name: 'CONM BYPASS', poles: 2 }, 1, 0.15);
  const cb6 = mk('breaker', { name: 'CB6 SALIDA', poles: 1, amp: 'C63', aux: true }, 1, 0.29);
  const h = [['H CB5', 'Rojo'], ['H CB1', 'Verde'], ['H CB3', 'Verde'], ['H CB2', 'Verde'], ['H CB4', 'Verde'], ['H CB6', 'Rojo'], ['H BYP', 'Rojo']]
    .map(([name, color], k) => mk('piloto', { name, color }, 1, 0.36 + k * 0.055));
  // fila 2: UPS con sus automáticos de salida, y borneras de la carga
  const ups1 = mk('ups', { name: 'UPS 1' }, 2, 0);
  const cb2 = mk('breaker', { name: 'CB2 SAL UPS1', poles: 1, amp: 'C40', aux: true }, 2, 0.23);
  const ups2 = mk('ups', { name: 'UPS 2' }, 2, 0.3);
  const cb4 = mk('breaker', { name: 'CB4 SAL UPS2', poles: 1, amp: 'C40', aux: true }, 2, 0.53);
  const cL = mk('bornera', { name: 'CARGA L', tipo: 'Fase' }, 2, 0.62);
  const cN = mk('bornera', { name: 'CARGA N', tipo: 'Neutro' }, 2, 0.65);
  const cP = mk('bornera', { name: 'CARGA PE', tipo: 'Tierra' }, 2, 0.68);
  const luz = mk('lampara', { name: 'LUZ CARGA' }, 2, 0.74);
  const [hG, hE1, hE2, hS1, hS2, hO, hB] = h;

  // red → general → barra de entradas
  cable(t(med, '2'), t(red, '1'), ROJO, 16);
  cable(t(red, '2'), t(cb5, '1'), ROJO, 16);
  cable(t(cb5, '2'), t(ent, '1'), ROJO, 16);
  // entradas de las UPS
  cable(t(ent, '2'), t(cb1, '1'), ROJO, 10);
  cable(t(ent, '3'), t(cb3, '1'), ROJO, 10);
  cable(t(cb1, '2'), t(ups1, 'ENT-L'), ROJO, 10);
  cable(t(cb3, '2'), t(ups2, 'ENT-L'), ROJO, 10);
  // salidas de las UPS → barra SAL
  cable(t(ups1, 'SAL-L'), t(cb2, '1'), NARANJA, 10);
  cable(t(ups2, 'SAL-L'), t(cb4, '1'), NARANJA, 10);
  cable(t(cb2, '2'), t(sal, '1'), NARANJA, 10);
  cable(t(cb4, '2'), t(sal, '2'), NARANJA, 10);
  // conmutador bypass: 1 = UPS (barra SAL), 2 = red directa (barra ENT), C = hacia la carga
  cable(t(sal, '3'), t(sel, '1/1'), NARANJA, 16);
  cable(t(ent, '4'), t(sel, '1/2'), ROJO, 16);
  cable(t(sel, '1/C'), t(cb6, '1'), NEGRO, 16);
  cable(t(cb6, '2'), t(cL, '1'), NEGRO, 16);
  // la luz de carga cuelga de las borneras de la carga: si se enciende, todo el circuito funciona
  cable(t(cL, '2'), t(luz, 'L'), NEGRO, 2.5);
  cable(t(cN, '2'), t(luz, 'N'), AZUL, 2.5);
  // neutro
  cable(t(med, '4'), t(neu, '1'), AZUL, 16);
  cable(t(neu, '2'), t(ups1, 'ENT-N'), AZUL, 10);
  cable(t(neu, '3'), t(ups1, 'SAL-N'), AZUL, 10);
  cable(t(neu, '4'), t(ups2, 'ENT-N'), AZUL, 10);
  cable(t(neu, '5'), t(ups2, 'SAL-N'), AZUL, 10);
  cable(t(neu, '6'), t(cN, '1'), AZUL, 16);
  // tierra
  cable(t(tie, '1'), t(ups1, 'PE'), TIERRA, 10);
  cable(t(tie, '2'), t(ups2, 'PE'), TIERRA, 10);
  cable(t(tie, '3'), t(cP, '1'), TIERRA, 10);
  // pilotos: cada uno entre la salida de su automático y el neutro; el del bypass, por el 2.º polo del conmutador
  // el piloto se alimenta por el contacto auxiliar de su automático (13 entra desde el borne 1; 14 va al piloto): solo se enciende si el automático está cerrado
  [[hG, cb5], [hE1, cb1], [hE2, cb3], [hS1, cb2], [hS2, cb4], [hO, cb6]].forEach(([p, cb]) => {
    cable(t(cb, '13'), t(cb, '1'), CAFE, 1.5, { modo: 'directo' });
    cable(t(p, 'X1'), t(cb, '14'), CAFE, 1.5);
  });
  cable(t(ent, '5'), t(sel, '2/2'), CAFE, 1.5);
  cable(t(sel, '2/C'), t(hB, 'X1'), CAFE, 1.5);
  h.forEach((p, k) => cable(t(p, 'X2'), t(neu, `${7 + k}`), AZUL, 1.5));
  return s;
}
/** Crea un componente con el siguiente número y nombre libre (Q1, Q2, X1…). */
function nuevo(s, type, o = {}) {
  const t = TIPOS[type], re = new RegExp(`^${t.pref}(\\d+)$`);
  const max = Math.max(0, ...s.comps.filter(c => c.type === type).map(c => (re.exec(c.name) || [0, 0])[1] | 0));
  return { id: s.nextId++, type, name: `${t.pref}${max + 1}`, ...t.def, ...o };
}

/* ---------- distribución sobre rieles ---------- */
const PITCH = 0.30, MARGEN = 0.05, HUECO = 0.012, ZRIEL = 0.007;

function distribuir() {
  const W = st.boardW, disp = W - 2 * MARGEN;
  const fijos = st.comps.filter(c => c.man);                           // piezas colocadas a mano (Ctrl+clic → Ajustar)
  const filas = [[]]; let cur = 0;
  for (const c of st.comps) {
    if (c.man) continue;
    const { w } = sizeOf(c);
    if (cur > 0 && cur + w > disp) { filas.push([]); cur = 0; }
    filas[filas.length - 1].push({ c, w, x: cur }); cur += w + HUECO;
  }
  const nR = Math.max(filas.length, ...fijos.map(c => c.man.row + 1));
  const H = nR * PITCH + 0.08, base = 0.15;
  const railY = i => base + H - 0.04 - PITCH / 2 - i * PITCH;
  const placed = [];
  filas.forEach((f, i) => { for (const it of f) placed.push({ c: it.c, x: -W / 2 + MARGEN + it.x + it.w / 2, y: railY(i), row: i }); });
  for (const c of fijos) placed.push({ c, x: -W / 2 + MARGEN + c.man.x + sizeOf(c).w / 2, y: railY(c.man.row), row: c.man.row });
  return { placed, W, H, yc: base + H / 2, filas: nR, rails: Array.from({ length: nR }, (_, i) => railY(i)) };
}

function limpiar(g) {
  for (const o of [...g.children]) {
    g.remove(o);
    o.traverse(m => {
      if (m.geometry && !m.userData.shared) m.geometry.dispose();
      const mat = m.material; if (mat && mat.map && mat.map.isCanvasTexture) mat.map.dispose();
    });
  }
}

/* ---------- reconstrucción de la escena ---------- */
function reconstruir({ encuadrar = false } = {}) {
  const lay = distribuir();
  boardInfo = lay;
  sim = simular();
  for (const c of st.comps) c._lit = sim.enc.has(c.id);              // piloto o luz encendidos según la simulación
  limpiar(boardG); limpiar(compsG); limpiar(wiresG); limpiar(tiesG); limpiar(handlesG);

  // placa de montaje, marco y rieles DIN
  const { W, H, yc } = lay;
  box(W, H, 0.004, std(0xdc9a45, 0.35, 0.5), 0, yc, -0.002, boardG);
  for (const [w, h, x, y] of [[W + 0.04, 0.02, 0, yc + H / 2 + 0.01], [W + 0.04, 0.02, 0, yc - H / 2 - 0.01], [0.02, H, -W / 2 - 0.01, yc], [0.02, H, W / 2 + 0.01, yc]])
    box(w, h, 0.03, M.frame, x, y, 0.011, boardG);
  for (const y of lay.rails) {
    box(W - 0.04, 0.035, 0.007, M.rail, 0, y, 0.0035, boardG);
    box(W - 0.05, 0.01, 0.0075, M.dark, 0, y, 0.00375, boardG);
  }

  // componentes y sus bornes
  TERM = {};
  for (const { c, x, y, row } of lay.placed) {
    const g = build(c, angPalanca.get(c.id));
    g.position.set(x, y, ZRIEL); compsG.add(g); g.updateMatrixWorld(true);
    for (const t of g.userData.terms) {
      t.mesh.userData.base = t.mesh.material;
      TERM[`${c.id}|${t.key}`] = { pos: g.localToWorld(t.pos.clone()), dir: t.dir, mesh: t.mesh, name: `${c.name}:${t.label}`, comp: c, row, tipo: t.tipo };
    }
  }

  // cables: se descartan los que apuntan a bornes que ya no existen
  const antes = st.wires.length;
  st.wires = st.wires.filter(w => TERM[w.a] && TERM[w.b]);
  if (st.wires.length < antes) toast(`Se quitaron ${antes - st.wires.length} cable(s) cuyo borne ya no existe`);
  plan = st.cab.modo === 'peinado' ? planPeinado() : null;
  st.wires.forEach((w, i) => wiresG.add(crearCable(w, i, plan && plan.curvas.get(w.id))));
  if (plan && st.cab.amarras) plan.lazos.forEach(l => tiesG.add(l));

  if (pending && !TERM[pending]) pending = null;
  if (selComp && !st.comps.some(c => c.id === selComp)) selComp = null;
  if (selWire && !st.wires.some(w => w.id === selWire)) selWire = null;
  pintar();
  dibujarSeleccion();
  interfaz();
  guardar();
  if (encuadrar) encuadre();
}

function stripeTex() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 8;
  const g = c.getContext('2d'); g.fillStyle = '#f2c200'; g.fillRect(0, 0, 32, 8); g.fillStyle = '#1e9a3e'; g.fillRect(32, 0, 32, 8);
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
const TEX_TIERRA = stripeTex();

/* Terminales de los cables: punta tubular aislada (virola) o terminal de ojo bajo el tornillo (barras). El color de la
   punta tubular sigue la sección del cable (norma DIN 46228). */
const LF = { virola: 0.018, ojal: 0.03 };
const COLOR_VIROLA = { 1.5: 0x1a1a1a, 2.5: 0x1f5fd6, 4: 0x8b9097, 6: 0xf2c200, 10: 0xd62828, 16: 0x1f5fd6, 25: 0x1a1a1a };
/** Punto donde empieza el cable propiamente tal: al final de la punta tubular / del terminal. */
const inicio = t => t.pos.clone().addScaledVector(t.dir, LF[t.tipo]);

function trayecto(a, b, lane) {
  const zL = 0.10 + (lane % 8) * 0.006;
  const salir = t => {
    const p = inicio(t), q = p.clone().addScaledVector(t.dir, 0.022);
    const r = q.clone(); r.z = Math.max(zL, q.z);
    return [p, q, r];
  };
  const A = salir(a), B = salir(b);
  // recorrido en escuadra: sale del borne, baja/sube hasta un canal horizontal propio de este cable y llega al destino
  const yc = (A[2].y + B[2].y) / 2 + ((lane % 6) - 2.5) * 0.007;
  const zc = zL - 0.001 * (lane % 6);
  return [...A, new THREE.Vector3(A[2].x, yc, zc), new THREE.Vector3(B[2].x, yc, zc), ...B.reverse()];
}

function crearCable(w, lane, curvaPeinada) {
  const curva = curvaPeinada || new THREE.CatmullRomCurve3(trayecto(TERM[w.a], TERM[w.b], lane), false, 'centripetal');
  wireLen[w.id] = curva.getLength();
  const col = COLORES_CABLE[w.color];
  const r = 0.0014 + 0.00035 * Math.sqrt(w.mm2);
  const mat = col.c === 'tierra' ? new THREE.MeshStandardMaterial({ map: TEX_TIERRA.clone(), roughness: 0.55 }) : std(col.c, 0.1, 0.55);
  if (col.c === 'tierra') { mat.map.needsUpdate = true; mat.map.repeat.set(curva.getLength() / 0.03, 1); }
  const m = new THREE.Mesh(new THREE.TubeGeometry(curva, Math.min(600, Math.max(56, Math.round(curva.getLength() / 0.004))), r, 8, false), mat);
  m.castShadow = true; m.userData.tubo = true;
  const g = new THREE.Group(); g.userData.wire = w.id; g.add(m);
  g.userData.emi = sim && sim.L.has(w.a) && sim.L.has(w.b) ? 0x3d2400 : sim && sim.N.has(w.a) && sim.N.has(w.b) ? 0x0a2a55 : 0;   // brilla donde hay tensión
  for (const t of [TERM[w.a], TERM[w.b]]) g.add(terminalCable(t, w, r));
  return g;
}

/** Extremo del cable en un borne: virola aislada, o terminal de ojo (aro bajo el tornillo + lengüeta + manguito). */
function terminalCable(t, w, r) {
  const g = new THREE.Group(), col = COLOR_VIROLA[w.mm2] ?? 0xf2c200, mat = std(col, 0.1, 0.5), rr = r + 0.0008;
  const orient = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), t.dir);
  const cil = (len, desde, m) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, len, 12), m);
    c.quaternion.copy(orient); c.position.copy(t.pos).addScaledVector(t.dir, desde + len / 2); c.castShadow = true; return c;
  };
  if (t.tipo === 'ojal') {
    const metal = std(0xcfd3d8, 0.9, 0.3, { side: THREE.DoubleSide });
    const aro = new THREE.Mesh(new THREE.RingGeometry(0.0035, 0.0088, 24), metal); aro.position.copy(t.pos); aro.position.z += 0.0004; g.add(aro);
    const lengueta = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.012, 0.0012), metal);
    lengueta.position.copy(t.pos).addScaledVector(t.dir, 0.011); lengueta.position.z += 0.0004; g.add(lengueta);
    g.add(cil(0.016, 0.014, mat));
  } else g.add(cil(LF.virola, 0, mat));
  return g;
}

/** Marca los bornes (origen pendiente / bajo el mouse) y el cable elegido. */
/* ---------- trazado peinado ---------- */
/** Polilínea con las esquinas redondeadas (radio r), apta para TubeGeometry. */
function curvaRedondeada(pts, r = 0.008) {
  const q = pts.filter((p, i) => i === 0 || p.distanceTo(pts[i - 1]) > 1e-6);
  const path = new THREE.CurvePath();
  let prev = q[0].clone();
  for (let i = 1; i < q.length - 1; i++) {
    const a = q[i - 1], p = q[i], b = q[i + 1], da = a.distanceTo(p), db = b.distanceTo(p);
    const rr = Math.min(r, da * 0.45, db * 0.45);
    const p1 = p.clone().lerp(a, rr / da), p2 = p.clone().lerp(b, rr / db);
    if (prev.distanceTo(p1) > 1e-6) path.add(new THREE.LineCurve3(prev.clone(), p1));
    path.add(new THREE.QuadraticBezierCurve3(p1, p.clone(), p2));
    prev = p2;
  }
  path.add(new THREE.LineCurve3(prev, q[q.length - 1].clone()));
  return path;
}

const matAmarra = std(0x16171a, 0.2, 0.6);
/** Amarra: un lazo elíptico (en el plano `plano`) alrededor del haz de cables, con su cabeza. */
function amarra(c, ea, eb, plano) {
  const pts = [];
  for (let i = 0; i < 20; i++) {
    const t = (i / 20) * Math.PI * 2, u = Math.cos(t) * ea, v = Math.sin(t) * eb;
    pts.push(plano === 'x' ? new THREE.Vector3(c.x, c.y + u, c.z + v) : new THREE.Vector3(c.x + u, c.y, c.z + v));   // 'x': el haz va a lo largo de X; si no, a lo largo de Y
  }
  const g = new THREE.Group();
  const lazo = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 32, 0.0013, 6, true), matAmarra);
  lazo.castShadow = true; g.add(lazo);
  const cabeza = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.006, 0.006), matAmarra);
  cabeza.position.copy(pts[0]); cabeza.castShadow = true; g.add(cabeza);
  return g;
}

/**
 * Cables peinados: todos corren por canales horizontales libres (entre rieles) y, si cambian de canal, por una
 * troncal vertical junto al borde del tablero. En cada canal y troncal los cables van en paralelo y ordenados
 * (cada uno en su pista) y se amarran a intervalos regulares. Cada cable usa su propia profundidad para no cruzarse.
 */
function planPeinado() {
  const { W, rails } = boardInfo, PT = 0.0042;
  const chY = c => (c === 0 ? rails[0] + (0.13 + PITCH / 2) / 2 : rails[c - 1] - (PITCH - 0.02) / 2);   // canal c: franja libre encima del riel c
  /** Columna vertical libre (sin piezas en las filas que cruza) más cercana al punto medio entre los dos bornes. */
  const columnaLibre = (ca, cb, xa, xb) => {
    const filas = []; for (let r = Math.min(ca, cb); r < Math.max(ca, cb); r++) filas.push(r);
    const ocupado = boardInfo.placed.filter(q => filas.includes(q.row)).map(q => { const w = Math.max(sizeOf(q.c).w, 0.02); return [q.x - w / 2 - 0.014, q.x + w / 2 + 0.014]; }).sort((u, v) => u[0] - v[0]);
    const lo = -W / 2 + 0.02, hi = W / 2 - 0.02, libres = []; let cur = lo;
    for (const [u, v] of ocupado) { if (u > cur) libres.push([cur, u]); cur = Math.max(cur, v); }
    if (cur < hi) libres.push([cur, hi]);
    let mejor = null, dmin = Infinity;
    for (const [u, v] of libres) {
      if (v - u < 0.04) continue;
      const c = Math.round(Math.max(u + 0.02, Math.min(v - 0.02, (xa + xb) / 2)) / 0.02) * 0.02, d = Math.abs(xa - c) + Math.abs(xb - c);
      if (c >= u + 0.015 && c <= v - 0.015 && d < dmin) { dmin = d; mejor = c; }
    }
    return mejor ?? (Math.abs(xa - xT[0]) + Math.abs(xb - xT[0]) <= Math.abs(xa - xT[1]) + Math.abs(xb - xT[1]) ? xT[0] : xT[1]);
  };
  const xT = [-W / 2 + 0.022, W / 2 - 0.022];
  const canalDe = (t, o) => (t.dir.y > 0 ? t.row : t.dir.y < 0 ? t.row + 1 : (o.row < t.row ? t.row : t.row + 1));
  const info = st.wires.map((w, rank) => {
    const ru = w.ruta || {}, nC = rails.length;                       // ajustes de ruta de este cable (ver editor de ruta)
    const a = TERM[w.a], b = TERM[w.b];
    const ca = Math.min(nC, ru.ca ?? canalDe(a, b)), cb = Math.min(nC, ru.cb ?? canalDe(b, a));
    let tr = null, tx = 0, tk = '';
    if (ca !== cb) {
      if (ru.tr != null) { tr = ru.tr; tx = xT[tr]; tk = `t${tr}`; }                       // troncal fijada: borde izquierdo o derecho
      else { tx = columnaLibre(ca, cb, a.pos.x, b.pos.x); tr = tx; tk = `x${Math.round(tx * 1000)}`; }   // troncal por la columna libre más cercana
    }
    return { w, a, b, ca, cb, tr, tx, tk, directo: ru.modo === 'directo', dy: (ru.dy || 0) / 100, z: w.prof ?? 0.100 + (rank % 8) * PT, r: 0.0014 + 0.00035 * Math.sqrt(w.mm2) };
  });
  // pistas: cada cable ocupa un lugar fijo dentro de cada canal / troncal que usa
  const usan = {};
  const poner = (k, i) => (usan[k] = usan[k] || []).push(i);
  const fija = it => it.w.ruta || {};                                // tramos que el usuario movió a mano no ocupan pista
  info.forEach((it, i) => {
    if (it.directo || (it.w.via && it.w.via.length)) return;
    const ru = fija(it);
    if (ru.ya == null) poner(`c${it.ca}`, i);
    if (it.cb !== it.ca && ru.yb == null) poner(`c${it.cb}`, i);
    if (it.tr !== null && ru.xt == null) poner(it.tk, i);
  });
  const pista = (k, i) => (usan[k].indexOf(i) - (usan[k].length - 1) / 2) * PT;

  const curvas = new Map(), horiz = {}, vert = {}, manijas = new Map(), semillas = new Map(), polis = new Map(), zs = new Map();
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  info.forEach((it, i) => {
    const { a, b, z } = it;
    // cada extremo: sale del terminal en vertical, sigue recto y pasa a su profundidad (3 puntos)
    const salir = t => { const p = inicio(t); return [p, V(p.x, p.y + t.dir.y * 0.02, p.z), V(p.x, p.y + t.dir.y * 0.034, z)]; };
    if (it.w.via && it.w.via.length) {                               // ruta manual: pasa por los puntos que puso el usuario, en escuadra
      const A = salir(a), B = salir(b), pts = [...A];
      let ult = A[2], vertPrimero = true;
      for (const q of [...it.w.via.map(v => V(v.x, v.y, z)), B[2]]) {
        if (ult.x === q.x || ult.y === q.y) vertPrimero = ult.y === q.y;           // tramo recto: el siguiente gira
        else { pts.push(vertPrimero ? V(ult.x, q.y, z) : V(q.x, ult.y, z)); vertPrimero = !vertPrimero; }
        pts.push(q); ult = q;
      }
      pts.push(B[1], B[0]);
      manijas.set(it.w.id, it.w.via.map((v, k) => ({ key: `v${k}`, x: v.x, y: v.y, z })));
      curvas.set(it.w.id, curvaRedondeada(pts)); polis.set(it.w.id, pts.map(q => ({ x: q.x, y: q.y }))); zs.set(it.w.id, z);
      return;
    }
    if (it.directo) {                                                 // puente corto: sin canal, pasa justo por encima de los bornes
      const A = salir(a), B = salir(b), ay = A[2].y, by = B[2].y;
      const ru = it.w.ruta || {};
      const ym = ru.ym ?? (a.dir.y > 0 && b.dir.y > 0 ? Math.max(ay, by) + 0.012 : a.dir.y < 0 && b.dir.y < 0 ? Math.min(ay, by) - 0.012 : (ay + by) / 2) + it.dy;
      manijas.set(it.w.id, [{ key: 'd', x: (a.pos.x + b.pos.x) / 2, y: ym, z }]);
      semillas.set(it.w.id, [{ x: a.pos.x, y: ym }, { x: b.pos.x, y: ym }]);
      const pd = [...A, V(a.pos.x, ym, z), V(b.pos.x, ym, z), ...B.reverse()];
      curvas.set(it.w.id, curvaRedondeada(pd)); polis.set(it.w.id, pd.map(q => ({ x: q.x, y: q.y }))); zs.set(it.w.id, z);
      return;
    }
    const ru = it.w.ruta || {};
    const ya = ru.ya ?? chY(it.ca) + pista(`c${it.ca}`, i) + it.dy;
    const yb = it.tr === null ? ya : (ru.yb ?? chY(it.cb) + pista(`c${it.cb}`, i) + it.dy);
    const pts = [...salir(a), V(a.pos.x, ya, z)];
    let xa = b.pos.x;
    if (it.tr !== null) {
      xa = ru.xt ?? it.tx + pista(it.tk, i);
      pts.push(V(xa, ya, z), V(xa, yb, z));
      manijas.set(it.w.id, [{ key: 'a', x: xa, y: ya, z }, { key: 'b', x: xa, y: yb, z }]);
      semillas.set(it.w.id, [{ x: a.pos.x, y: ya }, { x: xa, y: ya }, { x: xa, y: yb }, { x: b.pos.x, y: yb }]);
    } else {
      manijas.set(it.w.id, [{ key: 'm', x: (a.pos.x + b.pos.x) / 2, y: ya, z }]);
      semillas.set(it.w.id, [{ x: a.pos.x, y: ya }, { x: b.pos.x, y: ya }]);
    }
    pts.push(V(b.pos.x, yb, z), ...salir(b).reverse());
    curvas.set(it.w.id, curvaRedondeada(pts)); polis.set(it.w.id, pts.map(q => ({ x: q.x, y: q.y }))); zs.set(it.w.id, z);
    const m = { i, z, r: it.r };
    (horiz[`c${it.ca}`] = horiz[`c${it.ca}`] || []).push({ ...m, y: ya, x0: Math.min(a.pos.x, xa), x1: Math.max(a.pos.x, xa) });
    if (it.tr !== null) {
      (horiz[`c${it.cb}`] = horiz[`c${it.cb}`] || []).push({ ...m, y: yb, x0: Math.min(xa, b.pos.x), x1: Math.max(xa, b.pos.x) });
      (vert[it.tk] = vert[it.tk] || []).push({ ...m, x: xa, y0: Math.min(ya, yb), y1: Math.max(ya, yb) });
    }
  });

  // amarras: en una cuadrícula regular, donde al menos dos cables corren juntos (lejos de las esquinas)
  const lazos = [], sep = st.cab.sep, M2 = 0.014;
  const rango = (v, f) => [Math.min(...v.map(f)), Math.max(...v.map(f))];
  // grupos de cables realmente cercanos (encadenados a menos de DMAX entre centros): cada grupo lleva su propia amarra
  const DMAX = 0.011;
  const grupos = (cov, u) => {
    const gs = [];
    for (const m of cov) {
      const cerca = gs.filter(g => g.some(o => Math.hypot(u(o) - u(m), o.z - m.z) <= DMAX));
      const nuevo = [m, ...cerca.flat()];
      cerca.forEach(g => gs.splice(gs.indexOf(g), 1)); gs.push(nuevo);
    }
    return gs.filter(g => g.length >= 2);
  };
  for (const mem of Object.values(horiz)) {
    const lo = Math.min(...mem.map(m => m.x0)), hi = Math.max(...mem.map(m => m.x1));
    for (let x = Math.ceil(lo / sep) * sep; x <= hi; x += sep) {
      const cov = mem.filter(m => m.x0 + M2 < x && x < m.x1 - M2);
      for (const g of grupos(cov, m => m.y)) {
        const [y0, y1] = rango(g, m => m.y), [z0, z1] = rango(g, m => m.z), rm = Math.max(...g.map(m => m.r));
        lazos.push(amarra(V(x, (y0 + y1) / 2, (z0 + z1) / 2), (y1 - y0) / 2 + rm + 0.0016, (z1 - z0) / 2 + rm + 0.0016, 'x'));
      }
    }
  }
  for (const mem of Object.values(vert)) {
    const lo = Math.min(...mem.map(m => m.y0)), hi = Math.max(...mem.map(m => m.y1));
    for (let y = Math.ceil(lo / sep) * sep; y <= hi; y += sep) {
      const cov = mem.filter(m => m.y0 + M2 < y && y < m.y1 - M2);
      for (const g of grupos(cov, m => m.x)) {
        const [x0, x1] = rango(g, m => m.x), [z0, z1] = rango(g, m => m.z), rm = Math.max(...g.map(m => m.r));
        lazos.push(amarra(V((x0 + x1) / 2, y, (z0 + z1) / 2), (x1 - x0) / 2 + rm + 0.0016, (z1 - z0) / 2 + rm + 0.0016, 'y'));
      }
    }
  }
  return { curvas, lazos, manijas, semillas, polis, zs };
}

const mPend = new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00bcd4, emissiveIntensity: 1.2 });
const mHov = new THREE.MeshStandardMaterial({ color: 0xffe14d, emissive: 0xffc400, emissiveIntensity: 1 });
function pintar() {
  for (const [id, t] of Object.entries(TERM)) t.mesh.material = id === pending ? mPend : id === hover ? mHov : t.mesh.userData.base;
  wiresG.children.forEach(g => g.traverse(m => { if (m.userData.tubo) m.material.emissive = new THREE.Color(g.userData.wire === selWire ? 0x6a5a10 : g.userData.emi || 0); }));
}

let selHelper = null;
const matManija = new THREE.MeshBasicMaterial({ color: 0xffa21a, depthTest: false, transparent: true });
const geoManija = new THREE.SphereGeometry(0.0075, 14, 10);
function dibujarSeleccion() {
  limpiar(handlesG);                                              // puntos naranjas para arrastrar el cable seleccionado
  const mj = null;                                                  // ya no se dibujan puntos: el cable se toma desde cualquier parte
  for (const m of mj || []) {
    const h = new THREE.Mesh(geoManija, matManija); h.position.set(m.x, m.y, m.z); h.renderOrder = 999;
    h.userData = { shared: true, mj: { id: selWire, key: m.key, z: m.z } }; handlesG.add(h);
  }
  if (selHelper) { scene.remove(selHelper); selHelper.dispose?.(); selHelper = null; }
  const g = compsG.children.find(o => o.userData.cid === selComp);
  if (g) { selHelper = new THREE.BoxHelper(g, 0xffb020); scene.add(selHelper); }
}

/* ---------- cámara ---------- */
function encuadre() {
  const { W, H, yc } = boardInfo, fov = THREE.MathUtils.degToRad(camera.fov);
  const dist = Math.max((H / 2 + 0.05) / Math.tan(fov / 2), (W / 2 + 0.05) / (Math.tan(fov / 2) * camera.aspect)) * 1.1 + 0.08;
  controls.target.set(0, yc, 0.05);
  camera.position.set(0, yc, 0.05 + dist);
  controls.update();
}

/* ---------- interacción con el mouse ---------- */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function elegir(ev) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects([compsG, wiresG], true);
  if (!hits.length) return null;
  const t = hits.find(h => h.object.userData.term && h.distance <= hits[0].distance + 0.03);   // un borne cercano gana sobre el cable que sale de él
  if (t) return { term: t.object.userData.term };
  let o = hits[0].object;
  while (o && o.userData.cid === undefined && o.userData.wire === undefined) o = o.parent;
  if (!o) return null;
  return o.userData.wire !== undefined ? { wire: o.userData.wire, punto: hits[0].point } : { comp: o.userData.cid };
}

const tip = $('#tip');
function nombreCable(w) { return `${TERM[w.a].name} → ${TERM[w.b].name}`; }
function texto(h) {
  if (!h) return '';
  if (h.term) {
    const t = TERM[h.term], n = st.wires.filter(w => w.a === h.term || w.b === h.term).length;
    return `${t.name} · ${TIPOS[t.comp.type].nombre}${n ? ` · ${n} cable(s)` : ''}`;
  }
  if (h.wire !== undefined) { const w = st.wires.find(x => x.id === h.wire); return `Cable ${nombreCable(w)} · ${COLORES_CABLE[w.color].n} ${w.mm2} mm² · ${wireLen[w.id].toFixed(2)} m`; }
  const c = st.comps.find(x => x.id === h.comp);
  return `${TIPOS[c.type].nombre} ${c.name}${c.type === 'breaker' ? ' · clic: ' + (c.on ? 'apagar' : 'encender') : c.type === 'selector' ? ' · clic: girar la llave' : ''}`;
}

let down = null;
renderer.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, b: e.button }; });
/* Ctrl + arrastrar: mueve una pieza con el mouse (se pega a la cuadrícula de 5 mm y a las piezas vecinas; Mayús = sin imán). */
const plano = new THREE.Plane(new THREE.Vector3(0, 0, 1), -ZRIEL), pto = new THREE.Vector3();
let arr = null;                                              // { id, dx: desfase del agarre, ini, mov, raf }
function puntoPlano(ev) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  return ray.ray.intersectPlane(plano, pto) ? pto : null;
}
view.addEventListener('pointerdown', e => {
  if (e.button !== 0 || !e.ctrlKey || e.target !== renderer.domElement) return;
  const h = elegir(e), p = puntoPlano(e);
  if (!h || h.comp === undefined || !p) return;
  const it = boardInfo.placed.find(q => q.c.id === h.comp);
  controls.enabled = false;                                  // que el mouse no gire la vista mientras se mueve la pieza
  arr = { id: h.comp, dx: p.x - it.x, ini: { x: e.clientX, y: e.clientY }, mov: false, key: '' };
  window.addEventListener('pointermove', moverPieza); window.addEventListener('pointerup', soltarPieza);
}, true);

/* Arrastrar un cable desde cualquier punto: se toma la sección (tramo recto) que está bajo el mouse y se desplaza
   en perpendicular; sus esquinas siguen. Al soltar, el cable queda en modo manual con esa forma. */
let sgm = null;
const distSeg = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};
view.addEventListener('pointerdown', e => {
  if (e.button !== 0 || e.ctrlKey || e.target !== renderer.domElement || !plan) return;
  const h = elegir(e);
  if (!h || h.wire === undefined) return;
  if (e.altKey) {                                                // Alt + arrastrar: mueve el cable en profundidad (arriba = se aleja del tablero)
    sgm = { id: h.wire, modo: 'z', z0: plan.zs.get(h.wire), ini: { x: e.clientX, y: e.clientY }, mov: false, raf: 0, k: '' };
    controls.enabled = false;
    window.addEventListener('pointermove', moverSeccion); window.addEventListener('pointerup', soltarSeccion);
    return;
  }
  const base = plan.polis.get(h.wire); if (!base) return;
  let mejor = -1, dmin = Infinity;
  for (let i = 2; i < base.length - 3; i++) {                     // sin los tramos pegados a los terminales
    const a = base[i], b = base[i + 1];
    if (Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6) continue;
    const d = distSeg(h.punto, a, b); if (d < dmin) { dmin = d; mejor = i; }
  }
  if (mejor < 0) return;
  const a = base[mejor], b = base[mejor + 1];
  const o = Math.abs(a.y - b.y) < 1e-6 ? 'h' : Math.abs(a.x - b.x) < 1e-6 ? 'v' : null;
  if (!o) return;
  sgm = { id: h.wire, base, i: mejor, o, z: plan.zs.get(h.wire), ini: { x: e.clientX, y: e.clientY }, mov: false, raf: 0, k: '' };
  controls.enabled = false;
  window.addEventListener('pointermove', moverSeccion); window.addEventListener('pointerup', soltarSeccion);
}, true);

/** Nuevos puntos de paso al desplazar el tramo i de `base` a la coordenada c (y si es horizontal, x si es vertical). */
function viaDeSeccion(base, i, o, c) {
  const n = base.length, R = [];
  const mov = p => (o === 'h' ? { x: p.x, y: c } : { x: c, y: p.y });
  const puente = p => (o === 'h' ? { x: p.x, y: c } : { x: c, y: p.y });     // enlace desde un extremo fijo (salida del borne)
  base.forEach((p, k) => {
    if (k === i) { if (i === 2) { R.push({ ...p }, puente(p)); } else R.push(mov(p)); }
    else if (k === i + 1) { if (i + 1 === n - 3) { R.push(puente(p), { ...p }); } else R.push(mov(p)); }
    else R.push({ ...p });
  });
  const via = [];
  for (const p of R.slice(3, R.length - 3)) {
    const q = { x: +p.x.toFixed(4), y: +p.y.toFixed(4) }, u = via[via.length - 1] || { x: +R[2].x.toFixed(4), y: +R[2].y.toFixed(4) };
    if (q.x !== u.x || q.y !== u.y) via.push(q);
  }
  return via;
}

function moverSeccion(e) {
  if (!sgm) return;
  if (!sgm.mov && Math.hypot(e.clientX - sgm.ini.x, e.clientY - sgm.ini.y) < 5) return;
  const w = st.wires.find(q => q.id === sgm.id); if (!w) return;
  if (!sgm.mov) { sgm.mov = true; selWire = sgm.id; selComp = null; tip.style.display = 'none'; }
  if (sgm.modo === 'z') {
    const z = Math.max(0.012, Math.min(0.22, Math.round((sgm.z0 - (e.clientY - sgm.ini.y) * 0.0006) / 0.0005) * 0.0005));
    $('#paso').style.display = 'block'; $('#paso').textContent = `Profundidad del cable: ${(z * 100).toFixed(1)} cm desde el tablero`;
    renderer.domElement.style.cursor = 'ns-resize';
    if (z === sgm.k) return;
    sgm.k = z; w.prof = z;
    if (!sgm.raf) sgm.raf = requestAnimationFrame(() => { sgm.raf = 0; reconstruir(); });
    return;
  }
  const pl = new THREE.Plane(new THREE.Vector3(0, 0, 1), -sgm.z), p = new THREE.Vector3();
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  if (!ray.ray.intersectPlane(pl, p)) return;
  const sn = v => (e.shiftKey ? v : Math.round(v / 0.0025) * 0.0025);
  const { W, H, yc } = boardInfo;
  const c = sgm.o === 'h' ? Math.max(yc - H / 2 + 0.01, Math.min(yc + H / 2 - 0.01, sn(p.y))) : Math.max(-W / 2 + 0.01, Math.min(W / 2 - 0.01, sn(p.x)));
  renderer.domElement.style.cursor = 'grabbing';
  if (c === sgm.k) return;
  sgm.k = c;
  const via = viaDeSeccion(sgm.base, sgm.i, sgm.o, c);
  if (via.length) w.via = via; else delete w.via;
  if (!sgm.raf) sgm.raf = requestAnimationFrame(() => { sgm.raf = 0; reconstruir(); });
}
function soltarSeccion() {
  window.removeEventListener('pointermove', moverSeccion); window.removeEventListener('pointerup', soltarSeccion);
  controls.enabled = true; renderer.domElement.style.cursor = '';
  if (sgm && sgm.raf) cancelAnimationFrame(sgm.raf);
  if (sgm && sgm.mov) reconstruir();
  if (sgm && sgm.modo === 'z') mostrarPaso();
  sgm = null;
}

let hdr = null;                                              // arrastre de un punto de cable: { id, key, z, raf, k }
view.addEventListener('pointerdown', e => {
  if (e.button !== 0 || e.ctrlKey || e.target !== renderer.domElement || selWire === null || !handlesG.children.length) return;
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(handlesG.children, false)[0];
  if (!hit) return;
  const mj = hit.object.userData.mj;
  if (e.altKey && mj.key[0] === 'v') {                           // Alt+clic: quita el punto de paso
    const w = st.wires.find(q => q.id === mj.id);
    w.via.splice(+mj.key.slice(1), 1); if (!w.via.length) delete w.via;
    e.stopPropagation(); reconstruir(); return;
  }
  hdr = { ...mj, raf: 0, k: '', mov: false };
  controls.enabled = false;
  window.addEventListener('pointermove', moverPunto); window.addEventListener('pointerup', soltarPunto);
}, true);
function moverPunto(e) {
  if (!hdr) return;
  hdr.mov = true;
  const pl = new THREE.Plane(new THREE.Vector3(0, 0, 1), -hdr.z), p = new THREE.Vector3();
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  if (!ray.ray.intersectPlane(pl, p)) return;
  const w = st.wires.find(q => q.id === hdr.id); if (!w) return;
  const sn = v => (e.shiftKey ? v : Math.round(v / 0.0025) * 0.0025);
  const { W, H, yc } = boardInfo;
  const x = Math.max(-W / 2 + 0.01, Math.min(W / 2 - 0.01, sn(p.x))), y = Math.max(yc - H / 2 + 0.01, Math.min(yc + H / 2 - 0.01, sn(p.y)));
  if (hdr.key[0] === 'v') {                                    // punto de paso: libre en X e Y
    w.via[+hdr.key.slice(1)] = { x, y };
    renderer.domElement.style.cursor = 'grabbing';
    const kv = `${x}|${y}`; if (kv === hdr.k) return;
    hdr.k = kv; if (!hdr.raf) hdr.raf = requestAnimationFrame(() => { hdr.raf = 0; reconstruir(); });
    return;
  }
  const ru = w.ruta = w.ruta || {};
  if (hdr.key === 'a') { ru.xt = x; ru.ya = y; } else if (hdr.key === 'b') { ru.xt = x; ru.yb = y; }
  else if (hdr.key === 'm') ru.ya = y; else ru.ym = y;
  renderer.domElement.style.cursor = 'grabbing';
  const k = `${x}|${y}`; if (k === hdr.k) return;
  hdr.k = k;
  if (!hdr.raf) hdr.raf = requestAnimationFrame(() => { hdr.raf = 0; reconstruir(); });
}
function soltarPunto() {
  window.removeEventListener('pointermove', moverPunto); window.removeEventListener('pointerup', soltarPunto);
  controls.enabled = true; renderer.domElement.style.cursor = '';
  if (hdr && hdr.raf) cancelAnimationFrame(hdr.raf);
  if (hdr && hdr.mov) reconstruir();
  hdr = null;
}

function moverPieza(e) {
  if (!arr) return;
  if (!arr.mov && Math.hypot(e.clientX - arr.ini.x, e.clientY - arr.ini.y) < 5) return;
  if (!arr.mov) { arr.mov = true; selComp = arr.id; tip.style.display = 'none'; renderer.domElement.style.cursor = 'grabbing'; }
  const p = puntoPlano(e), c = st.comps.find(x => x.id === arr.id);
  if (!p || !c) return;
  const w = sizeOf(c).w, { W, rails } = boardInfo;
  const row = Math.max(0, Math.min(boardInfo.filas, Math.round((rails[0] - p.y) / PITCH)));
  let x = p.x - arr.dx - w / 2 + W / 2 - MARGEN;               // borde izquierdo medido desde el margen
  if (!e.shiftKey) {
    let mejor = Math.round(x / 0.005) * 0.005;                 // cuadrícula de 5 mm
    for (const o of boardInfo.placed) {                        // imán a los bordes de las piezas vecinas del mismo riel
      if (o.c.id === c.id || o.row !== row) continue;
      const ow = sizeOf(o.c).w, oL = o.x - ow / 2 + W / 2 - MARGEN;
      for (const cand of [oL + ow + HUECO, oL - HUECO - w]) if (Math.abs(cand - x) < 0.012) mejor = cand;
    }
    x = mejor;
  }
  x = Math.max(0, Math.min(W - 2 * MARGEN - w, +x.toFixed(4)));
  const key = `${row}|${x}`;
  $('#paso').style.display = 'block';
  $('#paso').textContent = `Moviendo ${c.name} · riel ${row + 1} · ${(x * 100).toFixed(1)} cm (Mayús: sin imán)`;
  if (key === arr.key) return;
  arr.key = key; c.man = { row, x };
  if (!arr.raf) arr.raf = requestAnimationFrame(() => { arr.raf = 0; reconstruir(); });
}

function soltarPieza() {
  window.removeEventListener('pointermove', moverPieza); window.removeEventListener('pointerup', soltarPieza);
  controls.enabled = true; renderer.domElement.style.cursor = '';
  if (arr && arr.mov) { if (arr.raf) cancelAnimationFrame(arr.raf); reconstruir(); mostrarPaso(); }
  arr = null;
}

renderer.domElement.addEventListener('pointerup', e => {
  if ((arr && arr.mov) || hdr || (sgm && sgm.mov)) { down = null; return; }                // fue un arrastre de pieza, no un clic
  if (!down || down.b !== 0 || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) { down = null; return; }
  down = null; clic(elegir(e), e);
});
renderer.domElement.addEventListener('pointermove', e => {
  if (e.buttons) { tip.style.display = 'none'; return; }
  const h = elegir(e), id = h && h.term ? h.term : null;
  const txt = texto(h);
  tip.style.display = txt ? 'block' : 'none'; tip.textContent = txt; tip.style.left = `${e.clientX + 14}px`; tip.style.top = `${e.clientY + 14}px`;
  renderer.domElement.style.cursor = h ? 'pointer' : '';
  if (id !== hover) { hover = id; pintar(); }
});
renderer.domElement.addEventListener('pointerleave', () => { tip.style.display = 'none'; if (hover) { hover = null; pintar(); } });

function clic(h, ev) {
  if (ev && ev.ctrlKey && h && h.comp !== undefined) { cancelarPendiente(); selComp = h.comp; selWire = null; pintar(); dibujarSeleccion(); abrirAjuste(h.comp, ev); interfaz(); return; }
  cerrarAjuste();
  if (h && h.term) { conectar(h.term); return; }
  cancelarPendiente();
  if (h && h.wire !== undefined) { selWire = h.wire; selComp = null; }
  else if (h && h.comp !== undefined) {
    selComp = h.comp; selWire = null;
    const c = st.comps.find(x => x.id === h.comp);
    if (c.type === 'breaker') c.on = !c.on;
    else if (c.type === 'selector') {                              // 1 → 0 → 2 → 0 → 1…: desde el 0 se va al lado opuesto del que se venía
      if (c.pos === 0) c.pos = c.ant === 1 ? 2 : 1;
      else { c.ant = c.pos; c.pos = 0; }
    }
    reconstruir(); return;
  } else { selComp = selWire = null; }
  pintar(); dibujarSeleccion(); interfaz();
}

function conectar(id) {
  if (!pending) { pending = id; selWire = null; mostrarPaso(); pintar(); return; }
  if (pending === id) { cancelarPendiente(); pintar(); return; }
  const a = pending, b = id;
  if (st.wires.some(w => (w.a === a && w.b === b) || (w.a === b && w.b === a))) { toast('Esos dos bornes ya están unidos'); cancelarPendiente(); pintar(); return; }
  pending = null; mostrarPaso();
  const w = { id: st.nextWire++, a, b, color: colorCable, mm2: mmCable };
  st.wires.push(w); selWire = w.id;
  reconstruir();
}
function cancelarPendiente() { pending = null; mostrarPaso(); }
function mostrarPaso() {
  const p = $('#paso');
  p.style.display = pending ? 'block' : 'none';
  p.textContent = pending ? `Origen: ${TERM[pending].name} · haga clic en el borne de destino (Esc cancela)` : '';
}

addEventListener('keydown', e => {
  if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
  if (e.key === 'Escape') { cerrarAjuste(); cancelarPendiente(); selComp = selWire = null; pintar(); dibujarSeleccion(); interfaz(); }
  if ((e.key === 'Delete' || e.key === 'Backspace') && selWire !== null) { st.wires = st.wires.filter(w => w.id !== selWire); selWire = null; reconstruir(); }
});

/* ---------- avisos ---------- */
let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3200);
}

/* ---------- panel ---------- */
const fmtOpt = (campo, v) => (campo.fmt ? campo.fmt(v) : String(v));
const selectHtml = (campo, valor, extra) =>
  `<select ${extra}>${campo.opts.map((o, i) => `<option value="${i}"${o === valor ? ' selected' : ''}>${fmtOpt(campo, o)}</option>`).join('')}</select>`;

function interfaz() {
  // tipos y campos del formulario de alta
  $('#addTipos').innerHTML = Object.entries(TIPOS).map(([k, t]) => `<button data-tipo="${k}" class="${k === addTipo ? 'on' : ''}">${t.nombre}</button>`).join('');
  $('#addCampos').innerHTML = TIPOS[addTipo].campos.map(c => `<label>${c.label}${selectHtml(c, addOpts[addTipo][c.k], `data-add="${c.k}"`)}</label>`).join('')
    + `<label>Cantidad<input type="number" id="addQty" min="1" max="50" value="${addQty}"></label>`;

  // ancho y datos del tablero
  $('#selW').innerHTML = ANCHOS.map(w => `<option value="${w}"${w === st.boardW ? ' selected' : ''}>${(w * 100).toFixed(0)} cm</option>`).join('');
  $('#infoBoard').textContent = `${boardInfo.filas} riel(es) DIN · alto ${(boardInfo.H * 100).toFixed(0)} cm`;

  // componentes
  $('#nComps').textContent = `(${st.comps.length})`;
  $('#listComps').innerHTML = st.comps.map((c, i) => {
    const t = TIPOS[c.type];
    return `<li data-id="${c.id}" class="${c.id === selComp ? 'sel' : ''}"><span class="n">${i + 1}</span>`
      + `<input type="text" value="${c.name}" data-name="${c.id}" maxlength="14" title="${t.nombre}">`
      + t.campos.map(f => selectHtml(f, c[f.k], `data-k="${f.k}" data-id="${c.id}" title="${f.label}"`)).join('')
      + `<span class="grow"></span><button data-act="up" title="Mover antes">◀</button><button data-act="down" title="Mover después">▶</button><button data-act="del" title="Quitar">✕</button></li>`;
  }).join('') || '<li><span class="grow">No hay componentes. Agregue alguno arriba.</span></li>';

  // cables
  $('#wireColors').innerHTML = COLORES_CABLE.map((c, i) => `<button data-color="${i}" title="${c.n}" class="${i === colorCable ? 'on' : ''}" style="background:${c.c === 'tierra' ? 'linear-gradient(90deg,#f2c200 50%,#1e9a3e 50%)' : '#' + c.c.toString(16).padStart(6, '0')}"></button>`).join('');
  $('#selMm').innerHTML = SECCIONES.map(s => `<option${s === mmCable ? ' selected' : ''}>${s}</option>`).join('');
  $('#selModo').value = st.cab.modo; $('#chkAmarras').checked = st.cab.amarras;
  $('#selSep').innerHTML = [0.04, 0.06, 0.08, 0.12].map(v => `<option value="${v}"${v === st.cab.sep ? ' selected' : ''}>${v * 100} cm</option>`).join('');
  $('#chkAmarras').disabled = $('#selSep').disabled = st.cab.modo !== 'peinado';
  $('#listWires').innerHTML = st.wires.map(w => {
    const c = COLORES_CABLE[w.color];
    return `<li data-wid="${w.id}" class="${w.id === selWire ? 'sel' : ''}"><span class="dot" style="background:${c.c === 'tierra' ? 'linear-gradient(90deg,#f2c200 50%,#1e9a3e 50%)' : '#' + c.c.toString(16).padStart(6, '0')}"></span>`
      + `<span class="grow">${nombreCable(w)}</span><span class="n">${w.mm2} mm²</span><button data-act="delw" title="Quitar el cable">✕</button></li>`;
  }).join('') || '<li><span class="grow">Sin cables.</span></li>';

  rutaUI();
  ajusteUI();
  estadoUI();
  $('#bom').textContent = materiales();
}

/* ---------- simulación eléctrica ---------- */
/**
 * Sigue la corriente desde el medidor: la fase sale del borne 1 y el neutro del 3. Los conductores son los cables, las
 * barras (todos sus terminales unidos), los automáticos cerrados, el conmutador según su posición, las borneras y las
 * UPS (que pasan la fase y el neutro de entrada a la salida cuando tienen ambos). Un piloto o la luz de carga se encienden
 * cuando su fase llega por un lado y su neutro por el otro; si fase y neutro se tocan, hay cortocircuito.
 */
function simular() {
  const ady = new Map(), k = (c, t) => `${c.id}|${t}`;
  const une = (a, b) => { (ady.get(a) || ady.set(a, []).get(a)).push(b); (ady.get(b) || ady.set(b, []).get(b)).push(a); };
  st.wires.forEach(w => une(w.a, w.b));
  let med = null; const ups = [];
  for (const c of st.comps) {
    if (c.type === 'breaker') { if (c.on) { for (let i = 0; i < c.poles; i++) une(k(c, 2 * i + 1), k(c, 2 * i + 2)); if (c.aux) une(k(c, '13'), k(c, '14')); } }
    else if (c.type === 'bornera') une(k(c, '1'), k(c, '2'));
    else if (c.type === 'barra') for (let i = 2; i <= c.n; i++) une(k(c, '1'), k(c, i));
    else if (c.type === 'selector') {
      for (let p = 1; p <= c.poles; p++) { const pre = c.poles > 1 ? `${p}/` : ''; if (c.pos === 1) une(k(c, `${pre}1`), k(c, `${pre}C`)); if (c.pos === 2) une(k(c, `${pre}2`), k(c, `${pre}C`)); }
    } else if (c.type === 'medidor') { med = c; une(k(c, '1'), k(c, '2')); une(k(c, '3'), k(c, '4')); }
    else if (c.type === 'ups') ups.push(c);
  }
  const alcance = ini => { const vis = new Set(ini), q = [...ini]; while (q.length) { const n = q.pop(); for (const m of ady.get(n) || []) if (!vis.has(m)) { vis.add(m); q.push(m); } } return vis; };   // ini: lista de bornes fuente
  let L = new Set(), N = new Set(); const activas = new Set(), bateria = new Set();
  if (med) {
    // fuentes de fase y neutro: el medidor y, si una UPS pierde su entrada pero tiene bancos de baterías, el inversor de esa UPS
    const srcL = [k(med, '1')], srcN = [k(med, '3')];
    for (let it = 0; it < 6; it++) {
      L = alcance(srcL); N = alcance(srcN);
      let cambio = false;
      for (const u of ups) {
        const entrada = L.has(k(u, 'ENT-L')) && N.has(k(u, 'ENT-N'));
        if (entrada && !activas.has(u.id)) {                         // con entrada: la UPS pasa la red a la salida
          activas.add(u.id); une(k(u, 'ENT-L'), k(u, 'SAL-L')); une(k(u, 'ENT-N'), k(u, 'SAL-N')); cambio = true;
        } else if (!entrada && !activas.has(u.id) && !bateria.has(u.id) && (u.bat ?? 2) > 0) {   // sin entrada: respalda con baterías
          bateria.add(u.id); srcL.push(k(u, 'SAL-L')); srcN.push(k(u, 'SAL-N')); cambio = true;
        }
      }
      if (!cambio) break;
    }
  }
  const enc = new Set(), lamparas = [];
  for (const c of st.comps) {
    if (c.type === 'piloto' && L.has(k(c, 'X1')) && N.has(k(c, 'X2'))) enc.add(c.id);
    if (c.type === 'lampara') { lamparas.push(c); if (L.has(k(c, 'L')) && N.has(k(c, 'N'))) enc.add(c.id); }
  }
  return { L, N, enc, lamparas, med, activas, bateria, corto: [...L].some(n => N.has(n)) };
}

/** Mensaje de estado sobre la vista: ¿está llegando energía a la carga? */
function estadoUI() {
  const el = $('#estado'); if (!sim) return;
  const sel = st.comps.find(c => c.type === 'selector');
  let txt, cls = '';
  if (!sim.med) { txt = 'Falta el medidor domiciliario: sin red no hay tensión'; cls = 'mal'; }
  else if (sim.corto) { txt = '⚠ Cortocircuito: fase y neutro quedaron unidos'; cls = 'mal'; }
  else if (!sim.lamparas.length) txt = 'Agregue una luz de carga para comprobar que el circuito funciona';
  else if (sim.lamparas.every(c => sim.enc.has(c.id))) {
    const nom = set => st.comps.filter(c => set.has(c.id)).map(c => c.name).join(' y ');
    const via = sel && sel.pos === 2 ? 'la red directa (bypass de rodeo)'
      : sim.bateria.size ? `${sim.activas.size ? `las UPS (${nom(sim.activas)}) y ` : ''}el respaldo de baterías de ${nom(sim.bateria)}`
        : sel ? `las UPS (${nom(sim.activas) || 'ninguna'})` : 'el circuito';
    txt = `✔ Todo funciona: la carga está encendida, alimentada por ${via}`; cls = 'ok';
  } else {
    const c = sim.lamparas.find(x => !sim.enc.has(x.id)), id = n => `${c.id}|${n}`;
    txt = `○ La luz de carga está apagada · fase ${sim.L.has(id('L')) ? 'llega' : 'NO llega'} · neutro ${sim.N.has(id('N')) ? 'llega' : 'NO llega'}`; cls = 'mal';
  }
  el.textContent = txt; el.className = cls;
}

/* ---------- ajuste de una pieza (Ctrl+clic) ---------- */
let ajuste = null;                                          // { id, x, y }: pieza abierta y posición de la ventana
function abrirAjuste(id, ev) { const r = view.getBoundingClientRect(); ajuste = { id, x: ev.clientX - r.left, y: ev.clientY - r.top }; }
function cerrarAjuste() { ajuste = null; ajusteUI(); }
/** Posición actual de una pieza: riel (0 = el de arriba) y borde izquierdo (m) medido desde el margen del tablero. */
function posActual(c) {
  const it = boardInfo.placed.find(p => p.c.id === c.id);
  return { row: it.row, x: Math.max(0, +(it.x - sizeOf(c).w / 2 + boardInfo.W / 2 - MARGEN).toFixed(3)) };
}
function ajusteUI() {
  const box = $('#ajuste'), c = ajuste && st.comps.find(x => x.id === ajuste.id);
  if (!c) { ajuste = null; box.hidden = true; box.innerHTML = ''; return; }
  const t = TIPOS[c.type], pos = c.man || posActual(c), R = boardInfo.filas;
  box.hidden = false;
  box.innerHTML = `<h3>Ajustar ${c.name} · ${t.nombre}</h3><div class="campos">`
    + `<label>Nombre<input type="text" data-aj="name" value="${c.name}" maxlength="14"></label>`
    + t.campos.map(f => `<label>${f.label}${selectHtml(f, c[f.k], `data-aj="${f.k}"`)}</label>`).join('')
    + `<label>Riel<select data-aj="row">${Array.from({ length: R + 1 }, (_, i) => `<option value="${i}"${i === pos.row ? ' selected' : ''}>${i + 1}${i === 0 ? ' (arriba)' : ''}</option>`).join('')}</select></label>`
    + `<label>Posición (cm)<input type="number" data-aj="x" min="0" max="${(boardInfo.W * 100).toFixed(0)}" step="0.5" value="${(pos.x * 100).toFixed(1)}"></label></div>`
    + `<div class="row" style="margin-top:8px"><button class="sm" data-aj-act="auto"${c.man ? '' : ' disabled'}>Posición automática</button>`
    + `<button class="sm" data-aj-act="del">Quitar pieza</button><button class="sm" data-aj-act="close">Cerrar</button></div>`;
  const r = view.getBoundingClientRect(), bw = 270, bh = box.offsetHeight || 260;
  box.style.left = `${Math.max(8, Math.min(r.width - bw - 8, ajuste.x + 12))}px`;
  box.style.top = `${Math.max(8, Math.min(r.height - bh - 8, ajuste.y + 12))}px`;
}
$('#ajuste').addEventListener('change', e => {
  const t = e.target, k = t.dataset.aj, c = ajuste && st.comps.find(x => x.id === ajuste.id);
  if (!k || !c) return;
  if (k === 'name') c.name = t.value.trim() || c.name;
  else if (k === 'row') c.man = { ...(c.man || posActual(c)), row: +t.value };
  else if (k === 'x') c.man = { ...(c.man || posActual(c)), x: Math.max(0, (+t.value || 0) / 100) };
  else { const f = TIPOS[c.type].campos.find(q => q.k === k); c[k] = f.opts[+t.value]; }
  reconstruir();
});
$('#ajuste').addEventListener('click', e => {
  const b = e.target.closest('button'), c = ajuste && st.comps.find(x => x.id === ajuste.id);
  if (!b || !c) return;
  if (b.dataset.ajAct === 'close') cerrarAjuste();
  else if (b.dataset.ajAct === 'auto') { delete c.man; reconstruir(); }
  else if (b.dataset.ajAct === 'del') {
    st.comps = st.comps.filter(x => x.id !== c.id);
    st.wires = st.wires.filter(w => !w.a.startsWith(`${c.id}|`) && !w.b.startsWith(`${c.id}|`));
    ajuste = null; reconstruir();
  }
});

/** Editor de ruta del cable seleccionado: puente corto o por canal, canal de salida y llegada, troncal y altura. */
function rutaUI() {
  const box = $('#rutaEd'), w = st.wires.find(x => x.id === selWire);
  if (!w || st.cab.modo !== 'peinado') { box.hidden = true; box.innerHTML = ''; return; }
  const ru = w.ruta || {}, R = boardInfo.filas, manual = !!(w.via && w.via.length);
  const nombreCanal = c => (c === 0 ? 'Sobre el riel 1' : c === R ? `Bajo el riel ${R}` : `Entre rieles ${c} y ${c + 1}`);
  const opt = (v, t, sel) => `<option value="${v}"${sel ? ' selected' : ''}>${t}</option>`;
  const canales = (k) => opt('auto', 'Automático', ru[k] == null) + Array.from({ length: R + 1 }, (_, c) => opt(c, nombreCanal(c), ru[k] === c)).join('');
  box.hidden = false;
  box.innerHTML = `<h3>Ruta de ${nombreCable(w)}</h3><div class="campos">`
    + `<label>Tipo<select data-ruta="modo">${opt('auto', 'Por canales (automático)', !manual && ru.modo !== 'directo')}${opt('directo', 'Puente corto (directo)', !manual && ru.modo === 'directo')}${opt('manual', 'Manual (puntos de paso)', manual)}</select></label>`
    + (manual ? '' : ru.modo === 'directo' ? '' :
      `<label>Canal en el origen<select data-ruta="ca">${canales('ca')}</select></label>`
      + `<label>Canal en el destino<select data-ruta="cb">${canales('cb')}</select></label>`
      + `<label>Troncal vertical<select data-ruta="tr">${opt('auto', 'Automática', ru.tr == null)}${opt(0, 'Izquierda', ru.tr === 0)}${opt(1, 'Derecha', ru.tr === 1)}</select></label>`)
    + `<label>Profundidad (cm)<input type="number" data-ruta="prof" min="1.2" max="22" step="0.5" placeholder="auto ${((plan && plan.zs.get(w.id)) * 100 || 10).toFixed(1)}" value="${w.prof != null ? (w.prof * 100).toFixed(1) : ''}"></label>`
    + (manual ? '' : `<label>Altura (cm)<input type="number" data-ruta="dy" min="-6" max="6" step="0.5" value="${ru.dy || 0}"></label>`) + `</div>`
    + `<div class="row"><button class="sm" data-ruta-reset="1">Restablecer ruta</button></div>`
    + `<p class="note">Tome el cable con el mouse desde la sección que quiera y arrástrelo: esa sección se desplaza y las esquinas la siguen (Mayús: sin ajuste a la cuadrícula). Alt + arrastrar lo mueve en profundidad. Altura: sube o baja el recorrido horizontal de este cable. «Puente corto» lo une casi directo, sin ir a un canal.</p>`;
}

function materiales() {
  const cuenta = (arr, f) => arr.reduce((m, x) => (m[f(x)] = (m[f(x)] || 0) + 1, m), {});
  const L = [];
  const sec = (titulo, m) => { const e = Object.entries(m); if (e.length) { L.push(titulo); e.forEach(([k, n]) => L.push(`  ${String(n).padStart(3)} × ${k}`)); } };
  const de = t => st.comps.filter(c => c.type === t);
  sec('Automáticos', cuenta(de('breaker'), c => `${c.poles}P ${c.amp}${c.aux ? ' + contacto aux.' : ''}`));
  sec('Borneras', cuenta(de('bornera'), c => c.tipo));
  sec('Barras de distribución', cuenta(de('barra'), c => `${c.n} terminales · ${c.uso}`));
  sec('Llaves selectoras 1-0-2', cuenta(de('selector'), c => `${c.poles} polo(s)`));
  sec('Luces piloto', cuenta(de('piloto'), c => c.color));
  sec('Medidores domiciliarios', cuenta(de('medidor'), () => 'monofásico'));
  sec('Módulos UPS', cuenta(de('ups'), () => '10 kVA'));
  sec('Rieles DIN', { [`de ${(st.boardW * 100 - 4).toFixed(0)} cm`]: boardInfo.filas });
  sec('Cables', cuenta(st.wires, w => `${COLORES_CABLE[w.color].n} ${w.mm2} mm²`));
  const largo = st.wires.reduce((a, w) => a + (wireLen[w.id] || 0), 0);
  if (st.wires.length) L.push(`  Largo total aprox.: ${largo.toFixed(1)} m (sin holgura)`);
  return L.join('\n') || 'Sin componentes.';
}

/* ---------- eventos del panel ---------- */
const panel = $('#panel');
panel.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const li = b.closest('li');
  if (b.dataset.tipo) { addTipo = b.dataset.tipo; interfaz(); return; }
  if (b.dataset.color) { colorCable = +b.dataset.color; interfaz(); return; }
  if (b.id === 'btnAdd') { agregar(); return; }
  if (b.dataset.rutaReset) { const w = st.wires.find(x => x.id === selWire); if (w) { delete w.via; delete w.prof; if (w.ruta) for (const k of ['ya', 'yb', 'xt', 'ym', 'dy']) delete w.ruta[k]; reconstruir(); } return; }
  if (b.dataset.viaAdd) {                                       // nuevo punto en el medio del tramo más largo
    const w = st.wires.find(x => x.id === selWire); if (!w || !w.via) return;
    const pts = [{ x: TERM[w.a].pos.x, y: TERM[w.a].pos.y }, ...w.via, { x: TERM[w.b].pos.x, y: TERM[w.b].pos.y }];
    let mejor = 0, largo = -1;
    for (let i = 0; i < pts.length - 1; i++) { const d = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y); if (d > largo) { largo = d; mejor = i; } }
    w.via.splice(mejor, 0, { x: +((pts[mejor].x + pts[mejor + 1].x) / 2).toFixed(4), y: +((pts[mejor].y + pts[mejor + 1].y) / 2).toFixed(4) });
    reconstruir(); return;
  }
  if (b.id === 'btnFit') return;
  if (b.id === 'btnClearWires') { if (st.wires.length && confirm('¿Borrar todo el cableado?')) { st.wires = []; selWire = null; reconstruir(); } return; }
  if (b.id === 'btnExample') { if (!st.comps.length || confirm('Se reemplazará el tablero actual por el ejemplo. ¿Continuar?')) { st = ejemplo(); selComp = selWire = pending = null; reconstruir({ encuadrar: true }); } return; }
  if (b.id === 'btnEmpty') { if (confirm('¿Vaciar el tablero (componentes y cables)?')) { st = { ...vacio(), boardW: st.boardW }; selComp = selWire = pending = null; mostrarPaso(); reconstruir({ encuadrar: true }); } return; }
  if (b.id === 'btnExport') { exportar(); return; }
  if (b.id === 'btnImport') { $('#fileImport').click(); return; }
  if (!li) return;
  if (li.dataset.wid) {                                   // fila de cable
    const id = +li.dataset.wid;
    if (b.dataset.act === 'delw') { st.wires = st.wires.filter(w => w.id !== id); if (selWire === id) selWire = null; reconstruir(); }
    return;
  }
  const id = +li.dataset.id, i = st.comps.findIndex(c => c.id === id);
  if (b.dataset.act === 'del') {
    st.comps.splice(i, 1);
    st.wires = st.wires.filter(w => !w.a.startsWith(`${id}|`) && !w.b.startsWith(`${id}|`));
    reconstruir();
  } else if (b.dataset.act === 'up' && i > 0) { [st.comps[i - 1], st.comps[i]] = [st.comps[i], st.comps[i - 1]]; reconstruir(); }
  else if (b.dataset.act === 'down' && i < st.comps.length - 1) { [st.comps[i + 1], st.comps[i]] = [st.comps[i], st.comps[i + 1]]; reconstruir(); }
});
$('#btnFit').addEventListener('click', encuadre);

panel.addEventListener('click', e => {                     // seleccionar la fila de un componente
  const li = e.target.closest('#listComps li'); if (!li || !li.dataset.id || e.target.closest('button,select,input')) return;
  selComp = +li.dataset.id; selWire = null; pintar(); dibujarSeleccion(); interfaz();
});
panel.addEventListener('click', e => {                     // seleccionar la fila de un cable
  const li = e.target.closest('#listWires li'); if (!li || !li.dataset.wid || e.target.closest('button')) return;
  selWire = +li.dataset.wid; selComp = null; pintar(); dibujarSeleccion(); interfaz();
});

panel.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'selW') { st.boardW = +t.value; reconstruir({ encuadrar: true }); return; }
  if (t.id === 'selMm') { mmCable = +t.value; return; }
  if (t.dataset.ruta) {
    const w = st.wires.find(x => x.id === selWire); if (!w) return;
    const k = t.dataset.ruta, ru = w.ruta = w.ruta || {};
    if (k === 'prof') { if (t.value === '') delete w.prof; else w.prof = Math.max(0.012, Math.min(0.22, +t.value / 100)); }
    else if (k === 'dy') ru.dy = Math.max(-6, Math.min(6, +t.value || 0));
    else if (k === 'modo') {
      if (t.value === 'manual') {                                 // parte de los puntos del trazado actual
        const sem = plan && plan.semillas.get(w.id);
        w.via = (sem || []).map(v => ({ x: +v.x.toFixed(4), y: +v.y.toFixed(4) }));
        if (!w.via.length) delete w.via;
      } else { delete w.via; ru.modo = t.value; }
    }
    else ru[k] = t.value === 'auto' ? null : +t.value;
    reconstruir(); return;
  }
  if (t.id === 'selModo') { st.cab.modo = t.value; reconstruir(); return; }
  if (t.id === 'chkAmarras') { st.cab.amarras = t.checked; reconstruir(); return; }
  if (t.id === 'selSep') { st.cab.sep = +t.value; reconstruir(); return; }
  if (t.id === 'addQty') { addQty = Math.max(1, Math.min(50, +t.value || 1)); t.value = addQty; return; }
  if (t.dataset.add) { const f = TIPOS[addTipo].campos.find(c => c.k === t.dataset.add); addOpts[addTipo][f.k] = f.opts[+t.value]; return; }
  if (t.dataset.name) {
    const c = st.comps.find(x => x.id === +t.dataset.name);
    c.name = t.value.trim() || c.name; reconstruir(); return;
  }
  if (t.dataset.k) {
    const c = st.comps.find(x => x.id === +t.dataset.id), f = TIPOS[c.type].campos.find(q => q.k === t.dataset.k);
    c[f.k] = f.opts[+t.value]; reconstruir();
  }
});

function agregar() {
  const t = TIPOS[addTipo], antes = st.comps.length;
  for (let i = 0; i < addQty; i++) st.comps.push(nuevo(st, addTipo, { ...addOpts[addTipo] }));
  selComp = st.comps[st.comps.length - 1].id; selWire = null;
  reconstruir({ encuadrar: true });
  toast(`${st.comps.length - antes} × ${t.nombre} agregado(s)`);
}

function exportar() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(st, (k, v) => (k[0] === '_' ? undefined : v), 2)], { type: 'application/json' }));
  a.download = 'tablero.json'; a.click(); URL.revokeObjectURL(a.href);
}
$('#fileImport').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try {
    const s = JSON.parse(await f.text());
    if (!Array.isArray(s.comps) || !Array.isArray(s.wires)) throw new Error('formato');
    st = { ...vacio(), ...s }; st.cab = { ...cabDef(), ...st.cab }; selComp = selWire = pending = null; mostrarPaso(); reconstruir({ encuadrar: true });
    toast('Tablero importado');
  } catch (err) { toast('El archivo no es un tablero válido'); }
});

/* ---------- arranque ---------- */
reconstruir({ encuadrar: true });
renderer.setAnimationLoop(() => {
  controls.update();
  for (const g of compsG.children) {                       // gira la palanca hacia su posición
    const p = g.userData.pivote; if (!p) continue;
    p.rotation.x += (g.userData.ang - p.rotation.x) * 0.25;
    if (Math.abs(g.userData.ang - p.rotation.x) < 0.002) p.rotation.x = g.userData.ang;
    angPalanca.set(g.userData.cid, p.rotation.x);
  }
  if (selHelper) selHelper.update();
  renderer.render(scene, camera);
});
window.__tablero = {                                                   // para depurar desde la consola
  get st() { return st; }, TERM: () => TERM,
  reconstruir,
  puntoCable(id, i) {                                                  // pantalla: medio del tramo i del cable id
    const b = plan.polis.get(id), z = plan.zs.get(id), v = new THREE.Vector3((b[i].x + b[i + 1].x) / 2, (b[i].y + b[i + 1].y) / 2, z).project(camera), r = renderer.domElement.getBoundingClientRect();
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height, n: b.length };
  },
  manija(i = 0) {                                                      // posición en pantalla de una manija del cable elegido
    const m = handlesG.children[i]; if (!m) return null;
    const v = m.position.clone().project(camera), r = renderer.domElement.getBoundingClientRect();
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
  },
  pantalla(nombre) {                                                   // posición en pantalla (px) de un borne, p. ej. 'Q1:1'
    const t = Object.values(TERM).find(x => x.name === nombre); if (!t) return null;
    const v = t.pos.clone().project(camera), r = renderer.domElement.getBoundingClientRect();
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
  },
};
