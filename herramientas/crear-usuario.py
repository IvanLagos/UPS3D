"""Agrega o actualiza un usuario en usuarios.json del equipo local (se guarda solo la huella de «usuario + clave», nunca el texto).
Sirve para crear el primer administrador o para trabajar sin el servidor de Render; las demás cuentas se gestionan desde el botón «Cuentas» de la página.
Uso: python herramientas/crear-usuario.py
Pide el usuario, la clave (sin mostrarla) y el acceso: oxiquim, sonacol, todos (elige cliente y usa el editor de tableros) o admin (además gestiona las cuentas)."""
import getpass
import hashlib
import json
import re
import sys
from pathlib import Path

archivo = Path(__file__).resolve().parent.parent / 'usuarios.json'
datos = json.loads(archivo.read_text(encoding='utf-8')) if archivo.exists() else {'sal': 'ups3d-fica', 'iter': 200000, 'usuarios': []}

usuario = input('Usuario: ').strip().lower()
if not usuario or re.search(r"[\s'\"\\]", usuario):
    sys.exit('El usuario no puede estar vacío ni tener espacios ni comillas.')
clave = getpass.getpass('Clave (no se muestra, mínimo 6 caracteres): ')
if len(clave) < 6 or clave != getpass.getpass('Repita la clave: '):
    sys.exit('Las claves no coinciden (o tienen menos de 6 caracteres).')
acceso = input('Acceso (oxiquim / sonacol / todos / admin): ').strip().lower()
if acceso not in ('oxiquim', 'sonacol', 'todos', 'admin'):
    sys.exit('El acceso debe ser oxiquim, sonacol, todos o admin.')

huella = hashlib.pbkdf2_hmac('sha256', f'{usuario}\n{clave}'.encode('utf-8'), datos['sal'].encode('utf-8'), int(datos['iter']), 32).hex()
datos['usuarios'] = [u for u in datos['usuarios'] if u['usuario'] != usuario] + [{'usuario': usuario, 'acceso': acceso, 'hash': huella}]
archivo.write_text(json.dumps(datos, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
print(f'Listo: el usuario «{usuario}» entra directo a: {acceso}.')
