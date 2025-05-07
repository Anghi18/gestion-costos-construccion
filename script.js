// Variables globales
let appData = {
    usuario: null,
    data: [],
    source: null,
    chartsInitialized: false
};

let sCurveChart = null;
let comparacionChart = null;

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    initAuth();
    setupEventListeners();
});

// 1. Autenticación mejorada
function initAuth() {
    // Mostrar/ocultar formularios
    document.getElementById('showRegister')?.addEventListener('click', function(e) {
        e.preventDefault();
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('registerForm').classList.remove('hidden');
    });

    document.getElementById('showLogin')?.addEventListener('click', function(e) {
        e.preventDefault();
        document.getElementById('registerForm').classList.add('hidden');
        document.getElementById('loginForm').classList.remove('hidden');
    });

    // Validación de login
    document.getElementById('loginForm')?.addEventListener('submit', function(e) {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        if (!email || !password) {
            showAlert('Todos los campos son obligatorios', 'error');
            return;
        }

        // Simulación de login exitoso
        appData.usuario = { email: email };
        showAlert('Inicio de sesión exitoso', 'success');
        mostrarSeccion('presupuestoSection');
    });

    // Validación de registro
    document.getElementById('registerForm')?.addEventListener('submit', function(e) {
        e.preventDefault();
        const name = document.getElementById('name').value;
        const email = document.getElementById('newEmail').value;
        const password = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (password !== confirmPassword) {
            showAlert('Las contraseñas no coinciden', 'error');
            return;
        }

        appData.usuario = { nombre: name, email: email };
        showAlert('Registro exitoso. Redirigiendo...', 'success');
        setTimeout(() => {
            mostrarSeccion('presupuestoSection');
        }, 1500);
    });
}

// 2. Configuración de eventos
function setupEventListeners() {
    // Menús desplegables
    document.querySelectorAll('.menu-button').forEach(btn => {
        btn.addEventListener('click', function() {
            const dropdownId = this.id.replace('userBtn', 'dropdownMenu').replace('menuBtn', 'dropdownMenu');
            toggleDropdown(dropdownId);
        });
    });

    // Navegación
    document.querySelectorAll('[id$="Link"]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const sectionId = this.id.replace('Link', 'Section');
            if (sectionId === 'aboutSection') {
                document.getElementById('aboutModal').style.display = 'flex';
            } else {
                mostrarSeccion(sectionId);
            }
        });
    });

    // Carga de archivos Excel
    document.getElementById('excelInput')?.addEventListener('change', handleFileUpload);

    // Botones principales
    document.getElementById('generateAnalysis')?.addEventListener('click', generarAnalisis);
    document.getElementById('generateReportBtn')?.addEventListener('click', generarReporte);
    document.getElementById('exportPdfBtn')?.addEventListener('click', exportarPDF);
    document.getElementById('closeModal')?.addEventListener('click', cerrarModal);
}

// 3. Funciones para análisis de desviaciones
function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            
            appData.data = XLSX.utils.sheet_to_json(firstSheet).map(row => ({
                item: row['Ítem'] || '',
                planificado: parseFloat(row['Planificado']) || 0,
                real: parseFloat(row['Real']) || 0,
                causa: '',
                recomendacion: ''
            }));

            mostrarPreviewExcel(firstSheet);
        } catch (error) {
            showAlert('Error al leer el archivo: ' + error.message, 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

function generarAnalisis() {
    if (appData.data.length === 0) {
        showAlert('No hay datos para analizar', 'error');
        return;
    }

    procesarDatosAnalisis(appData.data);
    mostrarSeccion('analisisSection');
    cerrarModal();
}

function procesarDatosAnalisis(data) {
    const tbody = document.getElementById('analisisTableBody');
    tbody.innerHTML = '';

    data.forEach(item => {
        const desviacion = item.real - item.planificado;
        const sobrecosto = desviacion > 0 ? desviacion : 0;
        const row = `
            <tr>
                <td>${item.item}</td>
                <td>${formatCurrency(item.planificado)}</td>
                <td>${formatCurrency(item.real)}</td>
                <td class="${desviacion >= 0 ? 'text-danger' : 'text-success'}">
                    ${formatCurrency(Math.abs(desviacion))} ${desviacion >= 0 ? '▲' : '▼'}
                </td>
                <td class="${sobrecosto > 0 ? 'badge-overcost' : 'badge-saving'}">
                    ${sobrecosto > 0 ? 'Sobrecosto' : 'Ahorro'}
                </td>
                <td>
                    <select class="cause-select" onchange="actualizarCausa('${item.item}', this.value)">
                        <option value="">Seleccionar...</option>
                        <option value="retraso">Retraso en entrega</option>
                        <option value="cambio">Cambio de alcance</option>
                        <option value="error">Error en cálculo</option>
                    </select>
                </td>
                <td>${generarRecomendacion(desviacion)}</td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

// 4. Funciones para reportes y gráficos
function generarReporte() {
    mostrarSeccion('reportesSection');
    if (!appData.chartsInitialized) {
        inicializarGraficos();
    } else {
        actualizarGraficos();
    }
}

function inicializarGraficos() {
    // Destruir gráficos existentes
    if (sCurveChart) sCurveChart.destroy();
    if (comparacionChart) comparacionChart.destroy();

    // Datos de ejemplo para la curva S
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'];
    const planificado = [10, 25, 45, 70, 85, 100];
    const real = [8, 20, 40, 60, 75, 90];

    // Gráfico de Curva S
    sCurveChart = new Chart(
        document.getElementById('sCurveChart'),
        {
            type: 'line',
            data: {
                labels: meses,
                datasets: [
                    {
                        label: 'Planificado',
                        data: planificado,
                        borderColor: '#4e4376',
                        backgroundColor: 'rgba(78, 67, 118, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: 'Real',
                        data: real,
                        borderColor: '#2b5876',
                        backgroundColor: 'rgba(43, 88, 118, 0.1)',
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Curva S del Proyecto'
                    }
                }
            }
        }
    );

    // Gráfico de comparación
    const items = appData.data.slice(0, 5).map(item => item.item);
    const planificadoItems = appData.data.slice(0, 5).map(item => item.planificado);
    const realItems = appData.data.slice(0, 5).map(item => item.real);

    comparacionChart = new Chart(
        document.getElementById('comparacionChart'),
        {
            type: 'bar',
            data: {
                labels: items,
                datasets: [
                    {
                        label: 'Planificado',
                        data: planificadoItems,
                        backgroundColor: '#4e4376'
                    },
                    {
                        label: 'Real',
                        data: realItems,
                        backgroundColor: '#2b5876'
                    }
                ]
            },
            options: {
                responsive: true
            }
        }
    );

    appData.chartsInitialized = true;
}

// 5. Funciones auxiliares
function mostrarSeccion(sectionId) {
    document.querySelectorAll('.container').forEach(sec => {
        sec.classList.add('hidden');
    });
    document.getElementById(sectionId)?.classList.remove('hidden');
}

function toggleDropdown(id) {
    const dropdown = document.getElementById(id);
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
}

function showAlert(mensaje, tipo = 'success') {
    const notification = document.createElement('div');
    notification.className = `notificacion ${tipo}`;
    notification.textContent = mensaje;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function formatCurrency(value) {
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(value);
}

function generarRecomendacion(desviacion) {
    return desviacion > 0 
        ? "Revisar proveedor y negociar descuentos" 
        : "Mantener buen desempeño";
}

// Inicializar gráficos al cargar
window.onload = inicializarGraficos;
