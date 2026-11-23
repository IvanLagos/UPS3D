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
echo La pagina se recarga sola cuando cambian los archivos.
echo Cierre esta ventana para detener el servidor.
start "" "http://localhost:%PUERTO%/index.html"

:servidor
%PY% servidor.py %PUERTO%
echo.
echo El servidor se detuvo. Reiniciando en 2 segundos... (cierre esta ventana para salir)
timeout /t 2 /nobreak >nul
goto servidor
