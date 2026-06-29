// Capa de persistencia: en modo local usa localStorage, en modo nube usa Firestore.
// El resto de la app solo llama a saveSet / querySets / getSet y no le importa de dónde vienen los datos.
import { LOCAL_MODE } from './config.js';
import { getDbInstance } from './firebase-config.js';

const LOCAL_KEY = 'calificador_photo_sets';

function readLocalSets() {
    try {
        return JSON.parse(localStorage.getItem(LOCAL_KEY)) || [];
    } catch {
        return [];
    }
}

function writeLocalSets(sets) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(sets));
}

export function normalizeDate(fecha) {
    if (!fecha) return new Date(0);
    if (typeof fecha.toDate === 'function') return fecha.toDate(); // Firestore Timestamp
    return new Date(fecha); // ISO string (modo local)
}

// Guarda un set y devuelve su id.
export async function saveSet(setData) {
    if (LOCAL_MODE) {
        const sets = readLocalSets();
        const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        sets.push({ ...setData, id, fecha: new Date().toISOString() });
        writeLocalSets(sets);
        return id;
    }

    const db = await getDbInstance();
    const { collection, addDoc, Timestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const docRef = await addDoc(collection(db, 'photo_sets'), { ...setData, fecha: Timestamp.now() });
    return docRef.id;
}

// Devuelve los sets del usuario, ya filtrados y ordenados del más reciente al más antiguo.
// Cada set incluye `fechaDate` (objeto Date) además del campo original `fecha`.
export async function querySets(userId, filters = {}) {
    let sets;

    if (LOCAL_MODE) {
        sets = readLocalSets();
    } else {
        const db = await getDbInstance();
        const { collection, query, where, orderBy, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const q = query(
            collection(db, 'photo_sets'),
            where('userId', '==', userId),
            orderBy('fecha', 'desc')
        );
        const snapshot = await getDocs(q);
        sets = [];
        snapshot.forEach(d => sets.push({ id: d.id, ...d.data() }));
    }

    sets = sets
        .map(s => ({ ...s, fechaDate: normalizeDate(s.fecha) }))
        .sort((a, b) => b.fechaDate - a.fechaDate);

    if (filters.dateFrom) {
        const from = new Date(filters.dateFrom);
        from.setHours(0, 0, 0, 0);
        sets = sets.filter(s => s.fechaDate >= from);
    }
    if (filters.dateTo) {
        const to = new Date(filters.dateTo);
        to.setHours(23, 59, 59, 999);
        sets = sets.filter(s => s.fechaDate <= to);
    }
    if (filters.rating === 'excellent') {
        sets = sets.filter(s => s.calificacionFinal >= 90);
    } else if (filters.rating === 'good') {
        sets = sets.filter(s => s.calificacionFinal >= 75 && s.calificacionFinal < 90);
    } else if (filters.rating === 'rejected') {
        sets = sets.filter(s => s.calificacionFinal < 75);
    }

    return sets;
}

// Devuelve un set por id, o null si no existe.
export async function getSet(id) {
    if (LOCAL_MODE) {
        return readLocalSets().find(s => s.id === id) || null;
    }

    const db = await getDbInstance();
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const snap = await getDoc(doc(db, 'photo_sets', id));
    return snap.exists() ? { id, ...snap.data() } : null;
}
