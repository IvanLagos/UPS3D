/* Clave de acceso: la simulación solo se carga después de ingresar la clave correcta.
   La clave se compara por su huella (ver verificar.js y acceso-config.js); el campo siempre oculta lo que se escribe.
   Es una barrera de cortesía del lado del navegador: no reemplaza una protección real del servidor. */
import { claveValida, sesionValida, recordar, cerrarSesion } from './verificar.js';
import { CLIENTES, rutaDe, clienteDeRuta } from './clientes.js';

const $ = s => document.querySelector(s);

/** Cerrar sesión: olvida la clave y vuelve a la pantalla de acceso. */
function salir() {
  cerrarSesion();
  history.replaceState(null, '', location.pathname + location.search);          // sin cliente en la ruta
  location.reload();
}
document.querySelectorAll('.cerrar-sesion').forEach(b => b.addEventListener('click', salir));
/** Entra al cliente que indica la ruta del enlace, o muestra la elección de cliente. */
function entrar() {
  const c = clienteDeRuta();
  if (c) abrir(c); else elegirCliente();
}

/** Pantalla para elegir el cliente, después de ingresar la clave. */
function elegirCliente() {
  $('#acceso').classList.remove('verificando');
  $('#accesoForm').hidden = true;
  const caja = $('#clientesBox'), lista = $('#clientesLista');
  caja.hidden = false;
  window.addEventListener('hashchange', () => { if (clienteDeRuta()) { location.reload(); } });   // «adelante» desde la elección entra al cliente de la ruta
  lista.innerHTML = '';
  for (const c of Object.values(CLIENTES)) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'cliente-op';
    b.innerHTML = `<strong>${c.nombre}</strong><small>${c.detalle}</small>`;
    b.addEventListener('click', () => abrir(c));
    lista.appendChild(b);
  }
  const t = document.createElement('a');                                  // herramienta aparte, disponible desde la plataforma de clientes
  t.href = 'tablero.html'; t.className = 'cliente-op herramienta';
  t.innerHTML = '<strong>TABLERO ELÉCTRICO</strong><small>Editor para diseñar circuitos de tableros</small>';
  lista.appendChild(t);
}

async function abrir(cliente) {
  window.__cliente = cliente;
  if (clienteDeRuta()?.id !== cliente.id) history.pushState(null, '', location.pathname + location.search + rutaDe(cliente));   // el enlace cambia con el cliente (sin recargar la página; «atrás» vuelve a la elección)
  document.body.dataset.cliente = cliente.id;
  document.title = `Fernández Fica · UPS Modular 3D · ${cliente.nombre}`;
  $('#clienteNombre').textContent = cliente.nombre;
  $('#btnCambiarCliente').addEventListener('click', () => {     // vuelve a la elección de cliente sin pedir la clave otra vez (solo esta recarga)
    history.replaceState(null, '', location.pathname + location.search);          // sin cliente en la ruta
    location.reload();
  });
  window.addEventListener('hashchange', () => {                                       // si cambia la ruta (atrás/adelante o a mano), se recarga con ese cliente o con la elección
    const c = clienteDeRuta();
    if (!c || c.id !== cliente.id) { location.reload(); }          // atrás (sin cliente en la ruta) vuelve a la elección de cliente
  });
  document.body.classList.remove('bloqueado');
  $('#accesoForm').hidden = true; $('#clientesBox').hidden = true; $('#cargando').hidden = false;   // la pantalla de carga tapa la app hasta que el cliente esté listo (si no, se vería un instante el modelo base)
  window.__authOk = true;
  window.__vigilar?.();                         // arranca la vigilancia de carga del index.html
  try {
    await import('./main.js');
    if (cliente.id === 'sonacol') await import('./sonacol/sonacol.js');          // SONACOL: selector con sus 3 circuitos
  } finally { $('#acceso')?.remove(); }        // también si falla: así se ve el aviso de error de la página
}

function pedirClave() {
  $('#acceso').classList.remove('verificando');                 // ahora sí hace falta la clave: se muestra el formulario
  const form = $('#accesoForm'), clave = $('#accesoClave'), msg = $('#accesoMsg');
  if (!crypto.subtle) { msg.textContent = 'Este navegador no permite verificar la clave aquí: abra la página con https o desde localhost.'; return; }
  clave.focus();
  form.addEventListener('submit', async e => {
    e.preventDefault();
    msg.textContent = '';
    if (await claveValida(clave.value)) {
      recordar(clave.value);
      entrar();                                // después de la clave, el cliente (el de la ruta del enlace, o se elige)
    } else {
      clave.value = '';
      form.classList.add('error');
      setTimeout(() => form.classList.remove('error'), 500);
      msg.textContent = 'Clave incorrecta';
      clave.focus();
    }
  });
}

/* La clave se pide solo la primera vez: queda recordada mientras la pestaña siga abierta (se pierde al cerrarla) y se vuelve a verificar en cada carga. */
if (await sesionValida()) entrar(); else pedirClave();
