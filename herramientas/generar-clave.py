"""Genera la huella de una clave de acceso para js/acceso-config.js.
Uso: python herramientas/generar-clave.py "NuevaClave"   (usa la misma SAL y vueltas que js/acceso-config.js)"""
import hashlib
import re
import sys
from pathlib import Path

if len(sys.argv) != 2:
    sys.exit('Uso: python herramientas/generar-clave.py "NuevaClave"')

config = Path(__file__).resolve().parent.parent / 'js' / 'acceso-config.js'
texto = config.read_text(encoding='utf-8')
sal = re.search(r"SAL = '([^']*)'", texto).group(1)
vueltas = int(re.search(r"ITER = (\d+)", texto).group(1))
huella = hashlib.pbkdf2_hmac('sha256', sys.argv[1].encode('utf-8'), sal.encode('utf-8'), vueltas, 32).hex()
print(f"export const CLAVE_HASH = '{huella}';")
print('Pegue esa línea en js/acceso-config.js (reemplazando la anterior).')
