import { LOCAL_MODE } from './config.js';
import { TOURIST_MODE } from './firebase-config.js';
import { saveSet, querySets, getSet, normalizeDate } from './dataStore.js';

// Configuración inicial
const NUM_PHOTOS = 4;
window.photos = [];  // ← Ahora es global
const photos = window.photos;  // ← Mantener referencia local

let currentUser = null;
let isAdmin = false;
let isTourist = false;
let userRole = 'user'; // 'super_admin', 'admin' o 'user' (solo aplica en modo nube)

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

// Generar contraseña aleatoria (no depende de Firebase, disponible en ambos modos)
window.generatePassword = function() {
    const length = 12;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    document.getElementById('invitePassword').value = password;
}

// Modo local: un único usuario, sin Firebase, sin red. Todo se guarda en localStorage.
function enterLocalMode() {
    currentUser = { uid: 'local_user', email: 'local@calificador.app' };
    isAdmin = true;
    isTourist = false;

    document.getElementById('authPanel').style.display = 'none';
    document.getElementById('mainPanel').style.display = 'block';

    document.getElementById('userEmail').innerHTML = `
        <span>Modo Local</span>
        <span class="tourist-badge">SIN NUBE</span>
    `;

    // No aplica gestión de usuarios ni cierre de sesión con un único usuario local
    document.getElementById('userManagementBtn').style.display = 'none';
    document.querySelector('.logout-btn').style.display = 'none';
    document.getElementById('saveBtn').textContent = '💾 Guardar Set (Local)';

    init();
}

// Modo nube: carga Firebase Auth + Firestore solo cuando hace falta.
async function enterCloudMode() {
    let cloudAuth;
    try {
        cloudAuth = await import('./cloudAuth.js');
    } catch (error) {
        console.error('No se pudo cargar Firebase:', error);
        const authContent = document.querySelector('.auth-content');
        if (authContent) {
            const errorMsg = document.createElement('p');
            errorMsg.style.color = '#ec1c24';
            errorMsg.style.textAlign = 'center';
            errorMsg.style.fontSize = '0.85em';
            errorMsg.textContent = 'No se pudo conectar con el servicio de autenticación. Verifica tu conexión a internet e intenta de nuevo.';
            authContent.appendChild(errorMsg);
        }
        return;
    }

    window.login = async function() {
        const email = document.getElementById('emailInput').value;
        const password = document.getElementById('passwordInput').value;

        if (!email || !password) {
            alert('Por favor ingresa email y contraseña');
            return;
        }

        try {
            await cloudAuth.login(email, password);
        } catch (error) {
            alert('Error al iniciar sesión: ' + error.message);
        }
    }

    window.logout = async function() {
        try {
            if (isTourist) {
                isTourist = false;
                currentUser = null;
                document.getElementById('authPanel').style.display = 'block';
                document.getElementById('mainPanel').style.display = 'none';

                const warning = document.querySelector('.tourist-warning');
                if (warning) warning.remove();

                location.reload();
            } else {
                await cloudAuth.logout();
            }
        } catch (error) {
            alert('Error al cerrar sesión: ' + error.message);
        }
    }

    window.enterAsTourist = function() {
        isTourist = true;
        currentUser = {
            uid: TOURIST_MODE,
            email: "turista@demo.app",
            isTourist: true
        };

        document.getElementById('authPanel').style.display = 'none';
        document.getElementById('mainPanel').style.display = 'block';

        document.getElementById('userEmail').innerHTML = `
            <span>turista@demo.app</span>
            <span class="tourist-badge">TURISTA</span>
        `;

        const mainPanel = document.getElementById('mainPanel');
        const warning = document.createElement('div');
        warning.className = 'tourist-warning';
        warning.innerHTML = '⚠️ Modo Turista: Puedes usar la aplicación libremente, pero tus datos NO se guardarán al salir.';
        mainPanel.insertBefore(warning, mainPanel.firstChild);

        init();
    }

    window.toggleUserManagement = async function() {
        const panel = document.getElementById('userManagementPanel');

        if (panel.classList.contains('collapsed')) {
            panel.classList.remove('collapsed');
            await refreshUsersList();
            await loadInvitations();
        } else {
            panel.classList.add('collapsed');
        }
    }

    window.switchTab = function(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');

        if (tabName === 'users') {
            document.querySelector('[onclick="switchTab(\'users\')"]').classList.add('active');
            document.getElementById('tabUsers').style.display = 'block';
        } else if (tabName === 'invitations') {
            document.querySelector('[onclick="switchTab(\'invitations\')"]').classList.add('active');
            document.getElementById('tabInvitations').style.display = 'block';
        }
    }

    async function refreshUsersList() {
        const usersList = document.getElementById('usersList');
        usersList.innerHTML = '<div class="loading">Cargando usuarios...</div>';

        try {
            const users = await cloudAuth.loadUsers();

            if (users.length === 0) {
                usersList.innerHTML = '<div class="loading">No hay usuarios registrados</div>';
                return;
            }

            usersList.innerHTML = users.map(user => {
                const isSuperAdmin = user.uid === cloudAuth.SUPER_ADMIN_UID;
                const canEdit = !isSuperAdmin || currentUser.uid === cloudAuth.SUPER_ADMIN_UID;

                let roleBadge = '<span class="role-badge user">Usuario</span>';
                if (user.role === 'super_admin') {
                    roleBadge = '<span class="role-badge super">Super Admin</span>';
                } else if (user.role === 'admin') {
                    roleBadge = '<span class="role-badge admin">Admin</span>';
                }

                return `
                    <div class="user-item">
                        <div class="user-info">
                            <div class="user-email">${user.email}</div>
                            ${roleBadge}
                        </div>
                        <div class="user-actions">
                            ${canEdit ? `
                                <select onchange="changeUserRole('${user.uid}', this.value)" ${!isAdmin ? 'disabled' : ''}>
                                    <option value="user" ${user.role === 'user' ? 'selected' : ''}>Usuario</option>
                                    <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                                </select>
                                ${!isSuperAdmin ? `<button onclick="deleteUserAccount('${user.uid}', '${user.email}')" class="delete-btn">🗑️</button>` : ''}
                            ` : '<span style="color: #999; font-size: 0.85em;">No editable</span>'}
                        </div>
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('Error al cargar usuarios:', error);
            usersList.innerHTML = '<div class="loading">Error al cargar usuarios</div>';
        }
    }

    async function loadInvitations() {
        document.getElementById('invitationsList').innerHTML =
            '<div class="info-message">Los usuarios se crean directamente. No hay sistema de invitaciones pendientes.</div>';
    }

    window.changeUserRole = async function(userId, newRole) {
        if (!isAdmin) {
            alert('No tienes permisos para cambiar roles');
            return;
        }

        if (userId === cloudAuth.SUPER_ADMIN_UID && currentUser.uid !== cloudAuth.SUPER_ADMIN_UID) {
            alert('No puedes cambiar el rol del Super Admin');
            return;
        }

        try {
            await cloudAuth.changeUserRole(userId, newRole);
            alert('Rol actualizado exitosamente');
            await refreshUsersList();
        } catch (error) {
            console.error('Error al cambiar rol:', error);
            alert('Error al cambiar rol: ' + error.message);
        }
    }

    window.deleteUserAccount = async function(userId, email) {
        if (!isAdmin) {
            alert('No tienes permisos para eliminar usuarios');
            return;
        }

        if (userId === cloudAuth.SUPER_ADMIN_UID) {
            alert('No puedes eliminar al Super Admin');
            return;
        }

        if (!confirm(`¿Estás seguro de eliminar a ${email}?\n\nEsta acción no se puede deshacer.`)) {
            return;
        }

        try {
            await cloudAuth.deleteUserAccount(userId, email);
            alert('⚠️ Usuario eliminado de la base de datos.\n\nNOTA: El usuario aún puede iniciar sesión con su cuenta de Firebase Authentication. Para eliminarlo completamente, hazlo manualmente desde Firebase Console → Authentication.');
            await refreshUsersList();
        } catch (error) {
            console.error('Error al eliminar usuario:', error);
            alert('Error al eliminar usuario: ' + error.message);
        }
    }

    window.createInvitation = async function() {
        if (!isAdmin) {
            alert('No tienes permisos para crear usuarios');
            return;
        }

        const email = document.getElementById('inviteEmail').value.trim();
        const password = document.getElementById('invitePassword').value;
        const role = document.getElementById('inviteRole').value;

        if (!email || !password) {
            alert('Por favor completa todos los campos');
            return;
        }

        if (password.length < 6) {
            alert('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        try {
            await cloudAuth.createUserAccount(email, password, role, currentUser.uid);
            alert(`✅ Usuario creado exitosamente!\n\nEmail: ${email}\nContraseña: ${password}\n\nEnvía esta información al usuario de forma segura.`);
            window.location.reload();
        } catch (error) {
            console.error('Error al crear usuario:', error);

            if (error.code === 'auth/email-already-in-use') {
                alert('Este email ya está registrado');
            } else {
                alert('Error al crear usuario: ' + error.message);
            }
        }
    }

    cloudAuth.watchAuthState({
        onLogin(user, role) {
            if (isTourist) return;

            currentUser = user;
            userRole = role;
            isAdmin = (role === 'admin' || role === 'super_admin');

            document.getElementById('authPanel').style.display = 'none';
            document.getElementById('mainPanel').style.display = 'block';

            let badge = '';
            if (role === 'super_admin') {
                badge = '<span class="admin-badge super">SUPER ADMIN</span>';
            } else if (role === 'admin') {
                badge = '<span class="admin-badge">ADMIN</span>';
            }

            document.getElementById('userEmail').innerHTML = `
                <span>${user.email}</span>
                ${badge}
            `;

            if (isAdmin) {
                document.getElementById('userManagementBtn').style.display = 'inline-block';
            }

            init();
        },
        onLogout() {
            document.getElementById('authPanel').style.display = 'block';
            document.getElementById('mainPanel').style.display = 'none';
            isAdmin = false;
            userRole = 'user';
        }
    });
}

if (LOCAL_MODE) {
    enterLocalMode();
} else {
    enterCloudMode();
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
                photos[i].ratings[param.id] = 10; // Adecuada por defecto
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
function compressImage(file, maxSizeKB = 200) {
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

        updateNeutralizedToggles(index);
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
                                    ${param.distanceQuality.options.map((opt, idx) => `
                                        <option value="${opt.value}" ${idx === 1 ? 'selected' : ''}>
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
    updateNeutralizedToggles(photoIndex);
    calculateAllScores();
}

// Actualizar estado visual de toggles neutralizados
function updateNeutralizedToggles(photoIndex) {
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
    photos[photoIndex].ratings[parameterId] = parseFloat(value);
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

// ==================== GUARDAR ====================

window.saveSetToCloud = async function() {
    // Verificar si es turista
    if (isTourist) {
        alert('⚠️ Estás en modo Turista. Tus datos no se pueden guardar.\n\nCrea una cuenta para guardar tus calificaciones.');
        return;
    }

    const saveBtn = document.getElementById('saveBtn');
    const originalLabel = saveBtn.textContent;
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

        await saveSet(setData);

        alert(LOCAL_MODE ? '✅ Set guardado exitosamente (almacenamiento local del navegador)!' : '✅ Set guardado exitosamente en la nube!');

    } catch (error) {
        console.error('Error al guardar:', error);
        alert('Error al guardar: ' + error.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = originalLabel;
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
        const sets = await querySets(currentUser.uid, filters);

        if (sets.length === 0) {
            setsList.innerHTML = '<div class="loading">No hay sets guardados aún</div>';
            return;
        }

        setsList.innerHTML = sets.map(set => {
            const fechaStr = set.fechaDate.toLocaleDateString('es-MX', {
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
        const setData = await getSet(setId);

        if (setData) {
            const fecha = normalizeDate(setData.fecha);
            alert(`Set del ${fecha.toLocaleDateString()}\nCalificación: ${setData.calificacionFinal.toFixed(1)}/100`);
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
        const setData = await getSet(setId);

        if (!setData) {
            alert('Set no encontrado');
            return;
        }

        const dataToDownload = {
            id: setId,
            fecha: normalizeDate(setData.fecha).toISOString(),
            calificacionFinal: setData.calificacionFinal,
            ponderaciones: setData.ponderaciones,
            fotos: setData.fotos
        };

        downloadJSON(dataToDownload, `set_${setId}.json`);

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

        const sets = await querySets(currentUser.uid, filters);

        const jsonData = {
            exportDate: new Date().toISOString(),
            totalSets: sets.length,
            filters: filters,
            sets: sets.map(set => ({
                id: set.id,
                fecha: set.fechaDate.toISOString(),
                calificacionFinal: set.calificacionFinal,
                ponderaciones: set.ponderaciones,
                fotos: set.fotos.map(foto => ({
                    numero: foto.numero,
                    isEmpty: foto.isEmpty,
                    dimensiones: foto.dimensiones,
                    calificacion: foto.calificacion,
                    parametros: foto.parametros
                    // imageBase64 excluido para hacer el archivo más pequeño
                }))
            }))
        };

        const fechaHoy = new Date().toISOString().split('T')[0];
        downloadJSON(jsonData, `photo_sets_${fechaHoy}.json`);

        alert(`✅ ${sets.length} sets descargados en JSON`);

    } catch (error) {
        console.error('Error al descargar JSON filtrado:', error);
        alert('Error al descargar: ' + error.message);
    }
}

function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
