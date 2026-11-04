/* Configuración de la clave de acceso.
   Solo se guarda la huella SHA-256 de (SAL + clave), no la clave en texto.
   Para cambiarla: python herramientas/generar-clave.py "NuevaClave" y pegar el resultado en CLAVE_HASH.
   Clave por defecto: Fernandez@030 */
export const SAL = 'ups3d-fica';
export const CLAVE_HASH = '049446a9fda6360dac4cccf9a7c94fff3f507ccc282a2334312610217a73627c';
