/* Acceso corto al DOM: el script se carga como módulo, así que la página ya está lista. */
export const $ = s => document.querySelector(s);
export const view = $('#view');
