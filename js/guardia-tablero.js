/* Guardia del editor de tableros: solo se carga si esta pestaña ya ingresó la clave en la página principal;
   si no, lleva a la página principal a pedirla. */
import { sesionValida } from './verificar.js';

if (await sesionValida()) {
  document.getElementById('oculto')?.remove();
  await import('../tablero/tablero.js');
} else {
  location.replace('index.html');
}
