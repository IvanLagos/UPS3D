/* Escena 3D: renderizador, cámara, controles, luces y piso. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { view } from './dom.js';

export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
view.prepend(renderer.domElement);

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb3b8bd);
scene.fog = new THREE.Fog(0xb3b8bd, 9, 20);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

export const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
camera.position.set(2.4, 1.7, 3.6);

export const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0.2, 1.0, 0);
controls.enableDamping = true;
controls.zoomToCursor = true;   // el zoom se acerca hacia donde apunta el mouse
controls.maxPolarAngle = Math.PI * 0.495;
controls.minDistance = 1.2;
controls.maxDistance = 9;

const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(3, 5, 4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 14 });
scene.add(sun, new THREE.HemisphereLight(0xbfd8ff, 0x1a222b, 0.5));

const floor = new THREE.Mesh(new THREE.CircleGeometry(8, 64), new THREE.MeshStandardMaterial({ color: 0xa2a7ac, roughness: 0.9 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor, new THREE.GridHelper(16, 32, 0x8f959b, 0x9aa0a6));

/** Ajusta el lienzo al tamaño del contenedor. */
export function resize() {
  const w = view.clientWidth, h = view.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
