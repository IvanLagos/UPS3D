/* Guardia del editor de tableros: solo se carga si esta pestaña ya ingresó en la página principal con un usuario «todos» o «admin»;
   si no, lleva a la página principal. */
import { sesionValida, cerrarSesion } from './verificar.js';

if (['todos', 'admin'].includes(await sesionValida())) {                           // el editor de tableros es para los perfiles «todos» y «admin»
  document.getElementById('oculto')?.remove();
  document.getElementById('btnSalir')?.addEventListener('click', () => { cerrarSesion(); location.replace('index.html'); });
  await import('../tablero/tablero.js');
} else {
  location.replace('index.html');
}
