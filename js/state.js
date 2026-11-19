/* Estado de la simulación.
   S: lo que el usuario y las secuencias cambian (automáticos, modos, fallas…).
   E: resultado eléctrico calculado a partir de S (ver logic/electrical.js). */

export const S = {
  mains: true,                                   // red eléctrica presente
  CB: { CB1: true, CB2: true, CB3: true, CB4: true, CB5: true, CB6: true, CB7: false },   // true = cerrado (CB7 solo existe en la configuración con interruptor de rodeo)
  bypassMode: 'conmutador',                      // 'conmutador' (llave 1-0-2) o 'rodeo' (interruptor CB7, configuración anterior)
  auxRodeo: true,                                // contacto auxiliar adelantado del CB7 instalado (avisa a la UPS 1 antes de cerrar el rodeo)
  rodeoCmd: false,                               // orden que se dio a la palanca del CB7 (las dos palancas, azul y verde, se mueven juntas desde que se la da)
  auxSenal: false,                               // la señal del contacto auxiliar está activa (llega a la UPS 1 un instante antes de cerrar el CB7 y se va un instante después de abrirlo)
  auxForzo: false,                               // el contacto auxiliar fue quien pasó las UPS de inversor a bypass (al soltarse las devuelve a inversor)
  tripped: [false, false],                       // automático de salida disparado por sobrecorriente (solo con interruptor de rodeo)
  sel: 1,                                        // conmutador bypass: 1 = UPS, 0 = corte, 2 = red
  byp: [false, false],                           // UPS en bypass estático (por UPS, pero comunicadas)
  load: 8,                                       // carga conectada (kW)
  soc: [100, 100],                               // carga de baterías de cada UPS (%)
  off: [false, false],                           // UPS apagada
  dropT: [0, 0],                                 // segundos en bypass sin entrada (se apaga a los 2 s)
  standby: [false, false],                       // UPS en stand by (carga traspasada a la otra)
  manual: [false, false],                        // apagada estando en stand by (arranca directo en inversor)
  risk: [false, false],                          // maniobra de salida fuera de secuencia
  fault: [false, false],                         // falla simulada de la UPS
  cfg: [2, 2],                                   // bancos de baterías configurados en cada UPS (1 o 2)
  bankFault: [[false, false], [false, false]],   // falla simulada de cada banco
};

export let E = null;                             // se asigna en cada ciclo con setE(compute())
export const setE = v => { E = v; };
