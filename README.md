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
- Operar los automáticos **CB1…CB7** (en el rack, el panel lateral o el unifilar) y ver sus consecuencias.
- Botones de cada UPS: **INV** (inversor), **BYP** (bypass estático), **TRAS** (traspaso de carga / stand by), **BAT** (1 o 2 bancos).
- Simular fallas de UPS y de bancos, corte de red y variar la carga (1 s real = 1 min simulado).

### Automáticos

| CB  | Función |
|-----|---------|
| CB5 | General |
| CB1 / CB3 | Entrada UPS 1 / UPS 2 |
| CB2 / CB4 | Salida UPS 1 / UPS 2 |
| CB6 | Salida a la carga |
| CB7 | Bypass de rodeo (red directa a la salida, por fuera de las UPS) |

### Reglas principales de la lógica

- Las dos UPS están comunicadas por un cable: siempre están **ambas en bypass o ambas en inversor**.
- Una UPS que arranca entra en bypass; pasa a inversor solo por comando (INV). La que se apagó en stand by arranca directo en inversor.
- El bypass estático funciona siempre que la UPS tenga tensión de entrada; sin entrada en bypass, la carga cae y la UPS se apaga a los 2 s.
- Cerrar **CB7** con las UPS en inversor une red e inversor sin sincronizar: **ambas UPS entran en falla**.
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
        ├── controls.js     Cableado de botones, interruptores, cámaras y captura PNG
        └── photos.js       Fotos de referencia
```

### Flujo de datos

`S` (estado) → `compute()` → `E` (resultado) → `applyVisuals()` / `applyLive()`.
Las acciones modifican `S`; `simulate(dt)` hace evolucionar `S` con el tiempo; `refresh()` recalcula `E` en cada cuadro.

## Subir a GitHub

```bash
cd UPS3D
git init
git add .
git commit -m "UPS Modular 3D: visor 3D de UPS modulares"
git branch -M main
git remote add origin https://github.com/<usuario>/<repositorio>.git
git push -u origin main
```

Para publicarlo como sitio web gratuito, se puede activar **GitHub Pages** (rama `main`, carpeta raíz).
