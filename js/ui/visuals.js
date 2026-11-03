/* Representación del estado: LEDs y palancas del rack, luz de la carga, diagrama unifilar, alarmas,
   métricas del panel y pantallas de las UPS. */
import { $ } from '../core/dom.js';
import { tween } from '../core/tween.js';
import { S, E } from '../state.js';
import { BREAKERS, CB_IN, CB_OUT, MODE_TXT, BANK_KWH } from '../config.js';
import { powerMods, battMods } from '../model/modules.js';
import { breakers } from '../model/breakerPanel.js';
import { bulbMat, cableMat, lossMark } from '../model/load.js';
import { paintUpsButtons } from './sync.js';

const svgSet = (id, on, cls = '') => {
  const el = $('#' + id);
  el.classList.toggle('live', !!on);
  for (const c of ['rev', 'byp', 'bat', 'bad']) el.classList.toggle(c, !!on && c === cls);
};
const nodeSet = (id, on, warn) => { const el = $('#' + id); el.classList.toggle('on', !!on && !warn); el.classList.toggle('warn', !!on && !!warn); };
const setLed = (mat, hex, dim = 0x222222) => { mat.emissive.setHex(hex); mat.color.setHex(hex || dim); };

/** Repinta el rack 3D, el diagrama unifilar y la lista de alarmas. */
export function applyVisuals() {
  const { units, out, gen } = E;

  powerMods.forEach((m, u) => setLed(m.userData.ledMat, m.userData.state === 'in' && units[u].stateFault ? 0xff3030 : m.userData.state === 'in' && units[u].inv ? 0x22ff88 : 0));
  paintUpsButtons();
  for (const m of battMods) {
    const x = units[m.userData.unit];
    const bad = m.userData.state === 'in' && S.bankFault[m.userData.unit][m.userData.n];
    const on = m.userData.state === 'in' && x.act[m.userData.n] && (x.charging || x.discharging);
    setLed(m.userData.ledMat, bad ? 0xff3030 : on ? (x.discharging ? 0xffb020 : 0x3aa0ff) : 0);
  }

  // palancas y pilotos de los automáticos
  const lamp = { CB1: units[0].inAvail, CB2: units[0].deliver, CB3: units[1].inAvail, CB4: units[1].deliver, CB5: gen, CB6: out, CB7: E.rodeo };
  for (const { id } of BREAKERS) {
    const b = breakers[id], closed = S.CB[id];
    tween(b.lever.position, 'y', b.y + (closed ? 0.011 : -0.011), 0.25);
    b.leverMat.color.setHex(closed ? 0x2fd27a : 0x888f99);
    b.leverMat.emissive.setHex(closed ? 0x0c4a2a : 0x000000);
    setLed(b.lampMat, lamp[id] ? 0x00ff55 : 0, 0x0a5222);
    setLed(b.redMat, !closed ? 0xff1010 : 0, 0x560c0c);
  }

  // luz de la carga: verde tipo semáforo, sin resplandor; si se pierde la carga se apaga y aparece una X roja
  bulbMat.color.setHex(out ? 0x00b84a : 0x1a1d1b);     // apagada: gris oscuro
  bulbMat.emissive.setHex(out ? 0x00b84a : 0x000000);
  bulbMat.emissiveIntensity = out ? 0.9 : 0;
  lossMark.visible = !out;                              // sin energía: X roja sobre la carga
  cableMat.emissive.setHex(out ? 0x1fa85f : 0x000000);

  applyUnifilar();
  applyAlarms();
}

/** Diagrama unifilar: la red en amarillo, lo posterior al rectificador/inversor en verde. */
function applyUnifilar() {
  const { units, out, src, gen } = E;
  const anyBypass = src === 'bypass';
  svgSet('w_g1', S.mains, 'byp'); svgSet('w_g2', gen, 'byp'); svgSet('w_bus', gen, 'byp');
  units.forEach((x, u) => {
    const n = u + 1, norm = x.mode === 'normal' || x.mode === 'bateria', byp = x.mode === 'bypass';
    const batFlow = x.batOk || x.charging;
    svgSet(`w_i${n}a`, gen, 'byp'); svgSet(`w_i${n}b`, x.inAvail, 'byp'); svgSet(`w_i${n}bb`, x.bypassFeed, 'byp');
    svgSet(`w_i${n}r`, x.rect); svgSet(`w_i${n}d`, x.inv);
    $(`#dc${n}`).classList.toggle('live', x.dc);
    svgSet(`w_i${n}t`, batFlow, x.discharging ? 'rev' : 'bat');
    [0, 1].forEach(b => {
      svgSet(`w_i${n}t${b + 1}`, batFlow && x.act[b], x.discharging ? 'rev' : 'bat');
      const el = $(`#n_bat${n}_${b + 1}`);
      el.classList.toggle('fault', x.bk[b] === 'fault');
      el.classList.toggle('miss', x.bk[b] === 'miss');
      el.classList.toggle('skip', x.bk[b] === 'ok' && !x.act[b]);
      el.classList.toggle('on', x.act[b] && batFlow);
    });
    $(`#cfg${n}`).textContent = `Bancos ${x.nAct}/${x.cfg}`;
    svgSet(`w_i${n}o`, norm); svgSet(`w_i${n}y`, byp, 'byp');
    svgSet(`w_i${n}q`, ['normal', 'bateria', 'bypass'].includes(x.mode), byp ? 'byp' : '');
    svgSet(`w_i${n}z`, x.deliver, byp ? 'byp' : '');
    nodeSet(`n_rect${n}`, x.rect); nodeSet(`n_inv${n}`, norm); nodeSet(`n_byp${n}`, byp, true);
    $(`#blk${n}`).classList.toggle('off', !x.present);
    $(`#blk${n}`).classList.toggle('fault', x.stateFault);
    $(`#x${n}`).classList.toggle('show', x.stateFault);
  });
  const rod = E.rodeo, byColor = anyBypass || (rod && !E.del.length) ? 'byp' : '';
  svgSet('w_r1', gen, 'byp'); svgSet('w_r2', rod, 'byp');
  svgSet('w_ob', E.del.length > 0 || rod, byColor);
  svgSet('w_os', E.del.length > 0 || rod, byColor);
  svgSet('w_ol', out, byColor);
  nodeSet('n_red', S.mains, true); nodeSet('n_load', out, anyBypass || (rod && !E.del.length));
  document.querySelectorAll('#uni .brk').forEach(g => {
    const closed = S.CB[g.dataset.cb], l = g.querySelector('line');
    g.classList.toggle('closed', closed);
    l.setAttribute('x1', closed ? 0 : -4); l.setAttribute('x2', closed ? 0 : 4);
    l.setAttribute('y1', closed ? -5 : 5); l.setAttribute('y2', closed ? 5 : -5);
  });
}

function applyAlarms() {
  const { units, out, src, gen } = E;
  const al = [];
  if (E.rodeo) al.push(['Bypass de rodeo cerrado (CB7): la red alimenta el bus de salida por fuera de las UPS', '']);
  if (!S.mains) al.push(['Falla de red eléctrica', 'bad']);
  else if (!S.CB.CB5) al.push(['General abierto (CB5): sin tensión en las UPS', 'bad']);
  if (E.overload) al.push([E.overloadBypass ? 'Sobrecarga: transferido a bypass' : 'Sobrecarga: inversor apagado', 'bad']);
  units.forEach((x, u) => {
    const n = u + 1;
    if (!x.present) return;
    if (gen && !S.CB[CB_IN[u]] && x.mode !== 'apagada') al.push([`Entrada UPS ${n} abierta (${CB_IN[u]}): ${x.banks ? 'opera solo con baterías' : 'apagada, sin respaldo'}`, 'bad']);
    if (S.risk[u]) al.push([`UPS ${n}: maniobra de salida con la UPS en servicio, riesgo de daño en la tarjeta`, 'bad']);
    if (x.standby) al.push([`UPS ${n} en stand by: su carga está en la UPS ${2 - u}. Para retirarla abra ${CB_IN[u]} y luego ${CB_OUT[u]}`, '']);
    if (x.stateFault) al.push([`FALLA en la UPS ${n}: aislada del sistema${E.units[1 - u].deliver ? `, la carga la sostiene la UPS ${2 - u}` : ''}`, 'bad']);
    if (!S.CB[CB_OUT[u]]) al.push([`Salida UPS ${n} abierta (${CB_OUT[u]}): aislada de la carga`, 'bad']);
    if (x.mode === 'transfer' && x.outClosed) al.push([`UPS ${n} sin tensión en la entrada en bypass: la carga cayó y se apagará en ${Math.max(0, 2 - S.dropT[u]).toFixed(1)} s`, 'bad']);
    if (x.mode === 'apagada') al.push(S.manual[u] ? [`UPS ${n} apagada tras perder el suministro en stand by: la carga sigue en la UPS ${2 - u}. Puede abrir ${CB_OUT[u]} y retirarla`, ''] : S.byp[u] ? [`UPS ${n} apagada: perdió la entrada estando en bypass`, 'bad'] : [`UPS ${n} apagada: espera tensión en su entrada (${CB_IN[u]}) para arrancar`, '']);
    if (x.healthy < x.cfg) {
      const probs = x.bk.map((s, b) => (s === 'fault' ? `banco ${b + 1} en falla` : s === 'miss' ? `banco ${b + 1} no instalado` : null)).filter(Boolean).join(' y ');
      al.push([`UPS ${n}: ${probs}; baterías inhibidas (configurada para ${x.cfg} banco${x.cfg > 1 ? 's' : ''}). ${x.healthy ? `Use BAT en la UPS para operar con ${x.healthy} banco` : 'Sin respaldo de baterías'}`, 'bad']);
    } else if (x.nAct < x.healthy) al.push([`UPS ${n} opera con ${x.nAct} de ${x.healthy} bancos sanos (configuración de la UPS)`, '']);
    if (x.discharging && S.soc[u] < 20) al.push([`Batería baja en UPS ${n}`, 'bad']);
  });
  if (out && src === 'bypass') al.push([S.byp.some(Boolean) ? 'Bypass estático ordenado desde la UPS: la carga no tiene respaldo' : 'Operando en bypass: la carga no tiene respaldo', '']);
  if (out && E.del.some(x => x.mode === 'bateria')) al.push(['Funcionando con baterías', '']);
  if (E.nM === 0) al.push(['Sin UPS instaladas', 'bad']);
  else if (E.nM === 1) al.push(['Una sola UPS operativa: sin redundancia', '']);
  if (!S.CB.CB6) al.push(['Salida general abierta (CB6): carga desenergizada', 'bad']);
  else if (!out) al.push(['Sin alimentación en la salida', 'bad']);
  $('#alarms').innerHTML = (al.length ? al : [['Sin alarmas · sistema normal', 'ok']]).map(([t, c]) => `<li class="${c}">${t}</li>`).join('');
}

/** Autonomía restante (minutos) con la carga actual, o null si no hay carga o baterías. */
function autonomy(units) {
  const kwh = units.reduce((a, x, u) => a + (x.banks && !x.stateFault ? BANK_KWH * x.nAct * S.soc[u] / 100 : 0), 0);
  return S.load > 0 && kwh > 0 ? kwh / S.load * 60 : null;
}

/** Métricas del panel lateral y pantallas de las UPS (se llama unas 4 veces por segundo). */
export function applyLive() {
  const { units, nB, cap, mode } = E;
  $('#mMode').textContent = MODE_TXT[mode];
  $('#mCap').textContent = `${cap} kW`;
  const withBanks = units.map((x, u) => (x.banks ? S.soc[u] : null)).filter(v => v !== null);
  $('#mSoc').textContent = withBanks.length ? `${Math.round(withBanks.reduce((a, b) => a + b, 0) / withBanks.length)} %` : '—';
  const aut = autonomy(units);
  $('#mAut').textContent = nB === 0 ? '0 min' : aut === null ? '—' : `${Math.round(aut)} min`;
  drawScreen();
}

/** Dibuja la pantalla de cada UPS. */
function drawScreen() {
  const share = E.out && E.del.length ? S.load / E.del.length : 0;
  powerMods.forEach((m, u) => {
    const x = E.units[u], { ctx: sg, tex } = m.userData.scr;
    const col = x.standby ? '#6cb8ff' : x.mode === 'normal' ? '#3dff95' : x.mode === 'none' || x.mode === 'apagada' ? '#ff6b6b' : '#ffc233';
    const autU = x.banks && share > 0 ? BANK_KWH * x.nAct * S.soc[u] / 100 / share * 60 : null;
    sg.fillStyle = x.mode === 'apagada' ? '#000' : '#06120c'; sg.fillRect(0, 0, 300, 100);
    if (x.mode === 'apagada') { tex.needsUpdate = true; return; }   // UPS apagada: pantalla en blanco
    if (x.mode === 'falla') {
      sg.fillStyle = '#ff6b6b'; sg.font = 'bold 20px monospace'; sg.textBaseline = 'top';
      sg.fillText(`UPS${u + 1} FALLA`, 10, 8);
      sg.fillStyle = '#ffb3b3'; sg.font = '18px monospace';
      sg.fillText('FUERA DE SERVICIO', 10, 40); sg.fillText('REVISE EL EQUIPO', 10, 66);
      tex.needsUpdate = true; return;
    }
    sg.fillStyle = col; sg.font = 'bold 20px monospace'; sg.textBaseline = 'top';
    sg.fillText(`UPS${u + 1} ${x.standby ? 'STAND BY' : MODE_TXT[x.mode].toUpperCase()}`.slice(0, 22), 10, 8);
    sg.fillStyle = '#9fe9bf'; sg.font = '18px monospace';
    sg.fillText(x.standby ? `CARGA EN UPS ${2 - u}` : x.mode === 'transfer' ? `SIN ENTRADA ${Math.max(0, 2 - S.dropT[u]).toFixed(1)}s` : `CARGA ${x.deliver ? share.toFixed(1) : 0}/10 kW`, 10, 40);
    sg.fillText(x.banks ? `BAT ${Math.round(S.soc[u])}% AUT ${autU === null ? '--' : Math.round(autU) + 'm'}` : 'SIN BATERIAS', 10, 62);
    sg.fillStyle = x.healthy < x.cfg ? '#ff6b6b' : '#9fe9bf';
    sg.fillText(x.healthy < x.cfg ? `ALARMA BANCOS ${x.healthy}/${x.cfg}` : `BANCOS EN USO ${x.nAct}/${x.cfg}`, 10, 82);
    tex.needsUpdate = true;
  });
}
