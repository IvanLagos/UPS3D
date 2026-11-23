/* La carga: una caja negra con su pantalla (% de carga, kW y aviso de sobrecarga) y el cable desde el rack. */
import * as THREE from 'three';
import { scene } from '../core/scene.js';
import { M, std } from '../core/materials.js';
import { box } from '../core/helpers.js';
import { pantalla } from '../core/pantallaCarga.js';

export const loadGroup = new THREE.Group(); loadGroup.position.set(1.3, 0, 0.1); scene.add(loadGroup);
box(0.5, 0.6, 0.4, M.panel, 0, 0.3, 0, loadGroup);

/* pantalla de la carga: cono de 5 tramos con el % de carga, aviso de sobrecarga y la potencia (se dibuja en ui/visuals.js) */
export const loadScr = pantalla(loadGroup, 0.34, 0.5, 0, 0.3, 0.201);

export const cableMat = std(0x303030, 0.2, 0.6, { emissive: 0x000000 });
const cableCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0.33, 0.04, 0.1), new THREE.Vector3(0.7, 0.02, 0.2), new THREE.Vector3(1.05, 0.04, 0.1)]);
export const cableMesh = new THREE.Mesh(new THREE.TubeGeometry(cableCurve, 24, 0.018, 8), cableMat);
scene.add(cableMesh);
