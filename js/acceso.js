/* Clave de acceso: la simulación solo se carga después de ingresar la clave correcta.
   La clave se compara por su huella (ver verificar.js y acceso-config.js); el campo siempre oculta lo que se escribe.
   Es una barrera de cortesía del lado del navegador: no reemplaza una protección real del servidor. */
import { claveValida, sesionValida, recordar } from './verificar.js';
import { CLIENTES, rutaDe, clienteDeRuta } from './clientes.js';

const $ = s => document.querySelector(s);
/** Entra al cliente que indica la ruta del enlace, o muestra la elección de cliente. */
function entrar() {
  const c = clienteDeRuta();
  if (c) abrir(c); else elegirCliente();
}

/** Pantalla para elegir el cliente, después de ingresar la clave. */
function elegirCliente() {
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
  if (location.hash !== rutaDe(cliente)) location.hash = rutaDe(cliente);          // el enlace cambia con el cliente
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
