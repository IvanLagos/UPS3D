/* Estado de la simulación.
   S: lo que el usuario y las secuencias cambian (automáticos, modos, fallas…).
   E: resultado eléctrico calculado a partir de S (ver logic/electrical.js). */

export const S = {
  mains: true,                                   // red eléctrica presente
  CB: { CB1: true, CB2: true, CB3: true, CB4: true, CB5: true, CB6: true, CB7: false },   // true = cerrado (CB7 solo existe en la configuración con interruptor de rodeo)
  bypassMode: 'conmutador',                      // 'conmutador' (llave 1-0-2) o 'rodeo' (interruptor CB7, configuración anterior)
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
