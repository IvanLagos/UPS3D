"""Cuentas de acceso y su API (ingresar, sesión y gestión de usuarios). Solo usa la biblioteca estándar de Python.

Las cuentas viven en usuarios.json: { "sal", "iter", "usuarios": [ { "usuario", "acceso", "hash" } ] }, donde hash es la huella PBKDF2-SHA256
de «usuario + salto de línea + clave» (nunca se guarda la clave). acceso: 'oxiquim', 'sonacol' o 'todos' (elige cliente, usa el editor y gestiona cuentas).

Dónde se guardan:
  · Local (sin GH_TOKEN): en el archivo usuarios.json de esta carpeta (o el de la variable USUARIOS_ARCHIVO).
  · En Render (con GH_TOKEN): en el propio repositorio de GitHub, con un commit a usuarios.json cada vez que cambia una cuenta
    (el mensaje lleva «[skip render]» para que Render no vuelva a desplegar). Variables de entorno: GH_TOKEN (token con permiso de escritura
    sobre «Contents» del repositorio), GH_REPO (por ejemplo IvanLagos/UPS3D), GH_RAMA (por defecto main) y SESION_SECRETO (cualquier texto largo y secreto;
    si falta, las sesiones se pierden al reiniciar el servidor)."""
import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import threading
import time
import urllib.error
import urllib.request

RAIZ = os.path.dirname(os.path.abspath(__file__))
ARCHIVO = os.environ.get('USUARIOS_ARCHIVO') or os.path.join(RAIZ, 'usuarios.json')
GH_TOKEN = os.environ.get('GH_TOKEN', '')
GH_REPO = os.environ.get('GH_REPO', 'IvanLagos/UPS3D')
GH_RAMA = os.environ.get('GH_RAMA', 'main')
GH_RUTA = 'usuarios.json'
SECRETO = (os.environ.get('SESION_SECRETO') or secrets.token_hex(32)).encode()
DURACION = 12 * 3600                                   # una sesión dura 12 horas
ACCESOS = ('oxiquim', 'sonacol', 'todos')
NOMBRE_OK = re.compile(r"^[^\s'\"\\]{1,40}$")

_cerrojo = threading.Lock()
_datos = {'sal': 'ups3d-fica', 'iter': 200000, 'usuarios': []}
_fallos = {}                                           # ip -> instantes de intentos fallidos (límite de intentos)


# ---------- almacenamiento ----------
def _gh(metodo, cuerpo=None):
    url = f'https://api.github.com/repos/{GH_REPO}/contents/{GH_RUTA}'
    if metodo == 'GET':
        url += f'?ref={GH_RAMA}'
    req = urllib.request.Request(url, method=metodo, data=json.dumps(cuerpo).encode() if cuerpo else None, headers={
        'Authorization': f'Bearer {GH_TOKEN}', 'Accept': 'application/vnd.github+json', 'User-Agent': 'ups3d-cuentas',
        'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read().decode())


def _leer_local():
    with open(ARCHIVO, encoding='utf-8') as f:
        return json.load(f)


def cargar():
    """Lee las cuentas: de GitHub si hay token (es la fuente de verdad), si no del archivo local."""
    global _datos
    if GH_TOKEN:
        try:
            r = _gh('GET')
            _datos = json.loads(base64.b64decode(r['content']).decode('utf-8'))
            return
        except Exception as e:                          # sin GitHub: se usa la copia desplegada
            print('Aviso: no se pudo leer usuarios.json de GitHub:', e)
    try:
        _datos = _leer_local()
    except Exception as e:
        print('Aviso: no se pudo leer usuarios.json:', e)


def _guardar(nuevos):
    """Guarda las cuentas (GitHub o archivo local); si falla, lanza la excepción y no cambia nada."""
    global _datos
    texto = json.dumps(nuevos, ensure_ascii=False, indent=2) + '\n'
    if GH_TOKEN:
        sha = _gh('GET')['sha']
        _gh('PUT', {'message': 'Actualiza las cuentas de acceso [skip render]', 'branch': GH_RAMA, 'sha': sha,
                    'content': base64.b64encode(texto.encode('utf-8')).decode()})
    else:
        tmp = ARCHIVO + '.tmp'
        with open(tmp, 'w', encoding='utf-8', newline='\n') as f:
            f.write(texto)
        os.replace(tmp, ARCHIVO)
    _datos = nuevos


# ---------- claves y sesiones ----------
def huella(usuario, clave, datos=None):
    d = datos or _datos
    txt = usuario.strip().lower() + chr(10) + clave
    return hashlib.pbkdf2_hmac('sha256', txt.encode('utf-8'), d['sal'].encode('utf-8'), int(d['iter']), 32).hex()


def _emitir(usuario, acceso):
    carga = base64.urlsafe_b64encode(json.dumps({'u': usuario, 'a': acceso, 'e': int(time.time()) + DURACION}).encode()).decode().rstrip('=')
    firma = hmac.new(SECRETO, carga.encode(), hashlib.sha256).hexdigest()
    return f'{carga}.{firma}'


def _validar(token):
    """Datos de la sesión (usuario y acceso actuales) o None si el token no vale, venció o el usuario ya no existe."""
    try:
        carga, firma = token.split('.')
        if not hmac.compare_digest(firma, hmac.new(SECRETO, carga.encode(), hashlib.sha256).hexdigest()):
            return None
        d = json.loads(base64.urlsafe_b64decode(carga + '=' * (-len(carga) % 4)))
        if d['e'] < time.time():
            return None
        u = next((x for x in _datos['usuarios'] if x['usuario'] == d['u']), None)
        return {'usuario': u['usuario'], 'acceso': u['acceso']} if u and u['acceso'] == d['a'] else None
    except Exception:
        return None


def _bloqueado(ip):
    ahora = time.time()
    _fallos[ip] = [t for t in _fallos.get(ip, []) if ahora - t < 60]
    return len(_fallos[ip]) >= 8


# ---------- rutas de la API ----------
def _sesion(handler):
    cab = handler.headers.get('Authorization', '')
    return _validar(cab[7:]) if cab.startswith('Bearer ') else None


def _json(handler):
    n = int(handler.headers.get('Content-Length') or 0)
    return json.loads(handler.rfile.read(n).decode('utf-8')) if 0 < n < 10000 else {}


def _responder(handler, codigo, cuerpo):
    datos = json.dumps(cuerpo, ensure_ascii=False).encode('utf-8')
    handler.send_response(codigo)
    handler.send_header('Content-Type', 'application/json; charset=utf-8')
    handler.send_header('Content-Length', str(len(datos)))
    handler.end_headers()
    if handler.command != 'HEAD':
        handler.wfile.write(datos)


def manejar(handler, metodo, ruta):
    """Atiende /api/...; devuelve True si la ruta era de la API."""
    if not ruta.startswith('/api/'):
        return False
    try:
        _atender(handler, metodo, ruta)
    except Exception as e:
        print('Error en la API:', e)
        _responder(handler, 500, {'error': 'Error del servidor'})
    return True


def _atender(h, metodo, ruta):
    global _datos
    if ruta == '/api/ingresar' and metodo == 'POST':
        ip = h.headers.get('X-Forwarded-For', h.client_address[0]).split(',')[0].strip()
        if _bloqueado(ip):
            return _responder(h, 429, {'error': 'Demasiados intentos: espere un minuto'})
        d = _json(h)
        usuario, clave = str(d.get('usuario', '')).strip().lower(), str(d.get('clave', ''))
        hh = huella(usuario, clave) if usuario and clave else ''
        u = next((x for x in _datos['usuarios'] if x['usuario'] == usuario and hmac.compare_digest(x['hash'], hh)), None)
        if not u:
            _fallos.setdefault(ip, []).append(time.time())
            return _responder(h, 401, {'error': 'Usuario o clave incorrectos'})
        return _responder(h, 200, {'token': _emitir(u['usuario'], u['acceso']), 'usuario': u['usuario'], 'acceso': u['acceso']})

    ses = _sesion(h)
    if ruta == '/api/sesion' and metodo == 'GET':
        return _responder(h, 200, ses) if ses else _responder(h, 401, {'error': 'Sin sesión'})

    if not ruta.startswith('/api/usuarios'):
        return _responder(h, 404, {'error': 'No existe'})
    if not ses or ses['acceso'] != 'todos':
        return _responder(h, 403, {'error': 'Solo el perfil de acceso total gestiona las cuentas'})

    if ruta == '/api/usuarios' and metodo == 'GET':
        return _responder(h, 200, {'usuarios': [{'usuario': u['usuario'], 'acceso': u['acceso']} for u in _datos['usuarios']]})

    if ruta == '/api/usuarios' and metodo == 'POST':
        d = _json(h)
        usuario, clave, acceso = str(d.get('usuario', '')).strip().lower(), str(d.get('clave', '')), d.get('acceso')
        if not NOMBRE_OK.match(usuario):
            return _responder(h, 400, {'error': 'El usuario no puede estar vacío ni tener espacios ni comillas'})
        if len(clave) < 6:
            return _responder(h, 400, {'error': 'La clave debe tener al menos 6 caracteres'})
        if acceso not in ACCESOS:
            return _responder(h, 400, {'error': 'Acceso no válido'})
        with _cerrojo:
            lista = [dict(u) for u in _datos['usuarios']]
            previo = next((u for u in lista if u['usuario'] == usuario), None)
            if previo and previo['acceso'] == 'todos' and acceso != 'todos' and not any(u['acceso'] == 'todos' and u is not previo for u in lista):
                return _responder(h, 400, {'error': 'No se puede quitar el acceso total al único administrador'})
            nuevo = {'usuario': usuario, 'acceso': acceso, 'hash': huella(usuario, clave)}
            if previo:
                lista[lista.index(previo)] = nuevo
            else:
                lista.append(nuevo)
            try:
                _guardar({**_datos, 'usuarios': lista})
            except Exception as e:
                print('No se pudo guardar:', e)
                return _responder(h, 502, {'error': 'No se pudo guardar la cuenta (revise el token de GitHub del servidor)'})
        return _responder(h, 200, {'ok': True, 'actualizado': bool(previo)})

    m = re.match(r'^/api/usuarios/([^/]+)$', ruta)
    if m and metodo == 'DELETE':
        import urllib.parse
        usuario = urllib.parse.unquote(m.group(1)).strip().lower()
        with _cerrojo:
            lista = [dict(u) for u in _datos['usuarios']]
            objetivo = next((u for u in lista if u['usuario'] == usuario), None)
            if not objetivo:
                return _responder(h, 404, {'error': 'No existe ese usuario'})
            if objetivo['acceso'] == 'todos' and not any(u['acceso'] == 'todos' and u is not objetivo for u in lista):
                return _responder(h, 400, {'error': 'No se puede quitar al único administrador'})
            lista.remove(objetivo)
            try:
                _guardar({**_datos, 'usuarios': lista})
            except Exception as e:
                print('No se pudo guardar:', e)
                return _responder(h, 502, {'error': 'No se pudo guardar el cambio (revise el token de GitHub del servidor)'})
        return _responder(h, 200, {'ok': True})

    _responder(h, 404, {'error': 'No existe'})


cargar()
