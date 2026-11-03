/* Estructura del rack (600 × 800 × 2000 mm, según plano): zócalo, montantes, rieles, techo, laterales y ventiladores. */
import * as THREE from 'three';
import { scene } from '../core/scene.js';
import { M } from '../core/materials.js';
import { box } from '../core/helpers.js';
import { tween } from '../core/tween.js';

export const W = 0.6, D = 0.8;
export const rack = new THREE.Group(); scene.add(rack);

box(W + 0.04, 0.14, D + 0.04, M.plinth, 0, 0.07, 0, rack);          // zócalo oscuro
for (const sx of [-1, 1]) for (const sz of [-1, 1])
  box(0.04, 1.85, 0.04, M.frame, sx * (W / 2 - 0.02), 1.025, sz * (D / 2 - 0.02), rack);
box(0.52, 0.02, 0.64, M.rail, 0, 0.155, 0, rack);                  // bandeja base

// rieles de cada módulo (UPS, bancos y tapa): guías laterales a lo largo del fondo del rack, sin panel trasero
for (const y of [1.445, 1.285, 1.125, 0.965, 0.805, 0.645, 0.485]) for (const sx of [-1, 1]) {
  box(0.03, 0.012, 0.66, M.rail, sx * 0.265, y - 0.081, 0, rack);   // base del riel
  box(0.012, 0.03, 0.66, M.rail, sx * 0.2605, y - 0.07, 0, rack);   // ala interior que guía el módulo
}
for (const sx of [-1, 1]) box(0.02, 1.84, 0.02, M.rail, sx * 0.265, 1.04, 0.33, rack);   // rieles frontales
for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.012, 1.84, 0.03, M.rail, sx * 0.255, 1.04, sz * 0.3, rack);   // montantes delanteros y traseros (abiertos por los lados)
// marco superior de rieles horizontales: unen los verticales delanteros, traseros y laterales bajo el techo
box(0.55, 0.04, 0.02, M.rail, 0, 1.925, 0.33, rack);
box(0.52, 0.04, 0.03, M.rail, 0, 1.925, -0.3, rack);
for (const sx of [-1, 1]) box(0.012, 0.04, 0.63, M.rail, sx * 0.255, 1.925, 0.015, rack);

/* techo fijo */
const roof = new THREE.Group(); roof.position.y = 1.975; rack.add(roof);
box(W + 0.04, 0.05, D + 0.04, M.frame, 0, 0, 0, roof);

/* ventiladores: los que se crean se giran juntos desde el bucle principal */
export const fans = [];
export function makeFan(r) {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const p = new THREE.Group(); p.rotation.z = i * Math.PI * 2 / 5;
    const b = box(r * 0.9, r * 0.34, 0.004, M.fan, r * 0.55, 0, 0, p); b.rotation.x = 0.5;
    g.add(p);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.2, r * 0.2, 0.014, 16), M.fan);
  hub.rotation.x = Math.PI / 2; g.add(hub);
  fans.push(g);
  return g;
}

/* paneles laterales: tapas sólidas color crema; se retiran al abrir el rack o con el interruptor «Laterales cerrados» */
function makeSide(x) {
  const g = new THREE.Group(); g.position.set(x, 1.025, 0);
  box(0.016, 1.85, D - 0.06, M.frame, 0, 0, 0, g);
  rack.add(g);
  return g;
}
const sideL = makeSide(-0.308);
const sideR = makeSide(0.308);
let sidesClosed = true;   // la página siempre inicia con los laterales puestos

export const sidesAreClosed = () => sidesClosed;

/** Anima los laterales: puestos (true) o retirados (false). */
export function moveSides(closed) {
  sidesClosed = closed;
  if (closed) sideL.visible = sideR.visible = true;
  tween(sideL.position, 'x', closed ? -0.308 : -1.6, 0.9).then(() => { if (!sidesClosed) sideL.visible = false; });
  tween(sideR.position, 'x', closed ? 0.308 : 1.6, 0.9).then(() => { if (!sidesClosed) sideR.visible = false; });
}
