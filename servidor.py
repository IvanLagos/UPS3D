"""Servidor local de desarrollo: sirve esta carpeta sin caché, para que los cambios en los módulos JS se vean al recargar.
Usa un servidor con hilos: el navegador abre varias conexiones a la vez y con un servidor de un solo hilo la página se quedaba esperando."""
import http.server
import sys

PUERTO = int(sys.argv[1]) if len(sys.argv) > 1 else 8765


class Handler(http.server.SimpleHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'          # conexiones persistentes: los ~30 módulos viajan por pocas conexiones

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *args):          # sin ruido en la consola
        pass


http.server.ThreadingHTTPServer.daemon_threads = True
with http.server.ThreadingHTTPServer(('', PUERTO), Handler) as httpd:
    print(f'UPS Modular 3D en http://localhost:{PUERTO}/  (Ctrl+C para detener)')
    httpd.serve_forever()
