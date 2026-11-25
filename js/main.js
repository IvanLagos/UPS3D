/* Punto de entrada: carga los módulos, arma el panel y corre el bucle de animación y simulación. */
import * as THREE from 'three';
import { view } from './core/dom.js';
import { renderer, scene, camera, controls, resize } from './core/scene.js';
import { stepTweens } from './core/tween.js';
import { toast, updateHover } from './core/interaction.js';
import { S, E } from './state.js';
import { fans } from './model/rack.js';
import './model/doors.js';
import './model/breakerPanel.js';
import './model/circuito.js';
import './model/boardCover.js';
import './model/modules.js';
import './model/load.js';
import './logic/actions.js';                // registra las acciones que invoca el modelo 3D
import { simulate } from './logic/simulate.js';
import { refresh } from './logic/refresh.js';
import { applyLive } from './ui/visuals.js';
import { updateCircuito } from './model/circuito.js';
import { syncSwitches } from './ui/sync.js';
import { initControls } from './ui/controls.js';
import './ui/zoom.js';
import { armarPestanas } from './ui/pestanas.js';

new ResizeObserver(resize).observe(view);
resize();
initControls();
refresh();
syncSwitches();
{                                                                       // controles en pestañas; el montaje de las UPS es un grupo más de la pestaña «UPS»
  const montaje = document.querySelector('#panel .montaje');
  const panelBase = armarPestanas(document.querySelector('#panel > .cols'));
  montaje.open = true;                                                  // siempre a la vista, con sus dos botones pequeños
  montaje.title = montaje.querySelector('p.note').textContent.trim();
  montaje.querySelector('summary').tabIndex = -1;
  panelBase.tabs.get('UPS').hoja.querySelector('section').appendChild(montaje);
  window.__panelBase = panelBase;                                       // SONACOL le agrega la pestaña del tablero externo (circuito 4)
}

// la simulación arrancó
window.__appStarted = true;
document.getElementById('fallo')?.remove();

const clock = new THREE.Clock();
let fanSpeed = 0;
let acc = 0;

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  stepTweens(dt);
  // si la lógica falla, el 3D no se congela: se registra el error una vez y se sigue dibujando
  try {
    updateCircuito();                     // los cables de los pilotos siguen a la cubierta cuando se abre
    refresh();
    simulate(dt);
    acc += dt;
    if (acc > 0.25) { acc = 0; applyLive(); }
    fanSpeed += ((E.inv || E.out ? 5 + S.load * 1.2 : 0) - fanSpeed) * Math.min(1, dt * 1.5);
    for (const f of fans) f.rotation.z -= fanSpeed * dt;
  } catch (err) {
    if (!window.__errLogged) { window.__errLogged = true; console.error('Error en la simulación:', err); toast('Error interno en la simulación. Recargue la página.'); }
  }
  updateHover();
  controls.update();
  renderer.render(scene, camera);
});
