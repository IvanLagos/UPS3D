/* Interfaz de los circuitos nuevos de SONACOL: selector de circuito, panel lateral, diagrama unifilar y alarmas. */
import { $ } from '../core/dom.js';
import { toast } from '../core/interaction.js';
import { armarPestanas } from '../ui/pestanas.js';
import { tween } from '../core/tween.js';
import { camera, controls } from '../core/scene.js';
import { SC, KVA, AUT_MIN, autonomia, ordenarRodeo, rodeoDe, conmutarSts } from './logica.js';
import { setPuerta, setLaterales, setTapas, estadoRack } from './escena.js';

/* ---------- diagrama unifilar (usa las clases del diagrama del circuito 3) ---------- */
const W = (id, d) => `<path id="${id}" class="w" d="${d}"/>`;
const B = (n, q, x, y, txt, izq = false) => `<g class="brk" data-c="${n}" data-q="${q}" transform="translate(${x},${y})"><rect x="-9" y="-9" width="18" height="18" rx="3"/><line x1="0" y1="-5" x2="0" y2="5"/></g><text class="l" x="${izq ? x - 13 : x + 13}" y="${y + 3}"${izq ? ' text-anchor="end"' : ''}>${txt}</text>`;
const N = (id, x, y, w, h, txt) => `<rect id="${id}" class="node" x="${x}" y="${y}" width="${w}" height="${h}" rx="4"/><text id="${id}_t" class="t" x="${x + w / 2}" y="${y + h / 2 + 3}">${txt}</text>`;
const X = (id, x1, y1, x2, y2) => `<g id="${id}" class="xmark"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><line x1="${x2}" y1="${y1}" x2="${x1}" y2="${y2}"/></g>`;
/** UPS como la del circuito 3 (rectificador, inversor, bypass estático) pero con 1 solo banco de baterías. cx: eje, T: borde superior del bloque. */
const UPS = (p, cx, T, titulo) => `<rect id="${p}_blk" class="blk" x="${cx - 70}" y="${T}" width="140" height="136" rx="6"/><text class="l" x="${cx - 64}" y="${T + 12}">${titulo}</text>`
  + W(`${p}_w_b`, `M${cx} ${T - 5}V${T + 28}`) + W(`${p}_w_bb`, `M${cx} ${T + 8}H${cx + 49}V${T + 28}`)
  + W(`${p}_w_r`, `M${cx} ${T + 48}V${T + 64}`) + W(`${p}_w_t`, `M${cx} ${T + 64}H${cx - 48}`) + W(`${p}_w_t1`, `M${cx - 48} ${T + 64}V${T + 38}`)
  + W(`${p}_w_d`, `M${cx} ${T + 64}V${T + 76}`) + W(`${p}_w_o`, `M${cx} ${T + 96}V${T + 116}`) + W(`${p}_w_y`, `M${cx + 49} ${T + 46}V${T + 116}H${cx}`)
  + W(`${p}_w_q`, `M${cx} ${T + 116}V${T + 145}`)
  + `<circle id="${p}_dc" class="dot" cx="${cx}" cy="${T + 64}" r="3.5"/>`
  + N(`${p}_rect`, cx - 20, T + 28, 40, 20, 'Rect.') + N(`${p}_inv`, cx - 20, T + 76, 40, 20, 'Inv.') + N(`${p}_byp`, cx + 30, T + 28, 38, 18, 'Bypass')
  + N(`${p}_bat`, cx - 68, T + 20, 40, 18, 'Bat. 1') + `<text class="l" x="${cx - 64}" y="${T + 130}">Banco 1/1</text>` + X(`${p}_x`, cx - 70, T, cx + 70, T + 136);

const YP = 360, HS = 68, DC = 40;                              // DC: separación extra entre los automáticos de salida de los STS y las cargas                                      // puertos de entrada de los STS (borde superior) y altura de cada STS, con espacio para su conmutador A/B

const UNI1 = (() => {
  const cx = 197, rx = 350;                                  // eje principal y columna de los dos rodeos (a la misma distancia)
  return N('u1_red', cx - 70, 6, 140, 20, 'RED ELÉCTRICA') + W('u1_w_red', `M${cx} 26V41`) + B(1, 0, cx, 50, 'CB0 General de red')
    + W('u1_w_g', `M${cx} 59V107`) + B(1, 1, cx, 116, 'CB1 Entrada UPS A')
    + UPS('u1_a', cx, 130, 'UPS A · 6 kVA') + W('u1_wj', `M${cx} 275V291`) + B(1, 2, cx, 300, 'CB2 Salida UPS A')
    + W('u1_wm1', `M${cx} 309V336`) + W('u1_wm2', `M${cx} 336V363`) + B(1, 3, cx, 372, 'CB3 Entrada UPS B')
    + UPS('u1_b', cx, 386, 'UPS B · 6 kVA') + W('u1_wq2', `M${cx} 531V551`) + B(1, 4, cx, 560, 'CB4 Salida UPS B')
    + W('u1_w_bout', `M${cx} 569V640`) + N('u1_load', cx - 70, 640, 140, 20, 'CARGA') + X('u1_xload', cx - 74, 634, cx + 74, 666)
    // rodeos (bypass de mantención): los dos se conectan en M, justo en medio entre CB2 y CB3, y quedan a la misma distancia del eje
    + W('u1_ra1', `M${cx} 80H${rx}V199`) + B(1, 5, rx, 208, 'CB5 Rodeo UPS A') + `<g id="u1_aux0"><text class="l" x="${rx + 13}" y="223">Aux. adelantado</text><text class="l" x="${rx + 13}" y="234">→ UPS A</text></g>` + W('u1_ra2', `M${rx} 217V336`)
    + W('u1_hm', `M${cx} 336H${rx}`) + `<circle id="u1_M" class="dot" cx="${cx}" cy="336" r="3.5"/>`
    + W('u1_rb1', `M${rx} 336V464`) + B(1, 6, rx, 473, 'CB6 Rodeo UPS B') + `<g id="u1_aux1"><text class="l" x="${rx + 13}" y="488">Aux. adelantado</text><text class="l" x="${rx + 13}" y="499">→ UPS B</text></g>` + W('u1_rb2', `M${rx} 482V610H${cx}`);
})();

/** Conmutador del STS j: una barra que une la salida con la entrada A o con la B (px: pivote; xa, xb: contactos). Al presionarlo conmuta a la otra fuente. */
const SW = (j, px, xa, xb) => `<g class="sw" id="u2_sw${j}" data-j="${j}"><rect x="${Math.min(xa, xb) - 16}" y="${YP + 30}" width="${Math.abs(xb - xa) + 32}" height="${HS - 34}" rx="4" fill="transparent"/>`
  + `<line id="u2_sw${j}_l" class="swl" x1="${px}" y1="${YP + HS - 8}" x2="${xa}" y2="${YP + 38}"/>`
  + `<circle id="u2_sw${j}_a" class="swc" cx="${xa}" cy="${YP + 38}" r="4"/><circle id="u2_sw${j}_b" class="swc" cx="${xb}" cy="${YP + 38}" r="4"/><circle class="swp" cx="${px}" cy="${YP + HS - 8}" r="3.5"/>`
  + `<text class="l" x="${xa}" y="${YP + 50}" text-anchor="middle">A</text><text class="l" x="${xb}" y="${YP + 50}" text-anchor="middle">B</text></g>`;

const UNI2 = (() => {
  const a = 75, b = 320, d = 45;                              // d: desplazamiento hacia abajo de los STS y lo que sigue, para dejar sitio a los automáticos de entrada
  const yP = YP, hS = HS, yQ = yP - 24;                           // puertos de entrada de los STS y automáticos de entrada (CB11…CB14), justo aguas arriba de cada puerto
  return N('u2_red', 127, 6, 140, 20, 'RED ELÉCTRICA') + W('u2_w_red', 'M197 26V35') + B(2, 0, 197, 44, 'CB0 General de red')
    + W('u2_w_g', 'M197 53V70') + W('u2_w_bus', `M${a} 70H${b}`)
    + W('u2_w_i0', `M${a} 70V77`) + B(2, 1, a, 86, 'CB1') + W('u2_w_i1', `M${b} 70V77`) + B(2, 3, b, 86, 'CB3')
    + UPS('u2_a', a, 100, 'UPS 1 · 10 kVA') + UPS('u2_b', b, 100, 'UPS 2 · 10 kVA')
    + B(2, 2, a, 254, 'CB2') + B(2, 4, b, 254, 'CB4')
    + W('u2_w_p0', `M${a} 263V277`) + W('u2_w_p1', `M${b} 263V277`)
    // de cada UPS a las dos entradas que alimenta (cada una con su automático): la propia A y la B del otro STS
    + W('u2_w_a0', `M${a} 277V${yQ - 9}`) + W('u2_w_a0b', `M${a} ${yQ + 9}V${yP}`) + B(2, 11, a, yQ, 'CB11')
    + W('u2_w_x0', `M${a} 291H270V${yQ - 9}`) + W('u2_w_x0b', `M270 ${yQ + 9}V${yP}`) + B(2, 14, 270, yQ, 'CB14')
    + W('u2_w_a1', `M${b} 277V${yQ - 9}`) + W('u2_w_a1b', `M${b} ${yQ + 9}V${yP}`) + B(2, 13, b, yQ, 'CB13')
    + W('u2_w_x1', `M${b} 303H145V${yQ - 9}`) + W('u2_w_x1b', `M145 ${yQ + 9}V${yP}`) + B(2, 12, 145, yQ, 'CB12')
    + `<rect id="u2_s0" class="node" x="45" y="${yP}" width="115" height="${hS}" rx="4"/><text class="t" x="102" y="${yP + 14}">STS-1</text><text id="u2_s0_t" class="t" x="102" y="${yP + 27}">—</text>` + SW(0, 110, 75, 145)
    + `<rect id="u2_s1" class="node" x="255" y="${yP}" width="110" height="${hS}" rx="4"/><text class="t" x="310" y="${yP + 14}">STS-2</text><text id="u2_s1_t" class="t" x="310" y="${yP + 27}">—</text>` + SW(1, 295, 320, 270)
    + `<circle id="u2_pa0" class="dot" cx="${a}" cy="${yP}" r="4"/><circle id="u2_pb0" class="dot" cx="145" cy="${yP}" r="4"/><circle id="u2_pa1" class="dot" cx="${b}" cy="${yP}" r="4"/><circle id="u2_pb1" class="dot" cx="270" cy="${yP}" r="4"/>`
    + `<text class="l" x="80" y="${yP - 4}">A</text><text class="l" x="150" y="${yP - 4}">B</text><text class="l" x="325" y="${yP - 4}">A</text><text class="l" x="274" y="${yP - 4}">B</text>`
    + W('u2_w_s0', `M102 ${yP + hS}V${yP + hS + 6}`) + W('u2_w_s1', `M310 ${yP + hS}V${yP + hS + 6}`) + B(2, 5, 102, yP + hS + 15, 'CB5') + B(2, 6, 310, yP + hS + 15, 'CB6')
    + W('u2_w_l0', `M102 ${yP + hS + 24}V${yP + hS + 34 + DC}`) + W('u2_w_l1', `M310 ${yP + hS + 24}V${yP + hS + 34 + DC}`)
    // bypass de cada STS: de la salida de su UPS (aguas abajo de CB2 / CB4) directo a la carga
    + W('u2_by0a', `M${a} 270H18V${yP + 36}`) + B(2, 7, 18, yP + 45, 'CB7 Bypass STS-1', true) + W('u2_by0b', `M18 ${yP + 54}V${yP + hS + 24 + DC}H102`)
    + W('u2_by1a', `M${b} 270H380V${yP + 36}`) + B(2, 8, 380, yP + 45, 'CB8 Bypass STS-2') + W('u2_by1b', `M380 ${yP + 54}V${yP + hS + 24 + DC}H310`)
    // rodeo de cada UPS (bypass de mantención): de la red, antes de la entrada de la UPS, a su salida aguas abajo de CB2 / CB4; con su contacto auxiliar adelantado
    + W('u2_rd0a', `M${a} 70H-30V159`) + B(2, 9, -30, 168, 'CB9 Rodeo UPS 1', true) + `<g id="u2_aux0"><text class="l" x="-43" y="183" text-anchor="end">Aux. adelantado</text><text class="l" x="-43" y="194" text-anchor="end">→ UPS 1</text></g>` + W('u2_rd0b', `M-30 177V270H${a}`)
    + W('u2_rd1a', `M${b} 70H425V159`) + B(2, 10, 425, 168, 'CB10 Rodeo UPS 2') + `<g id="u2_aux1"><text class="l" x="438" y="183">Aux. adelantado</text><text class="l" x="438" y="194">→ UPS 2</text></g>` + W('u2_rd1b', `M425 177V270H${b}`)
    + N('u2_l0', 27, yP + hS + 34 + DC, 150, 20, 'CARGA 1') + N('u2_l1', 235, yP + hS + 34 + DC, 150, 20, 'CARGA 2')
    + X('u2_xl0', 23, yP + hS + 30 + DC, 181, yP + hS + 58 + DC) + X('u2_xl1', 231, yP + hS + 30 + DC, 389, yP + hS + 58 + DC);
})();

const svgSet = (id, on, cls = '') => {
  const el = $('#' + id); if (!el) return;
  el.classList.toggle('live', !!on);
  for (const c of ['byp', 'bat', 'rev']) el.classList.toggle(c, !!on && c === cls);
};
const clsModo = m => (m === 'bateria' ? 'bat' : m === 'bypass' ? 'byp' : '');
const nodo = (id, on, warn) => { const el = $('#' + id); if (!el) return; el.classList.toggle('on', !!on && !warn); el.classList.toggle('warn', !!on && !!warn); };
const texto = (id, t) => { const el = $('#' + id); if (el) el.textContent = t; };

/** Estado de una UPS en el diagrama: rectificador, inversor, bypass, banco de baterías y sus cables (como en el circuito 3). */
function unifilarUps(p, x, soc) {
  const falla = x.mode === 'falla', rect = x.inV && !falla, bat = soc > 0 && !falla;
  const norm = x.mode === 'normal' || x.mode === 'bateria', byp = x.mode === 'bypass';
  const carga = rect && soc < 100, desc = x.mode === 'bateria', flujo = carga || desc;
  svgSet(`${p}_w_b`, x.inV, 'byp'); svgSet(`${p}_w_bb`, x.inV && !falla, 'byp');
  svgSet(`${p}_w_r`, rect); $(`#${p}_dc`).classList.toggle('live', rect || bat);
  svgSet(`${p}_w_t`, flujo, desc ? 'rev' : 'bat'); svgSet(`${p}_w_t1`, flujo, desc ? 'rev' : 'bat');
  svgSet(`${p}_w_d`, norm); svgSet(`${p}_w_o`, norm); svgSet(`${p}_w_y`, byp, 'byp');
  svgSet(`${p}_w_q`, x.vivo, byp ? 'byp' : '');
  nodo(`${p}_rect`, rect); nodo(`${p}_inv`, norm); nodo(`${p}_byp`, byp, true);
  const b = $(`#${p}_bat`); b.classList.toggle('on', flujo); b.classList.toggle('fault', falla); texto(`${p}_bat_t`, `Bat. ${Math.round(soc)}%`);
  $(`#${p}_blk`).classList.toggle('fault', falla);
  $(`#${p}_x`).classList.toggle('show', falla);
}

function unifilar1(r) {
  const [A, B] = r.u, w = r.w, Q = SC.c1.Q;
  nodo('u1_red', SC.mains, true);
  svgSet('u1_w_red', w.red, 'byp'); svgSet('u1_w_g', w.g, 'byp');
  unifilarUps('u1_a', A, SC.c1.soc[0]); unifilarUps('u1_b', B, SC.c1.soc[1]);
  svgSet('u1_wj', A.vivo, clsModo(A.mode)); svgSet('u1_wm1', w.am, clsModo(A.mode));                                   // salida de la UPS A hacia M
  const colM = w.am ? clsModo(A.mode) : 'byp';                                                                       // M viene de la UPS A o directo de la red
  svgSet('u1_wm2', w.mid, colM); svgSet('u1_hm', w.mid, colM); $('#u1_M').classList.toggle('live', !!w.mid);
  svgSet('u1_wq2', B.vivo, clsModo(B.mode)); svgSet('u1_w_bout', w.bout, w.soloRodeo ? 'byp' : clsModo(B.mode));
  svgSet('u1_ra1', w.g, 'byp'); svgSet('u1_ra2', w.ra2, 'byp'); svgSet('u1_rb1', w.mid, colM); svgSet('u1_rb2', w.rb2, 'byp');
  nodo('u1_load', r.out, B.mode === 'bypass'); texto('u1_load_t', `CARGA ${r.carga.toFixed(1)} kVA · ${Math.round(r.pct)} %`);
  $('#u1_load').classList.toggle('fault', r.out && r.pct > 100);
  $('#u1_xload').classList.toggle('show', !r.out);
  $('#u1_aux0').classList.toggle('on', SC.c1.auxSig[0]); $('#u1_aux1').classList.toggle('on', SC.c1.auxSig[1]);
  marcarAutomaticos('c1', Q.map((q, i) => (i >= 5 && SC.c1.auxSig[i - 5] ? SC.c1.cmd[i - 5] : q)));
}

function unifilar2(r) {
  const [U1, U2] = r.u, w = r.w, Q = SC.c2.Q;
  nodo('u2_red', SC.mains, true);
  svgSet('u2_w_red', w.red, 'byp'); svgSet('u2_w_g', w.g, 'byp'); svgSet('u2_w_bus', w.g, 'byp');
  svgSet('u2_w_i0', w.g, 'byp'); svgSet('u2_w_i1', w.g, 'byp');
  unifilarUps('u2_a', U1, SC.c2.soc[0]); unifilarUps('u2_b', U2, SC.c2.soc[1]);
  const c0 = w.rs0 ? 'byp' : clsModo(U1.mode), c1 = w.rs1 ? 'byp' : clsModo(U2.mode);                   // la salida viene de la UPS o, si solo la alimenta el rodeo, directo de la red
  svgSet('u2_w_p0', w.x0, c0); svgSet('u2_w_p1', w.x1, c1);
  svgSet('u2_w_a0', w.x0, c0); svgSet('u2_w_x0', w.x0, c0);
  svgSet('u2_w_a1', w.x1, c1); svgSet('u2_w_x1', w.x1, c1);
  svgSet('u2_w_a0b', w.x0 && Q[11], c0); svgSet('u2_w_x1b', w.x1 && Q[12], c1); svgSet('u2_w_a1b', w.x1 && Q[13], c1); svgSet('u2_w_x0b', w.x0 && Q[14], c0);   // después de cada automático de entrada
  svgSet('u2_rd0a', w.g, 'byp'); svgSet('u2_rd0b', w.rd0, 'byp'); svgSet('u2_rd1a', w.g, 'byp'); svgSet('u2_rd1b', w.rd1, 'byp');
  $('#u2_aux0').classList.toggle('on', SC.c2.auxSig[0]); $('#u2_aux1').classList.toggle('on', SC.c2.auxSig[1]);
  r.sts.forEach((t, j) => {
    nodo(`u2_s${j}`, t.out, t.sel === 'B'); $(`#u2_s${j}`).classList.toggle('fault', t.falla); texto(`u2_s${j}_t`, t.falla ? 'FALLA' : t.sel ? `Fuente ${t.sel}${t.pref !== t.sel ? ' (respaldo)' : ''}` : 'Sin fuente');
    {                                                                                // la barra del conmutador apunta a la fuente en uso
      const [xa, xb, px] = j === 0 ? [75, 145, 110] : [320, 270, 295], l = $(`#u2_sw${j}_l`);
      const x2 = t.sel === 'A' ? xa : t.sel === 'B' ? xb : px, y2 = t.sel ? YP + 38 : YP + 46;
      l.setAttribute('x2', x2); l.setAttribute('y2', y2);
      l.classList.toggle('on', t.sel === 'A' && t.out); l.classList.toggle('byp', t.sel === 'B' && t.out);
      $(`#u2_sw${j}_a`).classList.toggle('live', t.a); $(`#u2_sw${j}_b`).classList.toggle('live', t.b);
      $(`#c2_ps${j}A`).classList.toggle('on', t.sel === 'A'); $(`#c2_ps${j}B`).classList.toggle('on', t.sel === 'B'); $(`#c2_fs${j}`).textContent = t.falla ? 'Falla' : t.sel ? `Fuente ${t.sel}${t.pref !== t.sel ? ' (por respaldo)' : ''}` : 'Sin fuente'; $(`#c2_fst${j}`).textContent = t.falla ? `STS-${j + 1} en falla · restablecer` : `Falla STS-${j + 1}`; $(`#c2_fst${j}`).classList.toggle('bad', t.falla);
    }
    $(`#u2_pa${j}`).classList.toggle('live', t.sel === 'A'); $(`#u2_pb${j}`).classList.toggle('live', t.sel === 'B');
    svgSet(`u2_w_s${j}`, t.out, t.sel === 'B' ? 'byp' : ''); svgSet(`u2_w_l${j}`, t.on, t.byp ? (j ? c1 : c0) : t.sel === 'B' ? 'byp' : '');
    svgSet(`u2_by${j}a`, t.byp, j ? c1 : c0); svgSet(`u2_by${j}b`, t.byp, j ? c1 : c0);   // los dos tramos del bypass solo se encienden cuando pasa voltaje por él (bypass cerrado)
    nodo(`u2_l${j}`, t.on, t.pct > 100); texto(`u2_l${j}_t`, `CARGA ${j + 1} · ${t.carga.toFixed(1)} kVA · ${Math.round(t.pct)} %`);
    $(`#u2_l${j}`).classList.toggle('fault', t.on && t.pct > 100);
    $(`#u2_xl${j}`).classList.toggle('show', !t.on);
  });
  marcarAutomaticos('c2', Q.map((q, i) => (i >= 9 && SC.c2.auxSig[i - 9] ? SC.c2.cmd[i - 9] : q)));
}

function marcarAutomaticos(c, Q) {
  document.querySelectorAll(`#sonUni .brk[data-c="${c[1]}"]`).forEach(g => {
    const closed = Q[+g.dataset.q], l = g.querySelector('line');
    g.classList.toggle('closed', closed);
    l.setAttribute('x1', closed ? 0 : -4); l.setAttribute('x2', closed ? 0 : 4);
    l.setAttribute('y1', closed ? -5 : 5); l.setAttribute('y2', closed ? 5 : -5);
  });
}

/* ---------- panel lateral ---------- */
const NOMBRES = {
  1: ['CB0 · General de red', 'CB1 · Entrada UPS A', 'CB2 · Salida UPS A', 'CB3 · Entrada UPS B', 'CB4 · Salida UPS B', 'CB5 · Rodeo UPS A (red → punto entre CB2 y CB3)', 'CB6 · Rodeo UPS B (punto entre CB2 y CB3 → carga)'],
  2: ['CB0 · General de red', 'CB1 · Entrada UPS 1', 'CB2 · Salida UPS 1', 'CB3 · Entrada UPS 2', 'CB4 · Salida UPS 2', 'CB5 · Salida STS-1 (Carga 1)', 'CB6 · Salida STS-2 (Carga 2)', 'CB7 · Bypass STS-1 (UPS 1 → Carga 1)', 'CB8 · Bypass STS-2 (UPS 2 → Carga 2)', 'CB9 · Rodeo UPS 1 (red → salida UPS 1)', 'CB10 · Rodeo UPS 2 (red → salida UPS 2)', 'CB11 · Entrada A del STS-1', 'CB12 · Entrada B del STS-1', 'CB13 · Entrada A del STS-2', 'CB14 · Entrada B del STS-2'],
};

const slider = (id, rot, max, val) => `<div style="margin-top:8px"><div class="row" style="justify-content:space-between"><span>${rot}</span><b id="${id}_v">${val.toFixed(1)} kVA</b></div><input type="range" id="${id}" min="0" max="${max}" step="0.1" value="${val}"></div>`;
const filas = n => NOMBRES[n].map((t, i) => `<label class="sw"><span>${t}<small id="s${n}_q${i}"></small></span><input type="checkbox" id="c${n}_q${i}" checked></label>`).join('');
const metricas = n => `<div class="metrics"><div class="metric"><span>Modo</span><b id="m${n}_modo">—</b></div><div class="metric"><span>Capacidad</span><b id="m${n}_cap">—</b></div><div class="metric"><span>Batería</span><b id="m${n}_soc">—</b></div><div class="metric"><span>Autonomía</span><b id="m${n}_aut">—</b></div></div><ul class="alarmas" id="al${n}"></ul>`;

const rackSec = n => `<section><h2>Rack y cámara</h2>
      <label class="sw"><span>Puerta frontal cerrada</span><input type="checkbox" id="c${n}_front" checked></label>
      <label class="sw"><span>Puerta trasera cerrada</span><input type="checkbox" id="c${n}_rear" checked></label>
      <label class="sw"><span>Laterales cerrados</span><input type="checkbox" id="c${n}_sides" checked></label>
      <label class="sw"><span>Cubiertas del tablero cerradas<small>Para abrirlas, abra antes la puerta frontal</small></span><input type="checkbox" id="c${n}_cover" checked></label>
      <div class="row" style="margin-top:8px"><button class="sm" data-camn="front">Frente</button><button class="sm" data-camn="iso">Interior</button><button class="sm" data-camn="side">Lateral</button><button class="sm" data-camn="top">Superior</button></div>
      <p class="note" style="margin:6px 0 0">Abra la puerta frontal para abrir las cubiertas; los automáticos asoman por sus ranuras.</p>
    </section>`;
const CAMS2 = { front: [[0.95, 1.2, 5.3], [0.95, 0.9, 0]], iso: [[3.2, 1.8, 4.2], [0.95, 0.9, 0.2]], side: [[5.5, 1.4, 0.3], [0.95, 0.9, 0]], top: [[1.0, 6.2, 2.6], [0.95, 0.9, 0]] };   // el circuito 2 tiene dos cargas a la derecha
const CAMS = { front: [[0, 1.15, 3.4], [0, 1.0, 0]], iso: [[1.5, 1.45, 2.1], [0, 1.0, 0.2]], side: [[3.6, 1.3, 0.3], [0, 1.0, 0]], top: [[0.4, 4.4, 2.2], [0, 0.9, 0]] };

const comandos = n => `<section><h2>Comandos de las UPS</h2>
      ${[0, 1].map(u => `<div class="cmd"><span class="note">UPS ${n === 1 ? 'AB'[u] : u + 1} · modo actual: <b id="c${n}_modo${u}">—</b></span><div class="row"><button class="sm" id="c${n}_inv${u}">Inversor</button><button class="sm" id="c${n}_byp${u}">Bypass estático</button></div></div>`).join('')}
${n === 2 ? [0, 1].map(j => `<div class="cmd"><span class="note">STS-${j + 1} · en uso: <b id="c2_fs${j}">—</b></span><div class="row"><button class="sm" id="c2_ps${j}A">Fuente A</button><button class="sm" id="c2_ps${j}B">Fuente B</button></div></div>`).join('') : ''}
      <p class="note">Las UPS no están comunicadas entre sí: cada una pasa a inversor o a bypass por separado (botones INV y BYP de su frente).${n === 2 ? ' Cada STS se puede transferir a mano a su fuente A o B presionando su barra en el diagrama unifilar o estos botones; si la fuente elegida cae, pasa solo a la otra.' : ''}</p>
    </section>`;

const PANEL = `
<div id="sonP1" hidden><div class="cols">
  <div class="col">
    <section><h2>CB</h2>${filas(1)}</section>
    <section><h2>Red y carga</h2>
      <label class="sw"><span>Red eléctrica presente<small>Apáguela para simular un corte</small></span><input type="checkbox" id="c1_mains" checked></label>
      ${slider('c1_load', 'Carga conectada (máx. 6 kVA)', 9, SC.c1.load)}
      <p class="note">Pantalla de la carga: el cono se llena de abajo hacia arriba (verde hasta 50 %, lima hasta 75 %, amarillo hasta 90 %, naranja hasta 100 %) y en sobrecarga se pone rojo parpadeante con aviso.</p>
    </section>
    ${rackSec(1)}
  </div>
  <div class="col">
    ${comandos(1)}
    <section><h2>Simular fallas</h2><div class="cmd"><span class="note">UPS</span><div class="row"><button class="sm" id="c1_f0">Falla UPS A</button><button class="sm" id="c1_f1">Falla UPS B</button></div></div></section>
    <section><h2>Estado</h2>${metricas(1)}<p class="note">Las UPS están en serie: la UPS A alimenta a la UPS B. Simulación acelerada: 1 s real = 1 min.</p></section>
  </div>
</div></div>
<div id="sonP2" hidden><div class="cols">
  <div class="col">
    <section><h2>CB</h2>${filas(2)}</section>
    <section><h2>Red y cargas</h2>
      <label class="sw"><span>Red eléctrica presente<small>Apáguela para simular un corte</small></span><input type="checkbox" id="c2_mains" checked></label>
      ${slider('c2_l0', 'Carga 1 (STS-1)', 15, SC.c2.load[0])}${slider('c2_l1', 'Carga 2 (STS-2)', 15, SC.c2.load[1])}
      <p class="note">Entre las dos cargas no deben superar 10 kVA: si una UPS falla, la otra tiene que sostener ambas.</p>
      <p class="note">Pantalla de la carga: el cono se llena de abajo hacia arriba (verde hasta 50 %, lima hasta 75 %, amarillo hasta 90 %, naranja hasta 100 %) y en sobrecarga se pone rojo parpadeante con aviso.</p>
    </section>
    ${rackSec(2)}
  </div>
  <div class="col">
    ${comandos(2)}
    <section><h2>Simular fallas</h2><div class="cmd"><span class="note">UPS</span><div class="row"><button class="sm" id="c2_f0">Falla UPS 1</button><button class="sm" id="c2_f1">Falla UPS 2</button></div></div><div class="cmd"><span class="note">STS</span><div class="row"><button class="sm" id="c2_fst0">Falla STS-1</button><button class="sm" id="c2_fst1">Falla STS-2</button></div></div></section>
    <section><h2>Estado</h2>${metricas(2)}<p class="note">Cada STS prefiere su fuente A y pasa a la B si la A se pierde. Simulación acelerada: 1 s real = 1 min.</p></section>
  </div>
</div></div>`;

/** Arma el panel, el unifilar y los controles; `alCambiar` se llama cuando el usuario cambia algo. */
export function iniciarUi(alCambiar) {
  const panel = $('#panel');
  panel.insertAdjacentHTML('beforeend', `<div id="sonPanel">${PANEL}</div>`);
  for (const n of [1, 2]) armarPestanas($(`#sonP${n} > .cols`));
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'sonUni'; svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.innerHTML = `<g id="sonU1">${UNI1}</g><g id="sonU2">${UNI2}</g>`;
  $('#uni').after(svg);

  const cambio = () => { alCambiar(); };
  for (const n of [1, 2]) {
    const s = SC['c' + n];
    NOMBRES[n].forEach((_, i) => { $(`#c${n}_q${i}`).addEventListener('change', e => { if (n === 1 && i >= 5) ordenarRodeo(n, i - 5, e.target.checked); else if (n === 2 && i >= 9) ordenarRodeo(n, i - 9, e.target.checked); else s.Q[i] = e.target.checked; cambio(); }); });
    $(`#c${n}_mains`).addEventListener('change', e => { SC.mains = e.target.checked; toast(SC.mains ? 'Red restablecida' : 'Corte de red eléctrica'); cambio(); });
    [0, 1].forEach(u => $(`#c${n}_f${u}`).addEventListener('click', () => { s.fault[u] = !s.fault[u]; cambio(); }));
    [0, 1].forEach(u => { $(`#c${n}_inv${u}`).addEventListener('click', () => { ordenarModo(n, u, false); cambio(); }); $(`#c${n}_byp${u}`).addEventListener('click', () => { ordenarModo(n, u, true); cambio(); }); });
  }
  [0, 1].forEach(j => $(`#c2_fst${j}`).addEventListener('click', () => { SC.c2.faultSts[j] = !SC.c2.faultSts[j]; toast(SC.c2.faultSts[j] ? `STS-${j + 1} en FALLA: deja de entregar (la carga ${j + 1} queda sin energía salvo por su bypass)` : `STS-${j + 1} restablecido`); cambio(); }));
  for (const n of [1, 2]) {
    $(`#c${n}_front`).addEventListener('change', e => setPuerta(n, 'front', !e.target.checked));
    $(`#c${n}_rear`).addEventListener('change', e => setPuerta(n, 'rear', !e.target.checked));
    $(`#c${n}_sides`).addEventListener('change', e => setLaterales(n, e.target.checked));
    $(`#c${n}_cover`).addEventListener('change', e => setTapas(n, !e.target.checked));
  }
  document.querySelectorAll('[data-camn]').forEach(b => b.addEventListener('click', () => {
    const [p, t] = (SC.activo === 2 ? CAMS2 : CAMS)[b.dataset.camn];
    ['x', 'y', 'z'].forEach((k, i) => { tween(camera.position, k, p[i], 1); tween(controls.target, k, t[i], 1); });
  }));
  $('#c1_load').addEventListener('input', e => { SC.c1.load = +e.target.value; cambio(); });
  [0, 1].forEach(j => $(`#c2_l${j}`).addEventListener('input', e => { SC.c2.load[j] = +e.target.value; cambio(); }));
  document.querySelectorAll('#sonUni .brk').forEach(g => g.addEventListener('click', () => alternar(+g.dataset.c, +g.dataset.q)));
  document.querySelectorAll('#sonUni .sw').forEach(g => g.addEventListener('click', () => { conmutarSts(+g.dataset.j); cambio(); }));   // la barra conmuta a la otra fuente
  [0, 1].forEach(j => ['A', 'B'].forEach(f => $(`#c2_ps${j}${f}`).addEventListener('click', () => { conmutarSts(j, f); cambio(); })));
}

/** Orden INV / BYP de una sola UPS (las UPS no están comunicadas). */
export function ordenarModo(n, u, bypass) {
  const s = SC['c' + n], nom = n === 1 ? 'AB'[u] : u + 1;
  if (s.byp[u] === bypass) return;
  s.byp[u] = bypass;
  toast(bypass ? `UPS ${nom} a bypass estático (la otra UPS no cambia)` : `UPS ${nom} a inversor (la otra UPS no cambia)`);
}

/** Abre o cierra un automático (desde el 3D, el unifilar o el panel). */
export function alternar(n, i) {
  const Q = SC['c' + n].Q;
  const k = rodeoDe(n, i);
  if (k >= 0) { ordenarRodeo(n, k, !Q[i]); return; }                      // el rodeo se maniobra con su contacto auxiliar adelantado
  Q[i] = !Q[i];
  toast(`${NOMBRES[n][i]}: ${Q[i] ? 'CERRADO' : 'ABIERTO'}`);
}

/** Muestra el panel y el diagrama del circuito `n` (1 o 2). */
export function mostrarUi(n) {
  $('#sonP1').hidden = n !== 1; $('#sonP2').hidden = n !== 2;
  $('#sonU1').style.display = n === 1 ? '' : 'none'; $('#sonU2').style.display = n === 2 ? '' : 'none';
  $('#sonUni').setAttribute('viewBox', n === 1 ? '0 0 450 690' : '-135 0 665 565');
}

/* ---------- refresco ---------- */
const alarma = (al, t, c = '') => al.push([t, c]);

function textoModo(r) {
  const vivas = r.u.filter(x => x.vivo);
  if (!vivas.length) return 'Sin salida';
  if (r.u.some(x => x.mode === 'bateria')) return 'Batería';
  if (r.u.some(x => x.mode === 'bypass')) return 'Bypass';
  return 'Normal';
}

function alarmas1(r) {
  const s = SC.c1, Q = s.Q, al = [], nom = ['A', 'B'];
  if (!SC.mains) alarma(al, 'Falla de red eléctrica', 'bad'); else if (!Q[0]) alarma(al, 'General abierto (CB0): sin tensión en las UPS', 'bad');
  if (r.gen && !Q[1]) alarma(al, 'Entrada UPS A abierta (CB1)', 'bad');
  if (!Q[2]) alarma(al, 'Salida UPS A abierta (CB2): aislada del punto de unión', 'bad');
  if (!Q[3]) alarma(al, 'Entrada UPS B abierta (CB3): aislada del punto de unión', 'bad');
  if (!Q[4]) alarma(al, 'Salida UPS B abierta (CB4): aislada de la carga', 'bad');
  if (Q[5]) alarma(al, r.gen ? 'Rodeo de la UPS A cerrado (CB5): la red alimenta directo el punto entre CB2 y CB3, por fuera de la UPS A' : 'Rodeo de la UPS A cerrado (CB5), pero no hay tensión de red', r.gen ? '' : 'bad');
  if (Q[6]) alarma(al, r.w.mid ? 'Rodeo de la UPS B cerrado (CB6): la carga cuelga directo del punto entre CB2 y CB3, por fuera de la UPS B' : 'Rodeo de la UPS B cerrado (CB6), pero no llega tensión', r.w.mid ? '' : 'bad');
  r.u.forEach((x, i) => {
    const n = nom[i];
    if (x.mode === 'falla') alarma(al, `FALLA en la UPS ${n}: fuera de servicio`, 'bad');
    if (x.mode === 'bateria') alarma(al, `UPS ${n} funcionando con baterías (${Math.round(s.soc[i])} %)${s.soc[i] < 20 ? ' · batería baja' : ''}`, s.soc[i] < 20 ? 'bad' : '');
    if (s.byp[i] && x.mode === 'bypass') alarma(al, `UPS ${n} en bypass estático (ordenado): la carga no tiene respaldo`, '');
    if (s.byp[i] && x.mode === 'apagada') alarma(al, `UPS ${n} en bypass sin tensión de entrada: no entrega a la carga`, 'bad');
    if (x.over) alarma(al, x.mode === 'bypass' ? `Sobrecarga en la UPS ${n} (${x.visto.toFixed(1)} de ${x.kva} kVA): ${s.byp[i] ? 'en bypass' : 'transferida a bypass'}` : x.mode === 'bateria' ? `Sobrecarga en la UPS ${n} (${Math.round(x.visto / x.kva * 100)} %): la sostiene con baterías; sobre el 115 % corta la carga` : `Sobrecarga en la UPS ${n}: apagada, carga cortada (sobre el 115 % sin tensión de entrada)`, 'bad');
    if (x.mode === 'apagada' && !s.byp[i] && !x.over && SC.mains && Q[0] && (i === 0 ? Q[1] : Q[3] && r.w.mid)) alarma(al, `UPS ${n} apagada: sin tensión de entrada ni baterías`, 'bad');
  });
  if (!r.out) alarma(al, 'Carga sin energía', 'bad');
  return al;
}

function alarmas2(r) {
  const s = SC.c2, Q = s.Q, al = [];
  if (!SC.mains) alarma(al, 'Falla de red eléctrica', 'bad'); else if (!Q[0]) alarma(al, 'General abierto (CB0): sin tensión en las UPS', 'bad');
  r.u.forEach((x, i) => {
    const n = i + 1;
    if (x.mode === 'falla') alarma(al, `FALLA en la UPS ${n}: los STS pasan a la UPS ${3 - n}`, 'bad');
    if (r.gen && !Q[2 * i + 1]) alarma(al, `Entrada UPS ${n} abierta (CB${2 * i + 1})`, 'bad');
    if (!Q[2 * i + 2]) alarma(al, `Salida UPS ${n} abierta (CB${2 * i + 2}): los STS pasan a la UPS ${3 - n}`, 'bad');
    if (x.mode === 'bateria') alarma(al, `UPS ${n} funcionando con baterías (${Math.round(s.soc[i])} %)${s.soc[i] < 20 ? ' · batería baja' : ''}`, s.soc[i] < 20 ? 'bad' : '');
    if (s.byp[i] && x.mode === 'bypass') alarma(al, `UPS ${n} en bypass estático (ordenado): sin respaldo de baterías`, '');
    if (s.byp[i] && x.mode === 'apagada') alarma(al, `UPS ${n} en bypass sin tensión de entrada: no entrega a los STS`, 'bad');
    if (x.over) alarma(al, x.mode === 'bypass' ? `Sobrecarga en la UPS ${n} (${x.visto.toFixed(1)} de ${x.kva} kVA): ${s.byp[i] ? 'en bypass' : 'transferida a bypass'}` : x.mode === 'bateria' ? `Sobrecarga en la UPS ${n} (${Math.round(x.visto / x.kva * 100)} %): la sostiene con baterías; sobre el 115 % corta la carga` : `Sobrecarga en la UPS ${n}: apagada, carga cortada (sobre el 115 % sin tensión de entrada)`, 'bad');
  });
  [0, 1].forEach(i => { if (Q[9 + i]) alarma(al, r.gen ? `Rodeo de la UPS ${i + 1} cerrado (CB${9 + i}): la red alimenta directo la salida de la UPS ${i + 1} (aguas abajo de CB${2 * i + 2}), por fuera de la UPS ${i + 1}` : `Rodeo de la UPS ${i + 1} cerrado (CB${9 + i}), pero no hay tensión de red`, r.gen ? '' : 'bad'); });
  if (r.sinRedund) alarma(al, `Redundancia perdida: las cargas suman ${r.encendida.toFixed(1)} kVA, más de lo que puede sostener una sola UPS (${KVA[2]} kVA). Si una UPS deja de entregar, la otra quedará en sobrecarga`, 'bad');
  r.sts.forEach((t, j) => {
    if (t.falla) alarma(al, `FALLA en el STS-${j + 1}: fuera de servicio, la carga ${j + 1} ${t.byp ? 'sigue por su bypass' : 'quedó sin energía (cierre su bypass Q' + (7 + j) + ')'}`, 'bad');
    if (t.sel === 'B') alarma(al, t.pref === 'B' ? `STS-${j + 1} en su fuente B (UPS ${2 - j}) por transferencia manual` : `STS-${j + 1} transfirió a su fuente B (UPS ${2 - j}): perdió la fuente A`, '');
    if (t.sel === 'A' && t.pref === 'B') alarma(al, `STS-${j + 1} volvió a su fuente A: la fuente B no está disponible`, '');
    if (!Q[11 + 2 * j] && r.gen) alarma(al, `Entrada A del STS-${j + 1} abierta (CB${11 + 2 * j}): el STS depende de su fuente B`, t.b ? '' : 'bad');
    if (!Q[12 + 2 * j] && r.gen) alarma(al, `Entrada B del STS-${j + 1} abierta (CB${12 + 2 * j}): el STS pierde su fuente de respaldo`, '');
    if (t.byp) alarma(al, `Bypass del STS-${j + 1} cerrado (CB${7 + j}): la carga ${j + 1} cuelga directo de la UPS ${j + 1}, por fuera del STS-${j + 1}`, '');
    if (t.conflicto) alarma(al, `Bypass del STS-${j + 1} cerrado mientras el STS entrega desde la UPS ${2 - j}: dos salidas de UPS distintas unidas sin sincronizar. Abra CB${5 + j} o el bypass`, 'bad');
    if (t.sel === null && !t.byp && !t.falla) alarma(al, `STS-${j + 1} sin fuentes: la carga ${j + 1} quedó sin energía`, 'bad');
    if (!t.q && !t.byp) alarma(al, `Salida STS-${j + 1} abierta (CB${5 + j}): la carga ${j + 1} quedó sin energía`, 'bad');
  });
  return al;
}

/** Repinta el unifilar, los controles y (si `lento`) alarmas y métricas. */
export function refrescarUi(n, r, lento) {
  const s = SC['c' + n];
  if (n === 1) unifilar1(r); else unifilar2(r);
  NOMBRES[n].forEach((_, i) => { const kr = rodeoDe(n, i), q = kr >= 0 && s.auxSig[kr] ? s.cmd[kr] : s.Q[i]; $(`#c${n}_q${i}`).checked = q; $(`#s${n}_q${i}`).textContent = q ? 'Cerrado · deja pasar energía' : 'Abierto · corta el paso'; });
  $(`#c${n}_mains`).checked = SC.mains;
  r.u.forEach((x, u) => {                                       // los botones muestran el modo REAL de la UPS (no solo la orden): inversor, bypass, baterías, apagada o falla
    const inv = x.mode === 'normal' || x.mode === 'bateria', byp = x.mode === 'bypass';
    $(`#c${n}_inv${u}`).classList.toggle('on', inv); $(`#c${n}_byp${u}`).classList.toggle('on', byp);
    const txt = { normal: 'Inversor', bateria: 'Inversor (baterías)', bypass: s.byp[u] ? 'Bypass estático' : 'Bypass (por sobrecarga)', apagada: s.byp[u] ? 'Bypass sin entrada' : 'Apagada', falla: 'Falla' }[x.mode];
    $(`#c${n}_modo${u}`).textContent = txt;
  });
  const rk = estadoRack(n); $(`#c${n}_front`).checked = !rk.front; $(`#c${n}_rear`).checked = !rk.rear; $(`#c${n}_sides`).checked = rk.sides; $(`#c${n}_cover`).checked = !rk.cover;
  [0, 1].forEach(u => { $(`#c${n}_f${u}`).textContent = s.fault[u] ? `UPS ${n === 1 ? 'AB'[u] : u + 1} en falla · restablecer` : `Falla UPS ${n === 1 ? 'AB'[u] : u + 1}`; $(`#c${n}_f${u}`).classList.toggle('bad', s.fault[u]); });
  if (n === 1) { $('#c1_load_v').textContent = `${s.load.toFixed(1)} kVA`; }
  else [0, 1].forEach(j => { $(`#c2_l${j}_v`).textContent = `${s.load[j].toFixed(1)} kVA`; });
  if (!lento) return;
  const al = n === 1 ? alarmas1(r) : alarmas2(r);
  $(`#al${n}`).innerHTML = (al.length ? al : [['Sin alarmas · sistema normal', 'ok']]).map(([t, c]) => `<li class="${c}">${t}</li>`).join('');
  $(`#m${n}_modo`).textContent = textoModo(r);
  $(`#m${n}_cap`).textContent = n === 1 ? `${KVA[1]} kVA` : `${r.u.filter(x => x.vivo).length * KVA[2]} kVA`;
  const conBat = r.u.map((x, i) => (x.mode === 'falla' ? null : s.soc[i])).filter(v => v !== null);
  $(`#m${n}_soc`).textContent = conBat.length ? `${Math.round(conBat.reduce((a, b) => a + b, 0) / conBat.length)} %` : '—';
  const aut = r.u.filter(x => x.mode !== 'falla' && x.visto > 0).map((x, i) => autonomia(x, s.soc[r.u.indexOf(x)]));
  $(`#m${n}_aut`).textContent = aut.length ? `${Math.round(Math.min(...aut))} min` : (r.u.some(x => x.mode !== 'falla') ? `${AUT_MIN} min` : '0 min');
}
