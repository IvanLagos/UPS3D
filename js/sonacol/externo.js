/* Circuito 4 de SONACOL: el circuito 3 (paralelo redundante con bypass de rodeo) más un tablero externo de bypass con 3 automáticos:
   · CB8 entrada: va aguas arriba de CB5 (sin ella el sistema queda sin red).
   · CB9 bypass externo: lleva la red de aguas abajo de CB8 (aguas arriba de CB5) a aguas arriba de CB10, por fuera de CB5, de las UPS y de CB6; lleva contacto auxiliar adelantado.
   · CB10 salida: va a la carga; recibe lo que entrega CB6 o lo que llega por el bypass externo.
   Aquí viven su cuadro en el panel, su parte del diagrama unifilar (sobre el del circuito 3) y su gabinete 3D con los cables por el suelo. */
import * as THREE from 'three';
import { $ } from '../core/dom.js';
import { scene } from '../core/scene.js';
import { M, std } from '../core/materials.js';
import { box, labelPlane } from '../core/helpers.js';
import { markClick } from '../core/interaction.js';
import { tween } from '../core/tween.js';
import { S, E } from '../state.js';
import { setExtIn, setExtOut, setExtBypass } from '../logic/actions.js';
import { syncSwitches } from '../ui/sync.js';
import { loadGroup, cableMesh } from '../model/load.js';
import { sinEsferas, SC as ESCALA, MOD, LEVER_ANGLE } from '../model/breakerPanel.js';
import { build as buildPieza, P as POLO } from '../../tablero/modelos.js';

/* ---------- gabinete 3D ---------- */
export const gExt = new THREE.Group();
gExt.visible = false;
scene.add(gExt);

const CX = 1.3, CZ = 0.1, CARGA_X = 2.3;                       // posición del gabinete y de la carga cuando el tablero externo está entre el rack y la carga
const etiqueta = (parent, txt, w, h, x, y, z, color = '#d5dae0', bg = null) => {     // el texto se ajusta solo al recuadro (por líneas y por ancho)
  const lineas = txt.split(String.fromCharCode(10)), maxc = Math.max(...lineas.map(l => l.length)), pw = Math.round(w * 2000), ph = Math.round(h * 2000);
  const size = Math.round(Math.min(ph / (lineas.length * 1.12), pw / (maxc * 0.62)));
  const l = labelPlane(txt, w, h, { w: pw, h: ph, size, color, bg });
  l.position.set(x, y, z); parent.add(l); return l;
};

/* gabinete como el tablero real: caja gris claro vertical con puerta de bisagra a la derecha, logo, 3 pilotos con su placa amarilla, cerradura y cartel de peligro;
   al abrir la cubierta aparecen los 3 automáticos sobre su riel (con el contacto auxiliar del bypass externo) */
const GW = 0.46, GH = 0.62, GD = 0.21, GY = 0.19;                 // ancho, alto, fondo y altura del piso al gabinete
const GRIS = std(0xdfe2dd, 0.15, 0.55);
const gab = new THREE.Group(); gab.position.set(CX, GY + GH / 2, CZ); gExt.add(gab);       // el origen del grupo es el centro del gabinete
for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.04, GY, 0.04, M.plinth, sx * (GW / 2 - 0.05), -GH / 2 - GY / 2, sz * (GD / 2 - 0.05), gab);   // patas
box(GW, GH, 0.01, GRIS, 0, 0, -GD / 2 + 0.005, gab);                                       // fondo
for (const sx of [-1, 1]) box(0.01, GH, GD, GRIS, sx * (GW / 2 - 0.005), 0, 0, gab);       // laterales
for (const sy of [-1, 1]) box(GW, 0.01, GD, GRIS, 0, sy * (GH / 2 - 0.005), 0, gab);       // techo y piso
box(GW - 0.02, GH - 0.02, 0.008, std(0x2a2c30, 0.5, 0.5), 0, 0, -GD / 2 + 0.014, gab);     // fondo oscuro tras la ventana
const KA = 1.8;                                                   // los automáticos se dibujan más grandes que en el rack para que se lean dentro del gabinete
const YV = 0.1, WV = 0.38, HV = 0.12, XV = 0.01;                   // ventana del panel interior (por donde asoman los automáticos)
const BEIGE = std(0xd6d1bf, 0.15, 0.6), ZP = -GD / 2 + 0.05;       // panel interior beige, como el de la foto
const fr = new THREE.Group(); fr.position.set(0, YV, 0); gab.add(fr);
{
  const pw = GW - 0.02, ph = GH - 0.02, t = 0.008, top = YV + HV / 2, bot = YV - HV / 2;
  box(pw, ph / 2 - top, t, BEIGE, 0, (ph / 2 + top) / 2, ZP, gab);                       // franja sobre la ventana
  box(pw, ph / 2 + bot, t, BEIGE, 0, (bot - ph / 2) / 2, ZP, gab);                        // franja bajo la ventana
  const wb = POLO * MOD * ESCALA * KA, wa = POLO * ESCALA * KA, m = 0.004;                // ancho de un automático y del contacto auxiliar
  const vent = [[-0.14 - wb / 2 - m, -0.14 + wb / 2 + m], [0.04 - wb / 2 - wa - m, 0.04 + wb / 2 + m], [0.16 - wb / 2 - m, 0.16 + wb / 2 + m]];   // una ventana por automático (CB9 lleva su auxiliar)
  const tramos = [[-pw / 2, vent[0][0]], [vent[0][1], vent[1][0]], [vent[1][1], vent[2][0]], [vent[2][1], pw / 2]];                           // el latón beige queda entre ventanas
  for (const [x0, x1] of tramos) box(x1 - x0, HV, t, BEIGE, (x0 + x1) / 2, YV, ZP, gab);
}
box(0.4, 0.035, 0.006, M.rail, 0, YV, -GD / 2 + 0.021, gab);                              // riel DIN
box(0.38, 0.008, 0.0065, M.dark, 0, YV, -GD / 2 + 0.021, gab);
gab.userData.tip = 'Tablero externo de bypass';
markClick(gab, () => {});

const logoTex = new THREE.TextureLoader().load('assets/logo-fernandez-fica.png'); logoTex.colorSpace = THREE.SRGBColorSpace; logoTex.anisotropy = 8;
const palancas = {};
function automatico(clave, x, nombre, tip, alClic, conAux) {
  const Z = -GD / 2 + 0.034;
  const G = buildPieza({ id: clave, type: 'breaker', name: clave, poles: 1, amp: 'C63', on: true, aux: false, mod: 2 }, undefined, { sinPlaca: true });
  G.scale.setScalar(ESCALA * KA); G.position.set(x, 0.0, Z); G.userData.tip = tip;
  sinEsferas(G); fr.add(G); markClick(G, alClic);
  etiqueta(gab, nombre, clave === 'CB9' ? 0.13 : 0.085, 0.042, clave === 'CB9' ? x - 0.025 : x, YV + HV / 2 + 0.032, ZP + 0.0045, '#fff', '#0b0b0c');
  palancas[clave] = { lever: G.userData.pivote, cerrado: null, aux: null };
  if (conAux) {                                                  // contacto auxiliar adelantado: automático delgado de palanca verde, pegado a la izquierda
    const xa = x - POLO * MOD * ESCALA * KA / 2 - POLO * ESCALA * KA / 2;
    const A = buildPieza({ id: 'AUX9', type: 'breaker', name: 'AUX', poles: 1, amp: 'C6', on: false, aux: false, verde: true }, undefined, { sinPlaca: true });
    A.scale.setScalar(ESCALA * KA); A.position.set(xa, 0.0, Z);
    A.userData.tip = 'Contacto auxiliar adelantado del bypass externo (palanca verde): cierra unas milésimas antes y pasa las UPS a bypass estático (la UPS 1 avisa a la UPS 2)';
    sinEsferas(A); fr.add(A); markClick(A, alClic);
    etiqueta(gab, 'CONT. AUX', 0.07, 0.025, xa, YV - HV / 2 - 0.02, ZP + 0.0045, '#fff', '#0b0b0c');
    palancas[clave].aux = A.userData.pivote;
  }
}
automatico('CB8', -0.14, 'CB8 ENTRADA', 'CB8 · Entrada del tablero externo (aguas arriba de CB5) · clic para abrirla o cerrarla', () => setExtIn(!S.ext.in));
automatico('CB9', 0.04, 'CB9 BYPASS', 'CB9 · Bypass externo (de aguas abajo de CB8 a aguas arriba de CB10) · clic para cerrarlo o abrirlo, con su contacto auxiliar adelantado', () => setExtBypass(!S.ext.byp), true);
automatico('CB10', 0.16, 'CB10 SALIDA', 'CB10 · Salida del tablero externo (a la carga) · clic para abrirla o cerrarla', () => setExtOut(!S.ext.out));

{                                                               // perilla negra a la izquierda y cuadro con el unifilar del tablero, como el de la foto
  const kb = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.012, 20).rotateX(Math.PI / 2), std(0x151517, 0.5, 0.4)); kb.position.set(-0.17, 0.0, ZP + 0.01); gab.add(kb);
  const pal = box(0.05, 0.014, 0.012, std(0x151517, 0.5, 0.4), -0.17, 0.0, ZP + 0.02, gab); pal.rotation.z = 0.5;
  const c = document.createElement('canvas'); c.width = 720; c.height = 400; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 720, 400); g.strokeStyle = '#000'; g.fillStyle = '#000'; g.lineWidth = 3; g.textAlign = 'center'; g.font = 'bold 20px system-ui, sans-serif';
  g.fillText('TABLERO DE BY-PASS', 360, 40); g.fillText('UPS EXTERNO', 360, 64);
  g.font = '15px system-ui, sans-serif';
  const L = (...p) => { g.beginPath(); g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.stroke(); };
  L(30, 250, 640, 250); L(140, 250, 140, 130, 560, 130, 560, 250);                     // red, bypass por arriba, salida
  L(220, 250, 220, 330, 300, 330); L(460, 250, 460, 330, 380, 330);                    // entrada y salida del sistema
  g.strokeRect(300, 305, 80, 50); g.fillText('UPS', 340, 385);
  for (const [x, y, t] of [[220, 250, 'CB8'], [350, 130, 'CB9'], [460, 250, 'CB10']]) { g.fillStyle = '#fff'; g.fillRect(x - 24, y - 12, 48, 24); g.fillStyle = '#000'; g.strokeRect(x - 24, y - 12, 48, 24); g.fillText(t, x, y + 5); }
  g.fillText('ALIMENTACIÓN RED', 80, 235); g.fillText('SALIDA CARGAS', 600, 235);
  g.fillText('PILOTO PRESENCIA', 140, 300); g.fillText('PILOTO SALIDA', 560, 300);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const q = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34 * 400 / 720), new THREE.MeshBasicMaterial({ map: t, toneMapped: false })); q.position.set(0.0, -0.17, ZP + 0.0045); gab.add(q);
  const lg = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.1 / 3.85), new THREE.MeshBasicMaterial({ map: logoTex, transparent: true, toneMapped: false })); lg.position.set(0.105, -0.095, ZP + 0.0052); gab.add(lg);
}

/* puerta: bisagra en el borde izquierdo; delante van el logo, los pilotos, la cerradura y el cartel de peligro */
const puerta = new THREE.Group(); puerta.position.set(-GW / 2, 0, GD / 2 + 0.004); gab.add(puerta);
box(GW - 0.004, GH - 0.004, 0.012, GRIS, GW / 2, 0, 0, puerta);
const P = (u, v, z = 0.0065) => [u + GW / 2, v, z];                  // posición en la puerta a partir de la medida desde el centro del gabinete
const pegar = (m, u, v, z) => { m.position.set(...P(u, v, z)); puerta.add(m); return m; };

pegar(new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.17 / 3.85), new THREE.MeshBasicMaterial({ map: logoTex, transparent: true, toneMapped: false })), -0.115, 0.265);

const pilotos = {};
function piloto(clave, u, v, color, texto) {                      // el mismo piloto de las UPS (modelo del editor): cuerpo detrás de la puerta y la lente asomando por delante
  const PS = 1.4;
  const pg = buildPieza({ id: 'PL_' + clave, type: 'piloto', name: clave, color, on: false }, undefined, { sinPlaca: true });
  pg.scale.setScalar(PS); sinEsferas(pg);
  pg.children.filter(o => o.position.y < -0.02).forEach(o => pg.remove(o));          // tornillos de los bornes: quedan detrás de la puerta, no se dibujan
  pg.position.set(u + GW / 2, v - 0.022 * PS, 0.006 - 0.04 * PS - 0.004); puerta.add(pg);
  pegar(labelPlane(texto, 0.082, 0.036, { w: 328, h: 144, size: 44, color: '#111', bg: '#f2c200' }), u, v - 0.052, 0.0066);
  pilotos[clave] = pg;
}
piloto('pres', -0.085, 0.13, 'Rojo', 'PRESENCIA' + String.fromCharCode(10) + 'DE TENSIÓN');
piloto('byp', 0.07, 0.13, 'Rojo', 'BYPASS');
piloto('carga', -0.01, 0.03, 'Verde', 'SALIDA DE' + String.fromCharCode(10) + 'CARGA');

{                                                                    // cerradura
  const placa = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.056, 0.006), std(0xc9c3b6, 0.3, 0.6)); pegar(placa, 0.15, -0.02, 0.0085);
  const ojo = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.004, 16).rotateX(Math.PI / 2), std(0x1b1b1d, 0.6, 0.4)); pegar(ojo, 0.15, -0.02, 0.0118);
  const ranura = new THREE.Mesh(new THREE.BoxGeometry(0.0035, 0.013, 0.003), std(0x6b6e72, 0.6, 0.4)); pegar(ranura, 0.15, -0.02, 0.0138);
}
{                                                                    // cartel de peligro
  const c = document.createElement('canvas'); c.width = 270; c.height = 360;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 270, 360); g.strokeStyle = '#000'; g.lineWidth = 8; g.strokeRect(4, 4, 262, 352);
  g.fillStyle = '#d8232a'; g.beginPath(); g.roundRect(18, 16, 234, 52, 24); g.fill();
  g.fillStyle = '#fff'; g.font = 'bold 40px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('PELIGRO', 135, 43);
  g.fillStyle = '#f7c600'; g.strokeStyle = '#000'; g.lineWidth = 8; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(135, 86); g.lineTo(236, 250); g.lineTo(34, 250); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#000'; g.beginPath(); g.moveTo(146, 130); g.lineTo(112, 190); g.lineTo(132, 190); g.lineTo(122, 232); g.lineTo(160, 170); g.lineTo(140, 170); g.closePath(); g.fill();
  g.fillStyle = '#000'; g.font = 'bold 36px system-ui, sans-serif'; g.fillText('RIESGO', 135, 283); g.fillText('ELÉCTRICO', 135, 326);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  pegar(new THREE.Mesh(new THREE.PlaneGeometry(0.135, 0.18), new THREE.MeshBasicMaterial({ map: t, toneMapped: false })), -0.045, -0.185, 0.0066);
}
puerta.userData.tip = 'Cubierta del tablero externo · clic para abrirla o cerrarla (con llave) y ver los 3 automáticos';
markClick(puerta, () => setCubierta(!abierta));

let abierta = false;
/** Abre (true) o cierra (false) la cubierta del tablero externo; con ella abierta se operan los 3 automáticos. */
export function setCubierta(on) {
  abierta = on;
  tween(puerta.rotation, 'y', on ? -2.6 : 0, 0.9);
}
export const cubiertaAbierta = () => abierta;

/* cables de potencia por el suelo */
function cableSuelo(pts, r = 0.018) {
  const mat = std(0x303030, 0.2, 0.6, { emissive: 0x000000 });
  const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), 48, r, 8), mat);
  m.castShadow = true; gExt.add(m);
  return { set(on, hex) { mat.emissive.setHex(on ? hex : 0); mat.color.setHex(on ? hex : 0x303030); mat.emissiveIntensity = on ? 0.6 : 0; } };
}
const yEntrada = GY + 0.01;                                      // los cables suben desde el suelo y entran por el fondo del gabinete
const cRed = cableSuelo([[-0.78, 0.04, 0.2], [-0.78, 0.03, -0.62], [CX, 0.03, -0.62], [CX, 0.06, CZ - 0.3], [CX, 0.14, CZ - 0.06], [CX, yEntrada, CZ]], 0.016);                  // red hasta el tablero externo (entrada y bypass)
const cSis = cableSuelo([[0.33, 0.04, 0.1], [0.7, 0.02, 0.18], [CX - 0.36, 0.04, CZ + 0.06], [CX - 0.14, 0.1, CZ + 0.05], [CX - 0.14, yEntrada, CZ + 0.04]]);                  // salida del sistema (CB6) hasta el tablero
const cCar = cableSuelo([[CX + 0.14, yEntrada, CZ + 0.04], [CX + 0.14, 0.1, CZ + 0.05], [CX + 0.36, 0.04, CZ + 0.06], [CX + 0.8, 0.03, CZ + 0.06], [CARGA_X - 0.25, 0.04, CZ]]);   // del tablero a la carga

/** Pone el gabinete y la carga del circuito 4 (o los devuelve a su sitio del circuito 3). */
export function mostrarExterno(on) {
  gExt.visible = on;
  loadGroup.position.x = on ? CARGA_X : 1.3;
  cableMesh.visible = !on;
}

/** Repinta el 3D del tablero externo (palancas, pilotos y cables). */
export function aplicarExterno() {
  const e = S.ext, cmd = e.auxSig ? e.cmd : e.byp;
  const estados = { CB8: e.in, CB9: cmd, CB10: e.out };
  for (const [k, p] of Object.entries(palancas)) {
    if (p.cerrado !== estados[k]) {
      p.cerrado = estados[k];
      tween(p.lever.rotation, 'x', estados[k] ? -LEVER_ANGLE : LEVER_ANGLE, 0.25);
      if (p.aux) tween(p.aux.rotation, 'x', estados[k] ? -LEVER_ANGLE : LEVER_ANGLE, 0.25);
    }
  }
  const enc = { pres: S.mains, byp: E.extByp, carga: E.out };                // PRESENCIA DE TENSIÓN: hay red · BYPASS: bypass externo cerrado · SALIDA DE CARGA: la carga recibe energía
  for (const [k, pg] of Object.entries(pilotos)) pg.userData.setLit(!!enc[k]);
  cRed.set(S.mains, 0xe0a800);
  const cSisColor = E.src === 'bypass' || E.src === 'rodeo' ? 0xe0a800 : E.src === 'bateria' ? 0x2f6fe0 : 0x1fa85f;
  cSis.set(E.outSis, cSisColor);
  cCar.set(E.out, E.extCarga && !E.cargaSis ? 0xe0a800 : cSisColor);
}

/* ---------- unifilar: el tablero externo se dibuja sobre el del circuito 3 ---------- */
const W = (id, d) => `<path id="${id}" class="w" d="${d}"/>`;
const B = (clave, x, y, txt, izq = false) => `<g class="brk" data-ext="${clave}" transform="translate(${x},${y})"><rect x="-9" y="-9" width="18" height="18" rx="3"/><line x1="0" y1="-5" x2="0" y2="5"/></g><text class="l" x="${izq ? x - 13 : x + 13}" y="${y + 3}"${izq ? ' text-anchor="end"' : ''}>${txt}</text>`;
const DESPLAZAMIENTO = 60;                                       // el diagrama del circuito 3 baja para dejar sitio a la entrada del tablero externo
const EXTRA_CARGA = 27;                                          // la carga baja más, para dejar sitio a la salida del tablero externo

/* recuadro punteado que agrupa lo que pertenece al tablero externo (como el de cada UPS con su inversor, baterías y bypass): franja de entrada (CB8 y la toma del bypass),
   columna del bypass (CB9) y franja de salida (CB10); el rack queda en el hueco */
const XE = -45;                                                  // columna del tablero externo: RED, CB8, toma del bypass, CB9, CB10 y CARGA, todos alineados
const SVG_EXT = `<rect class="blk ext" x="-190" y="33" width="170" height="374" rx="6"/><text class="l" x="-183" y="108">TABLERO EXTERNO</text><text class="l" x="-183" y="119">DE BYPASS</text>`
  + `<rect id="ex_red" class="node" x="${XE - 70}" y="6" width="140" height="20" rx="4"/><text class="t" x="${XE}" y="20">RED ELÉCTRICA</text>`
  + W('ex_w1', `M${XE} 26V35`) + B('in', XE, 44, 'CB8 Entrada tablero ext.', true) + W('ex_w2', `M${XE} 53V70`)
  + `<circle id="ex_tap" class="dot" cx="${XE}" cy="70" r="3.5"/>`
  + W('ex_w5', `M${XE} 70H155V86`)                                                                             // toma hacia el general (CB5) del sistema
  + W('ex_b1', `M${XE} 70V209`) + B('byp', XE, 218, 'CB9 Bypass externo', true)                                // el bypass baja por la misma columna
  + `<g id="ex_aux"><text class="l" x="${XE - 13}" y="233" text-anchor="end">Aux. adelantado</text><text class="l" x="${XE - 13}" y="244" text-anchor="end">→ UPS 1 → UPS 2</text></g>`
  + W('ex_b2', `M${XE} 227V380`)                                                                               // el bypass llega aguas arriba de CB10
  + W('ex_w4', `M155 380H${XE}`) + `<circle id="ex_unir" class="dot" cx="${XE}" cy="380" r="3.5"/>`            // la salida del sistema (CB6) llega al mismo punto
  + B('out', XE, 389, 'CB10 Salida tablero ext.', true) + W('ex_w3', `M${XE} 398V415`)
  + `<rect id="ex_load" class="node" x="${XE - 70}" y="415" width="140" height="20" rx="4"/><text class="t" x="${XE}" y="429">CARGA</text>`
  + `<g id="ex_xload" class="xmark"><line x1="${XE - 74}" y1="409" x2="${XE + 74}" y2="441"/><line x1="${XE + 74}" y1="409" x2="${XE - 74}" y2="441"/></g>`;

const svgSet = (id, on, cls = '') => {
  const el = $('#' + id); if (!el) return;
  el.classList.toggle('live', !!on);
  for (const c of ['byp', 'bat']) el.classList.toggle(c, !!on && c === cls);
};

/** Muestra u oculta el tablero externo en el unifilar del circuito 3. */
function unifilarExterno(on) {
  const svg = $('#uni'), base = $('#uniBase'), ext = $('#uniExt');
  svg.classList.toggle('ext', on);
  base.setAttribute('transform', on ? `translate(0,${DESPLAZAMIENTO})` : '');
  $('#rLoadG').setAttribute('transform', on ? `translate(0,${EXTRA_CARGA})` : '');
  $('#r_ol').setAttribute('d', on ? 'M155 311V320' : 'M155 311V328');
  ext.style.display = on ? '' : 'none';
  if (on && !ext.innerHTML) {
    ext.innerHTML = SVG_EXT;
    ext.querySelectorAll('.brk').forEach(g => g.addEventListener('click', () => {
      const k = g.dataset.ext;
      if (k === 'in') setExtIn(!S.ext.in); else if (k === 'out') setExtOut(!S.ext.out); else setExtBypass(!S.ext.byp);
    }));
  }
}

/** Repinta el unifilar del tablero externo y los controles de su cuadro. */
export function refrescarExterno() {
  const e = S.ext, cmd = e.auxSig ? e.cmd : e.byp;
  const estados = { in: e.in, byp: cmd, out: e.out };
  $('#ex_red').classList.toggle('warn', S.mains);
  svgSet('ex_w1', S.mains, 'byp'); svgSet('ex_w2', E.redIn, 'byp'); svgSet('ex_w5', E.redIn, 'byp'); svgSet('ex_b1', E.redIn, 'byp'); svgSet('ex_b2', E.extByp, 'byp');
  $('#ex_tap').classList.toggle('live', E.redIn); $('#ex_unir').classList.toggle('live', E.nodoSalida);
  svgSet('ex_w4', E.nodoSalida, E.src === 'bateria' ? 'bat' : E.src === 'normal' ? '' : 'byp');
  {                                                                                // la carga (se redibuja aquí: la del circuito 3 queda oculta en este circuito)
    const aviso = E.out && (E.extCarga && !E.cargaSis || E.src === 'bypass' || E.src === 'rodeo'), l = $('#ex_load');
    l.classList.toggle('warn', !!aviso); l.classList.toggle('on', E.out && !aviso);
    $('#ex_xload').classList.toggle('show', !E.out);
  }
  const colSis = E.src === 'bateria' ? 'bat' : E.src === 'normal' ? '' : 'byp';
  svgSet('ex_w3', E.out, E.extCarga && !E.cargaSis ? 'byp' : colSis);
  $('#ex_aux').classList.toggle('on', e.auxSig);
  document.querySelectorAll('#uniExt .brk').forEach(g => {
    const c = estados[g.dataset.ext], l = g.querySelector('line');
    g.classList.toggle('closed', c);
    l.setAttribute('x1', c ? 0 : -4); l.setAttribute('x2', c ? 0 : 4); l.setAttribute('y1', c ? -5 : 5); l.setAttribute('y2', c ? 5 : -5);
  });
  $('#ext_in').checked = e.in; $('#ext_byp').checked = cmd; $('#ext_out').checked = e.out; $('#ext_cub').checked = !abierta;
  $('#ext_cub_s').textContent = abierta ? 'Abierta · se ven y se operan los 3 automáticos' : 'Cerrada · clic en la puerta del 3D para abrirla';
  $('#ext_in_s').textContent = e.in ? 'Cerrada · la red llega al general' : 'Abierta · el sistema queda sin red';
  $('#ext_byp_s').textContent = cmd ? 'Cerrado · la red llega directo a CB10, por fuera del sistema' : 'Abierto';
  $('#ext_out_s').textContent = e.out ? 'Cerrada · la salida llega a la carga' : 'Abierta · la salida queda desconectada de la carga';
  const al = [];
  if (!e.in && S.mains) al.push(['Entrada del tablero externo abierta (CB8): el sistema no recibe red', 'bad']);
  if (!e.out && E.nodoSalida) al.push(['Salida del tablero externo abierta (CB10): no llega energía a la carga', 'bad']);
  if (E.extByp) al.push([!e.out ? 'Bypass externo cerrado (CB9), pero CB10 abierta: la carga no recibe energía' : E.cargaSis ? 'Bypass externo cerrado (CB9): la red entra aguas arriba de CB10 y también la salida del sistema' : 'Bypass externo cerrado (CB9): la carga cuelga de la red (aguas abajo de CB8), por fuera del sistema', !e.out ? 'bad' : '']);
  if (e.auxSig) al.push(['Contacto auxiliar del bypass externo activo: las UPS pasan a bypass estático antes de cerrar el CB9', '']);
  $('#ext_al').innerHTML = al.map(([t, c]) => `<li class="${c}">${t}</li>`).join('');
}

/* ---------- cuadro del panel ---------- */
const fila = (id, titulo) => `<label class="sw"><span>${titulo}<small id="${id}_s"></small></span><input type="checkbox" id="${id}"></label>`;

export function iniciarExterno() {
  $('#panel').insertAdjacentHTML('beforeend', `<section id="sonExt" hidden>
    <h2>Tablero externo de bypass</h2>
    ${fila('ext_in', 'CB8 · Entrada (aguas arriba de CB5)')}
    ${fila('ext_byp', 'CB9 · Bypass externo (aguas abajo de CB8 → aguas arriba de CB10)')}
    ${fila('ext_out', 'CB10 · Salida (a la carga)')}
    ${fila('ext_cub', 'Cubierta del tablero cerrada')}
    <p class="note">El bypass externo lleva contacto auxiliar adelantado: antes de cerrarlo pasa las UPS a bypass estático (la UPS 1 avisa a la UPS 2), así la salida queda sincronizada con la red.</p>
    <ul class="alarmas" id="ext_al"></ul>
  </section>`);
  $('#ext_in').addEventListener('change', e => setExtIn(e.target.checked));
  $('#ext_byp').addEventListener('change', e => setExtBypass(e.target.checked));
  $('#ext_out').addEventListener('change', e => setExtOut(e.target.checked));
  $('#ext_cub').addEventListener('change', e => setCubierta(!e.target.checked));              // verde = cerrada, como los demás interruptores de puertas y cubiertas
  $('#ext_cub').checked = true;
}

/** Activa (true) o desactiva el tablero externo: estado, unifilar, 3D y cuadro del panel. */
export function activarExterno(on) {
  S.ext = { on, in: true, byp: false, out: true, cmd: false, auxSig: false, auxForzo: false };
  abierta = false; puerta.rotation.y = 0;                       // la cubierta parte cerrada
  mostrarExterno(on);
  unifilarExterno(on);
  $('#sonExt').hidden = !on;
  syncSwitches();                                              // vuelve a calcular el tamaño del diagrama
}
