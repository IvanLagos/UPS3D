/* Configuración de la clave de acceso.
   Solo se guarda la huella de la clave (PBKDF2-SHA256, 200000 vueltas, con SAL), nunca la clave en texto.
   Para cambiarla: python herramientas/generar-clave.py "NuevaClave" y pegar el resultado aquí. */
export const SAL = 'ups3d-fica';
export const ITER = 200000;
export const CLAVE_HASH = 'be1623eb06b383fa05f906cf8518b1c882cc4cbe7e2bb24135e9cac97d270037';
