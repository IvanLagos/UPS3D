/* Acciones del usuario y de las secuencias: puertas, módulos, automáticos, bypass/inversor, stand by, fallas y bancos.
   Al final se registran en `actions` para que el modelo 3D pueda invocarlas al hacer clic. */
import { toast } from '../core/interaction.js';
import { tween } from '../core/tween.js';
import { actions } from '../core/bus.js';
import { S, E } from '../state.js';
import { CB_OUT, breakerName, SEL_TEXT } from '../config.js';
import { doorF, OPEN_ANGLE } from '../model/doors.js';
import { moveSides } from '../model/rack.js';
import { covers, moveCover, isCoverRemoved } from '../model/boardCover.js';
import { Z, allMods, battMods } from '../model/modules.js';
import { compute } from './electrical.js';
import { syncSwitches } from '../ui/sync.js';

/* ---------- puertas y laterales ---------- */
export function setDoor(d, open, silent) {
  if (!open && d === doorF && allMods.some(m => m.userData.state === 'out')) {
    if (!silent) toast('Guarde los módulos extraídos antes de cerrar la puerta frontal.');
    syncSwitches(); return;
  }
  d.userData.open = open;
  tween(d.rotation, 'y', open ? OPEN_ANGLE : 0, 0.9);
  syncSwitches();
}
export const toggleDoor = d => setDoor(d, !d.userData.open);

export function setSides(closed) {
  moveSides(closed);
  syncSwitches();
}

/** Retira o coloca las cubiertas del tablero (solo se pueden retirar con la puerta frontal abierta). */
export function setCover(removed) {
  if (removed && !doorF.userData.open) { toast('Abra la puerta frontal para retirar las cubiertas del tablero.'); syncSwitches(); return; }
  covers.forEach(c => moveCover(c, removed));
  toast(removed ? 'Cubiertas retiradas: se ven el riel, los automáticos, barras, borneras y cables' : 'Cubiertas del tablero colocadas');
  syncSwitches();
}
/** Clic sobre una cubierta: retira o coloca solo esa. */
export function toggleCover(cover) {
  const removed = !isCoverRemoved(cover);
  if (removed && !doorF.userData.open) { toast('Abra la puerta frontal para retirar la cubierta.'); return; }
  moveCover(cover, removed);
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
  setBreakerManual(id, !S.CB[id]);
  toast(`${id} (${breakerName(id)}): ${S.CB[id] ? 'CERRADO' : 'ABIERTO'}`);
  syncSwitches();
}
export function setBreakerManual(id, closed) {
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
  S.sel = 1; S.CB.CB7 = false; S.tripped = [false, false];          // cada configuración parte con la carga en las UPS
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
  toast(v ? (sinEntrada ? 'Bypass sin tensión en la entrada: las UPS botan la carga y se apagan en 2 s' : 'Sistema transferido a bypass estático (las UPS están comunicadas)')
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
