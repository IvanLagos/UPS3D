@echo off
title UPS Modular 3D
cd /d "%~dp0"
set PUERTO=8765

where python >nul 2>nul
if %errorlevel%==0 (
  set PY=python
) else (
  where py >nul 2>nul
  if %errorlevel%==0 (
    set PY=py
  ) else (
    echo No se encontro Python. Instalelo desde https://www.python.org/downloads/
    pause
    exit /b 1
  )
)

echo Iniciando UPS Modular 3D en http://localhost:%PUERTO%/
echo Cierre esta ventana para detener el servidor.
start "" "http://localhost:%PUERTO%/index.html"
%PY% servidor.py %PUERTO%
