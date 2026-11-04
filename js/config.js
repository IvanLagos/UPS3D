/* Configuración del modelo: automáticos (CB), textos de modo y medidas del rack. */

/* Automáticos (circuit breakers) en el orden en que van en el tablero y en el panel lateral.
   `name`: nombre completo; `label`: texto de la placa negra junto a la palanca (admite salto de línea);
   `pilot`: luz piloto de encendido/apagado (rojas arriba: general, salida, rodeo; verdes abajo: entradas y salidas de las UPS). */
export const BREAKERS = [
  { id: 'CB5', name: 'GENERAL', label: 'GENERAL', pilot: { color: 'red', col: 0, text: 'GENERAL' } },
  { id: 'CB1', name: 'ENTRADA UPS 1', label: 'ENTRADA\nUPS 1', pilot: { color: 'green', col: 0, text: 'ENTRADA UPS 1' } },
  { id: 'CB2', name: 'SALIDA UPS 1', label: 'SALIDA\nUPS 1', pilot: { color: 'green', col: 2, text: 'SALIDA UPS 1' } },
  { id: 'CB3', name: 'ENTRADA UPS 2', label: 'ENTRADA\nUPS 2', pilot: { color: 'green', col: 1, text: 'ENTRADA UPS 2' } },
  { id: 'CB4', name: 'SALIDA UPS 2', label: 'SALIDA\nUPS 2', pilot: { color: 'green', col: 3, text: 'SALIDA UPS 2' } },
  { id: 'CB6', name: 'SALIDA', label: 'SALIDA', pilot: { color: 'red', col: 1, text: 'SALIDA' } },
];

/* Conmutador bypass (1-0-2), en el último lugar del riel:
   1 = la carga cuelga de las UPS · 0 = carga cortada · 2 = la red alimenta la carga directo, por fuera de las UPS.
   Es de ruptura antes de cierre: de 1 a 2 (o al revés) siempre pasa por 0, así red e inversor nunca quedan unidos. */
export const SELECTOR = { id: 'SEL', name: 'CONMUTADOR BYPASS', label: 'CONMUTADOR\nBYPASS', pilot: { color: 'red', col: 2, text: 'BYPASS RODEO' } };
export const RAIL_ITEMS = [...BREAKERS, SELECTOR];   // orden en el riel: los 6 automáticos y el conmutador
export const SEL_TEXT = { 1: 'la carga cuelga de las UPS', 0: 'carga cortada', 2: 'la red alimenta la carga directo, por fuera de las UPS' };

/* Configuración anterior del bypass de rodeo: un interruptor (CB7) que puede cerrarse con las UPS en inversor.
   Se puede comparar con el conmutador 1-0-2 desde el botón del diagrama unifilar. */
export const BYPASS_BREAKER = { id: 'CB7', name: 'BYPASS DE RODEO', label: 'BYPASS\nDE RODEO' };
export const ALL_CB = [...BREAKERS, BYPASS_BREAKER];   // todos los interruptores: los 6 fijos y el CB7 (solo en esa configuración)

export const CB_IN = ['CB1', 'CB3'];    // entrada de cada UPS
export const CB_OUT = ['CB2', 'CB4'];   // salida de cada UPS

/** Nombre legible de un automático, p. ej. "salida UPS 1". */
export const breakerName = id => ALL_CB.find(b => b.id === id).name.toLowerCase().replace('ups', 'UPS');

export const MODE_TXT = {
  rodeo: 'Bypass de rodeo', falla: 'En falla', normal: 'Normal (inversor)', bateria: 'Respaldo baterías',
  bypass: 'Bypass', transfer: 'Transfiriendo', apagada: 'UPS apagada', mixto: 'Mixto', none: 'Sin salida',
};

/* Capacidad del modelo provisional IUiR-10KW */
export const UPS_KW = 10;          // potencia de cada UPS
export const BANK_KWH = 2;         // energía de cada banco de baterías
export const CHARGE_KW = 3;        // potencia de carga de baterías
