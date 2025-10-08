// Configuración inicial
const NUM_PHOTOS = 4;
const photos = [];

// Parámetros que se califican
const parameters = [
    { 
        id: 'distance', 
        label: 'Vista', 
        weight: 'weight_distance',
        type: 'distance',
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
                { value: 5, label: 'Adecuada' },
                { value: 2, label: 'Muy cerca' }
            ]
        }
    },
    { 
        id: 'lighting', 
        label: 'Iluminación', 
        weight: 'weight_lighting',
        type: 'scale',
        options: [
            { value: 1, label: '1 - Muy oscura' },
            { value: 2, label: '2 - Oscura' },
            { value: 3, label: '3 - Aceptable' },
            { value: 4, label: '4 - Buena' },
            { value: 5, label: '5 - Excelente' }
        ]
    },
    { 
        id: 'sharpness', 
        label: 'Nitidez', 
        weight: 'weight_sharpness',
        type: 'scale',
        options: [
            { value: 1, label: '1 - Muy borrosa' },
            { value: 2, label: '2 - Borrosa' },
            { value: 3, label: '3 - Aceptable' },
            { value: 4, label: '4 - Nítida' },
            { value: 5, label: '5 - Muy nítida' }
        ]
    },
    { 
        id: 'surroundings', 
        label: 'Visibilidad de alrededores', 
        weight: 'weight_surroundings',
        type: 'scale',
        options: [
            { value: 1, label: '1 - No se ven' },
            { value: 2, label: '2 - Muy poco' },
            { value: 3, label: '3 - Moderado' },
            { value: 4, label: '4 - Bastante' },
            { value: 5, label: '5 - Totalmente visible' }
        ]
    },
    { 
        id: 'onroad', 
        label: 'Tomada sobre la vía', 
        weight: 'weight_onroad',
        type: 'toggle'
    },
    { 
        id: 'vehicles', 
        label: 'Vehículos visibles', 
        weight: 'weight_vehicles',
        type: 'toggle'
    },
    { 
        id: 'orientation', 
        label: 'Formato horizontal', 
        weight: 'weight_orientation',
        type: 'auto'
    }
];

// Inicializar la aplicación
function init() {
    const grid = document.getElementById('photosGrid');
    
    for (let i = 0; i < NUM_PHOTOS; i++) {
        photos[i] = {
            image: null,
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
            } else {
                photos[i].ratings[param.id] = 1;
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
        input.addEventListener('input', calculateAllScores);
    });

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

// Cargar imagen en un slot específico
function loadImageToSlot(file, index) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            photos[index].image = e.target.result;
            photos[index].width = img.width;
            photos[index].height = img.height;
            photos[index].isEmpty = false;

            // Mostrar la imagen
            const preview = document.getElementById(`preview_${index}`);
            preview.innerHTML = `
                <img src="${e.target.result}" alt="Foto ${index + 1}">
                <div class="upload-overlay">
                    <button class="upload-btn" type="button">
                        Cambiar Foto
                    </button>
                </div>
                <button class="view-large-btn" onclick="event.stopPropagation(); openModal('${e.target.result}')">
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
            const isHorizontal = img.width > img.height;
            photos[index].ratings.orientation = isHorizontal ? 5 : 1;
            
            const autoDiv = document.getElementById(`auto_${index}_orientation`);
            
            if (isHorizontal) {
                autoDiv.textContent = 'Formato horizontal detectado';
                autoDiv.style.background = '#606060';
            } else {
                autoDiv.textContent = 'Formato vertical detectado';
                autoDiv.style.background = '#ec1c24';
            }

            // Restaurar valores por defecto para parámetros no booleanos
            parameters.forEach(param => {
                if (param.type === 'scale') {
                    photos[index].ratings[param.id] = 3;
                    const select = document.getElementById(`select_${index}_${param.id}`);
                    if (select) select.value = '3';
                } else if (param.type === 'toggle') {
                    photos[index].ratings[param.id] = 5;
                    const toggle = document.getElementById(`toggle_${index}_${param.id}`);
                    const label = document.getElementById(`label_${index}_${param.id}`);
                    if (toggle) {
                        toggle.classList.add('active');
                        label.textContent = 'SÍ';
                    }
                } else if (param.type === 'distance') {
                    photos[index].ratings[param.id] = 5;
                    photos[index].ratings[param.id + '_type'] = '';
                    const selectType = document.getElementById(`select_${index}_${param.id}_type`);
                    const selectQuality = document.getElementById(`select_${index}_${param.id}_quality`);
                    if (selectType) selectType.value = '';
                    if (selectQuality) selectQuality.value = '5';
                }
            });

            calculateAllScores();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
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
            ${parameters.map(param => `
                <div class="parameter">
                    <div class="parameter-header">
                        <label>${param.label}</label>
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
                            `<select id="select_${index}_${param.id}" 
                                onchange="updateRating(${index}, '${param.id}', this.value)">
                                ${param.options.map(opt => `
                                    <option value="${opt.value}" ${opt.value === 1 ? 'selected' : ''}>
                                        ${opt.label}
                                    </option>
                                `).join('')}
                            </select>` :
                        param.type === 'toggle' ?
                            `<div class="toggle-container">
                                <div class="toggle-switch" id="toggle_${index}_${param.id}" 
                                    onclick="toggleParameter(${index}, '${param.id}')">
                                    <div class="toggle-slider"></div>
                                </div>
                                <span class="toggle-label" id="label_${index}_${param.id}">NO</span>
                            </div>` :
                            `<span style="color: #606060; font-weight: 500; font-size: 0.85em;">AUTO</span>`
                        }
                    </div>
                    ${param.type === 'auto' ? 
                        `<div class="auto-detected" id="auto_${index}_${param.id}">Se detectará al cargar imagen</div>` :
                        ''
                    }
                </div>
            `).join('')}
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
function toggleParameter(photoIndex, parameterId) {
    const toggle = document.getElementById(`toggle_${photoIndex}_${parameterId}`);
    const label = document.getElementById(`label_${photoIndex}_${parameterId}`);
    
    if (toggle.classList.contains('active')) {
        toggle.classList.remove('active');
        label.textContent = 'NO';
        photos[photoIndex].ratings[parameterId] = 1;
    } else {
        toggle.classList.add('active');
        label.textContent = 'SÍ';
        photos[photoIndex].ratings[parameterId] = 5;
    }
    
    calculateAllScores();
}

// Actualizar tipo de distancia
function updateDistanceType(photoIndex, parameterId, value) {
    photos[photoIndex].ratings[parameterId + '_type'] = value;
}

// Actualizar la calificación de un parámetro
function updateRating(photoIndex, parameterId, value) {
    photos[photoIndex].ratings[parameterId] = parseInt(value);
    calculateAllScores();
}

// Calcular la calificación de una foto
function calculatePhotoScore(photoIndex) {
    const photo = photos[photoIndex];
    
    // Si no hay foto cargada, la calificación es 0
    if (photo.isEmpty) {
        return 0;
    }
    
    let weightedSum = 0;
    let totalWeight = 0;

    parameters.forEach(param => {
        const rating = photo.ratings[param.id];
        const weight = parseFloat(document.getElementById(param.weight).value);
        weightedSum += (rating / 5) * 100 * weight;
        totalWeight += weight;
    });

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

// Calcular todas las calificaciones
function calculateAllScores() {
    let totalScore = 0;

    for (let i = 0; i < NUM_PHOTOS; i++) {
        const score = calculatePhotoScore(i);
        document.getElementById(`score_${i}`).textContent = score.toFixed(1);
        totalScore += score;
    }

    // Calcular calificación final (siempre promedio de 4)
    const finalScore = totalScore / NUM_PHOTOS;
    document.getElementById('finalScore').textContent = finalScore.toFixed(1);
    
    // Actualizar el estado visual del resumen
    updateScoreSummary(finalScore);
}

// Actualizar el resumen de calificación con colores y estados
function updateScoreSummary(score) {
    const summary = document.getElementById('scoreSummary');
    const statusText = document.getElementById('statusText');
    
    // Remover todas las clases de estado
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

// Abrir modal con la imagen
function openModal(imageSrc) {
    const modal = document.getElementById('photoModal');
    const modalImg = document.getElementById('modalImage');
    modal.classList.add('active');
    modalImg.src = imageSrc;
}

// Cerrar modal
function closeModal() {
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
function toggleWeights() {
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

// Inicializar cuando cargue la página
window.addEventListener('DOMContentLoaded', init);