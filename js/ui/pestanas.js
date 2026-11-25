/* Panel compacto: las secciones de controles se reparten en pestañas (se ve una a la vez) y el estado queda siempre a la vista abajo,
   para no tener que desplazar el panel bajo el modelo 3D. Solo mueve las secciones: sus controles e identificadores no cambian. */

const GRUPOS = [['CB', /^cb$/i], ['UPS', /comandos/i], ['Red y carga', /^red/i], ['Rack', /rack/i], ['Fallas', /falla/i]];
const paneles = new Set();
let elegida = 'CB';                        // la misma pestaña se mantiene al cambiar de circuito

const crear = (clase, etiqueta = 'div') => { const e = document.createElement(etiqueta); e.className = clase; return e; };

function mostrar(p) {
  const visibles = [...p.tabs.values()].filter(t => !t.boton.hidden);
  const actual = visibles.find(t => t.nombre === elegida) || visibles[0];
  for (const t of p.tabs.values()) {
    t.boton.classList.toggle('on', t === actual);
    t.boton.setAttribute('aria-selected', t === actual);
    t.hoja.hidden = t !== actual;
  }
}

/** Agrega `nodo` a la pestaña `nombre` del panel (la crea si no existe). */
export function agregarAPestana(p, nombre, nodo) {
  let t = p.tabs.get(nombre);
  if (!t) {
    const boton = crear('pest', 'button'), hoja = crear('pest-hoja');
    boton.type = 'button'; boton.textContent = nombre; boton.setAttribute('role', 'tab');
    hoja.dataset.pest = nombre;
    boton.addEventListener('click', () => { elegida = nombre; paneles.forEach(mostrar); });
    p.barra.appendChild(boton); p.cuerpo.appendChild(hoja);
    p.tabs.set(nombre, t = { nombre, boton, hoja });
  }
  t.hoja.appendChild(nodo);
  mostrar(p);
}

/** Muestra u oculta una pestaña completa. */
export function verPestana(p, nombre, visible) {
  const t = p.tabs.get(nombre);
  if (t) { t.boton.hidden = !visible; mostrar(p); }
}

/** Los textos de ayuda no ocupan sitio: quedan como globo al pasar el cursor, y los interruptores muestran su nombre completo en el globo. */
function compactar(seccion) {
  const notas = [...seccion.querySelectorAll('p.note')];
  if (notas.length) seccion.title = notas.map(n => n.textContent.trim()).join('\n\n');
  seccion.querySelectorAll('label.sw > span').forEach(s => {
    const nombre = (s.firstChild?.textContent || '').trim(), ayuda = s.querySelector('small');
    const poner = () => { s.parentElement.title = nombre + (ayuda?.textContent ? ' · ' + ayuda.textContent : ''); };
    poner();
    s.parentElement.addEventListener('mouseenter', poner);          // la ayuda puede cambiar (abierto/cerrado)
  });
}

/** Convierte las columnas de secciones `cols` en pestañas; la sección «Estado» queda fija debajo. */
export function armarPestanas(cols) {
  const secciones = [...cols.querySelectorAll('section')];
  const p = { cols, tabs: new Map(), barra: crear('pest-barra'), cuerpo: crear('pest-cuerpo'), estado: crear('pest-estado') };
  p.barra.setAttribute('role', 'tablist');
  cols.replaceChildren(p.barra, p.cuerpo, p.estado);
  cols.classList.add('con-pestanas');
  paneles.add(p);
  const orden = s => { const i = GRUPOS.findIndex(([, re]) => re.test(s.querySelector('h2')?.textContent.trim() || '')); return i < 0 ? GRUPOS.length : i; };
  for (const s of secciones.sort((x, y) => orden(x) - orden(y))) {          // las pestañas siguen siempre el mismo orden
    compactar(s);
    const titulo = s.querySelector('h2')?.textContent.trim() || '';
    if (/^estado/i.test(titulo)) { p.estado.appendChild(s); continue; }
    const grupo = GRUPOS.find(([, re]) => re.test(titulo));
    agregarAPestana(p, grupo ? grupo[0] : titulo, s);
  }
  return p;
}

export { compactar };
