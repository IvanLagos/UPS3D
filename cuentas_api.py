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
import urllib.parse
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
FRESCURA = 10                                          # segundos que vale lo leído de GitHub antes de volver a consultarlo
_leido = 0.0
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


def _remoto():
    """Cuentas guardadas en GitHub ahora mismo, y la versión (sha) del archivo."""
    r = _gh('GET')
    return json.loads(base64.b64decode(r['content']).decode('utf-8')), r['sha']


def cargar():
    """Lee las cuentas al arrancar: de GitHub si hay token (es la fuente de verdad), si no (o si falla) del archivo local."""
    global _datos, _leido
    if GH_TOKEN:
        try:
            _datos, _ = _remoto()
            _leido = time.time()
            return
        except Exception as e:                          # sin GitHub: se usa la copia desplegada
            print('Aviso: no se pudo leer usuarios.json de GitHub:', _motivo(e))
    try:
        _datos = _leer_local()
    except Exception as e:
        print('Aviso: no se pudo leer usuarios.json:', e)


def refrescar():
    """Vuelve a leer GitHub si lo leído tiene más de FRESCURA segundos: así varios servidores comparten las mismas cuentas.
    Si falla, se sigue con lo que ya había en memoria."""
    global _datos, _leido
    if not GH_TOKEN or time.time() - _leido < FRESCURA:
        return
    _leido = time.time()
    try:
        _datos, _ = _remoto()
    except Exception as e:
        print('Aviso: no se pudo actualizar usuarios.json desde GitHub:', _motivo(e))


class Rechazo(Exception):
    """Cambio de cuentas que no se puede hacer (código HTTP y motivo)."""
    def __init__(self, codigo, motivo):
        super().__init__(motivo)
        self.codigo = codigo


def modificar(cambio):
    """Aplica `cambio(lista)` (modifica la lista de usuarios o lanza Rechazo) sobre las cuentas MÁS RECIENTES y las guarda.
    Con GitHub lee y escribe en el momento (otro servidor pudo haberlas cambiado) y reintenta si hubo un cambio simultáneo."""
    global _datos, _leido
    with _cerrojo:
        for intento in (1, 2):
            datos, sha = _remoto() if GH_TOKEN else (_datos, None)
            lista = [dict(u) for u in datos['usuarios']]
            resultado = cambio(lista)
            nuevos = {**datos, 'usuarios': lista}
            texto = json.dumps(nuevos, ensure_ascii=False, indent=2) + chr(10)
            if GH_TOKEN:
                try:
                    _gh('PUT', {'message': 'Actualiza las cuentas de acceso [skip render]', 'branch': GH_RAMA, 'sha': sha,
                                'content': base64.b64encode(texto.encode('utf-8')).decode()})
                except urllib.error.HTTPError as e:
                    if e.code == 409 and intento == 1:          # alguien guardó entre la lectura y la escritura
                        continue
                    raise
                _leido = time.time()
            else:
                tmp = ARCHIVO + '.tmp'
                with open(tmp, 'w', encoding='utf-8', newline=chr(10)) as f:
                    f.write(texto)
                os.replace(tmp, ARCHIVO)
            _datos = nuevos
            return resultado


def _motivo(e):
    """Texto corto con la causa de un fallo al guardar (código y mensaje de GitHub, si los hay)."""
    if isinstance(e, urllib.error.HTTPError):
        try:
            msg = json.loads(e.read().decode('utf-8')).get('message', '')
        except Exception:
            msg = ''
        return f'GitHub respondió {e.code}: {msg}'.strip()
    return f'{type(e).__name__}: {e}'


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
    refrescar()
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

    def otro_admin(lista, quien):
        return any(u['acceso'] == 'todos' and u is not quien for u in lista)

    if ruta == '/api/usuarios' and metodo == 'POST':
        d = _json(h)
        usuario, clave, acceso = str(d.get('usuario', '')).strip().lower(), str(d.get('clave', '')), d.get('acceso')
        if not NOMBRE_OK.match(usuario):
            return _responder(h, 400, {'error': 'El usuario no puede estar vacío ni tener espacios ni comillas'})
        if len(clave) < 6:
            return _responder(h, 400, {'error': 'La clave debe tener al menos 6 caracteres'})
        if acceso not in ACCESOS:
            return _responder(h, 400, {'error': 'Acceso no válido'})
        nuevo = {'usuario': usuario, 'acceso': acceso, 'hash': huella(usuario, clave)}

        def poner(lista):
            previo = next((u for u in lista if u['usuario'] == usuario), None)
            if previo and previo['acceso'] == 'todos' and acceso != 'todos' and not otro_admin(lista, previo):
                raise Rechazo(400, 'No se puede quitar el acceso total al único administrador')
            if previo:
                lista[lista.index(previo)] = nuevo
            else:
                lista.append(nuevo)
            return bool(previo)

        try:
            actualizado = modificar(poner)
        except Rechazo as e:
            return _responder(h, e.codigo, {'error': str(e)})
        except Exception as e:
            motivo = _motivo(e)
            print('No se pudo guardar:', motivo)
            return _responder(h, 502, {'error': 'No se pudo guardar la cuenta. ' + motivo})
        return _responder(h, 200, {'ok': True, 'actualizado': actualizado})

    m = re.match(r'^/api/usuarios/([^/]+)$', ruta)
    if m and metodo == 'DELETE':
        usuario = urllib.parse.unquote(m.group(1)).strip().lower()

        def quitar(lista):
            objetivo = next((u for u in lista if u['usuario'] == usuario), None)
            if not objetivo:
                raise Rechazo(404, 'No existe ese usuario')
            if objetivo['acceso'] == 'todos' and not otro_admin(lista, objetivo):
                raise Rechazo(400, 'No se puede quitar al único administrador')
            lista.remove(objetivo)

        try:
            modificar(quitar)
        except Rechazo as e:
            return _responder(h, e.codigo, {'error': str(e)})
        except Exception as e:
            motivo = _motivo(e)
            print('No se pudo guardar:', motivo)
            return _responder(h, 502, {'error': 'No se pudo guardar el cambio. ' + motivo})
        return _responder(h, 200, {'ok': True})

    _responder(h, 404, {'error': 'No existe'})


cargar()
