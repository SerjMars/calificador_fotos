// Autenticación y gestión de usuarios en modo NUBE (Firebase Auth + Firestore).
// Este módulo solo se importa dinámicamente cuando LOCAL_MODE es false, así el
// modo local no descarga ni depende del SDK de Firebase.
import { getAuthInstance, getDbInstance, SUPER_ADMIN_UID } from './firebase-config.js';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
    doc,
    setDoc,
    getDoc,
    updateDoc,
    deleteDoc,
    collection,
    getDocs,
    query,
    where
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

async function checkUserRole(user) {
    if (user.uid === SUPER_ADMIN_UID) {
        return 'super_admin';
    }

    const db = await getDbInstance();
    const roleDoc = await getDoc(doc(db, 'user_roles', user.uid));
    if (roleDoc.exists()) {
        return roleDoc.data().role || 'user';
    }

    await setDoc(doc(db, 'user_roles', user.uid), {
        role: 'user',
        email: user.email,
        createdAt: new Date()
    });
    return 'user';
}

// Suscribe a los cambios de sesión. onLogin(user, role) / onLogout().
export async function watchAuthState({ onLogin, onLogout }) {
    const auth = await getAuthInstance();
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            onLogout();
            return;
        }
        const role = await checkUserRole(user);
        onLogin(user, role);
    });
}

export async function login(email, password) {
    const auth = await getAuthInstance();
    await signInWithEmailAndPassword(auth, email, password);
}

export async function logout() {
    const auth = await getAuthInstance();
    await signOut(auth);
}

export async function loadUsers() {
    const db = await getDbInstance();
    const snapshot = await getDocs(collection(db, 'user_roles'));
    const users = [];
    snapshot.forEach(d => users.push({ uid: d.id, ...d.data() }));

    const roleOrder = { super_admin: 0, admin: 1, user: 2 };
    users.sort((a, b) => roleOrder[a.role] - roleOrder[b.role]);
    return users;
}

export async function changeUserRole(userId, newRole) {
    const db = await getDbInstance();
    await updateDoc(doc(db, 'user_roles', userId), {
        role: newRole,
        updatedAt: new Date()
    });
}

export async function deleteUserAccount(userId, email) {
    const db = await getDbInstance();
    await deleteDoc(doc(db, 'user_roles', userId));

    const invitationsQuery = query(collection(db, 'invitations'), where('email', '==', email));
    const snapshot = await getDocs(invitationsQuery);
    await Promise.all(snapshot.docs.map(d => deleteDoc(d.ref)));
}

// Crea el usuario en Firebase Authentication y su rol en Firestore.
// Nota: createUserWithEmailAndPassword inicia sesión como el usuario nuevo,
// por eso se cierra sesión justo después para devolver el control al admin.
export async function createUserAccount(email, password, role, createdBy) {
    const auth = await getAuthInstance();
    const db = await getDbInstance();
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const newUserId = userCredential.user.uid;

    await setDoc(doc(db, 'user_roles', newUserId), {
        role,
        email,
        createdBy,
        createdAt: new Date()
    });

    await signOut(auth);
}

export { SUPER_ADMIN_UID };
