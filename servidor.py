"""Servidor local de desarrollo: sirve esta carpeta sin caché, para que los cambios en los módulos JS se vean al recargar.
Usa un servidor con hilos: el navegador abre varias conexiones a la vez y con un servidor de un solo hilo la página se quedaba esperando.
Recarga automática: a las páginas .html que sirve les agrega un pequeño script que consulta /__cambios cada segundo y recarga la
página cuando algún archivo cambia (o cuando el servidor vuelve después de haberse detenido). Solo existe aquí: la página publicada no lo lleva."""
import http.server
import os
import sys

import cuentas_api

PRODUCCION = 'PORT' in os.environ                       # en Render: sin recarga automática, escucha en todas las interfaces y oculta archivos internos
PUERTO = int(os.environ['PORT']) if PRODUCCION else int(sys.argv[1]) if len(sys.argv) > 1 else 8765
RAIZ = os.path.dirname(os.path.abspath(__file__))
VIGILADOS = ('.html', '.js', '.css', '.png', '.ico', '.svg', '.json')
EXCLUIDOS = {'.git', 'herramientas', '__pycache__', 'node_modules'}

RECARGA = b"""<script>
/* recarga automatica (solo servidor local) */
(function () {
  var version = null, caido = false;
  function vigilar() {
    fetch('/__cambios', { cache: 'no-store' }).then(function (r) { return r.text(); }).then(function (v) {
      if (caido || (version !== null && v !== version)) { location.reload(); return; }
      version = v;
    }).catch(function () { caido = true; });
    setTimeout(vigilar, 1000);
  }
  vigilar();
})();
</script>
"""


def huella_de_archivos():
    """Cambia cada vez que se agrega, borra o modifica un archivo de la página."""
    total, ultimo = 0, 0
    for carpeta, dirs, archivos in os.walk(RAIZ):
        dirs[:] = [d for d in dirs if d not in EXCLUIDOS]
        for a in archivos:
            if a.lower().endswith(VIGILADOS):
                try:
                    t = os.stat(os.path.join(carpeta, a)).st_mtime_ns
                except OSError:
                    continue
                total += 1
                ultimo = max(ultimo, t)
    return f'{total}-{ultimo}'


class Handler(http.server.SimpleHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'          # conexiones persistentes: los ~30 módulos viajan por pocas conexiones

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=RAIZ, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def _enviar(self, cuerpo, tipo):
        self.send_response(200)
        self.send_header('Content-Type', tipo)
        self.send_header('Content-Length', str(len(cuerpo)))
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(cuerpo)

    def _ruta(self):
        return self.path.split('?')[0].split('#')[0]

    def do_POST(self):
        if not cuentas_api.manejar(self, 'POST', self._ruta()):
            self.send_error(404)

    def do_DELETE(self):
        if not cuentas_api.manejar(self, 'DELETE', self._ruta()):
            self.send_error(404)

    def do_GET(self):
        ruta = self._ruta()
        if cuentas_api.manejar(self, 'GET', ruta):
            return
        if ruta.endswith(('.py', '.json.tmp')) or ruta.lower().startswith(('/usuarios.json', '/.git')):          # archivos internos: nunca se sirven
            return self.send_error(404)
        if PRODUCCION and ruta in ('/', '/index.html', '/tablero.html'):
            return super().do_GET()
        if ruta == '/__cambios':
            return self._enviar(huella_de_archivos().encode(), 'text/plain; charset=utf-8')
        if ruta in ('/', '/index.html', '/tablero.html'):
            archivo = os.path.join(RAIZ, 'tablero.html' if ruta == '/tablero.html' else 'index.html')
            try:
                with open(archivo, 'rb') as f:
                    html = f.read()
            except OSError:
                return super().do_GET()
            html = html.replace(b'</body>', RECARGA + b'</body>', 1)
            return self._enviar(html, 'text/html; charset=utf-8')
        return super().do_GET()

    do_HEAD = do_GET

    def log_message(self, *args):          # sin ruido en la consola
        pass


http.server.ThreadingHTTPServer.daemon_threads = True
with http.server.ThreadingHTTPServer(('0.0.0.0' if PRODUCCION else '', PUERTO), Handler) as httpd:
    print(f'UPS Modular 3D en http://localhost:{PUERTO}/  (Ctrl+C para detener)')
    httpd.serve_forever()
