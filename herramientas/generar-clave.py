"""Genera la huella de una clave de acceso para js/acceso-config.js.
Uso: python herramientas/generar-clave.py "NuevaClave"   (debe usar la misma SAL que js/acceso-config.js)"""
import hashlib
import re
import sys
from pathlib import Path

if len(sys.argv) != 2:
    sys.exit('Uso: python herramientas/generar-clave.py "NuevaClave"')

config = Path(__file__).resolve().parent.parent / 'js' / 'acceso-config.js'
sal = re.search(r"SAL = '([^']*)'", config.read_text(encoding='utf-8')).group(1)
huella = hashlib.sha256((sal + sys.argv[1]).encode('utf-8')).hexdigest()
print(f"export const CLAVE_HASH = '{huella}';")
print('Pegue esa línea en js/acceso-config.js (reemplazando la anterior).')
