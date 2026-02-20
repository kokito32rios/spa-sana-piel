// =============================================
// DASHBOARD MANICURISTA - LOGIC (CALENDAR VERSION)
// =============================================

// Variables Globales Agenda
let agendaFechaActual = new Date();
let agendaVistaActual = 'semanal'; // semanal | mensual
let agendaDatos = { citas: [], manicuristas: [], horarios_trabajo: [], excepciones: [] };
let agendaInicializada = false;

// Inicializar Socket.IO
let socket;
if (typeof io !== 'undefined') {
    socket = io();
} else {
    console.error('Socket.IO no cargado correctamente');
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. Verificar Token
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    // 2. Cargar Info Usuario
    cargarInfoUsuario();

    // 3. Listeners
    setupListeners();

    // 4. Inicializar Agenda (esperando a usuario)
    // Se llama desde cargarInfoUsuario una vez tenemos el email
});

// =============================================
// SETUP LISTENERS UI
// =============================================
// =============================================
// SETUP LISTENERS UI
// =============================================
function setupListeners() {
    const backdrop = document.getElementById('sidebar-backdrop');
    if (backdrop) {
        backdrop.addEventListener('click', () => {
            cerrarSidebarMobile();
        });
    }

    // Resize listener for responsive agenda
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (window.agendaInicializada && window.agendaVistaActual === 'semanal') {
                renderizarVistaSemanal();
            }
        }, 250); // Debounce 250ms
    });
}

// Global function for toggle button
window.toggleMobileMenu = function () {
    const menuToggle = document.getElementById('mobile-menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');

    if (sidebar) {
        sidebar.classList.toggle('sidebar-open');
        sidebar.classList.toggle('active');
    }

    if (menuToggle) {
        menuToggle.classList.toggle('active');
    }

    if (backdrop) {
        backdrop.classList.toggle('active');
    }
}

// Alias for sidebar toggle (Desktop/Mobile compatibility)
window.toggleSidebar = function () {
    // Check if we are in mobile view (<= 768px)
    if (window.innerWidth <= 768) {
        window.toggleMobileMenu();
    } else {
        // Desktop collapse logic
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.classList.toggle('collapsed');
        }
    }
}

function cerrarSidebarMobile() {
    const sidebar = document.querySelector('.sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const menuToggle = document.getElementById('mobile-menu-toggle');

    if (sidebar) {
        sidebar.classList.remove('sidebar-open');
        sidebar.classList.remove('active');
    }

    if (menuToggle) {
        menuToggle.classList.remove('active');
    }

    if (backdrop) backdrop.classList.remove('active');
}

window.cambiarSeccion = function (seccionId) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(sec => {
        sec.classList.remove('active');
    });

    // Show target section
    const target = document.getElementById(`seccion-${seccionId}`);
    if (target) target.classList.add('active');

    // Update Sidebar
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('href') === `#${seccionId}`) {
            item.classList.add('active');
        }
    });

    const titulos = {
        'agenda': 'Mi Agenda',
        'comisiones': 'Mis Comisiones',
        'cuadre': 'Mi Cuadre Diario',
        'perfil': 'Mi Perfil'
    };
    const headerTitle = document.getElementById('section-title');
    if (headerTitle) headerTitle.textContent = titulos[seccionId] || 'Dashboard';

    cerrarSidebarMobile(); // Close on mobile navigation

    // Si entramos a agenda y no se ha cargado (switch tab), recargar si es necesario
    if (seccionId === 'agenda' && window.usuarioEmail) {
        cargarAgenda();
    }
}

// =============================================
// INFO USUARIO & LOGOUT
// =============================================
function cargarInfoUsuario() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const userWelcome = document.getElementById('user-welcome');
        const profileName = document.getElementById('perfil-nombre');
        const profileEmail = document.getElementById('perfil-email');
        const nombreCompleto = `${payload.nombre} ${payload.apellido}`;

        if (userWelcome) userWelcome.textContent = `Hola, ${payload.nombre}`;
        if (profileName) profileName.textContent = nombreCompleto;
        if (profileEmail) profileEmail.textContent = payload.email;

        window.usuarioEmail = payload.email;
        window.usuarioNombre = nombreCompleto;

        // Poblar el "filtro" de manicurista con el usuario actual (solo visual)
        const selectFiltro = document.getElementById('agenda-filtro-manicurista');
        if (selectFiltro) {
            selectFiltro.innerHTML = `<option value="${payload.email}">${nombreCompleto}</option>`;
            selectFiltro.value = payload.email;
        }

        // Una vez tenemos usuario, cargamos la agenda
        inicializarAgenda();

    } catch (e) {
        console.error('Error al decodificar token:', e);
        cerrarSesion();
    }
}

window.cerrarSesion = function () {
    Swal.fire({
        title: '¿Cerrar sesión?',
        text: "Tendrás que iniciar sesión nuevamente",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Sí, salir',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.removeItem('token');
            window.location.href = '/login.html';
        }
    });
}

// =============================================
// AGENDA LOGIC (Full Calendar Port)
// =============================================
async function inicializarAgenda() {
    if (!agendaInicializada) {
        agendaInicializada = true;
    }
    await cargarAgenda();
}

window.cargarAgenda = async function () {
    const loader = document.getElementById('agenda-loader');
    const gridSemanal = document.getElementById('calendario-semanal-grid');

    if (loader) loader.classList.remove('hidden');
    if (gridSemanal) gridSemanal.classList.add('hidden');

    try {
        const { fechaInicio, fechaFin } = obtenerRangoFechas();
        const token = localStorage.getItem('token');

        // endpoint con filtro de manicurista forzado al usuario actual
        const params = new URLSearchParams({
            fecha_inicio: fechaInicio,
            fecha_fin: fechaFin,
            manicurista: window.usuarioEmail
        });

        const response = await fetch(`/api/citas/helpers/agenda?${params}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            agendaDatos = data;
            actualizarTituloFecha();

            if (agendaVistaActual === 'semanal') {
                renderizarVistaSemanal();
            } else {
                renderizarVistaMensual();
            }
        } else {
            console.error('Error loading agenda data:', data);
        }

        if (loader) loader.classList.add('hidden');
        if (gridSemanal) gridSemanal.classList.remove('hidden');

    } catch (error) {
        console.error('Error cargando agenda:', error);
        if (loader) loader.classList.add('hidden');
    }
}

// ---------------------------------------------
// Vistas y Navegación
// ---------------------------------------------
window.cambiarVistaAgenda = function (vista) {
    agendaVistaActual = vista;
    window.mobileSoloHoy = false; // Reset filter
    document.getElementById('btn-vista-semanal').classList.toggle('active', vista === 'semanal');
    document.getElementById('btn-vista-mensual').classList.toggle('active', vista === 'mensual');
    document.getElementById('calendario-semanal').classList.toggle('hidden', vista !== 'semanal');
    document.getElementById('calendario-mensual').classList.toggle('hidden', vista !== 'mensual');
    cargarAgenda();
}

window.navegarAgenda = function (direccion) {
    window.mobileSoloHoy = false; // Reset filter
    if (agendaVistaActual === 'semanal') {
        agendaFechaActual.setDate(agendaFechaActual.getDate() + (direccion * 7));
    } else {
        agendaFechaActual.setMonth(agendaFechaActual.getMonth() + direccion);
    }
    cargarAgenda();
}

window.irAHoy = function () {
    agendaFechaActual = new Date();
    // En móvil, "Hoy" activa el filtro estricto de solo mostrar hoy
    if (window.innerWidth <= 768) {
        window.mobileSoloHoy = true;
    }
    cargarAgenda();
}

// ---------------------------------------------
// Helpers de Fecha
// ---------------------------------------------
function obtenerRangoFechas() {
    const fecha = new Date(agendaFechaActual);
    if (agendaVistaActual === 'semanal') {
        const dia = fecha.getDay();
        const diff = fecha.getDate() - dia + (dia === 0 ? -6 : 1); // Ajustar al lunes
        const lunes = new Date(fecha.setDate(diff));
        const domingo = new Date(lunes);
        domingo.setDate(lunes.getDate() + 6);
        return {
            fechaInicio: formatearFechaISO(lunes),
            fechaFin: formatearFechaISO(domingo)
        };
    } else {
        const primerDia = new Date(fecha.getFullYear(), fecha.getMonth(), 1);
        const ultimoDia = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0);
        return {
            fechaInicio: formatearFechaISO(primerDia),
            fechaFin: formatearFechaISO(ultimoDia)
        };
    }
}

function formatearFechaISO(fecha) {
    const offset = fecha.getTimezoneOffset() * 60000;
    const localDate = new Date(fecha.getTime() - offset);
    return localDate.toISOString().split('T')[0];
}

function actualizarTituloFecha() {
    const titulo = document.getElementById('agenda-fecha-titulo');
    if (!titulo) return;

    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    if (agendaVistaActual === 'semanal') {
        // Validación para modo "Solo Hoy" en móvil
        if (window.mobileSoloHoy && window.innerWidth <= 768) {
            titulo.textContent = `Hoy, ${agendaFechaActual.getDate()} de ${meses[agendaFechaActual.getMonth()]}`;
            return;
        }

        const { fechaInicio, fechaFin } = obtenerRangoFechas();
        const inicio = new Date(fechaInicio + 'T00:00:00');
        const fin = new Date(fechaFin + 'T00:00:00');
        if (inicio.getMonth() === fin.getMonth()) {
            titulo.textContent = `${inicio.getDate()} - ${fin.getDate()} ${meses[inicio.getMonth()]} ${inicio.getFullYear()}`;
        } else {
            titulo.textContent = `${inicio.getDate()} ${meses[inicio.getMonth()].substring(0, 3)} - ${fin.getDate()} ${meses[fin.getMonth()].substring(0, 3)} ${fin.getFullYear()}`;
        }
    } else {
        titulo.textContent = `${meses[agendaFechaActual.getMonth()]} ${agendaFechaActual.getFullYear()}`;
    }
}

// ---------------------------------------------
// Renderizado
// ---------------------------------------------
function renderizarVistaSemanal() {
    const grid = document.getElementById('calendario-semanal-grid');
    const { fechaInicio } = obtenerRangoFechas();
    const inicioSemana = new Date(fechaInicio + 'T00:00:00');
    const hoyStr = formatearFechaISO(new Date());

    const diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    // LEYENDA (Solo la manicurista actual)
    const leyendaContainer = document.getElementById('leyenda-manicuristas-container');
    if (leyendaContainer) {
        const color = '#e91e63'; // Color fijo para "mi"
        leyendaContainer.innerHTML = `
            <div class="leyenda-manicuristas">
                <span class="leyenda-titulo">Manicurista:</span>
                <div class="manicurista-chip" style="border-left: 5px solid ${color};">
                    💅 ${window.usuarioNombre || 'Yo'}
                </div>
            </div>
            <div class="leyendas-wrapper">
                 <div class="leyenda-estados">
                    <span class="leyenda-titulo">Estados:</span>
                    <div class="estado-chip"><span class="estado-color" style="background-color: #ffc107;"></span>Pendiente</div>
                    <div class="estado-chip"><span class="estado-color" style="background-color: #17a2b8;"></span>Confirmada</div>
                    <div class="estado-chip"><span class="estado-color" style="background-color: #28a745;"></span>Completada</div>
                 </div>
            </div>
        `;
    }

    // --- MODO MÓVIL: VISTA DE TARJETAS ---
    if (window.innerWidth <= 768) {
        let htmlMobile = '<div class="agenda-mobile-view">';

        // Iterar por cada día de la semana
        for (let i = 0; i < 7; i++) {
            const fecha = new Date(inicioSemana);
            fecha.setDate(inicioSemana.getDate() + i);
            const fechaStr = formatearFechaISO(fecha);
            const esHoy = fechaStr === hoyStr;

            // Si está activo "Solo Hoy", saltar los días que no son hoy
            if (window.mobileSoloHoy && !esHoy) {
                continue;
            }

            // Filtrar citas para este día
            const citasDia = agendaDatos.citas
                .filter(c => c.fecha.split('T')[0] === fechaStr)
                .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));

            // Logic to show day:
            // IF 'mobileSoloHoy' is true, we ALWAYS show the day header (even if empty) to indicate we are looking at today.
            // ELSE (normal week view), we only show existing appointments to save space (or maybe we should show empty days? 
            // The previous logic was "if (citasDia.length > 0)". 
            // Let's change it: If "Solo Hoy", show it regardless. If not, stick to "only if has data" OR maybe show all? 
            // Admin panel logic was "if (citasDia.length > 0)". I'll stick to that for normal view, but force show for "Solo Hoy".

            if (citasDia.length > 0 || (window.mobileSoloHoy && esHoy)) {
                const diaNombre = diasSemana[i];
                const diaNumero = fecha.getDate();

                htmlMobile += `
                    <div class="mobile-day-group ${esHoy ? 'today' : ''}" style="margin-bottom: 20px;">
                        <h4 style="margin-bottom: 10px; border-bottom: 2px solid #ddd; padding-bottom: 5px; color: ${esHoy ? 'var(--primary-color)' : '#333'}">
                            ${diaNombre} ${diaNumero} ${esHoy ? '(Hoy)' : ''}
                        </h4>
                `;

                if (citasDia.length === 0) {
                    htmlMobile += `<p class="text-muted" style="font-style:italic;">No hay citas para hoy.</p>`;
                } else {
                    citasDia.forEach(cita => {
                        const horaInicio = cita.hora_inicio.substring(0, 5);
                        const horaFin = cita.hora_fin.substring(0, 5);
                        let estadoClass = '';
                        switch (cita.estado) {
                            case 'pendiente': estadoClass = '#ffc107'; break;
                            case 'confirmada': estadoClass = '#17a2b8'; break;
                            case 'completada': estadoClass = '#28a745'; break;
                            default: estadoClass = '#ddd';
                        }

                        htmlMobile += `
                            <div class="agenda-card" style="border-left: 4px solid ${estadoClass}; margin-bottom: 10px;">
                                <span class="agenda-time">${horaInicio} - ${horaFin}</span>
                                <div class="agenda-details">
                                    <span class="agenda-service">💅 ${cita.nombre_servicio}</span>
                                    <span class="agenda-status" style="background-color: ${estadoClass}20; color: ${estadoClass};">
                                        ${cita.estado.charAt(0).toUpperCase() + cita.estado.slice(1)}
                                    </span>
                                </div>
                            </div>
                        `;
                    });
                }

                htmlMobile += `</div>`;
            }
        }

        // Si no hubo citas en toda la semana (y no estamos en modo solo hoy o hoy no estaba en el rango - edge case)
        if (htmlMobile === '<div class="agenda-mobile-view">') {
            if (window.mobileSoloHoy) {
                // Should have been handled above if 'esHoy' was found. If not found, it means 'hoy' is not in this week?
                // But irAHoy sets date to today.
                htmlMobile += `<div class="empty-state"><p>No se encontraron datos para hoy.</p></div>`;
            } else {
                htmlMobile += `<div class="empty-state"><p>No hay citas programadas para esta semana</p></div>`;
            }
        }

        htmlMobile += '</div>';
        grid.innerHTML = htmlMobile;

        // Ajustar estilos del grid para móvil
        grid.classList.remove('calendario-grid');
        grid.classList.add('agenda-mobile-view');

        // Auto-scroll al día de hoy si existe
        setTimeout(() => {
            const hoyElement = grid.querySelector('.mobile-day-group.today');
            if (hoyElement) {
                hoyElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);

        return;
    }

    // --- MODO ESCRITORIO: CALENDARIO GRID (Original) ---
    grid.classList.remove('agenda-mobile-view');
    grid.classList.add('calendario-grid');
    grid.style.display = ''; // Limpiar estilo inline si quedó algo

    const horas = [];
    for (let h = 8; h < 20; h++) {
        horas.push(`${h.toString().padStart(2, '0')}:00`);
        horas.push(`${h.toString().padStart(2, '0')}:30`);
    }

    let html = '<div class="calendario-header"><div class="calendario-header-cell">Hora</div>';
    for (let i = 0; i < 7; i++) {
        const fecha = new Date(inicioSemana);
        fecha.setDate(inicioSemana.getDate() + i);
        const fStr = formatearFechaISO(fecha);
        const esHoy = fStr === hoyStr ? 'es-hoy' : '';
        html += `<div class="calendario-header-cell ${esHoy}">${diasSemana[i]} ${fecha.getDate()}</div>`;
    }
    html += '</div>';

    // Filas (Horas) - Grid Plano
    const hoy = new Date(); // Para verificar pasado/futuro

    horas.forEach(hora => {
        html += `<div class="calendario-hora">${hora}</div>`;

        for (let i = 0; i < 7; i++) {
            const fecha = new Date(inicioSemana);
            fecha.setDate(inicioSemana.getDate() + i);
            const fechaStr = formatearFechaISO(fecha);

            // Verificar si es pasado
            const [h, m] = hora.split(':');
            const esPasado = fechaStr < hoyStr || (fechaStr === hoyStr && (parseInt(h) < hoy.getHours() || (parseInt(h) === hoy.getHours() && parseInt(m) <= hoy.getMinutes())));
            const clasePasado = esPasado ? 'pasado' : '';

            // Buscar cita en este slot
            let citasEnSlot = agendaDatos.citas.filter(c =>
                c.fecha.split('T')[0] === fechaStr &&
                c.hora_inicio.substring(0, 5) === hora
            );

            // Filtrar canceladas futuras
            citasEnSlot = citasEnSlot.filter(c => {
                if (c.estado === 'cancelada' && !esPasado) return false;
                return true;
            });

            html += `<div class="calendario-celda ${clasePasado}" 
                        style="position: relative; height: 60px;"
                        onclick="abrirModalRegistro('${fechaStr}', '${hora}')">`;

            if (citasEnSlot.length > 0) {
                const width = 100 / citasEnSlot.length;

                citasEnSlot.forEach((cita, index) => {
                    const start = new Date(`2000-01-01T${cita.hora_inicio}`);
                    const end = new Date(`2000-01-01T${cita.hora_fin}`);
                    const diffMin = (end - start) / 60000;

                    const slots = diffMin / 30;
                    const height = (slots * 60) - 2;

                    const left = index * width;
                    const color = '#e91e63';

                    const esCorta = diffMin <= 45 ? 'cita-corta' : '';

                    html += `
                        <div class="cita-slot estado-${cita.estado} ${esCorta}" 
                             style="position: absolute; top: 0; left: ${left}%; width: ${width}%; height: ${height}px; z-index: ${10 + index}; border-left: 4px solid ${color};"
                             onclick="event.stopPropagation(); mostrarDetalleCita(${JSON.stringify(cita).replace(/"/g, '&quot;')})">
                            <div class="cita-info">
                                <strong style="display:block; font-size:1.1em; margin-bottom:2px;">
                                    ${cita.hora_inicio.substring(0, 5)} - ${cita.hora_fin.substring(0, 5)}
                                </strong>
                                <span style="font-size:0.9em;">${cita.nombre_service || cita.nombre_servicio}</span>
                            </div>
                        </div>
                    `;
                });
            } else if (!esPasado) {
                html += '<div class="slot-disponible" style="opacity:0; transition: opacity 0.2s; font-size:1.5rem; text-align:center; line-height:60px;">+</div>';
            }

            html += `</div>`;
        }
    });

    grid.innerHTML = html;
}


function renderizarVistaMensual() {
    const grid = document.getElementById('calendario-mensual-grid');
    const year = agendaFechaActual.getFullYear();
    const month = agendaFechaActual.getMonth();
    const hoyStr = formatearFechaISO(new Date());

    const primerDia = new Date(year, month, 1);
    const ultimoDia = new Date(year, month + 1, 0);
    let inicioSemana = primerDia.getDay() - 1;
    if (inicioSemana < 0) inicioSemana = 6;

    const diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    let html = '';

    diasSemana.forEach(d => html += `<div class="mes-header">${d}</div>`);

    // Dias vacios
    for (let i = 0; i < inicioSemana; i++) {
        html += `<div class="mes-dia otro-mes"></div>`;
    }

    for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
        const fechaStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${dia.toString().padStart(2, '0')}`;
        const esHoy = fechaStr === hoyStr ? 'es-hoy' : '';
        const citasDia = agendaDatos.citas.filter(c => c.fecha.split('T')[0] === fechaStr);

        html += `
            <div class="mes-dia ${esHoy}" onclick="irADiaSemanal('${fechaStr}')">
                <div class="dia-numero">${dia}</div>
                ${citasDia.length > 0 ? `<span class="citas-badge">${citasDia.length} citas</span>` : ''}
            </div>
        `;
    }
    grid.innerHTML = html;
}

window.irADiaSemanal = function (fechaStr) {
    agendaFechaActual = new Date(fechaStr + 'T00:00:00');
    cambiarVistaAgenda('semanal');
}

// =============================================
// PLACEHOLDERS (Non-Agenda) - UPDATE: IMPLEMENTADO
// =============================================

// =============================================
// SECCIÓN MI CUADRE (REPORTES)
// =============================================

// Variable global para controlar inicialización
let cuadreInicializado = false;

window.inicializarCuadre = function () {
    if (cuadreInicializado) return;

    // 0. Establecer fecha de HOY por defecto en el input
    const inputFecha = document.getElementById('cuadre-fecha');
    if (inputFecha) {
        inputFecha.valueAsDate = new Date();
    }

    // 1. Poblar Años
    const selectAnio = document.getElementById('filtro-cuadre-anio');
    if (selectAnio) {
        const currentYear = new Date().getFullYear();
        selectAnio.innerHTML = '';
        for (let i = currentYear - 3; i <= currentYear + 1; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = i;
            if (i === currentYear) opt.selected = true;
            selectAnio.appendChild(opt);
        }

        // Listener para actualizar semanas si cambia el año
        selectAnio.addEventListener('change', () => {
            if (document.getElementById('filtro-cuadre-tipo').value === 'semana') {
                poblarSemanasCuadre();
            }
        });
    }

    // 2. Mes por defecto
    const selectMes = document.getElementById('filtro-cuadre-mes');
    if (selectMes) selectMes.value = new Date().getMonth() + 1;

    // 3. Inicializar vista de filtros
    cambiarTipoFiltroCuadre();

    cuadreInicializado = true;
}

// ... (Funciones de filtro se mantienen igual, simplificadas aquí por el reemplazo) ...
window.cambiarTipoFiltroCuadre = function () {
    const tipo = document.getElementById('filtro-cuadre-tipo').value;
    document.getElementById('filtro-cuadre-mes-container').style.display = 'none';
    document.getElementById('filtro-cuadre-semana-container').style.display = 'none';
    document.getElementById('filtro-cuadre-rango-container').style.display = 'none';

    if (tipo === 'mes') {
        document.getElementById('filtro-cuadre-mes-container').style.display = 'flex';
    } else if (tipo === 'semana') {
        document.getElementById('filtro-cuadre-semana-container').style.display = 'block';
        poblarSemanasCuadre();
    } else if (tipo === 'rango') {
        document.getElementById('filtro-cuadre-rango-container').style.display = 'flex';
        // Fechas default
        if (!document.getElementById('filtro-cuadre-desde').value) {
            const hoy = new Date();
            const hace7 = new Date(); hace7.setDate(hace7.getDate() - 7);
            document.getElementById('filtro-cuadre-desde').valueAsDate = hace7;
            document.getElementById('filtro-cuadre-hasta').valueAsDate = hoy;
        }
    }
}

window.poblarSemanasCuadre = function () {
    // ... (Misma lógica, no cambia) ...
    const selectSemana = document.getElementById('filtro-cuadre-semana');
    const anio = document.getElementById('filtro-cuadre-anio').value || new Date().getFullYear();
    selectSemana.innerHTML = '';
    const primerDia = new Date(anio, 0, 1);
    const ultimoDia = new Date(anio, 11, 31);
    let semanaActual = new Date(primerDia);
    const diaSemana = semanaActual.getDay();
    const diff = diaSemana === 0 ? -6 : 1 - diaSemana;
    semanaActual.setDate(semanaActual.getDate() + diff);

    let numSemana = 1;
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    while (semanaActual <= ultimoDia) {
        const finSemana = new Date(semanaActual);
        finSemana.setDate(finSemana.getDate() + 6);
        const desde = semanaActual.toISOString().split('T')[0];
        const hasta = finSemana.toISOString().split('T')[0];
        const displayDesde = `${semanaActual.getDate()} ${meses[semanaActual.getMonth()]}`;
        const displayHasta = `${finSemana.getDate()} ${meses[finSemana.getMonth()]}`;
        const option = document.createElement('option');
        option.value = `${desde}|${hasta}`;
        option.textContent = `Semana ${numSemana}: ${displayDesde} - ${displayHasta}`;
        const hoy = new Date();
        if (hoy >= semanaActual && hoy <= finSemana) option.selected = true;
        selectSemana.appendChild(option);
        semanaActual.setDate(semanaActual.getDate() + 7);
        numSemana++;
    }
}

// === CREAR / EDITAR ===
window.abrirModalRegistro = function () {
    // Limpiar y preparar para nuevo registro
    document.getElementById('cuadre-id').value = '';
    document.getElementById('cuadre-desc').value = '';
    document.getElementById('cuadre-valor').value = '';

    // Fecha hoy por defecto
    document.getElementById('cuadre-fecha').valueAsDate = new Date();

    // UI Defaults
    document.getElementById('modal-registro-titulo').textContent = '📝 Nuevo Registro';
    const btnSubmit = document.getElementById('btn-cuadre-submit');
    if (btnSubmit) btnSubmit.innerHTML = '<span>💾</span> Guardar';

    document.getElementById('modal-registro').style.display = 'flex';
}

window.cerrarModalRegistro = function () {
    document.getElementById('modal-registro').style.display = 'none';
}

window.registrarCuadre = async function (e) {
    e.preventDefault();

    const idInput = document.getElementById('cuadre-id');
    const descInput = document.getElementById('cuadre-desc');
    const valorInput = document.getElementById('cuadre-valor');
    const fechaInput = document.getElementById('cuadre-fecha');

    // Obtener botón usando ID si es posible, o búsqueda
    const btnSubmit = document.getElementById('btn-cuadre-submit') || e.target.querySelector('button[type="submit"]');

    const id = idInput.value;
    const descripcion = descInput.value.trim();
    const valor = parseFloat(valorInput.value);
    const fecha = fechaInput.value; // YYYY-MM-DD

    if (!descripcion || isNaN(valor) || valor <= 0 || !fecha) {
        mostrarModal('Por favor completa todos los campos correctamente.', 'error');
        return;
    }

    try {
        btnSubmit.disabled = true;
        const originalText = btnSubmit.innerHTML;
        btnSubmit.textContent = id ? 'Actualizando...' : 'Guardando...';

        const token = localStorage.getItem('token');
        let url = '/api/reportes';
        let method = 'POST';

        if (id) {
            url += `/${id}`;
            method = 'PUT';
        }

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ descripcion, valor, fecha })
        });

        const data = await response.json();

        if (data.success) {
            cerrarModalRegistro();
            mostrarModal(id ? 'Registro actualizado correctamente' : 'Registro guardado exitosamente', 'success');
            cargarReportes(); // Recargar tabla
        } else {
            mostrarModal('Error: ' + data.message, 'error');
        }

    } catch (error) {
        console.error('Error:', error);
        mostrarModal('Error de conexión.', 'error');
    } finally {
        btnSubmit.disabled = false;
        if (btnSubmit.textContent.includes('...')) {
            // Restaurar texto básico si hubo error o al finalizar
            btnSubmit.innerHTML = id ? '<span>💾</span> Actualizar' : '<span>💾</span> Guardar';
        }
    }
}

window.editarReporte = function (id, descripcion, valor, fecha) {
    // 1. Abrir Modal
    document.getElementById('modal-registro').style.display = 'flex';

    // 2. Rellenar datos
    document.getElementById('cuadre-id').value = id;
    document.getElementById('cuadre-desc').value = descripcion;
    document.getElementById('cuadre-valor').value = valor;

    if (fecha) {
        // Extraer directamente YYYY-MM-DD para evitar el desfase de zona horaria 
        // cuando new Date() convierte el UTC a hora local (ej. Colombia -5).
        const soloFecha = typeof fecha === 'string' ? fecha.split('T')[0] : fecha;
        document.getElementById('cuadre-fecha').value = soloFecha;
    }

    // 3. Cambiar títulos y botones
    document.getElementById('modal-registro-titulo').textContent = '✏️ Editar Registro';
    const btnSubmit = document.getElementById('btn-cuadre-submit');
    if (btnSubmit) btnSubmit.innerHTML = '<span>🔄</span> Actualizar';
}

window.cancelarEdicion = function () {
    // Legacy placeholder si algo lo llama, pero ahora usamos cerrarModalRegistro
    cerrarModalRegistro();
}

window.cargarReportes = async function () {
    const tbody = document.getElementById('cuadre-tbody');
    const totalDiaEl = document.getElementById('cuadre-total-dia');
    const totalGananciaEl = document.getElementById('cuadre-total-ganancia');

    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center">Cargando...</td></tr>';

    // Obtener filtros
    const tipo = document.getElementById('filtro-cuadre-tipo').value;
    const anio = document.getElementById('filtro-cuadre-anio').value;
    const mes = document.getElementById('filtro-cuadre-mes').value;

    let url = `/api/reportes?tipo=${tipo}&anio=${anio}`;
    // ... Agregar lógica de params (igual a anterior) ...
    if (tipo === 'mes') {
        url += `&mes=${mes}`;
    } else if (tipo === 'semana') {
        const semanaVal = document.getElementById('filtro-cuadre-semana').value;
        if (semanaVal) {
            const [desde, hasta] = semanaVal.split('|');
            url += `&desde=${desde}&hasta=${hasta}`;
        }
    } else if (tipo === 'rango') {
        const desde = document.getElementById('filtro-cuadre-desde').value;
        const hasta = document.getElementById('filtro-cuadre-hasta').value;
        if (desde && hasta) url += `&desde=${desde}&hasta=${hasta}`;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await response.json();

        if (data.success) {
            if (data.reportes.length === 0) {
                if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No hay registros para este filtro</td></tr>';
                if (totalDiaEl) totalDiaEl.textContent = formatCurrency(0);
                if (totalGananciaEl) totalGananciaEl.textContent = formatCurrency(0);
                return;
            }

            if (tbody) {
                tbody.innerHTML = data.reportes.map(r => {
                    // Pasar datos seguros a la función editar
                    // Escapar strings es buena práctica
                    const descSafe = r.descripcion.replace(/'/g, "\\'");

                    // Ajuste de fecha para visualizar y para editar
                    // OJO: La fecha de BD viene en UTC o local dependiendo driver.
                    // Para display usamos toLocaleDateString
                    // Para editar enviamos r.fecha tal cual (ISO string)

                    const fechaObj = new Date(r.fecha);
                    // Importante: al crear fecha con string YYYY-MM-DD javascript asume UTC.
                    // Usamos getUTCDate para mostrar la fecha correcta almacenada
                    // O simplemente split
                    const fechaVisual = r.fecha.split('T')[0];

                    return `
                        <tr>
                            <td>${fechaVisual}</td>
                            <td>${r.descripcion}</td>
                            <td class="font-bold text-dark">${formatCurrency(r.valor_reportado)}</td>
                            <td><span class="badge badge-info">${r.porcentaje_aplicado || '?'}%</span></td>
                            <td class="font-bold text-success">${formatCurrency(r.ganancia_estimada)}</td>
                            <td>
                                <button class="btn-sm btn-warning" style="margin-right:5px;" 
                                    onclick="editarReporte(${r.id_reporte}, '${descSafe}', ${r.valor_reportado}, '${r.fecha}')" 
                                    title="Editar">✏️</button>
                                <button class="btn-sm btn-danger" onclick="eliminarReporte(${r.id_reporte})" title="Eliminar">🗑️</button>
                            </td>
                        </tr>
                    `;
                }).join('');
            }

            if (totalDiaEl) totalDiaEl.textContent = formatCurrency(data.totalReportado);
            if (totalGananciaEl) totalGananciaEl.textContent = formatCurrency(data.totalGanancia);

        } else {
            if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center text-red">Error al cargar datos</td></tr>';
        }

    } catch (error) {
        console.error('Error:', error);
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center text-red">Error de conexión</td></tr>';
    }
}

// Eliminar Reporte (Con confirmación SweetAlert2)
window.eliminarReporte = function (id) {
    Swal.fire({
        title: '¿Estás segura?',
        text: "No podrás revertir esta acción",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`/api/reportes/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                const data = await response.json();

                if (data.success) {
                    Swal.fire(
                        '¡Eliminado!',
                        'El registro ha sido eliminado.',
                        'success'
                    );
                    cargarReportes();
                } else {
                    mostrarModal('Error: ' + data.message, 'error');
                }

            } catch (error) {
                console.error('Error:', error);
                mostrarModal('Error al eliminar registro.', 'error');
            }
        }
    });
}

// Helpers Modal (Usando SweetAlert2)
window.mostrarModal = function (mensaje, tipo) {
    // Mapear tipos de SWAL
    // success, error, warning, info, question
    let swalIcon = tipo;
    if (tipo === 'error') swalIcon = 'error';
    if (tipo === 'success') swalIcon = 'success';

    Swal.fire({
        title: tipo === 'success' ? '¡Éxito!' : 'Atención',
        text: mensaje,
        icon: swalIcon,
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#e91e63' // Color primario aprox
    });
}

window.cerrarModal = function () {
    // Swal se cierra solo o con clic
    Swal.close();
}

window.cambiarPassword = async function (e) {
    e.preventDefault();

    const newPass = document.getElementById('new-pass').value;
    if (!newPass || newPass.trim().length < 6) {
        mostrarModal('La contraseña debe tener al menos 6 caracteres', 'error');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const email = window.usuarioEmail; // Asegurar que esta variable global esté set

        const res = await fetch(`/api/usuarios/${email}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ password: newPass })
        });

        const data = await res.json();

        if (data.success) {
            mostrarModal('Contraseña actualizada correctamente', 'success');
            document.getElementById('form-password').reset();
        } else {
            mostrarModal(data.message || 'Error al actualizar', 'error');
        }
    } catch (error) {
        console.error(error);
        mostrarModal('Error de conexión', 'error');
    }
}

// =============================================
// SECCIÓN COMISIONES
// =============================================
let comisionChart = null; // Si usáramos Chart.js, por ahora solo texto

window.inicializarComisiones = function () {
    // 1. Poblar Años (3 años atrás y 1 adelante)
    const selectAnio = document.getElementById('filtro-comision-anio');
    if (selectAnio) {
        const currentYear = new Date().getFullYear();
        selectAnio.innerHTML = '';
        for (let i = currentYear - 3; i <= currentYear + 1; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = i;
            if (i === currentYear) opt.selected = true;
            selectAnio.appendChild(opt);
        }
    }

    // 2. Establecer Mes Actual por defecto
    const selectMes = document.getElementById('filtro-comision-mes');
    if (selectMes) {
        selectMes.value = new Date().getMonth() + 1;
    }

    // 3. Listeners para cambios
    const tipoFiltro = document.getElementById('filtro-comision-tipo');
    if (tipoFiltro) {
        tipoFiltro.addEventListener('change', cambiarTipoFiltroComision);
    }

    const selectSemanaAnio = document.getElementById('filtro-comision-anio');
    if (selectSemanaAnio) {
        selectSemanaAnio.addEventListener('change', () => {
            if (document.getElementById('filtro-comision-tipo').value === 'semana') {
                poblarSemanasComision();
            }
        });
    }

    // 4. Inicializar vista
    cambiarTipoFiltroComision();
    cargarComisiones();
}

window.cambiarTipoFiltroComision = function () {
    const tipo = document.getElementById('filtro-comision-tipo').value;

    // Ocultar todos los contenedores
    document.getElementById('filtro-mes-container').style.display = 'none';
    document.getElementById('filtro-semana-container').style.display = 'none';
    document.getElementById('filtro-rango-container').style.display = 'none';

    // Mostrar el contenedor correspondiente
    if (tipo === 'mes') {
        document.getElementById('filtro-mes-container').style.display = 'flex';
    } else if (tipo === 'semana') {
        document.getElementById('filtro-semana-container').style.display = 'block';
        poblarSemanasComision();
    } else if (tipo === 'rango') {
        document.getElementById('filtro-rango-container').style.display = 'flex';
        // Establecer fechas por defecto (semana actual) si están vacías
        if (!document.getElementById('filtro-comision-desde').value) {
            const hoy = new Date();
            const hace7Dias = new Date(hoy);
            hace7Dias.setDate(hace7Dias.getDate() - 7);
            document.getElementById('filtro-comision-desde').valueAsDate = hace7Dias;
            document.getElementById('filtro-comision-hasta').valueAsDate = hoy;
        }
    }
}

window.poblarSemanasComision = function () {
    const selectSemana = document.getElementById('filtro-comision-semana');
    const anio = document.getElementById('filtro-comision-anio').value || new Date().getFullYear();

    selectSemana.innerHTML = '';

    // Generar semanas del año
    const primerDia = new Date(anio, 0, 1);
    const ultimoDia = new Date(anio, 11, 31);

    let semanaActual = new Date(primerDia);
    // Ajustar al lunes de esa semana
    const diaSemana = semanaActual.getDay();
    const diff = diaSemana === 0 ? -6 : 1 - diaSemana;
    semanaActual.setDate(semanaActual.getDate() + diff);

    let numSemana = 1;

    while (semanaActual <= ultimoDia) {
        const finSemana = new Date(semanaActual);
        finSemana.setDate(finSemana.getDate() + 6);

        const desde = semanaActual.toISOString().split('T')[0];
        const hasta = finSemana.toISOString().split('T')[0];

        // Formatear display
        const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const displayDesde = `${semanaActual.getDate()} ${meses[semanaActual.getMonth()]}`;
        const displayHasta = `${finSemana.getDate()} ${meses[finSemana.getMonth()]}`;

        const option = document.createElement('option');
        option.value = `${desde}|${hasta}`;
        option.textContent = `Semana ${numSemana}: ${displayDesde} - ${displayHasta}`;
        selectSemana.appendChild(option);

        semanaActual.setDate(semanaActual.getDate() + 7);
        numSemana++;
    }

    // Seleccionar la semana actual si estamos en el año actual
    const hoy = new Date();
    if (parseInt(anio) === hoy.getFullYear()) {
        const opciones = selectSemana.options;
        for (let i = 0; i < opciones.length; i++) {
            const [desde, hasta] = opciones[i].value.split('|');
            if (hoy >= new Date(desde) && hoy <= new Date(hasta)) {
                selectSemana.selectedIndex = i;
                break;
            }
        }
    }
}

window.cargarComisiones = async function () {
    const tbody = document.getElementById('comis-tbody');
    const totalMes = document.getElementById('comis-total-mes');
    const metricLabel = document.querySelector('.metric-comisiones .metric-label');

    // Determinar Fechas según Filtro
    const tipo = document.getElementById('filtro-comision-tipo').value;
    let fechaInicio, fechaFin;
    let labelPeriodo = "Periodo Seleccionado";

    if (tipo === 'mes') {
        const mes = document.getElementById('filtro-comision-mes').value;
        const anio = document.getElementById('filtro-comision-anio').value;
        const primerDia = new Date(anio, mes - 1, 1);
        const ultimoDia = new Date(anio, mes, 0); // Ultimo dia del mes

        fechaInicio = formatearFechaISO(primerDia);
        fechaFin = formatearFechaISO(ultimoDia);

        const mesesNombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        labelPeriodo = `Ganancias (${mesesNombres[mes - 1]} ${anio})`;

    } else if (tipo === 'semana') {
        const valorSemana = document.getElementById('filtro-comision-semana').value;
        if (valorSemana) {
            [fechaInicio, fechaFin] = valorSemana.split('|');
            labelPeriodo = "Ganancias (Semana Seleccionada)";
        } else {
            // Fallback si no hay semanas
            const hoy = new Date();
            fechaInicio = formatearFechaISO(hoy);
            fechaFin = formatearFechaISO(hoy);
        }

    } else if (tipo === 'rango') {
        fechaInicio = document.getElementById('filtro-comision-desde').value;
        fechaFin = document.getElementById('filtro-comision-hasta').value;
        labelPeriodo = "Ganancias (Rango Personalizado)";
    }

    if (metricLabel) metricLabel.textContent = labelPeriodo;

    if (!fechaInicio || !fechaFin) {
        alert("Por favor selecciona un rango de fechas válido");
        return;
    }

    if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center">Cargando...</td></tr>';

    try {
        const token = localStorage.getItem('token');
        const params = new URLSearchParams({ fecha_inicio: fechaInicio, fecha_fin: fechaFin });

        const response = await fetch(`/api/citas/helpers/mis-comisiones?${params}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            if (tbody) {
                if (data.comisiones.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay comisiones en este periodo</td></tr>';
                } else {
                    tbody.innerHTML = data.comisiones.map(c => {
                        const porcentaje = c.valor_servicio > 0 ? Math.round((c.ganancia / c.valor_servicio) * 100) : 0;
                        return `
                            <tr>
                                <td>${c.fecha.split('T')[0]}</td>
                                <td>${c.nombre_servicio}</td>
                                <td>${formatCurrency(c.valor_servicio)}</td>
                                <td>${porcentaje}%</td>
                                <td class="text-success font-bold">${formatCurrency(c.ganancia)}</td>
                            </tr>
                        `;
                    }).join('');
                }
            }

            // Actualizar Totales (ahora viene objeto totales)
            // Soporte retrocompatible por si el backend viejo responde solo con 'total'
            const totalComis = data.totales ? data.totales.comisiones : (data.total || 0);

            if (totalMes) totalMes.textContent = formatCurrency(totalComis);

            // Poblar Deducciones
            const tbodyDeducciones = document.getElementById('deducciones-tbody');
            const totalDeduccionesEl = document.getElementById('comis-total-deducciones');
            const totalPagarEl = document.getElementById('comis-total-pagar');

            if (tbodyDeducciones) {
                if (data.deducciones && data.deducciones.length > 0) {
                    tbodyDeducciones.innerHTML = data.deducciones.map(d => `
                        <tr>
                            <td>${d.fecha.split('T')[0]}</td>
                             <td>${d.descripcion}</td>
                             <td class="text-danger font-bold">-${formatCurrency(d.monto)}</td>
                        </tr>
                    `).join('');
                } else {
                    tbodyDeducciones.innerHTML = '<tr><td colspan="3" class="text-center">Sin deducciones</td></tr>';
                }
            }

            if (totalDeduccionesEl && data.totales) {
                totalDeduccionesEl.textContent = formatCurrency(data.totales.deducciones || 0);
            }
            if (totalPagarEl && data.totales) {
                totalPagarEl.textContent = formatCurrency(data.totales.pagar || 0);
            }

        } else {
            console.error('Error:', data.message);
            if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center text-red">Error al cargar datos</td></tr>';
        }

    } catch (error) {
        console.error('Error:', error);
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center text-red">Error de conexión</td></tr>';
    }
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount);
}

// Hook into cambiarSeccion to load data
const originalCambiarSeccion = window.cambiarSeccion;
window.cambiarSeccion = function (seccion) {
    originalCambiarSeccion(seccion);
    if (seccion === 'comisiones') {
        // Inicializar si no se ha hecho (podemos comprobar si el select de año tiene opciones)
        const anioSelect = document.getElementById('filtro-comision-anio');
        if (anioSelect && anioSelect.options.length === 0) {
            inicializarComisiones();
        } else {
            // Si ya está inicializado, solo recargar data
            cargarComisiones();
        }
    }
}

// =============================================
// SOCKET.IO LISTENERS (Actualización en Vivo)
// =============================================
if (socket) {
    socket.on('comisiones_actualizadas', (data) => {
        console.log('🔔 Socket: Comisiones actualizadas', data);
        // Solo recargar si estamos en la sección de comisiones
        const seccionActiva = document.querySelector('.content-section.active');
        if (seccionActiva && seccionActiva.id === 'seccion-comisiones') {
            cargarComisiones();
        }
    });

    socket.on('gastos_actualizados', (data) => {
        console.log('🔔 Socket: Gastos actualizados', data);
        // Los gastos pueden ser deducciones que afectan comisiones
        const seccionActiva = document.querySelector('.content-section.active');
        if (seccionActiva && seccionActiva.id === 'seccion-comisiones') {
            cargarComisiones();
        }
    });

    socket.on('reporte_actualizado', (data) => {
        console.log('🔔 Socket: Reporte actualizado', data);
        const seccionActiva = document.querySelector('.content-section.active');
        if (seccionActiva && seccionActiva.id === 'seccion-cuadre') {
            cargarReportes();
        }
    });

    socket.on('calendario_actualizado', (data) => {
        console.log('🔔 Socket: Calendario actualizado', data);
        if (typeof cargarAgenda === 'function') {
            const seccionActiva = document.querySelector('.content-section.active');
            if (seccionActiva && seccionActiva.id === 'seccion-agenda') {
                cargarAgenda();
            }
        }
    });

    console.log('🟢 Listeners de Sockets activados en Dashboard Manicurista');
}

// =============================================
// MOSTRAR DETALLE CITA (Manicurista)
// =============================================
window.mostrarDetalleCita = function (cita) {
    const horaInicio = cita.hora_inicio.substring(0, 5);
    const horaFin = cita.hora_fin.substring(0, 5);

    // Notas de la cita (el nombre del cliente no se muestra por políticas de privacidad)
    const notas = cita.notas_cliente || 'Sin notas';

    // Generar botones de acción según estado
    let botonesHtml = '';

    // Solo permitir acciones si no es pasado (opcional, pero buena UX)
    // Dejamos flexible por ahora.

    if (cita.estado === 'pendiente') {
        botonesHtml = `
            <button onclick="actualizarEstadoCita(${cita.id_cita}, 'confirmada')" class="swal2-confirm swal2-styled" style="background-color: #17a2b8;">Confirmar</button>
            <button onclick="actualizarEstadoCita(${cita.id_cita}, 'cancelada')" class="swal2-cancel swal2-styled" style="background-color: #dc3545;">Cancelar</button>
        `;
    } else if (cita.estado === 'confirmada') {
        botonesHtml = `
            <button onclick="actualizarEstadoCita(${cita.id_cita}, 'completada')" class="swal2-confirm swal2-styled" style="background-color: #28a745;">Completar</button>
            <button onclick="actualizarEstadoCita(${cita.id_cita}, 'cancelada')" class="swal2-cancel swal2-styled" style="background-color: #dc3545;">Cancelar</button>
        `;
    }

    Swal.fire({
        title: `Detalle de Cita`,
        html: `
            <div style="text-align: left; margin-bottom: 1em;">
                <p><strong>Hora:</strong> ${horaInicio} - ${horaFin}</p>
                <p><strong>Servicio:</strong> ${cita.nombre_servicio}</p>
                <p><strong>Notas:</strong> ${notas}</p>
                <p><strong>Estado:</strong> <span class="badge badge-${cita.estado}">${cita.estado.toUpperCase()}</span></p>
            </div>
            <div style="display: flex; gap: 10px; justify-content: center;">
                ${botonesHtml}
                <button onclick="Swal.close()" class="swal2-deny swal2-styled" style="background-color: #6c757d;">Cerrar</button>
            </div>
        `,
        showConfirmButton: false
    });
}

// Helper para actualizar estado
window.actualizarEstadoCita = async function (idCita, nuevoEstado) {
    try {
        const token = localStorage.getItem('token');
        // ENVIAMOS SOLO EL ESTADO. 
        // El backend mantendra el nombre_cliente existente (porque no enviamos ese campo).
        const response = await fetch(`/api/citas/${idCita}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ estado: nuevoEstado })
        });

        const data = await response.json();

        if (data.success) {
            Swal.close();
            mostrarModal(`Cita ${nuevoEstado} correctamente`, 'success');
            // Recargar datos
            if (typeof cargarAgenda === 'function') {
                cargarAgenda();
            }
        } else {
            mostrarModal(data.message || 'Error al actualizar', 'error');
        }
    } catch (error) {
        console.error(error);
        mostrarModal('Error de conexión', 'error');
    }
}
