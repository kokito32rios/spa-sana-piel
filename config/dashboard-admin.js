// Variables globales
let token = localStorage.getItem('token');
let usuarioActual = null;

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
// CAMBIAR SECCIÓN
// =============================================
function cambiarSeccion(seccion) {
    // Actualizar nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    event.currentTarget.classList.add('active');
    
    // Actualizar secciones
    document.querySelectorAll('.content-section').forEach(s => {
        s.classList.remove('active');
    });
    document.getElementById(`seccion-${seccion}`).classList.add('active');
    
    // Actualizar título
    const titulos = {
        'agendamiento': 'Gestión de Agendamiento',
        'servicios': 'Gestión de Servicios',
        'usuarios': 'Gestión de Usuarios',
        'comisiones': 'Gestión de Comisiones',
        'galeria': 'Gestión de Galería'
    };
    document.getElementById('section-title').textContent = titulos[seccion];
    
    // Cargar datos según sección
    if (seccion === 'agendamiento') {
        cargarCitas();
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
        const fecha = document.getElementById('filtro-fecha').value;
        const estado = document.getElementById('filtro-estado').value;
        const manicurista = document.getElementById('filtro-manicurista').value;
        
        if (fecha) params.append('fecha', fecha);
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
        
        return `
            <tr>
                <td>${formatearFecha(cita.fecha)}</td>
                <td>${formatearHora(cita.hora_inicio)} - ${formatearHora(cita.hora_fin)}</td>
                <td>
                    <strong>${cita.nombre_cliente}</strong><br>
                    <small>${cita.telefono_cliente}</small>
                </td>
                <td>${cita.nombre_servicio}</td>
                <td>${cita.nombre_manicurista}</td>
                <td><span class="badge ${estadoBadge}">${capitalize(cita.estado)}</span></td>
                <td>
                    <div class="table-actions">
                        <button class="btn-icon btn-edit" onclick="editarCita(${cita.id_cita})" title="Editar">
                            ✏️
                        </button>
                        <button class="btn-icon btn-delete" onclick="confirmarCancelar(${cita.id_cita})" title="Cancelar">
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
    
    // Deshabilitar botón guardar hasta que se seleccione horario
    document.getElementById('btn-guardar-cita').disabled = true;
    
    // Cargar datos
    await cargarClientes();
    await cargarManicuristas();
    await cargarServiciosSelect();
    
    // Establecer fecha mínima (hoy)
    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById('cita-fecha').min = hoy;
    
    // Mostrar modal
    const modal = document.getElementById('modal-cita');
    modal.classList.remove('hidden');
    
    // Scroll al top del modal
    setTimeout(() => {
        modal.scrollTop = 0;
    }, 100);
}

// =============================================
// CARGAR CLIENTES
// =============================================
async function cargarClientes() {
    try {
        const response = await fetchConToken('/api/citas/helpers/clientes');
        const data = await response.json();
        
        const select = document.getElementById('cita-cliente');
        select.innerHTML = '<option value="">Seleccionar cliente</option>' +
            data.clientes.map(c => 
                `<option value="${c.email}">${c.nombre_completo}</option>`
            ).join('');
            
    } catch (error) {
        console.error('Error:', error);
    }
}

// =============================================
// CARGAR MANICURISTAS
// =============================================
async function cargarManicuristas() {
    try {
        const response = await fetchConToken('/api/citas/helpers/manicuristas');
        const data = await response.json();
        
        const select = document.getElementById('cita-manicurista');
        const selectFiltro = document.getElementById('filtro-manicurista');
        
        const options = data.manicuristas.map(m => 
            `<option value="${m.email}">${m.nombre_completo}</option>`
        ).join('');
        
        select.innerHTML = '<option value="">Seleccionar manicurista</option>' + options;
        selectFiltro.innerHTML = '<option value="">Todas</option>' + options;
        
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
                `<option value="${s.id_servicio}">${s.nombre} ($${s.precio.toLocaleString()} - ${s.duracion_minutos} min)</option>`
            ).join('');
            
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
    
    const datos = {
        email_cliente: document.getElementById('cita-cliente').value,
        email_manicurista: document.getElementById('cita-manicurista').value,
        id_servicio: document.getElementById('cita-servicio').value,
        fecha: document.getElementById('cita-fecha').value,
        hora_inicio: hora + ':00',
        notas_cliente: document.getElementById('cita-notas-cliente').value
    };
    
    // Si es edición
    if (id) {
        datos.estado = document.getElementById('cita-estado').value;
        datos.notas_manicurista = document.getElementById('cita-notas-manicurista').value;
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
            cerrarModalCita();
            mostrarMensaje('success', '✓', 'Éxito', data.message);
            cargarCitas();
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
// MOSTRAR MENSAJE
// =============================================
function mostrarMensaje(tipo, icono, titulo, mensaje) {
    // Validar que haya contenido
    if (!tipo || !icono || !titulo || !mensaje) {
        console.error('Faltan parámetros para mostrar el mensaje');
        return;
    }
    
    const modal = document.getElementById('modal-mensaje');
    const iconElement = document.getElementById('mensaje-icon');
    const tituloElement = document.getElementById('mensaje-titulo');
    const textoElement = document.getElementById('mensaje-texto');
    
    // Validar que existan los elementos
    if (!modal || !iconElement || !tituloElement || !textoElement) {
        console.error('Elementos del modal no encontrados');
        return;
    }
    
    iconElement.textContent = icono;
    iconElement.className = `modal-icon ${tipo}`;
    tituloElement.textContent = titulo;
    textoElement.textContent = mensaje;
    
    modal.classList.remove('hidden');
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
        // Obtener datos de la cita
        const response = await fetchConToken('/api/citas');
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
        document.getElementById('cita-cliente').value = cita.email_cliente;
        document.getElementById('cita-manicurista').value = cita.email_manicurista;
        document.getElementById('cita-servicio').value = cita.id_servicio;
        
        // Formatear fecha correctamente para input type="date" (YYYY-MM-DD)
        const fechaFormateada = cita.fecha.split('T')[0];
        document.getElementById('cita-fecha').value = fechaFormateada;
        
        const horaActual = cita.hora_inicio.substring(0, 5);
        
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
        document.getElementById('cita-notas-cliente').value = cita.notas_cliente || '';
        document.getElementById('cita-notas-manicurista').value = cita.notas_manicurista || '';
        
        // Mostrar modal
        document.getElementById('modal-cita').classList.remove('hidden');
        
    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('error', '❌', 'Error', 'No se pudo cargar la cita');
    }
}

// =============================================
// CONFIRMAR CANCELAR CITA
// =============================================
function confirmarCancelar(idCita) {
    mostrarConfirmacion(
        '¿Cancelar cita?',
        '¿Estás seguro de que deseas cancelar esta cita? Esta acción cambiará el estado a "cancelada".',
        () => cancelarCita(idCita)
    );
}

// =============================================
// CONFIRMAR ELIMINAR CITA
// =============================================
function confirmarEliminar(idCita) {
    mostrarConfirmacion(
        '⚠️ ¿Eliminar cita?',
        'Esta acción eliminará permanentemente la cita de la base de datos. ¿Estás seguro?',
        () => eliminarCita(idCita)
    );
}

// =============================================
// CANCELAR CITA (cambia estado a cancelada)
// =============================================
async function cancelarCita(idCita) {
    try {
        const response = await fetchConToken(`/api/citas/${idCita}`, {
            method: 'PUT',
            body: JSON.stringify({ estado: 'cancelada' })
        });
        
        const data = await response.json();
        
        if (data.success) {
            mostrarMensaje('success', '✓', 'Éxito', 'Cita cancelada exitosamente');
            cargarCitas();
        } else {
            mostrarMensaje('error', '❌', 'Error', data.message);
        }
        
    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('error', '❌', 'Error', 'No se pudo cancelar la cita');
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
// MOSTRAR CONFIRMACIÓN
// =============================================
function mostrarConfirmacion(titulo, mensaje, callback) {
    const confirmar = confirm(`${titulo}\n\n${mensaje}`);
    if (confirmar) {
        callback();
    }
}

// =============================================
// CERRAR SESIÓN
// =============================================
function cerrarSesion() {
    localStorage.removeItem('token');
    window.location.href = '/login.html';
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
    
    if (!manicurista || !fecha || !servicio) {
        selectHora.disabled = true;
        selectHora.innerHTML = '<option value="">Selecciona manicurista, servicio y fecha</option>';
        btnGuardar.disabled = true;
        return;
    }
    
    try {
        const params = new URLSearchParams({
            manicurista,
            fecha,
            id_servicio: servicio
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
            
            // Habilitar botón guardar solo cuando se seleccione un horario
            selectHora.addEventListener('change', function() {
                btnGuardar.disabled = !this.value;
            });
            
            // Si no hay horario seleccionado, deshabilitar botón
            btnGuardar.disabled = true;
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
    cargarCitas();
    cargarManicuristas();
    
    // Listeners para actualizar horarios disponibles
    document.getElementById('cita-manicurista').addEventListener('change', cargarHorariosDisponibles);
    document.getElementById('cita-fecha').addEventListener('change', cargarHorariosDisponibles);
    document.getElementById('cita-servicio').addEventListener('change', cargarHorariosDisponibles);
    
    // Cerrar modales con click fuera o ESC
    document.getElementById('modal-cita').addEventListener('click', (e) => {
        if (e.target.id === 'modal-cita') {
            cerrarModalCita();
        }
    });
    
    document.getElementById('modal-mensaje').addEventListener('click', (e) => {
        if (e.target.id === 'modal-mensaje') {
            cerrarModalMensaje();
        }
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            cerrarModalCita();
            cerrarModalMensaje();
        }
    });
});