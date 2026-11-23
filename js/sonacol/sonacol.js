/* SONACOL: cuatro circuitos con selector en pantalla.
   1 · 2 UPS de 6 kVA en serie   2 · 2 UPS de 10 kVA con 2 STS   3 · 2 UPS en paralelo redundante con bypass de rodeo (el de OXIQUIM, sin la llave selectora).
   4 · el circuito 3 más un tablero externo de bypass con 3 automáticos (ver externo.js).
   Se carga después de main.js; el circuito 3 sigue siendo el modelo de siempre y los otros dos viven en su propio grupo 3D. */
import * as THREE from 'three';
import { $ } from '../core/dom.js';
import { scene, camera, controls } from '../core/scene.js';
import { tween } from '../core/tween.js';
import { S } from '../state.js';
import { syncSwitches } from '../ui/sync.js';
import { SC, paso, calc1, calc2 } from './logica.js';
import { g1, g2, cb, aplicar1, aplicar2, pantallas1, pantallas2, girar } from './escena.js';
import { iniciarUi, mostrarUi, refrescarUi, alternar, ordenarModo } from './ui.js';
import { gExt, iniciarExterno, activarExterno, aplicarExterno, refrescarExterno } from './externo.js';

const CIRCUITOS = {
  1: { ruta: 'circuito-1', boton: 'Circuito 1 · 2 UPS en serie (6 kVA)', titulo: '2 UPS de 6 kVA en serie', sub: 'Circuito 1 · RED → UPS A → UPS B → carga regulable (máx. 6 kVA) · 220–240 VAC' },
  2: { ruta: 'circuito-2', boton: 'Circuito 2 · 2 UPS de 10 kVA con 2 STS', titulo: '2 UPS de 10 kVA con 2 STS', sub: 'Circuito 2 · 2 UPS cruzadas con 2 STS (fuentes A y B) y 2 cargas · 220–240 VAC' },
  3: { ruta: 'circuito-3', boton: 'Circuito 3 · Paralelo con bypass de rodeo', titulo: 'Paralelo redundante', sub: 'Circuito 3 · 2 UPS de 10 kVA en paralelo redundante (N+1) con bypass de rodeo · 220–240 VAC' },
  4: { ruta: 'circuito-4', boton: 'Circuito 4 · Paralelo con bypass de tablero externo', titulo: 'Paralelo redundante con tablero externo', sub: 'Circuito 4 · el circuito 3 más un tablero externo de bypass: entrada (CB8), bypass externo (CB9) y salida (CB10) · 220–240 VAC' },
};

/* lo que ya está en la escena (circuito 3): se oculta con los otros circuitos; quedan siempre el piso, la cuadrícula y las luces */
const delCircuito3 = scene.children.filter(o => !o.isLight && !o.isLineSegments && !(o.isMesh && o.geometry.type === 'ShapeGeometry') && o !== g1 && o !== g2 && o !== gExt);
const visibleAntes = new Map(delCircuito3.map(o => [o, o.visible]));

/* en SONACOL el diagrama unifilar ocupa la columna derecha (más grande) y el panel de controles queda bajo el 3D */
$('#left').append($('#panel'));
$('#app').append($('#unifilar'));

/* el circuito 3 de SONACOL no lleva la llave selectora: queda solo el bypass de rodeo con interruptor CB7 */
S.bypassMode = 'rodeo'; S.sel = 1; S.CB.CB7 = false;
syncSwitches();
$('.modesel').style.display = 'none';

/* selector de circuito, arriba del panel */
const barra = document.createElement('div');
barra.className = 'circuitos';
barra.innerHTML = '<span>Circuito:</span><div class="circ-botones">' + Object.entries(CIRCUITOS).map(([n, c]) => `<button type="button" class="sm" data-circ="${n}">${c.boton}</button>`).join('') + '</div>';
$('#panel header').prepend(barra);
barra.querySelectorAll('button').forEach(b => b.addEventListener('click', () => elegir(+b.dataset.circ)));

iniciarUi(() => { pendiente = true; });
iniciarExterno();
cb.toggle = (n, i) => { alternar(n, i); pendiente = true; };
cb.modo = (n, u, bypass) => { ordenarModo(n, u, bypass); pendiente = true; };

let pendiente = true, acc = 1;
const circuitoDeRuta = () => {
  const m = decodeURIComponent(location.hash).match(/circuito-([1234])/i);
  return m ? +m[1] : 1;
};

function elegir(n) {
  SC.activo = n;
  window.__sonacolActivo = n;                                 // el circuito 3 solo maneja el letrero de redundancia cuando es el que se ve
  if (n < 3) $('#avisoRedund').hidden = true;
  barra.querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.circ === n));
  const c3 = n >= 3;                                          // los circuitos 3 y 4 usan el modelo base del circuito 3
  delCircuito3.forEach(o => { o.visible = c3 && visibleAntes.get(o); });
  activarExterno(n === 4);                                    // después de mostrar el modelo base: mueve la carga y oculta su cable cuando va el tablero externo
  g1.visible = n === 1; g2.visible = n === 2;
  $('#panel .montaje').style.display = c3 ? '' : 'none';
  $('#panel > .cols').style.display = c3 ? '' : 'none';
  $('#uni').style.display = c3 ? '' : 'none';
  $('#sonPanel').style.display = c3 ? 'none' : '';
  $('#sonUni').style.display = c3 ? 'none' : '';
  if (!c3) mostrarUi(n);
  $('#panel header h1').textContent = CIRCUITOS[n].titulo;
  $('#panel header p').textContent = CIRCUITOS[n].sub;
  const ruta = `#/sonacol/${CIRCUITOS[n].ruta}`;
  if (location.hash !== ruta) history.replaceState(null, '', location.pathname + location.search + ruta);
  pendiente = true; acc = 1;
}
/* cámaras del circuito 4: más abiertas, para ver el rack, el tablero externo y la carga */
const CAMS4 = { front: [[1.0, 1.2, 5.6], [1.0, 0.9, 0]], iso: [[3.4, 1.8, 4.2], [1.0, 0.9, 0.2]], side: [[5.5, 1.4, 0.3], [1.0, 0.9, 0]], top: [[1.1, 6.0, 2.6], [1.0, 0.9, 0]] };
document.querySelectorAll('.cam').forEach(b => b.addEventListener('click', e => {
  if (SC.activo !== 4) return;
  e.stopImmediatePropagation();
  const [p, t] = CAMS4[b.dataset.cam];
  ['x', 'y', 'z'].forEach((k, i) => { tween(camera.position, k, p[i], 1); tween(controls.target, k, t[i], 1); });
}, true));
window.addEventListener('hashchange', () => { const n = circuitoDeRuta(); if (n !== SC.activo && /circuito-/i.test(location.hash)) elegir(n); });

let antes = performance.now();
function bucle(t) {
  const dt = Math.min((t - antes) / 1000, 0.1); antes = t;
  try {
    paso(dt);
    const n = SC.activo;
    if (n === 4) { aplicarExterno(); refrescarExterno(); }
    if (n === 1 || n === 2) {
      acc += dt;
      const lento = acc > 0.25 || pendiente;
      const r = n === 1 ? calc1() : calc2();
      (n === 1 ? aplicar1 : aplicar2)(r);
      girar(n, dt, r.u.some(x => x.vivo) ? 6 : 0);
      $('#avisoRedund').hidden = !(n === 2 && r.sinRedund);
      refrescarUi(n, r, lento);
      if (lento) { (n === 1 ? pantallas1 : pantallas2)(r); acc = 0; pendiente = false; }
    }
  } catch (err) {
    if (!window.__errSon) { window.__errSon = true; console.error('Error en los circuitos de SONACOL:', err); }
  }
  requestAnimationFrame(bucle);
}
elegir(circuitoDeRuta());
requestAnimationFrame(bucle);
