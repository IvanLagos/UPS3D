/* Pantalla de las cargas (circuito 3 y circuitos nuevos de SONACOL): triángulo de aviso (solo en sobrecarga, parpadea),
   cono de 5 tramos que se llena de abajo hacia arriba (cada tramo es un 20 % de la capacidad), y recuadros con el % y la potencia. */
import * as THREE from 'three';

/** Plano con un lienzo para dibujar una pantalla: devuelve { ctx, tex, w, h }. */
export function pantalla(parent, w, h, x, y, z) {
  const cv = document.createElement('canvas'); cv.width = 300; cv.height = Math.round(300 * h / w);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  m.position.set(x, y, z); parent.add(m);
  return { ctx: cv.getContext('2d'), tex, w: cv.width, h: cv.height };
}

const SEGMENTOS = [0x00c853, 0x9ccc2a, 0xffd600, 0xff8a00, 0xff1a1a];   // de abajo hacia arriba
/** Color según el % de carga: verde (hasta 50 %), lima (75 %), amarillo (90 %), naranja (100 %) y rojo (sobrecarga). */
export const colorCarga = pct => (pct > 100 ? 0xff1a1a : pct > 90 ? 0xff8a00 : pct > 75 ? 0xffd600 : pct > 50 ? 0x9ccc2a : 0x00c853);
const hex = n => '#' + n.toString(16).padStart(6, '0');

/** Dibuja la pantalla de una carga: `valor` en la unidad `unidad` (kVA o kW), `pct` = % de la capacidad, `energizada` = recibe energía,
    `sinRedundancia` = la carga ya no cabe en una sola UPS (triángulo amarillo fijo, sin texto). */
export function dibujarCarga(scr, titulo, valor, unidad, energizada, pct, sinRedundancia = false) {
  const { ctx: g, tex, w, h } = scr, cx = w / 2;
  const parp = Math.floor(performance.now() / 400) % 2 === 0, sobre = energizada && pct > 100;
  g.fillStyle = '#0a0d0b'; g.fillRect(0, 0, w, h);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#d5dae0'; g.font = 'bold 24px system-ui'; g.fillText(titulo, cx, 22);
  if (sobre && parp) {                                         // aviso de sobrecarga
    g.fillStyle = '#ffc233'; g.strokeStyle = '#ffc233'; g.lineJoin = 'round'; g.lineWidth = 8;
    g.beginPath(); g.moveTo(cx, 44); g.lineTo(cx + 36, 104); g.lineTo(cx - 36, 104); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#1a1200'; g.font = 'bold 44px system-ui'; g.fillText('!', cx, 84);
  } else if (sinRedundancia && energizada && !sobre) {         // redundancia perdida: solo el triángulo de aviso, fijo y centrado
    g.fillStyle = '#ffc233'; g.strokeStyle = '#ffc233'; g.lineJoin = 'round'; g.lineWidth = 8;
    g.beginPath(); g.moveTo(cx, 44); g.lineTo(cx + 36, 104); g.lineTo(cx - 36, 104); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#1a1200'; g.font = 'bold 44px system-ui'; g.fillText('!', cx, 84);
  }
  const yTop = 116, yBot = 300, wTop = 176, wBot = 96, seg = (yBot - yTop) / 5, ancho = y => wBot + (wTop - wBot) * (yBot - y) / (yBot - yTop);
  if (!energizada) {                                           // sin energía: una X roja reemplaza al cono
    g.strokeStyle = '#ff1a1a'; g.lineWidth = 22; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx - 62, yTop + 16); g.lineTo(cx + 62, yBot - 16); g.moveTo(cx + 62, yTop + 16); g.lineTo(cx - 62, yBot - 16); g.stroke();
    g.lineCap = 'butt';
  } else for (let k = 0; k < 5; k++) {                         // cono: ancho arriba, angosto abajo; se enciende de abajo hacia arriba
    const y1 = yBot - k * seg, y0 = y1 - seg + 4;
    const enc = pct > k * 20;
    g.fillStyle = !enc ? '#1d2227' : sobre ? (parp ? '#ff1a1a' : '#5a0d0d') : hex(SEGMENTOS[k]);
    g.beginPath(); g.moveTo(cx - ancho(y0) / 2, y0); g.lineTo(cx + ancho(y0) / 2, y0); g.lineTo(cx + ancho(y1) / 2, y1); g.lineTo(cx - ancho(y1) / 2, y1); g.closePath(); g.fill();
  }
  g.strokeStyle = '#4a525b'; g.lineWidth = 3; g.strokeRect(24, 318, w - 48, 52); g.strokeRect(24, 376, w - 48, 52);
  g.fillStyle = !energizada ? '#ff6b6b' : hex(colorCarga(pct));
  g.font = 'bold 36px monospace'; g.fillText(!energizada ? '0 %' : `${Math.round(pct)} %`, cx, 345);
  g.fillStyle = '#d5dae0'; g.fillText(`${(energizada ? valor : 0).toFixed(1)} ${unidad}`, cx, 403);
  g.textAlign = 'start';
  tex.needsUpdate = true;
}
