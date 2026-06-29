import { LOCAL_MODE } from './config.js';

// REEMPLAZA ESTA CONFIGURACIÓN CON LA TUYA DE FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyDZGT53d-Zag0oWvd_jOGa8eLOY_1wvjEQ",
    authDomain: "calificador-de-fotos.firebaseapp.com",
    projectId: "calificador-de-fotos",
    storageBucket: "calificador-de-fotos.firebasestorage.app",
    messagingSenderId: "775090584011",
    appId: "1:775090584011:web:79b59d3fb4b23e5c435e4e"
};

// UID del administrador general (solo aplica en modo nube).
// Para obtenerlo: inicia sesión y ejecuta en consola: console.log(auth.currentUser.uid)
const SUPER_ADMIN_UID = "unZtDSytjOXGpCB21jKeicWWkMG3";

const TOURIST_MODE = "tourist";

// Inicialización perezosa: nada de esto se ejecuta (ni se descarga el SDK de
// Firebase) hasta que algo llame a getAuthInstance()/getDbInstance(), y eso
// solo ocurre en modo nube. Así, si la carga del SDK falla (sin red, etc.),
// el error queda contenido en esta promesa y no rompe la evaluación de los
// módulos que importan este archivo de forma estática (script.js, dataStore.js).
let initPromise = null;
let auth = null;
let db = null;

function ensureFirebaseInitialized() {
    if (LOCAL_MODE) {
        throw new Error('Firebase no debe usarse en modo local');
    }
    if (!initPromise) {
        initPromise = (async () => {
            const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
            const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

            const app = initializeApp(firebaseConfig);
            auth = getAuth(app);
            db = getFirestore(app);
        })();
    }
    return initPromise;
}

export async function getAuthInstance() {
    await ensureFirebaseInitialized();
    return auth;
}

export async function getDbInstance() {
    await ensureFirebaseInitialized();
    return db;
}

export { SUPER_ADMIN_UID, TOURIST_MODE };
