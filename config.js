// Modo de ejecución de la app.
// true  -> Modo LOCAL: sin Firebase, sin login, todo se guarda en localStorage del navegador.
//          Útil para probar y depurar la lógica de calificación sin depender de la nube.
// false -> Modo NUBE: usa Firebase Auth + Firestore (roles, multiusuario, persistencia remota).
export const LOCAL_MODE = false;
