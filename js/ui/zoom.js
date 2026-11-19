/* Barra de zoom a la izquierda del 3D: arriba acerca, abajo aleja. Mueve la cámara sobre la línea que la une con el punto que mira,
   en escala logarítmica (más fino de cerca), y se mantiene sincronizada con el zoom de la rueda. */
import * as THREE from 'three';
import { $ } from '../core/dom.js';
import { camera, controls, renderer, demasiadoCerca } from '../core/scene.js';

const rango = $('#zoomRango');
const MIN = controls.minDistance, MAX = controls.maxDistance, K = Math.log(MAX / MIN);
const aValor = d => Math.round((1 - Math.log(THREE.MathUtils.clamp(d, MIN, MAX) / MIN) / K) * 1000);   // 1000 = lo más cerca
const aDistancia = v => MIN * Math.exp((1 - v / 1000) * K);
const dist = () => camera.position.distanceTo(controls.target);

function ir(d) {
  const nueva = THREE.MathUtils.clamp(d, MIN, MAX), actual = dist();
  if (nueva < actual) {                                 // acercar: no más cerca de lo permitido a la superficie que se mira
    const r = renderer.domElement.getBoundingClientRect();
    if (demasiadoCerca({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 })) { rango.value = aValor(actual); return; }
  }
  const dir = camera.position.clone().sub(controls.target).normalize();
  camera.position.copy(controls.target).addScaledVector(dir, nueva);
  controls.update();
}

rango.addEventListener('input', () => ir(aDistancia(+rango.value)));
$('#zoomMas').addEventListener('click', () => ir(dist() * 0.8));
$('#zoomMenos').addEventListener('click', () => ir(dist() * 1.25));
controls.addEventListener('change', () => { const v = aValor(dist()); if (+rango.value !== v) rango.value = v; });   // la rueda y el giro también mueven la barra
rango.value = aValor(dist());
