/* Gestión de cuentas (solo para el perfil administrador): crear usuarios, cambiar claves y accesos, y quitar usuarios.
   Todo se guarda en el servidor (api/usuarios) y vale al instante para todos; aquí nunca se ve ni se guarda ninguna clave. */
import { cabeceras } from './verificar.js';

const ACCESOS = { oxiquim: 'OXIQUIM', sonacol: 'SONACOL', todos: 'Todos los clientes', admin: 'Administrador (todo y cuentas)' };
const $ = (s, r = document) => r.querySelector(s);

let modal = null;

function aviso(txt, mal = false) { const m = $('#cuentasMsg'); m.textContent = txt; m.classList.toggle('bad', mal); }

async function llamar(metodo, ruta, cuerpo) {
  try {
    const r = await fetch(ruta, { method: metodo, headers: cabeceras(), body: cuerpo ? JSON.stringify(cuerpo) : undefined });
    const d = await r.json().catch(() => ({}));
    return r.ok ? d : { error: d.error || `Error ${r.status}` };
  } catch (err) { return { error: 'No se pudo conectar con el servidor' }; }
}

async function pintar() {
  const cuerpo = $('#cuentasLista');
  const d = await llamar('GET', 'api/usuarios');
  if (d.error) { cuerpo.textContent = d.error; return; }
  cuerpo.innerHTML = '';
  for (const u of d.usuarios) {
    const f = document.createElement('div');
    f.className = 'cuenta-fila';
    f.innerHTML = '<span class="cuenta-usuario"></span><span class="cuenta-acceso"></span><button type="button" class="sm">Quitar</button>';
    f.querySelector('.cuenta-usuario').textContent = u.usuario;
    f.querySelector('.cuenta-acceso').textContent = ACCESOS[u.acceso] || u.acceso;
    f.querySelector('button').addEventListener('click', async () => {
      if (!confirm(`¿Quitar al usuario «${u.usuario}»? Ya no podrá ingresar.`)) return;
      const r = await llamar('DELETE', 'api/usuarios/' + encodeURIComponent(u.usuario));
      if (r.error) aviso(r.error, true); else aviso(`Usuario «${u.usuario}» quitado.`);
      pintar();
    });
    cuerpo.appendChild(f);
  }
}

async function guardar(e) {
  e.preventDefault();
  const usuario = $('#cuentaUsuario').value.trim().toLowerCase(), clave = $('#cuentaClave').value, acceso = $('#cuentaAcceso').value;
  if (!usuario || /[\s'"\\]/.test(usuario)) { aviso('El usuario no puede estar vacío ni tener espacios ni comillas.', true); return; }
  if (clave.length < 6) { aviso('La clave debe tener al menos 6 caracteres.', true); return; }
  $('#cuentasGuardar').disabled = true;
  try {
    const r = await llamar('POST', 'api/usuarios', { usuario, clave, acceso });
    if (r.error) { aviso(r.error, true); return; }
    aviso(r.actualizado ? `Usuario «${usuario}» actualizado (clave y acceso).` : `Usuario «${usuario}» creado: ya puede ingresar.`);
    $('#cuentaUsuario').value = ''; $('#cuentaClave').value = '';
    pintar();
  } finally { $('#cuentasGuardar').disabled = false; }
}

function crear() {
  modal = document.createElement('div');
  modal.id = 'cuentas'; modal.hidden = true;
  modal.innerHTML = `
    <div class="cuentas-caja" role="dialog" aria-label="Gestión de cuentas">
      <header><h2>Gestión de cuentas</h2><button type="button" class="sm" id="cuentasCerrar">Cerrar</button></header>
      <section><h3>Usuarios</h3><div id="cuentasLista">Cargando…</div></section>
      <section>
        <h3>Agregar usuario o cambiar clave</h3>
        <form id="cuentasForm" autocomplete="off">
          <input type="text" id="cuentaUsuario" placeholder="Usuario (si ya existe, se cambia su clave)" autocapitalize="none" spellcheck="false" autocomplete="off" required>
          <input type="password" id="cuentaClave" placeholder="Clave (mínimo 6 caracteres)" autocomplete="new-password" required>
          <select id="cuentaAcceso">${Object.entries(ACCESOS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
          <button class="primary" type="submit" id="cuentasGuardar">Guardar</button>
        </form>
        <div id="cuentasMsg" role="status"></div>
        <p class="note">Los cambios se guardan en el servidor y valen al instante para todos. Un usuario con acceso a un cliente entra directo a su interfaz.</p>
      </section>
    </div>`;
  document.body.appendChild(modal);
  $('#cuentasCerrar').addEventListener('click', () => { modal.hidden = true; });
  modal.addEventListener('click', e => { if (e.target === modal) modal.hidden = true; });
  $('#cuentasForm').addEventListener('submit', guardar);
}

export function abrirCuentas() {
  if (!modal) crear();
  aviso('');
  modal.hidden = false;
  pintar();
}
