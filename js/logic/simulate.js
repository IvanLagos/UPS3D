/* Evolución en el tiempo: stand by, fallas por rodeo, apagado sin entrada, arranque de UPS y carga/descarga de baterías.
   Una simulación acelerada: 1 segundo real = 1 minuto de funcionamiento. */
import { toast } from '../core/interaction.js';
import { S, E } from '../state.js';
import { BANK_KWH, CHARGE_KW } from '../config.js';
import { powerMods } from '../model/modules.js';
import { syncSwitches } from '../ui/sync.js';

export function simulate(dt) {
  const sim = dt * 60 / 3600;   // horas simuladas
  const share = E.out && E.del.length ? S.load / E.del.length : 0;

  S.standby.forEach((on, u) => {
    if (!on) return;
    if (!E.units[u].inAvail) {          // en stand by, al abrir la entrada la UPS pierde el suministro y se apaga
      S.standby[u] = false; S.off[u] = true; S.manual[u] = true;
      toast(`UPS ${u + 1} apagada: perdió el suministro estando en stand by`); syncSwitches(); return;
    }
    if (S.CB.CB6 && !E.rodeo && !(E.units[1 - u].deliver && (E.units[1 - u].mode === 'bypass' || S.load <= 10))) {
      S.standby[u] = false; toast(`UPS ${u + 1} retoma la carga: la UPS ${2 - u} ya no puede sostenerla sola`); syncSwitches();
    }
  });

  if (E.rodeoFalla) {                  // red e inversor unidos sin sincronizar: ambas UPS quedan en falla
    E.units.forEach((x, u) => { if (x.present) { S.fault[u] = true; S.standby[u] = false; } });
    toast('Bypass de rodeo (CB7) cerrado con las UPS en inversor: la red y el inversor se unen sin sincronizar. Ambas UPS entran en FALLA');
    syncSwitches();
  }

  powerMods.forEach((m, u) => { if (m.userData.state !== 'in') { S.risk[u] = false; S.fault[u] = false; } });

  E.units.forEach((x, u) => {
    // en bypass sin tensión en la entrada: la carga cae y a los 2 s la UPS se apaga
    if (S.byp[u] && x.present && !x.inAvail && !S.off[u]) {
      S.dropT[u] += dt;
      if (S.dropT[u] >= 2) { S.off[u] = true; S.dropT[u] = 0; toast(`UPS ${u + 1} apagada: sin tensión en la entrada en modo bypass`); }
    } else S.dropT[u] = 0;

    if (!x.inv && !x.bypassFeed) S.risk[u] = false;   // el riesgo se despeja cuando la UPS queda apagada

    if (S.off[u] && x.inAvail) {                      // al recibir tensión la UPS arranca
      const desdeStandby = S.manual[u];
      S.off[u] = false; S.manual[u] = false;
      if (desdeStandby) {                             // la que se apagó en stand by arranca directo en inversor, lee la salida y se sincroniza sola
        S.byp[u] = false;
        toast(`UPS ${u + 1} arrancó en inversor (venía de stand by): leyó la salida y se sincronizó automáticamente`);
      } else {                                        // las demás arrancan en bypass; por el cable de comunicación arrastran a todo el sistema
        S.byp = [true, true];
        toast(`UPS ${u + 1} arrancó en bypass estático: por el cable de comunicación todo el sistema queda en bypass. Use INV para volver a inversor`);
      }
      syncSwitches();
    }

    const kwh = BANK_KWH * x.nAct;                    // energía de los bancos en uso
    if (x.discharging && kwh) S.soc[u] = Math.max(0, S.soc[u] - (share * sim / kwh) * 100);
    else if (x.charging && kwh) S.soc[u] = Math.min(100, S.soc[u] + (CHARGE_KW * sim / kwh) * 100);
  });
}
