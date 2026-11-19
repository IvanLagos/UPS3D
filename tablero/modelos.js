/* Modelos 3D de los componentes del tablero: automático, bornera, barra de distribución, llave selectora y luz piloto.
   Cada componente se dibuja con su origen en el centro, apoyado en el riel (z = 0 es la cara trasera, +z hacia el frente).
   Cada borne tiene un tornillo visible y una esfera invisible más grande para poder hacer clic en él. */
import * as THREE from 'three';
import { M, std } from '../js/core/materials.js';
import { box, labelPlane, roundedRect } from '../js/core/helpers.js';

export const P = 0.027;                                   // ancho de un polo de automático (m)
const screwMat = std(0xb9bec4, 0.9, 0.3);
const screwGeo = new THREE.CylinderGeometry(0.0055, 0.0055, 0.006, 14).rotateX(Math.PI / 2);
const hitGeo = new THREE.SphereGeometry(0.0085, 8, 6);
const hitMat = new THREE.MeshBasicMaterial({ visible: false });
const black = std(0x111214, 0.3, 0.6);
const darkGrey = std(0x2a2c30, 0.4, 0.6);
const copper = std(0xc8773a, 0.9, 0.3);
const lightPlate = std(0xd6d9dc, 0.3, 0.5);

export const COLORES_PILOTO = { Rojo: 0xff0a0a, Verde: 0x00ff3c, Amarillo: 0xffd200, Azul: 0x1e64ff, Blanco: 0xffffff };   // colores puros y saturados
const USO_COLOR = { Fase: 0xb8bcc2, Neutro: 0x2f6fe0, Tierra: 0x3f9d4a };

/** Tamaño de la huella de cada componente sobre el riel (m). */
export function sizeOf(c) {
  switch (c.type) {
    case 'breaker': return { w: c.poles * P * (c.mod || 1) + (c.aux ? 0.009 : 0), h: 0.12 };
    case 'bornera': return { w: 0.014, h: 0.075 };
    case 'barra': return { w: c.n * 0.022 + 0.024, h: 0.05 };
    case 'selector': return { w: c.poles * 0.045 + 0.025, h: 0.13 };
    case 'medidor': return { w: 0.14, h: 0.16 };
    case 'ups': return { w: 0.2, h: 0.12 };
    case 'lampara': return { w: 0.09, h: 0.16 };
    default: return { w: 0.04, h: 0.1 };                  // piloto
  }
}

/** Texto en un plano de w x h metros; el tamaño de la letra se ajusta para que quepa. */
function txt(text, w, h, fg = '#ffffff', bg = null) {
  const px = 320, py = Math.max(24, Math.round(px * h / w));
  const lines = String(text).split('\n');
  const len = Math.max(...lines.map(s => s.length), 1);
  const size = Math.max(10, Math.min(py * 0.8 / lines.length, px * 0.92 / (len * 0.58)));
  return labelPlane(String(text), w, h, { w: px, h: py, size, color: fg, bg });
}

/** Placa negra con el nombre, pegada al tablero sobre el componente. */
function plate(g, text, w, y) {
  if (g.userData.sinPlaca) return;                       // en el rack los nombres van en las cubiertas
  const p = txt(text, Math.max(w, 0.02), 0.018, '#ffffff', '#101113');
  p.position.set(0, y, 0.0005); g.add(p);
}

/** Agrega un borne. `scr` = posición del tornillo (y de la esfera de clic), `att` = punto donde entra el cable y `dir` la
 *  dirección por la que sale. tipo 'virola' (cable con punta tubular aislada) u 'ojal' (terminal de ojo bajo el tornillo);
 *  eje 'y' dibuja el tornillo mirando hacia arriba/abajo (tornillos traseros de la llave). */
const screwGeoY = new THREE.CylinderGeometry(0.0055, 0.0055, 0.006, 14);
function addTerm(c, g, key, label, scr, att, dir, { tipo = 'virola', eje = 'z' } = {}) {
  const [x, y, z] = scr, dy = dir[1] || 0;
  const s = new THREE.Mesh(eje === 'y' ? screwGeoY : screwGeo, screwMat);
  s.position.set(x, eje === 'y' ? y + dy * 0.003 : y, eje === 'y' ? z : z + 0.003); g.add(s);
  if (eje === 'y') box(0.008, 0.0012, 0.0012, M.dark, x, y + dy * 0.0062, z, g); else box(0.008, 0.0012, 0.0012, M.dark, x, y, z + 0.0066, g);
  const h = new THREE.Mesh(hitGeo, hitMat);
  h.position.set(x, eje === 'y' ? y + dy * 0.007 : y, eje === 'y' ? z : z + 0.006); h.userData.term = `${c.id}|${key}`; g.add(h);
  g.userData.terms.push({ key, label, pos: new THREE.Vector3(...att), dir: new THREE.Vector3(...dir), mesh: s, tipo });
}

function mkBreaker(c, G, prevAng) {
  const aw = c.aux ? 0.009 : 0;                                   // contacto auxiliar: medio módulo a la derecha
  const g = new THREE.Group(); g.userData = { terms: [], sinPlaca: G.userData.sinPlaca }; g.position.x = -aw / 2; G.add(g);
  const n = c.poles, PP = P * (c.mod || 1), w = n * PP, h = 0.12, d = 0.07, ty = 0.048;
  const gris = std(0xdfe2e5, 0.1, 0.5), azul = c.verde ? std(0x1fa84a, 0.3, 0.35) : std(0x2f6fe0, 0.3, 0.35);
  box(w - 0.001, h, d, M.white, 0, 0, d / 2, g);
  for (const s of [1, -1]) {
    box(w - 0.004, 0.026, 0.006, gris, 0, s * ty, d + 0.001, g);                              // zonas de bornes
    for (let i = 0; i < n; i++) box(0.016, 0.016, 0.002, darkGrey, -w / 2 + PP / 2 + i * PP, s * ty, d + 0.0035, g);   // boca del tornillo
  }
  box(w - 0.008, 0.048, 0.004, gris, 0, -0.008, d + 0.002, g);                                // alojamiento de la palanca
  // palanca azul que gira en vertical sobre un eje horizontal: brazo corto y punta ancha, para ver bien la posición
  // (arriba = encendido, abajo = apagado); en 1 polo es más angosta y va corrida a la izquierda, como el modelo de referencia
  const m1 = c.mod || 1, lw = n === 1 ? (c.verde ? 0.034 : 0.017 + (m1 - 1) * 0.010) : w - 0.012, lx = n === 1 ? (c.verde ? 0.0033 : -0.0035 * m1) : 0;   // la palanca verde del auxiliar va corrida a la derecha para tocar a la azul del CB7
  const pivote = new THREE.Group(); pivote.position.set(lx, -0.008, d + 0.006);
  const ang = c.on ? -0.6 : 0.6;
  pivote.rotation.x = prevAng ?? ang;
  g.userData.pivote = pivote; g.userData.ang = ang;
  const eje = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, lw - 0.004, 16).rotateZ(Math.PI / 2), (c.verde ? std(0x137a33, 0.3, 0.4) : std(0x1b4fb0, 0.3, 0.4))); pivote.add(eje);
  box(0.008, 0.007, 0.022, azul, 0, 0, 0.011, pivote);                                          // brazo
  const sh = new THREE.Shape(); roundedRect(sh, lw / 2, 0.0065, 0.0035);
  const punta = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0012, bevelSegments: 3 }), azul);
  punta.position.set(0, 0, 0.019); punta.castShadow = true; pivote.add(punta);                    // punta ancha
  box(lw - 0.006, 0.0014, 0.0014, std(0x8db4f7, 0.3, 0.3), 0, 0.0035, 0.0275, pivote);          // brillo del borde
  for (const [t, y] of [['I', 0.011], ['O', -0.027]]) { const m = txt(t, 0.006, 0.006, '#3a3f45'); m.position.set(w / 2 - 0.0065, y, d + 0.0045); g.add(m); }
  g.add(pivote);
  const r = txt(c.verde ? 'AUX\nCB7' : `${c.amp}\n230V~ 6kA`, w - 0.006, 0.018, '#3a3f45'); r.position.set(0, 0.028, d + 0.0005); g.add(r);
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + PP / 2 + i * PP;
    addTerm(c, g, `${2 * i + 1}`, `${2 * i + 1}`, [x, ty, d + 0.004], [x, h / 2 - 0.002, d - 0.012], [0, 1, 0]);      // el cable entra por el extremo vertical
    addTerm(c, g, `${2 * i + 2}`, `${2 * i + 2}`, [x, -ty, d + 0.004], [x, -h / 2 + 0.002, d - 0.012], [0, -1, 0]);
  }
  plate(g, c.name, w, h / 2 + 0.016);
  if (c.aux) {                                                     // contacto auxiliar 13-14: cierra cuando el automático está cerrado (indica su estado a un piloto)
    const ax = w / 2 + aw / 2;
    box(aw - 0.001, h, d, std(0xc9ced4, 0.1, 0.55), ax, 0, d / 2, g);
    box(aw - 0.003, 0.026, 0.006, std(0x9fa4aa, 0.1, 0.55), ax, ty, d + 0.001, g);
    box(aw - 0.003, 0.026, 0.006, std(0x9fa4aa, 0.1, 0.55), ax, -ty, d + 0.001, g);
    addTerm(c, g, '13', '13', [ax, ty, d + 0.004], [ax, h / 2 - 0.002, d - 0.012], [0, 1, 0]);
    addTerm(c, g, '14', '14', [ax, -ty, d + 0.004], [ax, -h / 2 + 0.002, d - 0.012], [0, -1, 0]);
    const t = txt('AUX', aw - 0.002, 0.008, '#3a3f45'); t.position.set(ax, 0.0, d + 0.0005); g.add(t);
  }
  for (const t of g.userData.terms) { t.pos.x += g.position.x; G.userData.terms.push(t); }   // los bornes quedan referidos al centro de todo el conjunto
  G.userData.pivote = g.userData.pivote; G.userData.ang = g.userData.ang;
}

function mkBornera(c, g) {
  const w = 0.014, h = 0.075, d = 0.045;
  if (c.tipo === 'Tierra') {
    box(w, h, d, std(0x1e9a3e, 0.2, 0.5), 0, 0, d / 2, g);
    for (const y of [-0.025, 0, 0.025]) box(w + 0.0004, 0.014, d + 0.0004, std(0xf2c200, 0.2, 0.5), 0, y, d / 2, g);
  } else box(w, h, d, std(c.tipo === 'Neutro' ? 0x2f6fe0 : 0xb8bcc2, 0.2, 0.5), 0, 0, d / 2, g);
  addTerm(c, g, '1', '1', [0, 0.027, d], [0, h / 2 - 0.002, d - 0.010], [0, 1, 0]);
  addTerm(c, g, '2', '2', [0, -0.027, d], [0, -h / 2 + 0.002, d - 0.010], [0, -1, 0]);
  plate(g, c.name, w, h / 2 + 0.014);
}

function mkBarra(c, g) {
  const n = c.n, w = n * 0.022 + 0.024, ins = std(USO_COLOR[c.uso] || 0xb8bcc2, 0.2, 0.5);
  for (const s of [-1, 1]) box(0.014, 0.036, 0.03, ins, s * (w / 2 - 0.012), 0, 0.015, g);
  box(w - 0.012, 0.022, 0.012, copper, 0, 0, 0.036, g);
  for (let i = 0; i < n; i++) { const x = (i - (n - 1) / 2) * 0.022; addTerm(c, g, `${i + 1}`, `${i + 1}`, [x, 0, 0.042], [x, 0, 0.042], [0, -1, 0], { tipo: 'ojal' }); }
  plate(g, `${c.name} · ${c.uso}`, w, 0.025 + 0.018);
}

function mkSelector(c, g) {
  const p = c.poles, w = p * 0.045 + 0.025, h = 0.13, d = 0.05, ty = 0.052;
  box(w, h, d, std(0x3a3d42, 0.4, 0.5), 0, 0, d / 2, g);
  box(w - 0.008, h - 0.01, 0.004, lightPlate, 0, 0, d + 0.002, g);
  const zf = d + 0.004;
  const knob = new THREE.Group(); knob.position.set(0, 0, zf + 0.011);
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.022, 28).rotateX(Math.PI / 2), black); cyl.castShadow = true; knob.add(cyl);
  box(0.005, 0.021, 0.004, M.white, 0, 0.0105, 0.0112, knob);
  knob.rotation.z = c.pos === 1 ? Math.PI / 4 : c.pos === 2 ? -Math.PI / 4 : 0;
  g.add(knob); g.userData.knob = knob;
  for (const [t, x, y] of [['1', -0.026, 0.024], ['0', 0, 0.035], ['2', 0.026, 0.024]]) {
    const n = txt(t, 0.012, 0.012, '#1b1c1f'); n.position.set(x, y, zf + 0.0005); g.add(n);
  }
  for (let i = 0; i < p; i++) {
    const sw = w / p, cx = -w / 2 + (i + 0.5) * sw, pre = p > 1 ? `${i + 1}/` : '', zr = 0.015;      // tornillos en la parte trasera
    for (const [k, x, y, dir] of [['1', cx - sw / 2 + 0.012, ty, [0, 1, 0]], ['2', cx + sw / 2 - 0.012, ty, [0, 1, 0]], ['C', cx, -ty, [0, -1, 0]]]) {
      addTerm(c, g, `${pre}${k}`, `${pre}${k}`, [x, dir[1] * h / 2, zr], [x, dir[1] * (h / 2 - 0.002), zr], dir, { eje: 'y' });
      const n = txt(k, 0.009, 0.009, '#1b1c1f'); n.position.set(x, y - Math.sign(y) * 0.012, zf + 0.0005); g.add(n);
    }
  }
  plate(g, c.name, w, h / 2 + 0.014);
}

let _halo = null;
/** Textura de resplandor: un círculo que se desvanece hacia los bordes. */
function haloTex() {
  if (_halo) return _halo;
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const x = cv.getContext('2d'), gr = x.createRadialGradient(64, 64, 4, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  _halo = new THREE.CanvasTexture(cv); _halo.colorSpace = THREE.SRGBColorSpace; return _halo;
}

function mkPiloto(c, g) {
  const w = 0.04, h = 0.1, d = 0.04, col = COLORES_PILOTO[c.color] || 0x22e05a;
  box(w, h, d, darkGrey, 0, 0, d / 2, g);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.0185, 0.0185, 0.01, 28).rotateX(Math.PI / 2), std(0xa7adb4, 0.8, 0.3));
  ring.position.set(0, 0.022, d + 0.005); g.add(ring);
  // encendido: color puro muy brillante (sin que el tono lo desvanezca) y un halo de luz; apagado: el mismo color, pero oscuro y opaco
  const litMat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 4, roughness: 0.25, metalness: 0, toneMapped: false });
  const offMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(col).multiplyScalar(0.16), emissive: 0x000000, roughness: 0.55, metalness: 0 });
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.0145, 0.0145, 0.012, 28).rotateX(Math.PI / 2), offMat);
  lens.position.set(0, 0.022, d + 0.012); g.add(lens);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: col, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }));
  halo.scale.set(0.11, 0.11, 1); halo.position.set(0, 0.022, d + 0.026); g.add(halo);
  g.userData.setLit = on => { lens.material = on ? litMat : offMat; halo.visible = on; };
  g.userData.setLit(!!(c._lit ?? c.on));
  addTerm(c, g, 'X1', 'X1', [-0.0105, -0.034, d], [-0.0105, -h / 2 + 0.002, d - 0.012], [0, -1, 0]);
  addTerm(c, g, 'X2', 'X2', [0.0105, -0.034, d], [0.0105, -h / 2 + 0.002, d - 0.012], [0, -1, 0]);
  plate(g, c.name, w, h / 2 + 0.014);
}

/** Medidor domiciliario monofásico: la red llega a los bornes 1 (fase) y 3 (neutro); salen por 2 (fase) y 4 (neutro). */
function mkMedidor(c, g) {
  const w = 0.14, h = 0.16, d = 0.075;
  box(w, h, d, std(0xe3e6e8, 0.1, 0.45), 0, 0, d / 2, g);
  box(w - 0.016, 0.07, 0.004, std(0x1a1d22, 0.4, 0.2), 0, 0.035, d + 0.002, g);                          // ventana
  const lcd = txt('kWh\n012345.6', w - 0.04, 0.04, '#9fe8a8', '#0d2b14'); lcd.position.set(0, 0.04, d + 0.0045); g.add(lcd);
  const rot = txt('MEDIDOR MONOFÁSICO · 230 V · 5(60) A\nACOMETIDA: 1 y 3 · CARGA: 2 y 4', w - 0.016, 0.03, '#2a2f35'); rot.position.set(0, -0.02, d + 0.0005); g.add(rot);
  box(w - 0.012, 0.038, 0.012, std(0x9a9ea3, 0.2, 0.55), 0, -h / 2 + 0.022, d + 0.006 - 0.006, g);       // tapa de bornes
  [-0.045, -0.015, 0.015, 0.045].forEach((x, i) => {
    const k = `${i + 1}`;
    addTerm(c, g, k, k, [x, -0.058, d + 0.006], [x, -h / 2 + 0.002, d - 0.015], [0, -1, 0]);
    const n = txt(k, 0.008, 0.008, '#1b1c1f'); n.position.set(x, -0.0455, d + 0.0065); g.add(n);
  });
  plate(g, c.name, w, h / 2 + 0.016);
}

/** Módulo UPS: entrada (L, N) y salida (L, N) más tierra, en la cara superior. */
function mkUps(c, g) {
  const w = 0.2, h = 0.12, d = 0.1;
  box(w, h, d, M.module, 0, 0, d / 2, g);
  box(w - 0.01, h - 0.01, 0.004, M.face, 0, 0, d + 0.002, g);
  const t = txt('UPS 10 kVA\nINVERSOR · BYPASS', w - 0.05, 0.04, '#e8eef4'); t.position.set(0, 0.0, d + 0.0045); g.add(t);
  const bt = txt(`BATERÍAS: ${c.bat ?? 2} banco(s)`, 0.09, 0.012, '#9fb4c8'); bt.position.set(0, -0.025, d + 0.0045); g.add(bt);
  for (const [x, col] of [[-0.07, 0x22e05a], [-0.055, 0x22e05a], [0.055, 0xffc400]]) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.003, 12).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.2 }));
    l.position.set(x, -0.04, d + 0.0045); g.add(l);
  }
  [['ENT-L', -0.07, 'IN L'], ['ENT-N', -0.035, 'IN N'], ['PE', 0, 'PE'], ['SAL-L', 0.035, 'OUT L'], ['SAL-N', 0.07, 'OUT N']].forEach(([k, x, lab]) => {
    addTerm(c, g, k, k, [x, h / 2, 0.05], [x, h / 2 - 0.002, 0.05], [0, 1, 0], { eje: 'y' });
    const n = txt(lab, 0.026, 0.009, '#e8eef4'); n.position.set(x, h / 2 - 0.012, d + 0.0045); g.add(n);
  });
  plate(g, c.name, w, h / 2 + 0.016);
}

/** Luz de carga: portalámpara con ampolleta; se enciende cuando le llegan fase (L) y neutro (N). */
function mkLampara(c, g) {
  const w = 0.09, h = 0.16, lit = !!c._lit;
  box(0.07, 0.05, 0.05, std(0xe8e9ea, 0.1, 0.4), 0, -0.055, 0.025, g);                                     // base con los bornes
  const cuello = new THREE.Mesh(new THREE.CylinderGeometry(0.0225, 0.0225, 0.045, 24), std(0xe8e9ea, 0.1, 0.4)); cuello.position.set(0, -0.0075, 0.04); cuello.castShadow = true; g.add(cuello);
  const rosca = new THREE.Mesh(new THREE.CylinderGeometry(0.0205, 0.0205, 0.012, 24), std(0xc9ced4, 0.9, 0.3)); rosca.position.set(0, 0.021, 0.04); g.add(rosca);
  const vidrio = new THREE.Mesh(new THREE.SphereGeometry(0.042, 32, 24), lit
    ? new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffe08a, emissiveIntensity: 2.4, roughness: 0.3 })
    : new THREE.MeshPhysicalMaterial({ color: 0xe9eef2, transparent: true, opacity: 0.55, roughness: 0.15, metalness: 0, depthWrite: false }));
  vidrio.position.set(0, 0.058, 0.04); g.add(vidrio);
  const fil = new THREE.Mesh(new THREE.TorusGeometry(0.01, 0.0012, 6, 20), new THREE.MeshStandardMaterial({ color: lit ? 0xffffff : 0x3a3a3a, emissive: lit ? 0xffffff : 0x000000, emissiveIntensity: lit ? 2 : 0 }));
  fil.position.set(0, 0.055, 0.04); g.add(fil);
  if (lit) { const luz = new THREE.PointLight(0xffe2a0, 0.35, 0.6, 2); luz.position.set(0, 0.058, 0.09); g.add(luz); }
  for (const [x, k] of [[-0.015, 'L'], [0.015, 'N']]) {
    addTerm(c, g, k, k, [x, -0.05, 0.05], [x, -h / 2 + 0.002, 0.038], [0, -1, 0]);
    const n = txt(k, 0.009, 0.009, '#1b1c1f'); n.position.set(x, -0.034, 0.0505); g.add(n);
  }
  plate(g, c.name, w, h / 2 + 0.016);
}

const BUILDERS = { lampara: mkLampara, medidor: mkMedidor, ups: mkUps, breaker: mkBreaker, bornera: mkBornera, barra: mkBarra, selector: mkSelector, piloto: mkPiloto };

/** Construye el grupo 3D de un componente. userData.terms lista sus bornes. */
export function build(c, prevAng, opc = {}) {
  const g = new THREE.Group();
  g.userData = { terms: [], cid: c.id, sinPlaca: !!opc.sinPlaca };
  BUILDERS[c.type](c, g, prevAng);
  return g;
}
