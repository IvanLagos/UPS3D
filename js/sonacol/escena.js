/* Modelo 3D de los circuitos nuevos de SONACOL. Cada circuito tiene el mismo rack que el circuito 3 (estructura, laterales, puerta frontal,
   puerta trasera y techo), su riel DIN con los automáticos CB0…CB4 (manipulables), los equipos, el medidor y los cables de potencia por el suelo.
   El cableado interior del rack no se modela. */
import * as THREE from 'three';
import { scene, POZO } from '../core/scene.js';
import { toast } from '../core/interaction.js';
import { M, std } from '../core/materials.js';
import { box, labelPlane, textTex } from '../core/helpers.js';
import { markClick } from '../core/interaction.js';
import { tween } from '../core/tween.js';
import { buildShell, makeSides } from '../model/rack.js';
import { makeDoor, OPEN_ANGLE } from '../model/doors.js';
import { sinEsferas, SC as ESCALA, MOD, LEVER_ANGLE } from '../model/breakerPanel.js';
import { makeCover, moveCover, COVER_W, COVER_Z, FACE_Z, T as TAPA_T } from '../model/boardCover.js';
import { build as buildPieza, P as POLO } from '../../tablero/modelos.js';
import { pantalla, dibujarCarga } from '../core/pantallaCarga.js';
import { SC, MODO_TXT, autonomia } from './logica.js';

export const g1 = new THREE.Group(), g2 = new THREE.Group();
g1.visible = g2.visible = false;
scene.add(g1, g2);

/** La interfaz asigna aquí lo que pasa al hacer clic en un automático del 3D: (circuito, índice) */
export const cb = { toggle: () => {}, modo: () => {} };   // modo(circuito, UPS, bypass?): orden INV / BYP de una UPS

const COL = { amber: 0xe0a800, green: 0x1fa85f, blue: 0x2f6fe0 };
const colorModo = m => (m === 'bateria' ? COL.blue : m === 'bypass' ? COL.amber : COL.green);
const OSCURO = 0x303030;

/* ---------- piezas ---------- */
const etiqueta = (parent, txt, w, h, x, y, z) => {
  const l = labelPlane(txt, w, h, { w: Math.round(w * 2000), h: Math.round(h * 2000), size: Math.round(h * 1240), color: '#d5dae0' });
  l.position.set(x, y, z); parent.add(l); return l;
};
const ledNuevo = () => std(0x222222, 0.2, 0.4, { emissive: 0x000000 });
const setLed = (mat, hex) => { mat.emissive.setHex(hex); mat.color.setHex(hex || 0x222222); };


/** Rack completo del circuito: estructura, laterales, puertas y techo. Devuelve sus partes móviles y los ventiladores. */
function rackCompleto(g, n, placa) {
  buildShell(g);
  const pica = scene.children.find(o => o.userData && typeof o.userData.tip === 'string' && o.userData.tip.startsWith('Pica'));   // la pica y el pozo del circuito 3 (puesta a tierra de servicio)
  if (pica) {                                                                                  // clonar falla con los datos de clic (referencias circulares): se apartan un momento
    const guardados = []; pica.traverse(o => { guardados.push([o, o.userData]); o.userData = {}; });
    const c = pica.clone(true);
    guardados.forEach(([o, u]) => { o.userData = u; });
    c.userData.tip = pica.userData.tip; g.add(c); markClick(c, () => {});
  }
  const fans = [];
  const lados = makeSides(g);
  const st = { front: false, rear: false, sides: true, cover: false };
  const puertas = {};
  for (const lado of ['front', 'rear']) puertas[lado] = makeDoor(lado, g, { fans, placa, onClick: () => setPuerta(n, lado, !st[lado]) });
  return { fans, lados, st, puertas };
}

export function setPuerta(n, lado, abierta) {
  const r = RACKS[n]; r.st[lado] = abierta;
  if (lado === 'front' && !abierta && r.st.cover) setTapas(n, false);          // las cubiertas se cierran antes de cerrar la puerta frontal
  tween(r.puertas[lado].rotation, 'y', abierta ? OPEN_ANGLE : 0, 0.9);
}
/** Abre o cierra las dos cubiertas del tablero (solo con la puerta frontal abierta). */
export function setTapas(n, abierta) {
  const r = RACKS[n];
  if (abierta && !r.st.front) { toast('Abra la puerta frontal para abrir las cubiertas del tablero.'); return; }
  r.st.cover = abierta; r.tapas.forEach(c => moveCover(c, abierta));
}
function clicTapa(n, c) {
  const r = RACKS[n], abrir = !c.userData.open;
  if (abrir && !r.st.front) { toast('Abra la puerta frontal para abrir la cubierta.'); return; }
  moveCover(c, abrir); r.st.cover = r.tapas.every(t => t.userData.open);
}
export function setLaterales(n, cerrado) {
  const r = RACKS[n]; r.st.sides = cerrado;
  r.lados.forEach((s, i) => {
    const x = (i ? 1 : -1) * 0.308;
    if (cerrado) s.visible = true;
    tween(s.position, 'x', cerrado ? x : x * 5.2, 0.9).then(() => { if (!r.st.sides) s.visible = false; });
  });
}
export const estadoRack = n => RACKS[n].st;
/** Gira los ventiladores de las puertas del circuito `n`. */
export function girar(n, dt, vel) { for (const f of RACKS[n].fans) f.rotation.z -= vel * dt; }

const btnGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.012, 16).rotateX(Math.PI / 2);

/** Módulo UPS: pantalla, luz de estado y botones INV (inversor) y BYP (bypass estático) de esta UPS, que no está comunicada con la otra. */
function ups(g, y, titulo, n, i) {
  const m = new THREE.Group(); m.position.y = y; g.add(m);
  box(0.5, 0.15, 0.62, M.module, 0, 0, 0, m);
  box(0.5, 0.15, 0.02, M.face, 0, 0, 0.32, m);
  const scr = pantalla(m, 0.3, 0.1, -0.06, 0.012, 0.332);
  etiqueta(m, titulo, 0.22, 0.03, -0.06, -0.058, 0.332);
  box(0.04, 0.012, 0.012, M.blue, 0.19, -0.066, 0.335, m);                      // pestillo azul
  const led = ledNuevo(); box(0.016, 0.016, 0.008, led, 0.17, 0.055, 0.335, m);
  const btn = (x, color, txt, tip, bypass) => {
    const bg = new THREE.Group(), mat = std(color, 0.3, 0.4, { emissive: color, emissiveIntensity: 0.15 });
    const b = new THREE.Mesh(btnGeo, mat); b.position.set(x, 0.0, 0.335); bg.add(b);
    const l = etiqueta(bg, txt, 0.05, 0.02, x, -0.032, 0.332);
    bg.userData.tip = tip; m.add(bg); markClick(bg, () => cb.modo(n, i, bypass));
    return mat;
  };
  const inv = btn(0.14, 0x2fd27a, 'INV', 'INV · Pasar esta UPS a inversor (no está comunicada con la otra UPS)', false);
  const byp = btn(0.205, 0xf0b429, 'BYP', 'BYP · Pasar esta UPS a bypass estático (no está comunicada con la otra UPS)', true);
  return { scr, led, inv, byp };
}

function banco(g, y, titulo, v) {
  const m = new THREE.Group(); m.position.y = y; g.add(m);
  box(0.5, 0.15, 0.62, M.batt, 0, 0, 0, m);
  box(0.5, 0.15, 0.02, M.battFace, 0, 0, 0.32, m);
  box(0.2, 0.014, 0.03, M.handle, -0.08, -0.05, 0.345, m);
  const led = ledNuevo(); box(0.016, 0.016, 0.008, led, -0.21, 0.05, 0.332, m);
  const l = labelPlane(`BANCO ${titulo}\n${v}`, 0.24, 0.06, { size: 22, color: '#d5dae0' });
  l.position.set(0.03, 0.005, 0.332); m.add(l);
  return { led };
}

function sts(g, y, n) {
  const m = new THREE.Group(); m.position.y = y; g.add(m);
  box(0.5, 0.15, 0.62, M.module, 0, 0, 0, m);
  box(0.5, 0.15, 0.02, M.face, 0, 0, 0.32, m);
  const scr = pantalla(m, 0.25, 0.1, -0.09, 0.0, 0.332);
  const ledA = ledNuevo(), ledB = ledNuevo(), ledS = ledNuevo();
  const pA = 0.045, pB = 0.005, pS = -0.035;
  [[ledA, pA, 'A'], [ledB, pB, 'B'], [ledS, pS, 'SAL']].forEach(([l, py, t]) => { box(0.014, 0.014, 0.008, l, 0.2, py, 0.335, m); etiqueta(m, t, t === 'SAL' ? 0.04 : 0.03, 0.016, 0.155, py, 0.332); });
  etiqueta(m, `STS-${n}`, 0.1, 0.03, 0.17, 0.062, 0.332);
  return { scr, ledA, ledB, ledS };
}

/* Distribución del tablero: con pocos automáticos van en una fila; con más de 9 (circuito 2) no caben a lo ancho y se reparten en dos filas
   (CB0…CB7 arriba, CB8…CB14 abajo), y los pilotos igual. Alturas dentro del tablero: riel(es), piloto, placa del piloto y límite entre cubiertas. */
const disposicion = total => total > 9
  ? { filas: [Math.ceil(total / 2), Math.floor(total / 2)], rieles: [1.69, 1.578], placa: 0.048, paso: 0.0625, anchoPlaca: 0.058, pilotos: [1.87, 1.806], tags: [1.84, 1.776], pasoPiloto: 0.061, anchoTag: 0.057, corte: 1.753 }
  : { filas: [total], rieles: [1.609], placa: 0.05, paso: total > 7 ? 0.055 : total > 5 ? 0.066 : 0.075, anchoPlaca: 0.052, corte: 1.69 };
/** Fila y columna del automático `i` según la disposición. */
const lugar = (d, i) => { let f = 0, k = i; while (k >= d.filas[f]) k -= d.filas[f++]; return { f, k, n: d.filas[f] }; };

/** Riel DIN con los automáticos CB0…CB4 (los mismos del editor de tableros que usa el circuito 3), cada uno con su piloto. */
function rielAutomaticos(g, n, nombres) {
  const panel = new THREE.Group(); panel.position.y = -0.01; g.add(panel);
  const d = disposicion(nombres.length);
  for (const Y of d.rieles) {
    box(0.52, 0.035, 0.006, M.rail, 0, Y, 0.311, panel);
    box(0.5, 0.008, 0.0065, M.dark, 0, Y, 0.311, panel);
    for (const sx of [-1, 1]) box(0.014, 0.05, 0.02, M.rail, sx * 0.256, Y, 0.318, panel);
  }
  const brk = nombres.map((nom, i) => {
    const l = lugar(d, i), Y = d.rieles[l.f], x = (l.k - (l.n - 1) / 2) * d.paso;
    const G = buildPieza({ id: 'CB' + i, type: 'breaker', name: 'CB' + i, poles: 1, amp: i === 0 ? 'C63' : n === 2 && i >= 11 ? 'C32' : 'C40', on: true, aux: false, mod: 2 }, undefined, { sinPlaca: true });
    G.scale.setScalar(ESCALA); G.position.set(x, Y, 0.314); G.userData.tip = `${nom} · clic para abrirlo o cerrarlo`;
    sinEsferas(G); panel.add(G);
    markClick(G, () => cb.toggle(n, i));
    const b = { lever: G.userData.pivote, x, y: Y, G, cerrado: null };
    const kR = n === 1 && i >= 5 ? i - 5 : n === 2 && (i === 9 || i === 10) ? i - 9 : -1;
    if (kR >= 0) {                                              // contacto auxiliar adelantado del rodeo: automático delgado de palanca verde, pegado a su izquierda
      const xa = x - POLO * MOD * ESCALA / 2 - POLO * ESCALA / 2;
      const A = buildPieza({ id: 'AUX' + i, type: 'breaker', name: 'AUX', poles: 1, amp: 'C6', on: false, aux: false, verde: true }, undefined, { sinPlaca: true });
      A.scale.setScalar(ESCALA); A.position.set(xa, Y, 0.314);
      A.userData.tip = `Contacto auxiliar adelantado del rodeo de la UPS ${n === 1 ? 'AB'[kR] : kR + 1} (palanca verde): cierra unas milésimas antes que el rodeo y pasa esa UPS a bypass estático`;
      sinEsferas(A); panel.add(A);
      markClick(A, () => cb.toggle(n, i));
      b.aux = { x: xa, G: A, lever: A.userData.pivote };
    }
    return b;
  });
  brk.panel = panel; brk.d = d;
  return brk;
}
function ponerAutomaticos(brk, Q, vivo) {
  brk.forEach((b, i) => {
    if (b.cerrado !== Q[i]) {
      b.cerrado = Q[i]; tween(b.lever.rotation, 'x', Q[i] ? -LEVER_ANGLE : LEVER_ANGLE, 0.25);
      if (b.aux) tween(b.aux.lever.rotation, 'x', Q[i] ? -LEVER_ANGLE : LEVER_ANGLE, 0.25);      // la palanca verde se mueve en paralelo con la del rodeo
    }
    b.piloto.userData.setLit(!!vivo[i]);
  });
}

/** Cubiertas del tablero (las mismas del circuito 3): pilotos arriba y automáticos abajo, con tapa ciega sobre ellas. */
function cubiertas(n, brk, nombres) {
  const panel = brk.panel, d = brk.d;
  box(COVER_W, 0.03, TAPA_T, M.frame, 0, 1.92, COVER_Z, panel);
  for (const sx of [-1, 1]) {
    const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0065, 0.006, 14).rotateX(Math.PI / 2), std(0xc9ced4, 0.85, 0.3));
    sc.position.set(sx * 0.262, 1.92, FACE_Z + 0.003); panel.add(sc);
  }
  // cubierta de pilotos: CB0 en rojo y CB1…CB4 en verde, cada uno con su placa
  const pil = makeCover(d.corte + 0.002, 1.905, 'Cubierta de pilotos · clic para abrirla o cerrarla (con la puerta frontal abierta)', [], panel, c => clicTapa(n, c));
  const PS = 0.72;
  nombres.forEach((nom, i) => {
    const rojo = i === 0, l = lugar(d, i);
    // una fila de automáticos: el rojo arriba y los verdes en otra fila; dos filas: cada piloto en el mismo orden que su automático
    const x = d.pilotos ? -0.012 + (l.k - (l.n - 1) / 2) * d.pasoPiloto : rojo ? -0.01 : -0.01 + (i - 1 - (nombres.length - 2) / 2) * (nombres.length > 7 ? 0.065 : nombres.length > 5 ? 0.085 : 0.1);
    const lamp = d.pilotos ? d.pilotos[l.f] : rojo ? 1.865 : 1.795, tag = d.pilotos ? d.tags[l.f] : rojo ? 1.835 : 1.765;
    const pg = buildPieza({ id: `P${n}${i}`, type: 'piloto', name: 'CB' + i, color: rojo ? 'Rojo' : 'Verde', on: false }, undefined, { sinPlaca: true });
    pg.scale.setScalar(PS); pg.position.set(x, lamp - 0.022 * PS, COVER_Z - TAPA_T / 2 - 0.04 * PS + 0.003);
    sinEsferas(pg); pil.add(pg); brk[i].piloto = pg;
    const ancho = d.anchoTag || 0.092;
    const t = labelPlane(nom.split(' · ')[1], ancho, 0.015, { w: Math.round(ancho * 4350), h: 65, size: d.anchoTag ? 40 : 44, color: '#ffffff', bg: '#101113' });
    t.position.set(x, tag, FACE_Z + 0.0005); pil.add(t);
  });
  const warn = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.04), new THREE.MeshBasicMaterial({ map: textTex('⚠', { w: 64, h: 64, size: 46, bg: '#f2c200', color: '#111' }), toneMapped: false }));
  warn.position.set(d.pilotos ? 0.242 : 0.232, d.pilotos ? 1.87 : 1.83, FACE_Z + 0.0005); if (d.pilotos) warn.scale.setScalar(0.7); pil.add(warn);
  // cubierta de automáticos: una ranura del tamaño de cada automático y su placa de texto
  panel.updateWorldMatrix(true, true);
  const ranuras = brk.map(b => {
    const bb = new THREE.Box3().setFromObject(b.G), lo = panel.worldToLocal(bb.min.clone()), hi = panel.worldToLocal(bb.max.clone()), m = 0.0008;
    const hw = POLO * MOD * ESCALA / 2 + m, y = (lo.y + hi.y) / 2, hh = (hi.y - lo.y) / 2 + m;
    if (!b.aux) return { x: b.x, y, hw, hh };
    const x0 = b.aux.x - POLO * ESCALA / 2 - m, x1 = b.x + hw;                 // una sola ranura para el rodeo y su contacto auxiliar
    return { x: (x0 + x1) / 2, y, hw: (x1 - x0) / 2, hh };
  });
  const aut = makeCover(1.531, d.corte, 'Cubierta de automáticos · clic para abrirla o cerrarla (con la puerta frontal abierta)', ranuras, panel, c => clicTapa(n, c));
  nombres.forEach((nom, i) => {
    const an = d.anchoPlaca, al = d.filas.length > 1 ? 0.022 : 0.028;
    const p = new THREE.Group(), l = labelPlane(nom.replace(' · ', '-'), an, al, { w: Math.round(an * 5000), h: Math.round(al * 5000), size: d.filas.length > 1 ? 36 : 34, color: '#ffffff', bg: '#101113' });
    l.position.set(brk[i].x, brk[i].y + d.placa, FACE_Z + 0.0005); p.add(l); aut.add(p);
    markClick(p, () => cb.toggle(n, i));
    if (brk[i].aux) {                                           // papelito del contacto auxiliar sobre su módulo
      if (d.filas.length === 1) {                               // en dos filas no queda sitio para su papelito (el globo del módulo lo explica)
        const q = new THREE.Group(), la = labelPlane('CONT' + String.fromCharCode(10) + 'AUX', 0.028, 0.028, { w: 140, h: 140, size: 40, color: '#ffffff', bg: '#101113' });
        la.position.set(brk[i].aux.x, brk[i].y + d.placa, FACE_Z + 0.0005); q.add(la); aut.add(q);
        markClick(q, () => cb.toggle(n, i));
      }
    }
  });
  RACKS[n].tapas = [pil, aut];
}

/** Medidor domiciliario junto al rack, con su poste (el mismo del circuito 3). */
function medidor(g) {
  const m = new THREE.Group(); m.position.set(-0.78, 1.5, 0.2); g.add(m);
  box(0.27, 0.34, 0.012, std(0xbfc3c8, 0.3, 0.5), 0, 0, -0.006, m);
  const mt = buildPieza({ id: 'M', type: 'medidor', name: 'MEDIDOR' }); mt.scale.setScalar(1.5); m.add(mt); sinEsferas(mt);
  box(0.03, 1.5, 0.03, M.rail, 0, -0.92, -0.02, m);
  m.userData.tip = 'Medidor domiciliario · entrega la red eléctrica al rack';
  markClick(m, () => {});
  return mt;
}

/** Carga: caja negra con luz verde y pantalla con su consumo. */
function carga(g, x, z, titulo) {
  const c = new THREE.Group(); c.position.set(x, 0, z); g.add(c);
  box(0.5, 0.6, 0.4, M.panel, 0, 0.3, 0, c);
  const scr = pantalla(c, 0.34, 0.5, 0, 0.3, 0.201);   // pantalla vertical: aviso, cono de carga, % y kVA
  return { scr, titulo };
}

/** Cable de potencia por el suelo (como el de la carga del circuito 3). */
function cableSuelo(g, pts, r = 0.018) {
  const mat = std(OSCURO, 0.2, 0.6, { emissive: 0x000000 });
  const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), 40, r, 8), mat);
  m.castShadow = true; g.add(m);
  return { set(on, hex) { mat.emissive.setHex(on ? hex : 0); mat.color.setHex(on ? hex : OSCURO); mat.emissiveIntensity = on ? 0.6 : 0; } };
}
/** Polilínea con las esquinas redondeadas (radio rad). */
function polilinea(pts, rad = 0.03) {
  const P = pts.map(p => new THREE.Vector3(...p)), path = new THREE.CurvePath();
  let prev = P[0].clone();
  for (let i = 1; i < P.length - 1; i++) {
    const a = P[i - 1], b = P[i], c = P[i + 1];
    const r = Math.min(rad, a.distanceTo(b) / 2, b.distanceTo(c) / 2);
    const p1 = b.clone().add(a.clone().sub(b).normalize().multiplyScalar(r));
    const p2 = b.clone().add(c.clone().sub(b).normalize().multiplyScalar(r));
    if (prev.distanceTo(p1) > 1e-6) path.add(new THREE.LineCurve3(prev, p1));
    path.add(new THREE.QuadraticBezierCurve3(p1, b.clone(), p2));
    prev = p2;
  }
  path.add(new THREE.LineCurve3(prev, P[P.length - 1]));
  return path;
}
/** Cable fino (16 mm²) de color liso o con franjas amarillo y verde (tierra). */
function cableFino(g, pts, color, r = 0.0025) {
  const path = polilinea(pts);
  let mat;
  if (color === 'tierra') {
    const c = document.createElement('canvas'); c.width = 64; c.height = 8;
    const x = c.getContext('2d'); x.fillStyle = '#f2c200'; x.fillRect(0, 0, 32, 8); x.fillStyle = '#1e9a3e'; x.fillRect(32, 0, 32, 8);
    const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(path.getLength() / 0.03, 1);
    mat = std(0xffffff, 0.1, 0.6, { map: t });
  } else mat = std(color, 0.1, 0.6);
  const m = new THREE.Mesh(new THREE.TubeGeometry(path, Math.max(40, Math.round(path.getLength() * 60)), r, 8), mat);
  m.castShadow = true; g.add(m);
}
/** Medidor → rack: la fase (rojo) y el neutro (azul) bajan del medidor, suben por fuera del rack, entran por el techo y bajan hasta el automático CB0;
    la tierra (amarillo y verde) sale de la pica enterrada, sube por el costado y entra por el techo a una barra de cobre. */
function cablesMedidor(g, mt, xQ0) {
  scene.updateMatrixWorld(true);
  const borne = k => mt.localToWorld(mt.userData.terms.find(q => q.key === k).pos.clone());
  const yQ = 1.652, yT = 2.075;
  for (const [k, color, xo, yo, xg, zi] of [['2', 0xc62828, -0.42, 0, -0.236, 0.29], ['4', 0x1f5fd6, -0.435, 0.008, -0.248, 0.275]]) {
    const p = borne(k), xEnd = k === '2' ? xQ0 : xQ0 - 0.035;
    cableFino(g, [[p.x, p.y, p.z], [p.x, p.y - 0.06 - yo, p.z], [xo, p.y - 0.06 - yo, p.z], [xo, yT + yo, p.z], [xg, yT + yo, zi], [xg, yQ, zi], [xEnd, yQ, zi]], color);
  }
  // tierra: desde la abrazadera de la pica hasta la barra de cobre dentro del rack
  const cx = POZO.x, cz = POZO.z + 0.0165, xe = 0.15, ze = 0.2765;
  cableFino(g, [[cx, 0.13, cz], [cx + 0.03, 0.13, cz], [cx + 0.03, 0.3, ze], [cx + 0.03, 2.12, ze], [xe, 2.12, ze], [xe, 1.745, ze]], 'tierra');
  const cu = std(0xd08a4a, 0.8, 0.4);
  box(0.12, 0.014, 0.008, cu, xe, 1.735, ze, g);                                          // barra de cobre de tierra
  for (const sx of [-1, 1]) {
    const a = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.016, 16).rotateX(Math.PI / 2), std(0xc21a1a, 0.2, 0.5));
    a.position.set(xe + sx * 0.054, 1.735, ze - 0.012); g.add(a);
  }
}
const haciaCarga = (g, z0, zc) => cableSuelo(g, [[0.33, 0.04, z0], [0.7, 0.02, (z0 + zc) / 2 + 0.05], [1.05, 0.04, zc]]);

/** Tapas ciegas color crema (solo la placa frontal, como un módulo más) en los lugares libres de abajo, para dejar el mismo espacio vacío que el circuito 3. */
function tapasCiegas(g, ys) {
  for (const y of ys) box(0.5, 0.15, 0.02, M.frame, 0, y, 0.32, g);
  const warn = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.04), new THREE.MeshBasicMaterial({ map: textTex('⚠', { w: 64, h: 64, size: 44, bg: '#f2c200', color: '#111' }), toneMapped: false }));
  warn.position.set(-0.265, 0.5, 0.342); g.add(warn);   // etiqueta amarilla de advertencia sobre el riel
}

/* ---------- circuito 1: 2 UPS en serie ---------- */
const RACKS = { 1: rackCompleto(g1, 1, ['2 UPS de 6 kVA en serie', 'Potencia total 6 kVA', '220–240 VAC']) };
const aut1 = rielAutomaticos(g1, 1, ['CB0 · RED', 'CB1 · ENT A', 'CB2 · SAL A', 'CB3 · ENT B', 'CB4 · SAL B', 'CB5 · RODEO A', 'CB6 · RODEO B']);
cubiertas(1, aut1, ['CB0 · RED', 'CB1 · ENT A', 'CB2 · SAL A', 'CB3 · ENT B', 'CB4 · SAL B', 'CB5 · RODEO A', 'CB6 · RODEO B']);
const upsA = ups(g1, 1.445, 'UPS A · 6 kVA', 1, 0), bcoA = banco(g1, 1.285, 'UPS A', '6×12 V');
const upsB = ups(g1, 1.125, 'UPS B · 6 kVA', 1, 1), bcoB = banco(g1, 0.965, 'UPS B', '6×12 V');
cablesMedidor(g1, medidor(g1), -0.1125);
tapasCiegas(g1, [0.805, 0.645, 0.485]);
const car1 = carga(g1, 1.3, 0.1, 'CARGA');
const k1 = { bout: haciaCarga(g1, 0.1, 0.1) };

/* ---------- circuito 2: 2 UPS con 2 STS ---------- */
RACKS[2] = rackCompleto(g2, 2, ['2 UPS 10 kVA + 2 STS', 'Potencia total 10 kVA', '220–240 VAC']);
const NOMBRES2 = ['CB0 · RED', 'CB1 · ENT 1', 'CB2 · SAL 1', 'CB3 · ENT 2', 'CB4 · SAL 2', 'CB5 · S-STS1', 'CB6 · S-STS2', 'CB7 · BYP STS1', 'CB8 · BYP STS2', 'CB9 · RODEO 1', 'CB10 · RODEO 2',
  'CB11 · A-STS1', 'CB12 · B-STS1', 'CB13 · A-STS2', 'CB14 · B-STS2'];                 // CB11…CB14: entradas A y B de cada STS
const aut2 = rielAutomaticos(g2, 2, NOMBRES2);
cubiertas(2, aut2, NOMBRES2);
const up1 = ups(g2, 1.445, 'UPS 1 · 10 kVA', 2, 0), bc1 = banco(g2, 1.285, 'UPS 1', '10×12 V');
const up2 = ups(g2, 1.125, 'UPS 2 · 10 kVA', 2, 1), bc2 = banco(g2, 0.965, 'UPS 2', '10×12 V');
const st1 = sts(g2, 0.805, 1), st2 = sts(g2, 0.645, 2);
cablesMedidor(g2, medidor(g2), -0.15);
tapasCiegas(g2, [0.485]);
const car2a = carga(g2, 1.3, 0.1, 'CARGA 1'), car2b = carga(g2, 2.1, 0.1, 'CARGA 2');   // una al lado de la otra, de frente
const k2 = {
  s0: haciaCarga(g2, 0.05, 0.1),
  s1: cableSuelo(g2, [[0.33, 0.04, -0.15], [0.8, 0.02, -0.3], [1.55, 0.02, -0.3], [1.7, 0.02, -0.2], [1.7, 0.03, 0.0], [1.85, 0.04, 0.1]]),   // pasa por detrás de la carga 1
};

/* ---------- pantallas ---------- */
const MODO_COL = { normal: '#3dff95', bateria: '#6cb8ff', bypass: '#ffc233', apagada: '#ff6b6b', falla: '#ff6b6b' };

function pantallaUps(scr, nombre, x, soc) {
  const { ctx: g, tex } = scr;
  g.fillStyle = x.mode === 'apagada' ? '#000' : '#06120c'; g.fillRect(0, 0, scr.w, scr.h);
  if (x.mode !== 'apagada') {
    g.textBaseline = 'top';
    g.fillStyle = MODO_COL[x.mode]; g.font = 'bold 21px monospace';
    g.fillText(`${nombre} ${MODO_TXT[x.mode].toUpperCase()}`.slice(0, 22), 10, 8);
    g.font = '19px monospace';
    if (x.mode === 'falla') { g.fillStyle = '#ffb3b3'; g.fillText('FUERA DE SERVICIO', 10, 40); g.fillText('REVISE EL EQUIPO', 10, 66); }
    else {
      g.fillStyle = x.over ? '#ff6b6b' : '#9fe9bf';
      g.fillText(`CARGA ${x.visto.toFixed(1)}/${x.kva} kVA`, 10, 40);
      g.fillStyle = '#9fe9bf';
      g.fillText(`BAT ${Math.round(soc)}% AUT ${Math.round(autonomia(x, soc))}m`, 10, 62);
      if (x.over) { g.fillStyle = '#ff6b6b'; g.fillText('SOBRECARGA', 10, 84); }
    }
  }
  tex.needsUpdate = true;
}

function pantallaSts(scr, n, t) {
  const { ctx: g, tex } = scr;
  g.fillStyle = '#06120c'; g.fillRect(0, 0, scr.w, scr.h);
  g.textBaseline = 'top'; g.font = 'bold 21px monospace';
  g.fillStyle = t.sel === null || t.falla ? '#ff6b6b' : t.sel === 'A' ? '#3dff95' : '#ffc233';
  g.fillText(`STS-${n} ${t.falla ? 'FALLA' : t.sel === null ? 'SIN FUENTE' : 'FUENTE ' + t.sel}`, 10, 8);
  g.font = '19px monospace'; g.fillStyle = '#9fe9bf';
  g.fillText(`A:${t.a ? 'OK' : '--'}  B:${t.b ? 'OK' : '--'}`, 10, 38);
  g.fillText(`CARGA ${t.carga.toFixed(1)} kVA`, 10, 64);
  tex.needsUpdate = true;
}

function pantallaCarga(c, kva, energizada, pct, sinRedund = false) { dibujarCarga(c.scr, c.titulo, kva, 'kVA', energizada, pct, sinRedund); }

function ledBanco(b, x, charging) { setLed(b.led, x.mode === 'bateria' ? 0xffb020 : charging ? 0x3aa0ff : 0); }
const ledUps = (u, x) => {
  setLed(u.led, x.mode === 'falla' ? 0xff3030 : x.vivo ? 0x22ff88 : 0);
  const off = x.mode === 'apagada' || x.mode === 'falla';                      // los botones se iluminan según el modo real de la UPS
  u.inv.emissiveIntensity = off ? 0 : x.mode === 'bypass' ? 0.15 : 1.2;
  u.byp.emissiveIntensity = off ? 0 : x.mode === 'bypass' ? 1.2 : 0.15;
};

/* ---------- aplicar el estado ---------- */
/** Repinta el 3D del circuito 1 (se llama en cada cuadro; solo cambia lo que hace falta). */
export function aplicar1(r) {
  const [A, B] = r.u, w = r.w;
  const Ql = SC.c1.Q.map((q, i) => (i >= 5 && SC.c1.auxSig[i - 5] ? SC.c1.cmd[i - 5] : q));      // la palanca del rodeo y la del contacto auxiliar siguen la orden desde que se da
  ponerAutomaticos(aut1, Ql, [w.red, w.g, w.ao, w.mid, w.bo, w.g, w.mid]);
  ledUps(upsA, A); ledUps(upsB, B);
  ledBanco(bcoA, A, A.inV && SC.c1.soc[0] < 100); ledBanco(bcoB, B, B.inV && SC.c1.soc[1] < 100);
  k1.bout.set(w.bout, w.soloRodeo ? COL.amber : colorModo(B.mode));   // por el rodeo la carga cuelga directo de la red
  }
export function pantallas1(r) {
  pantallaUps(upsA.scr, 'UPS A', r.u[0], SC.c1.soc[0]); pantallaUps(upsB.scr, 'UPS B', r.u[1], SC.c1.soc[1]);
  pantallaCarga(car1, r.carga, r.out, r.pct);
}

export function aplicar2(r) {
  const [U1, U2] = r.u, w = r.w;
  const Ql2 = SC.c2.Q.map((q, i) => (i >= 9 && SC.c2.auxSig[i - 9] ? SC.c2.cmd[i - 9] : q));      // la palanca del rodeo y la del contacto auxiliar siguen la orden desde que se da
  ponerAutomaticos(aut2, Ql2, [w.red, w.g, w.o0, w.g, w.o1, w.t0, w.t1, w.b0, w.b1, w.g, w.g, w.x0, w.x1, w.x1, w.x0]);     // CB11 y CB14 desde la UPS 1; CB12 y CB13 desde la UPS 2
  ledUps(up1, U1); ledUps(up2, U2);
  ledBanco(bc1, U1, U1.inV && SC.c2.soc[0] < 100); ledBanco(bc2, U2, U2.inV && SC.c2.soc[1] < 100);
  [[st1, r.sts[0]], [st2, r.sts[1]]].forEach(([s, t]) => {
    setLed(s.ledA, t.sel === 'A' ? 0x22ff88 : t.a ? 0x1d6b44 : 0);
    setLed(s.ledB, t.sel === 'B' ? 0xffc233 : t.b ? 0x6b5412 : 0);
    setLed(s.ledS, t.falla ? 0xff3b3b : t.out ? 0x22ff88 : 0);
  });
  k2.s0.set(w.s0, !w.bl0 && r.sts[0].sel === 'B' ? COL.amber : COL.green); k2.s1.set(w.s1, !w.bl1 && r.sts[1].sel === 'B' ? COL.amber : COL.green);
}
export function pantallas2(r) {
  pantallaUps(up1.scr, 'UPS1', r.u[0], SC.c2.soc[0]); pantallaUps(up2.scr, 'UPS2', r.u[1], SC.c2.soc[1]);
  pantallaSts(st1.scr, 1, r.sts[0]); pantallaSts(st2.scr, 2, r.sts[1]);
  pantallaCarga(car2a, SC.c2.load[0], r.sts[0].on, r.sts[0].pct, r.sinRedund); pantallaCarga(car2b, SC.c2.load[1], r.sts[1].on, r.sts[1].pct, r.sinRedund);
}
