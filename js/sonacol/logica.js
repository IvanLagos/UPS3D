import { toast } from '../core/interaction.js';

/* Lógica eléctrica de los circuitos nuevos de SONACOL (el circuito 3 es el paralelo redundante de siempre, en logic/).
   Circuito 1: RED → Q0 → UPS A (6 kVA) → UPS B (6 kVA) en serie → carga regulable (máx. 6 kVA, sobre eso hay sobrecarga).
   Circuito 2: RED → Q0 → 2 UPS de 10 kVA cruzadas con 2 STS (UPS 1 → A de STS-1 y B de STS-2; UPS 2 → A de STS-2 y B de STS-1) → 2 cargas.
   Circuito 1: Q[0] general de red, Q[1] entrada UPS A, Q[2] salida UPS A, Q[3] entrada UPS B, Q[4] salida UPS B, Q[5] rodeo de la UPS A y
   Q[6] rodeo de la UPS B. Los dos rodeos se conectan en el punto M, justo en medio entre Q2 y Q3: el rodeo A lleva la red (antes de Q1) hasta M y el rodeo B
   lleva M hasta la carga (después de Q4). Cerrar un rodeo con la UPS entregando en inversor une red e inversor sin sincronizar: la UPS entra en falla
   (con la UPS en bypass, o aislada con su automático de salida abierto, es seguro).
   Circuito 2: Q[0] general de red, Q[1] entrada UPS 1, Q[2] salida UPS 1, Q[3] entrada UPS 2, Q[4] salida UPS 2,
   Q[5] salida STS-1 (a la carga 1), Q[6] salida STS-2 (a la carga 2), Q[7] bypass del STS-1 (de la salida de la UPS 1, aguas abajo de Q2, a la carga 1)
   y Q[8] bypass del STS-2 (de la salida de la UPS 2, aguas abajo de Q4, a la carga 2), Q[9] rodeo de la UPS 1 y Q[10] rodeo de la UPS 2 (cada uno lleva la
   red, antes de la entrada de su UPS, a la salida de esa UPS, aguas abajo de Q2 / Q4), con su contacto auxiliar adelantado,
   y Q[11] a Q[14] automáticos de entrada de los STS, justo aguas arriba de cada entrada: Q[11] entrada A del STS-1, Q[12] entrada B del STS-1,
   Q[13] entrada A del STS-2, Q[14] entrada B del STS-2. true = cerrado. */

export const KVA = { 1: 6, 2: 10 };
export const CORTE = 1.15;               // sin tensión de entrada, la UPS sostiene hasta el 115 % de su capacidad (con aviso de sobrecarga); sobre eso se dispara y corta la carga      // potencia de cada UPS del circuito
export const AUT_MIN = 12;               // minutos de autonomía con carga nominal
export const MODO_TXT = { normal: 'Normal', bateria: 'Batería', bypass: 'Bypass', apagada: 'Apagada', falla: 'Falla' };

/* Cada UPS recibe sus propias órdenes INV / BYP (byp[i] = true: bypass estático): no están comunicadas entre sí, cada una cambia de modo por separado. */
export const SC = {
  activo: 1,
  mains: true,
  c1: { Q: [true, true, true, true, true, false, false], cmd: [false, false], auxSig: [false, false], auxForzo: [false, false], fault: [false, false], byp: [false, false], soc: [100, 100], load: 3 },
  c2: { Q: [true, true, true, true, true, true, true, false, false, false, false, true, true, true, true], cmd: [false, false], auxSig: [false, false], auxForzo: [false, false], pref: ['A', 'A'], fault: [false, false], faultSts: [false, false], byp: [false, false], soc: [100, 100], load: [5, 5] },
};

/* Contacto auxiliar adelantado de cada rodeo (circuito 1: Q5 = rodeo de la UPS A, Q6 = rodeo de la UPS B; circuito 2: Q9 = rodeo de la UPS 1, Q10 = rodeo de la UPS 2):
   va pegado al automático del rodeo y cierra unas milésimas ANTES que él (y abre unas milésimas DESPUÉS). Su señal pasa solo la UPS de ese rodeo a bypass estático
   (las UPS no están comunicadas), así queda sincronizada con la red justo antes de que el rodeo la una a la red. Al soltarse la devuelve a inversor si fue quien la
   pasó a bypass. En el modelo el adelanto se alarga a una fracción de segundo para poder verlo. */
export const ADELANTO_MS = 450;
const temporizadores = { 1: [null, null], 2: [null, null] };
/** Índice de la UPS (0 o 1) a la que pertenece el automático `i` del circuito `n` si es un rodeo; si no, -1. */
export const rodeoDe = (n, i) => (n === 1 && i >= 5 ? i - 5 : n === 2 && i >= 9 ? i - 9 : -1);
/** Ordena cerrar (true) o abrir (false) el rodeo de la UPS k (0 o 1) del circuito n con su contacto auxiliar. */
export function ordenarRodeo(n, k, cerrar) {
  const s = SC['c' + n], idx = n === 1 ? 5 + k : 9 + k, nom = n === 1 ? 'AB'[k] : k + 1, t = temporizadores[n];
  if (t[k] || cerrar === s.Q[idx]) return;                            // mientras corre el adelanto no admite otra orden
  s.cmd[k] = cerrar;                                                  // las dos palancas (la del rodeo y la del contacto auxiliar) se mueven juntas desde que se da la orden
  if (cerrar) {
    s.auxSig[k] = true;
    if (!s.byp[k]) { s.auxForzo[k] = true; s.byp[k] = true; }
    toast(`Contacto auxiliar del rodeo de la UPS ${nom}: cierra antes que el rodeo y pasa la UPS ${nom} a bypass estático (la otra UPS no cambia)`);
    t[k] = setTimeout(() => {
      t[k] = null; s.Q[idx] = true;
      toast(`Rodeo de la UPS ${nom} cerrado con la UPS ya en bypass estático: red y salida sincronizadas, sin diferencia de potencia`);
    }, ADELANTO_MS);
  } else {
    s.Q[idx] = false;
    toast(`Rodeo de la UPS ${nom} abierto. El contacto auxiliar abre unas milésimas después y la UPS vuelve a inversor`);
    t[k] = setTimeout(() => {
      t[k] = null; s.auxSig[k] = false;
      if (s.auxForzo[k]) { s.auxForzo[k] = false; s.byp[k] = false; }
    }, ADELANTO_MS);
  }
}

/** Una UPS: recibe si tiene tensión en la entrada, si está en falla, su carga de baterías, su potencia y la carga que ve. */
function unidad(inV, fault, soc, kva, visto, byp = false, disparada = false) {
  const over = visto > kva || disparada;                      // sobrecarga: más del 100 %
  const corta = visto > kva * CORTE || disparada;             // con baterías (sin tensión de entrada) una UPS sostiene del 100 al 115 % con aviso; sobre el 115 % se dispara y corta la carga
  let mode;
  if (fault) mode = 'falla';
  else if (byp) mode = inV ? 'bypass' : 'apagada';            // bypass ordenado: la carga cuelga de la entrada; sin entrada la UPS no entrega
  else if (inV) mode = over ? 'bypass' : 'normal';           // con sobrecarga el inversor pasa a bypass
  else if (soc > 0 && !corta) mode = 'bateria';
  else mode = 'apagada';
  return { inV, over, mode, visto, kva, vivo: mode === 'normal' || mode === 'bateria' || mode === 'bypass' };
}

export function calc1() {
  const s = SC.c1, Q = s.Q, kva = KVA[1];
  const gen = SC.mains && Q[0];
  const demanda = Q[4] || Q[6] ? s.load : 0;                                  // la carga cuelga de la UPS B (por Q4) o de su rodeo
  const A = unidad(gen && Q[1], s.fault[0], s.soc[0], kva, Q[2] ? demanda : 0, s.byp[0]);   // la UPS A alimenta el punto M a través de Q2
  const aM = A.vivo && Q[2];                                                   // salida de la UPS A llegando a M
  const rodA = gen && Q[5];                                                    // rodeo A: la red llega directo a M
  const M = aM || rodA;                                                        // punto de unión, justo en medio entre Q2 y Q3
  const B = unidad(M && Q[3], s.fault[1], s.soc[1], kva, Q[4] ? s.load : 0, s.byp[1]);
  const bOut = B.vivo && Q[4];                                                 // salida de la UPS B llegando a la carga
  const rodB = M && Q[6];                                                      // rodeo B: de M directo a la carga
  const out = bOut || rodB;
  const inversor = x => x.mode === 'normal' || x.mode === 'bateria';
  const rodeoFalla = [Q[5] && rodA && aM && inversor(A), Q[6] && rodB && bOut && inversor(B)];   // rodeo cerrado con la UPS entregando en inversor: sin sincronizar
  return {
    gen, u: [A, B], out, carga: s.load, over: A.over || B.over, rodeoFalla,
    pct: s.load / kva * 100,                                  // el % es el consumo de la carga respecto de la capacidad de la cadena (6 kVA), sin importar por dónde llegue la energía (UPS o rodeos)
    w: { red: SC.mains, g: gen, ai: gen && Q[1], ao: A.vivo, am: aM, mid: M, bi: M && Q[3], bo: B.vivo, bout: out, ra2: rodA, rb2: rodB, soloRodeo: out && !bOut },
  };
}

export function calc2() {
  const s = SC.c2, Q = s.Q, kva = KVA[2];
  const gen = SC.mains && Q[0];
  const trip = [false, false];                              // UPS sin tensión de entrada que se disparó por pasar de su 100 % con baterías
  let visto = [0, 0], asign = [0, 0], u, sts, entrega = [false, false];
  for (let vuelta = 0; vuelta < 5; vuelta++) {              // la elección de fuente y la sobrecarga dependen una de otra: se itera; un disparo nunca se deshace, así que termina siempre
    u = [0, 1].map(i => unidad(gen && Q[2 * i + 1], s.fault[i], s.soc[i], kva, visto[i], s.byp[i], trip[i]));
    entrega = u.map((x, i) => x.vivo && Q[2 * i + 2]);                         // la UPS i entrega por sí misma a su salida (aguas abajo de Q2 / Q4)
    const sale = [0, 1].map(i => entrega[i] || !!(gen && Q[9 + i]));           // salida i disponible: de la UPS o de su rodeo
    sts = [0, 1].map(j => {                                                    // el STS j prefiere su fuente A (la UPS j); cada entrada tiene su automático (Q11…Q14)
      const falla = !!s.faultSts[j];                                          // STS en falla: no transfiere ni entrega (la carga solo se alimenta por su bypass)
      const a = !falla && sale[j] && Q[11 + 2 * j], b = !falla && sale[1 - j] && Q[12 + 2 * j], pref = s.pref[j];
      const sel = pref === 'A' ? (a ? 'A' : b ? 'B' : null) : (b ? 'B' : a ? 'A' : null);   // usa la fuente preferida; si no está, la otra
      return { a, b, pref, sel, falla };
    });
    const nuevo = [0, 0];
    asign = [0, 0];
    sts.forEach((t, j) => {
      let src = -1;
      if (Q[7 + j] && sale[j]) src = j;                                        // bypass cerrado: la carga cuelga directo de la salida j (por fuera del STS)
      else if (Q[5 + j]) src = t.sel === 'A' ? j : t.sel === 'B' ? 1 - j : -1;  // con el automático de salida del STS abierto, esa carga no se alimenta
      t.src = src;
      if (src >= 0) { asign[src] += s.load[j]; if (entrega[src]) nuevo[src] += s.load[j]; }   // lo que lleva la UPS (si el rodeo la alimenta, la lleva la red)
    });
    let cambio = false;
    for (const i of [0, 1]) if (!trip[i] && u[i].mode === 'bateria' && nuevo[i] > kva * CORTE) { trip[i] = true; cambio = true; }
    visto = nuevo;
    if (!cambio) { u = [0, 1].map(i => unidad(gen && Q[2 * i + 1], s.fault[i], s.soc[i], kva, visto[i], s.byp[i], trip[i])); break; }
  }
  const o = [0, 1].map(i => u[i].vivo && Q[2 * i + 2] || !!(gen && Q[9 + i]));  // salida de cada UPS, aguas abajo de Q2 / Q4 (de la UPS o de su rodeo)
  const entregaF = u.map((x, i) => x.vivo && Q[2 * i + 2]);
  const porBypass = [0, 1].map(j => !!(Q[7 + j] && o[j]));                // la carga j cuelga del bypass de su STS
  sts.forEach((t, j) => { t.out = t.sel !== null; t.q = Q[5 + j]; t.byp = porBypass[j]; t.on = (t.out && t.q) || t.byp; t.carga = s.load[j];
    t.conflicto = t.byp && t.out && t.q && t.sel === 'B';                  // el STS entrega desde la otra UPS y el bypass desde esta: dos salidas distintas unidas sin sincronizar
    t.pct = !t.on || t.src < 0 ? 0 : asign[t.src] / kva * 100;            // % de la fuente que la alimenta, aunque llegue por un rodeo (si una UPS falla y sostiene ambas cargas, las dos muestran sobrecarga)
  });
  const encendida = sts.reduce((a, t, j) => a + (t.on ? s.load[j] : 0), 0);
  const over = u.some(x => x.over);
  const sinRedund = !over && u[0].vivo && u[1].vivo && encendida > kva;   // las dos UPS entregan, pero las cargas ya no caben en una sola: si una deja de entregar, la otra queda en sobrecarga
  const inversor = x => x.mode === 'normal' || x.mode === 'bateria';
  const rodeoFalla = [0, 1].map(i => !!(Q[9 + i] && gen && entregaF[i] && inversor(u[i])));   // rodeo cerrado con la UPS entregando en inversor: sin sincronizar
  return {
    gen, u, sts, over, sinRedund, encendida, rodeoFalla,
    w: { red: SC.mains, g: gen, i0: gen && Q[1], i1: gen && Q[3], o0: u[0].vivo, o1: u[1].vivo, x0: o[0], x1: o[1], t0: sts[0].out, t1: sts[1].out, s0: sts[0].on, s1: sts[1].on, b0: o[0], b1: o[1], bl0: porBypass[0], bl1: porBypass[1],
      rd0: !!(gen && Q[9]), rd1: !!(gen && Q[10]), rs0: !!(gen && Q[9]) && !entregaF[0], rs1: !!(gen && Q[10]) && !entregaF[1] },
  };
}

/** Transferencia manual del STS j (0 o 1) a la fuente `destino` ('A' o 'B'); sin destino pasa a la otra fuente. Solo si la fuente de destino está disponible. */
export function conmutarSts(j, destino = null) {
  const t = calc2().sts[j], d = destino || (t.sel === 'A' ? 'B' : 'A');
  if (t.falla) { toast(`STS-${j + 1} en falla: no puede transferir`); return; }
  if (SC.c2.pref[j] === d && t.sel === d) return;
  if (!(d === 'A' ? t.a : t.b)) { toast(`STS-${j + 1}: la fuente ${d} no está disponible, no puede transferir`); return; }
  SC.c2.pref[j] = d;
  toast(`STS-${j + 1}: transferencia manual a la fuente ${d}`);
}

/** Minutos de autonomía restantes de una UPS (con la carga que ve). */
export function autonomia(x, soc) {
  if (x.mode === 'falla') return 0;
  return soc / 100 * AUT_MIN / Math.max(0.1, x.visto / x.kva);
}

/** Avanza las baterías: se descargan al operar con ellas y se cargan con tensión de entrada (1 s real = 1 min simulado). */
export function paso(dt) {
  for (const [s, r, nom] of [[SC.c1, calc1(), 'AB'], [SC.c2, calc2(), '12']]) {
    r.u.forEach((x, i) => {
      if (x.mode === 'bateria') s.soc[i] = Math.max(0, s.soc[i] - dt * 100 / AUT_MIN * Math.max(0.1, x.visto / x.kva));
      else if (x.inV && !s.fault[i] && s.soc[i] < 100) s.soc[i] = Math.min(100, s.soc[i] + dt * 3);
    });
    if (r.rodeoFalla) r.rodeoFalla.forEach((f, i) => {                      // red e inversor unidos sin sincronizar: la UPS queda en falla
      if (f && !s.fault[i]) { s.fault[i] = true; toast(`Rodeo cerrado con la UPS ${nom[i]} en inversor: red e inversor sin sincronizar. La UPS ${nom[i]} entra en FALLA`); }
    });
  }
}
