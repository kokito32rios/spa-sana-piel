// Estado del Wizard
let reservaState = {
    servicio: null,
    manicurista: null,
    fecha: null,
    hora: null,
    precio: 0
};

document.addEventListener('DOMContentLoaded', () => {
    verificarAuth();
    cargarMisCitas();

    // Listener fecha
    const fechaInput = document.getElementById('input-fecha-reserva');
    if (fechaInput) {
        // Mínimo hoy
        const hoy = new Date().toISOString().split('T')[0];
        fechaInput.min = hoy;
        fechaInput.value = hoy;
        fechaInput.addEventListener('change', cargarHorariosDisponibles);
    }
});

async function verificarAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    // Decodificar payload para nombre (opcional o llamada a API profile)
    // Por ahora asumimos que el token es valido, si falla API => 401 => logout
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        document.getElementById('user-name').textContent = payload.nombre || 'Cliente';
    } catch (e) { console.error(e); }
}

function cerrarSesion() {
    Swal.fire({
        title: '¿Cerrar sesión?',
        text: "¿Estás segura de que quieres salir?",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#e91e63', // Primary color
        cancelButtonColor: '#6c757d',
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
// CARGA DE DATOS
// =============================================
window.cargarMisCitas = cargarMisCitas; // Hacer global para Socket.IO

async function cargarMisCitas() {
    const containerProximas = document.getElementById('proximas-citas-list');
    const containerHistorial = document.getElementById('historial-citas-list');

    try {
        const res = await fetch('/api/citas/mis-citas', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();

        if (data.success) {
            renderCitas(data.citas, containerProximas, containerHistorial);
        } else {
            console.error(data.message);
        }
    } catch (error) {
        console.error('Error cargando citas', error);
        containerProximas.innerHTML = '<p class="text-danger">Error al cargar citas</p>';
    }
}

function renderCitas(citas, containerProx, containerHist) {
    containerProx.innerHTML = '';
    containerHist.innerHTML = '';

    const hoy = new Date();

    const activas = [];
    const historial = [];

    citas.forEach(cita => {
        // Normalizar fecha: si viene como string ISO, cortar parte de fecha. Si es objeto, toISOString
        let fechaStr = cita.fecha;
        if (typeof fechaStr !== 'string') {
            // Asumir objeto Date
            try {
                fechaStr = new Date(fechaStr).toISOString().split('T')[0];
            } catch (e) {
                fechaStr = new Date().toISOString().split('T')[0]; // Fallback
            }
        } else if (fechaStr.includes('T')) {
            fechaStr = fechaStr.split('T')[0];
        }

        const fechaCita = new Date(fechaStr + 'T' + cita.hora_inicio);

        // Comparar con "ahora" (menos 1 hora de margen para que no desaparezcan inmediatamente)
        const margen = new Date(hoy.getTime() - 60 * 60 * 1000);

        if (['pendiente', 'confirmada'].includes(cita.estado) && fechaCita >= margen) {
            activas.push(cita);
        } else {
            historial.push(cita);
        }
    });

    if (activas.length === 0) containerProx.innerHTML = '<p class="text-muted">No tienes citas próximas agendadas.</p>';
    if (historial.length === 0) containerHist.innerHTML = '<p class="text-muted">No hay historial reciente.</p>';

    activas.forEach(c => containerProx.appendChild(crearTarjetaCita(c, true)));
    historial.forEach(c => containerHist.appendChild(crearTarjetaCita(c, false)));
}

function crearTarjetaCita(cita, esActiva) {
    const div = document.createElement('div');
    div.className = `cita-card-client status-${cita.estado}`;

    // Fix: Parse manually to avoid timezone shift
    // cita.fecha usually comes as 'YYYY-MM-DD' or ISO string
    const fechaParts = cita.fecha.split('T')[0].split('-');
    const fechaObj = new Date(fechaParts[0], fechaParts[1] - 1, fechaParts[2]);
    const fecha = fechaObj.toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    div.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
                <h4 style="margin:0; color:var(--primary-color);">${cita.nombre_servicio}</h4>
                <p style="margin:5px 0 0 0; font-weight:600;">${fecha} - ${cita.hora_inicio.substr(0, 5)}</p>
                <p style="margin:2px 0 0 0; font-size:0.9em; color:#666;">Con: ${cita.nombre_manicurista}</p>
            </div>
            <span class="badge badge-${cita.estado}">${cita.estado}</span>
        </div>
        ${esActiva ? `
        <div style="margin-top:10px; border-top:1px solid #eee; padding-top:8px; text-align:right;">
            <button onclick="cancelarCitaWhatsApp('${cita.id_cita}', '${cita.nombre_servicio}', '${fecha}', '${cita.hora_inicio}', '${cita.nombre_manicurista}')" 
                class="btn btn-outline-danger btn-sm">
                <i class="fab fa-whatsapp"></i> Cancelar / Reagendar
            </button>
        </div>` : ''}
    `;
    return div;
}

// =============================================
// WA CANCELLATION
// =============================================
// =============================================
// WA CANCELLATION (SOLICITUD)
// =============================================
async function cancelarCitaWhatsApp(id, servicio, fecha, hora, manicurista) {
    const result = await Swal.fire({
        title: 'Solicitar Cancelación',
        text: "Para cancelar o reagendar tu cita, por favor comunícate directamente con nosotros vía WhatsApp.",
        icon: 'info',
        showCancelButton: true,
        confirmButtonColor: '#25D366', // WhatsApp Green
        cancelButtonColor: '#6c757d',
        confirmButtonText: '<i class="fab fa-whatsapp"></i> Ir a WhatsApp',
        cancelButtonText: 'Volver'
    });

    if (result.isConfirmed) {
        const numeroAdmin = "573042754182"; // Número del Spa
        const nombreCliente = document.getElementById('user-name').textContent || 'Cliente';

        const mensaje = `Hola, soy ${nombreCliente}. Quisiera cancelar o reagendar mi cita de *${servicio}* programada para el *${fecha} a las ${hora}* con *${manicurista}*.`;

        const url = `https://wa.me/${numeroAdmin}?text=${encodeURIComponent(mensaje)}`;
        window.open(url, '_blank');
    }
}

// =============================================
// WIZARD RESERVA
// =============================================
function abrirWizardReserva() {
    document.getElementById('wizard-overlay').style.display = 'block';
    document.getElementById('booking-wizard').style.display = 'block';
    cargarServiciosWizard();
    showStep(1);

    // Reset state
    reservaState = { servicio: null, manicurista: null, fecha: null, hora: null, precio: 0 };
    updateNextButtons();
}

function cerrarWizard() {
    document.getElementById('wizard-overlay').style.display = 'none';
    document.getElementById('booking-wizard').style.display = 'none';
}

function showStep(n) {
    document.querySelectorAll('.booking-step').forEach(s => s.classList.remove('active'));
    document.getElementById(`step-${n}`).classList.add('active');

    if (n === 2 && !reservaState.manicurista) cargarManicuristasWizard();
    if (n === 3) cargarHorariosDisponibles();
    if (n === 4) mostrarResumen();
}

function nextStep(n) { showStep(n); }
function prevStep(n) { showStep(n); }

// CARGADORES WIZARD
async function cargarServiciosWizard() {
    const div = document.getElementById('lista-servicios');
    const btnNext = document.getElementById('btn-next-1');
    div.innerHTML = 'Cargando...';

    try {
        const res = await fetch('/api/servicios', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
        const data = await res.json();

        div.innerHTML = '';
        if (data.success) {
            data.servicios.forEach(srv => {
                const el = document.createElement('div');
                el.className = 'service-option';
                el.innerHTML = `
                    <div style="font-weight:bold;">${srv.nombre}</div>
                    <div style="font-size:0.9em; color:#666;">$${srv.precio} - ⏱ ${srv.duracion_minutos} min</div>
                `;
                el.onclick = () => {
                    document.querySelectorAll('.service-option').forEach(x => x.classList.remove('selected'));
                    el.classList.add('selected');
                    // Add duracion alias for congruency
                    srv.duracion = srv.duracion_minutos;
                    reservaState.servicio = srv;
                    btnNext.disabled = false;
                };
                div.appendChild(el);
            });
        }
    } catch (e) { console.error(e); }
}

async function cargarManicuristasWizard() {
    const div = document.getElementById('lista-manicuristas');
    const btnNext = document.getElementById('btn-next-2');
    div.innerHTML = 'Cargando...';

    try {
        const res = await fetch('/api/citas/helpers/manicuristas?fecha=2000-01-01', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();

        div.innerHTML = '';
        // "Cualquiera" removido por requerimiento de usuario (estricto same logic as admin)

        if (data.success) {
            data.manicuristas.forEach(m => {
                const el = document.createElement('div');
                el.className = 'manicurist-option';
                el.innerHTML = `<strong>👩‍🦰 ${m.nombre_completo}</strong>`;
                el.onclick = () => {
                    document.querySelectorAll('.manicurist-option').forEach(x => x.classList.remove('selected'));
                    el.classList.add('selected');
                    reservaState.manicurista = { email: m.email, nombre: m.nombre_completo };
                    btnNext.disabled = false;
                };
                div.appendChild(el);
            });
        }
    } catch (e) { console.error(e); }
}

async function cargarHorariosDisponibles() {
    const div = document.getElementById('lista-horarios');
    const fecha = document.getElementById('input-fecha-reserva').value;
    const loader = document.getElementById('loader-horarios');
    const btnNext = document.getElementById('btn-next-3');

    if (!reservaState.servicio || !fecha) return;

    div.innerHTML = '';
    loader.style.display = 'block';

    reservaState.fecha = fecha;
    reservaState.hora = null;
    btnNext.disabled = true;

    try {
        // Updated logic: Use helpers/horarios-disponibles endpoint + send id_servicio
        let url = `/api/citas/helpers/horarios-disponibles?fecha=${fecha}&duracion=${reservaState.servicio.duracion}&id_servicio=${reservaState.servicio.id_servicio}`;
        if (reservaState.manicurista && reservaState.manicurista.email) {
            url += `&manicurista=${reservaState.manicurista.email}`;
        }

        console.log("Consultando disponibilidad:", url);

        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
        const data = await res.json();

        loader.style.display = 'none';

        if (data.success && data.horarios && data.horarios.length > 0) {
            data.horarios.forEach(h => {
                const el = document.createElement('div');
                el.className = 'time-slot';
                el.textContent = h.inicio;
                // Backend API change?? data.horarios is usually [{hora: "09:00", disponible: true}]
                // Let's check citas.controller again.
                // It returns { horarios: [{ hora: '09:00', disponible: true }] }
                // So h.inicio might be wrong if I assumed previous format.
                // Let's use h.hora
                const horaStr = h.hora || h.inicio; // Fallback
                el.textContent = horaStr;

                el.onclick = () => {
                    document.querySelectorAll('.time-slot').forEach(x => x.classList.remove('selected'));
                    el.classList.add('selected');
                    reservaState.hora = horaStr;
                    btnNext.disabled = false;
                };
                div.appendChild(el);
            });
        } else {
            div.innerHTML = '<p class="text-danger">No hay citas disponibles para esta fecha.</p>';
        }

    } catch (e) {
        loader.style.display = 'none';
        console.error(e);
    }
}

function mostrarResumen() {
    document.getElementById('resumen-servicio').textContent = reservaState.servicio.nombre;
    document.getElementById('resumen-manicurista').textContent = reservaState.manicurista.nombre;
    document.getElementById('resumen-fecha').textContent = reservaState.fecha;
    document.getElementById('resumen-hora').textContent = reservaState.hora;
    document.getElementById('resumen-precio').textContent = '$' + reservaState.servicio.precio;
}

function updateNextButtons() {
    document.getElementById('btn-next-1').disabled = !reservaState.servicio;
    document.getElementById('btn-next-2').disabled = !reservaState.manicurista;
    document.getElementById('btn-next-3').disabled = !reservaState.hora;
}

// CONFIRMAR
async function confirmarReserva() {
    const btn = document.getElementById('btn-confirmar');
    btn.disabled = true;
    btn.innerHTML = 'Procesando...';

    // Endpoint /agendar expects: email_manicurista, id_servicio, fecha, hora_inicio
    const payload = {
        fecha: reservaState.fecha,
        hora_inicio: reservaState.hora,
        id_servicio: reservaState.servicio.id_servicio,
        email_manicurista: reservaState.manicurista.email
    };

    try {
        const res = await fetch('/api/citas/agendar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success) {
            Swal.fire('¡Reservado!', 'Tu cita ha sido agendada con éxito.', 'success')
                .then(() => {
                    cerrarWizard();
                    cargarMisCitas();
                });
        } else {
            Swal.fire('Error', data.message || 'No se pudo agendar', 'error');
        }
    } catch (e) {
        console.error(e);
        Swal.fire('Error', 'Error de conexión', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '🔔 Confirmar Cita';
    }
}
