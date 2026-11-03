/* Utilidades para construir geometría y etiquetas de texto. */
import * as THREE from 'three';

export function box(w, h, d, mat, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}

export function textTex(text, { w = 256, h = 64, size = 28, color = '#e8eef4', bg = null } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  g.fillStyle = color; g.font = `600 ${size}px system-ui, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const lines = text.split('\n');
  lines.forEach((t, i) => g.fillText(t, w / 2, h / 2 + (i - (lines.length - 1) / 2) * size * 1.05));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function labelPlane(text, w, h, opts) {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: textTex(text, opts), transparent: true, toneMapped: false }));
}

/** Dibuja en `p` (Shape o Path) un rectángulo de medias dimensiones x, y con esquinas de radio r. */
export function roundedRect(p, x, y, r) {
  p.moveTo(-x + r, -y); p.lineTo(x - r, -y); p.absarc(x - r, -y + r, r, -Math.PI / 2, 0, false);
  p.lineTo(x, y - r); p.absarc(x - r, y - r, r, 0, Math.PI / 2, false);
  p.lineTo(-x + r, y); p.absarc(-x + r, y - r, r, Math.PI / 2, Math.PI, false);
  p.lineTo(-x, -y + r); p.absarc(-x + r, -y + r, r, Math.PI, Math.PI * 1.5, false);
}
