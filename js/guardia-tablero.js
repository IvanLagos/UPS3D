/* Guardia del editor de tableros: solo se carga si esta pestaña ya ingresó en la página principal con un usuario de acceso total;
   si no, lleva a la página principal. */
import { sesionValida, cerrarSesion } from './verificar.js';

if (await sesionValida() === 'todos') {                           // el editor de tableros es solo para el usuario con acceso total
  document.getElementById('oculto')?.remove();
  document.getElementById('btnSalir')?.addEventListener('click', () => { cerrarSesion(); location.replace('index.html'); });
  await import('../tablero/tablero.js');
} else {
  location.replace('index.html');
}
