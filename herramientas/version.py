"""Versiona los archivos de la página para que GitHub Pages nunca mezcle archivos viejos (en la caché del navegador)
con archivos nuevos: agrega a cada módulo JS, a la hoja de estilos y al script de entrada un ?v=<huella de su contenido>.

Uso (antes de cada commit):  python herramientas/version.py
Reescribe el importmap, el <link> del CSS y el <script> de entrada de index.html."""
import hashlib
import json
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
INDEX = RAIZ / 'index.html'


def huella(ruta):
    return hashlib.sha1(ruta.read_bytes().replace(b'\r\n', b'\n')).hexdigest()[:8]   # igual en Windows y Linux


imports = {
    'three': 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js',
    'three/addons/': 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/',
}
for js in sorted((RAIZ / 'js').rglob('*.js')):
    rel = js.relative_to(RAIZ).as_posix()
    imports[f'./{rel}'] = f'./{rel}?v={huella(js)}'

mapa = '<script type="importmap">\n{"imports":{\n' + ',\n'.join(f'  {json.dumps(k)}: {json.dumps(v)}' for k, v in imports.items()) + '\n}}\n</script>'

html = INDEX.read_text(encoding='utf-8')
html = re.sub(r'<script type="importmap">.*?</script>', lambda m: mapa, html, flags=re.S)
html = re.sub(r'href="css/styles\.css[^"]*"', f'href="css/styles.css?v={huella(RAIZ / "css" / "styles.css")}"', html)
html = re.sub(r'src="js/acceso\.js[^"]*"', f'src="js/acceso.js?v={huella(RAIZ / "js" / "acceso.js")}"', html)
INDEX.write_text(html, encoding='utf-8')
print(f'index.html versionado: {len(imports) - 2} módulos JS + CSS + script de entrada')
