/* Botón con un ojo junto a un campo de clave: muestra u oculta lo que se escribe. Va al lado del campo (no encima),
   para no chocar con los íconos que los gestores de contraseñas ponen dentro de él. */
const dibujo = tachado => '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>' + (tachado ? '<path d="M4 20L20 4"/>' : '') + '</svg>';

export function ponerOjo(campo) {
  if (!campo || campo.parentElement.classList.contains('clave-caja')) return;
  const caja = document.createElement('div'), ojo = document.createElement('button');
  caja.className = 'clave-caja';
  ojo.type = 'button'; ojo.className = 'ojo';
  campo.before(caja); caja.append(campo, ojo);
  const ver = si => {
    campo.type = si ? 'text' : 'password';
    ojo.innerHTML = dibujo(si);
    ojo.title = si ? 'Ocultar la clave' : 'Mostrar la clave';
    ojo.setAttribute('aria-label', ojo.title); ojo.setAttribute('aria-pressed', si);
  };
  campo.setAttribute('autocapitalize', 'none'); campo.spellcheck = false;      // a la vista, el teclado no debe corregir la clave
  ver(false);
  ojo.addEventListener('click', () => { ver(campo.type === 'password'); campo.focus(); });
  campo.form?.addEventListener('submit', () => ver(false));                     // al enviar se vuelve a ocultar
}
