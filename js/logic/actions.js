/* Acciones del usuario y de las secuencias: puertas, módulos, automáticos, bypass/inversor, stand by, fallas y bancos.
   Al final se registran en `actions` para que el modelo 3D pueda invocarlas al hacer clic. */
import { toast } from '../core/interaction.js';
import { tween } from '../core/tween.js';
import { actions } from '../core/bus.js';
import { S, E } from '../state.js';
import { CB_OUT, breakerName, SEL_TEXT } from '../config.js';
import { doorF, OPEN_ANGLE } from '../model/doors.js';
import { moveSides } from '../model/rack.js';
import { covers, moveCover, isCoverOpen } from '../model/boardCover.js';
import { Z, allMods, battMods } from '../model/modules.js';
import { compute } from './electrical.js';
import { syncSwitches } from '../ui/sync.js';

/* ---------- puertas y laterales ---------- */
export function setDoor(d, open, silent) {
  if (!open && d === doorF && allMods.some(m => m.userData.state === 'out')) {
    if (!silent) toast('Guarde los módulos extraídos antes de cerrar la puerta frontal.');
    syncSwitches(); return;
  }
  if (!open && d === doorF) covers.forEach(c => { if (isCoverOpen(c)) moveCover(c, false); });   // las cubiertas se cierran antes de cerrar la puerta
  d.userData.open = open;
  tween(d.rotation, 'y', open ? OPEN_ANGLE : 0, 0.9);
  syncSwitches();
}
export const toggleDoor = d => setDoor(d, !d.userData.open);

export function setSides(closed) {
  moveSides(closed);
  syncSwitches();
}

/** Abre o cierra las cubiertas del tablero (solo se pueden abrir con la puerta frontal abierta). */
export function setCover(open) {
  if (open && !doorF.userData.open) { toast('Abra la puerta frontal para abrir las cubiertas del tablero.'); syncSwitches(); return; }
  covers.forEach(c => moveCover(c, open));
  toast(open ? 'Cubiertas abiertas: se ven el riel, los automáticos, barras, borneras y cables' : 'Cubiertas del tablero cerradas');
  syncSwitches();
}
/** Clic sobre una cubierta: abre o cierra solo esa. */
export function toggleCover(cover) {
  const open = !isCoverOpen(cover);
  if (open && !doorF.userData.open) { toast('Abra la puerta frontal para abrir la cubierta.'); return; }
  moveCover(cover, open);
  syncSwitches();
}

/* ---------- módulos (UPS y bancos) ---------- */
export function setModule(g, st, delay = 0) {
  // una UPS recién colocada queda apagada hasta que reciba tensión en su entrada
  if (g.userData.kind === 'power' && st === 'in' && g.userData.state !== 'in') { S.off[g.userData.unit] = true; S.manual[g.userData.unit] = false; S.standby[g.userData.unit] = false; }
  if (g.userData.kind === 'battery' && st === 'in' && g.userData.state === 'away') S.bankFault[g.userData.unit][g.userData.n] = false;   // banco nuevo
  g.userData.state = st;
  tween(g.position, 'z', Z[st], st === 'away' ? 1.1 : 0.7, delay);
}

export function toggleModule(g, e) {
  const st = g.userData.state;
  const what = g.userData.kind === 'power' ? 'UPS' : 'banco de baterías';
  if (!doorF.userData.open && st !== 'away') return toast('Abra la puerta frontal primero.');
  if (e && (e.ctrlKey || e.metaKey)) {
    // Ctrl+clic: retirar por completo o reponer desde fuera
    setModule(g, st === 'away' ? 'in' : 'away');
    return toast(st === 'away' ? `Reinstalando ${what}…` : `${what[0].toUpperCase() + what.slice(1)} retirado por completo (Ctrl+clic para reponerlo)`);
  }
  if (st === 'away') return toast('Módulo retirado. Ctrl+clic para reponerlo.');
  setModule(g, st === 'in' ? 'out' : 'in');
  toast(g.userData.state === 'out' ? `Extrayendo ${what}…` : `Insertando ${what}…`);
}

/* ---------- automáticos ---------- */
/** Abrir la salida de una UPS en servicio fuera de secuencia: riesgo de dañar la tarjeta. */
function maniobraSalida(id, closing) {
  const u = CB_OUT.indexOf(id);
  if (u < 0 || !E.units || closing) return;
  const x = E.units[u];
  if (!(x.present && (x.inv || x.bypassFeed) && !S.standby[u])) return;
  if (E.conm ? S.sel !== 1 : (E.rodeo && x.mode === 'bypass')) return;   // la carga no depende de la UPS (conmutador en 0 o 2; o rodeo cerrado con la UPS en bypass): sin riesgo
  S.risk[u] = true;
  toast(`⚠ Abrir ${id} con la UPS ${u + 1} en servicio puede dañar su tarjeta. Use stand by, abra la entrada y recién ahí la salida.`);
}

/** Cierra o abre un automático desde el panel lateral o el diagrama (con avisos de riesgo). */
export function toggleBreaker(id) {
  if (id === 'CB7' && S.auxRodeo) { setRodeo(!S.CB.CB7); return; }          // con contacto auxiliar adelantado la maniobra tiene su propia secuencia
  setBreakerManual(id, !S.CB[id]);
  toast(`${id} (${breakerName(id)}): ${S.CB[id] ? 'CERRADO' : 'ABIERTO'}`);
  syncSwitches();
}

/* ---------- contacto auxiliar adelantado del bypass de rodeo (CB7) ----------
   Va montado junto al CB7 y cierra unas milésimas ANTES que él (y abre unas milésimas DESPUÉS). Su señal llega a la UPS 1 y, por el cable
   de comunicación, la UPS 1 se la pasa a la UPS 2: las dos pasan a bypass estático y quedan sincronizadas con la red justo antes de que el
   CB7 las una a la red. Así no hay diferencia de potencia en la salida (sin el contacto, cerrar el CB7 con las UPS en inversor las daña).
   En el modelo el adelanto se alarga a una fracción de segundo para poder verlo. */
const ADELANTO_MS = 450;
let rodeoT = null, interno = false;
function cb7Directo(c) { interno = true; try { setBreakerManual('CB7', c); } finally { interno = false; } }
export function setRodeo(closed) {
  if (rodeoT) return;                                                       // mientras corre el adelanto no admite otra orden
  if (!S.auxRodeo || S.bypassMode !== 'rodeo') { cb7Directo(closed); toast(`CB7 (${breakerName('CB7')}): ${closed ? 'CERRADO' : 'ABIERTO'}`); syncSwitches(); return; }
  if (closed === S.CB.CB7) return;
  S.rodeoCmd = closed;
  if (closed) {
    S.auxSenal = true;
    if (E.units && E.units.some(x => x.present)) {
      if (!S.byp.some(Boolean)) S.auxForzo = true;
      applyBypass(true);
    }
    toast('Contacto auxiliar del CB7: cierra antes que el rodeo. La UPS 1 recibe la señal y, por el cable de comunicación, avisa a la UPS 2: ambas pasan a bypass estático');
    rodeoT = setTimeout(() => {
      rodeoT = null; cb7Directo(true);
      toast('CB7 cerrado con las UPS ya en bypass estático: red y salida sincronizadas, sin diferencia de potencia');
      syncSwitches();
    }, ADELANTO_MS);
  } else {
    cb7Directo(false);
    toast('CB7 abierto. El contacto auxiliar abre unas milésimas después y las UPS vuelven a inversor');
    rodeoT = setTimeout(() => {
      rodeoT = null; S.auxSenal = false;
      if (S.auxForzo) { S.auxForzo = false; applyBypass(false); }
      syncSwitches();
    }, ADELANTO_MS);
  }
  syncSwitches();
}
/* ---------- tablero externo de bypass (circuito 4) ----------
   Entrada (aguas arriba de CB5), salida (de CB6 a la carga) y bypass externo (de aguas abajo de CB8 a aguas arriba de CB10). El bypass externo lleva su contacto
   auxiliar adelantado, como el CB7: antes de cerrarlo pasa las UPS a bypass estático (comunicadas), así la salida queda sincronizada con la red. */
let extT = null;
export function setExtIn(closed) {
  S.ext.in = closed;
  toast(`Tablero externo · entrada (CB8): ${closed ? 'CERRADA, la red llega al general' : 'ABIERTA, el sistema queda sin red'}`);
  syncSwitches();
}
export function setExtOut(closed) {
  S.ext.out = closed;
  toast(`Tablero externo · salida (CB10): ${closed ? 'CERRADA' : 'ABIERTA, la salida del sistema queda desconectada de la carga'}`);
  syncSwitches();
}
export function setExtBypass(closed) {
  if (extT) return;                                                          // mientras corre el adelanto no admite otra orden
  const e = S.ext;
  if (closed === e.byp) return;
  e.cmd = closed;                                                            // las dos palancas (bypass y contacto auxiliar) se mueven juntas desde que se da la orden
  if (closed) {
    e.auxSig = true;
    if (E.units && E.units.some(x => x.present)) {
      if (!S.byp.some(Boolean)) e.auxForzo = true;
      applyBypass(true);
    }
    toast('Contacto auxiliar del bypass externo (CB9): cierra antes y pasa las UPS a bypass estático (la UPS 1 avisa a la UPS 2)');
    extT = setTimeout(() => {
      extT = null; e.byp = true;
      toast('Bypass externo cerrado con las UPS ya en bypass estático: red y salida sincronizadas, sin diferencia de potencia');
      syncSwitches();
    }, ADELANTO_MS);
  } else {
    e.byp = false;
    toast('Bypass externo (CB9) abierto. El contacto auxiliar abre unas milésimas después y las UPS vuelven a inversor');
    extT = setTimeout(() => {
      extT = null; e.auxSig = false;
      if (e.auxForzo) { e.auxForzo = false; applyBypass(false); }
      syncSwitches();
    }, ADELANTO_MS);
  }
  syncSwitches();
}

/** Instala o retira el contacto auxiliar adelantado del CB7. */
export function setAuxRodeo(on) {
  if (!on && (S.CB.CB7 || rodeoT)) { toast('Abra el CB7 antes de retirar el contacto auxiliar.'); syncSwitches(); return; }
  S.auxRodeo = on; S.auxSenal = false; S.auxForzo = false;
  toast(on ? 'Contacto auxiliar adelantado instalado: avisará a la UPS 1 antes de cerrar el CB7' : 'Contacto auxiliar retirado: cerrar el CB7 con las UPS en inversor las daña');
  syncSwitches();
}
export function setBreakerManual(id, closed) {
  if (id === 'CB7' && S.auxRodeo && S.bypassMode === 'rodeo' && !rodeoT && !interno && !closed !== !S.CB.CB7) { setRodeo(closed); return; }   // también desde el panel lateral
  maniobraSalida(id, closed);
  S.CB[id] = closed;
  if (closed) clearTrip(id);
}
/** Al cerrar a mano un automático de salida disparado, se repone. */
function clearTrip(id) {
  const u = CB_OUT.indexOf(id);
  if (u >= 0) S.tripped[u] = false;
}
/** Maniobra automática de un automático durante el montaje o desmontaje. */
export function setBreaker(id, closed) {
  if (S.CB[id] === closed) return;
  S.CB[id] = closed;
  if (closed) clearTrip(id);
  toast(`${id} (${breakerName(id)}): ${closed ? 'CERRADO' : 'ABIERTO'}`);
  syncSwitches();
}

/* ---------- conmutador bypass (1-0-2) ----------
   1 = la carga cuelga de las UPS · 0 = carga cortada · 2 = la red alimenta la carga directo.
   De ruptura antes de cierre: de 1 a 2 (o al revés) siempre pasa por 0 y la carga se queda sin energía un instante. */
let selTimer = null;
const SEL_PASO_MS = 1100;
export function setSelector(target) {
  if (selTimer || target === S.sel) return;               // mientras gira por 0 no admite otra orden
  if (S.sel !== 0 && target !== 0) {
    const from = S.sel;
    S.sel = 0;
    toast(`Conmutador bypass ${from} → ${target}: pasa por 0 y la carga se queda sin energía un instante`);
    selTimer = setTimeout(() => { selTimer = null; S.sel = target; toast(`Conmutador bypass en ${target}: ${SEL_TEXT[target]}`); syncSwitches(); }, SEL_PASO_MS);
  } else {
    S.sel = target;
    toast(`Conmutador bypass en ${target}: ${SEL_TEXT[target]}`);
  }
  syncSwitches();
}
/** Clic en el conmutador del rack: avanza 1 → 0 → 2 → (por 0) → 1. */
export const cycleSelector = () => setSelector(S.sel === 1 ? 0 : S.sel === 0 ? 2 : 1);

/** Cambia entre las dos configuraciones del bypass de rodeo: conmutador 1-0-2 o interruptor CB7 (la anterior). */
export function setBypassMode(mode) {
  if (S.bypassMode === mode) return;
  clearTimeout(selTimer); selTimer = null;
  S.bypassMode = mode;
  S.sel = 1; S.CB.CB7 = false; S.tripped = [false, false]; S.auxSenal = false; S.auxForzo = false;         // cada configuración parte con la carga en las UPS
  toast(mode === 'conmutador'
    ? 'Bypass de rodeo con conmutador 1-0-2: de ruptura antes de cierre, red e inversor nunca se unen'
    : 'Bypass de rodeo con interruptor CB7 (configuración anterior): puede cerrarse con las UPS en inversor');
  syncSwitches();
}

/* ---------- modo bypass / inversor ----------
   Las UPS están comunicadas por un cable, así que siempre están las dos en bypass o las dos en inversor.
   Lo único independiente es el traspaso de carga (stand by). Pasan a inversor solo cuando se les manda (INV);
   una UPS que arranca queda en bypass y arrastra al resto. La que se apagó en stand by arranca directo en inversor. */
export function applyBypass(v) {
  for (const i of [0, 1]) {
    S.byp[i] = v;
    if (!v && S.off[i] && !S.manual[i]) S.off[i] = false;   // arranque manual desde baterías (no las apagadas por stand by)
  }
}
export function setUnitBypass(u, v) {
  if (!E.units[u].present) return toast(`La UPS ${u + 1} no está instalada.`);
  applyBypass(v);
  const sinEntrada = E.units.some(x => x.present && !x.inAvail);
  const e2 = v ? null : compute();                                   // con la orden ya aplicada: ¿puede quedar en inversor?
  toast(v ? (sinEntrada ? 'Bypass sin tensión en la entrada: las UPS botan la carga y se apagan en 2 s' : 'Sistema transferido a bypass estático (las UPS están comunicadas)')
          : e2.overload ? `No puede quedar en inversor: la carga (${S.load} kW) supera lo que sostienen las UPS en inversor (${e2.cap} kW), por eso sigue en bypass. Reduzca la carga.`
          : 'Sistema pasa a inversor (las UPS están comunicadas)');
  syncSwitches();
}
export function setBypass(v) {                                      // desde el panel lateral
  if (!E.units.some(x => x.present)) return toast('No hay ninguna UPS instalada.');
  setUnitBypass(E.units.findIndex(x => x.present), v);
}

/* ---------- traspaso de carga (stand by) ----------
   La UPS pasa a stand by (encendida pero sin entregar) y la otra sostiene sola la carga.
   Para retirarla: stand by → abrir la entrada (se apaga) → abrir la salida → extraer. */
function otherCanCarry(v) {
  const y = E.units[v];
  return y.present && y.outClosed && !S.standby[v] && (y.mode === 'bypass' || ((y.mode === 'normal' || y.mode === 'bateria') && S.load <= 10));
}
export function setTransfer(u) {
  const n = u + 1, v = 1 - u;
  if (S.fault[u]) return toast(`La UPS ${n} está en falla.`);
  if (S.standby[u]) {                      // salir de stand by: vuelve a repartir la carga
    S.standby[u] = false;
    toast(`UPS ${n} sale de stand by: retoma su parte de la carga`); syncSwitches(); return;
  }
  if (!E.units[u].present) return toast(`La UPS ${n} no está instalada.`);
  if (S.off[u]) return toast(`La UPS ${n} está apagada: cierre su salida y luego su entrada para encenderla.`);
  if (!otherCanCarry(v)) return toast(`No se puede traspasar: la UPS ${v + 1} no puede sostener sola la carga (${S.load} kW).`);
  S.standby[u] = true;
  toast(`Carga traspasada a la UPS ${v + 1}; la UPS ${n} queda en stand by. Ahora abra su entrada y luego su salida.`);
  syncSwitches();
}

/* ---------- fallas simuladas ---------- */
/** Falla (o restablece) una UPS: se aísla; si la otra puede, sostiene la carga. */
export function setFault(u) {
  const n = u + 1;
  if (!E.units[u].present) return toast(`La UPS ${n} no está instalada.`);
  if (S.fault[u]) {
    S.fault[u] = false; S.off[u] = true; S.manual[u] = false;      // reparada: arranca como nueva cuando tenga entrada
    toast(`UPS ${n} restablecida: vuelve a arrancar`);
  } else {
    S.fault[u] = true; S.standby[u] = false;
    toast(`FALLA en la UPS ${n}: queda aislada${E.units[1 - u].deliver ? `, la carga sigue en la UPS ${2 - u}` : ''}`);
  }
  syncSwitches();
}

/* ---------- bancos de baterías ----------
   Cada UPS se configura con la cantidad de bancos que usa (1 o 2).
   Si hay menos bancos sanos que los configurados, la UPS inhibe las baterías y alarma. */
export function setBanks(u) {
  const n = u + 1;
  if (!E.units[u].present) return toast(`La UPS ${n} no está instalada.`);
  S.cfg[u] = S.cfg[u] === 2 ? 1 : 2;
  const y = compute().units[u];
  toast(`UPS ${n}: configurada para operar con ${S.cfg[u]} banco${S.cfg[u] > 1 ? 's' : ''} de baterías${y.nAct === 0 ? ' · faltan bancos sanos para esa configuración, baterías inhibidas' : ''}`);
  syncSwitches();
}
export function setBankFault(u, b) {
  const m = battMods.find(k => k.userData.unit === u && k.userData.n === b);
  if (m.userData.state !== 'in') return toast(`El banco ${b + 1} de la UPS ${u + 1} no está instalado.`);
  S.bankFault[u][b] = !S.bankFault[u][b];
  toast(S.bankFault[u][b] ? `FALLA del banco ${b + 1} de la UPS ${u + 1}` : `Banco ${b + 1} de la UPS ${u + 1} restablecido`);
  syncSwitches();
}

/* El modelo 3D invoca estas acciones por nombre al hacer clic */
Object.assign(actions, { cycleSelector, toggleCover, toggleDoor, toggleModule, toggleBreaker, setTransfer, setBanks, setUnitBypass });
