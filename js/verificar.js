/* Ingreso por usuario y clave, compartido por la página principal y el editor de tableros.
   La verificación la hace el servidor (api/ingresar): devuelve un token firmado que dura 12 horas y se guarda en esta pestaña.
   En cada carga se vuelve a comprobar con el servidor (api/sesion), así nadie puede «fabricar» una sesión a mano. */
const SESION = 'ups3d-sesion';

export const token = () => { try { return sessionStorage.getItem(SESION); } catch (err) { return null; } };
/** Cabeceras con la sesión, para las llamadas a la API. */
export const cabeceras = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token() || '') });

/** Ingresa con usuario y clave. Devuelve { acceso, usuario } o { error } con el motivo. */
export async function ingresar(usuario, clave) {
  try {
    const r = await fetch('api/ingresar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario, clave }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { error: d.error || 'No se pudo ingresar' };
    try { sessionStorage.setItem(SESION, d.token); } catch (err) { /* sin sessionStorage: pedirá el ingreso al recargar */ }
    return { acceso: d.acceso, usuario: d.usuario };
  } catch (err) { return { error: 'No se pudo conectar con el servidor' }; }
}

/** Acceso de la sesión de esta pestaña ('oxiquim', 'sonacol' o 'todos'), o null si no ingresó o ya venció. */
export async function sesionValida() {
  if (!token()) return null;
  for (let intento = 0; intento < 4; intento++) {          // ante un fallo pasajero (red o hosting) se reintenta: solo un rechazo del servidor pide ingresar de nuevo
    try {
      const r = await fetch('api/sesion', { headers: cabeceras() });
      if (r.ok) return (await r.json()).acceso;
      if (r.status === 401) return null;
    } catch (err) { /* sin conexión: se reintenta */ }
    await new Promise(listo => setTimeout(listo, 700 * (intento + 1)));
  }
  return null;
}

/** Olvida el ingreso de esta pestaña: la próxima carga volverá a pedirlo. */
export function cerrarSesion() {
  try { sessionStorage.removeItem(SESION); } catch (err) { /* nada */ }
}
