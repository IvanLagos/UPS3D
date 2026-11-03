/* La carga: una caja negra con luz verde tipo semáforo (encendida cuando recibe energía) y el cable desde el rack. */
import * as THREE from 'three';
import { scene } from '../core/scene.js';
import { M, std } from '../core/materials.js';
import { box, labelPlane } from '../core/helpers.js';

const loadGroup = new THREE.Group(); loadGroup.position.set(1.3, 0, 0.1); scene.add(loadGroup);
box(0.5, 0.6, 0.4, M.panel, 0, 0.3, 0, loadGroup);

export const bulbMat = std(0x0e2a18, 0.1, 0.3, { emissive: 0x000000 });
const bulbBase = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.05, 24), std(0x1a1c1f, 0.5, 0.5));
bulbBase.position.y = 0.625; loadGroup.add(bulbBase);
const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), bulbMat);
bulb.position.y = 0.65; loadGroup.add(bulb);

const loadLab = labelPlane('CARGA', 0.3, 0.075, { size: 36 });
loadLab.position.set(0, 0.3, 0.205); loadGroup.add(loadLab);

export const cableMat = std(0x303030, 0.2, 0.6, { emissive: 0x000000 });
const cableCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0.33, 0.04, 0.1), new THREE.Vector3(0.7, 0.02, 0.2), new THREE.Vector3(1.05, 0.04, 0.1)]);
scene.add(new THREE.Mesh(new THREE.TubeGeometry(cableCurve, 24, 0.018, 8), cableMat));

/* X roja grande sobre la carga cuando se pierde la energía (siempre de frente a la cámara y por encima del resto) */
const xc = document.createElement('canvas'); xc.width = xc.height = 256;
{
  const g = xc.getContext('2d');
  g.lineCap = 'round';
  g.strokeStyle = '#4a0000'; g.lineWidth = 62; g.beginPath(); g.moveTo(40, 40); g.lineTo(216, 216); g.moveTo(216, 40); g.lineTo(40, 216); g.stroke();
  g.strokeStyle = '#ff1a1a'; g.lineWidth = 44; g.beginPath(); g.moveTo(40, 40); g.lineTo(216, 216); g.moveTo(216, 40); g.lineTo(40, 216); g.stroke();
}
export const lossMark = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(xc), transparent: true, depthTest: false, toneMapped: false }));
lossMark.position.set(0, 0.42, 0.1);
lossMark.scale.setScalar(0.85);
lossMark.renderOrder = 20;
lossMark.visible = false;
loadGroup.add(lossMark);
