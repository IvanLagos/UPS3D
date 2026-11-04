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

## Clave de acceso

La página pide una clave antes de cargar la simulación (el campo siempre oculta lo que se escribe). Clave por defecto: **`Fernandez@030`**.
Una vez ingresada, no se vuelve a pedir mientras la pestaña siga abierta.

Para cambiarla:

```bash
python herramientas/generar-clave.py "NuevaClave"
```

Pegue la línea que imprime en `js/acceso-config.js` (reemplazando `CLAVE_HASH`). En el código solo queda la huella SHA-256 de la clave, no el texto.

> Es una barrera del lado del navegador, pensada para cuidar la presentación frente a terceros: todo el código sigue siendo público en GitHub y alguien con conocimientos podría saltársela. Para una protección real hay que usar un repositorio privado o un servidor con autenticación.

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
