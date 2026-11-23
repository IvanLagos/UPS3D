/* Acceso: la simulación solo se carga después de ingresar un usuario y una clave válidos (los verifica el servidor: ver verificar.js y cuentas_api.py). */
import { ingresar, sesionValida, cerrarSesion } from './verificar.js';
import { CLIENTES, rutaDe, clienteDeRuta } from './clientes.js';

const $ = s => document.querySelector(s);

/** Cerrar sesión: olvida la clave y vuelve a la pantalla de acceso. */
function salir() {
  cerrarSesion();
  history.replaceState(null, '', location.pathname + location.search);          // sin cliente en la ruta
  location.reload();
}
document.querySelectorAll('.cerrar-sesion').forEach(b => b.addEventListener('click', salir));
/** Entra según el acceso del usuario: el de un cliente va directo a su interfaz (sea cual sea el enlace); el de acceso total va al cliente del enlace o elige. */
function entrar(acceso) {
  window.__acceso = acceso;
  if (acceso !== 'todos') {                                                       // usuario de un solo cliente: sin elección, sin cambiar de cliente ni editor de tableros
    document.body.classList.add('un-cliente');
    const c = CLIENTES[acceso];
    if (clienteDeRuta()?.id !== c.id) history.replaceState(null, '', location.pathname + location.search + rutaDe(c));
    abrir(c); return;
  }
  $('#btnCuentas').hidden = false;                                                // el perfil de acceso total gestiona las cuentas
  $('#btnCuentas').addEventListener('click', async () => (await import('./cuentas.js')).abrirCuentas());
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
  const k = document.createElement('button');                             // gestión de cuentas, solo para el perfil de acceso total
  k.type = 'button'; k.className = 'cliente-op herramienta';
  k.innerHTML = '<strong>CUENTAS</strong><small>Crear usuarios, cambiar claves y quitar accesos</small>';
  k.addEventListener('click', async () => (await import('./cuentas.js')).abrirCuentas());
  lista.appendChild(k);
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
  const form = $('#accesoForm'), usuario = $('#accesoUsuario'), clave = $('#accesoClave'), msg = $('#accesoMsg');
  usuario.focus();
  form.addEventListener('submit', async e => {
    e.preventDefault();
    msg.textContent = '';
    const r = await ingresar(usuario.value, clave.value);
    if (r.acceso) {
      entrar(r.acceso);                        // directo a su cliente (o, con acceso total, el del enlace o la elección)
    } else {
      clave.value = '';
      form.classList.add('error');
      setTimeout(() => form.classList.remove('error'), 500);
      msg.textContent = r.error;
      clave.focus();
    }
  });
}

/* El usuario y la clave se piden solo la primera vez: quedan recordados mientras la pestaña siga abierta (se pierde al cerrarla) y se vuelve a verificar en cada carga. */
{
  const acceso = await sesionValida();
  if (acceso) entrar(acceso); else pedirClave();
}
