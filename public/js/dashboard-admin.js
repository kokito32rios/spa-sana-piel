// Variables globales
let token = localStorage.getItem('token');
let usuarioActual = null;

// Inicializar Socket.IO de forma segura
let socket;
if (typeof io !== 'undefined') {
    socket = io();
} else {
    console.error('Socket.IO no cargado correctamente');
}

// =============================================
// VERIFICAR AUTENTICACIÓN
// =============================================
if (!token) {
    window.location.href = '/login.html';
}

try {
    const payload = JSON.parse(atob(token.split('.')[1]));

    // Verificar expiración
    if (payload.exp * 1000 < Date.now()) {
        localStorage.removeItem('token');
        window.location.href = '/login.html';
    }

    // Verificar que sea admin
    if (payload.nombre_rol !== 'admin') {
        window.location.href = `/dashboard-${payload.nombre_rol}.html`;
    }

    usuarioActual = payload;

    // Mostrar bienvenida
    document.getElementById('user-welcome').textContent =
        `Bienvenid@ ${payload.nombre} ${payload.apellido}`;

} catch (e) {
    localStorage.removeItem('token');
    window.location.href = '/login.html';
}

// =============================================
// HELPER: FETCH CON TOKEN
// =============================================
async function fetchConToken(url, options = {}) {
    // ... (sin cambios)
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
    };

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login.html';
        return;
    }

    return response;
}

// =============================================
// HELPERS UI: SWEETALERT2
// =============================================
function mostrarModal(mensaje, tipo = 'info') {
    let icon = tipo;
    if (tipo === 'error') icon = 'error';
    if (tipo === 'success') icon = 'success';
    if (tipo === 'warning') icon = 'warning';

    Swal.fire({
        title: tipo === 'error' ? 'Error' : (tipo === 'success' ? '¡Éxito!' : 'Información'),
        html: mensaje,
        icon: icon,
        confirmButtonColor: '#e91e63'
    });
}

// Helper compatible con llamadas existentes (tipo, emoji, titulo, mensaje)
function mostrarMensaje(tipo, emoji, titulo, mensaje) {
    Swal.fire({
        icon: tipo, // success, error, warning, info
        title: titulo,
        html: mensaje,
        confirmButtonColor: '#3085d6'
    });
}

function confirmarAccion(titulo, texto, callback) {
    Swal.fire({
        title: titulo || '¿Estás seguro?',
        text: texto || "No podrás revertir esta acción",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, confirmar',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            callback();
        }
    });
}

// =============================================
// HELPER: FORMATEAR FECHA SIN TIMEZONE
// =============================================
function formatearFechaSinTZ(fechaString) {
    // Si la fecha viene como "2026-01-29", evitar conversión de timezone
    const fecha = new Date(fechaString + 'T00:00:00');
    const opciones = { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Bogota' };
    return fecha.toLocaleDateString('es-CO', opciones);
}

// =============================================
// CAMBIAR SECCIÓN
// =============================================
function cambiarSeccion(seccion) {
    // Ocultar todas las secciones
    document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));

    // Desactivar items del menú
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));


    // Lógica especial para 'conciliacion' (es un sub-view de comisiones)
    if (seccion === 'conciliacion') {
        window.modoAuditoria = true; // Activar flag global

        document.getElementById('seccion-comisiones').classList.add('active');
        // Activar item de menú correcto
        const navItem = document.querySelector(`.nav-item[href="#conciliacion"]`);
        if (navItem) navItem.classList.add('active');

        // Cambiar título y vista interna
        document.getElementById('section-title').textContent = 'Auditoría de Cuadres';
        cambiarVistaComisiones('conciliacion');

        // Mostrar selector de tipo filtro (Usuario quiere usar rangos)
        const contenedorFiltro = document.getElementById('container-filtro-tipo');
        if (contenedorFiltro) contenedorFiltro.style.display = 'block';

        // Mostrar botones header adecuados (ninguno extra)
    }
    else {
        window.modoAuditoria = false; // Desactivar flag

        // Mostrar sección seleccionada
        const seccionActiva = document.getElementById(`seccion-${seccion}`);
        if (seccionActiva) {
            seccionActiva.classList.add('active');
        }

        // Activar item del menú
        const navItem = document.querySelector(`.nav-item[href="#${seccion}"]`);
        if (navItem) navItem.classList.add('active');

        // Si vamos a comisiones normal, asegurarnos de resetear la vista a default
        if (seccion === 'comisiones') {
            cambiarVistaComisiones('comisiones');
            // MOSTRAR selector de tipo filtro
            const contenedorFiltro = document.getElementById('container-filtro-tipo');
            if (contenedorFiltro) contenedorFiltro.style.display = 'block';
        }
    }

    // Actualizar título y botones de acción
    const titulos = {
        'dashboard': 'Panel de Control',
        'agendamiento': 'Gestión de Agendamiento',
        'agenda': 'Agenda - Calendario',
        'servicios': 'Gestión de Servicios',
        'usuarios': 'Gestión de Usuarios',
        'comisiones': 'Gestión de Comisiones',
        'conciliacion': 'Auditoría de Cuadres',
        'horarios': 'Gestión de Horarios',
        'galeria': 'Gestión de Galería',
        'gastos': 'Gestión de Gastos'
    };
    if (titulos[seccion]) {
        document.getElementById('section-title').textContent = titulos[seccion];
    }

    // Mostrar/Ocultar botones de acción según la sección
    // Resetear visibilidad de todos
    const btns = ['btn-nueva-cita', 'btn-nuevo-usuario', 'btn-nuevo-servicio', 'btn-subir-imagen', 'btn-nuevo-gasto'];
    btns.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.classList.add('hidden');
    });

    // Mostrar el contenedor header-actions siempre (o ocultar si no hay botones, pero lo dejaremos visible)
    const headerActions = document.querySelector('.header-actions');
    if (headerActions) headerActions.style.display = 'flex';

    // Activar botón específico
    if (seccion === 'agendamiento' || seccion === 'agenda') {
        document.getElementById('btn-nueva-cita').classList.remove('hidden');
    } else if (seccion === 'usuarios') {
        document.getElementById('btn-nuevo-usuario')?.classList.remove('hidden');
    } else if (seccion === 'servicios') {
        document.getElementById('btn-nuevo-servicio')?.classList.remove('hidden');
    } else if (seccion === 'galeria') {
        document.getElementById('btn-subir-imagen')?.classList.remove('hidden');
        cargarGaleria();
    } else if (seccion === 'gastos') {
        document.getElementById('btn-nuevo-gasto')?.classList.remove('hidden');
        cargarGastos();
    }

    // Cargar datos según sección
    if (seccion === 'agendamiento') {
        inicializarAgendamiento();
    } else if (seccion === 'agenda') {
        inicializarAgenda();
    } else if (seccion === 'horarios') {
        inicializarHorarios();
    } else if (seccion === 'servicios') {
        inicializarServicios();
    } else if (seccion === 'usuarios') {
        inicializarUsuarios();
    } else if (seccion === 'comisiones') {
        inicializarComisiones();
    } else if (seccion === 'dashboard') {
        cargarManicuristasFiltro();
        cargarDashboard();
    }
}

// =============================================
// CARGAR CITAS
// =============================================
async function cargarCitas() {
    const loader = document.getElementById('citas-loader');
    const tabla = document.getElementById('tabla-citas');
    const vacio = document.getElementById('citas-vacio');
    const tbody = document.getElementById('citas-tbody');

    loader.classList.remove('hidden');
    tabla.classList.add('hidden');
    vacio.classList.add('hidden');

    try {
        // Construir query params
        const params = new URLSearchParams();

        // Nueva Lógica de Filtros
        const { fechaInicio, fechaFin, periodo } = obtenerFechasAgendamiento();

        if (periodo === 'dia') {
            if (fechaInicio) params.append('fecha', fechaInicio);
        } else {
            if (fechaInicio) params.append('fecha_inicio', fechaInicio);
            if (fechaFin) params.append('fecha_fin', fechaFin);
        }

        const estado = document.getElementById('filtro-estado').value;
        const manicurista = document.getElementById('filtro-manicurista').value;

        if (estado) params.append('estado', estado);
        if (manicurista) params.append('manicurista', manicurista);

        const response = await fetchConToken(`/api/citas?${params}`);
        const data = await response.json();

        loader.classList.add('hidden');

        if (data.success && data.citas.length > 0) {
            renderizarCitas(data.citas);
            tabla.classList.remove('hidden');
        } else {
            vacio.classList.remove('hidden');
        }

    } catch (error) {
        console.error('Error:', error);
        loader.classList.add('hidden');
        mostrarMensaje('error', '❌', 'Error', 'No se pudieron cargar las citas');
    }
}

// =============================================
// RENDERIZAR CITAS
// =============================================
function renderizarCitas(citas) {
    const tbody = document.getElementById('citas-tbody');

    tbody.innerHTML = citas.map(cita => {
        const estadoBadge = `badge-${cita.estado}`;

        // Formatear monto
        const monto = cita.monto_pagado ? `$${Number(cita.monto_pagado).toLocaleString('es-CO')}` : '-';

        // Formatear método de pago con warning si falta
        let metodoPago = '-';
        if (cita.estado === 'completada') {
            if (cita.metodo_pago) {
                metodoPago = cita.metodo_pago === 'efectivo' ? '💵 Efectivo' : '📲 Transferencia';
            } else {
                metodoPago = '<span class="badge badge-danger" title="Sin método de pago">⚠️ Sin método</span>';
            }
        }

        return `
            <tr>
                <td>${formatearFecha(cita.fecha)}</td>
                <td>${formatearHora(cita.hora_inicio)} - ${formatearHora(cita.hora_fin)}</td>
                <td>
                    <strong>${cita.nombre_cliente}</strong>
                </td>
                <td>
                    ${cita.telefono_contacto || cita.telefono_cliente || '<span class="text-muted">-</span>'}
                </td>
                <td>${cita.nombre_manicurista}</td>
                <td><span class="badge ${estadoBadge}">${capitalize(cita.estado)}</span></td>
                <td>${monto}</td>
                <td>${metodoPago}</td>
                <td>
                    <div class="table-actions">
                        <button class="btn-icon btn-edit" onclick="editarCita(${cita.id_cita})" title="Editar">
                            ✏️
                        </button>
                        ${cita.estado !== 'cancelada' ? `
                            <button class="btn-icon btn-warning" onclick="confirmarCancelar(${cita.id_cita})" title="Cancelar cita">
                                ⚠️
                            </button>
                        ` : ''}
                        <button class="btn-icon btn-delete" onclick="confirmarEliminar(${cita.id_cita})" title="Eliminar permanentemente">
                            🗑️
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// =============================================
// ABRIR MODAL NUEVA CITA
// =============================================
async function abrirModalNuevaCita() {
    document.getElementById('modal-cita-titulo').textContent = 'Nueva Cita';
    document.getElementById('form-cita').reset();
    document.getElementById('cita-id').value = '';
    document.getElementById('cita-estado').value = 'pendiente';

    // Ocultar método de pago (solo visible cuando estado = completada)
    const grupoMetodoPago = document.getElementById('grupo-metodo-pago');
    if (grupoMetodoPago) grupoMetodoPago.style.display = 'none';
    const citaMetodoPago = document.getElementById('cita-metodo-pago');
    if (citaMetodoPago) citaMetodoPago.value = '';

    // Deshabilitar botón guardar hasta que se seleccione horario
    document.getElementById('btn-guardar-cita').disabled = true;

    // Cargar datos
    await cargarClientes();
    await cargarManicuristas();
    await cargarServiciosSelect();

    // Establecer fecha mínima (hoy) -> REMOVIDO PARA ADMIN (Permitir fechas pasadas)
    // const hoy = new Date().toISOString().split('T')[0];
    // document.getElementById('cita-fecha').min = hoy;

    // Mostrar modal
    const modal = document.getElementById('modal-cita');
    modal.classList.remove('hidden');

    // Scroll al top del modal
    setTimeout(() => {
        modal.scrollTop = 0;
    }, 100);
}

// =============================================
// TOGGLE MÉTODO DE PAGO (visible solo si estado = completada)
// =============================================
function toggleMetodoPago() {
    const estado = document.getElementById('cita-estado').value;
    const grupo = document.getElementById('grupo-metodo-pago');

    if (estado === 'completada') {
        grupo.style.display = 'block';
        // Inicializar con una fila de pago si está vacío
        const container = document.getElementById('pagos-container');
        if (container.children.length === 0) {
            agregarFilaPago();
        }
        actualizarResumenPagos();
    } else {
        grupo.style.display = 'none';
        // Limpiar pagos al cambiar de estado
        document.getElementById('pagos-container').innerHTML = '';
    }
}

// =============================================
// AGREGAR FILA DE PAGO
// =============================================
// =============================================
// TOGGLE PAGO MIXTO
// =============================================
function togglePagoMixto() {
    const isChecked = document.getElementById('check-pago-mixto').checked;
    const btnAgregar = document.getElementById('btn-agregar-pago');
    const container = document.getElementById('pagos-container');

    // Mostrar/Ocultar botón de agregar
    if (btnAgregar) btnAgregar.style.display = isChecked ? 'block' : 'none';

    // Mostrar/Ocultar inputs de monto en las filas existentes
    const montosInputs = container.querySelectorAll('.pago-monto');
    const precioCita = parseFloat(document.getElementById('cita-precio').value) || 0;

    montosInputs.forEach(input => {
        if (isChecked) {
            // Modo mixto: mostrar input de monto
            input.style.display = 'block';
        } else {
            // Modo simple: ocultar input y auto-llenar con precio
            input.style.display = 'none';
            input.value = precioCita;
        }
    });

    // Si se desactiva, dejar solo la primera fila
    if (!isChecked && container.children.length > 1) {
        while (container.children.length > 1) {
            container.lastChild.remove();
        }
    }

    actualizarResumenPagos();
}

// =============================================
// AGREGAR FILA DE PAGO
// =============================================
function agregarFilaPago(pagoData = null) {
    const container = document.getElementById('pagos-container');
    const index = container.children.length;

    // Si NO es mixto y ya hay 1 fila, no permitir agregar manual (salvo carga inicial)
    const checkMixto = document.getElementById('check-pago-mixto');
    const isMixto = checkMixto ? checkMixto.checked : false;

    if (!isMixto && index >= 1 && !pagoData) {
        return;
    }

    const row = document.createElement('div');
    row.className = 'pago-row';
    row.style.cssText = 'background: #ffffff; padding: 1rem; border-radius: 8px; border: 1px solid #e9ecef; margin-bottom: 0.8rem; box-shadow: 0 2px 4px rgba(0,0,0,0.05);';

    const metodo = pagoData ? pagoData.metodo : '';
    const precioCita = parseFloat(document.getElementById('cita-precio').value) || 0;
    // Si es modo simple (no mixto) y no hay pagoData, usar el precio de la cita
    const monto = pagoData ? pagoData.monto : (isMixto ? '' : precioCita);
    const notas = pagoData ? pagoData.notas || '' : '';

    // En modo simple, ocultar el input de monto
    const montoDisplay = isMixto ? 'block' : 'none';

    row.innerHTML = `
        <div style="display: flex; gap: 0.8rem; margin-bottom: 0.8rem; flex-wrap: wrap;">
            <select class="form-input pago-metodo" style="flex: 2; min-width: 160px;" required>
                <option value="">Método de pago...</option>
                <option value="efectivo" ${metodo === 'efectivo' ? 'selected' : ''}>💵 Efectivo</option>
                <option value="transferencia" ${metodo === 'transferencia' ? 'selected' : ''}>📲 Transferencia</option>
            </select>
            <input type="number" class="form-input pago-monto" placeholder="Monto $" style="flex: 1; min-width: 120px; display: ${montoDisplay};" min="0" step="100" value="${monto}" oninput="actualizarResumenPagos()" required>
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
            <input type="text" class="form-input pago-notas" placeholder="Notas adicionales (opcional)..." style="flex: 1;" value="${notas}">
            <button type="button" class="btn btn-icon btn-eliminar-pago" style="color: #dc3545; background: #fff; border: 1px solid #dc3545; border-radius: 4px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer;" onclick="eliminarFilaPago(this)" title="Eliminar pago">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
    `;
    container.appendChild(row);

    actualizarBotonesEliminar();
}

function actualizarBotonesEliminar() {
    const container = document.getElementById('pagos-container');
    const botones = container.querySelectorAll('.btn-eliminar-pago');
    // Mostrar eliminar solo si hay más de 1 fila 
    const mostrar = container.children.length > 1;
    botones.forEach(btn => btn.style.display = mostrar ? 'block' : 'none');
}

// =============================================
// ELIMINAR FILA DE PAGO
// =============================================
function eliminarFilaPago(btn) {
    btn.closest('.pago-row').remove();
    actualizarResumenPagos();
    actualizarBotonesEliminar();
}

// =============================================
// ACTUALIZAR RESUMEN DE PAGOS
// =============================================
function actualizarResumenPagos() {
    const precioCita = parseFloat(document.getElementById('cita-precio').value) || 0;
    const checkMixto = document.getElementById('check-pago-mixto');
    const isMixto = checkMixto ? checkMixto.checked : false;
    const montos = document.querySelectorAll('.pago-monto');

    // En modo simple, sincronizar el monto oculto con el precio de la cita
    if (!isMixto && montos.length === 1) {
        montos[0].value = precioCita;
    }

    let totalPagado = 0;
    montos.forEach(input => {
        totalPagado += parseFloat(input.value) || 0;
    });

    const restante = precioCita - totalPagado;

    document.getElementById('pagos-total-cita').textContent = '$' + precioCita.toLocaleString('es-CO');
    document.getElementById('pagos-total-pagado').textContent = '$' + totalPagado.toLocaleString('es-CO');
    document.getElementById('pagos-restante').textContent = '$' + restante.toLocaleString('es-CO');

    // Cambiar color del restante
    const restanteEl = document.getElementById('pagos-restante');
    if (Math.abs(restante) < 1) {
        restanteEl.style.color = '#28a745'; // Verde si está completo
    } else if (restante < 0) {
        restanteEl.style.color = '#dc3545'; // Rojo si hay exceso
    } else {
        restanteEl.style.color = '#dc3545'; // Rojo si falta
    }
}

// =============================================
// CARGAR CLIENTES
// =============================================
let listaClientes = []; // Global variable

async function cargarClientes() {
    try {
        const response = await fetchConToken('/api/citas/helpers/clientes');
        const data = await response.json();

        listaClientes = data.clientes || []; // Guardar globalmente

        const dataList = document.getElementById('lista-clientes');
        dataList.innerHTML = listaClientes.map(c =>
            `<option value="${c.nombre_completo}"></option>`
        ).join('');

    } catch (error) {
        console.error('Error:', error);
    }
}

let listaManicuristas = [];

// =============================================
// CARGAR MANICURISTAS
// =============================================
async function cargarManicuristas() {
    try {
        const response = await fetchConToken('/api/citas/helpers/manicuristas');
        const data = await response.json();

        listaManicuristas = data.manicuristas || []; // Guardar globalmente

        const select = document.getElementById('cita-manicurista');
        const selectFiltro = document.getElementById('filtro-manicurista');

        // Preservar selección actual del filtro antes de repoblar
        const filtroSeleccionActual = selectFiltro ? selectFiltro.value : '';

        const options = listaManicuristas.map(m =>
            `<option value="${m.email}">${m.nombre_completo}</option>`
        ).join('');

        if (select) select.innerHTML = '<option value="">Seleccionar manicurista</option>' + options;
        if (selectFiltro) {
            selectFiltro.innerHTML = '<option value="">Todas</option>' + options;
            // Restaurar selección previa
            if (filtroSeleccionActual) {
                selectFiltro.value = filtroSeleccionActual;
            }
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

// =============================================
// CARGAR SERVICIOS SELECT
// =============================================
async function cargarServiciosSelect() {
    try {
        const response = await fetchConToken('/api/servicios');
        const data = await response.json();

        const select = document.getElementById('cita-servicio');
        select.innerHTML = '<option value="">Seleccionar servicio</option>' +
            data.servicios.map(s =>
                `<option value="${s.id_servicio}" data-duracion="${s.duracion_minutos}" data-precio="${s.precio}">${s.nombre}</option>`
            ).join('');

        // Event listener para actualizar duración y precio al cambiar servicio
        select.onchange = function () {
            const selected = this.options[this.selectedIndex];
            if (selected.value) {
                document.getElementById('cita-duracion').value = selected.dataset.duracion;
                document.getElementById('cita-precio').value = selected.dataset.precio;
            } else {
                document.getElementById('cita-duracion').value = '';
                document.getElementById('cita-precio').value = '';
            }
        };

    } catch (error) {
        console.error('Error:', error);
    }
}

// =============================================
// GUARDAR CITA
// =============================================
async function guardarCita() {
    const form = document.getElementById('form-cita');

    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const id = document.getElementById('cita-id').value;
    const selectHora = document.getElementById('cita-hora');
    const hora = selectHora.value;

    // Validación adicional: verificar que se haya seleccionado un horario válido
    if (!hora || hora === '') {
        mostrarMensaje('warning', '⚠️', 'Horario requerido', 'Por favor selecciona un horario disponible');
        selectHora.focus();
        return;
    }

    // Verificar que el select no esté deshabilitado (no hay horarios disponibles)
    if (selectHora.disabled) {
        mostrarMensaje('warning', '⚠️', 'Sin horarios disponibles', 'No hay horarios disponibles para la fecha y manicurista seleccionadas');
        return;
    }

    // Validación de campos obligatorios
    const manicuVal = document.getElementById('cita-manicurista').value;
    const servVal = document.getElementById('cita-servicio').value;
    if (!manicuVal || !servVal) {
        mostrarMensaje('warning', '⚠️', 'Faltan datos', 'Por favor selecciona manicurista y servicio');
        return;
    }

    // Validar estado para cancelación
    const estadoInput = document.getElementById('cita-estado');
    const esCancelacion = estadoInput && estadoInput.value === 'cancelada';

    // Resolver cliente desde el input de búsqueda
    // NOTA: El cliente ahora es opcional. Si no se encuentra, se envía null/vacío.
    const nombreCliente = document.getElementById('cita-cliente-search').value;
    const clienteEncontrado = listaClientes.find(c => c.nombre_completo === nombreCliente);

    // Si se escribió algo pero no coincide con la lista, advertir pero permitir (opcional)
    // O mejor: Si el usuario quiere guardar sin cliente, permitimos.
    // Solo mostramos alerta si escribió un nombre que NO existe, para evitar typos.
    // Pero el usuario dijo "es opcional".
    // Así que si está vacío, pasa. Si tiene texto pero no match, ¿qué hacemos? 
    // Asumiremos que si escribe algo y no está en la lista, es un "cliente no registrado" o error.
    // Pero como no podemos guardar "nombre" sin email en la BD actual (probablemente), 
    // solo permitiremos vacío o cliente válido.

    // Si se escribió algo pero no coincide con la lista, no bloqueamos.
    // Lo tratamos como "Cliente Invitado" y lo guardamos en las notas.

    let emailFinal = clienteEncontrado ? clienteEncontrado.email : null;
    let nombreFinal = clienteEncontrado ? clienteEncontrado.nombre_completo : nombreCliente;
    let notasRaw = document.getElementById('cita-notas-cliente').value || '';

    // Si no hay email ni nombre, es anónimo
    if (!emailFinal && !nombreFinal) {
        nombreFinal = 'Cliente Anónimo';
    }


    const datos = {
        email_cliente: emailFinal, // null si es invitado
        nombre_cliente: nombreFinal, // Nuevo campo para guardar el nombre real/manual
        telefono_contacto: document.getElementById('cita-telefono').value,
        email_manicurista: document.getElementById('cita-manicurista').value,
        id_servicio: document.getElementById('cita-servicio').value,
        duracion: document.getElementById('cita-duracion').value,
        precio: document.getElementById('cita-precio').value,
        fecha: document.getElementById('cita-fecha').value,
        hora_inicio: hora + ':00',
        notas_cliente: notasRaw,
        estado: document.getElementById('cita-estado').value // Enviar estado siempre
    };

    // Si es edición, agregar notas de manicurista
    if (id) {
        datos.notas_manicurista = document.getElementById('cita-notas-manicurista').value;
    }

    // Si estado = completada, requerir y recolectar pagos múltiples (aplica tanto a nueva como edición)
    // Recolectar pagos (si existen filas o si el estado es completada)
    const pagosRows = document.querySelectorAll('.pago-row');
    const pagosArray = [];

    // Si hay filas de pago visibles, procesarlas
    if (pagosRows.length > 0) {
        for (const row of pagosRows) {
            const metodo = row.querySelector('.pago-metodo').value;
            const monto = parseFloat(row.querySelector('.pago-monto').value) || 0;
            const notas = row.querySelector('.pago-notas').value || null;

            // Validar filas activas: si el usuario agregó una fila, debe estar completa
            if (!metodo) {
                mostrarMensaje('warning', '⚠️', 'Método de pago requerido', 'Seleccione un método de pago para cada fila agregada');
                return;
            }
            if (monto <= 0) {
                mostrarMensaje('warning', '⚠️', 'Monto inválido', 'Ingrese un monto válido para cada pago');
                return;
            }

            pagosArray.push({ metodo, monto, notas });
        }
    }

    // Validación específica para estado COMPLETADA: Debe haber al menos un pago
    if (datos.estado === 'completada') {
        if (pagosArray.length === 0) {
            mostrarMensaje('warning', '⚠️', 'Pago requerido', 'Para marcar como completada, debe registrar el pago total.');
            return;
        }
        // Opcional: Validar que cubra el total, pero por ahora solo requerimos que haya pago.
    }

    // Asignar array de pagos al objeto datos (si hay pagos)
    if (pagosArray.length > 0) {
        datos.pagos = pagosArray;
    }

    const btn = document.getElementById('btn-guardar-cita');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
        const url = id ? `/api/citas/${id}` : '/api/citas';
        const method = id ? 'PUT' : 'POST';

        const response = await fetchConToken(url, {
            method,
            body: JSON.stringify(datos)
        });

        const data = await response.json();

        if (data.success) {
            // Capturar datos para el resumen ANTES de cerrar/resetear
            const resumenCliente = nombreCliente || 'Anónimo';
            const resumenManicurista = document.getElementById('cita-manicurista').options[document.getElementById('cita-manicurista').selectedIndex].text;
            const resumenServicio = document.getElementById('cita-servicio').options[document.getElementById('cita-servicio').selectedIndex].text;
            const resumenFecha = document.getElementById('cita-fecha').value;
            const resumenHora = selectHora.value;
            const resumenDuracion = document.getElementById('cita-duracion').value;

            cerrarModalCita();

            const mensajeDetalle = `
                <div style="text-align: left; margin-top: 10px;">
                    <p><strong>Cliente:</strong> ${resumenCliente}</p>
                    <p><strong>Manicurista:</strong> ${resumenManicurista}</p>
                    <p><strong>Servicio:</strong> ${resumenServicio}</p>
                    <p><strong>Fecha:</strong> ${resumenFecha} - <strong>Hora:</strong> ${resumenHora}</p>
                    <p><strong>Duración:</strong> ${resumenDuracion} min</p>
                </div>
            `;

            mostrarMensaje('success', '✓', 'Cita Guardada', mensajeDetalle);
            // Recargar la vista activa (ambas funciones preservan sus filtros)
            const seccionActiva = document.querySelector('.content-section.active')?.id;
            if (seccionActiva === 'seccion-agenda') {
                cargarAgenda();
            } else {
                cargarCitas();
            }
        } else {
            if (data.tipo === 'solapamiento') {
                mostrarMensaje('warning', '⚠️', 'Conflicto de horario', data.message);
            } else {
                mostrarMensaje('error', '❌', 'Error', data.message);
            }
        }

    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('error', '❌', 'Error', 'No se pudo guardar la cita');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Guardar Cita';
    }
}

// =============================================
// CERRAR MODAL CITA
// =============================================
function cerrarModalCita() {
    document.getElementById('modal-cita').classList.add('hidden');
}

// =============================================
// APLICAR FILTROS
// =============================================
function aplicarFiltros() {
    cargarCitas();
}

// =============================================
// LIMPIAR FILTROS
// =============================================
function limpiarFiltros() {
    document.getElementById('filtro-fecha').value = '';
    document.getElementById('filtro-estado').value = '';
    document.getElementById('filtro-manicurista').value = '';
    cargarCitas();
}

// =============================================
// HELPER: AGENDAMIENTO SEARCH LOGIC
// =============================================
function inicializarAgendamiento() {
    const selectAnio = document.getElementById('agendamiento-filtro-anio');
    if (selectAnio && selectAnio.options.length === 0) {
        const currentYear = new Date().getFullYear();
        selectAnio.innerHTML = '';
        selectAnio.innerHTML += `<option value="${currentYear}">${currentYear}</option>`;
        selectAnio.innerHTML += `<option value="${currentYear - 1}">${currentYear - 1}</option>`;
        selectAnio.value = currentYear;
    }

    // Set default date if empty
    if (!document.getElementById('filtro-fecha').value) {
        document.getElementById('filtro-fecha').value = new Date().toISOString().split('T')[0];
    }

    cambiarPeriodoAgendamiento();
    cargarCitas();
}

function cambiarPeriodoAgendamiento() {
    const periodo = document.getElementById('agendamiento-filtro-periodo').value;

    document.getElementById('agendamiento-grupo-dia').style.display = 'none';
    document.getElementById('agendamiento-grupo-mes').style.display = 'none';
    document.getElementById('agendamiento-grupo-semana').style.display = 'none';
    document.getElementById('agendamiento-grupo-anio').style.display = 'none';
    document.getElementById('agendamiento-grupo-rango').style.display = 'none';

    if (periodo === 'dia') {
        document.getElementById('agendamiento-grupo-dia').style.display = 'block';
    } else if (periodo === 'mes') {
        document.getElementById('agendamiento-grupo-mes').style.display = 'block';
        document.getElementById('agendamiento-grupo-anio').style.display = 'block';
    } else if (periodo === 'semana') {
        document.getElementById('agendamiento-grupo-semana').style.display = 'block';
        document.getElementById('agendamiento-grupo-anio').style.display = 'block';
        poblarSemanasAgendamiento();
    } else if (periodo === 'rango') {
        document.getElementById('agendamiento-grupo-rango').style.display = 'block';
    }
}

function poblarSemanasAgendamiento() {
    const selectSemana = document.getElementById('agendamiento-filtro-semana');
    const anio = document.getElementById('agendamiento-filtro-anio').value || new Date().getFullYear();

    selectSemana.innerHTML = '';

    const primerDia = new Date(anio, 0, 1);
    const ultimoDia = new Date(anio, 11, 31);

    let semanaActual = new Date(primerDia);
    const diaSemana = semanaActual.getDay();
    const diff = diaSemana === 0 ? -6 : 1 - diaSemana;
    semanaActual.setDate(semanaActual.getDate() + diff);

    let numSemana = 1;

    while (semanaActual <= ultimoDia) {
        const finSemana = new Date(semanaActual);
        finSemana.setDate(finSemana.getDate() + 6);

        const desde = semanaActual.toISOString().split('T')[0];
        const hasta = finSemana.toISOString().split('T')[0];

        const option = document.createElement('option');
        option.value = `${desde}|${hasta}`;
        option.textContent = `Semana ${numSemana}: ${formatearFechaCorta(semanaActual)} - ${formatearFechaCorta(finSemana)}`;
        selectSemana.appendChild(option);

        semanaActual.setDate(semanaActual.getDate() + 7);
        numSemana++;
    }

    // Select current week if applicable
    const hoy = new Date();
    const opciones = selectSemana.options;
    for (let i = 0; i < opciones.length; i++) {
        const [desde, hasta] = opciones[i].value.split('|');
        if (hoy >= new Date(desde) && hoy <= new Date(hasta)) {
            selectSemana.selectedIndex = i;
            break;
        }
    }
}

function obtenerFechasAgendamiento() {
    const periodo = document.getElementById('agendamiento-filtro-periodo').value;
    let fechaInicio, fechaFin;

    if (periodo === 'dia') {
        fechaInicio = document.getElementById('filtro-fecha').value;
        fechaFin = null; // Single date logic
    } else if (periodo === 'mes') {
        const mes = document.getElementById('agendamiento-filtro-mes').value;
        const anio = document.getElementById('agendamiento-filtro-anio').value;
        const ultimoDia = new Date(anio, mes, 0).getDate();
        fechaInicio = `${anio}-${mes.toString().padStart(2, '0')}-01`;
        fechaFin = `${anio}-${mes.toString().padStart(2, '0')}-${ultimoDia}`;
    } else if (periodo === 'semana') {
        const val = document.getElementById('agendamiento-filtro-semana').value;
        if (val) [fechaInicio, fechaFin] = val.split('|');
    } else if (periodo === 'rango') {
        fechaInicio = document.getElementById('agendamiento-fecha-inicio').value;
        fechaFin = document.getElementById('agendamiento-fecha-fin').value;
    }

    return { fechaInicio, fechaFin, periodo };
}

// =============================================
// MOSTRAR MENSAJE
// =============================================
// =============================================
// MOSTRAR MENSAJE (Adaptado a SweetAlert2)
// =============================================
function mostrarMensaje(tipo, icono, titulo, mensaje) {
    // Redirigir a nuestro helper de SweetAlert
    // "icono" se ignora porque SweetAlert usa sus propios iconos basados en el tipo
    mostrarModal(mensaje, tipo);
}

function cerrarModalMensaje() {
    const modal = document.getElementById('modal-mensaje');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// =============================================
// EDITAR CITA
// =============================================
async function editarCita(idCita) {
    try {
        // Obtener datos de la cita (Forzando no-cache para asegurar nombre manual reciente)
        const response = await fetchConToken(`/api/citas?_t=${Date.now()}`);
        const data = await response.json();

        const cita = data.citas.find(c => c.id_cita === idCita);

        if (!cita) {
            mostrarMensaje('error', '❌', 'Error', 'Cita no encontrada');
            return;
        }

        // Cargar selects
        await cargarClientes();
        await cargarManicuristas();
        await cargarServiciosSelect();

        // Llenar formulario
        document.getElementById('modal-cita-titulo').textContent = 'Editar Cita';
        document.getElementById('cita-id').value = cita.id_cita;

        // Permitir fechas pasadas en edición
        document.getElementById('cita-fecha').removeAttribute('min');
        document.getElementById('cita-cliente-search').value = cita.nombre_cliente;
        document.getElementById('cita-cliente').value = cita.email_cliente;
        document.getElementById('cita-telefono').value = cita.telefono_contacto || ''; // Poblar teléfono
        document.getElementById('cita-manicurista').value = cita.email_manicurista;
        document.getElementById('cita-servicio').value = cita.id_servicio;

        // Formatear fecha correctamente para input type="date" (YYYY-MM-DD)
        const fechaFormateada = cita.fecha.split('T')[0];
        document.getElementById('cita-fecha').value = fechaFormateada;

        const horaActual = cita.hora_inicio.substring(0, 5);

        // Calcular duración actual
        const inicioDate = new Date(`2000-01-01T${cita.hora_inicio}`);
        const finDate = new Date(`2000-01-01T${cita.hora_fin}`);
        const diffMs = finDate - inicioDate;
        const diffMins = Math.round(diffMs / 60000);
        document.getElementById('cita-duracion').value = diffMins;
        document.getElementById('cita-precio').value = cita.precio || ''; // Poblar precio si existe

        // Cargar horarios disponibles y luego seleccionar el actual
        await cargarHorariosDisponibles();

        // Agregar la hora actual si no está en la lista
        const selectHora = document.getElementById('cita-hora');
        const existeOpcion = Array.from(selectHora.options).some(opt => opt.value === horaActual);

        if (!existeOpcion && horaActual) {
            const option = document.createElement('option');
            option.value = horaActual;
            option.textContent = horaActual + ' (hora actual)';
            selectHora.appendChild(option);
        }

        document.getElementById('cita-hora').value = horaActual;
        document.getElementById('cita-estado').value = cita.estado;
        // Cargar notas
        document.getElementById('cita-notas-cliente').value = cita.notas_cliente || '';
        document.getElementById('cita-notas-manicurista').value = cita.notas_manicurista || '';

        // Limpiar contenedor de pagos
        document.getElementById('pagos-container').innerHTML = '';

        // Si el estado es completada, cargar pagos desde API
        if (cita.estado === 'completada') {
            document.getElementById('grupo-metodo-pago').style.display = 'block';

            try {
                const response = await fetchConToken(`/api/citas/${cita.id_cita}/pagos`);
                const data = await response.json();

                if (data.success && data.pagos.length > 0) {
                    // Cargar pagos existentes
                    data.pagos.forEach(pago => {
                        agregarFilaPago(pago);
                    });

                    // Activar check si hay más de 1 pago
                    const isMixto = data.pagos.length > 1;
                    const checkMixto = document.getElementById('check-pago-mixto');
                    if (checkMixto) {
                        checkMixto.checked = isMixto;
                        togglePagoMixto();
                    }

                } else {
                    // Si no hay pagos, agregar uno por defecto y resetear check
                    agregarFilaPago();
                    const checkMixto = document.getElementById('check-pago-mixto');
                    if (checkMixto) {
                        checkMixto.checked = false;
                        togglePagoMixto();
                    }
                }
                actualizarResumenPagos();
            } catch (err) {
                console.error('Error cargando pagos:', err);
                agregarFilaPago();
                const checkMixto = document.getElementById('check-pago-mixto');
                if (checkMixto) {
                    checkMixto.checked = false;
                    togglePagoMixto();
                }
            }
        } else {
            document.getElementById('grupo-metodo-pago').style.display = 'none';
        }

        // Mostrar modal
        document.getElementById('modal-cita').classList.remove('hidden');
        document.getElementById('btn-guardar-cita').disabled = false;

        // Mostrar/ocultar método de pago según estado
        toggleMetodoPago();

        // Mostrar modal
        document.getElementById('modal-cita').classList.remove('hidden');
        document.getElementById('btn-guardar-cita').disabled = false;

    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('error', '❌', 'Error', 'No se pudo cargar la cita');
    }
}

// =============================================
// CONFIRMAR CANCELAR CITA
// =============================================
function confirmarCancelar(idCita) {
    confirmarAccion(
        '¿Cancelar cita?',
        'Esta acción cambiará el estado de la cita a "cancelada". La cita permanecerá en el historial.',
        () => cancelarCita(idCita)
    );
}

// =============================================
// CONFIRMAR ELIMINAR CITA
// =============================================
function confirmarEliminar(idCita) {
    confirmarAccion(
        '¿Eliminar cita?',
        'Esta acción eliminará permanentemente la cita de la base de datos. Esta acción NO se puede deshacer.',
        () => eliminarCita(idCita)
    );
}

// (Eliminados helpers manuales de confirmación: mostrarModalConfirmacion, cerrarModalConfirmacion, ejecutarAccionConfirmada)

// =============================================
// CANCELAR CITA
// =============================================
async function cancelarCita(id) {
    const confirm = await Swal.fire({
        title: '¿Cancelar Cita?',
        text: "La cita cambiará a estado 'Cancelada'. Se liberará el horario.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, cancelar'
    });

    if (confirm.isConfirmed) {
        try {
            const response = await fetchConToken(`/api/citas/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ estado: 'cancelada' })
            });
            const data = await response.json();

            if (data.success) {
                mostrarMensaje('success', '✓', 'Cita Cancelada', 'El horario ha sido liberado');
                cerrarModalCita();
                cargarAgenda();
            } else {
                mostrarMensaje('error', '❌', 'Error', data.message);
            }
        } catch (error) {
            console.error('Error:', error);
            mostrarMensaje('error', '❌', 'Error', 'No se pudo cancelar la cita');
        }
    }
}
// =============================================
// ELIMINAR CITA (borra de la BD)
// =============================================
async function eliminarCita(idCita) {
    try {
        const response = await fetchConToken(`/api/citas/${idCita}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            mostrarMensaje('success', '✓', 'Éxito', 'Cita eliminada exitosamente');
            cargarCitas();
        } else {
            mostrarMensaje('error', '❌', 'Error', data.message);
        }

    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('error', '❌', 'Error', 'No se pudo eliminar la cita');
    }
}

// =============================================
// CERRAR SESIÓN (con confirmación)
// =============================================
function cerrarSesion() {
    confirmarAccion(
        '¿Cerrar sesión?',
        '¿Estás seguro de que deseas cerrar tu sesión?',
        () => {
            localStorage.removeItem('token');
            window.location.href = '/login.html';
        }
    );
}

// =============================================
// HELPERS
// =============================================
function formatearFecha(fecha) {
    // Asegurar que la fecha esté en formato correcto
    const [year, month, day] = fecha.split('T')[0].split('-');
    const date = new Date(year, month - 1, day);

    return date.toLocaleDateString('es-CO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

function formatearHora(hora) {
    if (!hora) return '';
    return hora.substring(0, 5);
}

function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// =============================================
// CARGAR HORARIOS DISPONIBLES
// =============================================
async function cargarHorariosDisponibles() {
    const manicurista = document.getElementById('cita-manicurista').value;
    const fecha = document.getElementById('cita-fecha').value;
    const servicio = document.getElementById('cita-servicio').value;
    const idCita = document.getElementById('cita-id').value;

    const selectHora = document.getElementById('cita-hora');
    const btnGuardar = document.getElementById('btn-guardar-cita');

    // Guardar valor actual para intentar preservarlo
    const horaPreseleccionada = selectHora.value;

    if (!manicurista || !fecha || !servicio) {
        // Si hay una hora preseleccionada (venida del calendario), mantenerla visible aunque deshabilitada
        if (horaPreseleccionada && selectHora.options.length > 0) {
            // No hacer nada, dejar la hora ahí para que el usuario sepa qué clickeó
        } else {
            selectHora.disabled = true;
            selectHora.innerHTML = '<option value="">Selecciona manicurista, servicio y fecha</option>';
            btnGuardar.disabled = true;
        }
        return;
    }

    try {
        const params = new URLSearchParams({
            manicurista,
            fecha,
            manicurista,
            fecha,
            id_servicio: servicio,
            duracion: document.getElementById('cita-duracion').value
        });

        if (idCita) {
            params.append('id_cita_excluir', idCita);
        }

        const response = await fetchConToken(`/api/citas/helpers/horarios-disponibles?${params}`);
        const data = await response.json();

        if (data.success && data.horarios.length > 0) {
            selectHora.disabled = false;
            selectHora.innerHTML = '<option value="">Seleccionar horario</option>' +
                data.horarios.map(h =>
                    `<option value="${h.hora}">${h.hora}</option>`
                ).join('');

            // Intentar re-seleccionar la hora si existe en los nuevos horarios
            if (horaPreseleccionada) {
                const existe = data.horarios.some(h => h.hora === horaPreseleccionada);
                if (existe) {
                    selectHora.value = horaPreseleccionada;
                    btnGuardar.disabled = false;
                }
            }

            // Si no hay horario seleccionado, deshabilitar botón (si NO fue habilitado arriba)
            if (!selectHora.value) {
                btnGuardar.disabled = true;
            }
        } else {
            selectHora.disabled = true;
            const mensaje = data.mensaje || 'No hay horarios disponibles';
            selectHora.innerHTML = `<option value="">${mensaje}</option>`;
            btnGuardar.disabled = true;
        }

    } catch (error) {
        console.error('Error:', error);
        selectHora.disabled = true;
        selectHora.innerHTML = '<option value="">Error al cargar horarios</option>';
        btnGuardar.disabled = true;
    }
}

// =============================================
// INICIALIZAR
// =============================================
document.addEventListener('DOMContentLoaded', () => {
    // Validar si estamos en la sección de agendamiento (aunque por defecto carga ahí)
    // O simplemente llamar al inicializador que ya maneja la carga
    inicializarAgendamiento();
    cargarManicuristas();

    // Listeners para actualizar horarios disponibles
    document.getElementById('cita-manicurista').addEventListener('change', cargarHorariosDisponibles);
    document.getElementById('cita-fecha').addEventListener('change', cargarHorariosDisponibles);
    document.getElementById('cita-duracion').addEventListener('change', cargarHorariosDisponibles);

    document.getElementById('cita-servicio').addEventListener('change', function () {
        const selectedOption = this.options[this.selectedIndex];
        const duracion = selectedOption.getAttribute('data-duracion');
        if (duracion) {
            document.getElementById('cita-duracion').value = duracion;
        }
        cargarHorariosDisponibles();
    });

    // Validar selección de horario para habilitar botón
    const selectHora = document.getElementById('cita-hora');
    if (selectHora) {
        selectHora.addEventListener('change', function () {
            const btnGuardar = document.getElementById('btn-guardar-cita');
            if (btnGuardar) btnGuardar.disabled = !this.value;
        });
    }

    // Cerrar modales con click fuera o ESC
    document.getElementById('modal-cita').addEventListener('click', (e) => {
        if (e.target.id === 'modal-cita') {
            cerrarModalCita();
        }
    });



    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            cerrarModalCita();
        }
    });
});

// =============================================
// AGENDA - VARIABLES GLOBALES
// =============================================
let agendaFechaActual = new Date();
let agendaVistaActual = 'semanal';
let agendaDatos = { citas: [], manicuristas: [], horarios_trabajo: [], excepciones: [] };
let agendaInicializada = false;

// =============================================
// INICIALIZAR AGENDA
// =============================================
async function inicializarAgenda() {
    if (!agendaInicializada) {
        await cargarManicuristasAgenda();
        agendaInicializada = true;
    }
    await cargarAgenda();
}

// =============================================
// CARGAR MANICURISTAS PARA FILTRO
// =============================================
async function cargarManicuristasAgenda() {
    try {
        const response = await fetchConToken('/api/citas/helpers/manicuristas');
        const data = await response.json();

        const select = document.getElementById('agenda-filtro-manicurista');
        select.innerHTML = '<option value="">Todas</option>' +
            data.manicuristas.map(m =>
                `<option value="${m.email}">${m.nombre_completo}</option>`
            ).join('');
    } catch (error) {
        console.error('Error cargando manicuristas:', error);
    }
}

// =============================================
// CARGAR DATOS DE AGENDA
// =============================================
async function cargarAgenda() {
    const loader = document.getElementById('agenda-loader');
    const gridSemanal = document.getElementById('calendario-semanal-grid');

    loader.classList.remove('hidden');
    gridSemanal.classList.add('hidden');

    try {
        const { fechaInicio, fechaFin } = obtenerRangoFechas();
        const manicurista = document.getElementById('agenda-filtro-manicurista').value;

        const params = new URLSearchParams({
            fecha_inicio: fechaInicio,
            fecha_fin: fechaFin
        });

        if (manicurista) {
            params.append('manicurista', manicurista);
        }

        const response = await fetchConToken(`/api/citas/helpers/agenda?${params}`);
        const data = await response.json();

        if (data.success) {
            agendaDatos = data;
            actualizarTituloFecha();

            if (agendaVistaActual === 'semanal') {
                renderizarVistaSemanal();
            } else {
                renderizarVistaMensual();
            }
        }

        loader.classList.add('hidden');
        if (agendaVistaActual === 'semanal') {
            gridSemanal.classList.remove('hidden');
        } else {
            document.getElementById('calendario-mensual-grid').classList.remove('hidden');
        }

    } catch (error) {
        console.error('Error cargando agenda:', error);
        loader.classList.add('hidden');
        mostrarMensaje('error', '❌', 'Error', 'No se pudo cargar la agenda');
    }
}

// =============================================
// OBTENER RANGO DE FECHAS
// =============================================
function obtenerRangoFechas() {
    const fecha = new Date(agendaFechaActual);

    if (agendaVistaActual === 'semanal') {
        // Obtener lunes de la semana
        const dia = fecha.getDay();
        const diff = fecha.getDate() - dia + (dia === 0 ? -6 : 1);
        const lunes = new Date(fecha.setDate(diff));
        const domingo = new Date(lunes);
        domingo.setDate(lunes.getDate() + 6);

        return {
            fechaInicio: formatearFechaISO(lunes),
            fechaFin: formatearFechaISO(domingo)
        };
    } else {
        // Obtener primer y último día del mes
        const primerDia = new Date(fecha.getFullYear(), fecha.getMonth(), 1);
        const ultimoDia = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0);

        return {
            fechaInicio: formatearFechaISO(primerDia),
            fechaFin: formatearFechaISO(ultimoDia)
        };
    }
}

function formatearFechaISO(fecha) {
    // Ajustar a zona horaria local para evitar problemas con toISOString (que es UTC)
    const offset = fecha.getTimezoneOffset() * 60000;
    const localDate = new Date(fecha.getTime() - offset);
    return localDate.toISOString().split('T')[0];
}

// =============================================
// ACTUALIZAR TÍTULO DE FECHA
// =============================================
function actualizarTituloFecha() {
    const titulo = document.getElementById('agenda-fecha-titulo');
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    if (agendaVistaActual === 'semanal') {
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

// =============================================
// CAMBIAR VISTA AGENDA
// =============================================
function cambiarVistaAgenda(vista) {
    agendaVistaActual = vista;
    window.mobileSoloHoy = false; // Reset mobile filter

    // Actualizar botones
    document.getElementById('btn-vista-semanal').classList.toggle('active', vista === 'semanal');
    document.getElementById('btn-vista-mensual').classList.toggle('active', vista === 'mensual');

    // Mostrar/ocultar contenedores
    document.getElementById('calendario-semanal').classList.toggle('hidden', vista !== 'semanal');
    document.getElementById('calendario-mensual').classList.toggle('hidden', vista !== 'mensual');

    cargarAgenda();
}

// =============================================
// NAVEGAR AGENDA
// =============================================
function navegarAgenda(direccion) {
    window.mobileSoloHoy = false; // Reset mobile filter
    if (agendaVistaActual === 'semanal') {
        agendaFechaActual.setDate(agendaFechaActual.getDate() + (direccion * 7));
    } else {
        agendaFechaActual.setMonth(agendaFechaActual.getMonth() + direccion);
    }
    cargarAgenda();
}

function irAHoy() {
    agendaFechaActual = new Date();
    window.mobileSoloHoy = true; // Activar filtro de solo hoy en móvil
    cargarAgenda();
}

// =============================================
// COLORES PARA MANICURISTAS
// =============================================
const MANICURISTA_COLORS = [
    '#e91e63', // Pink
    '#9c27b0', // Purple
    '#673ab7', // Deep Purple
    '#3f51b5', // Indigo
    '#2196f3', // Blue
    '#00bcd4', // Cyan
    '#009688', // Teal
    '#F44336', // Red
    '#FF9800', // Orange
    '#795548', // Brown
    '#607D8B'  // Blue Grey
];

function obtenerColorManicurista(email) {
    if (!email) return '#999';
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
        hash = email.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % MANICURISTA_COLORS.length;
    return MANICURISTA_COLORS[index];
}

// =============================================
// RENDERIZAR VISTA SEMANAL
// =============================================
function renderizarVistaSemanal() {
    // SOPORTE MÓVIL: Si es pantalla pequeña, renderizar vista de tarjetas
    if (window.innerWidth <= 767) {
        renderizarAgendaMovil(agendaDatos.citas);
        return;
    }

    const grid = document.getElementById('calendario-semanal-grid');
    const { fechaInicio } = obtenerRangoFechas();
    const inicioSemana = new Date(fechaInicio + 'T00:00:00');
    const hoy = new Date();
    const hoyStr = formatearFechaISO(hoy);

    const diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const horas = [];
    for (let h = 8; h < 20; h++) {
        horas.push(`${h.toString().padStart(2, '0')}:00`);
        horas.push(`${h.toString().padStart(2, '0')}:30`);
    }

    // Obtener manicuristas a mostrar
    const manicuristas = agendaDatos.manicuristas || [];

    // Generar Leyenda de Manicuristas
    let htmlLeyenda = '<div class="leyenda-manicuristas">';
    htmlLeyenda += '<span class="leyenda-titulo">Filtrar por Manicurista:</span>';

    // Usar la lista global si agendaDatos.manicuristas está vacío o incompleto
    const listaParaLeyenda = listaManicuristas.length > 0 ? listaManicuristas : manicuristas;

    listaParaLeyenda.forEach(m => {
        const color = obtenerColorManicurista(m.email);
        htmlLeyenda += `
            <div class="manicurista-chip" 
                 style="border-left: 5px solid ${color};"
                 onmouseenter="resaltarManicurista('${m.email}')" 
                 onmouseleave="restaurarVista()">
                 💅 ${m.nombre_completo || m.nombre}
            </div>
        `;
    });
    htmlLeyenda += '</div>';

    // Generar Leyenda de Estados
    const estados = [
        { id: 'pendiente', nombre: 'Pendiente', color: '#ffc107' },
        { id: 'confirmada', nombre: 'Confirmada', color: '#17a2b8' },
        { id: 'completada', nombre: 'Completada', color: '#28a745' },
        { id: 'cancelada', nombre: 'Cancelada', color: '#dc3545' }
    ];

    htmlLeyenda += '<div class="leyenda-estados">';
    htmlLeyenda += '<span class="leyenda-titulo">Estados:</span>';
    estados.forEach(e => {
        htmlLeyenda += `
            <div class="estado-chip">
                <span class="estado-color" style="background-color: ${e.color};"></span>
                ${e.nombre}
            </div>
        `;
    });
    htmlLeyenda += '</div>';

    // Contenedor principal de leyendas (flex column)
    htmlLeyenda = `<div class="leyendas-wrapper">${htmlLeyenda}</div>`;

    // Renderizar leyenda en su propio contenedor
    const contenedorLeyenda = document.getElementById('leyenda-manicuristas-container');
    if (contenedorLeyenda) {
        contenedorLeyenda.innerHTML = htmlLeyenda;
    }

    let html = '<div class="calendario-header">';
    html += '<div class="calendario-header-cell">Hora</div>';

    // Header con días
    for (let i = 0; i < 7; i++) {
        const fecha = new Date(inicioSemana);
        fecha.setDate(inicioSemana.getDate() + i);
        const fechaStr = formatearFechaISO(fecha);
        const esHoy = fechaStr === hoyStr ? 'es-hoy' : '';
        html += `<div class="calendario-header-cell ${esHoy}">
            ${diasSemana[i]} ${fecha.getDate()}
        </div>`;
    }
    html += '</div>';

    // Filas por hora
    horas.forEach(hora => {
        html += `<div class="calendario-hora">${hora}</div>`;

        for (let i = 0; i < 7; i++) {
            const fecha = new Date(inicioSemana);
            fecha.setDate(inicioSemana.getDate() + i);
            const fechaStr = formatearFechaISO(fecha);

            // Verificar si es pasado
            const esPasado = fechaStr < hoyStr || (fechaStr === hoyStr && hora <= `${hoy.getHours().toString().padStart(2, '0')}:${hoy.getMinutes().toString().padStart(2, '0')}`);
            const clasePasado = esPasado ? 'pasado' : '';

            // Buscar citas en este slot
            let citasEnSlot = agendaDatos.citas.filter(c => {
                const citaFecha = c.fecha.split('T')[0];
                const citaHora = c.hora_inicio.substring(0, 5);
                return citaFecha === fechaStr && citaHora === hora;
            });

            // FILTRO DE VISIBILIDAD: Ocultar canceladas FUTURAS para liberar espacio visual
            citasEnSlot = citasEnSlot.filter(c => {
                if (c.estado === 'cancelada' && !esPasado) return false;
                return true;
            });

            html += `<div class="calendario-celda ${clasePasado}" 
                        data-fecha="${fechaStr}" 
                        data-hora="${hora}"
                        onclick="clickCeldaCalendario('${fechaStr}', '${hora}')">`;

            if (citasEnSlot.length > 0) {
                // Calcular ancho para citas solapadas (split view)
                const width = 100 / citasEnSlot.length;

                citasEnSlot.forEach((cita, index) => {
                    // Calcular duración en minutos
                    const inicio = new Date(`2000-01-01T${cita.hora_inicio}`);
                    const fin = new Date(`2000-01-01T${cita.hora_fin}`);
                    const duracionMin = (fin - inicio) / 60000;

                    // Calcular altura: (minutos / 30) * 60px - 4px (padding/bordes)
                    const slots = duracionMin / 30;
                    const height = (slots * 60) - 2;

                    // Detectar si es cita corta para ajustar estilos
                    const esCorta = duracionMin <= 45 ? 'cita-corta' : '';

                    // Calcular posición horizontal
                    const left = index * width;

                    // Obtener Color
                    const colorM = obtenerColorManicurista(cita.email_manicurista);

                    // TELEFONO (Ahora viene directo del backend en telefono_cliente)
                    const telefonoDisplay = cita.telefono_cliente || '';

                    html += `
                        <div class="cita-slot estado-${cita.estado} ${esCorta}" 
                             style="--slot-height: ${height}px; height: ${height}px; z-index: ${10 + index}; width: ${width}%; left: ${left}%; border-right: 5px solid ${colorM};"
                             data-email-manicurista="${cita.email_manicurista}"
                             title="${cita.nombre_manicurista} - ${cita.nombre_cliente} (${cita.nombre_servicio})"
                             onclick="event.stopPropagation(); editarCita(${cita.id_cita})">
                            <div class="cita-hora">${cita.hora_inicio.substring(0, 5)} - ${cita.hora_fin.substring(0, 5)}</div>
                            <div class="cita-manicurista" style="font-size: 0.8em; font-weight: bold;">💅 ${cita.nombre_manicurista.split(' ')[0]}</div>
                            <div class="cita-cliente">${cita.nombre_cliente}</div>
                            ${telefonoDisplay ? `<div class="cita-telefono" style="font-size:0.75em">📞 ${telefonoDisplay}</div>` : ''}
                            ${esCorta ? '' : `<div class="cita-servicio">${cita.nombre_servicio}</div>`}
                        </div>
                    `;
                });
            } else if (!esPasado) {
                html += '<div class="slot-disponible">+</div>';
            }

            html += '</div>';
        }
    });

    grid.innerHTML = html;
}

// =============================================
// RENDERIZAR VISTA MENSUAL
// =============================================
function renderizarVistaMensual() {
    const grid = document.getElementById('calendario-mensual-grid');

    // LIMPIEZA MÓVIL: Si venimos de la vista semanal móvil, limpiar el contenedor móvil
    const mobileView = document.getElementById('agenda-mobile-view');
    if (mobileView) mobileView.remove();

    // Asegurar que el grid está visible (aunque cargarAgenda lo hace, doble seguridad)
    grid.classList.remove('hidden');
    const year = agendaFechaActual.getFullYear();
    const month = agendaFechaActual.getMonth();
    const hoy = new Date();
    const hoyStr = formatearFechaISO(hoy);

    const primerDia = new Date(year, month, 1);
    const ultimoDia = new Date(year, month + 1, 0);
    const diasEnMes = ultimoDia.getDate();

    // Ajustar para que la semana empiece en lunes
    let inicioSemana = primerDia.getDay() - 1;
    if (inicioSemana < 0) inicioSemana = 6;

    const diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    let html = '';

    // Headers
    diasSemana.forEach(dia => {
        html += `<div class="mes-header">${dia}</div>`;
    });

    // Días del mes anterior
    const mesAnterior = new Date(year, month, 0);
    for (let i = inicioSemana - 1; i >= 0; i--) {
        const dia = mesAnterior.getDate() - i;
        html += `<div class="mes-dia otro-mes"><div class="dia-numero">${dia}</div></div>`;
    }

    // Días del mes actual
    for (let dia = 1; dia <= diasEnMes; dia++) {
        const fechaStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${dia.toString().padStart(2, '0')}`;
        const esHoy = fechaStr === hoyStr ? 'es-hoy' : '';

        // Contar citas del día (excluyendo canceladas)
        const citasDelDia = agendaDatos.citas.filter(c => c.fecha.split('T')[0] === fechaStr && c.estado !== 'cancelada');
        const numCitas = citasDelDia.length;

        html += `
            <div class="mes-dia ${esHoy}" onclick="irADiaSemanal('${fechaStr}')">
                <div class="dia-numero">${dia}</div>
                ${numCitas > 0 ? `<span class="citas-badge">${numCitas} cita${numCitas > 1 ? 's' : ''}</span>` : ''}
            </div>
        `;
    }

    // Días del mes siguiente
    const totalCeldas = inicioSemana + diasEnMes;
    const celdasRestantes = totalCeldas % 7 === 0 ? 0 : 7 - (totalCeldas % 7);
    for (let i = 1; i <= celdasRestantes; i++) {
        html += `<div class="mes-dia otro-mes"><div class="dia-numero">${i}</div></div>`;
    }

    grid.innerHTML = html;
}

// =============================================
// CLICK EN CELDA DEL CALENDARIO
// =============================================
function clickCeldaCalendario(fecha, hora) {
    const hoy = new Date();
    const hoyStr = formatearFechaISO(hoy);
    const horaActual = `${hoy.getHours().toString().padStart(2, '0')}:${hoy.getMinutes().toString().padStart(2, '0')}`;

    // Verificar si es pasado
    if (fecha < hoyStr || (fecha === hoyStr && hora <= horaActual)) {
        return; // No hacer nada en slots pasados
    }

    // Abrir modal de nueva cita con datos pre-llenados
    crearCitaDesdeCalendario(fecha, hora);
}

// =============================================
// CREAR CITA DESDE CALENDARIO
// =============================================
async function crearCitaDesdeCalendario(fecha, hora) {
    await abrirModalNuevaCita();

    // Pre-llenar fecha
    document.getElementById('cita-fecha').value = fecha;

    // Si hay un filtro de manicurista activo, pre-llenarla
    const manicuristaFiltro = document.getElementById('agenda-filtro-manicurista').value;
    if (manicuristaFiltro) {
        document.getElementById('cita-manicurista').value = manicuristaFiltro;
    }

    // Cargar horarios y seleccionar el clickeado si está disponible
    await cargarHorariosDisponibles();

    const selectHora = document.getElementById('cita-hora');

    // Si no hay manicurista seleccionada, cargarHorariosDisponibles habrá limpiado el select.
    // Debemos agregar la opción manualmente para que el usuario vea la hora que clickeó.
    if (selectHora.disabled || selectHora.options.length <= 1) {
        selectHora.disabled = false;
        // Limpiar y agregar opción
        selectHora.innerHTML = `<option value="${hora}">${hora}</option>`;
        selectHora.value = hora;

        // Importante: Habilitar botón si ya tenemos fecha y hora.
        // guardarCita validará el resto.
        document.getElementById('btn-guardar-cita').disabled = false;
    } else {
        // Si ya había horarios cargados (p.ej. filtro manicurista activo)
        const opcionHora = Array.from(selectHora.options).find(opt => opt.value === hora);
        if (opcionHora) {
            selectHora.value = hora;
            document.getElementById('btn-guardar-cita').disabled = false;
        } else {
            // Si el horario no está disponible para esa manicurista, al menos mostrarlo como opción (usuario decidirá si cambiar manicurista)
            const option = document.createElement('option');
            option.value = hora;
            option.textContent = hora;
            selectHora.appendChild(option);
            selectHora.value = hora;
        }
    }
}

// =============================================
// IR A DÍA EN VISTA SEMANAL (desde mensual)
// =============================================
function irADiaSemanal(fechaStr) {
    agendaFechaActual = new Date(fechaStr + 'T00:00:00');
    cambiarVistaAgenda('semanal');
}

// =============================================
// HORARIOS - VARIABLES GLOBALES
// =============================================
let horariosManicuristaSeleccionada = '';
let listaHorariosActuales = []; // Store fetched schedules
let horariosInicializados = false;

const DIAS_SEMANA = {
    1: 'Lunes',
    2: 'Martes',
    3: 'Miércoles',
    4: 'Jueves',
    5: 'Viernes',
    6: 'Sábado',
    7: 'Domingo'
};

const DIAS_CLASES = {
    1: 'lunes',
    2: 'martes',
    3: 'miercoles',
    4: 'jueves',
    5: 'viernes',
    6: 'sabado',
    7: 'domingo'
};

// =============================================
// INICIALIZAR HORARIOS
// =============================================
async function inicializarHorarios() {
    if (!horariosInicializados) {
        await cargarManicuristasHorarios();
        horariosInicializados = true;
    }
}

// =============================================
// CARGAR MANICURISTAS PARA SELECT
// =============================================
async function cargarManicuristasHorarios() {
    try {
        const response = await fetchConToken('/api/citas/helpers/manicuristas');
        const data = await response.json();

        // Save to global list for copy feature
        manicuristasList = data.manicuristas.map(m => ({
            email: m.email,
            nombre: m.nombre_completo // Ensure property name matches helper output
        }));

        const select = document.getElementById('horarios-manicurista');
        select.innerHTML = '<option value="">Seleccionar manicurista</option>' +
            data.manicuristas.map(m =>
                `<option value="${m.email}">${m.nombre_completo}</option>`
            ).join('');
    } catch (error) {
        console.error('Error cargando manicuristas:', error);
    }
}

// =============================================
// CARGAR HORARIOS Y EXCEPCIONES
// =============================================
async function cargarHorarios() {
    const email = document.getElementById('horarios-manicurista').value;
    horariosManicuristaSeleccionada = email;

    if (!email) {
        document.getElementById('horarios-body').innerHTML =
            '<tr><td colspan="5" class="text-center">Selecciona una manicurista</td></tr>';
        document.getElementById('excepciones-body').innerHTML =
            '<tr><td colspan="5" class="text-center">Selecciona una manicurista</td></tr>';
        return;
    }

    await Promise.all([cargarHorariosSemanales(email), cargarExcepciones(email)]);
}

async function cargarHorariosSemanales(email) {
    try {
        const response = await fetchConToken(`/api/horarios/${encodeURIComponent(email)}`);
        const data = await response.json();

        listaHorariosActuales = data.horarios || []; // Update global list

        const tbody = document.getElementById('horarios-body');

        if (!data.success || data.horarios.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay horarios configurados</td></tr>';
            return;
        }

        tbody.innerHTML = data.horarios.map(h => `
            <tr>
                <td><span class="dia-badge ${DIAS_CLASES[h.dia_semana]}">${DIAS_SEMANA[h.dia_semana]}</span></td>
                <td>${h.hora_inicio.substring(0, 5)}</td>
                <td>${h.hora_fin.substring(0, 5)}</td>
                <td>
                    <div class="status-toggle">
                        <div class="toggle-switch ${h.activo ? 'active' : ''}" 
                             onclick="toggleHorarioActivo(${h.id}, ${!h.activo})"></div>
                        <span>${h.activo ? 'Activo' : 'Inactivo'}</span>
                    </div>
                </td>
                <td>
                    <button class="btn-icon" onclick="editarHorario(${h.id}, ${h.dia_semana}, '${h.hora_inicio}', '${h.hora_fin}')" title="Editar">
                        ✏️
                    </button>
                    <button class="btn-icon btn-danger" onclick="confirmarEliminarHorario(${h.id})" title="Eliminar">
                        🗑️
                    </button>
                </td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('Error cargando horarios:', error);
    }
}

async function cargarExcepciones(email) {
    try {
        const response = await fetchConToken(`/api/horarios/excepciones/${encodeURIComponent(email)}`);
        const data = await response.json();

        const tbody = document.getElementById('excepciones-body');

        if (!data.success || data.excepciones.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay excepciones</td></tr>';
            return;
        }

        tbody.innerHTML = data.excepciones.map(e => {
            // Manejar tanto string YYYY-MM-DD como objeto Date/ISO
            let fechaStr = e.fecha;
            if (typeof fechaStr === 'string' && fechaStr.includes('T')) {
                fechaStr = fechaStr.split('T')[0];
            }
            // Asegurar formato YYYY-MM-DD para evitar problemas de zona horaria con T00:00:00
            const fecha = new Date(fechaStr + 'T00:00:00');
            const fechaFormateada = fecha.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
            const horario = e.todo_el_dia ? '-' : `${e.hora_inicio?.substring(0, 5) || ''} - ${e.hora_fin?.substring(0, 5) || ''}`;

            return `
                <tr>
                    <td>${fechaFormateada}</td>
                    <td>${e.todo_el_dia ? 'Sí' : 'No'}</td>
                    <td>${horario}</td>
                    <td>${e.motivo || '-'}</td>
                    <td>
                        <button class="btn-icon" onclick="editarExcepcion(${e.id}, '${fechaStr}', ${e.todo_el_dia}, '${e.hora_inicio || ''}', '${e.hora_fin || ''}', '${e.motivo || ''}')" title="Editar">
                            ✏️
                        </button>
                        <button class="btn-icon btn-danger" onclick="confirmarEliminarExcepcion(${e.id})" title="Eliminar">
                            🗑️
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error('Error cargando excepciones:', error);
    }
}

// =============================================
// MODAL HORARIO
// =============================================
function abrirModalHorario() {
    if (!horariosManicuristaSeleccionada) {
        mostrarMensaje('warning', '⚠️', 'Atención', 'Primero selecciona una manicurista');
        return;
    }
    document.getElementById('modal-horario-titulo').textContent = 'Agregar Horario';
    document.getElementById('form-horario').reset();
    document.getElementById('horario-id').value = '';

    // Filter available days
    const selectDia = document.getElementById('horario-dia');
    const diasOcupados = listaHorariosActuales.map(h => h.dia_semana); // Getting all days

    Array.from(selectDia.options).forEach(opt => {
        if (opt.value) {
            const dia = parseInt(opt.value);
            const count = diasOcupados.filter(d => d === dia).length;

            opt.disabled = false; // Always allow adding more shifts
            if (count > 0) {
                opt.textContent = `${DIAS_SEMANA[dia]} (${count} turno${count > 1 ? 's' : ''})`;
            } else {
                opt.textContent = DIAS_SEMANA[dia];
            }
        }
    });

    document.getElementById('modal-horario').classList.remove('hidden');
}

function editarHorario(id, dia, horaInicio, horaFin) {
    document.getElementById('modal-horario-titulo').textContent = 'Editar Horario';
    document.getElementById('horario-id').value = id;
    document.getElementById('horario-dia').value = dia;
    document.getElementById('horario-dia').disabled = true;
    document.getElementById('horario-inicio').value = horaInicio.substring(0, 5);
    document.getElementById('horario-fin').value = horaFin.substring(0, 5);
    document.getElementById('modal-horario').classList.remove('hidden');
}

function cerrarModalHorario() {
    document.getElementById('modal-horario').classList.add('hidden');
    document.getElementById('horario-dia').disabled = false;
}

async function guardarHorario() {
    const id = document.getElementById('horario-id').value;
    const dia = document.getElementById('horario-dia').value;
    const horaInicio = document.getElementById('horario-inicio').value;
    const horaFin = document.getElementById('horario-fin').value;

    if (!dia || !horaInicio || !horaFin) {
        mostrarMensaje('warning', '⚠️', 'Campos requeridos', 'Completa todos los campos');
        return;
    }

    try {
        const url = id ? `/api/horarios/${id}` : '/api/horarios';
        const method = id ? 'PUT' : 'POST';

        const body = id ?
            { hora_inicio: horaInicio + ':00', hora_fin: horaFin + ':00' } :
            { email_manicurista: horariosManicuristaSeleccionada, dia_semana: parseInt(dia), hora_inicio: horaInicio + ':00', hora_fin: horaFin + ':00' };

        const response = await fetchConToken(url, { method, body: JSON.stringify(body) });
        const data = await response.json();

        if (data.success) {
            cerrarModalHorario();
            mostrarMensaje('success', '✓', 'Éxito', data.message);
            cargarHorarios();
        } else {
            mostrarMensaje('error', '❌', 'Error', data.message);
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('error', '❌', 'Error', 'No se pudo guardar el horario');
    }
}

async function toggleHorarioActivo(id, nuevoEstado) {
    try {
        const response = await fetchConToken(`/api/horarios/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ activo: nuevoEstado })
        });
        const data = await response.json();

        if (data.success) {
            cargarHorarios();
        } else {
            mostrarMensaje('error', '❌', 'Error', data.message);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

function confirmarEliminarHorario(id) {
    confirmarAccion('¿Eliminar horario?', 'Esta acción no se puede deshacer.', async () => {
        try {
            const response = await fetchConToken(`/api/horarios/${id}`, { method: 'DELETE' });
            const data = await response.json();

            if (data.success) {
                mostrarMensaje('success', '✓', 'Éxito', 'Horario eliminado');
                cargarHorarios(); // Refrescar la lista
            } else {
                mostrarMensaje('error', '❌', 'Error', data.message);
            }
        } catch (error) {
            console.error('Error:', error);
            mostrarMensaje('error', '❌', 'Error', 'Error de conexión');
        }
    });
}

// =============================================
// MODAL EXCEPCIÓN
// =============================================
function abrirModalExcepcion() {
    if (!horariosManicuristaSeleccionada) {
        mostrarMensaje('warning', '⚠️', 'Atención', 'Primero selecciona una manicurista');
        return;
    }
    document.getElementById('form-excepcion').reset();
    document.getElementById('excepcion-id').value = ''; // Clear ID for new
    document.getElementById('excepcion-todo-dia').checked = true;
    document.getElementById('excepcion-horas').classList.add('hidden');
    document.getElementById('modal-excepcion').classList.remove('hidden');
}

function cerrarModalExcepcion() {
    document.getElementById('modal-excepcion').classList.add('hidden');
}

function toggleHorasExcepcion() {
    const todoDia = document.getElementById('excepcion-todo-dia').checked;
    document.getElementById('excepcion-horas').classList.toggle('hidden', todoDia);
}

function editarExcepcion(id, fecha, todoDia, inicio, fin, motivo) {
    document.getElementById('excepcion-id').value = id;
    document.getElementById('excepcion-fecha').value = fecha;
    document.getElementById('excepcion-todo-dia').checked = todoDia;
    document.getElementById('excepcion-inicio').value = inicio ? inicio.substring(0, 5) : '';
    document.getElementById('excepcion-fin').value = fin ? fin.substring(0, 5) : '';
    document.getElementById('excepcion-motivo').value = motivo || '';

    toggleHorasExcepcion();
    document.getElementById('modal-excepcion').classList.remove('hidden');
}

async function guardarExcepcion() {
    const id = document.getElementById('excepcion-id').value;
    const fecha = document.getElementById('excepcion-fecha').value;
    const todoDia = document.getElementById('excepcion-todo-dia').checked;
    const horaInicio = document.getElementById('excepcion-inicio').value;
    const horaFin = document.getElementById('excepcion-fin').value;
    const motivo = document.getElementById('excepcion-motivo').value;

    if (!fecha) {
        mostrarMensaje('warning', '⚠️', 'Campo requerido', 'Selecciona una fecha');
        return;
    }

    try {
        const url = id ? `/api/horarios/excepciones/${id}` : '/api/horarios/excepciones';
        const method = id ? 'PUT' : 'POST';

        const response = await fetchConToken(url, {
            method: method,
            body: JSON.stringify({
                email_manicurista: horariosManicuristaSeleccionada,
                fecha,
                todo_el_dia: todoDia,
                hora_inicio: todoDia ? null : horaInicio + ':00',
                hora_fin: todoDia ? null : horaFin + ':00',
                motivo
            })
        });
        const data = await response.json();

        if (data.success) {
            cerrarModalExcepcion();
            mostrarMensaje('success', '✓', 'Éxito', data.message);
            cargarHorarios();
        } else {
            mostrarMensaje('error', '❌', 'Error', data.message);
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('error', '❌', 'Error', 'No se pudo guardar la excepción');
    }
}

// =============================================
// COPIAR HORARIO
// =============================================
function abrirModalCopiarHorario() {
    if (!horariosManicuristaSeleccionada) {
        mostrarMensaje('warning', '⚠️', 'Atención', 'Primero selecciona una manicurista');
        return;
    }

    const manicuristaOrigen = manicuristasList.find(m => m.email === horariosManicuristaSeleccionada);
    document.getElementById('copiar-origen-nombre').textContent = manicuristaOrigen ? manicuristaOrigen.nombre : 'Seleccionada';

    // Llenar select destino (excluyendo la origen)
    const selectDestino = document.getElementById('copiar-destino-email');
    selectDestino.innerHTML = '<option value="">Seleccionar destino...</option>';

    manicuristasList.forEach(m => {
        if (m.email !== horariosManicuristaSeleccionada) {
            const option = document.createElement('option');
            option.value = m.email;
            option.textContent = m.nombre;
            selectDestino.appendChild(option);
        }
    });

    document.getElementById('modal-copiar-horario').classList.remove('hidden');
}

function cerrarModalCopiarHorario() {
    document.getElementById('modal-copiar-horario').classList.add('hidden');
}

async function copiarHorario() {
    const destino = document.getElementById('copiar-destino-email').value;

    if (!destino) {
        mostrarMensaje('warning', '⚠️', 'Atención', 'Selecciona una manicurista destino');
        return;
    }

    cerrarModalCopiarHorario();

    mostrarConfirmacion(
        '⚠️',
        '¿Reemplazar Horario?',
        `Esto <strong>eliminará permanentemente</strong> todos los horarios de la manicurista destino y copiará los de la origen.<br>¿Estás seguro?`,
        async () => {
            try {
                const response = await fetchConToken('/api/horarios/copiar', {
                    method: 'POST',
                    body: JSON.stringify({
                        email_origen: horariosManicuristaSeleccionada,
                        email_destino: destino
                    })
                });

                const data = await response.json();

                if (data.success) {
                    mostrarMensaje('success', '✓', 'Éxito', data.message);
                    // Solo recargar si estamos viendo a la manicurista destino (que cambió)
                    // O recargar siempre por seguridad
                    if (document.getElementById('horarios-manicurista').value === destino) {
                        cargarHorarios();
                    }
                } else {
                    mostrarMensaje('error', '❌', 'Error', data.message);
                }

            } catch (error) {
                console.error('Error al copiar:', error);
                mostrarMensaje('error', '❌', 'Error', 'Ocurrió un error al intentar copiar el horario');
            }
        },
        true // isDangerous = true (Botón rojo)
    );
}

function confirmarEliminarExcepcion(id) {
    mostrarConfirmacion(
        '🗑️',
        '¿Eliminar excepción?',
        'Esta acción no se puede deshacer.',
        async () => {
            try {
                const response = await fetchConToken(`/api/horarios/excepciones/${id}`, { method: 'DELETE' });
                const data = await response.json();

                if (data.success) {
                    mostrarMensaje('success', '✓', 'Éxito', 'Excepción eliminada');
                    cargarHorarios();
                } else {
                    mostrarMensaje('error', '❌', 'Error', data.message);
                }
            } catch (error) {
                console.error('Error:', error);
                mostrarMensaje('error', '❌', 'Error', 'Error al eliminar');
            }
        },
        true // isDangerous
    );
}

// =============================================
// HELPER: RESALTAR MANICURISTA
// =============================================
function resaltarManicurista(email) {
    const slots = document.querySelectorAll('.cita-slot');
    slots.forEach(slot => {
        if (slot.getAttribute('data-email-manicurista') !== email) {
            slot.classList.add('dimmed');
        } else {
            slot.classList.remove('dimmed');
            slot.classList.add('highlighted');
        }
    });
}

function restaurarVista() {
    const slots = document.querySelectorAll('.cita-slot');
    slots.forEach(slot => {
        slot.classList.remove('dimmed');
    });
}

// =============================================
// GESTIÓN DE SERVICIOS
// =============================================
async function inicializarServicios() {
    await cargarServiciosTabla();
}

async function cargarServiciosTabla() {
    const tbody = document.getElementById('servicios-body');
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Cargando...</td></tr>';

    try {
        const response = await fetchConToken('/api/servicios?includeAll=true');

        const data = await response.json();

        if (!data.servicios || data.servicios.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay servicios registrados</td></tr>';
            return;
        }

        tbody.innerHTML = data.servicios.map(s => `
            <tr>
                <td><strong>${s.nombre}</strong></td>
                <td style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${s.descripcion || ''}">${s.descripcion || '-'}</td>
                <td>$${Number(s.precio).toLocaleString('es-CO')}</td>
                <td>${s.duracion_minutos} min</td>
                <td>
                    <span class="badge badge-${s.activo ? 'confirmada' : 'cancelada'}">
                        ${s.activo ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
                <td class="table-actions">
                    <button class="btn-icon btn-edit" onclick="editarServicio(${s.id_servicio})" title="Editar">✏️</button>
                    ${s.activo
                ? `<button class="btn-icon btn-warning" onclick="confirmarToggleServicio(${s.id_servicio}, 0, '${s.nombre}')" title="Desactivar">🚫</button>`
                : `<button class="btn-icon" style="background:#d4edda;color:#155724;" onclick="confirmarToggleServicio(${s.id_servicio}, 1, '${s.nombre}')" title="Activar">✅</button>`
            }
                    <button class="btn-icon btn-delete" onclick="confirmarEliminarServicio(${s.id_servicio}, '${s.nombre}')" title="Eliminar">🗑️</button>
                </td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('Error al cargar servicios:', error);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-red">Error al cargar datos</td></tr>';
    }
}

function abrirModalServicio() {
    document.getElementById('form-servicio').reset();
    document.getElementById('servicio-id').value = '';
    document.getElementById('modal-servicio-titulo').textContent = 'Nuevo Servicio';
    document.getElementById('modal-servicio').classList.remove('hidden');
}

function cerrarModalServicio() {
    document.getElementById('modal-servicio').classList.add('hidden');
}

async function guardarServicio() {
    const id = document.getElementById('servicio-id').value;
    const nombre = document.getElementById('servicio-nombre').value;
    const precio = document.getElementById('servicio-precio').value;
    const duracion = document.getElementById('servicio-duracion').value;
    const descripcion = document.getElementById('servicio-descripcion').value;

    if (!nombre || !precio || !duracion) {
        mostrarMensaje('error', '⚠️', 'Campos incompletos', 'Nombre, precio y duración son obligatorios');
        return;
    }

    const datos = { nombre, precio, duracion, descripcion };
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/servicios/${id}` : '/api/servicios';

    try {
        const response = await fetchConToken(url, {
            method: method,
            body: JSON.stringify(datos)
        });

        const result = await response.json();

        if (result.success) {
            mostrarMensaje('success', '✅', 'Éxito', result.message);
            cerrarModalServicio();
            cargarServiciosTabla();
        } else {
            throw new Error(result.message || 'Error al guardar');
        }

    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('error', '❌', 'Error', error.message);
    }
}

async function editarServicio(id) {
    try {
        const response = await fetchConToken(`/api/servicios/${id}`);
        const data = await response.json();

        if (data.success) {
            const s = data.servicio;
            document.getElementById('servicio-id').value = s.id_servicio;
            document.getElementById('servicio-nombre').value = s.nombre;
            document.getElementById('servicio-precio').value = s.precio;
            document.getElementById('servicio-duracion').value = s.duracion_minutos;
            document.getElementById('servicio-descripcion').value = s.descripcion || '';

            document.getElementById('modal-servicio-titulo').textContent = 'Editar Servicio';
            document.getElementById('modal-servicio').classList.remove('hidden');
        }
    } catch (error) {
        console.error(error);
        mostrarMensaje('error', '❌', 'Error', 'No se pudo cargar el servicio');
    }
}

async function toggleEstadoServicio(id, nuevoEstado) {
    try {
        const response = await fetchConToken(`/api/servicios/${id}/estado`, {
            method: 'PATCH',
            body: JSON.stringify({ activo: nuevoEstado })
        });

        if (response.ok) {
            cargarServiciosTabla();
        } else {
            mostrarMensaje('error', '❌', 'Error', 'No se pudo cambiar el estado');
        }
    } catch (error) {
        console.error(error);
    }
}

// Confirmation modal for toggle
function confirmarToggleServicio(id, nuevoEstado, nombre) {
    const accion = nuevoEstado ? 'activar' : 'desactivar';
    const mensaje = nuevoEstado
        ? `¿Deseas activar "${nombre}"? Volverá a estar disponible para agendar citas.`
        : `¿Deseas desactivar "${nombre}"? No podrás usarlo para nuevas citas hasta que lo actives de nuevo.`;

    mostrarConfirmacion(
        nuevoEstado ? '✅' : '🚫',
        `${accion.charAt(0).toUpperCase() + accion.slice(1)} Servicio`,
        mensaje,
        () => toggleEstadoServicio(id, nuevoEstado)
    );
}

// Confirmation modal for delete
function confirmarEliminarServicio(id, nombre) {
    mostrarConfirmacion(
        '🗑️',
        'Eliminar Servicio',
        `¿Estás seguro de eliminar "${nombre}"? Esta acción NO se puede deshacer y se perderá el historial asociado.`,
        () => eliminarServicio(id),
        true // isDangerous
    );
}

async function eliminarServicio(id) {
    try {
        const response = await fetchConToken(`/api/servicios/${id}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            mostrarMensaje('success', '✅', 'Eliminado', result.message);
            cargarServiciosTabla();
        } else {
            mostrarMensaje('error', '❌', 'Error', result.message || 'No se pudo eliminar el servicio');
        }
    } catch (error) {
        console.error(error);
        mostrarMensaje('error', '❌', 'Error', 'Error al eliminar el servicio');
    }
}

// Generic confirmation modal helper
function mostrarConfirmacion(icon, titulo, mensaje, onConfirm, isDangerous = false) {
    // Remove existing modal to avoid DOM conflicts
    const existingModal = document.getElementById('modal-confirmacion');
    if (existingModal) {
        existingModal.remove();
    }

    // Create confirmation modal fresh
    const modal = document.createElement('div');
    modal.id = 'modal-confirmacion';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-box">
            <div class="modal-icon warning confirmacion-icon"></div>
            <h3 class="confirmacion-titulo"></h3>
            <p class="confirmacion-mensaje"></p>
            <div style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;">
                <button class="btn btn-secondary btn-cancelar">Cancelar</button>
                <button class="btn btn-primary btn-confirmar-accion">Confirmar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Setup content
    modal.querySelector('.confirmacion-icon').textContent = icon;
    modal.querySelector('.confirmacion-titulo').textContent = titulo;
    modal.querySelector('.confirmacion-mensaje').innerHTML = mensaje; // Changed from textContent to innerHTML

    // Setup actions
    modal.querySelector('.btn-cancelar').onclick = cerrarConfirmacion;

    const btnConfirmar = modal.querySelector('.btn-confirmar-accion');
    btnConfirmar.style.background = isDangerous ? '#c62828' : '';
    btnConfirmar.onclick = () => {
        cerrarConfirmacion();
        onConfirm();
    };

    modal.classList.remove('hidden');
}

function cerrarConfirmacion() {
    document.getElementById('modal-confirmacion')?.classList.add('hidden');
}

function cerrarSesion() {
    mostrarConfirmacion(
        '🚪',
        'Cerrar Sesión',
        '¿Estás seguro que deseas salir del sistema?',
        () => {
            localStorage.removeItem('token');
            window.location.href = 'login.html';
        },
        false // Not dangerous
    );
}

// =============================================
// GESTIÓN DE USUARIOS
// =============================================
let usuariosList = [];

// Cargar roles dinámicamente
async function cargarRolesSelect() {
    try {
        const response = await fetchConToken('/api/usuarios/helpers/roles');
        const result = await response.json();
        const select = document.getElementById('usuario-rol');

        if (result.success && result.roles) {
            select.innerHTML = result.roles.map(r =>
                `<option value="${r.id_rol}">${r.nombre_rol.charAt(0).toUpperCase() + r.nombre_rol.slice(1)}</option>`
            ).join('');
        }
    } catch (error) {
        console.error('Error cargando roles:', error);
    }
}

function inicializarUsuarios() {
    cargarUsuariosTabla();
    cargarRolesSelect(); // Cargar roles al iniciar la sección
}

async function cargarUsuariosTabla() {
    const tbody = document.getElementById('usuarios-body');
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Cargando...</td></tr>';

    try {
        const response = await fetchConToken('/api/usuarios');
        const result = await response.json();

        if (!result.success || !result.usuarios || result.usuarios.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay usuarios registrados</td></tr>';
            return;
        }

        usuariosList = result.usuarios;

        tbody.innerHTML = result.usuarios.map(u => {
            let badgeClass = 'badge-info';
            const rolLower = (u.rol || '').toLowerCase();

            if (rolLower.includes('admin')) badgeClass = 'badge-rol-admin';
            else if (rolLower.includes('manicurista')) badgeClass = 'badge-rol-manicurista';
            else badgeClass = 'badge-rol-cliente';

            return `
            <tr>
                <td><strong>${u.nombre} ${u.apellido || ''}</strong></td>
                <td>${u.email}</td>
                <td><span class="badge ${badgeClass}">${u.rol || 'Cliente'}</span></td>
                <td>
                    <span class="badge badge-${u.activo ? 'confirmada' : 'cancelada'}">
                        ${u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
                <td class="table-actions">
                    <button class="btn-icon btn-edit" onclick="editarUsuario('${u.email}')" title="Editar">✏️</button>
                    ${u.activo
                    ? `<button class="btn-icon btn-warning" onclick="confirmarToggleUsuario('${u.email}', 0, '${u.nombre}')" title="Desactivar">🚫</button>`
                    : `<button class="btn-icon" style="background:#d4edda;color:#155724;" onclick="confirmarToggleUsuario('${u.email}', 1, '${u.nombre}')" title="Activar">✅</button>`
                }
                    <button class="btn-icon btn-delete" onclick="confirmarEliminarUsuario('${u.email}', '${u.nombre}')" title="Eliminar">🗑️</button>
                </td>
            </tr>`;
        }).join('');

    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-red">Error al cargar usuarios</td></tr>';
    }
}

// Listeners de validación de contraseña en tiempo real
document.getElementById('usuario-password').addEventListener('input', validarCoincidenciaPasswords);
document.getElementById('usuario-password-confirm').addEventListener('input', validarCoincidenciaPasswords);

function validarCoincidenciaPasswords() {
    const p1 = document.getElementById('usuario-password').value;
    const p2 = document.getElementById('usuario-password-confirm').value;
    const msg = document.getElementById('password-match-msg');

    if (!p1 && !p2) {
        msg.textContent = '';
        msg.className = 'text-xs';
        return;
    }

    if (p2 && p1 === p2) {
        msg.textContent = 'Contraseñas coinciden';
        msg.className = 'text-xs text-success';
    } else if (p2) {
        msg.textContent = 'Contraseñas no coinciden';
        msg.className = 'text-xs text-danger';
    } else {
        msg.textContent = '';
    }
}

function abrirModalUsuario() {
    document.getElementById('form-usuario').reset();
    document.getElementById('usuario-id').value = '';
    document.getElementById('usuario-apellido').value = ''; // Reset apellido
    document.getElementById('modal-usuario-titulo').textContent = 'Nuevo Usuario';
    document.getElementById('usuario-password-hint').classList.remove('hidden');
    document.getElementById('password-match-msg').textContent = ''; // Reset msg
    document.getElementById('modal-usuario').classList.remove('hidden');
}

function cerrarModalUsuario() {
    document.getElementById('modal-usuario').classList.add('hidden');
}

async function guardarUsuario() {
    const id = document.getElementById('usuario-id').value;
    const nombre = document.getElementById('usuario-nombre').value;
    const apellido = document.getElementById('usuario-apellido').value;
    const email = document.getElementById('usuario-email').value;
    const password = document.getElementById('usuario-password').value;
    const rol = document.getElementById('usuario-rol').value;

    if (!nombre || !email || !rol) {
        mostrarMensaje('error', '⚠️', 'Campos incompletos', 'Nombre, Email y Rol son obligatorios');
        return;
    }

    if (!id && !password) {
        mostrarMensaje('error', '⚠️', 'Contraseña requerida', 'Debes asignar una contraseña al crear un usuario');
        return;
    }

    // Validación estricta de contraseña (si se está enviando una)
    if (password) {
        if (password.length < 6) {
            mostrarMensaje('error', '⚠️', 'Contraseña insegura', 'La contraseña debe tener al menos 6 caracteres');
            return;
        }

        const confirmPassword = document.getElementById('usuario-password-confirm').value;
        if (password !== confirmPassword) {
            mostrarMensaje('error', '⚠️', 'No coinciden', 'Las contraseñas no coinciden');
            return;
        }
    }

    const datos = { nombre, apellido, email, rol, password }; // Password can be empty on update
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/usuarios/${id}` : '/api/usuarios';

    try {
        const response = await fetchConToken(url, {
            method: method,
            body: JSON.stringify(datos)
        });

        const result = await response.json();

        if (result.success) {
            mostrarMensaje('success', '✅', 'Éxito', result.message);
            cerrarModalUsuario();
            cargarUsuariosTabla();
        } else {
            throw new Error(result.message || 'Error al guardar');
        }
    } catch (error) {
        console.error(error);
        mostrarMensaje('error', '❌', 'Error', error.message);
    }
}

function editarUsuario(id) {
    // id is email now
    const user = usuariosList.find(u => u.email === id);
    if (!user) return;

    document.getElementById('usuario-id').value = user.email; // Identify by email
    document.getElementById('usuario-nombre').value = user.nombre;
    document.getElementById('usuario-apellido').value = user.apellido || '';
    document.getElementById('usuario-email').value = user.email;
    document.getElementById('usuario-rol').value = user.id_rol; // Use ID for select
    document.getElementById('usuario-password').value = '';
    document.getElementById('usuario-password-confirm').value = ''; // Clear confirm
    document.getElementById('password-match-msg').textContent = ''; // Clear msg
    document.getElementById('modal-usuario-titulo').textContent = 'Editar Usuario';

    document.getElementById('modal-usuario').classList.remove('hidden');
}

function confirmarToggleUsuario(id, nuevoEstado, nombre) {
    const accion = nuevoEstado ? 'activar' : 'desactivar';
    mostrarConfirmacion(
        nuevoEstado ? '✅' : '🚫',
        `${accion.charAt(0).toUpperCase() + accion.slice(1)} Usuario`,
        `¿Deseas ${accion} el acceso para "${nombre}" ? `,
        async () => {
            try {
                const response = await fetchConToken(`/api/usuarios/${id}/estado`, {
                    method: 'PATCH',
                    body: JSON.stringify({ activo: nuevoEstado })
                });
                if (response.ok) cargarUsuariosTabla();
            } catch (error) { console.error(error); }
        }
    );
}

function confirmarEliminarUsuario(id, nombre) {
    mostrarConfirmacion(
        '🗑️',
        'Eliminar Usuario',
        `¿Estás seguro de eliminar a "${nombre}"? Esta acción suele ser irreversible.`,
        async () => {
            try {
                const response = await fetchConToken(`/api/usuarios/${id}`, { method: 'DELETE' });
                const result = await response.json();
                if (result.success) {
                    mostrarMensaje('success', '✅', 'Eliminado', result.message);
                    cargarUsuariosTabla();
                } else {
                    mostrarMensaje('error', '❌', 'Error', result.message);
                }
            } catch (error) { console.error(error); }
        },
        true
    );
}

// =============================================
// SECCIÓN COMISIONES
// =============================================

function cambiarTipoFiltroComision() {
    const tipo = document.getElementById('filtro-comision-tipo').value;

    // Ocultar todos los contenedores
    document.getElementById('filtro-mes-container').style.display = 'none';
    document.getElementById('filtro-semana-container').style.display = 'none';
    document.getElementById('filtro-rango-container').style.display = 'none';

    // Mostrar el contenedor correspondiente
    if (tipo === 'mes') {
        document.getElementById('filtro-mes-container').style.display = 'block';
    } else if (tipo === 'semana') {
        document.getElementById('filtro-semana-container').style.display = 'block';
        poblarSemanasComision();
    } else if (tipo === 'rango') {
        document.getElementById('filtro-rango-container').style.display = 'block';
        // Establecer fechas por defecto (semana actual)
        const hoy = new Date();
        const hace7Dias = new Date(hoy);
        hace7Dias.setDate(hace7Dias.getDate() - 7);
        document.getElementById('filtro-comision-desde').valueAsDate = hace7Dias;
        document.getElementById('filtro-comision-hasta').valueAsDate = hoy;
    } else if (tipo === 'conciliacion') {
        // Conciliación suele ser mensual
        document.getElementById('filtro-mes-container').style.display = 'block';
    }



    // Gestionar visibilidad de tablas
    const tablaComisiones = document.getElementById('container-tabla-comisiones');
    const tablaConciliacion = document.getElementById('container-tabla-conciliacion');

    // SI ESTAMOS EN MODO AUDITORIA:
    // Siempre mostrar tabla conciliacion, ocultar comisiones.
    // IGNORAR el valor del select para ocultar tablas, solo usarlo para mostrar filtros.
    if (window.modoAuditoria || tipo === 'conciliacion') {
        if (tablaComisiones) tablaComisiones.classList.add('hidden');
        if (tablaConciliacion) tablaConciliacion.classList.remove('hidden');
    } else {
        if (tablaComisiones) tablaComisiones.classList.remove('hidden');
        if (tablaConciliacion) tablaConciliacion.classList.add('hidden');
    }
}

function poblarSemanasComision() {
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

        const option = document.createElement('option');
        option.value = `${desde}|${hasta}`;
        option.textContent = `Semana ${numSemana}: ${formatearFechaCorta(semanaActual)} - ${formatearFechaCorta(finSemana)}`;
        selectSemana.appendChild(option);

        semanaActual.setDate(semanaActual.getDate() + 7);
        numSemana++;
    }

    // Seleccionar la semana actual
    const hoy = new Date();
    const opciones = selectSemana.options;
    for (let i = 0; i < opciones.length; i++) {
        const [desde, hasta] = opciones[i].value.split('|');
        if (hoy >= new Date(desde) && hoy <= new Date(hasta)) {
            selectSemana.selectedIndex = i;
            break;
        }
    }
}

function formatearFechaCorta(fecha) {
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${fecha.getDate()} ${meses[fecha.getMonth()]}`;
}

async function poblarFiltroManicuristas() {
    const select = document.getElementById('filtro-comision-manicurista');
    if (!select) return;

    try {
        const res = await fetchConToken('/api/citas/helpers/manicuristas?fecha=2000-01-01');
        const data = await res.json();

        if (data.success) {
            // Guardar selección actual si existe
            const currentVal = select.value;

            select.innerHTML = '<option value="">Todas</option>';
            data.manicuristas.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.email;
                opt.textContent = m.nombre_completo; // Corregido: backend devuelve nombre_completo
                select.appendChild(opt);
            });

            // Restaurar selección si es posible, si no vacio
            if (currentVal) select.value = currentVal;
        }
    } catch (e) {
        console.error("Error cargando manicuristas filtro", e);
    }
}

function inicializarComisiones() {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;

    const selectAnio = document.getElementById('filtro-comision-anio');
    const selectMes = document.getElementById('filtro-comision-mes');

    if (selectAnio) {
        // Force populate logic
        selectAnio.innerHTML = '';
        const years = [2025, 2026, 2027];
        years.forEach(y => {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            if (y === currentYear) opt.selected = true;
            selectAnio.appendChild(opt);
        });
    }

    if (selectMes) {
        selectMes.value = currentMonth.toString();
    }

    console.log('Inicializando módulo de comisiones...');

    // Inicializar el tipo de filtro
    cambiarTipoFiltroComision();

    // Cargar selector de manicuristas
    poblarFiltroManicuristas();

    // Cargar datos iniciales
    aplicarFiltrosComisiones();
}

// Auto-init if element exists
if (document.getElementById('filtro-comision-anio')) {
    inicializarComisiones();
}

// Dispatcher para el botón "Aplicar"
function aplicarFiltrosComisiones() {
    const tipo = document.getElementById('filtro-comision-tipo').value;


    // Si estamos en modo auditoría O seleccionaron explicitamente conciliacion
    if (window.modoAuditoria || tipo === 'conciliacion') {
        console.log('Cargando conciliación...');
        cargarConciliacion();
    } else {
        console.log('Cargando comisiones...');
        cargarComisiones();
    }
}
window.aplicarFiltrosComisiones = aplicarFiltrosComisiones;

// Función helper para cambiar vista desde el sidebar
function cambiarVistaComisiones(vista) {
    const select = document.getElementById('filtro-comision-tipo');
    if (!select) return;

    if (vista === 'conciliacion') {
        select.value = 'conciliacion';
    } else {
        // Default a mes si no es conciliacion
        select.value = 'mes';
    }

    // Disparar cambio de UI y carga de datos
    cambiarTipoFiltroComision();
    aplicarFiltrosComisiones();
}

async function cargarConciliacion() {
    const tbody = document.getElementById('conciliacion-body');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center">Cargando datos...</td></tr>';

    try {

        const tipo = document.getElementById('filtro-comision-tipo').value;
        const anio = document.getElementById('filtro-comision-anio').value;
        const mes = document.getElementById('filtro-comision-mes').value;
        const manicurista = document.getElementById('filtro-comision-manicurista').value;

        let query = `?anio=${anio}&mes=${mes}`;

        // Agregar lógica de filtros por rango/semana
        if (tipo === 'semana') {
            const semanaValue = document.getElementById('filtro-comision-semana').value;
            if (semanaValue) {
                const [desde, hasta] = semanaValue.split('|');
                query = `?desde=${desde}&hasta=${hasta}`; // Reemplazamos params
            }
        } else if (tipo === 'rango') {
            const desde = document.getElementById('filtro-comision-desde').value;
            const hasta = document.getElementById('filtro-comision-hasta').value;
            if (desde && hasta) {
                query = `?desde=${desde}&hasta=${hasta}`; // Reemplazamos params
            }
        }

        if (manicurista) query += `&manicurista=${manicurista}`;

        const response = await fetchConToken(`/api/reportes/admin/conciliacion${query}`);
        const result = await response.json();

        if (result.success) {
            if (result.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay datos para conciliar en este periodo</td></tr>';
                return;
            }

            tbody.innerHTML = result.data.map(item => {
                const diff = parseFloat(item.diferencia);
                const colorClass = Math.abs(diff) < 1 ? 'text-success' : 'text-danger font-bold';
                const estadoIcon = Math.abs(diff) < 1 ? '✅ Cuadrado' : '⚠️ Descuadre';

                return `
                    <tr>
                        <td>${item.fecha}</td>
                        <td>${item.nombre_manicurista}</td>
                        <td>$${Number(item.valor_sistema).toLocaleString('es-CO')}</td>
                         <td>$${Number(item.valor_reportado).toLocaleString('es-CO')}</td>
                        <td class="${colorClass}">$${Number(diff).toLocaleString('es-CO')}</td>
                        <td>${estadoIcon}</td>
                    </tr>
                `;
            }).join('');
        } else {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-red">${result.message}</td></tr>`;
        }

    } catch (error) {
        console.error('Error cargando conciliación:', error);
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center text-red">Error de conexión</td></tr>';
    }
}

async function cargarComisiones() {
    try {
        const tipo = document.getElementById('filtro-comision-tipo').value;
        const anio = document.getElementById('filtro-comision-anio').value;
        const manicurista = document.getElementById('filtro-comision-manicurista') ? document.getElementById('filtro-comision-manicurista').value : '';

        let query = `?tipo=${tipo}&anio=${anio}`;

        if (tipo === 'mes') {
            const mes = document.getElementById('filtro-comision-mes').value;
            if (mes) query += `&mes=${mes}`;
        } else if (tipo === 'semana') {
            const semanaValue = document.getElementById('filtro-comision-semana').value;
            if (semanaValue) {
                const [desde, hasta] = semanaValue.split('|');
                query += `&desde=${desde}&hasta=${hasta}`;
            }
        } else if (tipo === 'rango') {
            const desde = document.getElementById('filtro-comision-desde').value;
            const hasta = document.getElementById('filtro-comision-hasta').value;
            if (desde && hasta) {
                query += `&desde=${desde}&hasta=${hasta}`;
            }
        }

        if (manicurista) {
            query += `&manicurista=${manicurista}`;
        }

        const response = await fetchConToken(`/api/comisiones/resumen${query}`);
        const data = await response.json();

        const tbody = document.getElementById('comisiones-body');

        if (!data.success || data.resumen.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay datos de comisiones para el periodo seleccionado</td></tr>';
            return;
        }

        // Generar HTML de la tabla con estructura clara para evitar errores de alineación
        tbody.innerHTML = data.resumen.map(c => {
            return `
            <tr>
                <td>${c.nombre_completo}</td>
                <td>$${Number(c.total_ventas).toLocaleString()}</td>
                <td>
                    ${c.porcentaje}% 
                    <button class="btn-icon btn-sm" onclick="abrirModalConfigComision('${c.email}', '${c.nombre_completo}', ${c.porcentaje})">⚙️</button>
                </td>
                <td>$${Number(c.total_comision).toLocaleString()}</td>
                <td class="text-success">$${Number(c.total_pagado).toLocaleString()}</td>
                <td class="text-danger font-bold">$${Number(c.pendiente).toLocaleString()}</td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="verDetalleComisiones('${c.email}', '${c.nombre_completo}')">
                        Ver Detalle
                    </button>
                </td>
            </tr>`;
        }).join('');

    } catch (error) {
        console.error('Error al cargar comisiones:', error);
    }
}

// DETALLE Y PAGOS
let detalleComisionesCitas = [];

async function verDetalleComisiones(email, nombre) {
    try {
        document.getElementById('detalle-manicurista-nombre').textContent = nombre;
        emailManicuristaDetalle = email;

        // Usar los mismos filtros que el resumen
        const tipo = document.getElementById('filtro-comision-tipo').value;
        const anio = document.getElementById('filtro-comision-anio').value;

        let query = `?tipo=${tipo}&anio=${anio}`;

        if (tipo === 'mes') {
            const mes = document.getElementById('filtro-comision-mes').value;
            if (mes) query += `&mes=${mes}`;
        } else if (tipo === 'semana') {
            const semanaValue = document.getElementById('filtro-comision-semana').value;
            if (semanaValue) {
                const [desde, hasta] = semanaValue.split('|');
                query += `&desde=${desde}&hasta=${hasta}`;
            }
        } else if (tipo === 'rango') {
            const desde = document.getElementById('filtro-comision-desde').value;
            const hasta = document.getElementById('filtro-comision-hasta').value;
            if (desde && hasta) {
                query += `&desde=${desde}&hasta=${hasta}`;
            }
        }

        const response = await fetchConToken(`/api/comisiones/detalle/${email}${query}`);
        const data = await response.json();

        if (data.success) {
            detalleComisionesCitas = data.detalle;
            document.getElementById('detalle-porcentaje').textContent = data.porcentaje_actual;
            renderizarDetalleComisiones();
            document.getElementById('modal-detalle-comision').classList.remove('hidden');
        }

    } catch (error) {
        console.error('Error al ver detalle:', error);
    }
}

function renderizarDetalleComisiones() {
    const tbody = document.getElementById('detalle-comision-body');
    const porcentaje = parseFloat(document.getElementById('detalle-porcentaje').textContent);

    if (detalleComisionesCitas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay citas registradas</td></tr>';
        return;
    }

    const html = detalleComisionesCitas.map((cita, index) => {
        // Recalcular estimación visual basada en configuración actual si se desea, 
        // o usar la que viene del backend (que usa el % actual)
        const comision = (cita.precio * porcentaje) / 100;

        // Fix timezone: parse date string directly to avoid UTC offset issues
        const fechaStr = cita.fecha.split('T')[0]; // "2026-02-07"
        const [anio, mes, dia] = fechaStr.split('-');
        const fechaFormateada = `${dia}/${mes}/${anio}`; // "07/02/2026"

        const row = `
        <tr>
            <td>
                ${cita.estado_pago === 'pendiente'
                ? `<input type="checkbox" class="check-pago" value="${cita.id_cita}" onchange="calcularTotalPagar()">`
                : '✅'}
            </td>
            <td>${fechaFormateada}</td>
            <td>${cita.servicio}</td>
            <td>$${Number(cita.precio).toLocaleString()}</td>
            <td>$${Number(comision).toLocaleString()}</td>
            <td>
                ${cita.estado_pago === 'pagado'
                ? `<div style="display: flex; align-items: center; gap: 5px;">
                         <span class="badge badge-success">Pagado</span>
                         <button class="btn-icon btn-sm text-danger" title="Revertir Pago" onclick="revertirPagoComision(${cita.id_cita})">↺</button>
                       </div>`
                : `<span class="badge badge-warning">${cita.estado_pago}</span>`
            }
            </td>
        </tr>
    `;
        return row;
    }).join('');

    tbody.innerHTML = html;

    calcularTotalPagar();
}

function calcularTotalPagar() {
    const checkboxes = document.querySelectorAll('.check-pago:checked');
    let total = 0;
    const porcentaje = parseFloat(document.getElementById('detalle-porcentaje').textContent);

    checkboxes.forEach(chk => {
        const id = parseInt(chk.value);
        const cita = detalleComisionesCitas.find(c => c.id_cita === id);
        if (cita) {
            total += (cita.precio * porcentaje) / 100;
        }
    });

    document.getElementById('total-a-pagar').textContent = total.toLocaleString();
    document.getElementById('btn-pagar-comisiones').disabled = checkboxes.length === 0;
}

function toggleTodosPagar() {
    const masterCheck = document.getElementById('check-todos-pagar');
    const checkboxes = document.querySelectorAll('.check-pago');
    checkboxes.forEach(chk => {
        chk.checked = masterCheck.checked;
    });
    calcularTotalPagar();
}

function cerrarModalDetalleComision() {
    document.getElementById('modal-detalle-comision').classList.add('hidden');
}

async function pagarComisionesSeleccionadas() {
    const checkboxes = document.querySelectorAll('.check-pago:checked');
    const ids = Array.from(checkboxes).map(chk => parseInt(chk.value));

    // Necesitamos el email de la manicurista (podemos sacarlo del detalle, todos son la misma)
    if (detalleComisionesCitas.length === 0) return;
    // Buscamos el email en la lista cargada inicialmente en la tabla principal
    // O lo pasamos como global variable al abrir el modal.
    // Hack rápido: obtener email desde una variable global temporal
    // Mejor: guardar email al abrir modal.
}

// Variable temporal para el email actual en detalle
let emailManicuristaDetalle = null;

// Override anterior function para guardar email
const originalVerDetalle = verDetalleComisiones;
verDetalleComisiones = async function (email, nombre) {
    emailManicuristaDetalle = email;
    await originalVerDetalle(email, nombre);
}

async function pagarComisionesSeleccionadas() {
    const checkboxes = document.querySelectorAll('.check-pago:checked');
    const ids = Array.from(checkboxes).map(chk => parseInt(chk.value));

    if (ids.length === 0) return;

    // Mostrar modal en lugar de confirm
    document.getElementById('monto-confirmacion-pago').textContent = document.getElementById('total-a-pagar').textContent;
    document.getElementById('modal-confirmacion-pago').classList.remove('hidden');
}

function cerrarModalConfirmacionPago() {
    document.getElementById('modal-confirmacion-pago').classList.add('hidden');
}

async function confirmarPagoComision() {
    const checkboxes = document.querySelectorAll('.check-pago:checked');
    const ids = Array.from(checkboxes).map(chk => parseInt(chk.value));

    if (ids.length === 0) return;

    try {
        const response = await fetchConToken('/api/comisiones/pagar', {
            method: 'POST',
            body: JSON.stringify({
                ids_citas: ids,
                email_manicurista: emailManicuristaDetalle
            })
        });

        const data = await response.json();

        if (data.success) {
            mostrarMensaje('success', '✓', 'Pago Registrado', data.message);
            cerrarModalConfirmacionPago();
            cerrarModalDetalleComision();
            cargarComisiones();
        } else {
            mostrarMensaje('error', '❌', 'Error', data.message);
            cerrarModalConfirmacionPago();
        }

    } catch (error) {
        console.error(error);
        mostrarMensaje('error', '❌', 'Error', 'Error al procesar pago');
        cerrarModalConfirmacionPago();
    }
}

// Variables globales para reversión
let idCitaRevertir = null;

function revertirPagoComision(idCita) {
    idCitaRevertir = idCita;
    document.getElementById('modal-confirmacion-revertir').classList.remove('hidden');
}

function cerrarModalConfirmacionRevertir() {
    document.getElementById('modal-confirmacion-revertir').classList.add('hidden');
    idCitaRevertir = null;
}

async function confirmarRevertirComision() {
    if (!idCitaRevertir) return;

    try {
        const response = await fetchConToken('/api/comisiones/revertir', {
            method: 'POST',
            body: JSON.stringify({ id_cita: idCitaRevertir })
        });

        const data = await response.json();

        if (data.success) {
            mostrarMensaje('success', '✓', 'Pago Revertido', data.message);
            cerrarModalConfirmacionRevertir();
            cerrarModalDetalleComision(); // Cerrar el detalle para forzar recarga
            cargarComisiones(); // Recargar tabla general

            // Opcional: Si queremos mantener el detalle abierto, recargarlo:
            // if (emailManicuristaDetalle) {
            //    verDetalleComisiones(emailManicuristaDetalle, document.getElementById('detalle-manicurista-nombre').textContent);
            // }
        } else {
            mostrarMensaje('error', '❌', 'Error', data.message);
            cerrarModalConfirmacionRevertir();
        }

    } catch (error) {
        console.error(error);
        mostrarMensaje('error', '❌', 'Error', 'Error al revertir pago');
        cerrarModalConfirmacionRevertir();
    }
}

// CONFIGURACIÓN
function abrirModalConfigComision(email, nombre, porcentaje) {
    document.getElementById('config-email-manicurista').value = email;
    document.getElementById('config-nombre-manicurista').textContent = nombre;
    document.getElementById('config-porcentaje').value = porcentaje;
    document.getElementById('modal-config-comision').classList.remove('hidden');
}

function cerrarModalConfigComision() {
    document.getElementById('modal-config-comision').classList.add('hidden');
}

async function guardarConfiguracionComision() {
    const email = document.getElementById('config-email-manicurista').value;
    const porcentaje = document.getElementById('config-porcentaje').value;

    try {
        const response = await fetchConToken('/api/comisiones/configurar', {
            method: 'POST',
            body: JSON.stringify({
                email_manicurista: email,
                porcentaje: parseInt(porcentaje)
            })
        });

        const data = await response.json();

        if (data.success) {
            mostrarMensaje('success', '✓', 'Actualizado', data.message);
            cerrarModalConfigComision();
            cargarComisiones();
        } else {
            mostrarMensaje('error', '❌', 'Error', data.message);
        }

    } catch (error) {
        console.error(error);
        mostrarMensaje('error', '❌', 'Error', 'Error al guardar configuración');
    }
}

// =============================================
// SIDEBAR TOGGLE
// =============================================
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    const isCollapsed = sidebar.classList.toggle('collapsed');
    mainContent.classList.toggle('expanded');

    // Guardar preferencia (opcional)
    // localStorage.setItem('sidebarCollapsed', isCollapsed);
}

// =============================================
// SECCIÓN GALERÍA
// =============================================

function cargarGaleria() {
    const grid = document.getElementById('galeria-grid');
    grid.innerHTML = '<p style="text-align: center;">Cargando imágenes...</p>';

    fetchConToken('/api/galeria')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const imagenes = data.imagenes || [];
                document.getElementById('galeria-total-count').textContent = imagenes.length;

                if (imagenes.length === 0) {
                    grid.innerHTML = '<div class="empty-state">No hay imágenes en la galería. ¡Sube la primera!</div>';
                    return;
                }

                // Agrupar por servicio
                const grupos = {};
                imagenes.forEach(img => {
                    const servicio = img.nombre_servicio || 'Sin servicio';
                    if (!grupos[servicio]) {
                        grupos[servicio] = { id: img.id_servicio, imgs: [] };
                    }
                    grupos[servicio].imgs.push(img);
                });

                // Guardar grupos globalmente para el lightbox
                window.galeriaGrupos = grupos;

                // Mostrar solo la imagen principal de cada servicio (o la primera si no hay principal)
                let html = '';
                Object.keys(grupos).sort().forEach(servicio => {
                    const grupo = grupos[servicio];
                    const principal = grupo.imgs.find(i => i.imagen_principal) || grupo.imgs[0];
                    const count = grupo.imgs.length;

                    html += `
                        <div class="galeria-thumb" onclick="abrirLightbox('${servicio}')">
                            <img src="${principal.url_imagen}" alt="${servicio}" loading="lazy">
                            <div class="galeria-thumb-overlay">
                                <span class="galeria-thumb-title">${servicio}</span>
                                <span class="galeria-thumb-count">${count} foto${count > 1 ? 's' : ''}</span>
                            </div>
                        </div>
                    `;
                });

                grid.innerHTML = html;
            } else {
                mostrarMensaje('error', '❌', 'Error', 'No se pudo cargar la galería');
            }
        })
        .catch(err => console.error(err));
}

// =============================================
// LIGHTBOX GALERÍA
// =============================================
let lightboxIndex = 0;
let lightboxImages = [];

function abrirLightbox(servicio) {
    const grupo = window.galeriaGrupos[servicio];
    if (!grupo) return;

    lightboxImages = grupo.imgs;
    lightboxIndex = 0;

    const modal = document.getElementById('modal-lightbox');
    if (!modal) {
        // Crear modal dinámicamente si no existe
        const modalHTML = `
            <div id="modal-lightbox" class="lightbox-overlay">
                <div class="lightbox-header">
                    <h3 id="lightbox-titulo"></h3>
                    <button class="modal-close" onclick="cerrarLightbox()">✕</button>
                </div>
                <div class="lightbox-body">
                    <button class="lightbox-nav lightbox-prev" onclick="navLightbox(-1)">❮</button>
                    <div class="lightbox-main">
                        <img id="lightbox-img" src="" alt="">
                        <p id="lightbox-desc" class="text-center text-muted mt-2"></p>
                    </div>
                    <button class="lightbox-nav lightbox-next" onclick="navLightbox(1)">❯</button>
                </div>
                <div class="lightbox-thumbs" id="lightbox-thumbs"></div>
                <div class="lightbox-actions">
                    <button class="btn btn-sm btn-secondary" onclick="togglePrincipalLightbox()">⭐ Marcar Principal</button>
                    <button class="btn btn-sm btn-danger" onclick="eliminarImagenLightbox()">🗑️ Eliminar</button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    document.getElementById('lightbox-titulo').textContent = servicio;
    renderLightbox();
    document.getElementById('modal-lightbox').classList.add('active');
}

function cerrarLightbox() {
    document.getElementById('modal-lightbox').classList.remove('active');
}

function renderLightbox() {
    const img = lightboxImages[lightboxIndex];
    document.getElementById('lightbox-img').src = img.url_imagen;
    document.getElementById('lightbox-desc').textContent = img.descripcion || 'Sin descripción';

    // Thumbnails
    const thumbsHTML = lightboxImages.map((i, idx) => `
        <img src="${i.url_imagen}" class="${idx === lightboxIndex ? 'active' : ''} ${i.imagen_principal ? 'principal' : ''}" 
             onclick="lightboxIndex = ${idx}; renderLightbox();">
    `).join('');
    document.getElementById('lightbox-thumbs').innerHTML = thumbsHTML;
}

function navLightbox(dir) {
    lightboxIndex = (lightboxIndex + dir + lightboxImages.length) % lightboxImages.length;
    renderLightbox();
}

function togglePrincipalLightbox() {
    const img = lightboxImages[lightboxIndex];
    toggleImagenPrincipal(img.id_imagen, img.id_servicio, img.imagen_principal);
    cerrarLightbox();
}

function eliminarImagenLightbox() {
    const img = lightboxImages[lightboxIndex];
    confirmarEliminarImagen(img.id_imagen);
    cerrarLightbox();
}

function abrirModalSubirImagen() {
    // Cargar servicios primero
    fetchConToken('/api/servicios?includeAll=true')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const select = document.getElementById('galeria-servicio');
                select.innerHTML = '<option value="">Seleccionar servicio...</option>' +
                    data.servicios.map(s => `<option value="${s.id_servicio}">${s.nombre}</option>`).join('');

                // Reset form
                document.getElementById('form-subir-imagen').reset();
                if (document.getElementById('galeria-preview')) {
                    document.getElementById('galeria-preview').classList.add('hidden');
                }
                document.getElementById('modal-subir-imagen').classList.remove('hidden');
            }
        });
}

function cerrarModalSubirImagen() {
    document.getElementById('modal-subir-imagen').classList.add('hidden');
}

// Preview image on select (Ensure event listener is added only once or handle gracefully)
// We'll trust browser/user to reload script, but better to check if element exists
const galeriaInput = document.getElementById('galeria-archivo');
if (galeriaInput) {
    galeriaInput.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const preview = document.getElementById('galeria-preview');
                if (preview) {
                    preview.classList.remove('hidden');
                    preview.querySelector('img').src = e.target.result;
                }
            }
            reader.readAsDataURL(file);
        }
    });
}

function subirImagen() {
    console.log('DEBUG: Frontend subirImagen clicked');
    const servicio = document.getElementById('galeria-servicio').value;
    const archivo = document.getElementById('galeria-archivo').files[0];
    const descripcion = document.getElementById('galeria-descripcion').value;

    if (!servicio || !archivo) {
        mostrarMensaje('error', '⚠️', 'Faltan datos', 'Selecciona un servicio y una imagen');
        return;
    }

    const formData = new FormData();
    formData.append('id_servicio', servicio);
    formData.append('imagen', archivo);
    formData.append('descripcion', descripcion);

    const token = localStorage.getItem('token');

    // Upload fetch
    fetch('/api/galeria/subir', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        },
        body: formData
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                mostrarMensaje('success', '✓', 'Subida', 'La imagen se guardó correctamente');
                cerrarModalSubirImagen();
                cargarGaleria();
            } else {
                mostrarMensaje('error', '❌', 'Error', data.message || 'Error al subir');
            }
        })
        .catch(err => {
            console.error(err);
            mostrarMensaje('error', '❌', 'Error', 'Fallo de red al subir imagen');
        });
}

function confirmarEliminarImagen(id) {
    mostrarConfirmacion('🗑️', 'Eliminar Imagen', '¿Estás seguro? Esta acción es irreversible.', () => {
        fetchConToken(`/api/galeria/${id}`, { method: 'DELETE' })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    mostrarMensaje('success', '✓', 'Eliminada', 'Imagen borrada correctamente');
                    cargarGaleria();
                } else {
                    mostrarMensaje('error', '❌', 'Error', data.message);
                }
            });
    });
}

function toggleImagenPrincipal(id, idServicio, esPrincipal) {
    if (esPrincipal) return;

    fetchConToken(`/api/galeria/${id}/principal`, {
        method: 'PATCH',
        body: JSON.stringify({ id_servicio: idServicio })
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                cargarGaleria();
            } else {
                mostrarMensaje('error', '❌', 'Error', data.message);
            }
        });
}

// =============================================
// GASTOS - CRUD
// =============================================
async function cargarGastos() {
    const { fechaInicio, fechaFin } = obtenerFechasGastos();
    const tipo = document.getElementById('gastos-filtro-tipo').value;

    if (!fechaInicio || !fechaFin) return;

    let url = `/api/gastos?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`;
    if (tipo) url += `&tipo=${tipo}`;

    try {
        const res = await fetchConToken(url);
        const data = await res.json();

        if (data.success) {
            const tbody = document.getElementById('gastos-tbody');
            const gastos = data.gastos || [];

            // Calcular total
            const total = gastos.reduce((sum, g) => sum + parseFloat(g.monto || 0), 0);
            document.getElementById('gastos-total-display').textContent =
                `Total: $${total.toLocaleString('es-CO')}`;

            if (gastos.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No hay gastos registrados</td></tr>';
                return;
            }

            tbody.innerHTML = gastos.map(g => `
                <tr>
                    <td>${g.fecha_gasto ? g.fecha_gasto.split('T')[0] : '-'}</td>
                    <td>${g.descripcion}</td>
                    <td>
                        <span class="badge ${g.tipo === 'gasto_local' ? 'badge-primary' : 'badge-warning'}">
                            ${g.tipo === 'gasto_local' ? '💼 Local' : '👩 Deducción'}
                        </span>
                    </td>
                    <td>${g.nombre_manicurista || '-'}</td>
                    <td class="text-danger">$${parseFloat(g.monto).toLocaleString('es-CO')}</td>
                    <td>
                        <button class="btn-icon" onclick="editarGasto(${g.id_gasto})" title="Editar">✏️</button>
                        <button class="btn-icon btn-delete" onclick="confirmarEliminarGasto(${g.id_gasto})" title="Eliminar">🗑️</button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error al cargar gastos:', error);
    }
}

async function abrirModalGasto() {
    document.getElementById('modal-gasto-titulo').textContent = 'Nuevo Gasto';
    document.getElementById('form-gasto').reset();
    document.getElementById('gasto-id').value = '';
    document.getElementById('gasto-fecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('grupo-gasto-manicurista').style.display = 'none';

    // Cargar manicuristas
    await cargarManicuristasGasto();

    document.getElementById('modal-gasto').classList.remove('hidden');
}

function cerrarModalGasto() {
    document.getElementById('modal-gasto').classList.add('hidden');
}

function toggleManicuristaGasto() {
    const tipo = document.getElementById('gasto-tipo').value;
    const grupo = document.getElementById('grupo-gasto-manicurista');
    grupo.style.display = tipo === 'deduccion_manicurista' ? 'block' : 'none';
}

async function cargarManicuristasGasto() {
    try {
        const res = await fetchConToken('/api/usuarios');
        const data = await res.json();
        if (data.success) {
            const select = document.getElementById('gasto-manicurista');
            // Filtrar manicuristas por rol (id_rol 2 = manicurista según el usuario)
            const manicuristas = data.usuarios.filter(u =>
                u.id_rol === 2 ||
                (u.rol && u.rol.toLowerCase().includes('manicurista'))
            );
            console.log('Manicuristas encontradas:', manicuristas);
            select.innerHTML = '<option value="">Seleccione...</option>' +
                manicuristas.map(m => `<option value="${m.email}">${m.nombre} ${m.apellido}</option>`).join('');
        }
    } catch (err) {
        console.error(err);
    }
}

async function guardarGasto() {
    const form = document.getElementById('form-gasto');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const id = document.getElementById('gasto-id').value;
    const tipo = document.getElementById('gasto-tipo').value;

    const datos = {
        descripcion: document.getElementById('gasto-descripcion').value,
        monto: document.getElementById('gasto-monto').value,
        tipo: tipo,
        fecha_gasto: document.getElementById('gasto-fecha').value,
        email_manicurista: tipo === 'deduccion_manicurista'
            ? document.getElementById('gasto-manicurista').value
            : null
    };

    if (tipo === 'deduccion_manicurista' && !datos.email_manicurista) {
        mostrarMensaje('warning', '⚠️', 'Requerido', 'Debe seleccionar una manicurista');
        return;
    }

    try {
        const url = id ? `/api/gastos/${id}` : '/api/gastos';
        const method = id ? 'PUT' : 'POST';

        const res = await fetchConToken(url, {
            method,
            body: JSON.stringify(datos)
        });
        const data = await res.json();

        if (data.success) {
            cerrarModalGasto();
            mostrarMensaje('success', '✓', 'Guardado', 'Gasto registrado correctamente');
            cargarGastos();
        } else {
            mostrarMensaje('error', '❌', 'Error', data.message);
        }
    } catch (error) {
        console.error(error);
        mostrarMensaje('error', '❌', 'Error', 'No se pudo guardar el gasto');
    }
}

async function editarGasto(id) {
    try {
        const res = await fetchConToken('/api/gastos');
        const data = await res.json();

        const gasto = data.gastos.find(g => g.id_gasto === id);
        if (!gasto) {
            mostrarMensaje('error', '❌', 'Error', 'Gasto no encontrado');
            return;
        }

        await cargarManicuristasGasto();

        document.getElementById('modal-gasto-titulo').textContent = 'Editar Gasto';
        document.getElementById('gasto-id').value = gasto.id_gasto;
        document.getElementById('gasto-descripcion').value = gasto.descripcion;
        document.getElementById('gasto-monto').value = gasto.monto;
        document.getElementById('gasto-fecha').value = gasto.fecha_gasto ? gasto.fecha_gasto.split('T')[0] : '';
        document.getElementById('gasto-tipo').value = gasto.tipo;
        document.getElementById('gasto-manicurista').value = gasto.email_manicurista || '';

        toggleManicuristaGasto();
        document.getElementById('modal-gasto').classList.remove('hidden');

    } catch (error) {
        console.error(error);
    }
}

function confirmarEliminarGasto(id) {
    mostrarConfirmacion('🗑️', 'Eliminar Gasto', '¿Está seguro de eliminar este gasto?', async () => {
        try {
            const res = await fetchConToken(`/api/gastos/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                mostrarMensaje('success', '✓', 'Eliminado', 'Gasto eliminado correctamente');
                cargarGastos();
            } else {
                mostrarMensaje('error', '❌', 'Error', data.message);
            }
        } catch (error) {
            console.error(error);
        }
    });
}

// =============================================
// DASHBOARD FINANCIERO
// =============================================
let dashboardChart = null;

// Obtener fechas según período seleccionado (Dashboard)
function obtenerFechasDashboard() {
    const periodo = document.getElementById('dash-filtro-periodo').value;
    const hoy = new Date();
    let fechaInicio, fechaFin;

    switch (periodo) {
        case 'semana':
            // Obtener del selector de semana
            const semanaSelect = document.getElementById('dash-filtro-semana');
            if (semanaSelect.value) {
                const [desde, hasta] = semanaSelect.value.split('|');
                fechaInicio = desde;
                fechaFin = hasta;
            } else {
                // Fallback a semana actual
                const inicioSemana = new Date(hoy);
                const diaSemana = inicioSemana.getDay();
                const diff = diaSemana === 0 ? -6 : 1 - diaSemana;
                inicioSemana.setDate(inicioSemana.getDate() + diff);
                fechaInicio = inicioSemana.toISOString().split('T')[0];
                const finSemana = new Date(inicioSemana);
                finSemana.setDate(finSemana.getDate() + 6);
                fechaFin = finSemana.toISOString().split('T')[0];
            }
            break;
        case 'mes':
            // Mes seleccionado en los dropdowns
            const mes = document.getElementById('dash-filtro-mes').value;
            const anio = document.getElementById('dash-filtro-anio').value;
            // Primer día del mes
            fechaInicio = `${anio}-${mes.padStart(2, '0')}-01`;
            // Último día del mes
            const ultimoDia = new Date(anio, mes, 0).getDate();
            fechaFin = `${anio}-${mes.padStart(2, '0')}-${ultimoDia}`;
            break;
        case 'rango':
            fechaInicio = document.getElementById('dash-fecha-inicio').value;
            fechaFin = document.getElementById('dash-fecha-fin').value;
            break;
    }

    return { fechaInicio, fechaFin };
}

function cambiarPeriodoDashboard() {
    const periodo = document.getElementById('dash-filtro-periodo').value;
    const grupoMes = document.getElementById('dash-grupo-mes');
    const grupoSemana = document.getElementById('dash-grupo-semana');
    const grupoAnio = document.getElementById('dash-grupo-anio');
    const grupoRango = document.getElementById('dash-grupo-rango');

    // Ocultar todos
    grupoMes.style.display = 'none';
    grupoSemana.style.display = 'none';
    grupoAnio.style.display = 'none';
    grupoRango.style.display = 'none';

    if (periodo === 'mes') {
        grupoMes.style.display = 'flex';
        grupoAnio.style.display = 'flex';
    } else if (periodo === 'semana') {
        grupoSemana.style.display = 'flex';
        grupoAnio.style.display = 'flex';
        poblarSemanasDashboard();
    } else if (periodo === 'rango') {
        grupoRango.style.display = 'flex';
        const hoy = new Date();
        if (!document.getElementById('dash-fecha-inicio').value) {
            document.getElementById('dash-fecha-inicio').value = hoy.toISOString().split('T')[0];
        }
        if (!document.getElementById('dash-fecha-fin').value) {
            document.getElementById('dash-fecha-fin').value = hoy.toISOString().split('T')[0];
        }
    }
}

function poblarSemanasDashboard() {
    const selectSemana = document.getElementById('dash-filtro-semana');
    const anio = document.getElementById('dash-filtro-anio').value || new Date().getFullYear();

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

        const option = document.createElement('option');
        option.value = `${desde}|${hasta}`;
        option.textContent = `Semana ${numSemana}: ${formatearFechaCorta(semanaActual)} - ${formatearFechaCorta(finSemana)}`;
        selectSemana.appendChild(option);

        semanaActual.setDate(semanaActual.getDate() + 7);
        numSemana++;
    }

    // Seleccionar la semana actual
    const hoy = new Date();
    const opciones = selectSemana.options;
    for (let i = 0; i < opciones.length; i++) {
        const [desde, hasta] = opciones[i].value.split('|');
        if (hoy >= new Date(desde) && hoy <= new Date(hasta)) {
            selectSemana.selectedIndex = i;
            break;
        }
    }
}

// Cargar lista de manicuristas para el filtro
async function cargarManicuristasFiltro() {
    try {
        const res = await fetchConToken('/api/usuarios');
        const data = await res.json();

        if (data.success) {
            const select = document.getElementById('dash-filtro-manicurista');

            // Limpiar opciones existentes (excepto la primera "Todas")
            select.innerHTML = '<option value="">Todas</option>';

            // Filtrar solo manicuristas (id_rol = 2) y activos
            data.usuarios
                .filter(u => u.id_rol === 2 && u.activo === 1)
                .forEach(m => {
                    const option = document.createElement('option');
                    option.value = m.email;
                    option.textContent = `${m.nombre} ${m.apellido}`;
                    select.appendChild(option);
                });
        }
    } catch (error) {
        console.error('Error cargando manicuristas:', error);
    }
}


async function cargarDashboard() {
    const { fechaInicio, fechaFin } = obtenerFechasDashboard();

    if (!fechaInicio || !fechaFin) {
        return; // Esperar a que el usuario complete filtros si faltan
    }

    // Obtener filtro de manicurista
    const emailManicurista = document.getElementById('dash-filtro-manicurista').value;

    // Cargar métricas
    await cargarMetricasDashboard(fechaInicio, fechaFin, emailManicurista);
    // Cargar gráfico (pasamos el año de la fecha de inicio para contexto, o el año seleccionado)
    await cargarGraficoDashboard(fechaInicio.split('-')[0]);
    // Cargar resumen manicuristas
    await cargarResumenManicuristas(fechaInicio, fechaFin, emailManicurista);
    // Cargar cuadre de caja (incluye la tabla detalle)
    await cargarCuadreCaja(fechaInicio, fechaFin, emailManicurista);
}

async function cargarMetricasDashboard(fechaInicio, fechaFin, emailManicurista = '') {
    try {
        let url = `/api/dashboard/metricas?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`;
        if (emailManicurista) url += `&email_manicurista=${emailManicurista}`;

        const res = await fetchConToken(url);
        const data = await res.json();

        if (data.success) {
            const m = data.metricas;

            // Actualizar widgets
            document.getElementById('dash-ingresos').textContent =
                `$${m.ingresos.total.toLocaleString('es-CO')}`;
            document.getElementById('dash-ingresos-cant').textContent =
                `${m.ingresos.cantidad} pagos`;

            document.getElementById('dash-gastos').textContent =
                `$${m.gastos.total.toLocaleString('es-CO')}`;
            document.getElementById('dash-gastos-detalle').textContent =
                `Local: $${m.gastos.local.toLocaleString('es-CO')} | Deducciones: $${m.gastos.deducciones.toLocaleString('es-CO')}`;

            document.getElementById('dash-comisiones').textContent =
                `$${m.comisiones.total.toLocaleString('es-CO')}`;

            const balanceEl = document.getElementById('dash-balance');
            balanceEl.textContent = `$${m.balance.toLocaleString('es-CO')}`;
            balanceEl.style.color = m.balance >= 0 ? '#28a745' : '#dc3545';

            // Citas
            document.getElementById('dash-citas-total').textContent = m.citas.total;
            document.getElementById('dash-citas-completadas').textContent = m.citas.completadas;
            document.getElementById('dash-citas-canceladas').textContent = m.citas.canceladas;
            document.getElementById('dash-citas-pendientes').textContent = m.citas.pendientes;
        }
    } catch (error) {
        console.error('Error cargando métricas:', error);
    }
}

async function cargarGraficoDashboard(anio) {
    try {
        const res = await fetchConToken(`/api/dashboard/grafico?anio=${anio}`);
        const data = await res.json();

        if (data.success) {
            const ctx = document.getElementById('chart-ingresos-gastos').getContext('2d');

            // Destruir chart anterior si existe
            if (dashboardChart) {
                dashboardChart.destroy();
            }

            dashboardChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: data.grafico.labels,
                    datasets: [
                        {
                            label: 'Ingresos',
                            data: data.grafico.datasets.ingresos,
                            backgroundColor: 'rgba(40, 167, 69, 0.7)',
                            borderColor: '#28a745',
                            borderWidth: 1
                        },
                        {
                            label: 'Gastos',
                            data: data.grafico.datasets.gastos,
                            backgroundColor: 'rgba(220, 53, 69, 0.7)',
                            borderColor: '#dc3545',
                            borderWidth: 1
                        },
                        {
                            label: 'Comisiones',
                            data: data.grafico.datasets.comisiones,
                            backgroundColor: 'rgba(255, 193, 7, 0.7)',
                            borderColor: '#ffc107',
                            borderWidth: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function (value) {
                                    return '$' + value.toLocaleString('es-CO');
                                }
                            }
                        }
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error cargando gráfico:', error);
    }
}

async function cargarResumenManicuristas(fechaInicio, fechaFin, emailManicurista = '') {
    try {
        let url = `/api/dashboard/manicuristas?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`;
        if (emailManicurista) url += `&email_manicurista=${emailManicurista}`;

        const res = await fetchConToken(url);
        const data = await res.json();

        if (data.success) {
            const tbody = document.getElementById('dash-manicuristas-tbody');

            if (data.resumen.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Sin datos para el período</td></tr>';
                // Reset totals
                document.getElementById('dash-man-total-servicios').textContent = '0';
                document.getElementById('dash-man-total-ingresos').textContent = '$0';
                document.getElementById('dash-man-total-comision').textContent = '$0';
                document.getElementById('dash-man-total-deducciones').textContent = '$0';
                document.getElementById('dash-man-total-pagar').textContent = '$0';
                return;
            }

            // Calcular totales
            let totalServicios = 0;
            let totalIngresos = 0;
            let totalComision = 0;
            let totalDeducciones = 0;
            let totalPagar = 0;

            tbody.innerHTML = data.resumen.map(m => {
                const comision = parseFloat(m.comision_total);
                const deducciones = parseFloat(m.deducciones);
                const totalAPagar = comision - deducciones;

                // Acumular totales
                totalServicios += parseInt(m.cantidad_servicios);
                totalIngresos += parseFloat(m.ingresos_generados);
                totalComision += comision;
                totalDeducciones += deducciones;
                totalPagar += totalAPagar;

                return `
                <tr>
                    <td><strong>${formatearFechaSinTZ(m.fecha)}</strong></td>
                    <td>${m.nombre_manicurista}</td>
                    <td>${m.cantidad_servicios}</td>
                    <td class="text-success">$${parseFloat(m.ingresos_generados).toLocaleString('es-CO')}</td>
                    <td class="text-warning">$${comision.toLocaleString('es-CO')}</td>
                    <td class="text-danger">$${deducciones.toLocaleString('es-CO')}</td>
                    <td><strong style="color: #007bff;">$${totalAPagar.toLocaleString('es-CO')}</strong></td>
                </tr>
                `;
            }).join('');

            // Actualizar footer con totales
            document.getElementById('dash-man-total-servicios').textContent = totalServicios;
            document.getElementById('dash-man-total-ingresos').textContent = `$${totalIngresos.toLocaleString('es-CO')}`;
            document.getElementById('dash-man-total-comision').textContent = `$${totalComision.toLocaleString('es-CO')}`;
            document.getElementById('dash-man-total-deducciones').textContent = `$${totalDeducciones.toLocaleString('es-CO')}`;
            document.getElementById('dash-man-total-pagar').textContent = `$${totalPagar.toLocaleString('es-CO')}`;
        }
    } catch (error) {
        console.error('Error cargando resumen manicuristas:', error);
    }
}

// Cuadre de Caja
async function cargarCuadreCaja(fechaInicio, fechaFin, emailManicurista = '') {
    try {
        let url = `/api/dashboard/cuadre?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`;
        if (emailManicurista) url += `&email_manicurista=${emailManicurista}`;
        const res = await fetchConToken(url);
        const data = await res.json();

        if (data.success) {
            const c = data.cuadre;

            // Total
            document.getElementById('cuadre-total').textContent = `$${c.total.toLocaleString('es-CO')}`;

            // Por método
            const updateMetodo = (id, metodoData) => {
                document.getElementById(`cuadre-${id}`).textContent = `$${metodoData.total.toLocaleString('es-CO')}`;
                document.getElementById(`cuadre-${id}-count`).textContent = `${metodoData.cantidad} pagos`;
            };

            updateMetodo('efectivo', c.metodos.efectivo);
            updateMetodo('transferencia', c.metodos.transferencia);

            // Gastos y debe efectivo
            document.getElementById('cuadre-gastos-periodo').textContent = `$${c.gastos.toLocaleString('es-CO')}`;
            const debeEl = document.getElementById('cuadre-debe-efectivo');
            debeEl.textContent = `$${c.debeEfectivo.toLocaleString('es-CO')}`;
            debeEl.style.color = c.debeEfectivo >= 0 ? '#28a745' : '#dc3545';
        }

        // Cargar tabla detalle pagos
        await cargarDetallePagos(fechaInicio, fechaFin, emailManicurista);

    } catch (error) {
        console.error('Error cargando cuadre de caja:', error);
    }
}

async function cargarDetallePagos(fechaInicio, fechaFin, emailManicurista = '') {
    try {
        let url = `/api/dashboard/detalle-pagos?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`;
        if (emailManicurista) url += `&email_manicurista=${emailManicurista}`;
        const res = await fetchConToken(url);
        const data = await res.json();
        const tbody = document.getElementById('cuadre-tabla-tbody');

        if (data.success) {
            if (data.resumen.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay datos en este período</td></tr>';
                document.getElementById('cuadre-tabla-total-ingresos').textContent = '$0';
                document.getElementById('cuadre-tabla-total-gastos').textContent = '$0';
                document.getElementById('cuadre-tabla-total-efectivo').textContent = '$0';
                document.getElementById('cuadre-tabla-total-transferencia').textContent = '$0';
                return;
            }

            let totalIngresos = 0;
            let totalGastos = 0;
            let totalEfectivo = 0;
            let totalTransferencia = 0;

            tbody.innerHTML = data.resumen.map(dia => {
                totalIngresos += dia.total_ingresos;
                totalGastos += dia.total_gastos;
                totalEfectivo += dia.efectivo;
                totalTransferencia += dia.transferencia;

                return `
                <tr>
                    <td><strong>${formatearFechaSinTZ(dia.fecha)}</strong></td>
                    <td class="text-success">$${dia.total_ingresos.toLocaleString('es-CO')}</td>
                    <td class="text-danger">$${dia.total_gastos.toLocaleString('es-CO')}</td>
                    <td>$${dia.efectivo.toLocaleString('es-CO')}</td>
                    <td>$${dia.transferencia.toLocaleString('es-CO')}</td>
                </tr>
                `;
            }).join('');

            // Actualizar totales
            document.getElementById('cuadre-tabla-total-ingresos').innerHTML = `<strong>$${totalIngresos.toLocaleString('es-CO')}</strong>`;
            document.getElementById('cuadre-tabla-total-gastos').innerHTML = `<strong>$${totalGastos.toLocaleString('es-CO')}</strong>`;
            document.getElementById('cuadre-tabla-total-efectivo').innerHTML = `<strong>$${totalEfectivo.toLocaleString('es-CO')}</strong>`;
            document.getElementById('cuadre-tabla-total-transferencia').innerHTML = `<strong>$${totalTransferencia.toLocaleString('es-CO')}</strong>`;
        }
    } catch (error) {
        console.error('Error al cargar detalle de pagos:', error);
    }
}


// =============================================
// LOGICA DE FILTROS GASTOS (Similar a Dashboard/Comisiones)
// =============================================
function cambiarPeriodoGastos() {
    const periodo = document.getElementById('gastos-filtro-periodo').value;
    const grupoMes = document.getElementById('gastos-grupo-mes');
    const grupoSemana = document.getElementById('gastos-grupo-semana');
    const grupoAnio = document.getElementById('gastos-grupo-anio');
    const grupoRango = document.getElementById('gastos-grupo-rango');

    grupoMes.style.display = 'none';
    grupoSemana.style.display = 'none';
    grupoAnio.style.display = 'none';
    grupoRango.style.display = 'none';

    if (periodo === 'mes') {
        grupoMes.style.display = 'flex';
        grupoAnio.style.display = 'flex';
    } else if (periodo === 'semana') {
        grupoSemana.style.display = 'flex';
        grupoAnio.style.display = 'flex';
        poblarSemanasGastos();
    } else if (periodo === 'rango') {
        grupoRango.style.display = 'flex';
        const hoy = new Date();
        if (!document.getElementById('gastos-fecha-inicio').value) {
            document.getElementById('gastos-fecha-inicio').value = hoy.toISOString().split('T')[0];
        }
        if (!document.getElementById('gastos-fecha-fin').value) {
            document.getElementById('gastos-fecha-fin').value = hoy.toISOString().split('T')[0];
        }
    }
}

function poblarSemanasGastos() {
    const selectSemana = document.getElementById('gastos-filtro-semana');
    const anio = document.getElementById('gastos-filtro-anio').value || new Date().getFullYear();

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

        const option = document.createElement('option');
        option.value = `${desde}|${hasta}`;
        option.textContent = `Semana ${numSemana}: ${formatearFechaCorta(semanaActual)} - ${formatearFechaCorta(finSemana)}`;
        selectSemana.appendChild(option);

        semanaActual.setDate(semanaActual.getDate() + 7);
        numSemana++;
    }

    // Seleccionar la semana actual
    const hoy = new Date();
    const opciones = selectSemana.options;
    for (let i = 0; i < opciones.length; i++) {
        const [desde, hasta] = opciones[i].value.split('|');
        if (hoy >= new Date(desde) && hoy <= new Date(hasta)) {
            selectSemana.selectedIndex = i;
            break;
        }
    }
}

function obtenerFechasGastos() {
    const periodo = document.getElementById('gastos-filtro-periodo').value;
    const hoy = new Date();
    let fechaInicio, fechaFin;

    switch (periodo) {
        case 'semana':
            // Obtener del selector de semana
            const semanaSelect = document.getElementById('gastos-filtro-semana');
            if (semanaSelect.value) {
                const [desde, hasta] = semanaSelect.value.split('|');
                fechaInicio = desde;
                fechaFin = hasta;
            } else {
                // Fallback a semana actual
                const inicioSemana = new Date(hoy);
                const diaSemana = inicioSemana.getDay();
                const diff = diaSemana === 0 ? -6 : 1 - diaSemana;
                inicioSemana.setDate(inicioSemana.getDate() + diff);
                fechaInicio = inicioSemana.toISOString().split('T')[0];
                const finSemana = new Date(inicioSemana);
                finSemana.setDate(finSemana.getDate() + 6);
                fechaFin = finSemana.toISOString().split('T')[0];
            }
            break;
        case 'mes':
            const mes = document.getElementById('gastos-filtro-mes').value;
            const anio = document.getElementById('gastos-filtro-anio').value;
            fechaInicio = `${anio}-${mes.padStart(2, '0')}-01`;
            const ultimoDia = new Date(anio, mes, 0).getDate();
            fechaFin = `${anio}-${mes.padStart(2, '0')}-${ultimoDia}`;
            break;
        case 'rango':
            fechaInicio = document.getElementById('gastos-fecha-inicio').value;
            fechaFin = document.getElementById('gastos-fecha-fin').value;
            break;
    }
    return { fechaInicio, fechaFin };
}

/* =============================================
   RESPONSIVE MENU LOGIC
   ============================================= */
document.addEventListener('DOMContentLoaded', function () {
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const sidebarBackdrop = document.getElementById('sidebar-backdrop');
    const navItems = document.querySelectorAll('.nav-item');

    function toggleSidebar() {
        if (!sidebar || !mobileMenuToggle) return;

        const isOpened = sidebar.classList.contains('sidebar-open');

        if (isOpened) {
            sidebar.classList.remove('sidebar-open');
            sidebarBackdrop.classList.remove('active');
            mobileMenuToggle.classList.remove('active');
            document.body.style.overflow = '';
        } else {
            sidebar.classList.add('sidebar-open');
            sidebarBackdrop.classList.add('active');
            mobileMenuToggle.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    // Toggle button click
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', function (e) {
            e.stopPropagation();
            toggleSidebar();
        });
    }

    // Backdrop click
    if (sidebarBackdrop) {
        sidebarBackdrop.addEventListener('click', function () {
            if (sidebar.classList.contains('sidebar-open')) {
                toggleSidebar();
            }
        });
    }

    // Close menu when clicking nav items on mobile
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth <= 1024 && sidebar.classList.contains('sidebar-open')) {
                toggleSidebar();
            }
        });
    });

    // Handle resize
    window.addEventListener('resize', () => {
        if (window.innerWidth > 1024) {
            sidebar.classList.remove('sidebar-open');
            sidebarBackdrop.classList.remove('active');
            mobileMenuToggle.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
});

/* =============================================
   RENDERIZADO AGENDA MÓVIL
   ============================================= */
function renderizarAgendaMovil(citas) {
    const mobileViewId = 'agenda-mobile-view';
    let mobileView = document.getElementById(mobileViewId);

    // Si no es móvil, no hacer nada
    if (window.innerWidth > 767) return;

    // Ocultar grids desktop
    document.getElementById('calendario-semanal-grid').classList.add('hidden');
    document.getElementById('calendario-mensual-grid').classList.add('hidden');

    // Crear/Limpiar contenedor móvil
    if (mobileView) mobileView.remove();
    mobileView = document.createElement('div');
    mobileView.id = mobileViewId;
    mobileView.className = 'agenda-mobile-view';

    // Insertar después del header
    const header = document.querySelector('.agenda-header');
    header.parentNode.insertBefore(mobileView, header.nextSibling);

    if (!citas || citas.length === 0) {
        mobileView.innerHTML = '<div class="empty-state"><p>No hay citas para este periodo</p></div>';
        return;
    }

    // Calcular Hoy
    const hoyObj = new Date();
    const hoyStr = formatearFechaISO(hoyObj);

    // Agrupar citas por fecha (YYYY-MM-DD)
    const citasPorFecha = {};
    citas.forEach(cita => {
        const fechaKey = cita.fecha.split('T')[0];
        if (!citasPorFecha[fechaKey]) citasPorFecha[fechaKey] = [];
        citasPorFecha[fechaKey].push(cita);
    });

    // Obtener claves de fechas ordenadas
    let fechasOrdenadas = Object.keys(citasPorFecha).sort();

    // FILTRO: Si es "Solo Hoy", filtrar solo la fecha de hoy
    if (window.mobileSoloHoy) {
        if (citasPorFecha[hoyStr]) {
            fechasOrdenadas = [hoyStr];
        } else {
            mobileView.innerHTML = '<div class="empty-state"><p>No hay citas para hoy.</p></div>';
            return;
        }
    }

    // Renderizar grupos
    fechasOrdenadas.forEach(fechaKey => {
        const citasDia = citasPorFecha[fechaKey];
        // Ordenar por hora
        citasDia.sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));

        // Header del día
        const fechaObj = new Date(fechaKey + 'T12:00:00');
        const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const esHoy = fechaKey === hoyStr;
        const diaNombre = dias[fechaObj.getDay()];
        const diaNum = fechaObj.getDate();

        const groupDiv = document.createElement('div');
        groupDiv.className = `mobile-day-group ${esHoy ? 'today' : ''}`;
        groupDiv.style.marginBottom = '20px';

        groupDiv.innerHTML = `
            <h4 style="margin-bottom: 10px; border-bottom: 2px solid #ddd; padding-bottom: 5px; color: ${esHoy ? 'var(--primary-color)' : '#333'}">
                ${diaNombre} ${diaNum} ${esHoy ? '(Hoy)' : ''}
            </h4>
        `;

        citasDia.forEach(cita => {
            const colorBorde = obtainingColorByState(cita.estado);

            const card = document.createElement('div');
            card.className = 'agenda-card';
            card.style.borderLeft = `5px solid ${colorBorde}`;
            card.style.marginBottom = '10px';
            card.style.padding = '10px';
            card.style.backgroundColor = 'white';
            card.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            card.style.borderRadius = '4px';

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span style="font-weight: bold; color: var(--primary-color);">
                        ${cita.hora_inicio.substring(0, 5)} - ${cita.hora_fin.substring(0, 5)}
                    </span>
                    <span class="badge badge-${cita.estado}" style="font-size: 0.75em;">
                        ${cita.estado}
                    </span>
                </div>
                <div style="font-size: 0.95em;">
                    <div>👤 <strong>${cita.nombre_cliente}</strong></div>
                    <div>💅 ${cita.nombre_servicio}</div>
                    <div style="margin-top:2px; font-size:0.9em; color:#666;">
                        👩‍🦰 ${cita.nombre_manicurista.split(' ')[0]}
                    </div>
                </div>
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee;">
                    <button class="btn btn-sm btn-outline-primary" style="width:100%" onclick="editarCita(${cita.id_cita})">
                        ✏️ Editar
                    </button>
                </div>
            `;
            groupDiv.appendChild(card);
        });

        mobileView.appendChild(groupDiv);
    });
}

// Helper local para colores
function obtainingColorByState(estado) {
    if (estado === 'confirmada') return '#17a2b8';
    if (estado === 'completada') return '#28a745';
    if (estado === 'cancelada') return '#dc3545';
    return '#ffc107';
}

// Escuchar resize para actualizar vista si es necesario
window.addEventListener('resize', () => {
    // Si estamos en la sección agenda
    if (document.getElementById('seccion-agenda').classList.contains('active')) {
        // Recargar agenda para disparar la lógica de vista
        cargarAgenda();
    }
});

// =============================================
// SOCKET.IO LISTENERS (Actualización en Vivo Admin)
// =============================================
if (socket) {
    // 1. Recargar Dashboard General (Métricas)
    // Se dispara con casi cualquier evento financiero
    function actualizarDashboardSiVisible() {
        const seccionPanel = document.getElementById('seccion-dashboard');
        if (seccionPanel && seccionPanel.classList.contains('active')) {
            cargarDashboard();
        }
    }

    // 2. Comisiones
    socket.on('comisiones_actualizadas', (data) => {
        console.log('🔔 Socket: Comisiones actualizadas', data);
        actualizarDashboardSiVisible();

        // Si estamos en seccion comisiones
        const seccionComisiones = document.getElementById('seccion-comisiones');
        if (seccionComisiones && seccionComisiones.classList.contains('active')) {
            if (typeof aplicarFiltrosComisiones === 'function') aplicarFiltrosComisiones();
        }

        // Si estamos en auditoría (conciliación)
        const seccionConciliacion = document.getElementById('seccion-conciliacion');
        if (seccionConciliacion && seccionConciliacion.classList.contains('active')) {
            if (typeof cargarConciliacion === 'function') cargarConciliacion();
        }
    });

    // 3. Gastos (incluye deducciones)
    socket.on('gastos_actualizados', (data) => {
        console.log('🔔 Socket: Gastos actualizados', data);
        actualizarDashboardSiVisible();

        // Si estamos en seccion comisiones (por deducciones)
        const seccionComisiones = document.getElementById('seccion-comisiones');
        if (seccionComisiones && seccionComisiones.classList.contains('active')) {
            if (typeof aplicarFiltrosComisiones === 'function') aplicarFiltrosComisiones();
        }

        // Si estamos en seccion gastos
        const seccionGastos = document.getElementById('seccion-gastos');
        if (seccionGastos && seccionGastos.classList.contains('active')) {
            // Intentar cargar gastos si la funcion existe, sino reload parcial
            if (typeof cargarGastosTabla === 'function') cargarGastosTabla();
            else if (typeof cargarGastos === 'function') cargarGastos();
        }

        // Si estamos en auditoría
        const seccionConciliacion = document.getElementById('seccion-conciliacion');
        if (seccionConciliacion && seccionConciliacion.classList.contains('active')) {
            if (typeof cargarConciliacion === 'function') cargarConciliacion();
        }
    });

    // 4. Reportes (Cuadre Diario)
    socket.on('reporte_actualizado', (data) => {
        console.log('🔔 Socket: Reporte actualizado', data);
        // Auditoría se alimenta de esto
        const seccionConciliacion = document.getElementById('seccion-conciliacion');
        if (seccionConciliacion && seccionConciliacion.classList.contains('active')) {
            if (typeof cargarConciliacion === 'function') cargarConciliacion();
        }
    });

    // 5. Citas / Agenda / Agendamiento
    socket.on('calendario_actualizado', (data) => {
        console.log('🔔 Socket: Calendario actualizado', data);
        actualizarDashboardSiVisible();

        // Si estamos en Agendamiento (Tabla)
        const seccionAgendamiento = document.getElementById('seccion-agendamiento');
        if ((seccionAgendamiento && seccionAgendamiento.classList.contains('active')) ||
            document.getElementById('tabla-citas').offsetParent !== null) { // Check visibility

            // Si la función de aplicar filtros existe, usarla para recargar manteniendo filtros
            if (typeof aplicarFiltros === 'function') {
                aplicarFiltros();
            } else if (typeof cargarCitas === 'function') {
                cargarCitas();
            }
        }

        // Si estamos en Agenda (Calendario)
        const seccionAgenda = document.getElementById('seccion-agenda');
        if (seccionAgenda && seccionAgenda.classList.contains('active')) {
            if (typeof cargarAgenda === 'function') cargarAgenda();
        }
    });

    console.log('🟢 Listeners de Sockets activados en Dashboard Admin');
}
// =============================================
// LOGICA DE CONCILIACIÓN
// =============================================


