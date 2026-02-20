// =============================================
// TOGGLE MOSTRAR/OCULTAR CONTRASEÑA
// =============================================
function togglePassword() {
    const passwordInput = document.getElementById('password');
    const eyeIcon = document.getElementById('eye-icon');

    if (passwordInput.type === 'password') {
        // Mostrar contraseña
        passwordInput.type = 'text';
        eyeIcon.innerHTML = `
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
        `;
    } else {
        // Ocultar contraseña
        passwordInput.type = 'password';
        eyeIcon.innerHTML = `
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
        `;
    }
}

// =============================================
// VERIFICAR SI YA HAY SESIÓN
// =============================================
window.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));

            // Verificar si el token no ha expirado
            if (payload.exp * 1000 > Date.now()) {
                const rol = payload.nombre_rol.toLowerCase();
                window.location.href = `/dashboard-${rol}.html`;
            } else {
                localStorage.removeItem('token');
            }
        } catch (e) {
            localStorage.removeItem('token');
        }
    }
});

// =============================================
// MOSTRAR MODAL
// =============================================
function mostrarModal(tipo, icono, titulo, mensaje) {
    console.log('Mostrando modal:', { tipo, icono, titulo, mensaje });

    const modal = document.getElementById('modal');
    const modalIcon = document.getElementById('modal-icon');
    const modalTitulo = document.getElementById('modal-titulo');
    const modalMensaje = document.getElementById('modal-mensaje');

    if (!modal || !modalIcon || !modalTitulo || !modalMensaje) {
        console.error('Elementos del modal no encontrados');
        alert(`${titulo}\n\n${mensaje}`);
        return;
    }

    // Configurar icono
    modalIcon.textContent = icono;
    modalIcon.className = `modal-icon ${tipo}`;

    // Configurar contenido
    modalTitulo.textContent = titulo;
    modalMensaje.textContent = mensaje;

    // Mostrar modal
    modal.classList.remove('hidden');

    console.log('Modal mostrado correctamente');
}

// =============================================
// CERRAR MODAL
// =============================================
function cerrarModal() {
    console.log('Cerrando modal');
    const modal = document.getElementById('modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// =============================================
// MODAL DE REGISTRO (Contactar admin)
// =============================================
function mostrarModalRegistro(e) {
    e.preventDefault();
    mostrarModal(
        'info',
        '📧',
        '¿Necesitas una cuenta?',
        'Para obtener acceso al sistema, por favor contacta al administrador. Las cuentas son creadas únicamente por el personal autorizado.'
    );
}

// =============================================
// MANEJO DEL FORMULARIO
// =============================================
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-login');
    const btnLogin = document.getElementById('btn-login');

    if (!form || !btnLogin) {
        console.error('Formulario o botón no encontrados');
        return;
    }

    const btnText = btnLogin.querySelector('.btn-text');
    const btnLoader = btnLogin.querySelector('.btn-loader');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        console.log('Formulario enviado');

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        console.log('Email:', email);

        // Validación básica
        if (!email || !password) {
            mostrarModal('warning', '⚠️', 'Campos requeridos', 'Por favor completa todos los campos');
            return;
        }

        // Validar formato de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            mostrarModal('warning', '⚠️', 'Email inválido', 'Por favor ingresa un correo electrónico válido');
            return;
        }

        // Mostrar loader
        btnLogin.disabled = true;
        btnText.classList.add('hidden');
        btnLoader.classList.remove('hidden');

        console.log('Enviando petición al servidor...');

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            console.log('Respuesta recibida:', response.status);

            const data = await response.json();
            console.log('Data:', data);

            // Ocultar loader
            btnLogin.disabled = false;
            btnText.classList.remove('hidden');
            btnLoader.classList.add('hidden');

            if (data.success) {
                // Guardar token
                localStorage.setItem('token', data.token);

                // Mostrar éxito y redirigir
                mostrarModal('success', '✓', '¡Bienvenido!', `Hola ${data.usuario.nombre}, redirigiendo...`);

                setTimeout(() => {
                    const rol = data.usuario.rol.toLowerCase();
                    window.location.href = `/dashboard-${rol}.html`;
                }, 1500);

            } else {
                // Manejar diferentes tipos de error
                if (data.tipo === 'usuario_no_existe') {
                    mostrarModal(
                        'error',
                        '❌',
                        'Usuario no encontrado',
                        'Este correo no está registrado en el sistema. Por favor contacta al administrador para solicitar una cuenta.'
                    );
                } else if (data.tipo === 'password_incorrecto') {
                    mostrarModal(
                        'error',
                        '🔒',
                        'Contraseña incorrecta',
                        'La contraseña ingresada no es correcta. Por favor verifica e intenta nuevamente.'
                    );
                } else {
                    mostrarModal(
                        'error',
                        '❌',
                        'Error',
                        data.message || 'Ocurrió un error al iniciar sesión'
                    );
                }
            }

        } catch (error) {
            console.error('Error en fetch:', error);

            btnLogin.disabled = false;
            btnText.classList.remove('hidden');
            btnLoader.classList.add('hidden');

            mostrarModal(
                'error',
                '⚠️',
                'Error de conexión',
                'No se pudo conectar con el servidor. Por favor verifica tu conexión a internet.'
            );
        }
    });

    // Cerrar modal con ESC
    document.addEventListener('keydown', (e) => {
        const modal = document.getElementById('modal');
        if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
            cerrarModal();
        }
    });

    // Cerrar modal al hacer click fuera
    const modal = document.getElementById('modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                cerrarModal();
            }
        });
    }
});