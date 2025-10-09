import { auth, db, ADMIN_EMAIL, TOURIST_MODE } from './firebase-config.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
    collection, 
    addDoc, 
    query, 
    where, 
    getDocs,
    orderBy,
    Timestamp,
    doc,
    getDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Configuración inicial
const NUM_PHOTOS = 4;
window.photos = [];  // ← Ahora es global
const photos = window.photos;  // ← Mantener referencia local
let currentUser = null;
let isAdmin = false;
let isTourist = false;

// Parámetros que se califican
const parameters = [
    { 
        id: 'distance', 
        label: 'Vista', 
        weight: 'weight_distance',
        type: 'distance',
        group: 'main',
        distanceType: {
            options: [
                { value: '', label: 'Seleccionar' },
                { value: 'larga', label: 'Larga' },
                { value: 'media', label: 'Media' },
                { value: 'corta', label: 'Corta' },
                { value: 'detalle', label: 'Detalle' }
            ]
        },
        distanceQuality: {
            options: [
                { value: 2, label: 'Muy lejos' },
                { value: 10, label: 'Adecuada' },
                { value: 2, label: 'Muy cerca' }
            ]
        }
    },
    { 
        id: 'lighting', 
        label: 'Iluminación', 
        weight: 'weight_lighting',
        type: 'scale',
        group: 'main',
        options: [
            { value: 0, label: 'Muy mala' },
            { value: 1.5, label: 'Mala' },
            { value: 4.5, label: 'Aceptable' },
            { value: 7.5, label: 'Buena' },
            { value: 15, label: 'Muy buena' }
        ]
    },
    { 
        id: 'sharpness', 
        label: 'Nitidez', 
        weight: 'weight_sharpness',
        type: 'scale',
        group: 'main',
        options: [
            { value: 0, label: 'Muy borrosa' },
            { value: 1.5, label: 'Borrosa' },
            { value: 4.5, label: 'Aceptable' },
            { value: 7.5, label: 'Nítida' },
            { value: 15, label: 'Muy nítida' }
        ]
    },
    { 
        id: 'visibility', 
        label: 'Visibilidad', 
        weight: 'weight_visibility',
        type: 'scale',
        group: 'main',
        options: [
            { value: 0, label: 'No visible' },
            { value: 5, label: 'Parcialmente visible' },
            { value: 20, label: 'Visible' }
        ]
    },
    { 
        id: 'onroad', 
        label: 'Sobre la vía', 
        weight: 'weight_onroad',
        type: 'toggle',
        group: 'grid',
        points: { yes: 15, no: 0 }
    },
    { 
        id: 'vehicles', 
        label: 'Vehículos', 
        weight: 'weight_vehicles',
        type: 'toggle',
        group: 'grid',
        points: { yes: 5, no: 0 }
    },
    { 
        id: 'orientation', 
        label: 'Horizontal', 
        weight: 'weight_orientation',
        type: 'toggle_auto',
        group: 'grid',
        points: { yes: 20, no: -100 }
    }
];

// ==================== AUTENTICACIÓN ====================

window.register = async function() {
    const email = document.getElementById('emailInput').value;
    const password = document.getElementById('passwordInput').value;
    
    if (!email || !password) {
        alert('Por favor ingresa email y contraseña');
        return;
    }
    
    try {
        await createUserWithEmailAndPassword(auth, email, password);
        alert('Cuenta creada exitosamente');
    } catch (error) {
        alert('Error al registrar: ' + error.message);
    }
}

window.login = async function() {
    const email = document.getElementById('emailInput').value;
    const password = document.getElementById('passwordInput').value;
    
    if (!email || !password) {
        alert('Por favor ingresa email y contraseña');
        return;
    }
    
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        alert('Error al iniciar sesión: ' + error.message);
    }
}

// Entrar como turista (modo demo sin guardar)
window.enterAsTourist = function() {
    isTourist = true;
    currentUser = {
        uid: TOURIST_MODE,
        email: "turista@demo.app",
        isTourist: true
    };
    
    document.getElementById('authPanel').style.display = 'none';
    document.getElementById('mainPanel').style.display = 'block';
    
    // Mostrar info de turista
    document.getElementById('userEmail').innerHTML = `
        <span>turista@demo.app</span>
        <span class="tourist-badge">TURISTA</span>
    `;
    
    // Agregar advertencia de modo turista
    const mainPanel = document.getElementById('mainPanel');
    const warning = document.createElement('div');
    warning.className = 'tourist-warning';
    warning.innerHTML = '⚠️ Modo Turista: Puedes usar la aplicación libremente, pero tus datos NO se guardarán al salir.';
    mainPanel.insertBefore(warning, mainPanel.firstChild);
    
    init();
}

// Observador de autenticación
onAuthStateChanged(auth, (user) => {
    // No sobrescribir si ya está en modo turista
    if (isTourist) return;
    
    currentUser = user;
    if (user) {
        // Verificar si es administrador
        isAdmin = user.email === ADMIN_EMAIL;
        
        document.getElementById('authPanel').style.display = 'none';
        document.getElementById('mainPanel').style.display = 'block';
        
        // Mostrar email con badge de admin si corresponde
        if (isAdmin) {
            document.getElementById('userEmail').innerHTML = `
                <span>${user.email}</span>
                <span style="background: #ec1c24; color: white; padding: 3px 8px; border-radius: 3px; font-size: 0.8em; margin-left: 10px;">ADMIN</span>
            `;
        } else {
            document.getElementById('userEmail').textContent = user.email;
        }
        
        init();
    } else {
        document.getElementById('authPanel').style.display = 'block';
        document.getElementById('mainPanel').style.display = 'none';
        isAdmin = false;
    }
});

window.logout = async function() {
    try {
        if (isTourist) {
            // Si es turista, solo limpiar el estado
            isTourist = false;
            currentUser = null;
            document.getElementById('authPanel').style.display = 'block';
            document.getElementById('mainPanel').style.display = 'none';
            
            // Limpiar advertencia
            const warning = document.querySelector('.tourist-warning');
            if (warning) warning.remove();
            
            // Recargar página para limpiar todo
            location.reload();
        } else {
            await signOut(auth);
        }
    } catch (error) {
        alert('Error al cerrar sesión: ' + error.message);
    }
}

// ==================== FUNCIONES PRINCIPALES ====================

// Inicializar la aplicación
function init() {
    const grid = document.getElementById('photosGrid');
    grid.innerHTML = ''; // Limpiar grid
    
    for (let i = 0; i < NUM_PHOTOS; i++) {
        photos[i] = {
            image: null,
            imageBase64: null,
            width: 0,
            height: 0,
            ratings: {},
            isEmpty: true
        };

        // Inicializar ratings con valores mínimos
        parameters.forEach(param => {
            if (param.type === 'distance') {
                photos[i].ratings[param.id] = 2;
                photos[i].ratings[param.id + '_type'] = '';
            } else if (param.type === 'toggle' || param.type === 'toggle_auto') {
                photos[i].ratings[param.id] = param.points ? param.points.no : 0;
            } else if (param.type === 'scale') {
                photos[i].ratings[param.id] = param.options[0].value;
            } else {
                photos[i].ratings[param.id] = 0;
            }
        });

        // Crear la tarjeta de la foto
        const card = createPhotoCard(i);
        grid.appendChild(card);
    }

    // Configurar drag and drop
    setupDragAndDrop();

    // Agregar listeners a los inputs de ponderación
    parameters.forEach(param => {
        const input = document.getElementById(param.weight);
        if (input) {
            input.addEventListener('input', calculateAllScores);
        }
    });

    // Mostrar u ocultar ponderaciones según el rol
    updateWeightsVisibility(); 

    calculateAllScores();
}

// Configurar drag and drop
function setupDragAndDrop() {
    const dropZone = document.getElementById('dropZone');

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        
        const files = Array.from(e.dataTransfer.files).filter(file => 
            file.type.startsWith('image/')
        );

        if (files.length > NUM_PHOTOS) {
            alert(`Solo puedes cargar hasta ${NUM_PHOTOS} fotos a la vez.`);
            return;
        }

        files.forEach((file, index) => {
            if (index < NUM_PHOTOS) {
                loadImageToSlot(file, index);
            }
        });
    });
}

// Comprimir imagen antes de convertir a Base64
function compressImage(file, maxSizeKB = 400) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // Calcular nuevo tamaño manteniendo aspect ratio
                const maxDimension = 1200; // píxeles
                if (width > height && width > maxDimension) {
                    height = (height / width) * maxDimension;
                    width = maxDimension;
                } else if (height > maxDimension) {
                    width = (width / height) * maxDimension;
                    height = maxDimension;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Comprimir con calidad ajustable
                let quality = 0.8;
                let base64 = canvas.toDataURL('image/jpeg', quality);
                
                // Si es muy grande, reducir calidad
                while (base64.length > maxSizeKB * 1024 && quality > 0.3) {
                    quality -= 0.1;
                    base64 = canvas.toDataURL('image/jpeg', quality);
                }
                
                resolve({
                    base64: base64,
                    width: img.width,
                    height: img.height
                });
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Cargar imagen en un slot específico
async function loadImageToSlot(file, index) {
    try {
        const compressed = await compressImage(file);
        
        photos[index].image = compressed.base64;
        photos[index].imageBase64 = compressed.base64;
        photos[index].width = compressed.width;
        photos[index].height = compressed.height;
        photos[index].isEmpty = false;

        // Mostrar la imagen
        const preview = document.getElementById(`preview_${index}`);
        preview.innerHTML = `
            <img src="${compressed.base64}" alt="Foto ${index + 1}">
            <div class="upload-overlay">
                <button class="upload-btn" type="button">
                    Cambiar Foto
                </button>
            </div>
            <button class="view-large-btn" onclick="event.stopPropagation(); openModal('${compressed.base64}')">
                🔍
            </button>
        `;
        preview.classList.add('has-image');

        // Quitar clase empty de la tarjeta
        const card = document.getElementById(`card_${index}`);
        card.classList.remove('empty');
        
        // Quitar advertencia si existe
        const warning = document.getElementById(`warning_${index}`);
        if (warning) {
            warning.remove();
        }

        // Detectar orientación automáticamente
        const isHorizontal = compressed.width > compressed.height;
        const orientationParam = parameters.find(p => p.id === 'orientation');
        photos[index].ratings.orientation = isHorizontal ? orientationParam.points.yes : orientationParam.points.no;
        
        const toggle = document.getElementById(`toggle_${index}_orientation`);
        const label = document.getElementById(`label_${index}_orientation`);
        
        if (isHorizontal) {
            toggle.classList.add('active');
            label.textContent = 'SÍ';
        } else {
            toggle.classList.remove('active');
            label.textContent = 'NO';
        }

        // Restaurar valores por defecto para parámetros no booleanos
        parameters.forEach(param => {
            if (param.type === 'scale') {
                // Usar valor medio por defecto
                const middleIndex = Math.floor(param.options.length / 2);
                const defaultValue = param.options[middleIndex].value;
                photos[index].ratings[param.id] = defaultValue;
                const select = document.getElementById(`select_${index}_${param.id}`);
                if (select) select.value = defaultValue.toString();
            } else if (param.type === 'toggle') {
                photos[index].ratings[param.id] = param.points.yes;
                const toggle = document.getElementById(`toggle_${index}_${param.id}`);
                const label = document.getElementById(`label_${index}_${param.id}`);
                if (toggle) {
                    toggle.classList.add('active');
                    label.textContent = 'SÍ';
                }
            } else if (param.type === 'distance') {
                photos[index].ratings[param.id] = 10; // Adecuada por defecto
                photos[index].ratings[param.id + '_type'] = '';
                const selectType = document.getElementById(`select_${index}_${param.id}_type`);
                const selectQuality = document.getElementById(`select_${index}_${param.id}_quality`);
                if (selectType) selectType.value = '';
                if (selectQuality) selectQuality.value = '10';
            }
        });

        window.updateNeutralizedToggles(index);
        calculateAllScores();
    } catch (error) {
        alert('Error al cargar la imagen: ' + error.message);
    }
}

// Crear una tarjeta de foto
function createPhotoCard(index) {
    const card = document.createElement('div');
    card.className = 'photo-card empty';
    card.id = `card_${index}`;
    
    card.innerHTML = `
        <h3>Fotografía ${index + 1}</h3>
        
        <div class="empty-warning" id="warning_${index}">
            Sin fotografía cargada
        </div>

        <div class="photo-preview" id="preview_${index}" onclick="document.getElementById('fileInput_${index}').click()">
            <div class="upload-overlay">
                <button class="upload-btn" type="button">
                    Cargar Foto
                </button>
            </div>
        </div>
        
        <input type="file" id="fileInput_${index}" accept="image/*">
        
        <div class="photo-score">
            <span id="score_${index}">0.0</span> / 100
        </div>
        
        <div id="parameters_${index}">
            ${parameters.filter(p => p.group === 'main').map(param => `
                <div class="parameter compact">
                    <div class="parameter-header">
                        <label>${param.label}:</label>
                        ${param.type === 'distance' ? 
                            `<div class="distance-selects">
                                <select id="select_${index}_${param.id}_type" 
                                    onchange="updateDistanceType(${index}, '${param.id}', this.value)">
                                    ${param.distanceType.options.map(opt => `
                                        <option value="${opt.value}" ${opt.value === '' ? 'selected' : ''}>
                                            ${opt.label}
                                        </option>
                                    `).join('')}
                                </select>
                                <select id="select_${index}_${param.id}_quality" 
                                    onchange="updateRating(${index}, '${param.id}', this.value)">
                                    ${param.distanceQuality.options.map(opt => `
                                        <option value="${opt.value}" ${opt.value === 2 ? 'selected' : ''}>
                                            ${opt.label}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>` :
                        param.type === 'scale' ? 
                            `<select id="select_${index}_${param.id}" class="compact-select"
                                onchange="updateRating(${index}, '${param.id}', this.value)">
                                ${param.options.map((opt, idx) => `
                                    <option value="${opt.value}" ${idx === 0 ? 'selected' : ''}>
                                        ${opt.label}
                                    </option>
                                `).join('')}
                            </select>` : ''
                        }
                    </div>
                </div>
            `).join('')}
            
            <div class="parameter-grid" id="grid_${index}">
                ${parameters.filter(p => p.group === 'grid').map(param => `
                    <div class="parameter-grid-item" id="grid_item_${index}_${param.id}">
                        <label>${param.label}</label>
                        <div class="toggle-switch ${param.type === 'toggle_auto' ? 'auto-toggle' : ''}" 
                            id="toggle_${index}_${param.id}" 
                            onclick="${param.type === 'toggle_auto' ? '' : `toggleParameter(${index}, '${param.id}')`}">
                            <div class="toggle-slider"></div>
                        </div>
                        <span class="toggle-label-grid" id="label_${index}_${param.id}">NO</span>
                        ${param.type === 'toggle_auto' ? '<span class="auto-badge-small">AUTO</span>' : ''}
                        ${(param.id === 'onroad' || param.id === 'vehicles') ? `<span class="neutralized-badge" id="neutralized_${index}_${param.id}" style="display: none;">NO APLICA</span>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    // Agregar listener al input de archivo
    setTimeout(() => {
        const fileInput = document.getElementById(`fileInput_${index}`);
        fileInput.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                loadImageToSlot(e.target.files[0], index);
            }
        });
    }, 0);

    return card;
}

// Toggle para parámetros booleanos
window.toggleParameter = function(photoIndex, parameterId) {
    const toggle = document.getElementById(`toggle_${photoIndex}_${parameterId}`);
    const label = document.getElementById(`label_${photoIndex}_${parameterId}`);
    const gridItem = document.getElementById(`grid_item_${photoIndex}_${parameterId}`);
    
    // Prevenir cambio manual si es toggle automático
    if (toggle.classList.contains('auto-toggle')) {
        return;
    }
    
    // Prevenir cambio si está neutralizado
    if (gridItem && gridItem.classList.contains('neutralized')) {
        return;
    }
    
    // Encontrar el parámetro para obtener sus puntos
    const param = parameters.find(p => p.id === parameterId);
    
    if (toggle.classList.contains('active')) {
        toggle.classList.remove('active');
        label.textContent = 'NO';
        photos[photoIndex].ratings[parameterId] = param.points ? param.points.no : 0;
    } else {
        toggle.classList.add('active');
        label.textContent = 'SÍ';
        photos[photoIndex].ratings[parameterId] = param.points ? param.points.yes : 1;
    }
    
    calculateAllScores();
}

// Actualizar tipo de distancia
window.updateDistanceType = function(photoIndex, parameterId, value) {
    photos[photoIndex].ratings[parameterId + '_type'] = value;
    window.updateNeutralizedToggles(photoIndex);
    calculateAllScores();
}

// Actualizar estado visual de toggles neutralizados
window.updateNeutralizedToggles = function(photoIndex) {
    const isDetailView = photos[photoIndex].ratings.distance_type === 'detalle';
    
    // Toggles que se neutralizan: onroad y vehicles
    ['onroad', 'vehicles'].forEach(paramId => {
        const gridItem = document.getElementById(`grid_item_${photoIndex}_${paramId}`);
        const neutralizedBadge = document.getElementById(`neutralized_${photoIndex}_${paramId}`);
        
        if (gridItem && neutralizedBadge) {
            if (isDetailView) {
                gridItem.classList.add('neutralized');
                neutralizedBadge.style.display = 'block';
            } else {
                gridItem.classList.remove('neutralized');
                neutralizedBadge.style.display = 'none';
            }
        }
    });
}

// Actualizar la calificación de un parámetro
window.updateRating = function(photoIndex, parameterId, value) {
    photos[photoIndex].ratings[parameterId] = parseInt(value);
    calculateAllScores();
}

// Calcular la calificación de una foto
function calculatePhotoScore(photoIndex) {
    const photo = photos[photoIndex];
    
    if (photo.isEmpty) {
        return 0;
    }
    
    // Verificar si la vista es "Detalle"
    const isDetailView = photo.ratings.distance_type === 'detalle';
    
    let totalScore = 0;
    let activeWeightSum = 0;
    let totalWeightSum = 0;

    parameters.forEach(param => {
        const rating = photo.ratings[param.id];
        const weight = parseFloat(document.getElementById(param.weight).value);
        
        // Si es vista detalle, neutralizar "Sobre la vía" y "Vehículos"
        if (isDetailView && (param.id === 'onroad' || param.id === 'vehicles')) {
            // No sumar estos parámetros al score, pero sí al peso total
            totalWeightSum += weight;
        } else {
            totalScore += rating * weight;
            activeWeightSum += weight;
            totalWeightSum += weight;
        }
    });

    // Si hay pesos neutralizados, reescalar proporcionalmente
    if (isDetailView && activeWeightSum > 0 && totalWeightSum > activeWeightSum) {
        const scaleFactor = totalWeightSum / activeWeightSum;
        totalScore *= scaleFactor;
    }

    // Limitar entre 0 y 100
    return Math.max(0, Math.min(100, totalScore));
}

// Calcular todas las calificaciones
function calculateAllScores() {
    let totalScore = 0;

    for (let i = 0; i < NUM_PHOTOS; i++) {
        const score = calculatePhotoScore(i);
        document.getElementById(`score_${i}`).textContent = score.toFixed(1);
        totalScore += score;
    }

    const finalScore = totalScore / NUM_PHOTOS;
    document.getElementById('finalScore').textContent = finalScore.toFixed(1);
    
    updateScoreSummary(finalScore);
}

// Actualizar el resumen de calificación con colores y estados
function updateScoreSummary(score) {
    const summary = document.getElementById('scoreSummary');
    const statusText = document.getElementById('statusText');
    
    summary.classList.remove('rejected', 'good', 'excellent');
    
    if (score < 75) {
        summary.classList.add('rejected');
        statusText.textContent = 'Fotografías rechazadas';
    } else if (score >= 75 && score < 90) {
        summary.classList.add('good');
        statusText.textContent = 'Fotografías aprobadas';
    } else if (score >= 90 && score <= 95) {
        summary.classList.add('excellent');
        statusText.textContent = 'Fotografías excelentes';
    } else if (score > 95) {
        summary.classList.add('excellent');
        statusText.textContent = '¡Fotografías excepcionales!';
        createConfetti();
    }
}

// Crear efecto de confeti
function createConfetti() {
    const summary = document.getElementById('scoreSummary');
    const colors = ['#ec1c24', '#606060', '#ffffff'];
    
    for (let i = 0; i < 30; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDelay = Math.random() * 0.5 + 's';
            confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
            
            summary.appendChild(confetti);
            
            setTimeout(() => {
                confetti.remove();
            }, 5000);
        }, i * 50);
    }
}

// ==================== GUARDAR EN LA NUBE ====================

window.saveSetToCloud = async function() {
    // Verificar si es turista
    if (isTourist) {
        alert('⚠️ Estás en modo Turista. Tus datos no se pueden guardar.\n\nCrea una cuenta para guardar tus calificaciones.');
        return;
    }
    
    const saveBtn = document.getElementById('saveBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = '⏳ Guardando...';
    
    try {
        // Validar que haya al menos una foto
        const hasPhotos = photos.some(p => !p.isEmpty);
        if (!hasPhotos) {
            alert('Por favor carga al menos una fotografía antes de guardar');
            return;
        }
        
        // Preparar datos para guardar
        const setData = {
            userId: currentUser.uid,
            userEmail: currentUser.email,
            fecha: Timestamp.now(),
            calificacionFinal: parseFloat(document.getElementById('finalScore').textContent),
            ponderaciones: {
                vista: parseFloat(document.getElementById('weight_distance').value),
                iluminacion: parseFloat(document.getElementById('weight_lighting').value),
                nitidez: parseFloat(document.getElementById('weight_sharpness').value),
                visibilidad: parseFloat(document.getElementById('weight_visibility').value),
                sobreVia: parseFloat(document.getElementById('weight_onroad').value),
                vehiculos: parseFloat(document.getElementById('weight_vehicles').value),
                orientacion: parseFloat(document.getElementById('weight_orientation').value)
            },
            fotos: photos.map((photo, index) => ({
                numero: index + 1,
                isEmpty: photo.isEmpty,
                imageBase64: photo.imageBase64 || null,
                dimensiones: {
                    width: photo.width,
                    height: photo.height
                },
                calificacion: parseFloat(document.getElementById(`score_${index}`).textContent),
                parametros: {
                    vista_tipo: photo.ratings.distance_type || '',
                    vista_calidad: photo.ratings.distance || 0,
                    iluminacion: photo.ratings.lighting || 0,
                    nitidez: photo.ratings.sharpness || 0,
                    visibilidad: photo.ratings.visibility || 0,
                    sobreVia: photo.ratings.onroad || 0,
                    vehiculos: photo.ratings.vehicles || 0,
                    orientacion: photo.ratings.orientation || 0,
                }
            }))
        };
        
        // Guardar en Firestore
        const docRef = await addDoc(collection(db, 'photo_sets'), setData);
        
        alert('✅ Set guardado exitosamente en la nube!');
        console.log('Set guardado con ID:', docRef.id);
        
    } catch (error) {
        console.error('Error al guardar:', error);
        alert('Error al guardar: ' + error.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 Guardar Set en la Nube';
    }
}

// ==================== VER HISTORIAL ====================

window.toggleHistory = async function() {
    // Verificar si es turista
    if (isTourist) {
        alert('⚠️ Estás en modo Turista. No tienes sets guardados.\n\nCrea una cuenta para guardar y ver tus calificaciones.');
        return;
    }
    
    const panel = document.getElementById('historyPanel');
    
    if (panel.classList.contains('collapsed')) {
        panel.classList.remove('collapsed');
        await loadSavedSets();
    } else {
        panel.classList.add('collapsed');
    }
}

async function loadSavedSets(filters = {}) {
    const setsList = document.getElementById('setsList');
    setsList.innerHTML = '<div class="loading">Cargando sets guardados...</div>';
    
    try {
        let q = query(
            collection(db, 'photo_sets'),
            where('userId', '==', currentUser.uid),
            orderBy('fecha', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            setsList.innerHTML = '<div class="loading">No hay sets guardados aún</div>';
            return;
        }
        
        let sets = [];
        querySnapshot.forEach((doc) => {
            sets.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Aplicar filtros
        if (filters.dateFrom) {
            const dateFrom = new Date(filters.dateFrom);
            dateFrom.setHours(0, 0, 0, 0);
            sets = sets.filter(set => set.fecha.toDate() >= dateFrom);
        }
        if (filters.dateTo) {
            const dateTo = new Date(filters.dateTo);
            dateTo.setHours(23, 59, 59, 999);
            sets = sets.filter(set => set.fecha.toDate() <= dateTo);
        }
        if (filters.rating) {
            if (filters.rating === 'excellent') {
                sets = sets.filter(set => set.calificacionFinal >= 90);
            } else if (filters.rating === 'good') {
                sets = sets.filter(set => set.calificacionFinal >= 75 && set.calificacionFinal < 90);
            } else if (filters.rating === 'rejected') {
                sets = sets.filter(set => set.calificacionFinal < 75);
            }
        }
        
        console.log('Sets después de filtros:', sets.length); // Para debug
        
        // Mostrar sets
        setsList.innerHTML = sets.map(set => {
            const fecha = set.fecha.toDate();
            const fechaStr = fecha.toLocaleDateString('es-MX', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            return `
                <div class="set-item">
                    <div class="set-info">
                        <div class="set-date">${fechaStr}</div>
                        <div class="set-score">Calificación: ${set.calificacionFinal.toFixed(1)}/100</div>
                    </div>
                    <div class="set-actions">
                        <button onclick="viewSetDetails('${set.id}')">👁️ Ver</button>
                        <button onclick="downloadSetJSON('${set.id}')">📥 JSON</button>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error al cargar sets:', error);
        setsList.innerHTML = '<div class="loading">Error al cargar los sets</div>';
    }
}

window.applyFilters = async function() {
    const filters = {
        dateFrom: document.getElementById('filterDateFrom').value,
        dateTo: document.getElementById('filterDateTo').value,
        rating: document.getElementById('filterRating').value
    };
    await loadSavedSets(filters);
}

// Ver detalles de un set
window.viewSetDetails = async function(setId) {
    try {
        const docRef = doc(db, 'photo_sets', setId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const setData = docSnap.data();
            alert(`Set del ${setData.fecha.toDate().toLocaleDateString()}\nCalificación: ${setData.calificacionFinal.toFixed(1)}/100`);
            // TODO: Aquí podrías cargar el set completo en la interfaz
        } else {
            alert('Set no encontrado');
        }
    } catch (error) {
        console.error('Error al ver set:', error);
        alert('Error al cargar el set');
    }
}

// Descargar JSON de un set específico
window.downloadSetJSON = async function(setId) {
    try {
        const docRef = doc(db, 'photo_sets', setId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const setData = docSnap.data();
            
            // Convertir Timestamp a string
            const dataToDownload = {
                id: setId,
                fecha: setData.fecha.toDate().toISOString(),
                calificacionFinal: setData.calificacionFinal,
                ponderaciones: setData.ponderaciones,
                fotos: setData.fotos.map(foto => ({
                    ...foto,
                    // Opcional: excluir imageBase64 si solo quieres las calificaciones
                    // imageBase64: undefined
                }))
            };
            
            // Crear y descargar el archivo JSON
            const blob = new Blob([JSON.stringify(dataToDownload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `set_${setId}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
        } else {
            alert('Set no encontrado');
        }
    } catch (error) {
        console.error('Error al descargar JSON:', error);
        alert('Error al descargar el JSON');
    }
}

// Descargar JSON filtrado
window.downloadFilteredJSON = async function() {
    try {
        const filters = {
            dateFrom: document.getElementById('filterDateFrom').value,
            dateTo: document.getElementById('filterDateTo').value,
            rating: document.getElementById('filterRating').value
        };
        
        let q = query(
            collection(db, 'photo_sets'),
            where('userId', '==', currentUser.uid),
            orderBy('fecha', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        
        let sets = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            sets.push({
                id: doc.id,
                fecha: data.fecha.toDate().toISOString(),
                calificacionFinal: data.calificacionFinal,
                ponderaciones: data.ponderaciones,
                fotos: data.fotos.map(foto => ({
                    numero: foto.numero,
                    isEmpty: foto.isEmpty,
                    dimensiones: foto.dimensiones,
                    calificacion: foto.calificacion,
                    parametros: foto.parametros
                    // imageBase64 excluido para hacer el archivo más pequeño
                }))
            });
        });
        
        // Aplicar filtros
        if (filters.dateFrom) {
            sets = sets.filter(set => new Date(set.fecha) >= new Date(filters.dateFrom));
        }
        if (filters.dateTo) {
            const dateTo = new Date(filters.dateTo);
            dateTo.setHours(23, 59, 59);
            sets = sets.filter(set => new Date(set.fecha) <= dateTo);
        }
        if (filters.rating) {
            if (filters.rating === 'excellent') {
                sets = sets.filter(set => set.calificacionFinal > 90);
            } else if (filters.rating === 'good') {
                sets = sets.filter(set => set.calificacionFinal >= 75 && set.calificacionFinal <= 90);
            } else if (filters.rating === 'rejected') {
                sets = sets.filter(set => set.calificacionFinal < 75);
            }
        }
        
        // Crear el JSON con metadata
        const jsonData = {
            exportDate: new Date().toISOString(),
            totalSets: sets.length,
            filters: filters,
            sets: sets
        };
        
        // Descargar
        const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const fechaHoy = new Date().toISOString().split('T')[0];
        a.download = `photo_sets_${fechaHoy}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert(`✅ ${sets.length} sets descargados en JSON`);
        
    } catch (error) {
        console.error('Error al descargar JSON filtrado:', error);
        alert('Error al descargar: ' + error.message);
    }
}

// ==================== MODAL Y UTILIDADES ====================

// Abrir modal con la imagen
window.openModal = function(imageSrc) {
    const modal = document.getElementById('photoModal');
    const modalImg = document.getElementById('modalImage');
    modal.classList.add('active');
    modalImg.src = imageSrc;
}

// Cerrar modal
window.closeModal = function() {
    const modal = document.getElementById('photoModal');
    modal.classList.remove('active');
}

// Cerrar modal con tecla ESC
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeModal();
    }
});

// Alternar visibilidad de ponderaciones
window.toggleWeights = function() {
    const section = document.getElementById('weightsSection');
    const btn = document.getElementById('weightsToggleBtn');
    
    if (section.classList.contains('collapsed')) {
        section.classList.remove('collapsed');
        btn.textContent = 'Ocultar Ponderaciones';
    } else {
        section.classList.add('collapsed');
        btn.textContent = 'Mostrar Ponderaciones';
    }
}

// Controlar visibilidad de ponderaciones según rol
function updateWeightsVisibility() {
    const weightsBtn = document.getElementById('weightsToggleBtn');
    const weightsSection = document.getElementById('weightsSection');
    
    if (isAdmin) {
        // El admin puede ver y usar las ponderaciones
        weightsBtn.style.display = 'block';
    } else {
        // Los usuarios normales no pueden ver ni modificar ponderaciones
        weightsBtn.style.display = 'none';
        weightsSection.classList.add('collapsed');
    }
}