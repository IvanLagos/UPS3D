/* Clave de acceso: la simulación solo se carga después de ingresar la clave correcta.
   La clave se compara por su huella SHA-256 (ver acceso-config.js); el campo siempre oculta lo que se escribe.
   Es una barrera de cortesía del lado del navegador: no reemplaza una protección real del servidor. */
import { SAL, CLAVE_HASH } from './acceso-config.js';

const $ = s => document.querySelector(s);
const huella = async txt => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(SAL + txt));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
};

async function abrir() {
  document.body.classList.remove('bloqueado');
  $('#acceso')?.remove();
  window.__authOk = true;
  window.__vigilar?.();                         // arranca la vigilancia de carga del index.html
  await import('./main.js');
}

function pedirClave() {
  const form = $('#accesoForm'), clave = $('#accesoClave'), msg = $('#accesoMsg');
  if (!crypto.subtle) { msg.textContent = 'Este navegador no permite verificar la clave aquí: abra la página con https o desde localhost.'; return; }
  clave.focus();
  form.addEventListener('submit', async e => {
    e.preventDefault();
    msg.textContent = '';
    if (await huella(clave.value) === CLAVE_HASH) {
      try { sessionStorage.setItem('ups3d-acceso', CLAVE_HASH); } catch (err) { /* sin sessionStorage: pedirá la clave al recargar */ }
      abrir();
    } else {
      clave.value = '';
      form.classList.add('error');
      setTimeout(() => form.classList.remove('error'), 500);
      msg.textContent = 'Clave incorrecta';
      clave.focus();
    }
  });
}

let guardada = null;
try { guardada = sessionStorage.getItem('ups3d-acceso'); } catch (err) { /* sin sessionStorage */ }
if (guardada === CLAVE_HASH) abrir(); else pedirClave();
