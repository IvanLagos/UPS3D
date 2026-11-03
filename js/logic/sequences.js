/* Secuencias automáticas de montaje y desmontaje del rack, maniobrando los automáticos en el orden correcto
   para no botar la carga. Cada secuencia se puede interrumpir iniciando otra (token `seq`). */
import { $ } from '../core/dom.js';
import { toast } from '../core/interaction.js';
import { tween } from '../core/tween.js';
import { S, E } from '../state.js';
import { CB_IN, CB_OUT } from '../config.js';
import { doorF, doorR, OPEN_ANGLE } from '../model/doors.js';
import { powerMods, unitBanks } from '../model/modules.js';
import { setDoor, setSides, setModule, setBreaker, applyBypass } from './actions.js';
import { syncSwitches } from '../ui/sync.js';

let seq = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function showStep(n, total, txt) {
  const p = $('#paso'); p.style.display = txt ? 'block' : 'none';
  p.textContent = txt ? `Paso ${n}/${total} · ${txt}` : '';
}

/**
 * Desmontaje: UPS a bypass → cerrar bypass de rodeo (CB7) → por cada UPS (primero la 2, luego la 1):
 * abrir salida y entrada, esperar a que se apague y extraer el módulo con sus bancos.
 */
export async function desmontar() {
  const tok = ++seq; const ok = async ms => { await sleep(ms); return tok === seq; };
  // UPS que aún tienen equipo instalado; se retira primero la UPS 2 y luego la UPS 1
  const lista = [1, 0].filter(u => powerMods[u].userData.state !== 'away' || unitBanks(u).some(b => b.userData.state !== 'away'));
  const T = 5 + 3 * lista.length;
  let n = 1;
  if (E.out && !E.gen) {                                   // sin red, el bypass de rodeo no puede sostener la carga
    const msg = 'Cancelado: no hay tensión de red, la carga no puede pasar por el bypass sin botarse. Restablezca la red (o abra CB6) y reintente.';
    showStep(1, T, msg); toast(msg);
    await sleep(4000); if (tok === seq) showStep(0, 0, '');
    return;
  }
  showStep(n++, T, 'Abrir puertas'); doorF.userData.open = true; doorR.userData.open = true;
  tween(doorF.rotation, 'y', OPEN_ANGLE, 0.9); tween(doorR.rotation, 'y', OPEN_ANGLE, 0.9); syncSwitches();
  if (!await ok(1100)) return;
  showStep(n++, T, 'Retirar paneles laterales'); setSides(false);
  if (!await ok(1100)) return;
  // 1) llevar las UPS a bypass estático (por el cable de comunicación pasan las dos juntas)
  const corriendo = E.units.some(x => x.present && !x.stateOff && !x.stateFault && x.inAvail);
  showStep(n++, T, corriendo ? 'Llevar las UPS a bypass estático (la carga sigue con tensión de red)' : 'Las UPS no están en servicio');
  S.standby = [false, false];
  if (corriendo) { applyBypass(true); syncSwitches(); }
  if (!await ok(1700)) return;
  // 2) cerrar el bypass de rodeo: la red alimenta la carga por fuera de las UPS
  showStep(n++, T, 'Cerrar el bypass de rodeo (CB7): la red alimenta la carga por fuera de las UPS');
  setBreaker('CB7', true); if (!await ok(1700)) return;
  // 3) por cada UPS: abrir salida y entrada, y extraer el módulo con sus baterías
  for (const u of lista) {
    showStep(n++, T, `Abrir la salida ${CB_OUT[u]} y la entrada ${CB_IN[u]} de la UPS ${u + 1}`);
    setBreaker(CB_OUT[u], false); if (!await ok(1000)) return;
    setBreaker(CB_IN[u], false); if (!await ok(600)) return;
    // sin tensión en la entrada, la UPS en bypass se apaga sola: se espera a que lo haga antes de sacarla
    const instalada = powerMods[u].userData.state === 'in' && !S.fault[u];
    showStep(n++, T, instalada && !S.off[u] ? `Esperar a que la UPS ${u + 1} se apague` : `La UPS ${u + 1} ya está apagada`);
    for (let t = 0; instalada && !S.off[u] && t < 40; t++) if (!await ok(250)) return;
    if (!await ok(900)) return;
    showStep(n++, T, `Extraer la UPS ${u + 1} y sus bancos de baterías`);
    setModule(powerMods[u], 'away');
    unitBanks(u).slice().reverse().forEach((m, i) => setModule(m, 'away', 0.5 + i * 0.4));
    if (!await ok(2800)) return;
  }
  showStep(n, T, 'Estructura vacía'); if (!await ok(1800)) return;
  showStep(0, 0, '');
}

/**
 * Montaje: instalar las UPS con sus bancos (automáticos abiertos) → cerrar entradas (arrancan en bypass) →
 * cerrar salidas → bajar el bypass de rodeo → comando INV a inversor.
 */
export async function montar() {
  const tok = ++seq; const ok = async ms => { await sleep(ms); return tok === seq; };
  // UPS a las que les falta equipo, de abajo hacia arriba
  const falta = [1, 0].filter(u => powerMods[u].userData.state !== 'in' || unitBanks(u).some(b => b.userData.state !== 'in'));
  const needCB6 = !S.CB.CB6;
  const T = 1 + falta.length + 1 + 1 + (S.CB.CB7 ? 1 : 0) + 1 + (needCB6 ? 1 : 0) + 3;
  let n = 1;
  showStep(n++, T, 'Abrir puertas'); setDoor(doorF, true, true); setDoor(doorR, true, true);
  if (!await ok(1000)) return;
  // 1) instalar las UPS con sus bancos, con todos sus automáticos abiertos
  for (const u of falta) {
    showStep(n++, T, `Instalar la UPS ${u + 1} y sus bancos (con sus automáticos abiertos)`);
    setBreaker(CB_IN[u], false); setBreaker(CB_OUT[u], false);
    S.standby[u] = false;
    unitBanks(u).forEach((m, i) => setModule(m, 'in', i * 0.4));
    setModule(powerMods[u], 'in', 0.9);
    if (!await ok(2900)) return;
  }
  // 2) cerrar las entradas: las UPS arrancan en bypass estático, sincronizadas con la red
  showStep(n++, T, 'Cerrar las entradas (CB3 y CB1): las UPS arrancan en bypass estático, sincronizadas con la red');
  setBreaker('CB5', true);
  for (const u of [1, 0]) { setBreaker(CB_IN[u], true); if (!await ok(900)) return; }
  if (!await ok(1000)) return;
  // 3) cerrar las salidas, con las UPS ya en bypass
  showStep(n++, T, 'Cerrar las salidas (CB4 y CB2): las UPS en bypass quedan conectadas al bus de salida');
  for (const u of [1, 0]) { setBreaker(CB_OUT[u], true); if (!await ok(900)) return; }
  if (!await ok(700)) return;
  // 4) bajar el bypass de rodeo: la carga pasa a las UPS (en bypass)
  if (S.CB.CB7) {
    showStep(n++, T, 'Bajar el bypass de rodeo (CB7): la carga pasa a las UPS (en bypass)');
    setBreaker('CB7', false); if (!await ok(1600)) return;
  }
  // 5) por comando, las dos UPS pasan a inversor
  showStep(n++, T, 'Comando INV: las dos UPS pasan de bypass a inversor');
  applyBypass(false); syncSwitches(); if (!await ok(1600)) return;
  if (needCB6) { showStep(n++, T, 'Cerrar la salida general (CB6)'); setBreaker('CB6', true); if (!await ok(900)) return; }
  showStep(n++, T, 'Colocar paneles laterales'); setSides(true);
  if (!await ok(1200)) return;
  showStep(n++, T, 'Cerrar puertas'); setDoor(doorF, false, true); setDoor(doorR, false, true);
  if (!await ok(1200)) return;
  showStep(n, T, 'Montaje completo'); if (!await ok(1600)) return;
  showStep(0, 0, '');
}
