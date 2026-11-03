"""Servidor local de desarrollo: sirve esta carpeta sin caché, para que los cambios en los módulos JS se vean al recargar."""
import http.server
import socketserver
import sys

PUERTO = int(sys.argv[1]) if len(sys.argv) > 1 else 8765


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('', PUERTO), Handler) as httpd:
    print(f'UPS Modular 3D en http://localhost:{PUERTO}/  (Ctrl+C para detener)')
    httpd.serve_forever()
