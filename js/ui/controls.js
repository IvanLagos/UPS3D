/* Panel lateral: filas de automáticos, botones, interruptores, cámaras y captura de pantalla. */
import { $ } from '../core/dom.js';
import { tween } from '../core/tween.js';
import { toast } from '../core/interaction.js';
import { renderer, scene, camera, controls } from '../core/scene.js';
import { S } from '../state.js';
import { ALL_CB } from '../config.js';
import { doorF, doorR } from '../model/doors.js';
import {
  setDoor, setSides, setCover, setBypass, setTransfer, setFault, setBanks, setBankFault,
  toggleBreaker, setBreakerManual, setSelector, setBypassMode,
} from '../logic/actions.js';
import { montar, desmontar } from '../logic/sequences.js';
import { syncSwitches } from './sync.js';

const CAMS = {
  front: [[0, 1.15, 3.4], [0, 1.0, 0]],
  iso:   [[1.5, 1.45, 2.1], [0, 1.0, 0.2]],
  side:  [[3.6, 1.3, 0.3], [0, 1.0, 0]],
  top:   [[0.4, 4.4, 2.2], [0, 0.9, 0]],
};

function flyTo(key) {
  const [p, t] = CAMS[key];
  ['x', 'y', 'z'].forEach((k, i) => { tween(camera.position, k, p[i], 1); tween(controls.target, k, t[i], 1); });
}

function buildBreakerRows() {
  const rows = $('#breakerRows');
  for (const { id, name } of ALL_CB) {
    const l = document.createElement('label'); l.className = 'sw'; l.id = 'row' + id;
    l.innerHTML = `<span>${id} · ${(name[0] + name.slice(1).toLowerCase()).replace('ups', 'UPS')}<small id="bs_${id}"></small></span><input type="checkbox" id="sw_${id}">`;
    rows.appendChild(l);
    l.querySelector('input').addEventListener('change', e => { setBreakerManual(id, e.target.checked); syncSwitches(); });
  }
}

/** Expande una zona (simulación 3D o unifilar) a pantalla completa y la vuelve a su lugar; solo una a la vez. */
const EXPANDIBLES = [{ box: '#view', btn: '#btnExpand3d' }, { box: '#unifilar', btn: '#btnExpand' }];
function setExpanded(boxSel, on) {
  for (const z of EXPANDIBLES) {
    const open = on && z.box === boxSel;
    $(z.box).classList.toggle('expanded', open);
    $(z.btn).textContent = open ? '✕ Cerrar' : '⤢ Expandir';
  }
}

export function initControls() {
  buildBreakerRows();

  for (const z of EXPANDIBLES) $(z.btn).onclick = () => setExpanded(z.box, !$(z.box).classList.contains('expanded'));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setExpanded(null, false); });

  $('#btnMontar').onclick = montar;
  $('#btnDesmontar').onclick = desmontar;

  $('#swMains').onchange = e => { S.mains = e.target.checked; toast(S.mains ? 'Red restablecida' : 'Corte de red eléctrica'); };
  $('#load').oninput = e => { S.load = +e.target.value; $('#loadVal').textContent = `${S.load} kW`; };

  $('#btnInv').onclick = () => setBypass(false);
  $('#btnByp').onclick = () => setBypass(true);
  [0, 1].forEach(u => {
    $('#btnT' + u).onclick = () => setTransfer(u);
    $('#btnF' + u).onclick = () => setFault(u);
    $('#btnC' + u).onclick = () => setBanks(u);
    [0, 1].forEach(b => { $(`#btnB${u}${b}`).onclick = () => setBankFault(u, b); });
  });

  $('#swFront').onchange = e => setDoor(doorF, e.target.checked);
  $('#swRear').onchange = e => setDoor(doorR, e.target.checked);
  $('#swSides').onchange = e => setSides(e.target.checked);
  $('#swCover').onchange = e => setCover(e.target.checked);

  // configuración del bypass de rodeo (botón del diagrama unifilar)
  $('#btnModeConm').onclick = () => setBypassMode('conmutador');
  $('#btnModeRodeo').onclick = () => setBypassMode('rodeo');

  // conmutador bypass 1-0-2: botones del panel y posiciones del diagrama unifilar
  document.querySelectorAll('[data-sel]').forEach(el => el.addEventListener('click', () => setSelector(+el.dataset.sel)));

  // los automáticos del diagrama unifilar también se operan con clic
  document.querySelectorAll('#uni .brk').forEach(g => g.addEventListener('click', () => toggleBreaker(g.dataset.cb)));

  document.querySelectorAll('.cam').forEach(b => b.onclick = () => flyTo(b.dataset.cam));
  $('#btnShot').onclick = () => {
    renderer.render(scene, camera);
    renderer.domElement.toBlob(b => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'ups-modular-3d.png'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
  };
}
