// Importar las funciones necesarias de Firebase
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// REEMPLAZA ESTA CONFIGURACIÓN CON LA TUYA DE FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyDZGT53d-Zag0oWvd_jOGa8eLOY_1wvjEQ",
  authDomain: "calificador-de-fotos.firebaseapp.com",
  projectId: "calificador-de-fotos",
  storageBucket: "calificador-de-fotos.firebasestorage.app",
  messagingSenderId: "775090584011",
  appId: "1:775090584011:web:79b59d3fb4b23e5c435e4e"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// UID del administrador general (DEBES CAMBIARLO POR TU UID REAL)
// Para obtenerlo: Inicia sesión y ejecuta en consola: console.log(auth.currentUser.uid)
const SUPER_ADMIN_UID = "unZtDSytjOXGpCB21jKeicWWkMG3"; 

const TOURIST_MODE = "tourist";

// Exportar para usar en otros archivos
export { auth, db, SUPER_ADMIN_UID, TOURIST_MODE };