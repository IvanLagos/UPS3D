/* Verificación de la clave, compartida por la página principal y el editor de tableros.
   La huella usa PBKDF2 (lenta a propósito) para que adivinar la clave a partir de la huella pública cueste mucho.
   En la pestaña se recuerda la clave escrita (no la huella), y en cada carga se vuelve a verificar: así nadie puede
   «fabricar» una sesión a mano con los datos públicos del código.
   Sigue siendo una barrera del lado del navegador: no reemplaza una protección real del servidor. */
import { SAL, ITER, CLAVE_HASH } from './acceso-config.js';

const SESION = 'ups3d-acceso';

export async function huella(txt) {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey('raw', enc.encode(txt), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(SAL), iterations: ITER }, base, 256);
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export const claveValida = async txt => !!txt && (await huella(txt)) === CLAVE_HASH;

/** ¿Esta pestaña ya ingresó una clave correcta? */
export async function sesionValida() {
  try {
    const g = sessionStorage.getItem(SESION);
    return !!g && await claveValida(g);
  } catch (err) { return false; }
}

export function recordar(txt) {
  try { sessionStorage.setItem(SESION, txt); } catch (err) { /* sin sessionStorage: pedirá la clave al recargar */ }
}
