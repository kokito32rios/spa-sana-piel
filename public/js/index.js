// =============================================
// CARGAR SERVICIOS DESDE LA API
// =============================================
async function cargarServicios() {
    const loader = document.getElementById('servicios-loader');
    const grid = document.getElementById('servicios-grid');
    const errorDiv = document.getElementById('servicios-error');

    try {
        const response = await fetch('/api/servicios');
        
        if (!response.ok) {
            throw new Error('Error al cargar servicios');
        }

        const data = await response.json();
        
        // Ocultar loader
        loader.classList.add('hidden');

        if (data.servicios && data.servicios.length > 0) {
            // Mostrar grid
            grid.classList.remove('hidden');
            
            // Renderizar cada servicio
            grid.innerHTML = data.servicios.map(servicio => {
                // Solo intentar cargar imagen si existe
                const tieneImagenReal = servicio.url_imagen && 
                                       !servicio.url_imagen.includes('Gemini_Generated');
                
                const totalImagenes = servicio.total_imagenes || 0;
                const textoGaleria = totalImagenes > 1 
                    ? `${totalImagenes} fotos` 
                    : 'Ver más';
                
                return `
                    <div class="servicio-card">
                        <div class="servicio-imagen-container">
                            ${tieneImagenReal
                                ? `<img src="${servicio.url_imagen}" alt="${servicio.nombre}" class="servicio-imagen" onerror="this.outerHTML='<div class=\\'servicio-imagen placeholder\\'>💅</div>'">`
                                : `<div class="servicio-imagen placeholder">💅</div>`
                            }
                            <a href="/catalogo.html?servicio=${servicio.id_servicio}" class="imagen-overlay">
                                <span class="overlay-texto">
                                    <span class="overlay-icono">📷</span>
                                    Ver galería
                                    ${totalImagenes > 1 ? `<br><small>(${totalImagenes} fotos)</small>` : ''}
                                </span>
                            </a>
                        </div>
                        <div class="servicio-contenido">
                            <h3 class="servicio-nombre">${servicio.nombre}</h3>
                            <p class="servicio-descripcion">
                                ${servicio.descripcion || 'Servicio profesional de alta calidad'}
                            </p>
                            <div class="servicio-footer">
                                <div class="servicio-precio">${formatearPrecio(servicio.precio)}</div>
                                <div class="servicio-duracion">⏱️ ${servicio.duracion_minutos} min</div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            
            console.log('✅ Servicios cargados:', data.servicios.length);
        } else {
            // No hay servicios
            grid.innerHTML = '<p class="text-center">No hay servicios disponibles en este momento.</p>';
            grid.classList.remove('hidden');
        }

    } catch (error) {
        console.error('❌ Error al cargar servicios:', error);
        loader.classList.add('hidden');
        errorDiv.classList.remove('hidden');
    }
}

// =============================================
// FORMATEAR PRECIO
// =============================================
function formatearPrecio(precio) {
    return new Intl.NumberFormat('es-CO', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(precio);
}

// =============================================
// NAVBAR SCROLL
// =============================================
window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    if (window.scrollY > 100) {
        navbar.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    } else {
        navbar.style.boxShadow = '0 2px 8px rgba(207, 122, 100, 0.1)';
    }
});

// =============================================
// VERIFICAR SESIÓN ACTIVA (sin auto-redirigir)
// =============================================
const token = localStorage.getItem('token');
if (token) {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        
        // Verificar si el token no ha expirado
        if (payload.exp * 1000 > Date.now()) {
            const rol = payload.nombre_rol;
            
            // Solo cambiar el navbar, NO redirigir
            const navLogin = document.querySelector('.nav-login');
            if (navLogin) {
                navLogin.textContent = 'Mi Cuenta';
                navLogin.href = `/dashboard-${rol}.html`;
            }
            
            // Cambiar botón hero de "Agendar Cita" a "Ir al Dashboard"
            const heroButtons = document.querySelectorAll('.cta-section a, .hero-buttons a[href="/login.html"]');
            heroButtons.forEach(btn => {
                if (btn.href.includes('login.html')) {
                    btn.textContent = 'Ir a Mi Dashboard';
                    btn.href = `/dashboard-${rol}.html`;
                }
            });
        } else {
            // Token expirado, limpiar
            localStorage.removeItem('token');
        }
    } catch (e) {
        // Token inválido
        localStorage.removeItem('token');
    }
}

// =============================================
// INICIALIZAR AL CARGAR LA PÁGINA
// =============================================
document.addEventListener('DOMContentLoaded', () => {
    cargarServicios();
});