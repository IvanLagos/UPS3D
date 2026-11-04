/* Materiales compartidos por todo el modelo. */
import * as THREE from 'three';

export const std = (color, metalness = 0.5, roughness = 0.5, extra = {}) => new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });

const glassLike = (color, opacity, roughness) => new THREE.MeshPhysicalMaterial({ color, transparent: true, opacity, roughness, metalness: 0, side: THREE.DoubleSide, depthWrite: false });

export const M = {
  frame: std(0xe6d9b8, 0.15, 0.55),      // rack crema
  steel: std(0xd4c7a3, 0.2, 0.55),
  rail: std(0xc9ced4, 0.3, 0.9),          // rieles interiores plateados
  white: std(0xf4f5f6, 0.4, 0.1),         // automáticos blancos
  rubber: std(0x0b0b0c, 0.85, 0.0),       // goma negra aislante
  panel: std(0x2b2b2e, 0.4, 0.5),
  dark: std(0x1a1a1c, 0.3, 0.7),
  module: std(0x131416, 0.5, 0.45),      // UPS negra
  face: std(0x1e2023, 0.45, 0.4),
  batt: std(0x0c0d0e, 0.5, 0.5),         // bancos negros
  battFace: std(0x17181a, 0.45, 0.45),
  handle: std(0x7a8089, 0.8, 0.3),
  plinth: std(0x232326, 0.4, 0.6),
  floor: std(0x0c0c0e, 0.35, 0.7),        // piso interno del rack, negro
  blue: std(0x2f6fe0, 0.4, 0.4),
  fan: std(0x8a9098, 0.4, 0.5),
  smoke: glassLike(0x5c6874, 0.3, 0.08),  // vidrio ahumado de la puerta frontal
};
