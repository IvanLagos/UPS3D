/* Sincroniza los controles del panel lateral y la iluminación de los botones de las UPS con el estado actual. */
import { $ } from '../core/dom.js';
import { S, E } from '../state.js';
import { BREAKERS } from '../config.js';
import { doorF, doorR } from '../model/doors.js';
import { sidesAreClosed } from '../model/rack.js';
import { powerMods, upsBtns } from '../model/modules.js';

/** Los botones de una UPS apagada no iluminan. */
export function paintUpsButtons() {
  powerMods.forEach((m, u) => {
    const off = E.units[u].mode === 'apagada';
    upsBtns.inv[u].emissiveIntensity = off ? 0 : S.byp[u] ? 0.15 : 1.2;
    upsBtns.byp[u].emissiveIntensity = off ? 0 : S.byp[u] ? 1.2 : 0.15;
    upsBtns.tr[u].emissiveIntensity = off ? 0 : S.standby.some(Boolean) ? 1.2 : 0.15;
    upsBtns.bat[u].emissiveIntensity = off ? 0 : S.cfg[u] < 2 ? 1.2 : 0.15;
  });
}

export function syncSwitches() {
  for (const { id } of BREAKERS) {
    $('#sw_' + id).checked = S.CB[id];
    $('#bs_' + id).textContent = S.CB[id] ? 'Cerrado · deja pasar energía' : 'Abierto · corta el paso';
  }
  $('#swMains').checked = S.mains;
  [0, 1].forEach(u => {
    $('#btnC' + u).textContent = `UPS ${u + 1}: ${S.cfg[u]} banco${S.cfg[u] > 1 ? 's' : ''}`;
    $('#btnC' + u).classList.toggle('on', S.cfg[u] < 2);
    [0, 1].forEach(b => $(`#btnB${u}${b}`).classList.toggle('on', S.bankFault[u][b]));
  });
  $('#btnInv').classList.toggle('on', !S.byp.some(Boolean));
  $('#btnByp').classList.toggle('on', S.byp.some(Boolean));
  paintUpsButtons();
  for (const u of [0, 1]) {
    $('#btnT' + u).textContent = S.standby[u] ? `UPS ${u + 1} en stand by · retomar carga` : `Traspasar UPS ${u + 1} → UPS ${2 - u} (stand by)`;
    $('#btnT' + u).classList.toggle('on', S.standby[u]);
  }
  for (const u of [0, 1]) {
    $('#btnF' + u).textContent = S.fault[u] ? `UPS ${u + 1} en falla · restablecer` : `Falla UPS ${u + 1}`;
    $('#btnF' + u).classList.toggle('bad', S.fault[u]);
  }
  $('#swFront').checked = doorF.userData.open;
  $('#swRear').checked = doorR.userData.open;
  $('#swSides').checked = sidesAreClosed();
}
