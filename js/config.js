/* Configuración del modelo: automáticos (CB), textos de modo y medidas del rack. */

/* Automáticos (circuit breakers) en el orden en que van en el tablero y en el panel lateral.
   `name`: nombre completo; `label`: texto de la placa negra en el rack (admite salto de línea). */
export const BREAKERS = [
  { id: 'CB5', name: 'GENERAL', label: 'GENERAL' },
  { id: 'CB1', name: 'ENTRADA UPS 1', label: 'ENTRADA\nUPS 1' },
  { id: 'CB2', name: 'SALIDA UPS 1', label: 'SALIDA\nUPS 1' },
  { id: 'CB3', name: 'ENTRADA UPS 2', label: 'ENTRADA\nUPS 2' },
  { id: 'CB4', name: 'SALIDA UPS 2', label: 'SALIDA\nUPS 2' },
  { id: 'CB6', name: 'SALIDA', label: 'SALIDA' },
  { id: 'CB7', name: 'BYPASS DE RODEO', label: 'BYPASS\nDE RODEO' },
];

export const CB_IN = ['CB1', 'CB3'];    // entrada de cada UPS
export const CB_OUT = ['CB2', 'CB4'];   // salida de cada UPS

/** Nombre legible de un automático, p. ej. "salida UPS 1". */
export const breakerName = id => BREAKERS.find(b => b.id === id).name.toLowerCase().replace('ups', 'UPS');

export const MODE_TXT = {
  rodeo: 'Bypass de rodeo', falla: 'En falla', normal: 'Normal (inversor)', bateria: 'Respaldo baterías',
  bypass: 'Bypass', transfer: 'Transfiriendo', apagada: 'UPS apagada', mixto: 'Mixto', none: 'Sin salida',
};

/* Capacidad del modelo provisional IUiR-10KW */
export const UPS_KW = 10;          // potencia de cada UPS
export const BANK_KWH = 2;         // energía de cada banco de baterías
export const CHARGE_KW = 3;        // potencia de carga de baterías
