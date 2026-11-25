# UPS Modular 3D

Visor 3D interactivo para presentar a clientes un sistema de **UPS modulares redundantes**: un rack con puertas,
2 UPS de 10 kVA (modelo provisional IUiR-10KW) y 2 bancos de baterías por UPS, con una lógica eléctrica realista
de automáticos (CB), bypass estático, bypass de rodeo, stand by, fallas y alarmas, más un diagrama unifilar en vivo.

Hecho con [three.js](https://threejs.org/) como módulos ES, sin compilación ni dependencias locales.

## Cómo ejecutarlo

Los módulos ES necesitan un servidor local (no funcionan abriendo `index.html` con doble clic).

- **Windows:** doble clic en `inicio.bat` (usa Python, abre `http://localhost:8765/`).
- **Cualquier sistema:** `python servidor.py 8765` en esta carpeta y abrir `http://localhost:8765/index.html`
  (`servidor.py` desactiva la caché para que los cambios se vean al recargar; también sirve `python -m http.server`).

> three.js se carga desde un CDN (ver `importmap` en `index.html`), por lo que se necesita internet.

## Qué se puede hacer

- Abrir/cerrar puertas y laterales, extraer UPS y bancos (`Ctrl+clic` los retira por completo).
- **Montar / Desmontar** el rack con secuencias automáticas que maniobran los automáticos sin botar la carga.
- Operar los automáticos **CB1…CB6** y el **conmutador bypass 1-0-2** (en el rack, el panel lateral o el unifilar) y ver sus consecuencias.
- Botones de cada UPS: **INV** (inversor), **BYP** (bypass estático), **TRAS** (traspaso de carga / stand by), **BAT** (1 o 2 bancos).
- Simular fallas de UPS y de bancos, corte de red y variar la carga (1 s real = 1 min simulado).

### Automáticos

| CB  | Función |
|-----|---------|
| CB5 | General |
| CB1 / CB3 | Entrada UPS 1 / UPS 2 |
| CB2 / CB4 | Salida UPS 1 / UPS 2 |
| CB6 | Salida a la carga |
| Conmutador 1-0-2 | Bypass de rodeo: 1 = la carga cuelga de las UPS · 0 = carga cortada · 2 = la red alimenta la carga directo, por fuera de las UPS |

### Dos configuraciones del bypass de rodeo

Desde el botón **«Bypass de rodeo»** del diagrama unifilar se puede alternar entre:

- **Conmutador 1-0-2** (por defecto): de ruptura antes de cierre; al pasar de 1 a 2 siempre pasa por 0 y la carga se corta un instante. Red e inversor nunca se unen.
- **Interruptor CB7** (configuración anterior): un automático que puede cerrarse con las UPS en inversor. Si se hace, red e inversor se unen sin sincronizar: **se disparan CB2 y CB4 por sobrecorriente y ambas UPS entran en falla**; los automáticos hay que reponerlos a mano.

Al cambiar de configuración el rack 3D, el panel lateral, el unifilar y las secuencias de montaje y desmontaje se adaptan.

### Reglas principales de la lógica

- Las dos UPS están comunicadas por un cable: siempre están **ambas en bypass o ambas en inversor**.
- Una UPS que arranca entra en bypass; pasa a inversor solo por comando (INV). La que se apagó en stand by arranca directo en inversor.
- El bypass estático funciona siempre que la UPS tenga tensión de entrada; sin entrada en bypass, la carga cae y la UPS se apaga a los 2 s.
- El conmutador bypass 1-0-2 es de ruptura antes de cierre: de 1 a 2 (o al revés) **siempre pasa por 0** y la carga se queda sin energía un instante, así que red e inversor nunca quedan unidos.
- Cada UPS usa los bancos configurados (BAT). Con menos bancos sanos que los configurados, las baterías se inhiben y se alarma.

## Estructura del proyecto

```
UPS3D/
├── index.html            Estructura de la página (visor 3D + panel lateral + unifilar SVG)
├── inicio.bat            Arranque rápido en Windows
├── servidor.py           Servidor local sin caché
├── css/
│   └── styles.css        Estilos del panel, unifilar, avisos y miniaturas
├── assets/
│   ├── logo-fernandez-fica.png   (logo ancho: sticker de la puerta)
│   ├── favicon.png / favicon.ico (ícono de la pestaña del navegador)
└── js/
    ├── main.js           Punto de entrada: arranque y bucle de animación/simulación
    ├── config.js         Automáticos (CB), textos de modo, constantes de capacidad
    ├── state.js          Estado de la simulación (S) y resultado eléctrico (E)
    ├── core/             Base 3D y utilidades
    │   ├── dom.js          Acceso al DOM
    │   ├── scene.js        Renderizador, cámara, controles, luces, piso
    │   ├── materials.js    Materiales compartidos
    │   ├── helpers.js      box(), etiquetas de texto, rectángulo redondeado
    │   ├── tween.js        Animaciones
    │   ├── interaction.js  Clic, hover, globos informativos y avisos
    │   └── bus.js          Registro de acciones (evita dependencias circulares)
    ├── model/            Modelo 3D
    │   ├── rack.js         Estructura, rieles, techo, laterales, ventiladores
    │   ├── doors.js        Puertas (vidrio, goma, logo, placa, rejillas)
    │   ├── breakerPanel.js Tablero de automáticos
    │   ├── boardWiring.js  Barras, borneras y cables del tablero
    │   ├── boardCover.js   Cubiertas con bisagra del tablero (pilotos arriba, interruptores abajo)
    │   ├── modules.js      UPS y bancos de baterías
    │   └── load.js         Carga y luz verde
    ├── logic/            Lógica eléctrica
    │   ├── electrical.js   compute(): modos, tensiones y salida a partir del estado
    │   ├── simulate.js     Evolución en el tiempo (apagados, arranques, baterías)
    │   ├── refresh.js      Recalcula y repinta cuando algo cambia
    │   ├── actions.js      Acciones del usuario (puertas, módulos, CB, bypass, stand by, fallas, bancos)
    │   └── sequences.js    Secuencias de montaje y desmontaje
    └── ui/               Interfaz
        ├── sync.js         Sincroniza controles del panel con el estado
        ├── visuals.js      LEDs, unifilar, alarmas, métricas y pantallas de las UPS
        └── controls.js     Cableado de botones, interruptores, cámaras y captura PNG
```

### Flujo de datos

`S` (estado) → `compute()` → `E` (resultado) → `applyVisuals()` / `applyLive()`.
Las acciones modifican `S`; `simulate(dt)` hace evolucionar `S` con el tiempo; `refresh()` recalcula `E` en cada cuadro.

## Usuarios y claves

La página pide **usuario y clave** y los verifica el servidor (`cuentas_api.py`, dentro de `servidor.py`). Cada usuario entra directo a su cliente: acceso `oxiquim`, `sonacol`, `todos`
(elige cliente y usa el editor de tableros) o `admin` (lo mismo y además gestiona las cuentas desde el botón **Cuentas**; los cambios valen al instante para todos).
Las cuentas están en `usuarios.json` (usuario, acceso y huella PBKDF2 de «usuario + clave»; nunca la clave). El servidor no entrega ese archivo ni los `.py`.

- **Primer administrador (o trabajo local):** `python herramientas/crear-usuario.py` (pide usuario, clave sin mostrarla y acceso).
- **En Render** hay que usar un *Web Service* (no un sitio estático): Build Command vacío, Start Command `python servidor.py` (Render define `PORT`). Para que las cuentas creadas desde el panel
  no se pierdan al reiniciar, el servidor las guarda en este repositorio (un commit a `usuarios.json` con `[skip render]`). Variables de entorno: `GH_TOKEN` (token fino de GitHub con permiso
  *Contents: Read and write* sobre este repositorio), `GH_REPO` (`IvanLagos/UPS3D`), `GH_RAMA` (`main`) y `SESION_SECRETO` (un texto largo y secreto cualquiera).
- Las sesiones duran 12 horas y hay un límite de intentos fallidos por minuto. El código de la página sigue siendo público en GitHub: la protección cubre el ingreso a la aplicación, no la lectura de los archivos publicados.

## Versionado de archivos (evita mezclas de caché en GitHub Pages)

GitHub Pages deja los archivos en la caché del navegador unos 10 minutos. Para que el navegador nunca mezcle archivos viejos con nuevos
tras una actualización, `index.html` apunta a cada archivo con una versión (`?v=<huella del contenido>`).
**Antes de cada commit** ejecute:

```bash
python herramientas/version.py
```

El script reescribe el `importmap`, el `<link>` del CSS y el `<script>` de entrada de `index.html`; solo cambia la versión de los archivos modificados.

## Subir a GitHub

```bash
cd UPS3D
git init
python herramientas/version.py
git add .
git commit -m "UPS Modular 3D: visor 3D de UPS modulares"
git branch -M main
git remote add origin https://github.com/<usuario>/<repositorio>.git
git push -u origin main
```

Para publicarlo como sitio web gratuito, se puede activar **GitHub Pages** (rama `main`, carpeta raíz).
