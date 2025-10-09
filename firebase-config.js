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

// Definir el administrador y turista
const ADMIN_EMAIL = "maurer.sergio@gmail.com"; // CAMBIA ESTO por tu email de admin
const TOURIST_MODE = "tourist"; // Identificador para modo turista

// Exportar para usar en otros archivos
export { auth, db, ADMIN_EMAIL, TOURIST_MODE };