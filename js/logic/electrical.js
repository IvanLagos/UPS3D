/* Lógica eléctrica: a partir del estado S calcula qué energizado está cada tramo, el modo de cada UPS y la salida.
   Es una función pura de S y de lo instalado en el rack (no modifica nada). */
import { S } from '../state.js';
import { CB_IN, CB_OUT, UPS_KW, OVERLOAD_CUT } from '../config.js';
import { powerMods, battMods } from '../model/modules.js';

export function compute() {
  const gen = S.mains && S.CB.CB5;                                // tensión aguas abajo del general
  const conm = S.bypassMode === 'conmutador';                     // conmutador 1-0-2 (si no, interruptor CB7 de la configuración anterior)
  const selUps = !conm || S.sel === 1;                            // la carga cuelga de las UPS (con el conmutador, solo en la posición 1)
  const units = [0, 1].map(u => {
    const present = powerMods[u].userData.state === 'in';
    const inAvail = gen && S.CB[CB_IN[u]];                        // tensión en la entrada de la UPS
    // bancos: cada UPS usa los que tiene configurados (1 o 2); si hay menos bancos sanos, las baterías quedan inhibidas
    const bk = [0, 1].map(b => battMods.find(m => m.userData.unit === u && m.userData.n === b).userData.state !== 'in' ? 'miss' : S.bankFault[u][b] ? 'fault' : 'ok');
    const healthy = bk.filter(s => s === 'ok').length, cfg = S.cfg[u];
    const nAct = present && healthy >= cfg ? cfg : 0;
    const act = bk.map((s, b) => s === 'ok' && bk.slice(0, b).filter(t => t === 'ok').length < nAct);   // bancos en uso
    const banks = nAct > 0;
    const stateOff = S.off[u];                                    // UPS apagada tras perder la entrada en bypass
    const stateFault = S.fault[u];                                // falla simulada
    const rect = present && inAvail && !stateOff && !stateFault;
    const batOk = banks && S.soc[u] > 0 && !stateOff && !stateFault;
    const dc = rect || batOk;
    const inv = present && dc;
    const bypassFeed = present && inAvail && !stateOff && !stateFault;   // el bypass estático funciona siempre que haya entrada
    return { present, inAvail, banks, bk, healthy, cfg, nAct, act, rect, batOk, dc, inv, bypassFeed, stateOff, stateFault, byp: S.byp[u], useInv: inv && !S.byp[u], outClosed: S.CB[CB_OUT[u]], shut: false, standby: S.standby[u] };
  });

  // sobrecarga: las UPS con inversor que entregan a la carga deben cubrirla (10 kW cada una)
  const nInvDel = units.filter(x => x.useInv && x.outClosed && !x.standby).length;
  const overload = nInvDel > 0 && S.load > nInvDel * UPS_KW;
  const redundancyLost = nInvDel >= 2 && S.load > UPS_KW;         // con las 2 UPS entregando, pero la carga ya no cabe en una sola: si una deja de entregar, la otra queda en sobrecarga
  let overloadBypass = false;
  const sobreCorte = nInvDel > 0 && S.load > nInvDel * UPS_KW * OVERLOAD_CUT;      // sobre el 115 %: con baterías la UPS corta la carga
  if (overload) for (const x of units) if (x.useInv) {
    if (x.bypassFeed) { x.useInv = false; overloadBypass = true; }                    // con tensión de entrada, la sobrecarga pasa la UPS a bypass
    else if (sobreCorte) { x.useInv = false; x.shut = true; }                          // sin entrada: del 100 % al 115 % sigue entregando con aviso; sobre el 115 % corta la carga
  }

  for (const x of units) {
    x.mode = x.stateFault ? 'falla' : x.stateOff ? 'apagada' : x.shut ? 'none' : x.useInv ? (x.rect ? 'normal' : 'bateria') : x.bypassFeed ? 'bypass' : (x.byp && x.present) ? 'transfer' : 'none';
    x.deliver = ['normal', 'bateria', 'bypass'].includes(x.mode) && x.outClosed && !x.standby;   // entrega al bus de salida a través de su CB de salida
    x.charging = x.rect && x.banks && S.soc[units.indexOf(x)] < 100;
    x.discharging = x.mode === 'bateria' && x.deliver && selUps && S.CB.CB6;
  }

  const busUps = units.filter(x => x.deliver);                    // las que alimentan el bus de salida de las UPS
  const del = selUps ? busUps : [];                               // las que alimentan la carga (el conmutador debe estar en 1)
  const nM = units.filter(x => x.present).length;
  const nB = units.reduce((a, x) => a + (x.banks && !x.stateFault ? x.nAct : 0), 0);
  const cap = units.filter(x => x.inv && x.outClosed && !x.standby).length * UPS_KW;   // capacidad de las UPS que pueden entregar: con la salida de una abierta (o en stand by) solo quedan 10, no 20

  // bypass de rodeo: la red alimenta la carga directo, por fuera de las UPS.
  //  · Conmutador 1-0-2 (posición 2): siempre pasa por 0, así red e inversor nunca quedan unidos.
  //  · Interruptor CB7: puede cerrarse con una UPS en inversor; red e inversor se unen sin sincronizar y las UPS entran en falla.
  const rodeo = gen && (conm ? S.sel === 2 : S.CB.CB7);
  const rodeoFalla = !conm && rodeo && del.some(x => x.mode === 'normal' || x.mode === 'bateria');

  const out = (del.length > 0 || rodeo) && S.CB.CB6;              // la carga recibe energía si hay UPS entregando (o el rodeo) y la salida general cerrada
  const src = !del.length ? (rodeo ? 'rodeo' : 'none') : del.some(x => x.mode === 'normal') ? 'normal' : del.some(x => x.mode === 'bateria') ? 'bateria' : 'bypass';
  const modes = units.filter(x => x.present && !x.standby && !x.stateFault && !x.stateOff).map(x => x.mode);
  const mode0 = !modes.length ? (units.some(x => x.present && x.stateOff && !x.stateFault) ? 'apagada' : 'none') : modes.every(m => m === modes[0]) ? modes[0] : 'mixto';
  const mode = rodeo && !del.length ? 'rodeo' : mode0;

  return { gen, units, del, nM, nB, cap, overload, overloadSuave: overload && units.some(x => x.useInv), redundancyLost, overloadBypass, src, mode, out, inv: units.some(x => x.inv), bypassFeed: units.some(x => x.bypassFeed), busUps, rodeo, rodeoFalla, conm, selUps, sel: S.sel };
}
