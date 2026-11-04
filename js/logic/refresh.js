/* Recalcula el estado eléctrico y repinta solo cuando algo cambió (firma JSON del estado relevante). */
import { S, E, setE } from '../state.js';
import { compute } from './electrical.js';
import { applyVisuals, applyLive } from '../ui/visuals.js';

let lastSig = '';

export function refresh() {
  setE(compute());
  const sig = JSON.stringify([S.mains, S.CB, S.byp, E.nM, E.nB, E.src, E.mode, E.overload,
    E.units.map(x => [x.mode, x.standby, x.stateFault, x.stateOff, x.deliver, x.charging, x.discharging, x.rect, x.batOk, x.present, x.inAvail, x.nAct, x.cfg, x.bk.join('')].join()),
    S.soc.map(v => v < 20), S.risk, S.fault, S.sel, S.bypassMode, S.tripped]);
  if (sig !== lastSig) { lastSig = sig; applyVisuals(); applyLive(); }
}
