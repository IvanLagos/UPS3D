/* Configuración de la clave de acceso.
   Solo se guarda la huella de la clave (PBKDF2-SHA256, 200000 vueltas, con SAL), nunca la clave en texto.
   Para cambiarla: python herramientas/generar-clave.py "NuevaClave" y pegar el resultado aquí. */
export const SAL = 'ups3d-fica';
export const ITER = 200000;
export const CLAVE_HASH = '863b1e55848237b9c8b6043f78c017afdf8e143519c59123a3ea6b1ba130ed52';
