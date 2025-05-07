// Variables globales
let appData = {
    usuario: null,
    data: [],
    source: null, // 'excel' | 'sheets'
    chartsInitialized: false,
    sheetsUrl: 'https://docs.google.com/spreadsheets/d/1UR2uZN4uSN6sK_7DhIF4ls16ipNXdcQbz5n23puVBwI/edit#gid=0'
};

let sCurveChart = null;
let comparacionChart = null;
let intervaloActualizacion;

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

    // Google Sheets
    document.getElementById('googleSheetsBtn')?.addEventListener('click', function() {
        document.getElementById('googleSheetsForm').classList.remove('hidden');
    });

    document.getElementById('loadSheetsData')?.addEventListener('click', loadDataFromSheets);

    // Botones principales
    document.getElementById('generateAnalysis')?.addEventListener('click', generarAnalisis);
    document.getElementById('generateAnalysisFromSheets')?.addEventListener('click', generarAnalisis);
    document.getElementById('generateReportBtn')?.addEventListener('click', generarReporte);
    document.getElementById('exportPdfBtn')?.addEventListener('click', exportarPDF);
    document.getElementById('closeModal')?.addEventListener('click', cerrarModal);
    document.getElementById('backBtn')?.addEventListener('click', () => mostrarSeccion('presupuestoSection'));
    document.getElementById('volverBtn')?.addEventListener('click', () => mostrarSeccion('analisisSection'));
    document.getElementById('refreshDataBtn')?.addEventListener('click', actualizarDatos);
}

// 3. Manejo de archivos Excel
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
                item: row['Ítem'] || row['item'] || '',
                planificado: parseFloat(row['Planificado'] || row['planificado']) || 0,
                real: parseFloat(row['Real'] || row['real']) || 0,
                causa: '',
                recomendacion: ''
            }));

            mostrarPreviewExcel(firstSheet);
            appData.source = 'excel';
        } catch (error) {
            showAlert('Error al leer el archivo: ' + error.message, 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

function mostrarPreviewExcel(sheet) {
    const html = XLSX.utils.sheet_to_html(sheet);
    document.getElementById('excelPreview').innerHTML = html;
    document.getElementById('excelModal').style.display = 'flex';
}

function cerrarModal() {
    document.getElementById('excelModal').style.display = 'none';
}

// 4. Google Sheets
async function loadDataFromSheets() {
    const btn = document.getElementById('loadSheetsData');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cargando...';
    btn.disabled = true;

    try {
        const sheetId = appData.sheetsUrl.match(/\/d\/([^\/]+)/)?.[1];
        if (!sheetId) throw new Error("URL no válida");

        const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&t=${Date.now()}`;
        
        const response = await fetch(csvUrl);
        if (!response.ok) throw new Error("Error al cargar los datos");
        
        const csvData = await response.text();
        appData.data = processCSVData(csvData);
        appData.source = 'sheets';
        
        showAlert('Datos cargados correctamente', 'success');
        document.getElementById('generateAnalysisFromSheets').classList.remove('hidden');
    } catch (error) {
        showAlert('Error: ' + error.message, 'error');
    } finally {
        btn.innerHTML = '<i class="fas fa-cloud-download-alt"></i> Cargar';
        btn.disabled = false;
    }
}

function processCSVData(csv) {
    const lines = csv.split('\n').filter(line => line.trim() !== '');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    return lines.slice(1).map(line => {
        const values = line.split(',');
        return {
            item: values[0]?.replace(/"/g, '') || '',
            planificado: parseFloat(values[1]) || 0,
            real: parseFloat(values[2]) || 0,
            causa: '',
            recomendacion: ''
        };
    });
}

// 5. Análisis de datos
function generarAnalisis() {
    if (appData.data.length === 0) {
        showAlert('No hay datos para analizar', 'error');
        return;
    }
    
    procesarDatosAnalisis(appData.data);
    mostrarSeccion('analisisSection');
    
    if (appData.source === 'sheets') {
        document.getElementById('refreshDataBtn').classList.remove('hidden');
        if (intervaloActualizacion) clearInterval(intervaloActualizacion);
        intervaloActualizacion = setInterval(actualizarDatos, 60000);
    }
}

function procesarDatosAnalisis(data) {
    const tbody = document.getElementById('analisisTableBody');
    tbody.innerHTML = '';

    data.forEach(item => {
        const desviacion = item.real - item.planificado;
        const row = `
            <tr>
                <td>${item.item}</td>
                <td>${formatCurrency(item.planificado)}</td>
                <td>${formatCurrency(item.real)}</td>
                <td class="${desviacion >= 0 ? 'text-danger' : 'text-success'}">
                    ${formatCurrency(Math.abs(desviacion))} ${desviacion >= 0 ? '▲' : '▼'}
                </td>
                <td class="${desviacion > 0 ? 'badge-overcost' : 'badge-saving'}">
                    ${desviacion > 0 ? 'Sobrecosto' : 'Ahorro'}
                </td>
                <td>
                    <select class="cause-select" onchange="updateCause('${item.item}', this.value)">
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

function updateCause(item, causa) {
    const itemData = appData.data.find(i => i.item === item);
    if (itemData) itemData.causa = causa;
}

// 6. Reportes y gráficos
function generarReporte() {
    mostrarSeccion('reportesSection');
    if (!appData.chartsInitialized) {
        inicializarGraficos();
    } else {
        actualizarGraficos();
    }
}

function inicializarGraficos() {
    if (sCurveChart) sCurveChart.destroy();
    if (comparacionChart) comparacionChart.destroy();

    if (!appData.data || appData.data.length === 0) {
        showAlert('No hay datos disponibles para generar gráficos', 'error');
        return;
    }

    // Datos para gráficos
    const items = appData.data.map(item => item.item);
    const planificado = appData.data.map(item => item.planificado);
    const real = appData.data.map(item => item.real);

    // Gráfico de Curva S
    sCurveChart = new Chart(
        document.getElementById('sCurveChart'),
        {
            type: 'line',
            data: {
                labels: items,
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
    comparacionChart = new Chart(
        document.getElementById('comparacionChart'),
        {
            type: 'bar',
            data: {
                labels: items.slice(0, 5),
                datasets: [
                    {
                        label: 'Planificado',
                        data: planificado.slice(0, 5),
                        backgroundColor: '#4e4376'
                    },
                    {
                        label: 'Real',
                        data: real.slice(0, 5),
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

function actualizarGraficos() {
    if (sCurveChart) sCurveChart.update();
    if (comparacionChart) comparacionChart.update();
}

// 7. Exportar PDF
function exportarPDF() {
    const element = document.getElementById('reportesSection');
    const exportBtn = document.getElementById('exportPdfBtn');
    exportBtn.disabled = true;
    exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';

    const elementsToHide = document.querySelectorAll('.reportes-actions, .user-menu');
    elementsToHide.forEach(el => el.style.opacity = '0');

    html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#FFFFFF'
    }).then(canvas => {
        const pdf = new jspdf.jsPDF('p', 'mm', 'a4');
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const pdfWidth = pdf.internal.pageSize.getWidth() - 20;
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        pdf.addImage(imgData, 'JPEG', 10, 10, pdfWidth, pdfHeight);
        pdf.save('reporte_nanghi.pdf');
    }).finally(() => {
        elementsToHide.forEach(el => el.style.opacity = '1');
        exportBtn.disabled = false;
        exportBtn.innerHTML = 'Exportar como PDF';
    });
}

// 8. Actualización de datos
async function actualizarDatos() {
    if (appData.source !== 'sheets') return;

    const btn = document.getElementById('refreshDataBtn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Actualizando...';
    btn.disabled = true;

    try {
        const sheetId = appData.sheetsUrl.match(/\/d\/([^\/]+)/)?.[1];
        const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&t=${Date.now()}`;
        
        const response = await fetch(csvUrl);
        const csvData = await response.text();
        
        appData.data = processCSVData(csvData);
        procesarDatosAnalisis(appData.data);
        
        if (appData.chartsInitialized) {
            actualizarGraficos();
        }
        
        showAlert('Datos actualizados correctamente', 'success');
    } catch (error) {
        showAlert('Error al actualizar: ' + error.message, 'error');
    } finally {
        btn.innerHTML = '<i class="fas fa-sync-alt"></i> Actualizar Datos';
        btn.disabled = false;
    }
}

// 9. Funciones auxiliares
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

// Inicialización de gráficos al cargar
window.onload = function() {
    if (appData.data.length > 0) {
        inicializarGraficos();
    }
};
