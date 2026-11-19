/* Clientes para los que se presta el servicio: después de ingresar la clave se elige uno.
   Por ahora todos usan la misma interfaz (la de OXIQUIM); cada cliente tiene su ficha para ir diferenciándolos:
   el código que sea propio de un cliente se condiciona con window.__cliente.id. */
export const CLIENTES = {
  oxiquim: { id: 'oxiquim', nombre: 'OXIQUIM', detalle: '2 UPS de 10 kVA en paralelo redundante' },
  sonacol: { id: 'sonacol', nombre: 'SONACOL', detalle: 'Interfaz en preparación (parte como la de OXIQUIM)' },
};

/* La ruta del enlace cambia con el cliente: index.html#/oxiquim, index.html#/sonacol (sin cliente: index.html). */
export const rutaDe = c => `#/${c.id}`;
/** Cliente que indica la ruta actual del enlace (o null). */
export function clienteDeRuta() {
  const id = decodeURIComponent(location.hash).replace(/^#\/?/, '').split(/[/?]/)[0].toLowerCase();
  return CLIENTES[id] || null;
}
